"use client"

import { updateEffectiveNode } from "@/components/schema-editor/draft/draft-node-edits"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"
import { getArrayItemsForDraft } from "@/components/schema-editor/property-form/model/effective-node-edits"
import type {
  PropertyCapabilities,
  PropertyFormMode,
  PropertyFormSchemaContext,
} from "@/components/schema-editor/property-form/types"

import { ArrayItemsField } from "./array-items-field"
import { EnumValuesField } from "./enum-values-field"
import { ObjectPropertiesField } from "./object-properties-field"
import { TypeField } from "./type-field"

export function SchemaNodeField({
  schemaNode,
  schemaContext,
  mode,
  capabilities,
  disabled,
  showTypeSelector = true,
  onChange,
}: {
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
}) {
  const effectiveSchemaNode = getEffectiveNode(schemaNode)
  const updateEffectiveSchemaNode = (nextSchemaNode: ExtendedJSONSchema7) => {
    onChange(updateEffectiveNode(schemaNode, nextSchemaNode))
  }

  return (
    <div className="space-y-3">
      {showTypeSelector && (
        <TypeField
          schemaNode={schemaNode}
          schemaContext={schemaContext}
          mode={mode}
          disabled={disabled || !capabilities.canEditType}
          onChange={onChange}
        />
      )}
      {capabilities.canEditEnumValues &&
        Array.isArray(effectiveSchemaNode.enum) && (
          <EnumValuesField
            values={effectiveSchemaNode.enum}
            resetKey={
              schemaContext.resetKey ??
              schemaContext.fieldPath ??
              schemaContext.originalName
            }
            disabled={disabled || !capabilities.canEditEnumValues}
            onChange={(values) => {
              updateEffectiveSchemaNode({
                ...effectiveSchemaNode,
                enum: values,
              })
            }}
          />
        )}
      {capabilities.canEditNestedObject &&
        effectiveSchemaNode.type === "object" &&
        !effectiveSchemaNode.$ref && (
          <ObjectPropertiesField
            schemaNode={effectiveSchemaNode}
            schemaContext={schemaContext}
            disabled={disabled || !capabilities.canEditNestedObject}
            onChange={updateEffectiveSchemaNode}
            renderPropertyEditor={({
              propertySchema,
              propertySchemaContext,
              onPropertySchemaChange,
            }) => (
              <SchemaNodeField
                schemaNode={propertySchema}
                schemaContext={propertySchemaContext}
                mode={mode}
                capabilities={capabilities}
                disabled={disabled}
                onChange={onPropertySchemaChange}
              />
            )}
          />
        )}
      {capabilities.canEditArrayItems &&
        effectiveSchemaNode.type === "array" && (
          <ArrayItemsField>
            <SchemaNodeField
              schemaNode={getArrayItemsForDraft(schemaNode)}
              schemaContext={schemaContext}
              mode={mode}
              capabilities={capabilities}
              disabled={disabled}
              onChange={(items) => {
                updateEffectiveSchemaNode({ ...effectiveSchemaNode, items })
              }}
            />
          </ArrayItemsField>
        )}
    </div>
  )
}
