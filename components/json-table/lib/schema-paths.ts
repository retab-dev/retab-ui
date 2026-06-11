import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

import {
  resolveSchema,
  unwrapSchema,
} from "@/components/json-table/lib/schema-references"

export type FieldPath = string
export type MaterializedFieldPath = string

export function getSchemaPropertyType(
  schema: JSONSchema7,
  key: FieldPath
): JSONSchema7 {
  const rootSchema = schema
  if (key === "") return schema

  for (const segment of key.split(".")) {
    const traversal = unwrapSchema(
      resolveSchema(schema, rootSchema),
      rootSchema
    ).schema

    if (traversal.type === "object" && traversal.properties) {
      schema = traversal.properties[segment] as JSONSchema7
    } else if (traversal.type === "array" && traversal.items) {
      if (Array.isArray(traversal.items)) {
        schema = traversal.items[parseInt(segment, 10)] as JSONSchema7
      } else if (
        typeof traversal.items === "object" &&
        (segment === "*" || !Number.isNaN(parseInt(segment, 10)))
      ) {
        schema = traversal.items as JSONSchema7
      }
    }
  }

  return resolveSchema(schema, rootSchema)
}

export function getSchemaPropertyTypeRaw(
  schema: JSONSchema7,
  key: FieldPath
): JSONSchema7Definition {
  const rootSchema = schema
  if (key === "") return schema

  for (const segment of key.split(".")) {
    const traversal = unwrapSchema(
      resolveSchema(schema, rootSchema),
      rootSchema
    ).schema

    if (traversal.type === "object" && traversal.properties) {
      schema = traversal.properties[segment] as JSONSchema7
    } else if (traversal.type === "array" && traversal.items) {
      if (Array.isArray(traversal.items)) {
        schema = traversal.items[parseInt(segment, 10)] as JSONSchema7
      } else if (
        typeof traversal.items === "object" &&
        (segment === "*" || !Number.isNaN(parseInt(segment, 10)))
      ) {
        schema = traversal.items as JSONSchema7
      }
    }
  }

  return schema
}
