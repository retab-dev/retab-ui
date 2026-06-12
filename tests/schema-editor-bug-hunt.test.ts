import Ajv from "ajv"
import type { JSONSchema7 } from "json-schema"
import { describe, expect, it } from "vitest"

import {
  fromJsonSchema,
  toJsonSchema,
  nodeFromJson,
  projectNode,
} from "@/components/schema-editor/document/convert"
import {
  getEffectiveKind,
  isNullable,
  isDanglingRef,
  isDefinitionReferenced,
} from "@/components/schema-editor/document/derive"
import {
  addDefinition,
  removeDefinition,
  renameDefinition,
  setRef,
} from "@/components/schema-editor/document/definition-operations"
import {
  addEnumValue,
  removeEnumValueAtIndex,
  setEnumValues,
  updateEnumValueAtIndex,
} from "@/components/schema-editor/document/enum-operations"
import {
  getChildNodeId,
  getChildPropertyId,
} from "@/components/schema-editor/document/node-selectors"
import {
  addProperty,
  moveProperty,
  removeProperty,
  renameProperty,
  setRequired,
} from "@/components/schema-editor/document/property-operations"
import {
  setNodeType,
  setNodeEditorType,
  setNullable,
} from "@/components/schema-editor/document/type-operations"
import {
  findNodeByPath,
  getNode,
} from "@/components/schema-editor/document/traversal"
import type { SchemaDocument } from "@/components/schema-editor/document/types"

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const roundtrip = (schema: JSONSchema7): JSONSchema7 =>
  toJsonSchema(fromJsonSchema(schema))

/** Deep key-sort so two schemas can be compared ignoring key order. */
function normalize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normalize)
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, normalize((v as Record<string, unknown>)[k])])
    )
  }
  return v
}

const sameContent = (a: unknown, b: unknown) =>
  expect(normalize(a)).toEqual(normalize(b))

/** Resolve a node id by dotted property path from the root. */
function nodeId(doc: SchemaDocument, path: string): string {
  const id = findNodeByPath(doc, path)
  if (!id) throw new Error(`no node at path "${path}"`)
  return id
}

// ===========================================================================
// 1. Nullable toggling — reversibility & idempotency
// ===========================================================================

describe("nullable: toggle on then off restores the original schema", () => {
  const cases: Array<[string, JSONSchema7]> = [
    ["string scalar", { type: "string" }],
    ["number scalar", { type: "number" }],
    ["object", { type: "object", properties: { a: { type: "string" } } }],
    ["array", { type: "array", items: { type: "string" } }],
    ["enum", { type: "string", enum: ["a", "b"] }],
    ["union", { type: ["string", "number"] }],
  ]

  for (const [name, inner] of cases) {
    it(`${name} survives nullable→non-nullable`, () => {
      const doc = fromJsonSchema({
        type: "object",
        properties: { f: inner },
      })
      const fid = nodeId(doc, "f")
      const on = setNullable(doc, fid, true)
      // After turning nullable ON, the node reports nullable.
      expect(isNullable(getNode(on, fid) ?? getEffectiveTarget(on, fid))).toBe(
        true
      )
      const off = setNullable(on, nodeId(on, "f"), false)
      const out = toJsonSchema(off) as JSONSchema7
      sameContent(out.properties!.f, inner)
    })
  }
})

// When a node is wrapped into an anyOf the original id moves onto the wrapper,
// so re-resolve by path for the assertion above.
function getEffectiveTarget(doc: SchemaDocument, fallbackId: string) {
  return getNode(doc, fallbackId) ?? getNode(doc, nodeId(doc, "f"))!
}

describe("nullable: turning on twice is idempotent", () => {
  const cases: Array<[string, JSONSchema7]> = [
    ["string", { type: "string" }],
    ["enum", { type: "string", enum: ["a", "b"] }],
    ["object", { type: "object", properties: { a: { type: "string" } } }],
  ]
  for (const [name, inner] of cases) {
    it(`${name}`, () => {
      const doc = fromJsonSchema({ type: "object", properties: { f: inner } })
      const once = setNullable(doc, nodeId(doc, "f"), true)
      const twice = setNullable(once, nodeId(once, "f"), true)
      sameContent(
        (toJsonSchema(once) as JSONSchema7).properties!.f,
        (toJsonSchema(twice) as JSONSchema7).properties!.f
      )
    })
  }
})

