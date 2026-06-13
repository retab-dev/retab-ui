import * as React from "react"
import dynamic from "next/dynamic"
import type { JSONSchema7, JSONSchema7Definition } from "json-schema"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { TableCell } from "@/components/ui/table"
import {
  getCellWidthStyle,
  getSelectableCellWidthStyle,
} from "@/components/json-table/cell-style"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import { getJsonTableCellDisplayValue } from "@/components/json-table/json-table-display-cell"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

type SchemaWithDefs = JSONSchema7 & {
  $defs?: Record<string, JSONSchema7Definition>
}

const ReadOnlyJsonNestedEditor = dynamic(
  () =>
    import("./read-only-json-nested-editor").then((module) => ({
      default: module.ReadOnlyJsonNestedEditor,
    })),
  { ssr: false }
)

function transferContext(type: JSONSchema7, context: JSONSchema7): JSONSchema7 {
  const contextDefs = (context as SchemaWithDefs).$defs || {}
  const typeDefs = (type as SchemaWithDefs).$defs || {}

  return {
    ...type,
    $defs: {
      ...contextDefs,
      ...typeDefs,
    },
  }
}

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

function readOnlyCellKindForField(fieldMetadata: FieldMetadata) {
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

const readOnlyScalarCellClass =
  "flex h-full w-full min-w-0 items-center overflow-hidden rounded-none border-0 bg-transparent px-3 text-xs leading-none text-foreground"

function ReadOnlyScalarCell({
  emptyText = String.fromCharCode(8212),
  kind,
  value,
}: {
  emptyText?: string
  kind: string
  value: string
}) {
  const isEmpty = value === ""

  return (
    <div
      data-slot="data-cell"
      data-kind={kind}
      data-mode="display"
      aria-readonly
      className={readOnlyScalarCellClass}
    >
      {kind === "boolean" ? (
        <span
          role="checkbox"
          data-slot="checkbox"
          data-state={value === "true" ? "checked" : "unchecked"}
          aria-checked={value === "true"}
          aria-label={value || "false"}
          className="min-w-0 truncate"
        >
          {value || "false"}
        </span>
      ) : (
        <span
          className={
            isEmpty
              ? "min-w-0 truncate text-muted-foreground"
              : "min-w-0 truncate"
          }
        >
          {isEmpty ? emptyText : value}
        </span>
      )}
    </div>
  )
}

function ReadOnlyJsonFormCell({
  displayValue,
  fieldMetadata,
  rootSchema,
  value,
}: {
  displayValue: string
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
          {displayValue ? (
            <div className="max-w-[80px] truncate text-left">
              {displayValue}
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
          <ReadOnlyJsonNestedEditor
            kind="array"
            name={fieldMetadata.fieldPath}
            property={transferContext(property, rootSchema)}
            currentValue={value}
          />
        ) : open ? (
          <ReadOnlyJsonNestedEditor
            kind="object"
            name={fieldMetadata.fieldPath}
            property={{
              ...transferContext(property, rootSchema),
              additionalProperties: true,
            }}
            currentValue={value}
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
        <ReadOnlyScalarCell emptyText="" kind="text" value="" />
      </TableCell>
    )
  }

  const dataCellKind = readOnlyCellKindForField(fieldMetadata)
  const isJsonFormCell =
    fieldMetadata.kind === "object" || fieldMetadata.kind === "array"
  const displayValue =
    props.projectedCell?.displayValue ??
    getJsonTableCellDisplayValue({ fieldMetadata, value })

  return (
    <TableCell
      data-field-path={materializedFieldPath}
      className="relative m-0 border-t-0 border-r border-b border-l-0 p-0 select-none"
      style={getSelectableCellWidthStyle(cellWidth)}
    >
      {isJsonFormCell ? (
        <ReadOnlyJsonFormCell
          displayValue={displayValue}
          fieldMetadata={fieldMetadata}
          rootSchema={props.schema}
          value={value}
        />
      ) : dataCellKind ? (
        <ReadOnlyScalarCell kind={dataCellKind} value={displayValue} />
      ) : (
        <ReadOnlyScalarCell kind="text" value={displayValue} />
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
    prev.projectedCell?.displayValue === next.projectedCell?.displayValue &&
    prev.schema === next.schema
)
ReadOnlyJsonTableCell.displayName = "ReadOnlyJsonTableCell"
