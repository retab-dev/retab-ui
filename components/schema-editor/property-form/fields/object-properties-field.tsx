"use client"

import { SchemaAddRow } from "@/components/schema-editor/primitives/schema-add-row"
import type { PropertyObjectPropertiesFieldModel } from "@/components/schema-editor/property-form/types"

import { ObjectPropertyRows } from "./object-property-row"

export function ObjectPropertiesField({
  details,
}: {
  details: PropertyObjectPropertiesFieldModel
}) {
  return (
    <>
      <ObjectPropertyRows details={details} />

      <SchemaAddRow
        {...details.addRow}
        className="ml-4 border-l border-border pl-4"
        disabled={!details.editable}
      />
    </>
  )
}
