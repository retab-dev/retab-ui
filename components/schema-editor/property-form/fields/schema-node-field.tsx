"use client"

import { updateEffectiveNode } from "@/components/schema-editor/draft/draft-node-edits"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"
import { getArrayItemsForDraft } from "@/components/schema-editor/property-form/model/effective-node-edits"
import type {
  PropertyFormMode,
  PropertyFormSchemaContext,
} from "@/components/schema-editor/property-form/types"

import { ArrayItemsField } from "./array-items-field"
import { EnumValuesField } from "./enum-values-field"
import { ObjectPropertiesField } from "./object-properties-field"
import { TypeField } from "./type-field"

export function SchemaNodeField({
  name,
  schemaNode,
  schemaContext,
  mode,
  disabled,
  showTypeSelector = true,
  onChange,
}: {
  name: string
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  mode: PropertyFormMode
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
          name={name}
          schemaNode={schemaNode}
          schemaContext={schemaContext}
          mode={mode}
          disabled={disabled}
          onChange={onChange}
        />
      )}
      {Array.isArray(effectiveSchemaNode.enum) && (
        <EnumValuesField
          values={effectiveSchemaNode.enum}
          disabled={disabled}
          onChange={(values) => {
            updateEffectiveSchemaNode({ ...effectiveSchemaNode, enum: values })
          }}
        />
      )}
      {effectiveSchemaNode.type === "object" && !effectiveSchemaNode.$ref && (
        <ObjectPropertiesField
          schemaNode={effectiveSchemaNode}
          schemaContext={schemaContext}
          disabled={disabled}
          onChange={updateEffectiveSchemaNode}
          renderPropertyEditor={({
            propertyName,
            propertySchema,
            propertySchemaContext,
            onPropertySchemaChange,
          }) => (
            <SchemaNodeField
              name={propertyName}
              schemaNode={propertySchema}
              schemaContext={propertySchemaContext}
              mode={mode}
              disabled={disabled}
              onChange={onPropertySchemaChange}
            />
          )}
        />
      )}
      {effectiveSchemaNode.type === "array" && (
        <ArrayItemsField>
          <SchemaNodeField
            name="items"
            schemaNode={getArrayItemsForDraft(schemaNode)}
            schemaContext={schemaContext}
            mode={mode}
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
