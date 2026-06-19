import type { JSONSchema7 } from "json-schema";

import type { FieldPath } from "@/components/json-table/lib/schema-paths";
import { getSchemaPropertyType } from "@/components/json-table/lib/schema-paths";
import { unwrapSchema } from "@/components/json-table/lib/schema-references";

export type FieldKind =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "date-time"
  | "time"
  | "enum"
  | "object"
  | "array"
  | "unknown";

export interface FieldMetadata {
  fieldPath: FieldPath;
  rawSchema: JSONSchema7;
  schema: JSONSchema7;
  effectiveSchema: JSONSchema7;
  isNullable: boolean;
  kind: FieldKind;
  enumValues: unknown[];
}

export function getFieldMetadata(
  rootSchema: JSONSchema7,
  fieldPath: FieldPath,
): FieldMetadata | undefined {
  if (!fieldPath) return undefined;

  const rawSchema = getSchemaPropertyType(rootSchema, fieldPath);
  if (!rawSchema) return undefined;

  const { schema, nullable } = unwrapSchema(rawSchema, rootSchema);
  const type = Array.isArray(schema.type)
    ? schema.type.find((item) => item !== "null")
    : schema.type ||
      (schema.properties ? "object" : schema.items ? "array" : undefined);
  const format = schema.format;
  const kind: FieldKind = Array.isArray(schema.enum)
    ? "enum"
    : format === "date"
      ? "date"
      : format === "date-time"
        ? "date-time"
        : format === "time"
          ? "time"
          : type === "string" ||
              type === "number" ||
              type === "integer" ||
              type === "boolean" ||
              type === "object" ||
              type === "array"
            ? type
            : "unknown";

  return {
    fieldPath,
    rawSchema,
    schema,
    effectiveSchema: schema,
    isNullable: nullable,
    kind,
    enumValues: schema.enum ?? [],
  };
}
