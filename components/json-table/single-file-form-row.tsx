"use client"

import React from "react"
import type { JSONSchema7 } from "json-schema"

import { getFixedGridRowStyle } from "@/components/ui/fixed-grid-row-style"
import { TableRow } from "@/components/ui/table"
import { EditableJsonTableCell } from "@/components/json-table/editable-json-table-cell"
import type { JsonTableCellCommitHandler } from "@/components/json-table/json-table-cell-commit"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import type { JsonTableStructuredEditSession } from "@/components/json-table/json-table-edit-session"
import type { JsonTablePrimitiveActiveCellStore } from "@/components/json-table/json-table-primitive-active-cell-store"
import type { JsonTablePrimitiveEditStore } from "@/components/json-table/json-table-primitive-edit-store"
import { recordJsonTableRender } from "@/components/json-table/json-table-profiler"
import type { JsonTableRenderedColumnWindow } from "@/components/json-table/json-table-rendered-column-window"
import type { ProjectedRow } from "@/components/json-table/lib/document-projection"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { ReadOnlyJsonTableCell } from "@/components/json-table/read-only-json-table-cell"

interface SingleFileFormRowProps {
  document: TableDocument
  schema: JSONSchema7
  projectedRow?: ProjectedRow
  renderedColumnWindow: JsonTableRenderedColumnWindow
  /** Which sub-row of the document this renders (set by the row virtualizer). */
  rowIdx: number
  rowTopPx: number
  rowHeightPx: number
  primitiveActiveCellStore: JsonTablePrimitiveActiveCellStore
  primitiveEditStore: JsonTablePrimitiveEditStore
  setPrimitiveActiveCell?: JsonTableCellProps["setPrimitiveActiveCell"]
  structuredEditSession?: JsonTableStructuredEditSession | null
  startStructuredEditSession?: JsonTableCellProps["startStructuredEditSession"]
  setStructuredEditSessionOverlayOpen?: JsonTableCellProps["setStructuredEditSessionOverlayOpen"]
  closeStructuredEditSession?: JsonTableCellProps["closeStructuredEditSession"]
  onCellHoverStart?: JsonTableCellProps["onCellHoverStart"]
  onCellHoverEnd?: JsonTableCellProps["onCellHoverEnd"]
  onCellCommit: JsonTableCellCommitHandler
  isJsonEditable: boolean
}

function rowHasFieldPath(
  row: ProjectedRow | undefined,
  path: string | null | undefined
) {
  return Boolean(
    path && row?.cells.some((cell) => cell?.materializedFieldPath === path)
  )
}

function interactionPathsAffectRow(
  prev: SingleFileFormRowProps,
  next: SingleFileFormRowProps
) {
  const paths = [
    prev.structuredEditSession?.fieldPath,
    next.structuredEditSession?.fieldPath,
  ]

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
    prev.renderedColumnWindow !== next.renderedColumnWindow ||
    prev.rowIdx !== next.rowIdx ||
    prev.rowTopPx !== next.rowTopPx ||
    prev.rowHeightPx !== next.rowHeightPx ||
    prev.primitiveActiveCellStore !== next.primitiveActiveCellStore ||
    prev.primitiveEditStore !== next.primitiveEditStore ||
    prev.setPrimitiveActiveCell !== next.setPrimitiveActiveCell ||
    prev.startStructuredEditSession !== next.startStructuredEditSession ||
    prev.setStructuredEditSessionOverlayOpen !==
      next.setStructuredEditSessionOverlayOpen ||
    prev.closeStructuredEditSession !== next.closeStructuredEditSession ||
    prev.onCellHoverStart !== next.onCellHoverStart ||
    prev.onCellHoverEnd !== next.onCellHoverEnd ||
    prev.onCellCommit !== next.onCellCommit ||
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
    renderedColumnWindow,
    rowIdx,
    rowTopPx,
    rowHeightPx,
    primitiveActiveCellStore,
    primitiveEditStore,
    setPrimitiveActiveCell = () => {},
    structuredEditSession = null,
    startStructuredEditSession = () => {},
    setStructuredEditSessionOverlayOpen = () => {},
    closeStructuredEditSession = () => {},
    onCellHoverStart,
    onCellHoverEnd,
    onCellCommit,
    isJsonEditable,
  }) => {
    const documentId = document.id
    recordJsonTableRender("SingleFileFormRow", String(rowIdx), {
      cellCount: projectedRow?.cells.length ?? 0,
      primitiveActiveFieldPath:
        primitiveActiveCellStore.getSnapshot()?.fieldPath ?? null,
      structuredEditSessionFieldPath: structuredEditSession?.fieldPath ?? null,
      isJsonEditable,
      rowIdx,
      rowTopPx,
    })

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
        aria-rowindex={rowIdx + 1}
        data-index={rowIdx}
        data-slot="json-table-row"
        className="flex w-full border-b-0 border-border bg-transparent hover:bg-muted/50"
        style={rowStyle}
      >
        {/* Data cells */}
        <ColumnSpacer widthPx={renderedColumnWindow.leftPadWidthPx} />
        {renderedColumnWindow.columns.map((column, colIdx) => {
          const projectedCellIndex =
            renderedColumnWindow.projectedCellIndexes[colIdx]
          const projectedCell =
            projectedCellIndex === undefined
              ? undefined
              : projectedRow?.cells[projectedCellIndex]

          const cellProps = {
            column,
            projectedCell,
            schema,
            document,
            docId: documentId,
            primitiveActiveCellStore,
            primitiveEditStore,
            ariaColumnIndex: (projectedCellIndex ?? colIdx) + 1,
            setPrimitiveActiveCell,
            structuredEditSession,
            startStructuredEditSession,
            setStructuredEditSessionOverlayOpen,
            closeStructuredEditSession,
            onCellCommit,
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
        <ColumnSpacer widthPx={renderedColumnWindow.rightPadWidthPx} />
      </TableRow>
    )
  },
  areSingleFileFormRowPropsEqual
)
SingleFileFormRow.displayName = "SingleFileFormRow"

function ColumnSpacer({ widthPx }: { widthPx: number }) {
  if (!Number.isFinite(widthPx) || widthPx <= 0) return null

  return (
    <td
      aria-hidden="true"
      data-slot="json-table-column-spacer"
      className="shrink-0 border-0 p-0"
      role="presentation"
      style={{ width: widthPx, minWidth: widthPx }}
    />
  )
}
