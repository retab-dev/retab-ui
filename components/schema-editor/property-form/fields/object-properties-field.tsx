"use client"

import { SchemaAddRow } from "@/components/schema-editor/primitives/schema-add-row"
import type {
  PropertyObjectPropertiesFieldModel,
  PropertySchemaDetailsModel,
} from "@/components/schema-editor/property-form/types"

import { useObjectPropertiesModel } from "./object-properties-model"
import { ObjectPropertyRows } from "./object-property-row"

export function ObjectPropertiesField({
  details,
  renderSchemaDetails,
}: {
  details: PropertyObjectPropertiesFieldModel
  renderSchemaDetails: (details: PropertySchemaDetailsModel) => React.ReactNode
}) {
  const { access, editable, mode, onChange, schemaContext, schemaNode } =
    details
  const model = useObjectPropertiesModel({
    access,
    editable,
    mode,
    schemaNode,
    schemaContext,
    onChange,
  })

  return (
    <>
      <ObjectPropertyRows
        model={model}
        renderSchemaDetails={renderSchemaDetails}
      />

      <SchemaAddRow
        className="ml-4 border-l border-border pl-4"
        disabled={!model.editable}
        error={model.addRow.error}
        inputLabel="New object field"
        placeholder="New property name"
        submitLabel="Add"
        value={model.addRow.value}
        onChange={model.addRow.onChange}
        onSubmit={model.addRow.onSubmit}
      />
    </>
  )
}
