import * as React from "react"
import { format } from "date-fns"

import {
  getCellWidthStyle,
  getSelectableCellWidthStyle,
} from "@/components/json-table/cell-style"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import { parseDateStringAsLocal } from "@/components/json-table/lib/date-parsing"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import {
  DataCell,
  type DataCellKind,
  type DataCellValue,
} from "@/components/ui/data-cell"
import { TableCell } from "@/components/ui-retab/table"

function formatNestedValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length} items]`
  if (value === null || value === undefined) return ""
  if (typeof value !== "object") return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function dataCellKindForField(fieldMetadata: FieldMetadata): DataCellKind | null {
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
  return formatNestedValue(value)
}

function dateDisplayValue(value: unknown): React.ReactNode | undefined {
  const date =
    typeof value === "string" ? parseDateStringAsLocal(value) : undefined
  return date ? format(date, "PP") : undefined
}

function ReadOnlyJsonTableCellContent(props: JsonTableCellProps) {
  const materializedFieldPath = props.projectedCell?.materializedFieldPath
  const fieldMetadata =
    props.column.fieldMetadata ??
    (materializedFieldPath
      ? getFieldMetadata(props.schema, materializedFieldPath)
      : undefined)
  const value = props.projectedCell?.value
  const cellWidth = props.column.widthPx

  if (!materializedFieldPath || !fieldMetadata) {
    return (
      <TableCell
        data-field-path={materializedFieldPath}
        className="relative cursor-not-allowed bg-muted/60"
        style={getCellWidthStyle(cellWidth)}
      />
    )
  }

  const dataCellKind = dataCellKindForField(fieldMetadata)

  return (
    <TableCell
      data-field-path={materializedFieldPath}
      className="relative m-0 border-t-0 border-r border-b border-l-0 p-0 select-none"
      style={getSelectableCellWidthStyle(cellWidth)}
    >
      {dataCellKind ? (
        <DataCell
          kind={dataCellKind}
          value={dataCellValue(value)}
          formatValue={
            fieldMetadata.kind === "date"
              ? () => dateDisplayValue(value) ?? ""
              : undefined
          }
          className="h-full rounded-none border-0 py-2 text-xs"
        />
      ) : (
        <DataCell
          kind="text"
          value={formatNestedValue(value)}
          className="h-full rounded-none border-0 py-2 text-xs"
        />
      )}
    </TableCell>
  )
}

export const ReadOnlyJsonTableCell = React.memo(
  ReadOnlyJsonTableCellContent,
  (prev, next) =>
    prev.column.key === next.column.key &&
    prev.column.widthPx === next.column.widthPx &&
    prev.column.fieldMetadata === next.column.fieldMetadata &&
    prev.projectedCell?.materializedFieldPath ===
      next.projectedCell?.materializedFieldPath &&
    Object.is(prev.projectedCell?.value, next.projectedCell?.value) &&
    prev.schema === next.schema
)
ReadOnlyJsonTableCell.displayName = "ReadOnlyJsonTableCell"
