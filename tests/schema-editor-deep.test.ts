import type { JSONSchema7, JSONSchema7TypeName } from "json-schema"
import { describe, expect, it } from "vitest"

import {
  fromJsonSchema,
  toJsonSchema,
} from "@/components/schema-editor/document/convert"
import {
  addDefinition,
  removeDefinition,
  renameDefinition,
  setRef,
} from "@/components/schema-editor/document/definition-operations"
import {
  getEffectiveKind,
  getEnumBaseType,
  isDanglingRef,
  resolveRef,
} from "@/components/schema-editor/document/derive"
import {
  addEnumValue,
  removeEnumValueAtIndex,
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
  setNodeDescription,
  setNodeTitle,
  stripDescriptions,
} from "@/components/schema-editor/document/node-metadata"
import { childNodes, findNodeByPath, getNode } from "@/components/schema-editor/document/traversal"
import {
  setNodeType,
  setNullable,
} from "@/components/schema-editor/document/type-operations"
import { requireAllProperties } from "@/components/schema-editor/schema-required-policy"
import type {
  DocumentNode,
  SchemaDocument,
} from "@/components/schema-editor/document/types"
import {
  getEffectiveType,
  setNullable as setDraftNullable,
} from "@/components/schema-editor/draft/draft-node-edits"
import { validateName } from "@/components/schema-editor/lib/json-schema-utils"
import {
  removeObjectProperty,
  renameObjectProperty,
} from "@/components/schema-editor/property-form/model/object-property-edits"
import {
  formatEnumValueInput,
  parseEnumValueInput,
} from "@/components/schema-editor/property-form/model/enum-values"
import { applyObjectTemplateReferenceToDocument } from "@/components/schema-editor/optional/object-templates/object-template-reference"
import { countSchemaProperties } from "@/components/schema-editor/validation"

// ---------------------------------------------------------------------------
// Deterministic PRNG so any fuzz failure is reproducible from its seed.
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rt = (schema: JSONSchema7) => toJsonSchema(fromJsonSchema(schema))

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, normalize((value as Record<string, unknown>)[key])])
    )
  }
  return value
}

// ===========================================================================
// 1. Convert round-trip — edge cases the existing fuzzer's generator misses.
//    (composition keywords, boolean schemas, tuple items, pointer-escaped and
//    prototype-polluting property/definition names, multi-type unions.)
// ===========================================================================
describe("convert: round-trip over structural edge cases", () => {
  const cases: Array<[string, JSONSchema7]> = [
    [
      "prototype-polluting property keys",
      {
        type: "object",
        properties: {
          __proto__: { type: "string" },
          constructor: { type: "number" },
          prototype: { type: "boolean" },
        },
        required: ["__proto__", "constructor"],
      } as unknown as JSONSchema7,
    ],
    [
      "definition name needing JSON-pointer escaping",
      {
        type: "object",
        $defs: { "a/b~c": { type: "string" } },
        properties: { x: { $ref: "#/$defs/a~1b~0c" } },
      } as unknown as JSONSchema7,
    ],
    [
      "boolean property schemas",
      { type: "object", properties: { a: true, b: false } } as unknown as JSONSchema7,
    ],
    ["boolean items schema", { type: "array", items: true } as unknown as JSONSchema7],
    [
      "tuple items (array form) carried verbatim",
      { type: "array", items: [{ type: "string" }, { type: "number" }] } as unknown as JSONSchema7,
    ],
    ["oneOf", { oneOf: [{ type: "string" }, { type: "number" }] }],
    ["allOf", { allOf: [{ type: "string" }, { minLength: 1 }] }],
    ["not", { not: { type: "string" } }],
    [
      "if/then/else",
      { if: { type: "string" }, then: { minLength: 1 }, else: { type: "number" } },
    ],
    ["multi-type union", { type: ["string", "number"] }],
    ["empty properties object", { type: "object", properties: {} }],
    [
      "explicit empty required survives",
      { type: "object", properties: { a: { type: "string" } }, required: [] },
    ],
    ["const literal", { const: 42 }],
    [
      "additionalProperties schema",
      { type: "object", additionalProperties: { type: "string" } },
    ],
    [
      "patternProperties",
      { type: "object", patternProperties: { "^x": { type: "string" } } },
    ],
    ["empty-string property key", { type: "object", properties: { "": { type: "string" } } }],
    [
      "required names absent from properties (extraRequired) preserved",
      { type: "object", properties: { a: { type: "string" } }, required: ["a", "ghost"] },
    ],
    ["bare null type", { type: "null" }],
    [
      "legacy definitions keyword",
      {
        type: "object",
        definitions: { A: { type: "string" } },
        properties: { a: { $ref: "#/definitions/A" } },
      } as unknown as JSONSchema7,
    ],
    [
      "ref inside oneOf",
      {
        $defs: { A: { type: "string" } },
        oneOf: [{ $ref: "#/$defs/A" }, { type: "null" }],
      } as unknown as JSONSchema7,
    ],
  ]

  for (const [name, schema] of cases) {
    it(`byte-exact: ${name}`, () => {
      expect(JSON.stringify(rt(schema))).toBe(JSON.stringify(schema))
    })
  }
})

