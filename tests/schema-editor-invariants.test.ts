import type { JSONSchema7 } from "json-schema"
import { describe, expect, it } from "vitest"

import { mapPreserve } from "@/components/schema-editor/document/array"
import {
  fromJsonSchema,
  nodeFromJson,
  projectNode,
  toJsonSchema,
} from "@/components/schema-editor/document/convert"
import {
  addDefinition,
  removeDefinition,
  renameDefinition,
  setRef,
  setRefByName,
} from "@/components/schema-editor/document/definition-operations"
import {
  getEffectiveKind,
  isDanglingRef,
  isDefinitionReferenced,
  isNullable,
  resolveRef,
} from "@/components/schema-editor/document/derive"
import {
  addEnumValue,
  removeEnumValue,
  removeEnumValueAtIndex,
  setEnumValues,
  updateEnumValue,
  updateEnumValueAtIndex,
} from "@/components/schema-editor/document/enum-operations"
import {
  getNodeJson,
  replaceNodeJson,
  updateNodeJson,
} from "@/components/schema-editor/document/json-node"
import {
  decodeJsonPointerSegment,
  definitionNameFromRef,
  definitionRef,
  definitionRefAliases,
  escapeJsonPointerSegment,
  unescapeJsonPointerSegment,
} from "@/components/schema-editor/document/json-pointer"
import {
  setNodeDescription,
  setNodeTitle,
  stripDescriptions,
} from "@/components/schema-editor/document/node-metadata"
import {
  getChildNodeId,
  getEffectiveDocNode,
  getItemsNodeId,
} from "@/components/schema-editor/document/node-selectors"
import { updateNode } from "@/components/schema-editor/document/node-update"
import {
  addProperty,
  findOwningProperty,
  moveProperty,
  removeProperty,
  renameProperty,
  setRequired,
} from "@/components/schema-editor/document/property-operations"
import {
  findNodeByPath,
  getNode,
} from "@/components/schema-editor/document/traversal"
import {
  createNode,
  setNodeType,
  setNullable,
} from "@/components/schema-editor/document/type-operations"
import type {
  DocumentNode,
  SchemaDocument,
} from "@/components/schema-editor/document/types"
import { requireAllProperties } from "@/components/schema-editor/schema-required-policy"
import {
  countSchemaProperties,
  validateProjectedSchema,
} from "@/components/schema-editor/validation"

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function build(schema: JSONSchema7): SchemaDocument {
  return fromJsonSchema(schema)
}
function rt(schema: JSONSchema7): JSONSchema7 {
  return toJsonSchema(fromJsonSchema(schema)) as JSONSchema7
}
/** id of a top-level property's node by key. */
function propNodeId(doc: SchemaDocument, key: string): string {
  const id = getChildNodeId(doc, doc.root.id, key)
  if (!id) throw new Error(`no property ${key}`)
  return id
}

// ===========================================================================
// A. Round-trip losslessness
// ===========================================================================

