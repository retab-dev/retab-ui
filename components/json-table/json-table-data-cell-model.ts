import type * as React from "react"
import { format } from "date-fns"

import {
  formatDataCellDisplayValue,
  type DataCellCommitValue,
  type DataCellKind,
  type DataCellSelectOption,
  type DataCellValue,
} from "@/components/ui/data-cell"
import {
  jsonTableDataCellClass,
  jsonTableSelectDataCellClass,
} from "@/components/json-table/json-table-data-cell"
import { dateStringToFormat } from "@/components/json-table/lib/date-display-formatting"
import { parseDateStringAsLocal } from "@/components/json-table/lib/date-parsing"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

export type JsonTableDataCellModel = {
  className: string
  formatValue?: (
    value: DataCellValue,
    meta: { kind: DataCellKind }
  ) => React.ReactNode
  kind: DataCellKind
  placeholder?: string
  selectOptions?: DataCellSelectOption[]
  showPickerIcon?: boolean
  value: DataCellValue
  commitValue: (value: DataCellCommitValue) => unknown
}

export function formatJsonTableNestedValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length} items]`
  if (value === null || value === undefined) return ""
  if (typeof value !== "object") return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function dataCellKindForField(
  fieldMetadata: FieldMetadata
): DataCellKind | null {
  switch (fieldMetadata.kind) {
    case "enum":
      return "select"
    case "string":
    case "unknown":
      return "text"
    case "number":
    case "integer":
    case "boolean":
    case "date":
    case "date-time":
    case "time":
      return fieldMetadata.kind
    default:
      return null
  }
}

export function getJsonTableCellDisplayValue({
  fieldMetadata,
  value,
}: {
  fieldMetadata: FieldMetadata
  value: unknown
}): string {
  const dataCellKind = dataCellKindForField(fieldMetadata)

  if (dataCellKind === "number" || dataCellKind === "integer") {
    return formatDataCellDisplayValue(dataCellKind, numberDataCellValue(value))
  }

  if (dataCellKind === "boolean") {
    return typeof value === "boolean" ? String(value) : ""
  }

  if (dataCellKind) {
    if (fieldMetadata.kind === "date") return dateDisplayValue(value)
    return formatDataCellDisplayValue(dataCellKind, textDataCellValue(value))
  }

  return formatJsonTableNestedValue(value)
}

export function createJsonTableDataCellModel({
  fieldMetadata,
  value,
}: {
  fieldMetadata: FieldMetadata
  value: unknown
}): JsonTableDataCellModel {
  const dataCellKind = dataCellKindForField(fieldMetadata)

  if (dataCellKind === "select") {
    return {
      className: jsonTableSelectDataCellClass,
      formatValue:
        fieldMetadata.kind === "enum"
          ? () => enumDisplayValue(value, fieldMetadata.isNullable)
          : undefined,
      kind: "select",
      placeholder: "Select...",
      selectOptions: enumDataCellOptions(fieldMetadata),
      value:
        fieldMetadata.kind === "enum"
          ? enumDataCellValue(value, fieldMetadata.enumValues)
          : textDataCellValue(value),
      commitValue: (nextValue) =>
        typeof nextValue === "string"
          ? enumCommitValue(nextValue, fieldMetadata)
          : nextValue,
    }
  }

  if (dataCellKind === "number" || dataCellKind === "integer") {
    return {
      className: jsonTableDataCellClass,
      kind: dataCellKind,
      value: numberDataCellValue(value),
      commitValue: (nextValue) =>
        normalizeDataCellCommitValue(fieldMetadata, nextValue),
    }
  }

  if (dataCellKind === "boolean") {
    return {
      className: jsonTableDataCellClass,
      kind: "boolean",
      value: typeof value === "boolean" ? value : null,
      commitValue: (nextValue) =>
        normalizeDataCellCommitValue(fieldMetadata, nextValue),
    }
  }

  if (dataCellKind) {
    return {
      className: jsonTableDataCellClass,
      formatValue:
        fieldMetadata.kind === "date"
          ? (nextValue) => dateDisplayValue(nextValue)
          : undefined,
      kind: dataCellKind,
      showPickerIcon: false,
      value: textDataCellValue(value),
      commitValue: (nextValue) =>
        normalizeDataCellCommitValue(fieldMetadata, nextValue),
    }
  }

  return {
    className: jsonTableDataCellClass,
    kind: "text",
    value: formatJsonTableNestedValue(value),
    commitValue: (nextValue) =>
      normalizeDataCellCommitValue(fieldMetadata, nextValue),
  }
}

const JSON_TABLE_NULL_SELECT_VALUE = "__json_table_null__"

function enumOptionValue(index: number): string {
  return `option:${index}`
}

function areJsonValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (typeof left !== typeof right) return false
  if (left === null || right === null) return false
  if (typeof left !== "object" || typeof right !== "object") return false

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false
    return (
      left.length === right.length &&
      left.every((item, index) => areJsonValuesEqual(item, right[index]))
    )
  }

  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord)
  const rightKeys = Object.keys(rightRecord)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(rightRecord, key)
    ) &&
    leftKeys.every((key) =>
      areJsonValuesEqual(leftRecord[key], rightRecord[key])
    )
  )
}

function enumDataCellValue(value: unknown, enumValues: unknown[]): string {
  if (value === null || value === undefined) {
    return JSON_TABLE_NULL_SELECT_VALUE
  }
  const matchingIndex = enumValues.findIndex((enumValue) =>
    areJsonValuesEqual(enumValue, value)
  )
  return matchingIndex === -1 ? String(value) : enumOptionValue(matchingIndex)
}

function enumCommitValue(value: string, fieldMetadata: FieldMetadata): unknown {
  if (
    value === JSON_TABLE_NULL_SELECT_VALUE &&
    fieldMetadata.kind === "enum" &&
    fieldMetadata.isNullable
  ) {
    return null
  }
  if (!value.startsWith("option:")) return value
  const optionIndex = Number(value.slice("option:".length))
  return fieldMetadata.kind === "enum" &&
    Number.isInteger(optionIndex) &&
    optionIndex in fieldMetadata.enumValues
    ? fieldMetadata.enumValues[optionIndex]
    : value
}

function enumDisplayValue(value: unknown, isNullable: boolean): string {
  if (value === null || value === undefined) {
    return isNullable ? "No selection" : ""
  }
  return String(value)
}

function enumDataCellOptions(
  fieldMetadata: FieldMetadata
): DataCellSelectOption[] {
  if (fieldMetadata.kind !== "enum") return []

  const nullOption: DataCellSelectOption[] = fieldMetadata.isNullable
    ? [
        {
          value: JSON_TABLE_NULL_SELECT_VALUE,
          label: "No selection",
          className: "text-xs text-muted-foreground",
        },
      ]
    : []

  return [
    ...nullOption,
    ...fieldMetadata.enumValues
      .map((option, optionIndex) => ({ option, optionIndex }))
      .filter(
        ({ option }) =>
          option !== undefined &&
          option !== null &&
          !(typeof option === "string" && option === "")
      )
      .map(({ option, optionIndex }) => ({
        value: enumOptionValue(optionIndex),
        label: String(option),
        className: "text-xs",
      })),
  ]
}

function dataCellValue(value: unknown): DataCellValue {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value
  }
  return formatJsonTableNestedValue(value)
}

function numberDataCellValue(value: unknown): string | number | null {
  return typeof value === "number" || typeof value === "string" ? value : null
}

function textDataCellValue(value: unknown): string | null {
  return value === null || value === undefined
    ? null
    : String(dataCellValue(value))
}

function dateDisplayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return ""
  if (typeof value !== "string") return String(value)
  const date = parseDateStringAsLocal(value)
  return date ? format(date, "PP") : value
}

function normalizeDataCellCommitValue(
  fieldMetadata: FieldMetadata,
  value: DataCellCommitValue
): DataCellCommitValue {
  if (typeof value !== "string") return value

  if (fieldMetadata.kind === "date") {
    return dateStringToFormat(value, "2000-01-01") || null
  }

  if (fieldMetadata.kind === "time") {
    const valueWithSeconds =
      value && /^\d{1,2}:\d{2}$/.test(value) ? `${value}:00` : value
    return dateStringToFormat(valueWithSeconds, "00:00") || null
  }

  if (fieldMetadata.kind === "date-time") {
    return dateStringToFormat(value, "2000-01-01T00:00:00") || null
  }

  return value
}
