import type * as React from "react";

import {
  getCellWidthStyle,
  getSelectableCellWidthStyle,
  interactiveCellOverlayClass,
} from "@/components/json-table/cell-style";

export type EditableTableCellShellProps =
  React.TdHTMLAttributes<HTMLTableCellElement> & {
    "data-active"?: boolean;
    "data-field-path"?: string;
    "data-json-table-editable-cell"?: string;
  };

export type JsonTableShellHandlers = Pick<
  EditableTableCellShellProps,
  | "onKeyDown"
  | "onPointerDown"
  | "onPointerEnter"
  | "onPointerLeave"
  | "onPointerMove"
>;

export function disabledJsonTableCellShellProps({
  ariaColumnIndex,
  cellWidth,
  materializedFieldPath,
}: {
  ariaColumnIndex: number;
  cellWidth: number;
  materializedFieldPath: string | undefined;
}): EditableTableCellShellProps {
  return {
    "aria-colindex": ariaColumnIndex,
    "data-field-path": materializedFieldPath,
    className: "relative cursor-not-allowed bg-muted/60 p-0",
    style: getCellWidthStyle(cellWidth),
  };
}

export function editableJsonTableCellShellProps({
  ariaColumnIndex,
  cellWidth,
  isCellEditing,
  isJsonEditable,
  isPrimitiveCell,
  materializedFieldPath,
  shellHandlers,
}: {
  ariaColumnIndex: number;
  cellWidth: number;
  isCellEditing: boolean;
  isJsonEditable: boolean;
  isPrimitiveCell: boolean;
  materializedFieldPath: string;
  shellHandlers: JsonTableShellHandlers;
}): EditableTableCellShellProps {
  return {
    "aria-colindex": ariaColumnIndex,
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
  };
}
