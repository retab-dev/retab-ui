import type { JSONSchema7, JSONSchema7Definition } from "json-schema";

import {
  resolveSchema,
  unwrapSchema,
} from "@/components/json-table/lib/schema-references";

export type FieldPath = string;
export type MaterializedFieldPath = string;

function isArrayIndexSegment(segment: string): boolean {
  return /^\d+$/.test(segment);
}

function isObjectTraversalSchema(schema: JSONSchema7): boolean {
  return schema.type === "object" || !!schema.properties;
}

function isArrayTraversalSchema(schema: JSONSchema7): boolean {
  return schema.type === "array" || !!schema.items;
}

function getOwnSchemaProperty(
  properties: Record<string, JSONSchema7Definition>,
  segment: string,
): JSONSchema7Definition | undefined {
  return Object.prototype.hasOwnProperty.call(properties, segment)
    ? properties[segment]
    : undefined;
}

export function getSchemaPropertyType(
  schema: JSONSchema7,
  key: FieldPath,
): JSONSchema7 | undefined {
  const rootSchema = schema;
  let currentSchema: JSONSchema7Definition = schema;
  if (key === "") return schema;

  for (const segment of key.split(".")) {
    const traversal: JSONSchema7 = unwrapSchema(
      resolveSchema(currentSchema, rootSchema),
      rootSchema,
    ).schema;

    if (isObjectTraversalSchema(traversal) && traversal.properties) {
      const nextSchema: JSONSchema7Definition | undefined =
        getOwnSchemaProperty(traversal.properties, segment);
      if (nextSchema === undefined) return undefined;
      currentSchema = nextSchema;
    } else if (isArrayTraversalSchema(traversal) && traversal.items) {
      if (Array.isArray(traversal.items)) {
        if (!isArrayIndexSegment(segment)) return undefined;
        const index = parseInt(segment, 10);
        const nextSchema: JSONSchema7Definition | undefined =
          traversal.items[index] ??
          (traversal.additionalItems === false
            ? undefined
            : traversal.additionalItems);
        if (nextSchema === undefined) return undefined;
        currentSchema = nextSchema;
      } else if (
        (typeof traversal.items === "object" ||
          typeof traversal.items === "boolean") &&
        (segment === "*" || isArrayIndexSegment(segment))
      ) {
        currentSchema = traversal.items;
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  }

  return resolveSchema(currentSchema, rootSchema);
}

export function getSchemaPropertyTypeRaw(
  schema: JSONSchema7,
  key: FieldPath,
): JSONSchema7Definition | undefined {
  const rootSchema = schema;
  let currentSchema: JSONSchema7Definition = schema;
  if (key === "") return schema;

  for (const segment of key.split(".")) {
    const traversal: JSONSchema7 = unwrapSchema(
      resolveSchema(currentSchema, rootSchema),
      rootSchema,
    ).schema;

    if (isObjectTraversalSchema(traversal) && traversal.properties) {
      const nextSchema: JSONSchema7Definition | undefined =
        getOwnSchemaProperty(traversal.properties, segment);
      if (nextSchema === undefined) return undefined;
      currentSchema = nextSchema;
    } else if (isArrayTraversalSchema(traversal) && traversal.items) {
      if (Array.isArray(traversal.items)) {
        if (!isArrayIndexSegment(segment)) return undefined;
        const index = parseInt(segment, 10);
        const nextSchema: JSONSchema7Definition | undefined =
          traversal.items[index] ??
          (traversal.additionalItems === false
            ? undefined
            : traversal.additionalItems);
        if (nextSchema === undefined) return undefined;
        currentSchema = nextSchema;
      } else if (
        (typeof traversal.items === "object" ||
          typeof traversal.items === "boolean") &&
        (segment === "*" || isArrayIndexSegment(segment))
      ) {
        currentSchema = traversal.items;
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  }

  return currentSchema;
}
