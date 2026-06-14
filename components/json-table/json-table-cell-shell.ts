import type * as React from "react"

import {
  getCellWidthStyle,
  getSelectableCellWidthStyle,
  interactiveCellOverlayClass,
} from "@/components/json-table/cell-style"

export type EditableTableCellShellProps =
  React.TdHTMLAttributes<HTMLTableCellElement> & {
    "data-active"?: boolean
    "data-field-path"?: string
    "data-json-table-editable-cell"?: string
  }

export type JsonTableShellHandlers = Pick<
  EditableTableCellShellProps,
  | "onKeyDown"
  | "onPointerDown"
  | "onPointerEnter"
  | "onPointerLeave"
  | "onPointerMove"
>

export function disabledJsonTableCellShellProps({
  cellWidth,
  materializedFieldPath,
}: {
  cellWidth: number
  materializedFieldPath: string | undefined
}): EditableTableCellShellProps {
  return {
    "data-field-path": materializedFieldPath,
    className: "relative cursor-not-allowed bg-muted/60 p-0",
    style: getCellWidthStyle(cellWidth),
  }
}

export function editableJsonTableCellShellProps({
  cellWidth,
  isCellEditing,
  isJsonEditable,
  isPrimitiveCell,
  materializedFieldPath,
  shellHandlers,
}: {
  cellWidth: number
  isCellEditing: boolean
  isJsonEditable: boolean
  isPrimitiveCell: boolean
  materializedFieldPath: string
  shellHandlers: JsonTableShellHandlers
}): EditableTableCellShellProps {
  return {
    "data-active": isCellEditing || undefined,
    "data-field-path": materializedFieldPath,
    "data-json-table-editable-cell": "true",
    ...shellHandlers,
    tabIndex: isJsonEditable && !isPrimitiveCell ? 0 : undefined,
    className: [
      "relative m-0 border-t-0 border-r border-b border-l-0 p-0 select-none",
      interactiveCellOverlayClass,
    ].join(" "),
    style: getSelectableCellWidthStyle(cellWidth),
  }
}
