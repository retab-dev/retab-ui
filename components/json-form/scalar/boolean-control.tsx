"use client"

import * as React from "react"

import { Checkbox } from "@/components/json-form/form-primitives"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NULL_SELECT_VALUE } from "@/components/json-form/scalar/constants"
import type {
  ControlFieldApi,
  ScalarControlDomProps,
} from "@/components/json-form/scalar/types"

export function BooleanControl({
  field,
  label,
}: {
  field: ControlFieldApi
  label: string
}) {
  return (
    <Checkbox
      checked={Boolean(field.value)}
      aria-label={label}
      onCheckedChange={(value) => field.onChange(value === true)}
      onBlur={field.onBlur}
    />
  )
}

export function NullableBooleanControl({
  field,
  label,
  ...controlProps
}: {
  field: ControlFieldApi
  label: string
} & ScalarControlDomProps) {
  const selectValue =
    field.value === true
      ? "true"
      : field.value === false
        ? "false"
        : NULL_SELECT_VALUE
  const displayValue =
    field.value === true ? "True" : field.value === false ? "False" : "No value"

  return (
    <Select
      value={selectValue}
      onValueChange={(value) => {
        if (value === "true") {
          field.onChange(true)
          return
        }
        if (value === "false") {
          field.onChange(false)
          return
        }
        field.onChange(null)
      }}
    >
      <SelectTrigger {...controlProps} aria-label={label}>
        <SelectValue placeholder="Select...">{displayValue}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NULL_SELECT_VALUE}>No value</SelectItem>
        <SelectItem value="true">True</SelectItem>
        <SelectItem value="false">False</SelectItem>
      </SelectContent>
    </Select>
  )
}