// ===========================================================================
// 2. Extended fuzz — a broader generator than the existing suite's, exercising
//    composition, tuples, boolean schemas and adversarial key names.
// ===========================================================================
describe("convert: extended fuzz round-trip", () => {
  const SCALARS = ["string", "number", "integer", "boolean", "null"] as const
  const KEYS = ["a", "b", "__proto__", "constructor", "x/y", "t~z", "9"]
  const UNK: Array<[string, unknown]> = [
    ["pattern", "^x"],
    ["format", "email"],
    ["const", 1],
    ["default", null],
    ["minLength", 1],
    ["examples", [1, 2]],
    ["x-foo", { a: 1 }],
    ["readOnly", true],
  ]

  function gen(rand: () => number, depth: number, defs: string[]): JSONSchema7 | boolean {
    const r = rand()
    if (depth <= 0 || r < 0.3) {
      if (rand() < 0.08) return rand() < 0.5
      const node: Record<string, unknown> = {
        type: SCALARS[Math.floor(rand() * SCALARS.length)],
      }
      if (rand() < 0.4) node.title = "T" + Math.floor(rand() * 9)
      if (rand() < 0.4) {
        const [k, v] = UNK[Math.floor(rand() * UNK.length)]
        node[k] = v
      }
      return node as JSONSchema7
    }
    if (r < 0.42 && defs.length)
      return { $ref: `#/$defs/${defs[Math.floor(rand() * defs.length)]}` } as JSONSchema7
    if (r < 0.5) {
      const v = ["a", 1, true, null, "b"].slice(0, 1 + Math.floor(rand() * 4))
      return { type: "string", enum: v } as JSONSchema7
    }
    if (r < 0.58)
      return { anyOf: [gen(rand, depth - 1, defs), { type: "null" }] } as JSONSchema7
    if (r < 0.64)
      return {
        oneOf: [gen(rand, depth - 1, defs), gen(rand, depth - 1, defs)],
      } as JSONSchema7
    if (r < 0.7) return { allOf: [gen(rand, depth - 1, defs)] } as JSONSchema7
    if (r < 0.74) return { not: gen(rand, depth - 1, defs) } as JSONSchema7
    if (r < 0.8) {
      const node: Record<string, unknown> = { type: "array" }
      node.items =
        rand() < 0.3
          ? [gen(rand, depth - 1, defs), gen(rand, depth - 1, defs)]
          : gen(rand, depth - 1, defs)
      return node as JSONSchema7
    }
    const cnt = Math.floor(rand() * 4)
    const properties: Record<string, unknown> = {}
    const keys: string[] = []
    for (let i = 0; i < cnt; i++) {
      const k = KEYS[Math.floor(rand() * KEYS.length)]
      if (keys.includes(k)) continue
      keys.push(k)
      properties[k] = gen(rand, depth - 1, defs)
    }
    const node: Record<string, unknown> = { type: "object", properties }
    if (rand() < 0.5) node.required = keys.filter(() => rand() < 0.5)
    if (rand() < 0.2) node.additionalProperties = gen(rand, depth - 1, defs)
    return node as JSONSchema7
  }

  function genRoot(seed: number): JSONSchema7 {
    const rand = mulberry32(seed)
    const defNames: string[] = []
    const $defs: Record<string, unknown> = {}
    const dc = Math.floor(rand() * 3)
    for (let i = 0; i < dc; i++) {
      const name = `Def${i}`
      defNames.push(name)
      $defs[name] = gen(rand, 2, defNames.slice(0, i))
    }
    const root = gen(rand, 3, defNames)
    if (dc > 0 && typeof root === "object") (root as Record<string, unknown>).$defs = $defs
    return root as JSONSchema7
  }

  it("preserves CONTENT for 2000 random schemas (semantic)", () => {
    const failures: number[] = []
    for (let seed = 1; seed <= 2000; seed++) {
      const schema = genRoot(seed)
      const out = rt(schema)
      if (JSON.stringify(normalize(out)) !== JSON.stringify(normalize(schema)))
        failures.push(seed)
    }
    expect(failures).toEqual([])
  })

  it("preserves exact KEY ORDER for 2000 random schemas (byte-exact)", () => {
    const failures: number[] = []
    for (let seed = 1; seed <= 2000; seed++) {
      const schema = genRoot(seed)
      if (JSON.stringify(rt(schema)) !== JSON.stringify(schema)) failures.push(seed)
    }
    expect(failures).toEqual([])
  })
})