describe("nullable: a nullable enum stored as type-array round-trips", () => {
  it("preserves the null member when adding an enum value", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { type: ["string", "null"], enum: ["a", null] } },
    })
    const next = addEnumValue(doc, nodeId(doc, "f"), "b")
    const out = toJsonSchema(next) as JSONSchema7
    const projected = out.properties!.f as JSONSchema7
    // however it is structured, "a", null and "b" must all still be options,
    // and the value must still permit null.
    const enumMembers = collectEnumMembers(projected)
    expect(enumMembers).toContain("a")
    expect(enumMembers).toContain("b")
    expect(permitsNull(projected)).toBe(true)
  })
})

function collectEnumMembers(schema: JSONSchema7): unknown[] {
  const out: unknown[] = []
  if (Array.isArray(schema.enum)) out.push(...schema.enum)
  for (const branch of schema.anyOf ?? []) {
    if (typeof branch === "object" && Array.isArray(branch.enum))
      out.push(...branch.enum)
  }
  return out
}

function permitsNull(schema: JSONSchema7): boolean {
  if (schema.type === "null") return true
  if (Array.isArray(schema.type) && schema.type.includes("null")) return true
  if (Array.isArray(schema.enum) && schema.enum.includes(null as never))
    return true
  return (schema.anyOf ?? []).some(
    (b) => typeof b === "object" && permitsNull(b)
  )
}

// ===========================================================================
// 2. Type switching — strips foreign constraints, keeps meta & own
// ===========================================================================

describe("setNodeType strips type-specific constraints", () => {
  it("string→number drops minLength/pattern, keeps title/description", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: {
        f: {
          type: "string",
          minLength: 2,
          pattern: "^x",
          title: "T",
          description: "D",
        },
      },
    })
    const next = setNodeType(doc, nodeId(doc, "f"), "number")
    const f = (toJsonSchema(next) as JSONSchema7).properties!.f as JSONSchema7
    expect(f.type).toBe("number")
    expect(f.minLength).toBeUndefined()
    expect(f.pattern).toBeUndefined()
    expect(f.title).toBe("T")
    expect(f.description).toBe("D")
  })

  it("number→string drops minimum/maximum", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { type: "number", minimum: 0, maximum: 5 } },
    })
    const next = setNodeType(doc, nodeId(doc, "f"), "string")
    const f = (toJsonSchema(next) as JSONSchema7).properties!.f as JSONSchema7
    expect(f.minimum).toBeUndefined()
    expect(f.maximum).toBeUndefined()
  })

  it("array→object drops array-only items/minItems", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: {
        f: { type: "array", minItems: 1, items: { type: "string" } },
      },
    })
    const next = setNodeType(doc, nodeId(doc, "f"), "object")
    const f = (toJsonSchema(next) as JSONSchema7).properties!.f as JSONSchema7
    expect(f.type).toBe("object")
    expect((f as Record<string, unknown>).minItems).toBeUndefined()
    // array items should not leak as an array `items` keyword on an object
    expect(Array.isArray(f.items)).toBe(false)
  })

  it("switching type preserves a nullable wrapper", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { type: ["string", "null"], minLength: 3 } },
    })
    const next = setNodeType(doc, nodeId(doc, "f"), "number")
    const f = (toJsonSchema(next) as JSONSchema7).properties!.f as JSONSchema7
    expect(permitsNull(f)).toBe(true)
    expect((f as Record<string, unknown>).minLength).toBeUndefined()
  })
})

describe("setNodeEditorType handles date/time formats", () => {
  it("string→date sets format:date", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { type: "string" } },
    })
    const next = setNodeEditorType(doc, nodeId(doc, "f"), "date")
    const f = (toJsonSchema(next) as JSONSchema7).properties!.f as JSONSchema7
    expect(f.format).toBe("date")
  })

  it("date→datetime upgrades to date-time, not keeping stale date", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { type: "string", format: "date" } },
    })
    const next = setNodeEditorType(doc, nodeId(doc, "f"), "datetime")
    const f = (toJsonSchema(next) as JSONSchema7).properties!.f as JSONSchema7
    expect(f.format).toBe("date-time")
  })

  it("date→number drops the stale format", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { type: "string", format: "date" } },
    })
    const next = setNodeEditorType(doc, nodeId(doc, "f"), "number")
    const f = (toJsonSchema(next) as JSONSchema7).properties!.f as JSONSchema7
    expect(f.type).toBe("number")
    expect(f.format).toBeUndefined()
  })
})

