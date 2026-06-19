import type { JSONSchema7Definition } from "json-schema";

import { setNullable } from "@/components/schema-editor/draft/draft-node-edits";
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils";
import type { PropertyDraft } from "@/components/schema-editor/property-form/types";

export function isObjectSchema(
  value: JSONSchema7Definition | undefined,
): value is ExtendedJSONSchema7 {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function setDraftNullable(
  propertyDraft: PropertyDraft,
  isNullable: boolean,
): PropertyDraft {
  return {
    ...propertyDraft,
    schemaNode: setNullable(propertyDraft.schemaNode, isNullable),
  };
}

export function getArrayItemsForDraft(
  schemaNode: ExtendedJSONSchema7,
): ExtendedJSONSchema7 {
  const effectiveSchemaNode = getEffectiveNode(schemaNode);
  const effectiveItems = Array.isArray(effectiveSchemaNode.items)
    ? undefined
    : effectiveSchemaNode.items;
  return isObjectSchema(effectiveItems) ? effectiveItems : { type: "string" };
}
