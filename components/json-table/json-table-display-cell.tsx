import * as React from "react"
import { format } from "date-fns"

import {
  DataCell,
  formatDataCellDisplayValue,
  type DataCellCommitValue,
  type DataCellKind,
  type DataCellValueMeta,
  type DataCellValue,
} from "@/components/ui/data-cell"
import { jsonTableDataCellClass } from "@/components/json-table/json-table-data-cell"
import { parseDateStringAsLocal } from "@/components/json-table/lib/date-parsing"
import { dateStringToFormat } from "@/components/json-table/lib/date-display-formatting"
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

export function dataCellKindForField(
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

export function numberDataCellValue(value: unknown): string | number | null {
  return typeof value === "number" || typeof value === "string" ? value : null
}

export function textDataCellValue(value: unknown): string | null {
  return value === null || value === undefined
    ? null
    : String(dataCellValue(value))
}

function dateDisplayValue(value: unknown): React.ReactNode | undefined {
  const date =
    typeof value === "string" ? parseDateStringAsLocal(value) : undefined
  return date ? format(date, "PP") : undefined
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
    if (fieldMetadata.kind === "date") {
      return String(dateDisplayValue(value) ?? "")
    }
    return formatDataCellDisplayValue(dataCellKind, textDataCellValue(value))
  }

  return formatJsonTableNestedValue(value)
}

export function JsonTableDisplayCell({
  fieldMetadata,
  value,
}: {
  fieldMetadata: FieldMetadata
  value: unknown
}) {
  return (
    <JsonTableDataCell
      fieldMetadata={fieldMetadata}
      value={value}
      mode="display"
    />
  )
}

export function JsonTableDataCell({
  activationIntent,
  autoFocus,
  draftValue,
  fieldMetadata,
  isEditable = false,
  isPickerOpen,
  mode,
  onCommit,
  onDraftValueChange,
  onEditingEnd,
  onKeyDown,
  onPickerOpenChange,
  value,
}: {
  activationIntent?: React.ComponentProps<typeof DataCell>["activationIntent"]
  autoFocus?: boolean
  draftValue?: string
  fieldMetadata: FieldMetadata
  isEditable?: boolean
  isPickerOpen?: boolean
  mode: "display" | "edit"
  onCommit?: (value: DataCellCommitValue, meta: DataCellValueMeta) => void
  onDraftValueChange?: (value: string, meta: DataCellValueMeta) => void
  onEditingEnd?: () => void
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>
  onPickerOpenChange?: (open: boolean) => void
  value: unknown
}) {
  const dataCellKind = dataCellKindForField(fieldMetadata)
  const handleNumberCommit = React.useCallback(
    (nextValue: number | null, meta: DataCellValueMeta) => {
      onCommit?.(normalizeDataCellCommitValue(fieldMetadata, nextValue), meta)
    },
    [fieldMetadata, onCommit]
  )
  const handleBooleanCommit = React.useCallback(
    (nextValue: boolean, meta: DataCellValueMeta) => {
      onCommit?.(normalizeDataCellCommitValue(fieldMetadata, nextValue), meta)
    },
    [fieldMetadata, onCommit]
  )
  const handleTextCommit = React.useCallback(
    (nextValue: string | null, meta: DataCellValueMeta) => {
      onCommit?.(normalizeDataCellCommitValue(fieldMetadata, nextValue), meta)
    },
    [fieldMetadata, onCommit]
  )

  if (dataCellKind === "number" || dataCellKind === "integer") {
    return (
      <DataCell
        kind={dataCellKind}
        mode={mode}
        value={numberDataCellValue(value)}
        editable={isEditable}
        draftValue={draftValue}
        activationIntent={activationIntent}
        autoFocus={autoFocus}
        onDraftValueChange={onDraftValueChange}
        onCommit={handleNumberCommit}
        onEditingEnd={onEditingEnd}
        onKeyDown={onKeyDown}
        className={jsonTableDataCellClass}
      />
    )
  }

  if (dataCellKind === "boolean") {
    return (
      <DataCell
        kind="boolean"
        mode={mode}
        value={typeof value === "boolean" ? value : null}
        editable={isEditable}
        activationIntent={activationIntent}
        autoFocus={autoFocus}
        onCommit={handleBooleanCommit}
        onEditingEnd={onEditingEnd}
        onKeyDown={onKeyDown}
        className={jsonTableDataCellClass}
      />
    )
  }

  if (dataCellKind) {
    return (
      <DataCell
        kind={dataCellKind}
        mode={mode}
        value={textDataCellValue(value)}
        editable={isEditable}
        draftValue={draftValue}
        activationIntent={activationIntent}
        autoFocus={autoFocus}
        isPickerOpen={isPickerOpen}
        onDraftValueChange={onDraftValueChange}
        onCommit={handleTextCommit}
        onEditingEnd={onEditingEnd}
        onPickerOpenChange={onPickerOpenChange}
        onKeyDown={onKeyDown}
        showPickerIcon={false}
        className={jsonTableDataCellClass}
        formatValue={
          fieldMetadata.kind === "date"
            ? () => dateDisplayValue(value) ?? ""
            : undefined
        }
      />
    )
  }

  return (
    <DataCell
      kind="text"
      mode={mode}
      value={formatJsonTableNestedValue(value)}
      editable={isEditable}
      draftValue={draftValue}
      activationIntent={activationIntent}
      autoFocus={autoFocus}
      onDraftValueChange={onDraftValueChange}
      onCommit={handleTextCommit}
      onEditingEnd={onEditingEnd}
      onKeyDown={onKeyDown}
      className={jsonTableDataCellClass}
    />
  )
}
