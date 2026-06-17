import type * as React from "react"

import type { JsonFormTextInput } from "@/components/json-form/scalar-control"
import type { Schema } from "@/components/json-form/schema-model"

export interface JsonFormFieldRenderProps {
  name: string
  sourcePath?: string
  schema: Schema
  required?: boolean
  label?: string
  textInput?: JsonFormTextInput
  className?: string
  depth?: number
}

export type RenderJsonFormField = (
  props: JsonFormFieldRenderProps
) => React.ReactNode