// ===========================================================================
// 3. Operation-sequence invariants — apply random edit sequences and assert
//    the Document never reaches a corrupt state (duplicate ids/names, lost
//    nodes, non-serializable / non-idempotent export).
// ===========================================================================
function walk(node: DocumentNode, fn: (n: DocumentNode) => void) {
  fn(node)
  for (const child of childNodes(node)) walk(child, fn)
}
function allNodeIds(doc: SchemaDocument): string[] {
  const ids: string[] = []
  walk(doc.root, (n) => ids.push(n.id))
  for (const def of doc.defs) walk(def.node, (n) => ids.push(n.id))
  return ids
}
function allPropIds(doc: SchemaDocument): string[] {
  const ids: string[] = []
  const visit = (n: DocumentNode) => {
    if (n.properties) for (const p of n.properties) ids.push(p.id)
  }
  walk(doc.root, visit)
  for (const def of doc.defs) walk(def.node, visit)
  return ids
}

function assertInvariants(doc: SchemaDocument, step: string) {
  // Export must never throw and must be JSON-serializable.
  const out = toJsonSchema(doc)
  JSON.stringify(out)

  // Node ids are globally unique.
  const ids = allNodeIds(doc)
  const dupId = ids.find((id, i) => ids.indexOf(id) !== i)
  expect(dupId, `${step}: duplicate node id`).toBeUndefined()

  // Every enumerable id is reachable via getNode.
  for (const id of ids)
    expect(getNode(doc, id), `${step}: getNode could not find ${id}`).not.toBeNull()

  // Definition names are unique.
  const names = doc.defs.map((d) => d.name)
  const dupName = names.find((n, i) => names.indexOf(n) !== i)
  expect(dupName, `${step}: duplicate definition name`).toBeUndefined()

  // No emitted `required` array carries duplicates.
  const checkRequired = (value: unknown) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>
      if (Array.isArray(record.required)) {
        const seen = new Set<unknown>()
        for (const name of record.required) {
          expect(seen.has(name), `${step}: duplicate required ${String(name)}`).toBe(
            false
          )
          seen.add(name)
        }
      }
      for (const child of Object.values(record)) checkRequired(child)
    }
  }
  checkRequired(out)
}

const FUZZ_TYPES: Array<JSONSchema7TypeName | "enum"> = [
  "string",
  "number",
  "integer",
  "boolean",
  "object",
  "array",
  "enum",
  "null",
]

