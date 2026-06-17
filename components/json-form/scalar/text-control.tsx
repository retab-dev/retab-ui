"use client"

import { DataCell } from "@/components/ui/data-cell"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/json-form/form-primitives"
import {
  compactJsonFormDataCellClass,
  type ControlFieldApi,
  type JsonFormTextInput,
  type ScalarControlDomProps,
} from "@/components/json-form/scalar/types"
import type { Schema } from "@/components/json-form/schema-model"

export function TextControl({
  schema,
  field,
  textInput,
  compact,
  nullable,
  ...controlProps
}: {
  schema: Schema
  field: ControlFieldApi
  textInput?: JsonFormTextInput
  compact: boolean
  nullable: boolean
} & ScalarControlDomProps) {
  const value = field.value == null ? "" : String(field.value)

  if (!compact && shouldRenderTextarea(schema, textInput)) {
    return (
      <Textarea
        {...controlProps}
        value={value}
        onChange={(event) =>
          field.onChange(
            event.target.value === "" && nullable ? null : event.target.value
          )
        }
        onBlur={field.onBlur}
        name={field.name}
      />
    )
  }

  if (!compact) {
    return (
      <Input
        {...controlProps}
        value={value}
        onChange={(event) => {
          const nextValue = event.currentTarget.value
          field.onChange(nextValue === "" && nullable ? null : nextValue)
        }}
        onBlur={field.onBlur}
        name={field.name}
      />
    )
  }

  return (
    <DataCell
      {...controlProps}
      kind="text"
      active
      value={field.value == null ? null : value}
      draftValue={value}
      className={compactJsonFormDataCellClass}
      onDraftValueChange={(nextValue) =>
        field.onChange(nextValue === "" && nullable ? null : nextValue)
      }
      onCommit={(nextValue) =>
        field.onChange(nextValue === "" && nullable ? null : nextValue)
      }
      onBlur={field.onBlur}
      name={field.name}
    />
  )
}

function shouldRenderTextarea(
  schema: Schema,
  textInput: JsonFormTextInput | undefined
): boolean {
  if (textInput === "input") return false
  if (textInput === "textarea") return true
  return schema.format === "textarea" || (schema.maxLength ?? 0) > 120
}

export function dataCellTextValue(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}
