"use client"

import { Label } from "@/components/ui-retab/label"
import { NameField } from "@/components/schema-editor/property-form/fields/name-field"
import { NullableField } from "@/components/schema-editor/property-form/fields/nullable-field"
import { TypeField } from "@/components/schema-editor/property-form/fields/type-field"
import { EnumValuesField } from "@/components/schema-editor/property-form/fields/enum-values-field"
import { ObjectPropertiesField } from "@/components/schema-editor/property-form/fields/object-properties-field"
import { ArrayItemsField } from "@/components/schema-editor/property-form/fields/array-items-field"
import { DescriptionField } from "@/components/schema-editor/property-form/fields/description-field"
import { PropertyFormFooter } from "@/components/schema-editor/property-form/property-form-footer"
import type { PropertyFormViewModel } from "@/components/schema-editor/property-form/types"

export function PropertyFormShell({
  viewModel,
}: {
  viewModel: PropertyFormViewModel
}) {
  const { fields, footer, capabilities, events } = viewModel
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
            </div>

            {fields.objectFields && (
              <ObjectPropertiesField
                name={fields.objectFields.name}
                schemaNode={fields.objectFields.schemaNode}
                onChange={fields.objectFields.onChange}
                schemaContext={fields.objectFields.schemaContext}
              />
            )}
            {fields.enumValues && (
              <EnumValuesField
                values={fields.enumValues.values}
                disabled={fields.enumValues.disabled}
                onChange={fields.enumValues.onChange}
              />
            )}
            {fields.arrayItems && (
              <ArrayItemsField
                schemaNode={fields.arrayItems.schemaNode}
                onChange={fields.arrayItems.onChange}
                schemaContext={fields.arrayItems.schemaContext}
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
            isSubmitting={false}
            isSubmitDisabled={footer.isSubmitDisabled}
            submitLabel={footer.submitLabel}
            onCancel={footer.onCancel}
            onDelete={footer.onDelete}
          />
        )}
    </form>
  )
}
