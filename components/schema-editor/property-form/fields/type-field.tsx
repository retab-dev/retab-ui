"use client"

import {
  SchemaTypeMenu,
  type SchemaTypeMenuVariant,
} from "@/components/schema-editor/primitives/schema-type-menu"
import type { PropertyTypeFieldModel } from "@/components/schema-editor/property-form/types"

import { createPropertyTypeMenu } from "./property-type-menu-model"

export function TypeField({
  field,
  variant = "form",
}: {
  field: PropertyTypeFieldModel
  variant?: SchemaTypeMenuVariant
}) {
  const menu = createPropertyTypeMenu({
    disabled: !field.editable,
    schemaContext: field.schemaContext,
    schemaNode: field.schemaNode,
    onChange: field.onChange,
  })

  return (
    <SchemaTypeMenu
      ariaLabel={`Data type${field.fieldPath ? ` for ${field.fieldPath}` : ""}`}
      editable={field.editable}
      sections={menu.sections}
      trailingContent={field.trailingContent}
      value={menu.value}
      variant={variant}
    />
  )
}
