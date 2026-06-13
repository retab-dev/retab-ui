"use client"

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { createObjectTemplateTypeTrailingContent } from "@/components/schema-editor/object-template-type-section"
import {
  SchemaTypeMenu,
  type SchemaTypeMenuVariant,
} from "@/components/schema-editor/primitives/schema-type-menu"
import type { PropertyFormSchemaContext } from "@/components/schema-editor/property-form/types"

import { createPropertyTypeMenu } from "./property-type-menu-model"

export function TypeField({
  schemaNode,
  schemaContext,
  fieldPath,
  editable,
  variant = "form",
  onChange,
}: {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  fieldPath?: string
  editable: boolean
  variant?: SchemaTypeMenuVariant
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}) {
  const menu = createPropertyTypeMenu({
    disabled: !editable,
    schemaContext,
    schemaNode,
    onChange,
  })
  const trailingContent = schemaContext.objectTemplatesEnabled
    ? createObjectTemplateTypeTrailingContent({
        onSelectTemplate: menu.selectObjectTemplate,
      })
    : undefined

  return (
    <SchemaTypeMenu
      ariaLabel={`Data type${fieldPath ? ` for ${fieldPath}` : ""}`}
      editable={editable}
      sections={menu.sections}
      trailingContent={trailingContent}
      value={menu.value}
      variant={variant}
    />
  )
}