// ===========================================================================
// 3. Property operations
// ===========================================================================

describe("moveProperty", () => {
  it("refuses to move an object into its own descendant (no cycle)", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: {
        outer: {
          type: "object",
          properties: { inner: { type: "object", properties: {} } },
        },
      },
    })
    const outerPropId = getChildPropertyId(doc, doc.root.id, "outer")!
    const innerNodeId = nodeId(doc, "outer.inner")
    const next = moveProperty(doc, outerPropId, innerNodeId, 0)
    expect(next).toBe(doc) // unchanged reference: it was a no-op
  })

  it("clamps an out-of-range target index", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: {
        a: { type: "string" },
        bag: { type: "object", properties: { x: { type: "string" } } },
      },
    })
    const aId = getChildPropertyId(doc, doc.root.id, "a")!
    const bagId = nodeId(doc, "bag")
    const next = moveProperty(doc, aId, bagId, 999)
    const bag = (toJsonSchema(next) as JSONSchema7).properties!.bag as JSONSchema7
    expect(Object.keys(bag.properties!)).toEqual(["x", "a"])
  })

  it("moving the only property out leaves an empty object, not a dropped key", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: {
        src: { type: "object", properties: { only: { type: "string" } } },
        dst: { type: "object", properties: {} },
      },
    })
    const onlyId = getChildPropertyId(doc, nodeId(doc, "src"), "only")!
    const next = moveProperty(doc, onlyId, nodeId(doc, "dst"), 0)
    const out = toJsonSchema(next) as JSONSchema7
    expect((out.properties!.src as JSONSchema7).properties).toEqual({})
    expect(
      Object.keys((out.properties!.dst as JSONSchema7).properties!)
    ).toEqual(["only"])
  })
})

describe("renameProperty", () => {
  it("renaming to a duplicate key keeps both rows in the model but projects one", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "number" } },
    })
    const bId = getChildPropertyId(doc, doc.root.id, "b")!
    const next = renameProperty(doc, bId, "a")
    const out = toJsonSchema(next) as JSONSchema7
    // first "a" wins; duplicate is dropped at the projection boundary
    expect(Object.keys(out.properties!)).toEqual(["a"])
    expect((out.properties!.a as JSONSchema7).type).toBe("string")
  })

  it("renaming to empty marks the row transient and drops it from output", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "number" } },
    })
    const bId = getChildPropertyId(doc, doc.root.id, "b")!
    const next = renameProperty(doc, bId, "")
    const out = toJsonSchema(next) as JSONSchema7
    expect(Object.keys(out.properties!)).toEqual(["a"])
  })
})

describe("required flag", () => {
  it("toggling required on then off removes the name from required[]", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" } },
    })
    const aId = getChildPropertyId(doc, doc.root.id, "a")!
    const on = setRequired(doc, aId, true)
    expect((toJsonSchema(on) as JSONSchema7).required).toEqual(["a"])
    const off = setRequired(on, aId, false)
    expect((toJsonSchema(off) as JSONSchema7).required).toBeUndefined()
  })

  it("a removed required property is dropped from required[]", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "string" } },
      required: ["a", "b"],
    })
    const aId = getChildPropertyId(doc, doc.root.id, "a")!
    const out = toJsonSchema(removeProperty(doc, aId)) as JSONSchema7
    expect(out.required).toEqual(["b"])
  })

  it("preserves required for names not modeled as properties (extraRequired)", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" } },
      required: ["a", "ghost"],
    })
    const out = toJsonSchema(doc) as JSONSchema7
    expect(out.required).toEqual(["a", "ghost"])
  })
})

// ===========================================================================
// 4. Definition operations
// ===========================================================================

