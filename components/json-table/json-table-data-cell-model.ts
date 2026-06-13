import type * as React from "react"
import { format } from "date-fns"

import {
  formatDataCellDisplayValue,
  type DataCellKind,
  type DataCellSelectOption,
} from "@/components/ui/data-cell"
import {
  jsonTableDataCellClass,
  jsonTableSelectDataCellClass,
} from "@/components/json-table/json-table-data-cell"
import { dateStringToFormat } from "@/components/json-table/lib/date-display-formatting"
import { parseDateStringAsLocal } from "@/components/json-table/lib/date-parsing"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

type JsonTableTextDataCellKind = "text" | "date" | "time" | "date-time"

type JsonTableFormatValue<Kind extends DataCellKind, Value> = (
  value: Value | undefined,
  meta: { kind: Kind }
) => React.ReactNode

type JsonTableTextFormatValue = JsonTableFormatValue<
  JsonTableTextDataCellKind,
  string | null
>

type JsonTableDataCellBaseModel<
  Kind extends DataCellKind,
  Value,
  CommitValue,
> = {
  className: string
  kind: Kind
  value: Value
  commitValue: (value: CommitValue) => unknown
}

type JsonTableTextDataCellModelFor<Kind extends JsonTableTextDataCellKind> =
  JsonTableDataCellBaseModel<Kind, string | null, string | null> & {
    formatValue?: JsonTableTextFormatValue
    showPickerIcon?: boolean
  }

export type JsonTableTextDataCellModel = {
  [Kind in JsonTableTextDataCellKind]: JsonTableTextDataCellModelFor<Kind>
}[JsonTableTextDataCellKind]

export type JsonTableNumberDataCellModel =
  | JsonTableDataCellBaseModel<"number", string | number | null, number | null>
  | JsonTableDataCellBaseModel<"integer", string | number | null, number | null>

export type JsonTableBooleanDataCellModel = JsonTableDataCellBaseModel<
  "boolean",
  boolean | null,
  boolean
>

export type JsonTableSelectDataCellModel = JsonTableDataCellBaseModel<
  "select",
  string | null,
  string | null
> & {
  formatValue?: JsonTableFormatValue<"select", string | null>
  placeholder: string
  selectOptions: DataCellSelectOption[]
}

export type JsonTableDataCellModel =
  | JsonTableTextDataCellModel
  | JsonTableNumberDataCellModel
  | JsonTableBooleanDataCellModel
  | JsonTableSelectDataCellModel

export function jsonValueText(jsonValue: unknown): string {
  if (Array.isArray(jsonValue)) return `[${jsonValue.length} items]`
  if (jsonValue === null || jsonValue === undefined) return ""
  if (typeof jsonValue !== "object") return String(jsonValue)
  try {
    return JSON.stringify(jsonValue)
  } catch {
    return String(jsonValue)
  }
}

export function primitiveKindForField(
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
  value: jsonValue,
}: {
  fieldMetadata: FieldMetadata
  value: unknown
}): string {
  const dataCellKind = primitiveKindForField(fieldMetadata)

  if (dataCellKind === "number" || dataCellKind === "integer") {
    return formatDataCellDisplayValue(
      dataCellKind,
      numberDataCellValue(jsonValue)
    )
  }

  if (dataCellKind === "boolean") {
    return typeof jsonValue === "boolean" ? String(jsonValue) : ""
  }

  if (dataCellKind) {
    if (fieldMetadata.kind === "date") return dateDisplayValue(jsonValue)
    return formatDataCellDisplayValue(
      dataCellKind,
      textDataCellValue(jsonValue)
    )
  }

  return jsonValueText(jsonValue)
}

export function createJsonTableDataCellModel({
  fieldMetadata,
  value: jsonValue,
}: {
  fieldMetadata: FieldMetadata
  value: unknown
}): JsonTableDataCellModel {
  const dataCellKind = primitiveKindForField(fieldMetadata)

  if (dataCellKind === "select") return enumModel(fieldMetadata, jsonValue)

  if (dataCellKind === "number" || dataCellKind === "integer") {
    return numberModel(jsonValue, dataCellKind)
  }

  if (dataCellKind === "boolean") return booleanModel(fieldMetadata, jsonValue)

  if (dataCellKind) {
    return stringModel(fieldMetadata, jsonValue, dataCellKind)
  }

  return fallbackTextModel(fieldMetadata, jsonValue)
}

