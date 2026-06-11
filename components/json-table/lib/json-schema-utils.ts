import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

export function isValidProperty(
  property: JSONSchema7Definition | undefined
): property is JSONSchema7 {
  return (
    typeof property === "object" &&
    property !== null &&
    ("type" in property ||
      "$ref" in property ||
      "anyOf" in property ||
      "oneOf" in property ||
      "allOf" in property)
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

  if (
    property.type === "object" ||
    (property.properties && Object.keys(property.properties).length > 0)
  ) {
    return true
  }

  if ("$ref" in property) {
    const resolvedProperty = resolveSchemaReference(property, schema)
    return isObjectProperty(resolvedProperty, schema)
  }

  return false
}

export function getValueAtPath(
  data: unknown,
  path: string | undefined
): unknown {
  if (!path || path.trim() === "") {
    return data
  }

  const segments = path.split(".")

  const walk = (node: unknown, index: number): unknown => {
    if (index === segments.length) return node
    if (node === null || node === undefined) return undefined

    const segment = segments[index]

    if (segment === "*") {
      if (Array.isArray(node)) {
        for (const child of node) {
          const result = walk(child, index + 1)
          if (result !== undefined) return result
        }
        return undefined
      }

      if (typeof node === "object") {
        for (const child of Object.values(node)) {
          const result = walk(child, index + 1)
          if (result !== undefined) return result
        }
      }

      return undefined
    }

    const next =
      Array.isArray(node) && !Number.isNaN(Number(segment))
        ? node[Number(segment)]
        : (node as Record<string, unknown>)[segment]

    return walk(next, index + 1)
  }

  return walk(data, 0)
}
