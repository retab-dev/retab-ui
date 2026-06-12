import type { JSONSchema7Type } from "json-schema"

export function formatEnumValueInput(value: JSONSchema7Type): string {
  return typeof value === "string" ? value : JSON.stringify(value)
}

export function parseEnumValueInput(value: string): JSONSchema7Type {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ""

  try {
    const parsedValue = JSON.parse(trimmedValue)
    if (isJsonSchemaValue(parsedValue)) return parsedValue
  } catch {
    return trimmedValue
  }

  return trimmedValue
}

function isJsonSchemaValue(value: unknown): value is JSONSchema7Type {
  if (value === null) return true
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true
  }
  if (Array.isArray(value)) return value.every(isJsonSchemaValue)
  if (typeof value !== "object") return false

  return Object.values(value).every(isJsonSchemaValue)
}
