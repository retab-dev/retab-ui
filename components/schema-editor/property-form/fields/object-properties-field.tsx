"use client"

import type * as React from "react"

import { SchemaAddRow } from "@/components/schema-editor/primitives/schema-add-row"
import type { PropertyObjectPropertiesFieldModel } from "@/components/schema-editor/property-form/model/object-properties-view"
import type { PropertySchemaPlan } from "@/components/schema-editor/property-form/types"

import { ObjectPropertyRows } from "./object-property-row"

export function ObjectPropertiesField({
  model,
  renderPlan,
}: {
  model: PropertyObjectPropertiesFieldModel
  renderPlan: (plan: PropertySchemaPlan) => React.ReactNode
}) {
  return (
    <>
      <ObjectPropertyRows
        model={model}
        renderPlan={renderPlan}
      />

      <SchemaAddRow
        {...model.addInput}
        className="ml-4 border-l border-border pl-4"
        disabled={!model.editable}
      />
    </>
  )
}
