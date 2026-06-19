import type { JSONSchema7, JSONSchema7Definition } from "json-schema";

import { dateStringToFormat } from "@/components/json-table/lib/date-display-formatting";
import {
  isDateTimeFormat,
  isSchemaObject,
} from "@/components/json-table/lib/schema-date-detection";
import { unwrapSchema } from "@/components/json-table/lib/schema-references";

function getEffectiveCommitSchema(
  schema: JSONSchema7Definition,
  rootSchema: JSONSchema7,
): JSONSchema7 {
  return unwrapSchema(schema, rootSchema).schema;
}

export function autoFormatDateTimeFields<T>(
  data: T,
  schema: JSONSchema7Definition | undefined,
  rootSchema?: JSONSchema7,
): T {
  if (!data || !isSchemaObject(schema)) return data;
  const contextSchema = rootSchema ?? (schema as JSONSchema7);
  const effectiveSchema = getEffectiveCommitSchema(schema, contextSchema);

  if (Array.isArray(data)) {
    const items = effectiveSchema.items;
    if (Array.isArray(items)) {
      return data.map((item, index) => {
        const itemSchema = items[index] ?? effectiveSchema.additionalItems;
        return itemSchema
          ? formatValueForCommit(item, itemSchema, contextSchema)
          : item;
      }) as T;
    }

    if (!items) return data;
    return data.map((item) =>
      formatValueForCommit(item, items, contextSchema),
    ) as T;
  }

  if (typeof data === "object" && data !== null) {
    const result: Record<string, unknown> = {
      ...(data as Record<string, unknown>),
    };
    const properties = effectiveSchema.properties;
    if (!properties) return result as T;

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (!(key in result) || !isSchemaObject(propertySchema)) continue;
      result[key] = formatValueForCommit(
        result[key],
        propertySchema,
        contextSchema,
      );
    }

    return result as T;
  }

  return data;
}

export function formatValueForCommit(
  value: unknown,
  schema: JSONSchema7Definition | undefined,
  rootSchema?: JSONSchema7,
): unknown {
  if (!isSchemaObject(schema)) return value;
  const contextSchema = rootSchema ?? (schema as JSONSchema7);
  const effectiveSchema = getEffectiveCommitSchema(schema, contextSchema);

  if (typeof value === "string" && isDateTimeFormat(effectiveSchema.format)) {
    switch (effectiveSchema.format) {
      case "date":
        return dateStringToFormat(value, "2000-01-01") || value;
      case "time":
        return dateStringToFormat(value, "00:00") || value;
      case "date-time":
        return dateStringToFormat(value, "2000-01-01T00:00:00") || value;
    }
  }

  if (
    effectiveSchema.type === "object" ||
    effectiveSchema.type === "array" ||
    effectiveSchema.properties ||
    effectiveSchema.items
  ) {
    return autoFormatDateTimeFields(value, effectiveSchema, contextSchema);
  }

  return value;
}