describe("round-trip losslessness", () => {
  it("preserves a simple object with required", () => {
    const s: JSONSchema7 = {
      type: "object",
      properties: { a: { type: "string" }, b: { type: "number" } },
      required: ["a"],
    }
    expect(rt(s)).toEqual(s)
  })

  it("preserves an explicit empty required array", () => {
    const s: JSONSchema7 = {
      type: "object",
      properties: { a: { type: "string" } },
      required: [],
    }
    expect(rt(s)).toEqual(s)
  })

  it("preserves required order distinct from property order", () => {
    const s: JSONSchema7 = {
      type: "object",
      properties: { a: { type: "string" }, b: { type: "string" } },
      required: ["b", "a"],
    }
    expect(rt(s).required).toEqual(["b", "a"])
  })

  it("preserves nested objects and arrays of objects", () => {
    const s: JSONSchema7 = {
      type: "object",
      properties: {
        list: {
          type: "array",
          items: {
            type: "object",
            properties: { x: { type: "integer" } },
            required: ["x"],
          },
        },
      },
    }
    expect(rt(s)).toEqual(s)
  })

  it("preserves tuple (array-form) items verbatim", () => {
    const s: JSONSchema7 = {
      type: "array",
      items: [{ type: "string" }, { type: "number" }],
    }
    expect(rt(s)).toEqual(s)
  })

  it("preserves boolean schemas as property values", () => {
    const s: JSONSchema7 = {
      type: "object",
      properties: { anything: true, nothing: false },
      additionalProperties: false,
    }
    expect(rt(s)).toEqual(s)
  })

  it("preserves anyOf nullable string", () => {
    const s: JSONSchema7 = {
      anyOf: [{ type: "string" }, { type: "null" }],
    }
    expect(rt(s)).toEqual(s)
  })

  it("preserves nullable via type array", () => {
    const s: JSONSchema7 = { type: ["string", "null"] }
    expect(rt(s)).toEqual(s)
  })

  it("preserves a string enum", () => {
    const s: JSONSchema7 = { type: "string", enum: ["a", "b", "c"] }
    expect(rt(s)).toEqual(s)
  })

  it("preserves $defs and $ref", () => {
    const s: JSONSchema7 = {
      type: "object",
      properties: { addr: { $ref: "#/$defs/Address" } },
      $defs: {
        Address: {
          type: "object",
          properties: { city: { type: "string" } },
        },
      },
    }
    expect(rt(s)).toEqual(s)
  })

  it("preserves legacy definitions keyword and ref", () => {
    const s: JSONSchema7 = {
      type: "object",
      properties: { addr: { $ref: "#/definitions/Address" } },
      definitions: {
        Address: { type: "object", properties: { city: { type: "string" } } },
      },
    }
    expect(rt(s)).toEqual(s)
  })

  it("preserves unmodeled scalar keywords (const/default/format/pattern)", () => {
    const s: JSONSchema7 = {
      type: "object",
      properties: {
        a: { type: "string", format: "email", pattern: "^x", minLength: 2 },
        b: { type: "string", const: "fixed" },
        c: { type: "number", default: 3, minimum: 0 },
      },
    }
    expect(rt(s)).toEqual(s)
  })

  it("preserves a property literally named 'type'", () => {
    const s: JSONSchema7 = {
      type: "object",
      properties: { type: { type: "string" }, required: { type: "number" } },
      required: ["type"],
    }
    expect(rt(s)).toEqual(s)
  })

  it("preserves oneOf and allOf", () => {
    const s: JSONSchema7 = {
      oneOf: [{ type: "string" }, { type: "number" }],
    }
    expect(rt(s)).toEqual(s)
    const a: JSONSchema7 = { allOf: [{ type: "object" }, { required: ["x"] }] }
    expect(rt(a)).toEqual(a)
  })

  it("preserves root-level $schema and $id", () => {
    const s: JSONSchema7 = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "https://example.com/s",
      type: "object",
      properties: { a: { type: "string" } },
    }
    expect(rt(s)).toEqual(s)
  })

  it("preserves arbitrary x- extension keywords", () => {
    const s = {
      type: "object",
      "x-foo": { nested: [1, 2, 3] },
      properties: { a: { type: "string", "x-bar": "baz" } },
    } as unknown as JSONSchema7
    expect(rt(s)).toEqual(s)
  })

  it("preserves a $ref to a definition whose name contains / and ~", () => {
    const s: JSONSchema7 = {
      type: "object",
      properties: { a: { $ref: "#/$defs/foo~1bar~0baz" } },
      $defs: { "foo/bar~baz": { type: "string" } },
    }
    expect(rt(s)).toEqual(s)
  })

  it("preserves additionalProperties as a schema (in rest)", () => {
    const s: JSONSchema7 = {
      type: "object",
      properties: { a: { type: "string" } },
      additionalProperties: { type: "number" },
    }
    expect(rt(s)).toEqual(s)
  })

  it("preserves x-enumDescriptions alongside an enum", () => {
    const s = {
      type: "string",
      enum: ["a", "b"],
      "x-enumDescriptions": { a: "Alpha", b: "Beta" },
    } as unknown as JSONSchema7
    expect(rt(s)).toEqual(s)
  })

  it("preserves a self-referential definition (recursive tree)", () => {
    const s: JSONSchema7 = {
      $ref: "#/$defs/Node",
      $defs: {
        Node: {
          type: "object",
          properties: {
            value: { type: "string" },
            children: { type: "array", items: { $ref: "#/$defs/Node" } },
          },
        },
      },
    }
    expect(rt(s)).toEqual(s)
  })
})

describe("round-trip losslessness — nullable containers & edge structures", () => {
  it("preserves a nullable object via type array with properties", () => {
    const s: JSONSchema7 = {
      type: ["object", "null"],
      properties: { a: { type: "string" } },
      required: ["a"],
    }
    expect(rt(s)).toEqual(s)
  })

  it("preserves a nullable array via type array with items", () => {
    const s: JSONSchema7 = {
      type: ["array", "null"],
      items: { type: "string" },
    }
    expect(rt(s)).toEqual(s)
  })

  it("preserves an enum that includes null", () => {
    const s: JSONSchema7 = { type: ["string", "null"], enum: ["a", "b", null] }
    expect(rt(s)).toEqual(s)
  })

  it("preserves both $defs and legacy definitions when both are present", () => {
    const s: JSONSchema7 = {
      type: "object",
      properties: {
        a: { $ref: "#/$defs/A" },
        b: { $ref: "#/definitions/B" },
      },
      $defs: { A: { type: "string" } },
      definitions: { B: { type: "number" } },
    }
    expect(rt(s)).toEqual(s)
  })

  it("preserves an object with no properties but explicit empty required", () => {
    const s: JSONSchema7 = { type: "object", properties: {}, required: [] }
    expect(rt(s)).toEqual(s)
  })

  it("preserves required names that have no matching property (extraRequired)", () => {
    const s: JSONSchema7 = {
      type: "object",
      properties: { a: { type: "string" } },
      required: ["a", "ghost"],
    }
    expect(rt(s).required).toEqual(["a", "ghost"])
  })

  it("preserves a const of complex value", () => {
    const s = {
      type: "object",
      const: { nested: [1, { x: true }] },
    } as unknown as JSONSchema7
    expect(rt(s)).toEqual(s)
  })
})

// ===========================================================================
// B. Nullable toggling invariants
// ===========================================================================

