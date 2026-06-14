"use client"

import { updateEffectiveNode } from "@/components/schema-editor/draft/draft-node-edits"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"
import { createPropertyTypeFieldWithObjectTemplates } from "@/components/schema-editor/property-form/fields/property-object-template-type-field"
import { getArrayItemsForDraft } from "@/components/schema-editor/property-form/model/effective-node-edits"
import type {
  PropertyFormMode,
  PropertyFormSchemaContext,
  PropertySchemaPlanAccess,
  PropertySchemaPlan,
  PropertySchemaPlanItem,
} from "@/components/schema-editor/property-form/types"

interface CreatePropertySchemaPlanInput {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  mode: PropertyFormMode
  access: PropertySchemaPlanAccess
  editable: boolean
  showTypeSelector?: boolean
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}

export function createPropertySchemaPlan({
  schemaNode,
  schemaContext,
  mode,
  access,
  editable,
  showTypeSelector = true,
  onChange,
}: CreatePropertySchemaPlanInput): PropertySchemaPlan {
  const effectiveSchemaNode = getEffectiveNode(schemaNode)
  const resetKey =
    schemaContext.resetKey ?? schemaContext.fieldPath ?? schemaContext.originalName
  const items: PropertySchemaPlanItem[] = []

  const updateEffectiveSchemaNode = (nextSchemaNode: ExtendedJSONSchema7) => {
    onChange(updateEffectiveNode(schemaNode, nextSchemaNode))
  }

  if (showTypeSelector) {
    items.push({
      kind: "type",
      field: createPropertyTypeFieldWithObjectTemplates({
        schemaNode,
        schemaContext,
        editable: editable && access.type,
        onChange,
      }),
    })
  }

  if (access.enumValues && Array.isArray(effectiveSchemaNode.enum)) {
    items.push({
      kind: "enumValues",
      field: {
        values: effectiveSchemaNode.enum,
        resetKey,
        disabled: !editable || !access.enumValues,
        onChange: (values) => {
          updateEffectiveSchemaNode({
            ...effectiveSchemaNode,
            enum: values,
          })
        },
      },
    })
  }

  if (
    access.objectProperties &&
    effectiveSchemaNode.type === "object" &&
    !effectiveSchemaNode.$ref
  ) {
    items.push({
      kind: "objectProperties",
      plan: {
        schemaNode: effectiveSchemaNode,
        schemaContext,
        mode,
        access,
        editable: editable && access.objectProperties,
        onChange: updateEffectiveSchemaNode,
      },
    })
  }

  if (access.arrayItems && effectiveSchemaNode.type === "array") {
    items.push({
      kind: "arrayItems",
      itemSchemaPlan: createPropertySchemaPlan({
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
    })
  }

  return { items }
}
