"use client"

import React from "react"
import dynamic from "next/dynamic"
import type { JSONSchema7 } from "json-schema"

import { getFixedGridRowStyle } from "@/components/ui/fixed-grid-row-style"
import { TableRow } from "@/components/ui/table"
import type {
  JsonTableCellProps,
  VisibleColumn,
} from "@/components/json-table/json-table-cell-types"
import { recordJsonTableRender } from "@/components/json-table/json-table-profiler"
import type { ProjectedRow } from "@/components/json-table/lib/document-projection"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { ReadOnlyJsonTableCell } from "@/components/json-table/read-only-json-table-cell"

const EditableJsonTableCell = dynamic(
  () =>
    import("@/components/json-table/editable-json-table-cell").then(
      (module) => ({
        default: module.EditableJsonTableCell,
      })
    ),
  { ssr: false }
)

interface SingleFileFormRowProps {
  document: TableDocument
  schema: JSONSchema7
  projectedRow?: ProjectedRow
  visibleColumns: VisibleColumn[]
  /** Which sub-row of the document this renders (set by the row virtualizer). */
  rowIdx: number
  rowTopPx: number
  rowHeightPx: number
  /** Which object/array cell editor is open, keyed by materialized field path. */
  openEditorPath: string | null
  setOpenEditorPath: (key: string | null) => void
  onCellHoverStart?: JsonTableCellProps["onCellHoverStart"]
  onCellHoverEnd?: JsonTableCellProps["onCellHoverEnd"]
  onCellActivityLockChange?: (fieldPath: string, locked: boolean) => void
  onDocumentDataChange: JsonTableCellProps["onDocumentDataChange"]
  isJsonEditable: boolean
}

function rowHasFieldPath(row: ProjectedRow | undefined, path: string | null) {
  return Boolean(
    path && row?.cells.some((cell) => cell?.materializedFieldPath === path)
  )
}

function interactionPathsAffectRow(
  prev: SingleFileFormRowProps,
  next: SingleFileFormRowProps
) {
  const paths = [prev.openEditorPath, next.openEditorPath]

  return paths.some(
    (path) =>
      rowHasFieldPath(prev.projectedRow, path) ||
      rowHasFieldPath(next.projectedRow, path)
  )
}

function areSingleFileFormRowPropsEqual(
  prev: SingleFileFormRowProps,
  next: SingleFileFormRowProps
) {
  if (
    prev.document.id !== next.document.id ||
    prev.schema !== next.schema ||
    prev.projectedRow !== next.projectedRow ||
    prev.visibleColumns !== next.visibleColumns ||
    prev.rowIdx !== next.rowIdx ||
    prev.rowTopPx !== next.rowTopPx ||
    prev.rowHeightPx !== next.rowHeightPx ||
    prev.setOpenEditorPath !== next.setOpenEditorPath ||
    prev.onCellHoverStart !== next.onCellHoverStart ||
    prev.onCellHoverEnd !== next.onCellHoverEnd ||
    prev.onCellActivityLockChange !== next.onCellActivityLockChange ||
    prev.onDocumentDataChange !== next.onDocumentDataChange ||
    prev.isJsonEditable !== next.isJsonEditable
  ) {
    return false
  }

  return !interactionPathsAffectRow(prev, next)
}

export const SingleFileFormRow = React.memo<SingleFileFormRowProps>(
  ({
    document,
    schema,
    projectedRow,
    visibleColumns,
    rowIdx,
    rowTopPx,
    rowHeightPx,
    openEditorPath,
    setOpenEditorPath,
    onCellHoverStart,
    onCellHoverEnd,
    onCellActivityLockChange: _onCellActivityLockChange,
    onDocumentDataChange,
    isJsonEditable,
  }) => {
    const documentId = document.id
    recordJsonTableRender("SingleFileFormRow", String(rowIdx), {
      cellCount: projectedRow?.cells.length ?? 0,
      isJsonEditable,
      openEditorPath,
      rowIdx,
      rowTopPx,
    })

    // Stable callback identity so projected-cell memoization holds across the
    // parent's per-scroll re-renders.
    const handleDataChange = React.useCallback(
      (docId: string, materializedFieldPath: string, value: unknown) => {
        onDocumentDataChange(docId, materializedFieldPath, value)
      },
      [onDocumentDataChange]
    )

    // Render a single sub-row (one of the document's `rowCount` rows). Which
    // rows are mounted is decided by the row virtualizer in the parent.
    // Compute the absolute-positioning style here (not in the parent) and
    // memoize it on the only inputs that matter. Passing a fresh `style` object
    // down on every scroll frame was breaking this row's React.memo, forcing
    // every mounted row to re-render. `contain` scopes style/layout recalc to
    // the row so a single row entering/leaving can't invalidate its siblings.
    const rowStyle = React.useMemo<React.CSSProperties>(
      () =>
        getFixedGridRowStyle({
          rowHeight: rowHeightPx,
          top: rowTopPx,
        }),
      [rowTopPx, rowHeightPx]
    )
    return (
      <TableRow
        data-index={rowIdx}
        className="flex w-full border-b-0 border-border bg-transparent hover:bg-muted/50"
        style={rowStyle}
      >
        {/* Data cells */}
        {visibleColumns.map((column, colIdx) => {
          const projectedCell = projectedRow?.cells[colIdx]

          const cellProps = {
            column,
            projectedCell,
            schema,
            document,
            docId: documentId,
            setOpenEditorPath,
            openEditorPath,
            onDocumentDataChange: handleDataChange,
            isJsonEditable,
            onCellHoverStart,
            onCellHoverEnd,
          }

          return isJsonEditable ? (
            <EditableJsonTableCell key={column.key} {...cellProps} />
          ) : (
            <ReadOnlyJsonTableCell key={column.key} {...cellProps} />
          )
        })}
      </TableRow>
    )
  },
  areSingleFileFormRowPropsEqual
)
SingleFileFormRow.displayName = "SingleFileFormRow"
