import type * as React from "react"
import type { ErrorObject } from "ajv"

import type { SchemaDocument } from "@/components/schema-editor/document/types"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"

export type { ExtendedJSONSchema7 }

export type SchemaBuilderView = "fields" | "json"

export interface SchemaBuilderFeatures {
  definitions?: boolean
  objectTemplates?: boolean
  jsonMode?: boolean
  importExport?: boolean
}

export interface ResolvedSchemaBuilderFeatures {
  definitions: boolean
  objectTemplates: boolean
  jsonMode: boolean
  importExport: boolean
}

export interface SchemaBuilderProps {
  /** The JSON Schema being edited (controlled). */
  value: ExtendedJSONSchema7
  /** Called with the next valid schema whenever the user commits an edit. */
  onValueChange: (schema: ExtendedJSONSchema7) => void
  className?: string
  readOnly?: boolean
  view?: SchemaBuilderView
  onViewChange?: (view: SchemaBuilderView) => void
  features?: SchemaBuilderFeatures
}

export interface SchemaValidationResult {
  isValid: boolean
  errors: SchemaValidationIssue[]
  propertyCount: number
  isPropertyLimitExceeded: boolean
}

export interface SchemaValidationIssue {
  code:
    | "invalid_schema"
    | "numeric_property_name"
    | "additional_properties_not_false"
    | "property_limit_exceeded"
  path: string
  message: string
  source?: ErrorObject
}

export type SchemaDispatch = (
  op: (doc: SchemaDocument) => SchemaDocument,
  persist?: boolean
) => void

export interface SchemaBuilderState {
  doc: SchemaDocument
  schema: ExtendedJSONSchema7
  validation: SchemaValidationResult
  dispatch: SchemaDispatch
  replaceSchema: (
    value: React.SetStateAction<ExtendedJSONSchema7>,
    persist?: boolean
  ) => Promise<void>
}

export function resolveSchemaBuilderFeatures(
  features?: SchemaBuilderFeatures
): ResolvedSchemaBuilderFeatures {
  return {
    definitions: features?.definitions ?? true,
    objectTemplates: features?.objectTemplates ?? false,
    jsonMode: features?.jsonMode ?? false,
    importExport: features?.importExport ?? false,
  }
}
