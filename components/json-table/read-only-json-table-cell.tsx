import * as React from "react"
import { format } from "date-fns"

import type { DataCellKind, DataCellValue } from "@/components/ui/data-cell"
import {
  getCellWidthStyle,
  getSelectableCellWidthStyle,
} from "@/components/json-table/cell-style"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import { JsonTableDataCell } from "@/components/json-table/json-table-data-cell"
import { parseDateStringAsLocal } from "@/components/json-table/lib/date-parsing"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import {
  ArrayEditor as JsonArrayEditor,
  ObjectEditor as JsonObjectEditor,
} from "@/components/json-table/object-editor"
import { transferContext } from "@/components/json-table/cell-editors/object-editor"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { TableCell } from "@/components/ui/table"

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
  return formatNestedValue(value)
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

function ReadOnlyJsonFormCell({
  fieldMetadata,
  rootSchema,
  value,
}: {
  fieldMetadata: FieldMetadata
  rootSchema: JsonTableCellProps["schema"]
  value: unknown
}) {
  const [open, setOpen] = React.useState(false)
  const property = fieldMetadata.rawSchema
  const title = property.title || fieldMetadata.fieldPath

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="h-full w-full justify-start overflow-hidden px-1 text-xs leading-none text-inherit select-none hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none">
          {value ? (
            <div className="max-w-[80px] truncate text-left">
              {formatNestedValue(value)}
            </div>
          ) : (
            <div className="max-w-[80px] truncate text-left text-muted-foreground">
              {title}
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="m-0 w-96 p-4"
        align="start"
        side="top"
        sideOffset={0}
        alignOffset={-1}
      >
        {open && fieldMetadata.kind === "array" ? (
          <JsonArrayEditor
            name={fieldMetadata.fieldPath}
            disabled
            property={transferContext(property, rootSchema)}
            currentValue={value}
            onSubmit={() => {}}
          />
        ) : open ? (
          <JsonObjectEditor
            disabled
            property={{
              ...transferContext(property, rootSchema),
              additionalProperties: true,
            }}
            currentValue={value}
            onSubmit={() => {}}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  )
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
        className="relative cursor-not-allowed bg-muted/60 p-0"
        style={getCellWidthStyle(cellWidth)}
      >
        <JsonTableDataCell
          kind="text"
          value={null}
          placeholder=""
          className="bg-transparent"
        />
      </TableCell>
    )
  }

  const dataCellKind = dataCellKindForField(fieldMetadata)
  const isJsonFormCell =
    fieldMetadata.kind === "object" || fieldMetadata.kind === "array"

  return (
    <TableCell
      data-field-path={materializedFieldPath}
      className="relative m-0 border-t-0 border-r border-b border-l-0 p-0 select-none"
      style={getSelectableCellWidthStyle(cellWidth)}
    >
      {isJsonFormCell ? (
        <ReadOnlyJsonFormCell
          fieldMetadata={fieldMetadata}
          rootSchema={props.schema}
          value={value}
        />
      ) : dataCellKind === "number" || dataCellKind === "integer" ? (
        <JsonTableDataCell
          kind={dataCellKind}
          value={numberDataCellValue(value)}
          className="py-2"
        />
      ) : dataCellKind === "boolean" ? (
        <JsonTableDataCell
          kind="boolean"
          value={typeof value === "boolean" ? value : null}
          className="py-2"
        />
      ) : dataCellKind ? (
        <JsonTableDataCell
          kind={dataCellKind}
          value={textDataCellValue(value)}
          formatValue={
            fieldMetadata.kind === "date"
              ? () => dateDisplayValue(value) ?? ""
              : undefined
          }
          className="py-2"
        />
      ) : (
        <JsonTableDataCell
          kind="text"
          value={formatNestedValue(value)}
          className="py-2"
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
