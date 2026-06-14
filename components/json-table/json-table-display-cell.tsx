import * as React from "react"

import {
  DataCell,
  type DataCellEditorHandle,
  type DataCellValueMeta,
} from "@/components/ui/data-cell"
import { createJsonTableDataCellProps } from "@/components/json-table/json-table-data-cell-model"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

export type JsonTableDisplayCellProps = {
  fieldMetadata: FieldMetadata
  value: unknown
}

export function JsonTableDisplayCell({
  fieldMetadata,
  value,
}: JsonTableDisplayCellProps) {
  return (
    <JsonTableDataCell
      fieldMetadata={fieldMetadata}
      value={value}
      mode="display"
    />
  )
}

export function JsonTableDataCell({
  autoFocus,
  active,
  fieldMetadata,
  isEditable = false,
  mode,
  onCommit,
  onEditingEnd,
  onKeyDown,
  onActiveChange,
  onEditorHandleChange,
  onOpenChange,
  value,
}: {
  autoFocus?: boolean
  active?: boolean
  fieldMetadata: FieldMetadata
  isEditable?: boolean
  mode: "display" | "edit"
  onCommit?: (value: unknown, meta: DataCellValueMeta) => void
  onEditingEnd?: () => void
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>
  onActiveChange?: (active: boolean) => void
  onEditorHandleChange?: (handle: DataCellEditorHandle | null) => void
  onOpenChange?: (open: boolean) => void
  value: unknown
}) {
  const dataCellProps = createJsonTableDataCellProps({
    active,
    fieldMetadata,
    isEditable,
    mode,
    onCommit,
    onEditingEnd,
    onKeyDown,
    onActiveChange,
    onEditorHandleChange,
    onOpenChange,
    value,
    autoFocus,
  })

  return <DataCell {...dataCellProps} />
}
