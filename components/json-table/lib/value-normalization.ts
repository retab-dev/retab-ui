import type { JSONSchema7Definition } from "json-schema"

import { dateStringToFormat } from "@/components/json-table/lib/date-display-formatting"
import {
  hasDateTimeInSchema,
  isDateTimeFormat,
  isSchemaObject,
} from "@/components/json-table/lib/schema-date-detection"

export function autoFormatDateTimeFields<T>(
  data: T,
  schema: JSONSchema7Definition | undefined
): T {
  if (!data || !isSchemaObject(schema)) return data

  if (Array.isArray(data)) {
    const itemSchema = Array.isArray(schema.items) ? undefined : schema.items
    if (!itemSchema || !hasDateTimeInSchema(itemSchema)) return data
    return data.map((item) => autoFormatDateTimeFields(item, itemSchema)) as T
  }

  if (typeof data === "object" && data !== null) {
    const result: Record<string, unknown> = {
      ...(data as Record<string, unknown>),
    }
    const properties = schema.properties
    if (!properties) return result as T

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (!(key in result) || !isSchemaObject(propertySchema)) continue
      result[key] = formatValueForCommit(result[key], propertySchema)
    }

    return result as T
  }

  return data
}

export function formatValueForCommit(
  value: unknown,
  schema: JSONSchema7Definition | undefined
): unknown {
  if (!isSchemaObject(schema)) return value

  if (typeof value === "string" && isDateTimeFormat(schema.format)) {
    switch (schema.format) {
      case "date":
        return dateStringToFormat(value, "2000-01-01") || value
      case "iso-time":
        return dateStringToFormat(value, "00:00") || value
      case "date-time":
        return dateStringToFormat(value, "2000-01-01T00:00:00") || value
    }
  }

  if (
    (schema.type === "object" || schema.type === "array") &&
    hasDateTimeInSchema(schema)
  ) {
    return autoFormatDateTimeFields(value, schema)
  }

  return value
}
