import type {
  JSONSchema7,
  JSONSchema7Definition,
  JSONSchema7Type,
} from "json-schema"

import { createId } from "./id"
import type {
  DefinitionEntry,
  DocumentNode,
  EnumValue,
  JsonValue,
  PropertyEntry,
  SchemaDocument,
} from "./types"

/**
 * Boundary conversions between vanilla JSON Schema (the wire format) and the
 * editor Document (the in-memory source of truth).
 *
 *  - `fromJsonSchema` is TOTAL: it mints fresh ids, distributes `required`, and
 *    carries every unmodeled keyword into `rest`. Run it ONCE when a new external
 *    schema arrives — not on every render.
 *  - `toJsonSchema` is a PURE PROJECTION: it rebuilds `required[]`, re-projects
 *    `$ref` from the target definition's current name, and drops transient-invalid
 *    artifacts (empty/duplicate property keys). Run it on demand for
 *    `onSchemaChange` and the JSON preview.
 *
 * Together they round-trip losslessly for everything the editor surfaces, and
 * carry everything it doesn't.
 */

/** Keys consumed structurally by a node; everything else falls into `rest`. */
const MODELED_NODE_KEYS = new Set<string>([
  "type",
  "title",
  "description",
  "properties",
  "required",
  "items",
  "enum",
  "$ref",
  "anyOf",
  "oneOf",
  "allOf",
])

const ENUM_DESCRIPTIONS_KEY = "x-enumDescriptions"

type RefMap = Map<string, string> // json-pointer string -> definition NodeId

// ---------------------------------------------------------------------------
// Import: JSON Schema -> Document
// ---------------------------------------------------------------------------

export function fromJsonSchema(schema: JSONSchema7): SchemaDocument {
  const defsKeyword = schema.$defs
    ? "$defs"
    : schema.definitions
      ? "definitions"
      : "$defs"
  const rawDefs = (schema.$defs ?? schema.definitions ?? {}) as Record<
    string,
    JSONSchema7Definition
  >

  // First pass: give every top-level definition an id so refs can resolve to it.
  const defEntries: DefinitionEntry[] = Object.keys(rawDefs).map((name) => ({
    id: createId("def"),
    name,
    node: { id: createId(), rest: {} }, // placeholder, filled in second pass
  }))
  const refMap: RefMap = new Map()
  for (const def of defEntries) {
    refMap.set(`#/$defs/${def.name}`, def.id)
    refMap.set(`#/definitions/${def.name}`, def.id)
  }

  // Second pass: build each definition's node now that the ref map exists.
  for (const def of defEntries) {
    def.node = nodeFromSchema(rawDefs[def.name], refMap)
  }

  const root = nodeFromSchema(schema, refMap, /* stripDefs */ true)

  return {
    root,
    defs: defEntries,
    rest: { defsKeyword },
  }
}

function nodeFromSchema(
  schema: JSONSchema7Definition,
  refMap: RefMap,
  stripDefs = false
): DocumentNode {
  // A boolean schema (`true` / `false`) has no structure to model — preserve it.
  if (typeof schema === "boolean") {
    return { id: createId(), rest: { __booleanSchema: schema } }
  }

  const node: DocumentNode = { id: createId(), rest: {} }

  if (typeof schema.$ref === "string") {
    const defId = refMap.get(schema.$ref)
    if (defId) node.ref = defId
    else node.rest.$ref = schema.$ref // unresolved pointer — keep verbatim
  }

  if (schema.type !== undefined) node.type = schema.type
  if (schema.title !== undefined) node.title = schema.title
  if (schema.description !== undefined) node.description = schema.description

  if (Array.isArray(schema.enum)) {
    node.enum = enumFromSchema(schema)
  }

  if (schema.properties) {
    const required = Array.isArray(schema.required) ? schema.required : []
    node.properties = Object.entries(schema.properties).map(
      ([key, child]): PropertyEntry => ({
        key,
        required: required.includes(key),
        node: nodeFromSchema(child, refMap),
      })
    )
  }

  // Tuple `items` (array form) is rare; carry it in `rest` for v1.
  if (schema.items && !Array.isArray(schema.items)) {
    node.items = nodeFromSchema(schema.items, refMap)
  }

  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const value = schema[key]
    if (Array.isArray(value)) {
      node[key] = value.map((sub) => nodeFromSchema(sub, refMap))
    }
  }

  // Carry every keyword we don't model.
  for (const [key, value] of Object.entries(schema)) {
    if (MODELED_NODE_KEYS.has(key)) continue
    if (stripDefs && (key === "$defs" || key === "definitions")) continue
    if (node.enum && key === ENUM_DESCRIPTIONS_KEY) continue // folded into enum
    node.rest[key] = value
  }

  return node
}

