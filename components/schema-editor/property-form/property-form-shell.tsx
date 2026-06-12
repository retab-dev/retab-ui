"use client"

import { AlertCircle } from "lucide-react"

import { DescriptionField } from "@/components/schema-editor/property-form/fields/description-field"
import { NameField } from "@/components/schema-editor/property-form/fields/name-field"
import { NullableField } from "@/components/schema-editor/property-form/fields/nullable-field"
import { SchemaNodeField } from "@/components/schema-editor/property-form/fields/schema-node-field"
import { TypeField } from "@/components/schema-editor/property-form/fields/type-field"
import { PropertyFormFooter } from "@/components/schema-editor/property-form/property-form-footer"
import type { PropertyFormViewModel } from "@/components/schema-editor/property-form/types"
import { Label } from "@/components/ui-retab/label"

export function PropertyFormShell({
  viewModel,
}: {
  viewModel: PropertyFormViewModel
}) {
  const { fields, footer, capabilities, events, validation } = viewModel
  const isReadOnly = capabilities.mode === "readOnly"

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void events.submit()
      }}
      onKeyDown={events.keyDown}
      className="flex h-full flex-col"
    >
      <div className="max-h-[60vh] flex-1 overflow-y-auto">
        <div className="space-y-4 border-b border-border p-4">
          <NameField {...fields.name} />

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label htmlFor="type">Data type</Label>
              <NullableField
                checked={fields.nullable.isNullable}
                disabled={fields.nullable.disabled}
                onChange={fields.nullable.onChange}
              />
            </div>
            <TypeField
              name={fields.type.name}
              mode={fields.type.mode}
              disabled={fields.type.disabled}
              schemaNode={fields.type.schemaNode}
              onChange={fields.type.onChange}
              schemaContext={fields.type.schemaContext}
              fieldPath={fields.type.schemaContext.fieldPath}
            />
            {validation.schemaNode.message && (
              <p className="mt-2 flex items-center gap-1 text-sm font-medium text-destructive">
                <AlertCircle className="h-3 w-3" />
                {validation.schemaNode.message}
              </p>
            )}
          </div>

          {fields.schemaNodeDetails && (
            <SchemaNodeField
              name={fields.schemaNodeDetails.name}
              schemaNode={fields.schemaNodeDetails.schemaNode}
              schemaContext={fields.schemaNodeDetails.schemaContext}
              mode={fields.schemaNodeDetails.mode}
              disabled={fields.schemaNodeDetails.disabled}
              showTypeSelector={false}
              onChange={fields.schemaNodeDetails.onChange}
            />
          )}
        </div>
        <div className="space-y-4 p-4">
          <DescriptionField {...fields.description} />
        </div>
      </div>

      {!isReadOnly && (
        <PropertyFormFooter
          canDelete={footer.canDelete}
          isSubmitting={footer.isSubmitting}
          isSubmitDisabled={footer.isSubmitDisabled}
          submitLabel={footer.submitLabel}
          onCancel={footer.onCancel}
          onDelete={footer.onDelete}
        />
      )}
    </form>
  )
}