describe("setNullable invariants", () => {
  it("toggling on then off restores a scalar to its original projection", () => {
    const s: JSONSchema7 = { type: "object", properties: { a: { type: "string" } } }
    const doc = build(s)
    const id = propNodeId(doc, "a")
    const on = setNullable(doc, id, true)
    expect((toJsonSchema(on) as any).properties.a.type).toEqual(["string", "null"])
    const off = setNullable(on, id, false)
    expect((toJsonSchema(off) as any).properties.a).toEqual({ type: "string" })
  })

  it("is idempotent when enabling twice on a scalar", () => {
    const doc = build({ type: "object", properties: { a: { type: "string" } } })
    const id = propNodeId(doc, "a")
    const once = toJsonSchema(setNullable(doc, id, true))
    const twice = toJsonSchema(setNullable(setNullable(doc, id, true), id, true))
    expect(twice).toEqual(once)
  })

  it("wraps an enum into an anyOf null branch and unwraps back", () => {
    const doc = build({ type: "string", enum: ["a", "b"] })
    const id = doc.root.id
    const on = setNullable(doc, id, true)
    expect(isNullable(getNode(on, id)!)).toBe(true)
    const onJson = toJsonSchema(on) as any
    expect(onJson.anyOf).toBeTruthy()
    const off = setNullable(on, id, false)
    expect(toJsonSchema(off)).toEqual({ type: "string", enum: ["a", "b"] })
  })

  it("wraps a $ref into an anyOf null branch and unwraps back", () => {
    const s: JSONSchema7 = {
      type: "object",
      properties: { a: { $ref: "#/$defs/D" } },
      $defs: { D: { type: "string" } },
    }
    const doc = build(s)
    const id = propNodeId(doc, "a")
    const on = setNullable(doc, id, true)
    expect(isNullable(getNode(on, id)!)).toBe(true)
    const off = setNullable(on, id, false)
    expect((toJsonSchema(off) as any).properties.a).toEqual({
      $ref: "#/$defs/D",
    })
  })

  it("enabling nullable on an already-nullable anyOf is a no-op", () => {
    const doc = build({ anyOf: [{ type: "string" }, { type: "null" }] })
    const id = doc.root.id
    const before = toJsonSchema(doc)
    const after = toJsonSchema(setNullable(doc, id, true))
    expect(after).toEqual(before)
  })
})

// ===========================================================================
// C. Type conversion
// ===========================================================================

describe("setNodeType", () => {
  it("preserves nullability when retyping a nullable scalar", () => {
    const doc = build({ type: ["string", "null"] })
    const next = setNodeType(doc, doc.root.id, "integer")
    const node = getNode(next, doc.root.id)!
    expect(isNullable(node)).toBe(true)
    expect(getEffectiveKind(node)).toBe("integer")
  })

  it("clears string-specific rest when retyping string -> number", () => {
    const doc = build({ type: "string", minLength: 3, pattern: "^x" })
    const next = setNodeType(doc, doc.root.id, "number")
    const json = toJsonSchema(next) as any
    expect(json.minLength).toBeUndefined()
    expect(json.pattern).toBeUndefined()
    expect(json.type).toBe("number")
  })

  it("retyping to object yields a default editable property", () => {
    const doc = build({ type: "string" })
    const next = setNodeType(doc, doc.root.id, "object")
    const node = getNode(next, doc.root.id)!
    expect(node.type).toBe("object")
    expect(node.properties?.length).toBe(1)
  })

  it("retyping to array yields default string items", () => {
    const doc = build({ type: "string" })
    const next = setNodeType(doc, doc.root.id, "array")
    const node = getNode(next, doc.root.id)!
    expect(node.items?.type).toBe("string")
  })

  it("retyping object -> array -> object does not resurrect old properties", () => {
    const doc = build({
      type: "object",
      properties: { keep: { type: "string" } },
    })
    const arr = setNodeType(doc, doc.root.id, "array")
    const back = setNodeType(arr, doc.root.id, "object")
    const json = toJsonSchema(back) as any
    expect(json.properties.keep).toBeUndefined()
  })

  it("retyping to enum keeps existing enum values or seeds one", () => {
    const doc = build({ type: "string", enum: ["a"] })
    const next = setNodeType(doc, doc.root.id, "enum" as any)
    const node = getNode(next, doc.root.id)!
    expect(node.enum?.map((e) => e.value)).toEqual(["a"])

    // a freshly-typed enum should always be seeded with at least one slot
    const base = build({ type: "string" })
    const fresh = setNodeType(base, base.root.id, "enum" as any)
    const freshNode = getNode(fresh, base.root.id)!
    expect((freshNode.enum?.length ?? 0) >= 1).toBe(true)
  })
})

// ===========================================================================
// D. Property operations
// ===========================================================================