describe("renameDefinition", () => {
  it("renaming a referenced def updates the projected $ref", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { $ref: "#/$defs/A" } },
      $defs: { A: { type: "string" } },
    })
    const defId = doc.defs[0].id
    const next = renameDefinition(doc, defId, "B")
    const out = toJsonSchema(next) as JSONSchema7
    expect((out.properties!.f as JSONSchema7).$ref).toBe("#/$defs/B")
    expect(out.$defs!.B).toBeDefined()
    expect((out.$defs as Record<string, unknown>).A).toBeUndefined()
  })

  it("renaming into a collision disambiguates instead of clobbering", () => {
    const doc = fromJsonSchema({
      type: "object",
      $defs: { A: { type: "string" }, B: { type: "number" } },
    })
    const bId = doc.defs[1].id
    const next = renameDefinition(doc, bId, "A")
    const names = next.defs.map((d) => d.name)
    expect(new Set(names).size).toBe(2) // no duplicate names
    expect(names).toContain("A")
  })

  it("renaming to blank/whitespace is a no-op", () => {
    const doc = fromJsonSchema({
      type: "object",
      $defs: { A: { type: "string" } },
    })
    expect(renameDefinition(doc, doc.defs[0].id, "   ")).toBe(doc)
    expect(renameDefinition(doc, doc.defs[0].id, "")).toBe(doc)
  })

  it("rewrites a raw $ref carried in rest (e.g. inside patternProperties)", () => {
    const doc = fromJsonSchema({
      type: "object",
      patternProperties: { "^x": { $ref: "#/$defs/A" } },
      $defs: { A: { type: "string" } },
    } as unknown as JSONSchema7)
    const next = renameDefinition(doc, doc.defs[0].id, "Renamed")
    const out = toJsonSchema(next) as Record<string, unknown>
    const pattern = out.patternProperties as Record<string, JSONSchema7>
    expect(pattern["^x"].$ref).toBe("#/$defs/Renamed")
  })
})

describe("removeDefinition", () => {
  it("leaves referencing nodes dangling, detectable via isDanglingRef", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { $ref: "#/$defs/A" } },
      $defs: { A: { type: "string" } },
    })
    expect(isDefinitionReferenced(doc, doc.defs[0].id)).toBe(true)
    const next = removeDefinition(doc, doc.defs[0].id)
    const fNode = getNode(next, nodeId(next, "f"))!
    expect(isDanglingRef(next, fNode)).toBe(true)
  })
})

describe("setRef + addDefinition", () => {
  it("pointing a scalar at a new definition projects a $ref", () => {
    const doc0 = fromJsonSchema({
      type: "object",
      properties: { f: { type: "string" } },
    })
    const { doc, defId } = addDefinition(doc0, { name: "Thing" })
    const next = setRef(doc, nodeId(doc, "f"), defId)
    const out = toJsonSchema(next) as JSONSchema7
    expect((out.properties!.f as JSONSchema7).$ref).toBe("#/$defs/Thing")
    expect(getEffectiveKind(getNode(next, nodeId(next, "f"))!)).toBe("ref")
  })

  it("a nullable scalar pointed at a ref stays nullable", () => {
    const doc0 = fromJsonSchema({
      type: "object",
      properties: { f: { type: ["string", "null"] } },
    })
    const { doc, defId } = addDefinition(doc0, { name: "Thing" })
    const next = setRef(doc, nodeId(doc, "f"), defId)
    const f = (toJsonSchema(next) as JSONSchema7).properties!.f as JSONSchema7
    expect(permitsNull(f)).toBe(true)
    expect(hasRefDeep(f)).toBe(true)
  })
})

function hasRefDeep(schema: JSONSchema7): boolean {
  if (schema.$ref) return true
  return (schema.anyOf ?? []).some(
    (b) => typeof b === "object" && hasRefDeep(b)
  )
}

// ===========================================================================
// 5. Enum operations
// ===========================================================================