function enumModel(
  fieldMetadata: FieldMetadata,
  jsonValue: unknown
): JsonTableSelectDataCellModel {
  return {
    className: jsonTableSelectDataCellClass,
    formatValue:
      fieldMetadata.kind === "enum"
        ? () => enumDisplayValue(jsonValue, fieldMetadata.isNullable)
        : undefined,
    kind: "select",
    placeholder: "Select...",
    selectOptions: enumDataCellOptions(fieldMetadata),
    value:
      fieldMetadata.kind === "enum"
        ? enumDataCellValue(jsonValue, fieldMetadata.enumValues)
        : textDataCellValue(jsonValue),
    commitValue: (commitValue) =>
      commitValue === null ? null : enumCommitValue(commitValue, fieldMetadata),
  }
}

function numberModel(
  jsonValue: unknown,
  kind: "number" | "integer"
): JsonTableNumberDataCellModel {
  return {
    className: jsonTableDataCellClass,
    kind,
    value: numberDataCellValue(jsonValue),
    commitValue: (commitValue) => commitValue,
  }
}

function booleanModel(
  fieldMetadata: FieldMetadata,
  jsonValue: unknown
): JsonTableBooleanDataCellModel {
  return {
    className: jsonTableDataCellClass,
    kind: "boolean",
    value: typeof jsonValue === "boolean" ? jsonValue : null,
    commitValue: (commitValue) => jsonCommitValue(fieldMetadata, commitValue),
  }
}

function stringModel(
  fieldMetadata: FieldMetadata,
  jsonValue: unknown,
  kind: JsonTableTextDataCellKind
): JsonTableTextDataCellModelFor<typeof kind> {
  return {
    className: jsonTableDataCellClass,
    formatValue:
      fieldMetadata.kind === "date"
        ? (dataCellValue) => dateDisplayValue(dataCellValue)
        : undefined,
    kind,
    showPickerIcon: false,
    value: textDataCellValue(jsonValue),
    commitValue: (commitValue) => jsonCommitValue(fieldMetadata, commitValue),
  }
}

function fallbackTextModel(
  fieldMetadata: FieldMetadata,
  jsonValue: unknown
): JsonTableTextDataCellModelFor<"text"> {
  return {
    className: jsonTableDataCellClass,
    kind: "text",
    value: jsonValueText(jsonValue),
    commitValue: (commitValue) => jsonCommitValue(fieldMetadata, commitValue),
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

function primitiveJsonValue(jsonValue: unknown) {
  if (
    jsonValue === null ||
    jsonValue === undefined ||
    typeof jsonValue === "string" ||
    typeof jsonValue === "number" ||
    typeof jsonValue === "boolean"
  ) {
    return jsonValue
  }
  return jsonValueText(jsonValue)
}

function numberDataCellValue(jsonValue: unknown): string | number | null {
  return typeof jsonValue === "number" || typeof jsonValue === "string"
    ? jsonValue
    : null
}

function textDataCellValue(jsonValue: unknown): string | null {
  return jsonValue === null || jsonValue === undefined
    ? null
    : String(primitiveJsonValue(jsonValue))
}

function dateDisplayValue(jsonValue: unknown): string {
  if (jsonValue === null || jsonValue === undefined || jsonValue === "") {
    return ""
  }
  if (typeof jsonValue !== "string") return String(jsonValue)
  const date = parseDateStringAsLocal(jsonValue)
  return date ? format(date, "PP") : jsonValue
}

function jsonCommitValue(
  fieldMetadata: FieldMetadata,
  commitValue: string | number | boolean | null
): string | number | boolean | null {
  if (typeof commitValue !== "string") return commitValue

  if (fieldMetadata.kind === "date") {
    return dateStringToFormat(commitValue, "2000-01-01") || null
  }

  if (fieldMetadata.kind === "time") {
    const valueWithSeconds =
      commitValue && /^\d{1,2}:\d{2}$/.test(commitValue)
        ? `${commitValue}:00`
        : commitValue
    return dateStringToFormat(valueWithSeconds, "00:00") || null
  }

  if (fieldMetadata.kind === "date-time") {
    return dateStringToFormat(commitValue, "2000-01-01T00:00:00") || null
  }

  return commitValue
}