describe("operations fuzz: structural invariants survive random edits", () => {
  it("200 walks × 40 ops keep every invariant", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rand = mulberry32(seed)
      let doc = fromJsonSchema({
        type: "object",
        properties: { a: { type: "string" }, b: { type: "object", properties: { c: { type: "number" } } } },
        required: ["a"],
      } as JSONSchema7)
      const pick = <T,>(arr: T[]): T | undefined =>
        arr.length ? arr[Math.floor(rand() * arr.length)] : undefined
      let step = "init"
      for (let i = 0; i < 40; i++) {
        const op = Math.floor(rand() * 11)
        const nodeId = pick(allNodeIds(doc))!
        const propId = pick(allPropIds(doc))
        step = `seed ${seed} step ${i} op ${op}`
        switch (op) {
          case 0:
            doc = addProperty(doc, nodeId, { key: `k${i}` })
            break
          case 1:
            if (propId) doc = removeProperty(doc, propId)
            break
          case 2:
            if (propId) doc = renameProperty(doc, propId, pick(["x", "y", "a", ""])!)
            break
          case 3:
            if (propId) doc = setRequired(doc, propId, rand() < 0.5)
            break
          case 4:
            doc = setNodeType(doc, nodeId, pick(FUZZ_TYPES)!)
            break
          case 5:
            doc = setNullable(doc, nodeId, rand() < 0.5)
            break
          case 6:
            doc = addEnumValue(doc, nodeId, pick(["e1", 1, true]))
            break
          case 7:
            doc = addDefinition(doc, { name: pick(["Def", "Foo"]) }).doc
            break
          case 8: {
            const def = pick(doc.defs)
            if (def) doc = renameDefinition(doc, def.id, pick(["Def", "Bar", "Foo"])!)
            break
          }
          case 9: {
            const def = pick(doc.defs)
            if (def) doc = removeDefinition(doc, def.id)
            break
          }
          case 10: {
            const def = pick(doc.defs)
            if (def) doc = setRef(doc, nodeId, def.id)
            break
          }
        }
        assertInvariants(doc, step)
      }
    }
  })

  it("export is idempotent (export = export∘import∘export) across 600 walks", () => {
    for (let seed = 1; seed <= 600; seed++) {
      const rand = mulberry32(seed + 9000)
      let doc = fromJsonSchema({
        type: "object",
        properties: { a: { type: "string" } },
        required: ["a"],
      } as JSONSchema7)
      const pick = <T,>(arr: T[]): T | undefined =>
        arr.length ? arr[Math.floor(rand() * arr.length)] : undefined
      for (let i = 0; i < 25; i++) {
        const op = Math.floor(rand() * 9)
        const nodeId = pick(allNodeIds(doc))!
        const propId = pick(allPropIds(doc))
        switch (op) {
          case 0:
            doc = addProperty(doc, nodeId, { key: `k${i}` })
            break
          case 1:
            if (propId) doc = renameProperty(doc, propId, pick(["x", "y", "a"])!)
            break
          case 2:
            if (propId) doc = setRequired(doc, propId, rand() < 0.5)
            break
          case 3:
            doc = setNodeType(
              doc,
              nodeId,
              pick(["string", "number", "object", "array", "enum", "boolean"] as const)!
            )
            break
          case 4:
            doc = setNullable(doc, nodeId, rand() < 0.5)
            break
          case 5:
            doc = addEnumValue(doc, nodeId, pick(["e1", 1]))
            break
          case 6:
            doc = addDefinition(doc, { name: "Def" }).doc
            break
          case 7: {
            const def = pick(doc.defs)
            if (def) doc = renameDefinition(doc, def.id, pick(["Def", "Bar"])!)
            break
          }
          case 8: {
            const def = pick(doc.defs)
            if (def) doc = setRef(doc, nodeId, def.id)
            break
          }
        }
      }
      const out1 = toJsonSchema(doc)
      const out2 = toJsonSchema(fromJsonSchema(out1))
      expect(JSON.stringify(out2), `seed ${seed} not idempotent`).toBe(
        JSON.stringify(out1)
      )
    }
  })
})

