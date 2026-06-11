import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

import type { ExtendedJSONSchema7 } from "@/components/json-table/lib/json-schema-types"

// Pydantic reserved names that actually break model creation
export const PYDANTIC_RESERVED = [
  "__root__",
  "model_config",
  "model_post_init",
  "model_validate",
  "model_dump",
]

// Generic name validator for Pydantic compatible field and definition names
export function validateName(
  name: string,
  existingNames: string[] = [],
  currentName?: string,
  entityType: string = "name"
): string | null {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(name)) {
    return "Name must start with a letter or underscore, contain only letters, numbers, or underscores, and be at most 64 characters long"
  }

  if (PYDANTIC_RESERVED.includes(name)) {
    return `"${name}" is a Pydantic reserved name`
  }

  const namesToCheck = currentName
    ? existingNames.filter((n) => n.toLowerCase() !== currentName.toLowerCase())
    : existingNames

  if (namesToCheck.some((n) => n.toLowerCase() === name.toLowerCase())) {
    return `A ${entityType} with the name "${name}" already exists (names are case-insensitive)`
  }

  return null
}

export function isValidProperty(
  p: JSONSchema7Definition | undefined
): p is JSONSchema7 {
  return (
    typeof p === "object" &&
    p !== null &&
    ("type" in p || "$ref" in p || "anyOf" in p || "oneOf" in p || "allOf" in p)
  )
}

export function resolveSchemaReference(
  refSchema: JSONSchema7Definition,
  schema: JSONSchema7
): JSONSchema7 {
  if (
    typeof refSchema !== "object" ||
    refSchema === null ||
    !("$ref" in refSchema)
  ) {
    throw new Error("Schema is not a valid reference schema.")
  }

  const ref = refSchema.$ref
  if (!ref || !ref.startsWith("#/")) {
    throw new Error("Only internal references are supported.")
  }

  const path = ref.substring(2).split("/")
  let resolved: unknown = schema
  for (const part of path) {
    if (typeof resolved !== "object" || resolved === null) {
      throw new Error(`Unable to resolve schema reference: ${ref}`)
    }

    resolved = (resolved as Record<string, unknown>)[part]
    if (resolved === undefined) {
      throw new Error(`Unable to resolve schema reference: ${ref}`)
    }
  }

  const resolvedSchema = resolved as JSONSchema7Definition
  if (!isValidProperty(resolvedSchema)) {
    throw new Error(`Schema reference does not resolve to a schema: ${ref}`)
  }

  return resolvedSchema
}

export function isObjectProperty(
  property: JSONSchema7Definition,
  schema: JSONSchema7
): boolean {
  if (typeof property !== "object" || property === null) return false

  // Direct object type
  if (
    property.type === "object" ||
    (property.properties && Object.keys(property.properties).length > 0)
  ) {
    return true
  }

  // Reference to object type
  if ("$ref" in property) {
    const resolvedProperty = resolveSchemaReference(property, schema)
    // Recursively check if the resolved schema is object
    return isObjectProperty(resolvedProperty, schema)
  }

  return false
}

/**
 * Gets a value from a row array using a dot notation path.
 * Supports wildcards (*) to traverse arrays and objects.
 *
 * @param data - The data object to traverse
 * @param path - The dot notation path (e.g., "items.0.name" or "items.*.name")
 * @returns The value at the specified path, or undefined if not found
 */
export function get_value_from_row_array_and_dot_notation_path(
  data: unknown,
  path: string | undefined
): unknown {
  // Special case: empty path
  if (!path || path.trim() === "") {
    return data
  }

  const segments = path.split(".")

  /**
   * Depth‑first traversal that respects "*" wildcards.
   * Returns the first value that matches the path.
   */
  const dfs = (node: unknown, idx: number): unknown => {
    if (idx === segments.length) return node
    if (node === null || node === undefined) return undefined

    const seg = segments[idx]

    // Wildcard – iterate over everything at this level
    if (seg === "*") {
      if (Array.isArray(node) && node.length > 0) {
        // For arrays, return the first matching value
        for (const child of node) {
          const result = dfs(child, idx + 1)
          if (result !== undefined) return result
        }
        return undefined
      }

      if (typeof node === "object") {
        // For objects, return the first matching value
        for (const child of Object.values(node)) {
          const result = dfs(child, idx + 1)
          if (result !== undefined) return result
        }
        return undefined
      }

      return undefined // Non‑iterable reached with "*"
    }

    // Normal segment (object key OR array index)
    const next =
      Array.isArray(node) && !Number.isNaN(Number(seg))
        ? node[Number(seg)]
        : (node as Record<string, unknown>)[seg]

    return dfs(next, idx + 1)
  }

  return dfs(data, 0)
}

export function getEffectiveNode(
  node: ExtendedJSONSchema7
): ExtendedJSONSchema7 {
  if (node.anyOf && Array.isArray(node.anyOf)) {
    const nonNull = node.anyOf.find(
      (b: JSONSchema7Definition) =>
        typeof b === "object" && (b.type !== "null" || b.$ref)
    )
    return nonNull && typeof nonNull === "object" ? nonNull : node
  }
  return node
}
