import * as React from "react"
import { format } from "date-fns"

import { CellDisplay } from "@/components/json-table/cell-display"
import {
  getCellWidthStyle,
  getSelectableCellWidthStyle,
} from "@/components/json-table/cell-style"
import type { DataCellProps } from "@/components/json-table/data-cell-types"
import {
  dateToHTMLDateTimeString,
  dateToHTMLTimeString,
} from "@/components/json-table/lib/date-display-formatting"
import { parseDateStringAsLocal } from "@/components/json-table/lib/date-parsing"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
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

function getReadOnlyDisplayValue(
  fieldMetadata: FieldMetadata,
  value: unknown
): React.ReactNode {
  if (value === null || value === undefined || value === "__null__") {
    return <span className="text-muted-foreground">—</span>
  }

  switch (fieldMetadata.kind) {
    case "date": {
      const date =
        typeof value === "string" ? parseDateStringAsLocal(value) : undefined
      return date ? format(date, "PP") : String(value)
    }
    case "date-time":
      return typeof value === "string"
        ? dateToHTMLDateTimeString(value) || value
        : String(value)
    case "iso-time":
      return typeof value === "string"
        ? dateToHTMLTimeString(value) || value
        : String(value)
    case "object":
    case "array":
      return formatNestedValue(value)
    default:
      return String(value)
  }
}

function ReadOnlyDataCellContent(props: DataCellProps) {
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

  return (
    <TableCell
      data-field-path={materializedFieldPath}
      className="relative m-0 border-t-0 border-r border-b border-l-0 p-0 select-none"
      style={getSelectableCellWidthStyle(cellWidth)}
    >
      <CellDisplay className="items-start py-2">
        {getReadOnlyDisplayValue(fieldMetadata, value)}
      </CellDisplay>
    </TableCell>
  )
}

export const ReadOnlyDataCell = React.memo(
  ReadOnlyDataCellContent,
  (prev, next) =>
    prev.column.key === next.column.key &&
    prev.column.widthPx === next.column.widthPx &&
    prev.column.fieldMetadata === next.column.fieldMetadata &&
    prev.projectedCell?.materializedFieldPath ===
      next.projectedCell?.materializedFieldPath &&
    Object.is(prev.projectedCell?.value, next.projectedCell?.value) &&
    prev.schema === next.schema
)
ReadOnlyDataCell.displayName = "ReadOnlyDataCell"