// ===========================================================================
// 4. Operation edge cases that should be safe no-ops / rejections.
// ===========================================================================
describe("operation guards", () => {
  const base = () =>
    fromJsonSchema({
      type: "object",
      $defs: { A: { type: "string" } },
      properties: {
        parent: { type: "object", properties: { child: { type: "object", properties: {} } } },
        a: { $ref: "#/$defs/A" },
      },
    } as unknown as JSONSchema7)

  it("missing-id operations return the same document reference", () => {
    const d0 = base()
    expect(setNodeType(d0, "nope", "string")).toBe(d0)
    expect(setNullable(d0, "nope", true)).toBe(d0)
    expect(removeProperty(d0, "nope")).toBe(d0)
    expect(removeDefinition(d0, "nope")).toBe(d0)
  })

  it("moveProperty into a descendant of itself is rejected", () => {
    const d0 = base()
    const parentPropId = getChildPropertyId(d0, d0.root.id, "parent")!
    const parentNodeId = getChildNodeId(d0, d0.root.id, "parent")!
    const childNodeId = getChildNodeId(d0, parentNodeId, "child")!
    expect(moveProperty(d0, parentPropId, childNodeId, 0)).toBe(d0)
  })

  it("removing a definition leaves the ref dangling and export drops it", () => {
    const d0 = base()
    const def = d0.defs[0]
    const d1 = removeDefinition(d0, def.id)
    const aNode = d1.root.properties!.find((p) => p.key === "a")!.node
    expect(isDanglingRef(d1, aNode)).toBe(true)
    expect((toJsonSchema(d1) as JSONSchema7).properties!.a).toEqual({})
  })

  it("renaming a definition rewrites $refs that live in unmodeled keywords", () => {
    const d0 = fromJsonSchema({
      type: "object",
      $defs: { Old: { type: "string" } },
      additionalProperties: { $ref: "#/$defs/Old" },
    } as unknown as JSONSchema7)
    const d1 = renameDefinition(d0, d0.defs[0].id, "New")
    const out = toJsonSchema(d1) as JSONSchema7 & {
      additionalProperties: { $ref: string }
    }
    expect(out.additionalProperties.$ref).toBe("#/$defs/New")
    expect((out.$defs as Record<string, unknown>).New).toBeDefined()
  })
})

// ===========================================================================
// 5. Enum operations — index routing (incl. through a nullable anyOf wrapper)
//    and out-of-range safety.
// ===========================================================================
describe("enum index operations", () => {
  it("out-of-range update/remove are no-ops", () => {
    const d0 = fromJsonSchema({ type: "string", enum: ["a", "b"] } as JSONSchema7)
    expect(updateEnumValueAtIndex(d0, d0.root.id, 99, "x")).toBe(d0)
    expect(removeEnumValueAtIndex(d0, d0.root.id, -1)).toBe(d0)
  })

  it("index ops on a nullable enum route through the effective branch", () => {
    const d0 = fromJsonSchema({
      anyOf: [{ type: "string", enum: ["a", "b"] }, { type: "null" }],
    } as JSONSchema7)
    const out = toJsonSchema(
      updateEnumValueAtIndex(d0, d0.root.id, 1, "B")
    ) as unknown as { anyOf: Array<{ enum?: unknown[] }> }
    expect(out.anyOf.find((branch) => branch.enum)!.enum).toEqual(["a", "B"])
  })

  it("getEnumBaseType reflects the backing scalar type", () => {
    expect(
      getEnumBaseType(fromJsonSchema({ type: "number", enum: [1, 2] } as JSONSchema7).root)
    ).toBe("number")
    expect(
      getEnumBaseType(fromJsonSchema({ enum: ["a"] } as JSONSchema7).root)
    ).toBe("string")
  })
})

// ===========================================================================
// 6. Path resolution — must follow refs and array items, and must terminate on
//    self-referential refs.
// ===========================================================================
describe("findNodeByPath", () => {
  it("resolves into a referenced object", () => {
    const d0 = fromJsonSchema({
      type: "object",
      $defs: { Addr: { type: "object", properties: { city: { type: "string" } } } },
      properties: { home: { $ref: "#/$defs/Addr" } },
    } as unknown as JSONSchema7)
    const id = findNodeByPath(d0, ["home", "city"])
    expect(id).not.toBeNull()
    expect(getNode(d0, id!)!.type).toBe("string")
  })

  it("resolves through array items", () => {
    const d0 = fromJsonSchema({
      type: "object",
      properties: {
        tags: { type: "array", items: { type: "object", properties: { name: { type: "string" } } } },
      },
    } as JSONSchema7)
    expect(findNodeByPath(d0, ["tags", "name"])).not.toBeNull()
  })

  it("terminates on a self-referential ref instead of looping forever", () => {
    const d0 = fromJsonSchema({
      type: "object",
      $defs: { Node: { type: "object", properties: { next: { $ref: "#/$defs/Node" } } } },
      properties: { root: { $ref: "#/$defs/Node" } },
    } as unknown as JSONSchema7)
    const id = findNodeByPath(d0, ["root", "next", "next", "next"])
    expect(id === null || typeof id === "string").toBe(true)
  })
})

