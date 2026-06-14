"use client"

import type { PropertySchemaDetailsModel } from "@/components/schema-editor/property-form/types"

import { PropertySchemaDetailsField } from "./property-schema-details-field"

export function renderPropertySchemaDetails(
  schemaDetails: PropertySchemaDetailsModel
) {
  return <PropertySchemaDetailsField details={schemaDetails} />
}
