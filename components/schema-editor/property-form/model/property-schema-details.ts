"use client"

import { updateEffectiveNode } from "@/components/schema-editor/draft/draft-node-edits"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"
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
  disabled: boolean
  showTypeSelector?: boolean
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}

export function createPropertySchemaDetails({
  schemaNode,
  schemaContext,
  mode,
  access,
  disabled,
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
      ? {
          schemaNode,
          schemaContext,
          editable: !disabled && access.type,
          onChange,
        }
      : undefined,
    enumValues:
      access.enumValues && Array.isArray(effectiveSchemaNode.enum)
        ? {
            values: effectiveSchemaNode.enum,
            resetKey,
            disabled: disabled || !access.enumValues,
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
            editable: !disabled && access.objectProperties,
            onChange: updateEffectiveSchemaNode,
          }
        : undefined,
    arrayItems:
      access.arrayItems && effectiveSchemaNode.type === "array"
        ? {
            itemDetails: createPropertySchemaDetails({
              schemaNode: getArrayItemsForDraft(schemaNode),
              schemaContext,
              mode,
              access,
              disabled,
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
