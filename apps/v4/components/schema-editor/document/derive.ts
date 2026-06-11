import type { JSONSchema7TypeName } from "json-schema"

import type {
  DefinitionEntry,
  DocumentNode,
  SchemaDocument,
  SchemaKind,
} from "./types"

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
export function isDanglingRef(doc: SchemaDocument, node: DocumentNode): boolean {
  return Boolean(node.ref) && !resolveRef(doc, node)
}
