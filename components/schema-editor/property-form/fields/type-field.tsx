"use client"

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { createObjectTemplateTypeAccessory } from "@/components/schema-editor/object-template-type-section"
import { SchemaTypeMenu } from "@/components/schema-editor/primitives/schema-type-menu"
import type { PropertyFormSchemaContext } from "@/components/schema-editor/property-form/types"

import { createPropertyTypeMenu } from "./property-type-menu-model"

export function TypeField({
  schemaNode,
  schemaContext,
  fieldPath,
  mode,
  disabled,
  variant = "outline",
  onChange,
}: {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  fieldPath?: string
  mode: "descriptionOnly" | "readOnly" | "editable"
  disabled: boolean
  variant?: "outline" | "compact"
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}) {
  const isDisabled = disabled || mode === "readOnly"
  const menu = createPropertyTypeMenu({
    disabled: isDisabled,
    schemaContext,
    schemaNode,
    onChange,
  })
  const accessory = schemaContext.objectTemplatesEnabled
    ? createObjectTemplateTypeAccessory({
        onSelectTemplate: menu.selectObjectTemplate,
      })
    : undefined

  return (
    <SchemaTypeMenu
      ariaLabel={`Data type${fieldPath ? ` for ${fieldPath}` : ""}`}
      accessory={accessory}
      editable={!isDisabled}
      sections={menu.sections}
      value={menu.value}
      variant={variant === "compact" ? "row" : "form"}
    />
  )
}
