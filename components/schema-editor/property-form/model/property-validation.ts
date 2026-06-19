import type {
  PropertyCapabilities,
  PropertyValidation,
} from "@/components/schema-editor/property-form/types";

export function normalizeValidationForCapabilities({
  validation,
  capabilities,
}: {
  validation: PropertyValidation;
  capabilities: PropertyCapabilities;
}): PropertyValidation {
  const isEnumValueValidation =
    validation.schemaNode.code === "enum_empty" ||
    validation.schemaNode.code === "enum_blank" ||
    validation.schemaNode.code === "enum_duplicate";
  const canEditSchemaValidation =
    validation.schemaNode.status !== "invalid" ||
    (isEnumValueValidation
      ? capabilities.canEditType || capabilities.canEditEnumValues
      : capabilities.canEditType ||
        capabilities.canEditNullable ||
        capabilities.canEditNestedObject ||
        capabilities.canEditArrayItems ||
        capabilities.canEditEnumValues);
  const name =
    capabilities.canEditName || validation.name.status !== "invalid"
      ? validation.name
      : { status: "valid" as const };
  const schemaNode = canEditSchemaValidation
    ? validation.schemaNode
    : { status: "valid" as const };

  return {
    ...validation,
    name,
    schemaNode,
    canCommit: name.status !== "invalid" && schemaNode.status !== "invalid",
  };
}
