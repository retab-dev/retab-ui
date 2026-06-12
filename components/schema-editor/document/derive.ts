import type { JSONSchema7TypeName } from "json-schema"

import type {
  DefinitionEntry,
  DocumentNode,
  SchemaDocument,
  SchemaKind,
} from "./types"

const SCHEMA_VALUE_REST_KEYS = new Set([
  "additionalProperties",
  "allOf",
  "anyOf",
  "contains",
  "else",
  "if",
  "items",
  "not",
  "oneOf",
  "prefixItems",
  "propertyNames",
  "then",
  "unevaluatedProperties",
])

const SCHEMA_MAP_REST_KEYS = new Set([
  "$defs",
  "definitions",
  "dependentSchemas",
  "patternProperties",
  "properties",
])

/**
 * Pure projections of a node for rendering. NONE of these are stored — there is
 * one source of truth (the Document) and these are computed on each render. This
 * is what lets child components stay stateless the way extend's do, without a
 * second representation to keep in sync.
 */

/** The effective UI "kind" of a node. */
export function getEffectiveKind(node: DocumentNode): SchemaKind {
  if (node.ref) return "ref"
  if (node.enum) return "enum"
  if (node.anyOf || node.oneOf) return "union"

  if (Array.isArray(node.type)) {
    const real = node.type.filter((t) => t !== "null")
    return real.length === 1 ? (real[0] as SchemaKind) : "union"
  }
  if (node.type) return node.type
  return "any"
}

export function isNullable(node: DocumentNode): boolean {
  if (Array.isArray(node.type)) return node.type.includes("null")
  if (node.type === "null") return true
  if (node.anyOf) return node.anyOf.some((sub) => sub.type === "null")
  return false
}

/** Base scalar type backing an enum (enums are `{ type, enum: [...] }`). */
export function getEnumBaseType(node: DocumentNode): JSONSchema7TypeName {
  const type = Array.isArray(node.type)
    ? node.type.find((t) => t !== "null")
    : node.type
  return (type as JSONSchema7TypeName) ?? "string"
}

/** Resolve a `$ref` node to the definition it points at (by id). */
export function resolveRef(
  doc: SchemaDocument,
  node: DocumentNode
): DefinitionEntry | null {
  if (!node.ref) return null
  return doc.defs.find((def) => def.id === node.ref) ?? null
}

/** True when a `$ref` points at a definition that no longer exists. */
export function isDanglingRef(
  doc: SchemaDocument,
  node: DocumentNode
): boolean {
  return Boolean(node.ref) && !resolveRef(doc, node)
}

export function isDefinitionReferenced(
  doc: SchemaDocument,
  defId: string,
  options: { exceptDefId?: string } = {}
): boolean {
  const referenced = doc.defs.find((definition) => definition.id === defId)
  if (!referenced) return false

  if (nodeReferencesDefinition(doc.root, referenced, doc.rest.defsKeyword))
    return true

  for (const definition of doc.defs) {
    if (definition.id === options.exceptDefId) continue
    if (
      nodeReferencesDefinition(
        definition.node,
        referenced,
        doc.rest.defsKeyword
      )
    )
      return true
  }

  return false
}

function nodeReferencesDefinition(
  node: DocumentNode,
  definition: DefinitionEntry,
  defsKeyword: unknown
): boolean {
  if (node.ref === definition.id) return true
  if (restReferencesDefinition(node.rest, definition, defsKeyword)) return true

  if (node.properties) {
    for (const property of node.properties) {
      if (nodeReferencesDefinition(property.node, definition, defsKeyword))
        return true
    }
  }

  if (node.items && nodeReferencesDefinition(node.items, definition, defsKeyword))
    return true

  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const children = node[key]
    if (!children) continue
    for (const child of children) {
      if (nodeReferencesDefinition(child, definition, defsKeyword)) return true
    }
  }

  return false
}

function restReferencesDefinition(
  rest: Record<string, unknown>,
  definition: DefinitionEntry,
  defsKeyword: unknown
): boolean {
  for (const [key, value] of Object.entries(rest)) {
    if (SCHEMA_MAP_REST_KEYS.has(key)) {
      if (schemaMapReferencesDefinition(value, definition, defsKeyword))
        return true
    } else if (SCHEMA_VALUE_REST_KEYS.has(key)) {
      if (schemaReferencesDefinition(value, definition, defsKeyword))
        return true
    }
  }
  return false
}

function schemaMapReferencesDefinition(
  value: unknown,
  definition: DefinitionEntry,
  defsKeyword: unknown
): boolean {
  if (!isPlainObject(value)) return false
  return Object.values(value).some((child) =>
    schemaReferencesDefinition(child, definition, defsKeyword)
  )
}

function schemaReferencesDefinition(
  value: unknown,
  definition: DefinitionEntry,
  defsKeyword: unknown
): boolean {
  if (Array.isArray(value)) {
    return value.some((child) =>
      schemaReferencesDefinition(child, definition, defsKeyword)
    )
  }
  if (!isPlainObject(value)) return false

  const ref = value.$ref
  if (ref === `#/${primaryDefsKeyword(defsKeyword)}/${definition.name}`)
    return true
  if (ref === `#/$defs/${definition.name}`) return true
  if (ref === `#/definitions/${definition.name}`) return true

  for (const [key, child] of Object.entries(value)) {
    if (SCHEMA_MAP_REST_KEYS.has(key)) {
      if (schemaMapReferencesDefinition(child, definition, defsKeyword))
        return true
    } else if (SCHEMA_VALUE_REST_KEYS.has(key)) {
      if (schemaReferencesDefinition(child, definition, defsKeyword))
        return true
    }
  }

  return false
}

function primaryDefsKeyword(defsKeyword: unknown): "$defs" | "definitions" {
  return defsKeyword === "definitions" ? "definitions" : "$defs"
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
