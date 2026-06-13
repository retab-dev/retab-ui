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
  PropertySchemaDetailsCapabilities,
  PropertySchemaDetailsModel,
} from "@/components/schema-editor/property-form/types"

import { useObjectPropertiesModel } from "./object-properties-model"
import { TypeField } from "./type-field"

export function ObjectPropertiesField({
  schemaNode,
  schemaContext,
  mode,
  capabilities,
  editable,
  onChange,
  renderPropertyDetails,
}: {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  mode: PropertyFormMode
  capabilities: PropertySchemaDetailsCapabilities
  editable: boolean
  onChange: (schemaNode: ExtendedJSONSchema7) => void
  renderPropertyDetails: (details: PropertySchemaDetailsModel) => React.ReactNode
}) {
  const model = useObjectPropertiesModel({
    capabilities,
    editable,
    mode,
    schemaNode,
    schemaContext,
    onChange,
  })

  return (
    <div className="space-y-2 pl-2">
      {model.rows.map((row) => (
        <div key={row.id} className="ml-4 border-l border-border">
          <SchemaFieldRow
            grip={editable ? "static" : "empty"}
            name={
              <SchemaInlineName
                ariaLabel={`Field name ${row.name}`}
                value={row.name}
                editable={editable}
                validate={row.validation.name}
                onCommit={row.actions.rename}
              />
            }
            description={
              <SchemaInlineDescription
                ariaLabel={`Description for ${row.name}`}
                value={row.schemaNode.description || ""}
                editable={editable}
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
                editable={editable}
                deleteLabel={`Remove field ${row.name}`}
                onDelete={row.actions.remove}
              />
            }
            type={
              <TypeField
                schemaNode={row.schemaNode}
                schemaContext={row.schemaContext}
                fieldPath={row.schemaContext.fieldPath}
                editable={row.type.editable}
                variant="row"
                onChange={row.type.onChange}
              />
            }
          />
          {renderPropertyDetails(row.details)}
        </div>
      ))}

      <SchemaAddRow
        className="ml-4 border-l border-border pl-4"
        disabled={!editable}
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