// ===========================================================================
// 7. Draft layer (property-dialog editing of raw JSON Schema).
// ===========================================================================
describe("draft setNullable", () => {
  const nodes: Array<[string, Record<string, unknown>]> = [
    ["string", { type: "string" }],
    ["date with meta", { type: "string", format: "date", title: "T", description: "D" }],
    ["object", { type: "object", properties: { a: { type: "string" } }, required: ["a"] }],
    ["enum", { enum: ["a", "b"], type: "string" }],
    ["ref", { $ref: "#/$defs/X" }],
  ]

  for (const [name, node] of nodes) {
    it(`toggle true→false restores effective type for ${name}`, () => {
      const on = setDraftNullable(node, true)
      expect(getEffectiveType(on).isNullable).toBe(true)
      const off = setDraftNullable(on, false)
      expect(getEffectiveType(off).isNullable).toBe(false)
      expect(getEffectiveType(off).type).toBe(getEffectiveType(node).type)
    })
  }

  it("preserves title/description across a nullable toggle", () => {
    const node = { type: "string", title: "Keep", description: "Me" } as Record<
      string,
      unknown
    >
    const on = setDraftNullable(node, true)
    expect(on.title).toBe("Keep")
    expect(on.description).toBe("Me")
    const off = setDraftNullable(on, false)
    expect(off.title).toBe("Keep")
    expect(off.description).toBe("Me")
  })
})

// ===========================================================================
// 8. Name validation (Pydantic-compatible).
// ===========================================================================
describe("validateName", () => {
  it("accepts 64 chars, rejects 65", () => {
    expect(validateName("a".repeat(64))).toBeNull()
    expect(validateName("a".repeat(65))).not.toBeNull()
  })
  it("rejects empty and leading-digit names", () => {
    expect(validateName("")).not.toBeNull()
    expect(validateName("9x")).not.toBeNull()
  })
  it("treats sibling collisions case-insensitively", () => {
    expect(validateName("Foo", ["foo"])).not.toBeNull()
  })
  it("allows a case-only rename of the current name", () => {
    expect(validateName("FOO", ["foo"], "foo")).toBeNull()
  })
  it("rejects Pydantic reserved names", () => {
    expect(validateName("model_config")).not.toBeNull()
  })
})

// ===========================================================================
// 9. Object property edits used by the property dialog.
// ===========================================================================
describe("object-property-edits", () => {
  it("rename preserves key order and rewrites required", () => {
    const node = {
      type: "object",
      properties: { a: { type: "string" }, b: { type: "number" } },
      required: ["a"],
    } as JSONSchema7
    const out = renameObjectProperty({ schemaNode: node, oldName: "a", newName: "z" })
    expect(Object.keys(out.properties!)).toEqual(["z", "b"])
    expect(out.required).toEqual(["z"])
  })

  it("rename onto an existing sibling is a no-op", () => {
    const node = {
      type: "object",
      properties: { a: { type: "string" }, b: { type: "number" } },
      required: ["a"],
    } as JSONSchema7
    expect(renameObjectProperty({ schemaNode: node, oldName: "a", newName: "b" })).toBe(
      node
    )
  })

  it("remove drops the property from required", () => {
    const node = {
      type: "object",
      properties: { a: { type: "string" } },
      required: ["a"],
    } as JSONSchema7
    const out = removeObjectProperty({ schemaNode: node, propertyName: "a" })
    expect(out.properties).toEqual({})
    expect(out.required).toEqual([])
  })
})

