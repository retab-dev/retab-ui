"use client"

import React from "react"
import type { JSONSchema7 } from "json-schema"

import { DataCell } from "@/components/json-table/data-cell"
import type { VisibleColumn } from "@/components/json-table/data-cell-types"
import type { ProjectedRow } from "@/components/json-table/lib/document-projection"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { TableRow } from "@/components/ui-retab/table"

interface SingleFileFormRowProps {
  document: TableDocument
  schema: JSONSchema7
  projectedRow?: ProjectedRow
  visibleColumns: VisibleColumn[]
  /** Which sub-row of the document this renders (set by the row virtualizer). */
  rowIdx: number
  rowHeightPx: number
  /** Which object/array cell editor is open, keyed by materialized field path. */
  openEditorPath: string | null
  setOpenEditorPath: (key: string | null) => void
  onUpdateDocument?: (patch: Record<string, unknown>) => Promise<void>
  allowEditing?: boolean
  onCellHoverStart?: (info: {
    docId: string
    fieldPath: string
    rect: DOMRect
  }) => void
  onCellHoverEnd?: () => void
}

export const SingleFileFormRow = React.memo<SingleFileFormRowProps>(
  ({
    document,
    schema,
    projectedRow,
    visibleColumns,
    rowIdx,
    rowHeightPx,
    openEditorPath,
    setOpenEditorPath,
    onUpdateDocument,
    allowEditing = true,
    onCellHoverStart,
    onCellHoverEnd,
  }) => {
    const documentId = document.id

    // Stable callback identity so DataCell's React.memo holds across the
    // parent's per-scroll re-renders.
    const handleDataChange = React.useCallback(
      async (_docId: string, value: unknown) => {
        if (onUpdateDocument) {
          await onUpdateDocument({ data: value })
        }
      },
      [onUpdateDocument]
    )

    // Render a single sub-row (one of the document's `rowCount` rows). Which
    // rows are mounted is decided by the row virtualizer in the parent.
    // Compute the absolute-positioning style here (not in the parent) and
    // memoize it on the only inputs that matter. Passing a fresh `style` object
    // down on every scroll frame was breaking this row's React.memo, forcing
    // every mounted row to re-render. `contain` scopes style/layout recalc to
    // the row so a single row entering/leaving can't invalidate its siblings.
    const rowStyle = React.useMemo<React.CSSProperties>(
      () => ({
        position: "absolute",
        top: 0,
        left: 0,
        transform: `translateY(${rowIdx * rowHeightPx}px)`,
        height: `${rowHeightPx}px`,
        minHeight: `${rowHeightPx}px`,
        minWidth: "100%",
        contain: "layout style",
      }),
      [rowIdx, rowHeightPx]
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

          return (
            <DataCell
              key={column.key}
              column={column}
              projectedCell={projectedCell}
              schema={schema}
              document={document}
              docId={documentId}
              setOpenEditorPath={setOpenEditorPath}
              openEditorPath={openEditorPath}
              onDocumentDataChange={handleDataChange}
              allowEditing={allowEditing}
              onCellHoverStart={onCellHoverStart}
              onCellHoverEnd={onCellHoverEnd}
            />
          )
        })}
      </TableRow>
    )
  }
)
SingleFileFormRow.displayName = "SingleFileFormRow"