describe("enum operations", () => {
  it("setEnumValues turns a plain string into an enum", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { type: "string" } },
    })
    const next = setEnumValues(doc, nodeId(doc, "f"), ["x", "y"])
    const f = (toJsonSchema(next) as JSONSchema7).properties!.f as JSONSchema7
    expect(f.enum).toEqual(["x", "y"])
  })

  it("updateEnumValueAtIndex edits in place without reordering", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { type: "string", enum: ["a", "b", "c"] } },
    })
    const next = updateEnumValueAtIndex(doc, nodeId(doc, "f"), 1, "B")
    const f = (toJsonSchema(next) as JSONSchema7).properties!.f as JSONSchema7
    expect(f.enum).toEqual(["a", "B", "c"])
  })

  it("removeEnumValueAtIndex drops exactly one option", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { type: "string", enum: ["a", "b", "c"] } },
    })
    const next = removeEnumValueAtIndex(doc, nodeId(doc, "f"), 0)
    const f = (toJsonSchema(next) as JSONSchema7).properties!.f as JSONSchema7
    expect(f.enum).toEqual(["b", "c"])
  })

  // Documents the KNOWN losslessness defect: `x-enumDescriptions` is in
  // MODELED_NODE_KEYS but stored nowhere, so it is silently dropped. Tracked as
  // `it.fails` in schema-editor-invariants.test.ts — flip both once it is fixed.
  it("drops x-enumDescriptions (known losslessness gap)", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: {
        f: {
          type: "string",
          enum: ["a", "b"],
          "x-enumDescriptions": { a: "first", b: "second" },
        } as unknown as JSONSchema7,
      },
    })
    const out = toJsonSchema(doc) as JSONSchema7
    const f = out.properties!.f as Record<string, unknown>
    expect(f["x-enumDescriptions"]).toBeUndefined()
  })
})

// ===========================================================================
// 6. Convert edge cases not exercised by the fuzzer
// ===========================================================================

describe("convert: structural edge cases", () => {
  it("a bare boolean schema (true) round-trips", () => {
    expect(roundtrip(true as unknown as JSONSchema7)).toBe(true)
  })

  it("a boolean schema as a property value round-trips", () => {
    const schema = {
      type: "object",
      properties: { open: true, closed: false },
    } as unknown as JSONSchema7
    sameContent(roundtrip(schema), schema)
  })

  it("tuple-form items are preserved verbatim", () => {
    const schema = {
      type: "array",
      items: [{ type: "string" }, { type: "number" }],
    } as unknown as JSONSchema7
    sameContent(roundtrip(schema), schema)
  })

  it("an explicit empty required:[] survives the round-trip", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: { a: { type: "string" } },
      required: [],
    }
    expect((roundtrip(schema) as JSONSchema7).required).toEqual([])
  })

  it("const and default are preserved", () => {
    const schema = {
      type: "object",
      properties: {
        k: { type: "string", const: "fixed", default: "fixed" },
      },
    } as unknown as JSONSchema7
    sameContent(roundtrip(schema), schema)
  })

  it("a property literally named 'type' or 'required' is kept", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        type: { type: "string" },
        required: { type: "boolean" },
      },
      required: ["type"],
    }
    const out = roundtrip(schema) as JSONSchema7
    expect(Object.keys(out.properties!)).toEqual(["type", "required"])
    expect(out.required).toEqual(["type"])
  })

  it("an unresolved $ref is carried verbatim", () => {
    const schema = {
      type: "object",
      properties: { f: { $ref: "#/$defs/DoesNotExist" } },
    } as unknown as JSONSchema7
    const out = roundtrip(schema) as JSONSchema7
    expect((out.properties!.f as JSONSchema7).$ref).toBe(
      "#/$defs/DoesNotExist"
    )
  })

  it("a mixed-type enum round-trips with member identity", () => {
    const schema = {
      type: "object",
      properties: { f: { enum: ["a", 1, true, null] } },
    } as unknown as JSONSchema7
    sameContent(roundtrip(schema), schema)
  })

  it("nodeFromJson/projectNode round-trip a single edited node", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { type: "string" } },
      $defs: { A: { type: "number" } },
    })
    const json: JSONSchema7 = { $ref: "#/$defs/A" }
    const node = nodeFromJson(json, doc)
    expect(node.ref).toBe(doc.defs[0].id)
    sameContent(projectNode(doc, node), json)
  })
})

// ===========================================================================
// 7. traversal robustness
// ===========================================================================

describe("traversal", () => {
  it("findNodeByPath descends through a $ref to a definition", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { $ref: "#/$defs/A" } },
      $defs: {
        A: { type: "object", properties: { deep: { type: "string" } } },
      },
    })
    const id = findNodeByPath(doc, "f.deep")
    expect(id).not.toBeNull()
    expect(getEffectiveKind(getNode(doc, id!)!)).toBe("string")
  })

  it("findNodeByPath does not loop forever on a self-referential def", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { $ref: "#/$defs/A" } },
      $defs: { A: { $ref: "#/$defs/A" } },
    })
    // Resolving a cyclic ref must terminate (return null), not hang.
    expect(findNodeByPath(doc, "f.whatever")).toBeNull()
  })
})