// ===========================================================================
// 10. Property counting — must terminate on cyclic $refs.
// ===========================================================================
describe("countSchemaProperties", () => {
  it("terminates on a self-referential definition", () => {
    const schema = {
      type: "object",
      $defs: {
        Node: {
          type: "object",
          properties: { next: { $ref: "#/$defs/Node" }, value: { type: "string" } },
        },
      },
      properties: { root: { $ref: "#/$defs/Node" } },
    } as unknown as JSONSchema7
    expect(typeof countSchemaProperties(schema)).toBe("number")
  })
})

// ===========================================================================
// 11. Enum value input: format ⇄ parse.
//
// These round-trip for plain text and for values typed as JSON. They do NOT
// round-trip for STRING values that happen to look like a JSON literal: a
// string is rendered verbatim (no quotes) by `formatEnumValueInput`, but
// `parseEnumValueInput` JSON-parses its input first — so a string such as
// "123", "true", "[1,2]" is silently re-typed (to number/boolean/array) the
// moment its field is edited, and surrounding whitespace is trimmed.
//
// The passing block pins the cases that DO round-trip; the `it.fails` block
// documents the discovered asymmetry — these will flip to failing (alerting)
// once the format/parse pair is made a true inverse.
// ===========================================================================
describe("enum value input: format ⇄ parse", () => {
  const stable: Array<[string, unknown]> = [
    ["plain string", "hello"],
    ["number", 42],
    ["boolean true", true],
    ["boolean false", false],
    ["null", null],
  ]
  for (const [name, value] of stable) {
    it(`round-trips ${name}`, () => {
      expect(parseEnumValueInput(formatEnumValueInput(value as never))).toEqual(value)
    })
  }

  describe("BUG: string values that look like JSON literals do not round-trip", () => {
    const lossy: Array<[string, string]> = [
      ['numeric string "123"', "123"],
      ['boolean-looking string "true"', "true"],
      ['array-looking string "[1,2]"', "[1,2]"],
      ['padded string "  spaced  "', "  spaced  "],
    ]
    for (const [name, value] of lossy) {
      it.fails(`should preserve ${name} but currently coerces it`, () => {
        expect(parseEnumValueInput(formatEnumValueInput(value))).toEqual(value)
      })
    }

    // The concrete coercions, pinned so the regression is explicit.
    it("documents the actual (lossy) coercions", () => {
      expect(parseEnumValueInput(formatEnumValueInput("123"))).toBe(123)
      expect(parseEnumValueInput(formatEnumValueInput("true"))).toBe(true)
      expect(parseEnumValueInput(formatEnumValueInput("[1,2]"))).toEqual([1, 2])
      expect(parseEnumValueInput(formatEnumValueInput("  spaced  "))).toBe("spaced")
    })
  })
})

// ===========================================================================
// 12. Object-template install — a template with dependencies must produce
//     proper, id-LINKED refs in the editor model, not raw unlinked `$ref`s.
//
// Regression for a bug where `Company` (which references `Address`) was added
// to the document BEFORE its `Address` dependency, so `nodeFromJson` could not
// resolve `#/$defs/Address` to a definition id — the `address` field then
// rendered as kind "any" with the `$ref` stranded in `rest`. (The exported
// JSON was correct, which is why the prior output-only test missed it.)
// ===========================================================================
describe("object-template install: dependency refs are id-linked", () => {
  const installCompany = () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { x: { type: "string" } },
    } as JSONSchema7)
    const xNodeId = doc.root.properties!.find((p) => p.key === "x")!.node.id
    return applyObjectTemplateReferenceToDocument(doc, xNodeId, "Company")
  }

  it("Company.address is a proper model ref to the Address definition", () => {
    const doc = installCompany()
    const company = doc.defs.find((d) => d.name === "Company")!
    const address = doc.defs.find((d) => d.name === "Address")!
    const addressField = company.node.properties!.find((p) => p.key === "address")!

    expect(addressField.node.ref).toBe(address.id)
    expect(getEffectiveKind(addressField.node)).toBe("ref")
    expect(addressField.node.rest.$ref).toBeUndefined()
    expect(resolveRef(doc, addressField.node)!.name).toBe("Address")
  })

  it("renaming the Address definition still rewrites the (now linked) ref on export", () => {
    const doc = installCompany()
    const out = toJsonSchema(doc) as JSONSchema7 & {
      $defs: Record<string, { properties: Record<string, { $ref?: string }> }>
    }
    expect(out.$defs.Company.properties.address.$ref).toBe("#/$defs/Address")
    expect(out.$defs.Address).toBeDefined()
  })
})