describe("property operations", () => {
  it("addProperty tunnels into a nullable object branch", () => {
    const doc = build({
      anyOf: [
        { type: "object", properties: { a: { type: "string" } } },
        { type: "null" },
      ],
    })
    const next = addProperty(doc, doc.root.id, { key: "b" })
    const json = toJsonSchema(next) as any
    const objBranch = json.anyOf.find((b: any) => b.type === "object")
    expect(Object.keys(objBranch.properties)).toEqual(["a", "b"])
  })

  it("removeProperty updates required projection", () => {
    const doc = build({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "string" } },
      required: ["a", "b"],
    })
    const aId = findOwningProperty(doc, doc.root.properties![0].id)
    expect(aId).toBeTruthy()
    const next = removeProperty(doc, doc.root.properties![0].id)
    const json = toJsonSchema(next) as any
    expect(Object.keys(json.properties)).toEqual(["b"])
    expect(json.required).toEqual(["b"])
  })

  it("renaming two properties to the same key drops the duplicate at export", () => {
    const doc = build({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "number" } },
    })
    const bId = doc.root.properties![1].id
    const next = renameProperty(doc, bId, "a")
    const json = toJsonSchema(next) as any
    expect(Object.keys(json.properties)).toEqual(["a"])
    // the first "a" wins
    expect(json.properties.a).toEqual({ type: "string" })
  })

  it("setRequired toggles a property in and out of required[]", () => {
    const doc = build({
      type: "object",
      properties: { a: { type: "string" } },
    })
    const aId = doc.root.properties![0].id
    const on = setRequired(doc, aId, true)
    expect((toJsonSchema(on) as any).required).toEqual(["a"])
    const off = setRequired(on, aId, false)
    expect((toJsonSchema(off) as any).required).toBeUndefined()
  })

  it("moveProperty rejects moving a node into its own descendant", () => {
    const doc = build({
      type: "object",
      properties: {
        parent: {
          type: "object",
          properties: { child: { type: "object", properties: {} } },
        },
      },
    })
    const parentProp = doc.root.properties![0]
    const childNodeId = getChildNodeId(doc, parentProp.node.id, "child")!
    const next = moveProperty(doc, parentProp.id, childNodeId, 0)
    // unchanged: the move would create a cycle
    expect(toJsonSchema(next)).toEqual(toJsonSchema(doc))
  })

  it("moveProperty relocates a property to another object", () => {
    const doc = build({
      type: "object",
      properties: {
        moveMe: { type: "string" },
        target: { type: "object", properties: {} },
      },
    })
    const moveMe = doc.root.properties![0]
    const targetId = doc.root.properties![1].node.id
    const next = moveProperty(doc, moveMe.id, targetId, 0)
    const json = toJsonSchema(next) as any
    expect(Object.keys(json.properties)).toEqual(["target"])
    expect(Object.keys(json.properties.target.properties)).toEqual(["moveMe"])
  })

  it("renaming a property to empty string drops it from the projection", () => {
    const doc = build({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "number" } },
    })
    const aId = doc.root.properties![0].id
    const next = renameProperty(doc, aId, "")
    expect(Object.keys((toJsonSchema(next) as any).properties)).toEqual(["b"])
  })

  it("moveProperty within the same parent reorders to the target index", () => {
    const doc = build({
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: "string" },
        c: { type: "string" },
      },
    })
    const cId = doc.root.properties![2].id
    const next = moveProperty(doc, cId, doc.root.id, 0)
    expect(Object.keys((toJsonSchema(next) as any).properties)).toEqual([
      "c",
      "a",
      "b",
    ])
  })

  it("moveProperty clamps an out-of-range index", () => {
    const doc = build({
      type: "object",
      properties: {
        target: { type: "object", properties: { x: { type: "string" } } },
        moveMe: { type: "string" },
      },
    })
    const moveMe = doc.root.properties![1]
    const targetId = doc.root.properties![0].node.id
    const next = moveProperty(doc, moveMe.id, targetId, 999)
    const json = toJsonSchema(next) as any
    expect(Object.keys(json.properties.target.properties)).toEqual([
      "x",
      "moveMe",
    ])
  })
})

// ===========================================================================
// E. Definition operations
// ===========================================================================

