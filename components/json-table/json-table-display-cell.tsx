import * as React from "react"
import { format } from "date-fns"

import type { DataCellKind, DataCellValue } from "@/components/ui/data-cell"
import { JsonTableScalarCell } from "@/components/json-table/json-table-scalar-cell"
import { parseDateStringAsLocal } from "@/components/json-table/lib/date-parsing"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

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

function dataCellKindForField(
  fieldMetadata: FieldMetadata
): DataCellKind | null {
  switch (fieldMetadata.kind) {
    case "string":
    case "enum":
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

function dateDisplayValue(value: unknown): React.ReactNode | undefined {
  const date =
    typeof value === "string" ? parseDateStringAsLocal(value) : undefined
  return date ? format(date, "PP") : undefined
}

export function JsonTableDisplayCell({
  fieldMetadata,
  value,
}: {
  fieldMetadata: FieldMetadata
  value: unknown
}) {
  const dataCellKind = dataCellKindForField(fieldMetadata)

  if (dataCellKind === "number" || dataCellKind === "integer") {
    return (
      <JsonTableScalarCell
        kind={dataCellKind}
        value={numberDataCellValue(value)}
      />
    )
  }

  if (dataCellKind === "boolean") {
    return (
      <JsonTableScalarCell
        kind="boolean"
        value={typeof value === "boolean" ? value : null}
      />
    )
  }

  if (dataCellKind) {
    return (
      <JsonTableScalarCell
        kind={dataCellKind}
        value={textDataCellValue(value)}
        formatValue={
          fieldMetadata.kind === "date"
            ? () => dateDisplayValue(value) ?? ""
            : undefined
        }
      />
    )
  }

  return (
    <JsonTableScalarCell
      kind="text"
      value={formatJsonTableNestedValue(value)}
    />
  )
}
