import type {
  PropertyCapabilities,
  PropertyFormMode,
} from "@/components/schema-editor/property-form/types";

export function resolvePropertyCapabilities({
  mode,
  canDelete,
}: {
  mode: PropertyFormMode;
  canDelete: boolean;
}): PropertyCapabilities {
  const editable = mode === "editable";
  const descriptionOnly = mode === "descriptionOnly";
  return {
    mode,
    canEditName: editable,
    canEditType: editable,
    canEditNullable: editable,
    canEditDescription: editable || descriptionOnly,
    canEditNestedObject: editable,
    canEditArrayItems: editable,
    canEditEnumValues: editable,
    canDelete: editable && canDelete,
  };
}