describe("definition operations", () => {
  it("renameDefinition rewrites id-based refs on export", () => {
    const doc = build({
      type: "object",
      properties: { a: { $ref: "#/$defs/Old" } },
      $defs: { Old: { type: "string" } },
    })
    const defId = doc.defs[0].id
    const next = renameDefinition(doc, defId, "New")
    const json = toJsonSchema(next) as any
    expect(json.properties.a.$ref).toBe("#/$defs/New")
    expect(json.$defs.New).toBeTruthy()
    expect(json.$defs.Old).toBeUndefined()
  })

  it("renameDefinition rewrites raw refs buried in rest (additionalProperties)", () => {
    const doc = build({
      type: "object",
      additionalProperties: { $ref: "#/$defs/Old" },
      $defs: { Old: { type: "string" } },
    })
    const defId = doc.defs[0].id
    const next = renameDefinition(doc, defId, "New")
    const json = toJsonSchema(next) as any
    expect(json.additionalProperties.$ref).toBe("#/$defs/New")
  })

  it("renameDefinition avoids colliding with an existing name", () => {
    let doc = build({
      $defs: { A: { type: "string" }, B: { type: "number" } },
    })
    const aId = doc.defs[0].id
    doc = renameDefinition(doc, aId, "B")
    const names = doc.defs.map((d) => d.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain("B2")
  })

  it("removeDefinition leaves a dangling ref detectable via isDanglingRef", () => {
    const doc = build({
      type: "object",
      properties: { a: { $ref: "#/$defs/D" } },
      $defs: { D: { type: "string" } },
    })
    const defId = doc.defs[0].id
    const refNode = getNode(doc, propNodeId(doc, "a"))!
    expect(isDanglingRef(doc, refNode)).toBe(false)
    const next = removeDefinition(doc, defId)
    const refAfter = getNode(next, propNodeId(next, "a"))!
    expect(isDanglingRef(next, refAfter)).toBe(true)
  })

  it("isDefinitionReferenced sees a ref nested in rest", () => {
    const doc = build({
      type: "object",
      additionalProperties: { $ref: "#/$defs/D" },
      $defs: { D: { type: "string" } },
    })
    expect(isDefinitionReferenced(doc, doc.defs[0].id)).toBe(true)
  })

  it("isDefinitionReferenced is false for an unused definition", () => {
    const doc = build({
      type: "object",
      properties: { a: { type: "string" } },
      $defs: { Unused: { type: "string" } },
    })
    expect(isDefinitionReferenced(doc, doc.defs[0].id)).toBe(false)
  })

  it("addDefinition de-duplicates names", () => {
    let { doc } = addDefinition(build({ $defs: { Definition: { type: "string" } } }))
    expect(doc.defs.map((d) => d.name)).toEqual(["Definition", "Definition2"])
    ;({ doc } = addDefinition(doc))
    expect(doc.defs.map((d) => d.name)).toContain("Definition3")
  })

  it("setRefByName converts a node into a $ref", () => {
    const doc = build({
      type: "object",
      properties: { a: { type: "string" } },
      $defs: { D: { type: "string" } },
    })
    const next = setRefByName(doc, propNodeId(doc, "a"), "D")
    expect((toJsonSchema(next) as any).properties.a).toEqual({
      $ref: "#/$defs/D",
    })
  })

  it("renameDefinition to the same name is a no-op", () => {
    const doc = build({
      type: "object",
      properties: { a: { $ref: "#/$defs/D" } },
      $defs: { D: { type: "string" } },
    })
    const next = renameDefinition(doc, doc.defs[0].id, "D")
    expect(toJsonSchema(next)).toEqual(toJsonSchema(doc))
  })

  it("renameDefinition rewrites a percent-encoded raw ref in rest", () => {
    const doc = build({
      type: "object",
      additionalProperties: { $ref: "#/$defs/My%20Def" },
      $defs: { "My Def": { type: "string" } },
    })
    const next = renameDefinition(doc, doc.defs[0].id, "Renamed")
    const json = toJsonSchema(next) as any
    expect(json.additionalProperties.$ref).toBe("#/$defs/Renamed")
    expect(json.$defs.Renamed).toBeTruthy()
  })

  it("renameDefinition rewrites a ref held inside another definition", () => {
    const doc = build({
      $defs: {
        A: { type: "object", properties: { b: { $ref: "#/$defs/B" } } },
        B: { type: "string" },
      },
    })
    const bId = doc.defs.find((d) => d.name === "B")!.id
    const next = renameDefinition(doc, bId, "Renamed")
    const json = toJsonSchema(next) as any
    expect(json.$defs.A.properties.b.$ref).toBe("#/$defs/Renamed")
  })

  it("isDefinitionReferenced(exceptDefId) ignores a self-reference", () => {
    const doc = build({
      $defs: {
        Node: {
          type: "object",
          properties: { next: { $ref: "#/$defs/Node" } },
        },
      },
    })
    const nodeDef = doc.defs[0]
    // referenced overall (by itself)
    expect(isDefinitionReferenced(doc, nodeDef.id)).toBe(true)
    // but if we exclude the def itself, the only reference disappears
    expect(
      isDefinitionReferenced(doc, nodeDef.id, { exceptDefId: nodeDef.id })
    ).toBe(false)
  })

  it("setRef on a type-array-nullable node wraps the ref in an anyOf null branch", () => {
    const doc = build({
      type: "object",
      properties: { a: { type: ["string", "null"] } },
      $defs: { D: { type: "string" } },
    })
    const next = setRef(doc, propNodeId(doc, "a"), doc.defs[0].id)
    const json = toJsonSchema(next) as any
    expect(json.properties.a.anyOf).toEqual([
      { $ref: "#/$defs/D" },
      { type: "null" },
    ])
  })
})

describe("property operations — deeper edges", () => {
  it("setRequired works on a property inside a nullable object branch", () => {
    const doc = build({
      anyOf: [
        { type: "object", properties: { a: { type: "string" } } },
        { type: "null" },
      ],
    })
    const objBranch = doc.root.anyOf!.find((b) => b.type === "object")!
    const aId = objBranch.properties![0].id
    const next = setRequired(doc, aId, true)
    const json = toJsonSchema(next) as any
    const branch = json.anyOf.find((b: any) => b.type === "object")
    expect(branch.required).toEqual(["a"])
  })

  it("moving a required property carries required to the destination", () => {
    const doc = build({
      type: "object",
      properties: {
        a: { type: "string" },
        target: { type: "object", properties: {} },
      },
      required: ["a"],
    })
    const aId = doc.root.properties![0].id
    const targetId = doc.root.properties![1].node.id
    const next = moveProperty(doc, aId, targetId, 0)
    const json = toJsonSchema(next) as any
    expect(Object.keys(json.properties)).toEqual(["target"])
    expect(json.properties.target.required).toEqual(["a"])
    // source no longer requires "a"
    expect(json.required ?? []).not.toContain("a")
  })
})

// ===========================================================================
// F. Enum operations
// ===========================================================================

describe("enum operations", () => {
  function enumDoc(): SchemaDocument {
    return build({ type: "string", enum: ["a", "b", "c"] })
  }

  it("addEnumValue appends a value", () => {
    const doc = enumDoc()
    const next = addEnumValue(doc, doc.root.id, "d")
    expect((toJsonSchema(next) as any).enum).toEqual(["a", "b", "c", "d"])
  })

  it("updateEnumValue patches by id while keeping order", () => {
    const doc = enumDoc()
    const enumId = doc.root.enum![1].id
    const next = updateEnumValue(doc, doc.root.id, enumId, { value: "B" })
    expect((toJsonSchema(next) as any).enum).toEqual(["a", "B", "c"])
  })

  it("removeEnumValueAtIndex removes the right slot", () => {
    const doc = enumDoc()
    const next = removeEnumValueAtIndex(doc, doc.root.id, 1)
    expect((toJsonSchema(next) as any).enum).toEqual(["a", "c"])
  })

  it("updateEnumValueAtIndex out of bounds is a no-op", () => {
    const doc = enumDoc()
    const next = updateEnumValueAtIndex(doc, doc.root.id, 99, "z")
    expect(toJsonSchema(next)).toEqual(toJsonSchema(doc))
  })

  it("setEnumValues preserves entry identity by index", () => {
    const doc = enumDoc()
    const originalIds = doc.root.enum!.map((e) => e.id)
    const next = setEnumValues(doc, doc.root.id, ["a", "B", "c", "d"])
    const nextIds = getNode(next, doc.root.id)!.enum!.map((e) => e.id)
    expect(nextIds.slice(0, 3)).toEqual(originalIds)
    expect((toJsonSchema(next) as any).enum).toEqual(["a", "B", "c", "d"])
  })

  it("removing every enum value leaves an empty enum (no crash)", () => {
    const doc = build({ type: "string", enum: ["only"] })
    const enumId = doc.root.enum![0].id
    const next = removeEnumValue(doc, doc.root.id, enumId)
    expect((toJsonSchema(next) as any).enum).toEqual([])
  })

  it("setEnumValues to a shorter then longer list reuses ids by position", () => {
    const doc = build({ type: "string", enum: ["a", "b", "c"] })
    const id0 = doc.root.enum![0].id
    const shrunk = setEnumValues(doc, doc.root.id, ["a"])
    expect(getNode(shrunk, doc.root.id)!.enum!.map((e) => e.id)).toEqual([id0])
    const grown = setEnumValues(shrunk, doc.root.id, ["a", "x", "y"])
    expect(getNode(grown, doc.root.id)!.enum![0].id).toBe(id0)
    expect((toJsonSchema(grown) as any).enum).toEqual(["a", "x", "y"])
  })

  it("manages enum values on a type-array-nullable enum node", () => {
    const doc = build({ type: ["string", "null"], enum: ["a", "b", null] })
    const next = addEnumValue(doc, doc.root.id, "c")
    const json = toJsonSchema(next) as any
    // nullable enum projects through an anyOf wrapper
    expect(json.anyOf).toBeTruthy()
    const enumBranch = json.anyOf.find((b: any) => Array.isArray(b.enum))
    expect(enumBranch.enum).toEqual(["a", "b", null, "c"])
  })
})

// ===========================================================================
// G. Traversal / path resolution
// ===========================================================================

describe("findNodeByPath", () => {
  const doc = build({
    type: "object",
    properties: {
      user: {
        type: "object",
        properties: { name: { type: "string" } },
      },
      tags: { type: "array", items: { type: "string" } },
      maybe: {
        anyOf: [
          { type: "object", properties: { deep: { type: "string" } } },
          { type: "null" },
        ],
      },
    },
  })

  it("resolves a nested object path", () => {
    const id = findNodeByPath(doc, "user.name")
    expect(getNode(doc, id!)!.type).toBe("string")
  })

  it("resolves through array items to the element object", () => {
    const arrDoc = build({
      type: "object",
      properties: {
        rows: {
          type: "array",
          items: { type: "object", properties: { cell: { type: "number" } } },
        },
      },
    })
    const id = findNodeByPath(arrDoc, "rows.cell")
    expect(getNode(arrDoc, id!)!.type).toBe("number")
  })

  it("resolves through a nullable anyOf wrapper", () => {
    const id = findNodeByPath(doc, "maybe.deep")
    expect(getNode(doc, id!)!.type).toBe("string")
  })

  it("resolves through a $ref", () => {
    const refDoc = build({
      type: "object",
      properties: { a: { $ref: "#/$defs/D" } },
      $defs: {
        D: { type: "object", properties: { inner: { type: "boolean" } } },
      },
    })
    const id = findNodeByPath(refDoc, "a.inner")
    expect(getNode(refDoc, id!)!.type).toBe("boolean")
  })

  it("returns root id for an empty path", () => {
    expect(findNodeByPath(doc, "")).toBe(doc.root.id)
  })

  it("returns null for a missing path", () => {
    expect(findNodeByPath(doc, "user.nope")).toBeNull()
  })
})

// ===========================================================================
// H. JSON pointer
// ===========================================================================

describe("json pointer", () => {
  it("escape/unescape round-trips names with ~ and /", () => {
    const names = ["plain", "a/b", "a~b", "~1", "~0", "a~1b/c", "%20", "타입"]
    for (const name of names) {
      expect(unescapeJsonPointerSegment(escapeJsonPointerSegment(name))).toBe(
        name
      )
    }
  })

  it("escapes ~ before / (tilde-one stays distinct from slash)", () => {
    // literal "~1" must encode to "~01", not "~1" (which means slash)
    expect(escapeJsonPointerSegment("~1")).toBe("~01")
    expect(unescapeJsonPointerSegment("~01")).toBe("~1")
    expect(unescapeJsonPointerSegment("~1")).toBe("/")
  })

  it("definitionRef escapes the name", () => {
    expect(definitionRef("$defs", "a/b")).toBe("#/$defs/a~1b")
  })

  it("definitionNameFromRef inverts definitionRef for both keywords", () => {
    for (const kw of ["$defs", "definitions"] as const) {
      for (const name of ["Plain", "a/b", "a~b", "My Def"]) {
        expect(definitionNameFromRef(definitionRef(kw, name))).toBe(name)
      }
    }
  })

  it("definitionRefAliases includes the canonical and percent-encoded forms", () => {
    const aliases = definitionRefAliases("$defs", "My Def")
    expect(aliases).toContain("#/$defs/My Def")
    expect(aliases).toContain("#/$defs/My%20Def")
  })

  it("decodeJsonPointerSegment decodes percent-encoding then unescapes", () => {
    expect(decodeJsonPointerSegment("My%20Def")).toBe("My Def")
    expect(decodeJsonPointerSegment("a~1b")).toBe("a/b")
  })
})

// ===========================================================================
// I. requireAllProperties policy
// ===========================================================================

describe("requireAllProperties", () => {
  it("marks every property required recursively", () => {
    const out = requireAllProperties({
      type: "object",
      properties: {
        a: { type: "string" },
        b: {
          type: "object",
          properties: { c: { type: "string" } },
        },
      },
    }) as any
    expect(out.required).toEqual(["a", "b"])
    expect(out.properties.b.required).toEqual(["c"])
  })

  it("requires properties inside array items", () => {
    const out = requireAllProperties({
      type: "array",
      items: { type: "object", properties: { x: { type: "string" } } },
    }) as any
    expect(out.items.required).toEqual(["x"])
  })

  it("requires properties inside $defs", () => {
    const out = requireAllProperties({
      $defs: { D: { type: "object", properties: { y: { type: "string" } } } },
    } as any) as any
    expect(out.$defs.D.required).toEqual(["y"])
  })

  it("merges with existing required without duplicating", () => {
    const out = requireAllProperties({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "string" } },
      required: ["b"],
    }) as any
    expect(out.required).toEqual(["b", "a"])
  })

  it("does not mutate the input schema", () => {
    const input: JSONSchema7 = {
      type: "object",
      properties: { a: { type: "string" } },
    }
    requireAllProperties(input)
    expect(input.required).toBeUndefined()
  })

  it("preserves a dependencies array (does not treat it as a schema)", () => {
    const out = requireAllProperties({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "string" } },
      dependencies: { a: ["b"] },
    } as any) as any
    expect(out.dependencies.a).toEqual(["b"])
  })
})

