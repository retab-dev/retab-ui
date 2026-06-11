import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

const dateTimeSchemaCache = new WeakMap<object, boolean>()

export function isSchemaObject(
  schema: JSONSchema7Definition | undefined
): schema is JSONSchema7 {
  return typeof schema === "object" && schema !== null
}

export function isDateTimeFormat(format: unknown): boolean {
  return format === "date" || format === "date-time" || format === "iso-time"
}

export function hasDateTimeInSchema(
  schema: JSONSchema7Definition | undefined
): boolean {
  if (!isSchemaObject(schema)) return false
  const cached = dateTimeSchemaCache.get(schema)
  if (cached !== undefined) return cached

  let found = false
  try {
    if (isDateTimeFormat(schema.format)) {
      found = true
    } else if (schema.type === "object" && schema.properties) {
      found = Object.values(schema.properties).some(hasDateTimeInSchema)
    } else if (schema.type === "array" && schema.items) {
      found = Array.isArray(schema.items)
        ? schema.items.some(hasDateTimeInSchema)
        : hasDateTimeInSchema(schema.items)
    } else {
      const branches = schema.anyOf || schema.oneOf || schema.allOf
      found = !!branches?.some(hasDateTimeInSchema)
    }
  } finally {
    dateTimeSchemaCache.set(schema, found)
  }
  return found
}
