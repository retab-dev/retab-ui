import type { JSONSchema7Definition } from "json-schema"

const SCHEMA_VALUE_KEYS = [
  "additionalItems",
  "additionalProperties",
  "contains",
  "else",
  "if",
  "not",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
] as const

const SCHEMA_MAP_KEYS = [
  "$defs",
  "definitions",
  "dependentSchemas",
  "dependencies",
  "patternProperties",
] as const

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
      setRecordValue(nextProperties, key, requireAllProperties(value))
    }
    out.properties = nextProperties
    out.required = mergeRequiredNames(out.required, Object.keys(nextProperties))
  }

  if (out.items) {
    out.items = Array.isArray(out.items)
      ? out.items.map((item) =>
          requireAllProperties(item as JSONSchema7Definition)
        )
      : requireAllProperties(out.items as JSONSchema7Definition)
  }

  if (Array.isArray(out.prefixItems)) {
    out.prefixItems = (out.prefixItems as JSONSchema7Definition[]).map(
      requireAllProperties
    )
  }

  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    if (Array.isArray(out[key])) {
      out[key] = (out[key] as JSONSchema7Definition[]).map(
        requireAllProperties
      )
    }
  }

  for (const key of SCHEMA_VALUE_KEYS) {
    if (isSchemaObject(out[key])) {
      out[key] = requireAllProperties(out[key] as JSONSchema7Definition)
    }
  }

  for (const key of SCHEMA_MAP_KEYS) {
    if (out[key] && typeof out[key] === "object") {
      const definitions = out[key] as Record<string, unknown>
      const nextDefinitions: Record<string, unknown> = {}
      for (const [name, value] of Object.entries(definitions)) {
        setRecordValue(
          nextDefinitions,
          name,
          key === "dependencies" && Array.isArray(value)
            ? value
            : isJsonSchemaDefinition(value)
              ? requireAllProperties(value)
              : value
        )
      }
      out[key] = nextDefinitions
    }
  }

  return out as JSONSchema7Definition
}

function isSchemaObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isJsonSchemaDefinition(value: unknown): value is JSONSchema7Definition {
  return typeof value === "boolean" || isSchemaObject(value)
}

function mergeRequiredNames(
  existing: unknown,
  propertyNames: string[]
): string[] {
  const required = Array.isArray(existing)
    ? existing.filter((name): name is string => typeof name === "string")
    : []
  const seen = new Set(required)

  for (const propertyName of propertyNames) {
    if (seen.has(propertyName)) continue
    required.push(propertyName)
    seen.add(propertyName)
  }

  return required
}

function setRecordValue<T>(
  record: Record<string, T>,
  key: string,
  value: T
) {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  })
}