// ===========================================================================
// J. countSchemaProperties
// ===========================================================================

describe("countSchemaProperties", () => {
  it("counts top-level and nested properties", () => {
    expect(
      countSchemaProperties({
        type: "object",
        properties: {
          a: { type: "string" },
          b: { type: "object", properties: { c: { type: "string" } } },
        },
      })
    ).toBe(3)
  })

  it("counts properties reached through array items", () => {
    expect(
      countSchemaProperties({
        type: "object",
        properties: {
          rows: {
            type: "array",
            items: { type: "object", properties: { x: { type: "string" } } },
          },
        },
      })
    ).toBe(2)
  })

  it("terminates on a recursive $ref", () => {
    const count = countSchemaProperties({
      $ref: "#/$defs/Node",
      $defs: {
        Node: {
          type: "object",
          properties: {
            value: { type: "string" },
            next: { $ref: "#/$defs/Node" },
          },
        },
      },
    } as any)
    // 2 from Node, and the recursive ref must not loop forever
    expect(count).toBe(2)
  })

  it("returns 0 for empty / non-object schemas", () => {
    expect(countSchemaProperties(undefined)).toBe(0)
    expect(countSchemaProperties({})).toBe(0)
    expect(countSchemaProperties(true as any)).toBe(0)
  })

  it("counts properties under patternProperties", () => {
    expect(
      countSchemaProperties({
        type: "object",
        patternProperties: {
          "^x": { type: "object", properties: { a: { type: "string" } } },
        },
      } as any)
    ).toBe(1)
  })
})

