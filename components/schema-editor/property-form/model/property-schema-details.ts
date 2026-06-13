"use client"

import { updateEffectiveNode } from "@/components/schema-editor/draft/draft-node-edits"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"
import { getArrayItemsForDraft } from "@/components/schema-editor/property-form/model/effective-node-edits"
import type {
  PropertyCapabilities,
  PropertyFormMode,
  PropertyFormSchemaContext,
  PropertySchemaDetailsModel,
} from "@/components/schema-editor/property-form/types"

interface CreatePropertySchemaDetailsInput {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  mode: PropertyFormMode
  capabilities: Pick<
    PropertyCapabilities,
    | "canEditType"
    | "canEditNestedObject"
    | "canEditArrayItems"
    | "canEditEnumValues"
  >
  disabled: boolean
  showTypeSelector?: boolean
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}

export function createPropertySchemaDetails({
  schemaNode,
  schemaContext,
  mode,
  capabilities,
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
          mode,
          disabled: disabled || !capabilities.canEditType,
          onChange,
        }
      : undefined,
    enumValues:
      capabilities.canEditEnumValues && Array.isArray(effectiveSchemaNode.enum)
        ? {
            values: effectiveSchemaNode.enum,
            resetKey,
            disabled: disabled || !capabilities.canEditEnumValues,
            onChange: (values) => {
              updateEffectiveSchemaNode({
                ...effectiveSchemaNode,
                enum: values,
              })
            },
          }
        : undefined,
    objectProperties:
      capabilities.canEditNestedObject &&
      effectiveSchemaNode.type === "object" &&
      !effectiveSchemaNode.$ref
        ? {
            schemaNode: effectiveSchemaNode,
            schemaContext,
            mode,
            canEditPropertyType: capabilities.canEditType,
            capabilities,
            disabled: disabled || !capabilities.canEditNestedObject,
            onChange: updateEffectiveSchemaNode,
          }
        : undefined,
    arrayItems:
      capabilities.canEditArrayItems && effectiveSchemaNode.type === "array"
        ? {
            itemDetails: createPropertySchemaDetails({
              schemaNode: getArrayItemsForDraft(schemaNode),
              schemaContext,
              mode,
              capabilities,
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
