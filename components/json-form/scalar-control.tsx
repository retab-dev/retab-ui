"use client"

import * as React from "react"

import {
  BooleanControl,
  NullableBooleanControl,
} from "@/components/json-form/scalar/boolean-control"
import {
  DateTimeControl,
  datetimeLocalInputValue,
} from "@/components/json-form/scalar/date-time-control"
import {
  EnumControl,
  enumLabel,
  enumValueEquals,
} from "@/components/json-form/scalar/enum-control"
import {
  dataCellNumberValue,
  NumberControl,
} from "@/components/json-form/scalar/number-control"
import {
  dataCellTextValue,
  TextControl,
} from "@/components/json-form/scalar/text-control"
import type {
  ControlFieldApi,
  JsonFormTextInput,
  ScalarControlDomProps,
} from "@/components/json-form/scalar/types"
import type { FieldKind, Schema } from "@/components/json-form/schema-model"

export type {
  ControlFieldApi,
  JsonFormTextInput,
  ScalarControlDomProps,
} from "@/components/json-form/scalar/types"
export {
  BooleanControl,
  dataCellNumberValue,
  dataCellTextValue,
  datetimeLocalInputValue,
  enumLabel,
  enumValueEquals,
  NullableBooleanControl,
}

export function ScalarControl({
  kind,
  schema,
  field,
  textInput,
  compact = false,
  nullable = false,
  ...controlProps
}: {
  kind: FieldKind
  schema: Schema
  field: ControlFieldApi
  textInput?: JsonFormTextInput
  /** Dense, single-line variant for table cells. */
  compact?: boolean
  nullable?: boolean
} & ScalarControlDomProps) {
  if (kind === "enum") {
    return (
      <EnumControl
        {...controlProps}
        schema={schema}
        field={field}
        compact={compact}
        nullable={nullable}
      />
    )
  }

  if (kind === "number" || kind === "integer") {
    return (
      <NumberControl
        {...controlProps}
        kind={kind}
        field={field}
        compact={compact}
        nullable={nullable}
      />
    )
  }

  if (
    schema.format === "date" ||
    schema.format === "time" ||
    schema.format === "date-time"
  ) {
    return (
      <DateTimeControl
        {...controlProps}
        kind={schema.format}
        field={field}
        compact={compact}
        nullable={nullable}
      />
    )
  }

  return (
    <TextControl
      {...controlProps}
      schema={schema}
      field={field}
      textInput={textInput}
      compact={compact}
      nullable={nullable}
    />
  )
}