describe("validateProjectedSchema policy", () => {
  it("accepts a plain object schema", () => {
    const result = validateProjectedSchema({
      type: "object",
      properties: { a: { type: "string" } },
    } as any)
    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it("rejects a purely-numeric property name", () => {
    const result = validateProjectedSchema({
      type: "object",
      properties: { "123": { type: "string" } },
    } as any)
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.code === "numeric_property_name")).toBe(
      true
    )
  })

  it("rejects additionalProperties: true (must be false)", () => {
    const result = validateProjectedSchema({
      type: "object",
      additionalProperties: true,
      properties: {},
    } as any)
    expect(result.isValid).toBe(false)
    expect(
      result.errors.some((e) => e.code === "additional_properties_not_false")
    ).toBe(true)
  })

  it("accepts additionalProperties: false", () => {
    const result = validateProjectedSchema({
      type: "object",
      additionalProperties: false,
      properties: { a: { type: "string" } },
    } as any)
    expect(result.isValid).toBe(true)
  })

  it("flags property-count over the limit", () => {
    const properties: Record<string, unknown> = {}
    for (let i = 0; i < 501; i++) properties[`p${i}`] = { type: "string" }
    const result = validateProjectedSchema({
      type: "object",
      properties,
    } as any)
    expect(result.isPropertyLimitExceeded).toBe(true)
    expect(result.isValid).toBe(false)
    expect(result.propertyCount).toBe(501)
  })

  it("does not double-count a single reference's target as over-limit", () => {
    // a recursive structure must not inflate the count infinitely
    const result = validateProjectedSchema({
      type: "object",
      properties: { self: { $ref: "#/$defs/Self" } },
      $defs: {
        Self: {
          type: "object",
          properties: { again: { $ref: "#/$defs/Self" } },
        },
      },
    } as any)
    expect(result.propertyCount).toBeLessThan(PROPERTY_LIMIT_GUARD)
  })
})

const PROPERTY_LIMIT_GUARD = 100

// ===========================================================================
// K. node metadata
// ===========================================================================

describe("node metadata", () => {
  it("setNodeDescription stores verbatim but clears whitespace-only values", () => {
    const doc = build({ type: "string" })
    // value is stored as-is (surrounding whitespace preserved on purpose)
    const set = setNodeDescription(doc, doc.root.id, "  hello  ")
    expect(getNode(set, doc.root.id)!.description).toBe("  hello  ")
    // whitespace-only is treated as empty and cleared
    const cleared = setNodeDescription(set, doc.root.id, "   ")
    expect(getNode(cleared, doc.root.id)!.description).toBeUndefined()
  })

  it("setNodeTitle stores verbatim but clears whitespace-only values", () => {
    const doc = build({ type: "string" })
    const set = setNodeTitle(doc, doc.root.id, "  T  ")
    expect(getNode(set, doc.root.id)!.title).toBe("  T  ")
    const cleared = setNodeTitle(set, doc.root.id, "  ")
    expect(getNode(cleared, doc.root.id)!.title).toBeUndefined()
  })

  it("stripDescriptions removes descriptions everywhere, including rest", () => {
    const doc = build({
      type: "object",
      description: "root",
      properties: { a: { type: "string", description: "a desc" } },
      additionalProperties: { type: "number", description: "ap desc" },
    })
    const stripped = stripDescriptions(doc)
    const json = JSON.stringify(toJsonSchema(stripped))
    expect(json).not.toContain("desc")
    expect(json).not.toContain("root")
  })
})