// ===========================================================================
// 8. Behavioral checks: the projected schema actually means what we expect.
//    These compile the output with Ajv and validate concrete data, so a
//    structurally-plausible-but-wrong projection is still caught.
// ===========================================================================

const ajv = new Ajv({ strict: false, allErrors: true })

/** Compile the projected schema and return an `accepts(field, value)` probe. */
function compiled(doc: SchemaDocument) {
  const schema = toJsonSchema(doc) as JSONSchema7
  const validate = ajv.compile(schema)
  return {
    schema,
    accepts: (field: string, value: unknown) =>
      validate({ [field]: value }) === true,
  }
}

describe("nullable semantics (ajv-validated)", () => {
  const bases: Array<[string, JSONSchema7, unknown]> = [
    ["string", { type: "string" }, "x"],
    ["integer", { type: "integer" }, 3],
    ["enum", { type: "string", enum: ["a", "b"] }, "a"],
    ["object", { type: "object", properties: {} }, {}],
    ["array", { type: "array", items: { type: "string" } }, []],
  ]

  for (const [name, base, sample] of bases) {
    it(`${name}: turning nullable on makes null valid and a sample still valid`, () => {
      const doc = fromJsonSchema({ type: "object", properties: { f: base } })
      const next = setNullable(doc, nodeId(doc, "f"), true)
      const { accepts } = compiled(next)
      expect(accepts("f", null)).toBe(true)
      expect(accepts("f", sample)).toBe(true)
    })

    it(`${name}: turning nullable off again makes null invalid`, () => {
      const doc = fromJsonSchema({ type: "object", properties: { f: base } })
      const on = setNullable(doc, nodeId(doc, "f"), true)
      const off = setNullable(on, nodeId(on, "f"), false)
      const { accepts } = compiled(off)
      expect(accepts("f", null)).toBe(false)
      expect(accepts("f", sample)).toBe(true)
    })
  }

  it("ref: a nullable ref accepts null and a conforming object", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { $ref: "#/$defs/Money" } },
      $defs: {
        Money: {
          type: "object",
          properties: { amount: { type: "number" } },
          required: ["amount"],
          additionalProperties: false,
        },
      },
    })
    const next = setNullable(doc, nodeId(doc, "f"), true)
    const { accepts } = compiled(next)
    expect(accepts("f", null)).toBe(true)
    expect(accepts("f", { amount: 1 })).toBe(true)
    expect(accepts("f", { amount: "nope" })).toBe(false)
  })
})

describe("type-switch semantics (ajv-validated)", () => {
  it("string→integer makes a number valid and a string invalid", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { type: "string" } },
    })
    const next = setNodeType(doc, nodeId(doc, "f"), "integer")
    const { accepts } = compiled(next)
    expect(accepts("f", 7)).toBe(true)
    expect(accepts("f", "7")).toBe(false)
  })

  it("a required + nullable field still requires presence but allows null", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { f: { type: "string" } },
    })
    const withReq = setRequired(
      doc,
      getChildPropertyId(doc, doc.root.id, "f")!,
      true
    )
    const next = setNullable(withReq, nodeId(withReq, "f"), true)
    const schema = toJsonSchema(next) as JSONSchema7
    const validate = ajv.compile(schema)
    expect(validate({ f: null })).toBe(true) // present-but-null ok
    expect(validate({})).toBe(false) // absent → fails required
  })
})

// ===========================================================================
// 9. addProperty into containers
// ===========================================================================

describe("addProperty", () => {
  it("adds into a nullable object (anyOf-wrapped) container", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: {
        f: {
          anyOf: [
            { type: "object", properties: { a: { type: "string" } } },
            { type: "null" },
          ],
        },
      },
    })
    const fId = nodeId(doc, "f")
    const next = addProperty(doc, fId, { key: "b", node: undefined })
    const out = toJsonSchema(next) as JSONSchema7
    const branch = (out.properties!.f as JSONSchema7).anyOf!.find(
      (b) => typeof b === "object" && b.type === "object"
    ) as JSONSchema7
    expect(Object.keys(branch.properties!)).toEqual(["a", "b"])
  })

  it("a freshly added empty-key property does not appear in output", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" } },
    })
    const next = addProperty(doc, doc.root.id)
    const out = toJsonSchema(next) as JSONSchema7
    expect(Object.keys(out.properties!)).toEqual(["a"])
  })
})
