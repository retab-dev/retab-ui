"use client"

import * as React from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  compactJsonFormSelectDataCellClass,
  type ControlFieldApi,
  type ScalarControlDomProps,
} from "@/components/json-form/scalar/types"
import { isRecordValue, type Schema } from "@/components/json-form/schema-model"

export const NULL_SELECT_VALUE = "__json-form-null__"

function enumOptionValue(index: number): string {
  return `enum:${index}`
}

export function enumLabel(value: unknown): string {
  if (value === null) return "No value"
  if (typeof value === "string") return value
  return JSON.stringify(value)
}

function hasOwnRecordValue(
  value: Record<string, unknown>,
  key: string
): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

export function enumValueEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false
    }
    return a.every((item, index) => enumValueEquals(item, b[index]))
  }
  if (!isRecordValue(a) || !isRecordValue(b)) {
    return false
  }

  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every(
    (key) => hasOwnRecordValue(b, key) && enumValueEquals(a[key], b[key])
  )
}

export function EnumControl({
  schema,
  field,
  compact,
  nullable,
  ...controlProps
}: {
  schema: Schema
  field: ControlFieldApi
  compact: boolean
  nullable: boolean
} & ScalarControlDomProps) {
  const enumValues = schema.enum ?? []
  const hasNullEnumValue = enumValues.some((value) => value === null)
  const currentIndex = enumValues.findIndex((value) =>
    enumValueEquals(value, field.value)
  )
  const selectValue =
    currentIndex >= 0
      ? enumOptionValue(currentIndex)
      : field.value === null && nullable
        ? NULL_SELECT_VALUE
        : undefined
  const displayValue =
    currentIndex >= 0
      ? enumLabel(enumValues[currentIndex])
      : field.value === null && nullable
        ? "No value"
        : undefined

  return (
    <Select
      value={selectValue}
      onValueChange={(value) => {
        if (typeof value !== "string") return
        if (value === NULL_SELECT_VALUE) {
          field.onChange(null)
          return
        }
        const index = Number(value.replace("enum:", ""))
        field.onChange(enumValues[index])
      }}
    >
      <SelectTrigger
        {...controlProps}
        {...(compact
          ? {
              "data-slot": "data-cell",
              "data-kind": "text",
              "data-mode": "edit",
            }
          : {})}
        className={compact ? compactJsonFormSelectDataCellClass : undefined}
      >
        <SelectValue placeholder="Select...">{displayValue}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {nullable && !hasNullEnumValue ? (
          <SelectItem value={NULL_SELECT_VALUE}>No value</SelectItem>
        ) : null}
        {enumValues.map((option, index) => (
          <SelectItem
            key={enumOptionValue(index)}
            value={enumOptionValue(index)}
          >
            {enumLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
