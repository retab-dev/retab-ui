import type { JSONSchema7Definition } from "json-schema";

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";

export function isSchemaNode(
  value: JSONSchema7Definition | undefined,
): value is ExtendedJSONSchema7 {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getObjectPropertyNames(schemaNode: ExtendedJSONSchema7) {
  return Object.keys(schemaNode.properties || {});
}
