"use client"

import { definitionRef } from "@/components/schema-editor/document/json-pointer"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { createObjectTemplateTypeTrailingContent } from "@/components/schema-editor/object-template-type-section"
import type {
  PropertyFormSchemaContext,
  PropertyTypeFieldModel,
} from "@/components/schema-editor/property-form/types"

import {
  createPropertyTypeField,
  replacePropertyTypeSchemaNode,
} from "./property-type-field-model"

interface ObjectTemplatePropertyTypeFieldInput {
  editable: boolean
  schemaContext: PropertyFormSchemaContext
  schemaNode: ExtendedJSONSchema7
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}

export function createPropertyTypeFieldWithObjectTemplates({
  editable,
  schemaContext,
  schemaNode,
  onChange,
}: ObjectTemplatePropertyTypeFieldInput): PropertyTypeFieldModel {
  const selectObjectTemplate = (templateName: string) => {
    if (!editable) return
    void schemaContext.onCommand?.({
      type: "installObjectTemplate",
      templateName,
    })
    replacePropertyTypeSchemaNode({
      schemaNode,
      replacement: {
        $ref: definitionRef("$defs", templateName),
      },
      onChange,
    })
  }

  return createPropertyTypeField({
    editable,
    schemaContext,
    schemaNode,
    trailingContent: schemaContext.objectTemplatesEnabled
      ? createObjectTemplateTypeTrailingContent({
          onSelectTemplate: selectObjectTemplate,
        })
      : undefined,
    onChange,
  })
}
