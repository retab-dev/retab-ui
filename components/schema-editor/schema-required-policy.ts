import type { JSONSchema7Definition } from "json-schema"

/**
 * Editor policy: every object property is required. Recursively sets each
 * object's `required` to all of its property keys. Nullability is orthogonal:
 * a field can be both required and nullable.
 */
export function requireAllProperties(
  schema: JSONSchema7Definition
): JSONSchema7Definition {
  if (typeof schema !== "object" || schema === null) return schema

  const out: Record<string, unknown> = { ...schema }

  if (out.properties && typeof out.properties === "object") {
    const properties = out.properties as Record<string, JSONSchema7Definition>
    const nextProperties: Record<string, JSONSchema7Definition> = {}
    for (const [key, value] of Object.entries(properties)) {
      nextProperties[key] = requireAllProperties(value)
    }
    out.properties = nextProperties
    out.required = Object.keys(nextProperties)
  }

  if (out.items) {
    out.items = Array.isArray(out.items)
      ? out.items.map((item) =>
          requireAllProperties(item as JSONSchema7Definition)
        )
      : requireAllProperties(out.items as JSONSchema7Definition)
  }

  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    if (Array.isArray(out[key])) {
      out[key] = (out[key] as JSONSchema7Definition[]).map(
        requireAllProperties
      )
    }
  }

  for (const key of ["$defs", "definitions"] as const) {
    if (out[key] && typeof out[key] === "object") {
      const definitions = out[key] as Record<string, JSONSchema7Definition>
      const nextDefinitions: Record<string, JSONSchema7Definition> = {}
      for (const [name, value] of Object.entries(definitions)) {
        nextDefinitions[name] = requireAllProperties(value)
      }
      out[key] = nextDefinitions
    }
  }

  return out as JSONSchema7Definition
}
