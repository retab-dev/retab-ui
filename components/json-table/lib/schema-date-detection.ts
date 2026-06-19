import type { JSONSchema7, JSONSchema7Definition } from "json-schema";

import { resolveSchema } from "@/components/json-table/lib/schema-references";

const dateTimeSchemaCache = new WeakMap<object, boolean>();

export function isSchemaObject(
  schema: JSONSchema7Definition | undefined,
): schema is JSONSchema7 {
  return typeof schema === "object" && schema !== null;
}

export function isDateTimeFormat(format: unknown): boolean {
  return format === "date" || format === "date-time" || format === "time";
}

export function hasDateTimeInSchema(
  schema: JSONSchema7Definition | undefined,
  rootSchema?: JSONSchema7,
): boolean {
  if (!isSchemaObject(schema)) return false;
  const shouldUseCache = !rootSchema || rootSchema === schema;
  const cached = shouldUseCache ? dateTimeSchemaCache.get(schema) : undefined;
  if (cached !== undefined) return cached;

  const contextSchema = rootSchema ?? schema;
  let found = false;
  try {
    if (schema.$ref) {
      const resolvedSchema = resolveSchema(schema, contextSchema);
      found =
        resolvedSchema !== schema &&
        hasDateTimeInSchema(resolvedSchema, contextSchema);
    } else if (isDateTimeFormat(schema.format)) {
      found = true;
    } else if (
      (schema.type === "object" || !!schema.properties) &&
      schema.properties
    ) {
      found = Object.values(schema.properties).some((propertySchema) =>
        hasDateTimeInSchema(propertySchema, contextSchema),
      );
    } else if ((schema.type === "array" || !!schema.items) && schema.items) {
      found = Array.isArray(schema.items)
        ? schema.items.some((itemSchema) =>
            hasDateTimeInSchema(itemSchema, contextSchema),
          )
        : hasDateTimeInSchema(schema.items, contextSchema);
    } else {
      const branches = schema.anyOf || schema.oneOf || schema.allOf;
      found = !!branches?.some((branchSchema) =>
        hasDateTimeInSchema(branchSchema, contextSchema),
      );
    }
  } finally {
    if (shouldUseCache) {
      dateTimeSchemaCache.set(schema, found);
    }
  }
  return found;
}