// ===========================================================================
// 13. stripDescriptions — must reach descriptions in every position, including
//     those buried in unmodeled (rest) composition/map keywords.
// ===========================================================================
function anyDescription(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(anyDescription)
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, child]) => key === "description" || anyDescription(child)
    )
  }
  return false
}

describe("stripDescriptions", () => {
  it("removes every description, including ones inside rest keywords", () => {
    const schema = {
      type: "object",
      description: "root",
      $defs: { D: { type: "string", description: "def" } },
      properties: {
        a: { type: "string", description: "a" },
        arr: {
          type: "array",
          items: {
            type: "object",
            description: "item",
            properties: { z: { type: "string", description: "z" } },
          },
        },
        u: { anyOf: [{ type: "string", description: "branch" }, { type: "null" }] },
      },
      required: ["a"],
      additionalProperties: { type: "string", description: "addl" },
      patternProperties: { "^x": { type: "string", description: "pat" } },
      allOf: [{ type: "object", description: "allof" }],
    } as unknown as JSONSchema7
    const out = toJsonSchema(stripDescriptions(fromJsonSchema(schema)))
    expect(anyDescription(out)).toBe(false)
  })

  it("is a no-op (same reference) when there is nothing to strip", () => {
    const doc = fromJsonSchema({
      type: "object",
      properties: { a: { type: "string" } },
    } as JSONSchema7)
    expect(stripDescriptions(doc)).toBe(doc)
  })
})

// ===========================================================================
// 14. Metadata setters — blank-trimming and referential stability.
// ===========================================================================
describe("metadata setters", () => {
  it("whitespace-only title/description are dropped on export", () => {
    const d0 = fromJsonSchema({ type: "string" } as JSONSchema7)
    const withBlank = setNodeDescription(
      setNodeTitle(d0, d0.root.id, "   "),
      d0.root.id,
      "  "
    )
    const out = toJsonSchema(withBlank) as JSONSchema7
    expect(out.title).toBeUndefined()
    expect(out.description).toBeUndefined()
  })

  it("setting an unchanged value returns the same document reference", () => {
    const d0 = fromJsonSchema({ type: "string", title: "X" } as JSONSchema7)
    expect(setNodeTitle(d0, d0.root.id, "X")).toBe(d0)
  })
})

// ===========================================================================
// 15. requireAllProperties policy — recurses into defs, array items and
//     composition; never duplicates a pre-existing required name.
// ===========================================================================
describe("requireAllProperties", () => {
  it("marks every object's properties required, recursively", () => {
    const out = requireAllProperties({
      type: "object",
      $defs: {
        D: { type: "object", properties: { d1: { type: "string" }, d2: { type: "number" } } },
      },
      properties: {
        a: { type: "string" },
        nested: { type: "object", properties: { x: { type: "string" }, y: { type: "number" } } },
        arr: { type: "array", items: { type: "object", properties: { i: { type: "string" } } } },
      },
    } as unknown as JSONSchema7) as Record<string, any>

    expect(new Set(out.required)).toEqual(new Set(["a", "nested", "arr"]))
    expect(new Set(out.properties.nested.required)).toEqual(new Set(["x", "y"]))
    expect(new Set(out.properties.arr.items.required)).toEqual(new Set(["i"]))
    expect(new Set(out.$defs.D.required)).toEqual(new Set(["d1", "d2"]))
  })

  it("keeps existing required entries first and does not duplicate", () => {
    const out = requireAllProperties({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "number" } },
      required: ["a"],
    } as JSONSchema7) as JSONSchema7
    expect(out.required).toEqual(["a", "b"])
  })
})