function enumFromSchema(schema: JSONSchema7): EnumValue[] {
  const raw = (schema as Record<string, unknown>)[ENUM_DESCRIPTIONS_KEY]
  const descriptions =
    raw && typeof raw === "object" ? (raw as Record<string, string>) : {}

  return (schema.enum ?? []).map((value): EnumValue => {
    const entry: EnumValue = { id: createId("enum"), value: value as JsonValue }
    const description = descriptions[enumKey(value)]
    if (description) entry.description = description
    return entry
  })
}

/** Stable string key for an enum literal, used to pair values with descriptions. */
function enumKey(value: JSONSchema7Type): string {
  return typeof value === "string" ? value : JSON.stringify(value)
}

// ---------------------------------------------------------------------------
// Export: Document -> JSON Schema
// ---------------------------------------------------------------------------

export function toJsonSchema(doc: SchemaDocument): JSONSchema7 {
  const defsKeyword =
    doc.rest.defsKeyword === "definitions" ? "definitions" : "$defs"
  const defNameById = new Map<string, string>()
  for (const def of doc.defs) defNameById.set(def.id, def.name)

  const out = nodeToSchema(doc.root, defNameById, defsKeyword) as JSONSchema7

  if (doc.defs.length > 0) {
    const bag: Record<string, JSONSchema7Definition> = {}
    for (const def of doc.defs) {
      bag[def.name] = nodeToSchema(def.node, defNameById, defsKeyword)
    }
    ;(out as Record<string, unknown>)[defsKeyword] = bag
  }

  return out
}

function nodeToSchema(
  node: DocumentNode,
  defNameById: Map<string, string>,
  defsKeyword: string
): JSONSchema7Definition {
  if (node.rest.__booleanSchema !== undefined) {
    return node.rest.__booleanSchema as boolean
  }

  // Emit modeled keys first in a natural reading order ($ref, type, title, …),
  // then any unmodeled keywords. Export is a projection, so it normalizes key
  // order the way a formatter would — semantics are preserved, not byte layout.
  const out: Record<string, unknown> = {}

  if (node.ref) {
    const name = defNameById.get(node.ref)
    if (name) out.$ref = `#/${defsKeyword}/${name}`
  }

  if (node.type !== undefined) out.type = node.type
  if (node.title !== undefined) out.title = node.title
  if (node.description !== undefined) out.description = node.description

  if (node.enum) {
    out.enum = node.enum.map((entry) => entry.value)
    const descriptions: Record<string, string> = {}
    for (const entry of node.enum) {
      if (entry.description) descriptions[enumKey(entry.value)] = entry.description
    }
    if (Object.keys(descriptions).length > 0) {
      out[ENUM_DESCRIPTIONS_KEY] = descriptions
    }
  }

  if (node.properties) {
    const properties: Record<string, JSONSchema7Definition> = {}
    const required: string[] = []
    const seen = new Set<string>()
    for (const entry of node.properties) {
      const key = entry.key.trim()
      // Transient-invalid states live in the Document, not the projection:
      // drop empty and duplicate keys at the boundary.
      if (!key || seen.has(key)) continue
      seen.add(key)
      properties[key] = nodeToSchema(entry.node, defNameById, defsKeyword)
      if (entry.required) required.push(key)
    }
    out.properties = properties
    if (required.length > 0) out.required = required
  }

  if (node.items) {
    out.items = nodeToSchema(node.items, defNameById, defsKeyword)
  }

  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const value = node[key]
    if (value) {
      out[key] = value.map((sub) => nodeToSchema(sub, defNameById, defsKeyword))
    }
  }

  // Trailing unmodeled keywords (const, default, format, pattern, x-*, …).
  for (const [key, value] of Object.entries(node.rest)) {
    if (key === "__booleanSchema") continue
    if (key in out) continue // modeled field already won this key
    out[key] = value
  }

  return out as JSONSchema7
}
