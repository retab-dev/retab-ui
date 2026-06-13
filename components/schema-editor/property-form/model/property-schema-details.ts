"use client"

import { updateEffectiveNode } from "@/components/schema-editor/draft/draft-node-edits"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"
import { createPropertyTypeFieldWithObjectTemplates } from "@/components/schema-editor/property-form/fields/property-object-template-type-field"
import { getArrayItemsForDraft } from "@/components/schema-editor/property-form/model/effective-node-edits"
import type {
  PropertyFormMode,
  PropertyFormSchemaContext,
  PropertySchemaDetailAccess,
  PropertySchemaDetailsModel,
} from "@/components/schema-editor/property-form/types"

interface CreatePropertySchemaDetailsInput {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  mode: PropertyFormMode
  access: PropertySchemaDetailAccess
  editable: boolean
  showTypeSelector?: boolean
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}

export function createPropertySchemaDetails({
  schemaNode,
  schemaContext,
  mode,
  access,
  editable,
  showTypeSelector = true,
  onChange,
}: CreatePropertySchemaDetailsInput): PropertySchemaDetailsModel {
  const effectiveSchemaNode = getEffectiveNode(schemaNode)
  const resetKey =
    schemaContext.resetKey ?? schemaContext.fieldPath ?? schemaContext.originalName

  const updateEffectiveSchemaNode = (nextSchemaNode: ExtendedJSONSchema7) => {
    onChange(updateEffectiveNode(schemaNode, nextSchemaNode))
  }

  return {
    type: showTypeSelector
      ? createPropertyTypeFieldWithObjectTemplates({
          schemaNode,
          schemaContext,
          editable: editable && access.type,
          onChange,
        })
      : undefined,
    enumValues:
      access.enumValues && Array.isArray(effectiveSchemaNode.enum)
        ? {
            values: effectiveSchemaNode.enum,
            resetKey,
            disabled: !editable || !access.enumValues,
            onChange: (values) => {
              updateEffectiveSchemaNode({
                ...effectiveSchemaNode,
                enum: values,
              })
            },
          }
        : undefined,
    objectProperties:
      access.objectProperties &&
      effectiveSchemaNode.type === "object" &&
      !effectiveSchemaNode.$ref
        ? {
            schemaNode: effectiveSchemaNode,
            schemaContext,
            mode,
            access,
            editable: editable && access.objectProperties,
            onChange: updateEffectiveSchemaNode,
          }
        : undefined,
    arrayItems:
      access.arrayItems && effectiveSchemaNode.type === "array"
        ? {
            itemSchemaDetails: createPropertySchemaDetails({
              schemaNode: getArrayItemsForDraft(schemaNode),
              schemaContext,
              mode,
              access,
              editable,
              onChange: (items) => {
                updateEffectiveSchemaNode({
                  ...effectiveSchemaNode,
                  items,
                })
              },
            }),
          }
        : undefined,
  }
}
