"use client"

import * as React from "react"

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { SchemaAddRow } from "@/components/schema-editor/primitives/schema-add-row"
import { SchemaFieldRow } from "@/components/schema-editor/primitives/schema-field-row"
import { SchemaInlineDescription } from "@/components/schema-editor/primitives/schema-inline-description"
import { SchemaInlineName } from "@/components/schema-editor/primitives/schema-inline-name"
import { SchemaRowActions } from "@/components/schema-editor/primitives/schema-row-actions"
import type {
  PropertyFormMode,
  PropertyFormSchemaContext,
} from "@/components/schema-editor/property-form/types"

import { useObjectPropertiesModel } from "./object-properties-model"
import { TypeField } from "./type-field"

export function ObjectPropertiesField({
  schemaNode,
  schemaContext,
  mode,
  canEditPropertyType,
  disabled,
  onChange,
  renderPropertyEditor,
}: {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  mode: PropertyFormMode
  canEditPropertyType: boolean
  disabled: boolean
  onChange: (schemaNode: ExtendedJSONSchema7) => void
  renderPropertyEditor: (props: {
    propertyName: string
    propertySchema: ExtendedJSONSchema7
    propertySchemaContext: PropertyFormSchemaContext
    onPropertySchemaChange: (schemaNode: ExtendedJSONSchema7) => void
    showTypeSelector: boolean
  }) => React.ReactNode
}) {
  const model = useObjectPropertiesModel({
    schemaNode,
    schemaContext,
    onChange,
  })

  return (
    <div className="space-y-2 pl-2">
      {model.rows.map((row) => (
        <div key={row.id} className="ml-4 border-l border-border">
          <SchemaFieldRow
            grip={disabled ? "empty" : "static"}
            name={
              <SchemaInlineName
                ariaLabel={`Field name ${row.name}`}
                value={row.name}
                editable={!disabled}
                validate={row.validation.name}
                onCommit={row.actions.rename}
              />
            }
            description={
              <SchemaInlineDescription
                ariaLabel={`Description for ${row.name}`}
                value={row.schemaNode.description || ""}
                editable={!disabled}
                onCommit={(description) => {
                  row.actions.replaceSchemaNode({
                    ...row.schemaNode,
                    description: description || undefined,
                  })
                }}
              />
            }
            actions={
              <SchemaRowActions
                canDelete={true}
                editable={!disabled}
                deleteLabel={`Remove field ${row.name}`}
                onDelete={row.actions.remove}
              />
            }
            type={
              <TypeField
                schemaNode={row.schemaNode}
                schemaContext={row.schemaContext}
                fieldPath={row.schemaContext.fieldPath}
                mode={disabled || !canEditPropertyType ? "readOnly" : mode}
                disabled={disabled || !canEditPropertyType}
                variant="compact"
                onChange={row.actions.replaceSchemaNode}
              />
            }
          />
          {renderPropertyEditor({
            propertyName: row.name,
            propertySchema: row.schemaNode,
            propertySchemaContext: row.schemaContext,
            onPropertySchemaChange: row.actions.replaceSchemaNode,
            showTypeSelector: false,
          })}
        </div>
      ))}

      <SchemaAddRow
        className="ml-4 border-l border-border pl-4"
        disabled={disabled}
        error={model.addRow.error}
        inputLabel="New object field"
        placeholder="New property name"
        submitLabel="Add"
        value={model.addRow.value}
        onChange={model.addRow.onChange}
        onSubmit={model.addRow.onSubmit}
      />
    </div>
  )
}
