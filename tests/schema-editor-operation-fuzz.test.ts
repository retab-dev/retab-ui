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
  addEnumValue,
  setEnumValues,
} from "@/components/schema-editor/document/enum-operations"
import {
  addProperty,
  moveProperty,
  removeProperty,
  renameProperty,
  setRequired,
} from "@/components/schema-editor/document/property-operations"
import {
  setNodeType,
  setNullable,
} from "@/components/schema-editor/document/type-operations"
import type {
  DocumentNode,
  PropertyEntry,
  SchemaDocument,
} from "@/components/schema-editor/document/types"

// Deterministic PRNG (same as the existing fuzzer) so a failure is reproducible.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(rand: () => number, items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)]

// ---------------------------------------------------------------------------
// Walk helpers — collect every node / property id currently in the document.
// ---------------------------------------------------------------------------

function eachNode(node: DocumentNode, visit: (n: DocumentNode) => void) {
  visit(node)
  for (const p of node.properties ?? []) eachNode(p.node, visit)
  if (node.items) eachNode(node.items, visit)
  for (const key of ["anyOf", "oneOf", "allOf"] as const)
    for (const c of node[key] ?? []) eachNode(c, visit)
}

function eachProperty(
  node: DocumentNode,
  visit: (p: PropertyEntry, parent: DocumentNode) => void
) {
  for (const p of node.properties ?? []) {
    visit(p, node)
    eachProperty(p.node, visit)
  }
  if (node.items) eachProperty(node.items, visit)
  for (const key of ["anyOf", "oneOf", "allOf"] as const)
    for (const c of node[key] ?? []) eachProperty(c, visit)
}

function allNodes(doc: SchemaDocument): DocumentNode[] {
  const out: DocumentNode[] = []
  eachNode(doc.root, (n) => out.push(n))
  for (const def of doc.defs) eachNode(def.node, (n) => out.push(n))
  return out
}

function allProperties(
  doc: SchemaDocument
): Array<{ entry: PropertyEntry; parent: DocumentNode }> {
  const out: Array<{ entry: PropertyEntry; parent: DocumentNode }> = []
  eachProperty(doc.root, (entry, parent) => out.push({ entry, parent }))
  for (const def of doc.defs)
    eachProperty(def.node, (entry, parent) => out.push({ entry, parent }))
  return out
}

function objectNodeIds(doc: SchemaDocument): string[] {
  return allNodes(doc)
    .filter((n) => n.type === "object" || n.properties)
    .map((n) => n.id)
}

/** Deep key-sort for order-insensitive comparison. */
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

// ---------------------------------------------------------------------------
// A modest seed schema and a menu of random operations.
// ---------------------------------------------------------------------------

const SEED_SCHEMA: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "integer", minimum: 0 },
    tags: { type: "array", items: { type: "string" } },
    status: { type: "string", enum: ["a", "b"] },
    address: {
      type: "object",
      properties: {
        city: { type: "string" },
        zip: { type: "string", pattern: "\\d+" },
      },
      required: ["city"],
    },
    ref: { $ref: "#/$defs/Money" },
  },
  required: ["name"],
  $defs: {
    Money: {
      type: "object",
      properties: { amount: { type: "number" }, currency: { type: "string" } },
    },
  },
}

const TYPES: Array<JSONSchema7TypeName | "enum"> = [
  "string",
  "number",
  "integer",
  "boolean",
  "object",
  "array",
  "enum",
]

function applyRandomOp(
  doc: SchemaDocument,
  rand: () => number
): SchemaDocument {
  const nodes = allNodes(doc)
  const props = allProperties(doc)
  const op = Math.floor(rand() * 12)

  switch (op) {
    case 0: {
      const objs = objectNodeIds(doc)
      return objs.length
        ? addProperty(doc, pick(rand, objs), {
            key: `k${Math.floor(rand() * 1000)}`,
          })
        : doc
    }
    case 1:
      return props.length
        ? removeProperty(doc, pick(rand, props).entry.id)
        : doc
    case 2:
      return props.length
        ? renameProperty(
            doc,
            pick(rand, props).entry.id,
            rand() < 0.2 ? "" : `r${Math.floor(rand() * 1000)}`
          )
        : doc
    case 3:
      return props.length
        ? setRequired(doc, pick(rand, props).entry.id, rand() < 0.5)
        : doc
    case 4:
      return nodes.length
        ? setNodeType(doc, pick(rand, nodes).id, pick(rand, TYPES))
        : doc
    case 5:
      return nodes.length
        ? setNullable(doc, pick(rand, nodes).id, rand() < 0.5)
        : doc
    case 6:
      return nodes.length
        ? addEnumValue(doc, pick(rand, nodes).id, `e${Math.floor(rand() * 99)}`)
        : doc
    case 7:
      return nodes.length
        ? setEnumValues(doc, pick(rand, nodes).id, ["x", "y", "z"].slice(0, 1 + Math.floor(rand() * 3)))
        : doc
    case 8: {
      if (!props.length) return doc
      const objs = objectNodeIds(doc)
      if (!objs.length) return doc
      return moveProperty(
        doc,
        pick(rand, props).entry.id,
        pick(rand, objs),
        Math.floor(rand() * 4)
      )
    }
    case 9:
      return addDefinition(doc, { name: `D${Math.floor(rand() * 50)}` }).doc
    case 10:
      return doc.defs.length
        ? renameDefinition(
            doc,
            pick(rand, doc.defs).id,
            `N${Math.floor(rand() * 50)}`
          )
        : doc
    case 11: {
      if (!nodes.length || !doc.defs.length) return doc
      return setRef(doc, pick(rand, nodes).id, pick(rand, doc.defs).id)
    }
    default:
      return doc
  }
}

