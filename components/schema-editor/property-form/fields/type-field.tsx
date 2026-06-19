"use client";

import {
  SchemaTypeMenu,
  type SchemaTypeMenuVariant,
} from "@/components/schema-editor/primitives/schema-type-menu";
import type { PropertyTypeFieldModel } from "@/components/schema-editor/property-form/types";

export function TypeField({
  field,
  variant = "form",
}: {
  field: PropertyTypeFieldModel;
  variant?: SchemaTypeMenuVariant;
}) {
  return (
    <SchemaTypeMenu
      ariaLabel={field.ariaLabel}
      editable={field.editable}
      sections={field.sections}
      trailingContent={field.trailingContent}
      value={field.value}
      variant={variant}
    />
  );
}