// ===========================================================================
// L. low-level helpers
// ===========================================================================

describe("mapPreserve", () => {
  it("returns the same array reference when nothing changes", () => {
    const arr = [1, 2, 3]
    expect(mapPreserve(arr, (x) => x)).toBe(arr)
  })

  it("returns a new array when an element changes", () => {
    const arr = [1, 2, 3]
    const out = mapPreserve(arr, (x) => (x === 2 ? 20 : x))
    expect(out).not.toBe(arr)
    expect(out).toEqual([1, 20, 3])
  })
})

describe("derive helpers", () => {
  it("getEffectiveKind classifies unions, refs, enums", () => {
    expect(getEffectiveKind({ id: "x", rest: {}, ref: "d" })).toBe("ref")
    expect(
      getEffectiveKind({ id: "x", rest: {}, enum: [{ id: "e", value: "a" }] })
    ).toBe("enum")
    expect(
      getEffectiveKind({
        id: "x",
        rest: {},
        anyOf: [{ id: "y", rest: {}, type: "string" }],
      })
    ).toBe("union")
    expect(getEffectiveKind({ id: "x", rest: {}, type: ["string", "null"] })).toBe(
      "string"
    )
    expect(getEffectiveKind({ id: "x", rest: {} })).toBe("any")
  })

  it("getEffectiveKind returns union for a multi-type array", () => {
    expect(
      getEffectiveKind({ id: "x", rest: {}, type: ["string", "number"] })
    ).toBe("union")
    expect(
      getEffectiveKind({ id: "x", rest: {}, type: ["string", "number", "null"] })
    ).toBe("union")
  })

  it("getEffectiveDocNode unwraps a single nullable branch", () => {
    const node: DocumentNode = {
      id: "x",
      rest: {},
      anyOf: [
        { id: "real", rest: {}, type: "string" },
        { id: "n", rest: {}, type: "null" },
      ],
    }
    expect(getEffectiveDocNode(node).id).toBe("real")
  })

  it("resolveRef and isDanglingRef agree", () => {
    const doc = build({
      type: "object",
      properties: { a: { $ref: "#/$defs/D" } },
      $defs: { D: { type: "string" } },
    })
    const node = getNode(doc, propNodeId(doc, "a"))!
    expect(resolveRef(doc, node)?.name).toBe("D")
    expect(isDanglingRef(doc, node)).toBe(false)
  })
})

// ===========================================================================
// M. node-level JSON bridge (json-node.ts)
// ===========================================================================

describe("node JSON bridge", () => {
  it("getNodeJson projects a node's schema with named refs", () => {
    const doc = build({
      type: "object",
      properties: { a: { $ref: "#/$defs/D" } },
      $defs: { D: { type: "string" } },
    })
    const json = getNodeJson(doc, propNodeId(doc, "a"))
    expect(json).toEqual({ $ref: "#/$defs/D" })
  })

  it("replaceNodeJson preserves the node id", () => {
    const doc = build({ type: "object", properties: { a: { type: "string" } } })
    const id = propNodeId(doc, "a")
    const next = replaceNodeJson(doc, id, { type: "number", minimum: 0 })
    expect(getNode(next, id)).toBeTruthy()
    expect((toJsonSchema(next) as any).properties.a).toEqual({
      type: "number",
      minimum: 0,
    })
  })

  it("updateNodeJson read-modify-writes a node", () => {
    const doc = build({ type: "object", properties: { a: { type: "string" } } })
    const id = propNodeId(doc, "a")
    const next = updateNodeJson(doc, id, (json) => ({
      ...(json as object),
      description: "added",
    }))
    expect((toJsonSchema(next) as any).properties.a.description).toBe("added")
  })

  it("nodeFromJson resolves refs against existing definitions", () => {
    const doc = build({
      type: "object",
      properties: { a: { type: "string" } },
      $defs: { D: { type: "string" } },
    })
    const node = nodeFromJson({ $ref: "#/$defs/D" }, doc)
    expect(node.ref).toBe(doc.defs[0].id)
  })
})

// ===========================================================================
// N. immutability guarantees
// ===========================================================================

describe("immutability", () => {
  it("operations do not mutate the input document's root properties", () => {
    const doc = build({
      type: "object",
      properties: { a: { type: "string" } },
    })
    const snapshot = JSON.stringify(toJsonSchema(doc))
    addProperty(doc, doc.root.id, { key: "b" })
    setRequired(doc, doc.root.properties![0].id, true)
    setNodeType(doc, doc.root.id, "array")
    expect(JSON.stringify(toJsonSchema(doc))).toBe(snapshot)
  })

  it("updateNode returns the same reference when the node is untouched", () => {
    const doc = build({ type: "object", properties: { a: { type: "string" } } })
    const same = updateNode(doc, "does-not-exist", (n) => n)
    expect(same).toBe(doc)
  })

  it("getItemsNodeId returns undefined for a non-array node", () => {
    const doc = build({ type: "object", properties: { a: { type: "string" } } })
    expect(getItemsNodeId(doc, doc.root.id)).toBeUndefined()
  })
})