// ---------------------------------------------------------------------------
// Invariants checked after every operation.
// ---------------------------------------------------------------------------

function checkInvariants(doc: SchemaDocument, ctx: string) {
  // (A) Node ids are globally unique. A duplicate id means an operation cloned
  //     a subtree without re-minting ids — a silent identity collision.
  const ids = allNodes(doc).map((n) => n.id)
  const dupeNode = firstDuplicate(ids)
  expect(dupeNode, `${ctx}: duplicate node id ${dupeNode}`).toBeUndefined()

  // (B) Property ids are globally unique.
  const propIds = allProperties(doc).map((p) => p.entry.id)
  const dupeProp = firstDuplicate(propIds)
  expect(dupeProp, `${ctx}: duplicate property id ${dupeProp}`).toBeUndefined()

  // (C) Definition ids and names are unique.
  expect(
    firstDuplicate(doc.defs.map((d) => d.id)),
    `${ctx}: duplicate def id`
  ).toBeUndefined()
  expect(
    firstDuplicate(doc.defs.map((d) => d.name)),
    `${ctx}: duplicate def name`
  ).toBeUndefined()

  // (D) Projection never throws and yields an object or boolean.
  let projected: unknown
  expect(() => {
    projected = toJsonSchema(doc)
  }, `${ctx}: toJsonSchema threw`).not.toThrow()
  expect(["object", "boolean"]).toContain(typeof projected)

  // (E) Re-import idempotency: a freshly projected schema must survive another
  //     import/export unchanged. Asymmetry here is an import/export bug.
  const reprojected = toJsonSchema(fromJsonSchema(projected as JSONSchema7))
  expect(
    normalize(reprojected),
    `${ctx}: projection not idempotent`
  ).toEqual(normalize(projected))

  // (F) No object in the output may carry an empty-string property key. Empty
  //     keys are transient editor artifacts (unnamed starter rows) and must be
  //     dropped at the projection boundary, never emitted as a `""` property.
  const emptyKeyAt = findEmptyPropertyKey(projected)
  expect(emptyKeyAt, `${ctx}: emitted empty property key at ${emptyKeyAt}`).toBeUndefined()
}

function findEmptyPropertyKey(schema: unknown, path = "#"): string | undefined {
  if (!schema || typeof schema !== "object") return undefined
  if (Array.isArray(schema)) {
    for (let i = 0; i < schema.length; i++) {
      const hit = findEmptyPropertyKey(schema[i], `${path}/${i}`)
      if (hit) return hit
    }
    return undefined
  }
  const record = schema as Record<string, unknown>
  const props = record.properties
  if (props && typeof props === "object" && !Array.isArray(props)) {
    if (Object.prototype.hasOwnProperty.call(props, "")) return `${path}/properties`
  }
  for (const value of Object.values(record)) {
    const hit = findEmptyPropertyKey(value, path)
    if (hit) return hit
  }
  return undefined
}

function firstDuplicate(values: string[]): string | undefined {
  const seen = new Set<string>()
  for (const v of values) {
    if (seen.has(v)) return v
    seen.add(v)
  }
  return undefined
}

describe("operation fuzz: random edit sequences keep the document sound", () => {
  it("maintains all invariants across many random operation sequences", () => {
    const failures: Array<{ seed: number; error: string }> = []

    for (let seed = 1; seed <= 120; seed++) {
      const rand = mulberry32(seed)
      let doc = fromJsonSchema(SEED_SCHEMA)
      try {
        const steps = 10 + Math.floor(rand() * 8)
        for (let i = 0; i < steps; i++) {
          doc = applyRandomOp(doc, rand)
          checkInvariants(doc, `seed ${seed} step ${i}`)
        }
      } catch (error) {
        failures.push({
          seed,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (failures.length) {
      console.error(
        `operation-fuzz failures (${failures.length}):\n` +
          failures
            .slice(0, 5)
            .map((f) => `  seed ${f.seed}: ${f.error}`)
            .join("\n")
      )
    }
    expect(failures.map((f) => f.seed)).toEqual([])
  }, 30000)
})
