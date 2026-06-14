"use client"

import React, { useRef } from "react"
import type { JSONSchema7 } from "json-schema"

import { fixedGridColumnWidths } from "@/components/ui/fixed-grid-columns"
import {
  getFixedGridCanvasStyle,
  getFixedGridRowWindowStyle,
} from "@/components/ui/fixed-grid-layout"
import { FixedGridViewport } from "@/components/ui/fixed-grid-viewport"
import { useFixedGridVirtualization } from "@/components/ui/fixed-grid-virtualization"
import {
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { JsonTableHeaderCell } from "@/components/json-table/header-cell"
import type { JsonTableCellCommitHandler } from "@/components/json-table/json-table-cell-commit"
import type {
  JsonTableCellHoverInfo,
  VisibleColumn,
} from "@/components/json-table/json-table-cell-types"
import type {
  JsonTableJsonEditMode,
  JsonTableSchemaEditMode,
} from "@/components/json-table/json-table-edit-modes"
import type {
  JsonTableActivationIntent,
  JsonTablePrimitiveActiveCell,
  JsonTableStructuredEditSession,
} from "@/components/json-table/json-table-edit-session"
import { jsonTableCellId } from "@/components/json-table/json-table-edit-session"
import { createJsonTablePrimitiveActiveCellStore } from "@/components/json-table/json-table-primitive-active-cell-store"
import type { JsonTablePrimitiveEditStore } from "@/components/json-table/json-table-primitive-edit-store"
import { recordJsonTableRender } from "@/components/json-table/json-table-profiler"
import {
  jsonTableFullRenderedColumnWindow,
  jsonTableVirtualRenderedColumnWindow,
  type JsonTableRenderedColumnWindow,
} from "@/components/json-table/json-table-rendered-column-window"
import type { ProjectedRow } from "@/components/json-table/lib/document-projection"
import { buildHeaderGridRows } from "@/components/json-table/lib/header-nodes"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import {
  useReadOnlyJsonRowPatcher,
  type ReadOnlyJsonRowPatchState,
} from "@/components/json-table/read-only-json-row-patcher"

import { SingleFileFormRow } from "./single-file-form-row"
import {
  getColumnWidthPx,
  getRowHeightPx,
  useSheetOptionsStore,
  type ColumnWidth,
} from "./table-options-store"

const defaultEditableRowOverscan = 0
const defaultReadOnlyRowOverscan = 12
const editableColumnOverscan = 2

interface SingleFileVirtualizedTableProps {
  headerNodes: JsonTableHeaderNode[]
  document: TableDocument
  schema: JSONSchema7
  setSchema: (schema: JSONSchema7) => void
  isPublished: boolean
  stopAt: string[]
  setStopAt: (stopAt: string[]) => void
  draggedItemKeyRef: React.RefObject<string | null>
  draggedItemParentPathRef: React.RefObject<string | null>
  jsonEditMode: JsonTableJsonEditMode
  schemaEditMode: JsonTableSchemaEditMode
  projectedRows: ProjectedRow[]
  visibleColumns: VisibleColumn[]
  rowCount: number
  primitiveEditStore: JsonTablePrimitiveEditStore
  onCellCommit: JsonTableCellCommitHandler
  columnWidth?: ColumnWidth
  onCellHoverStart?: (info: JsonTableCellHoverInfo) => void
  onCellHoverEnd?: () => void
  /** Rows to render beyond the viewport on each side. Editable defaults to 0; read-only defaults to 12. */
  overscan?: number
  /** Rows to render beyond the viewport after large scroll jumps. Defaults to the resolved overscan. */
  jumpOverscan?: number
}

const SingleFileTableHeader = React.memo(
  ({
    headerNodes,
    columnWidth,
    schema,
    setSchema,
    isPublished,
    stopAt,
    setStopAt,
    draggedItemKeyRef,
    draggedItemParentPathRef,
    schemaEditMode,
  }: {
    headerNodes: JsonTableHeaderNode[]
    columnWidth: ColumnWidth
    schema: JSONSchema7
    setSchema: (schema: JSONSchema7) => void
    isPublished: boolean
    stopAt: string[]
    setStopAt: (stopAt: string[]) => void
    draggedItemKeyRef: React.RefObject<string | null>
    draggedItemParentPathRef: React.RefObject<string | null>
    schemaEditMode: JsonTableSchemaEditMode
  }) => {
    // Header rows derived straight from the schema header tree: each group spans
    // its leaves; shallower leaves get continuation cells so the grid stays
    // aligned.
    const headerRows = React.useMemo(
      () => buildHeaderGridRows(headerNodes),
      [headerNodes]
    )

    return (
      <TableHeader className="sticky top-0 z-10 bg-muted/30">
        {headerRows.map((cells, rowIdx) => (
          <TableRow
            key={rowIdx}
            className="flex w-max min-w-full border-b bg-muted/30"
          >
            {cells.map((cell, cellIdx) => {
              const width = cell.leafCount * getColumnWidthPx(columnWidth)

              if (cell.isContinuation) {
                return (
                  <th
                    key={cellIdx}
                    className="shrink-0 border-r bg-muted/30 text-xs text-foreground last:border-r-0"
                    style={{ width: `${width}px`, minWidth: `${width}px` }}
                  />
                )
              }

              return (
                <TableHead
                  key={cellIdx}
                  className="m-0 h-9 shrink-0 border-r bg-muted/30 p-0 text-foreground last:border-r-0"
                  style={{
                    width: `${width}px`,
                    minWidth: `${width}px`,
                  }}
                  colSpan={cell.colSpan}
                >
                  <JsonTableHeaderCell
                    node={cell.node}
                    leafCount={cell.leafCount}
                    schema={schema}
                    setSchema={setSchema}
                    stopAt={stopAt}
                    setStopAt={setStopAt}
                    columnWidth={columnWidth}
                    isPublished={isPublished}
                    draggedItemKeyRef={draggedItemKeyRef}
                    draggedItemParentPathRef={draggedItemParentPathRef}
                    schemaEditMode={schemaEditMode}
                  />
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
    )
  }
)
SingleFileTableHeader.displayName = "SingleFileTableHeader"

export const SingleFileVirtualizedTable =
  React.memo<SingleFileVirtualizedTableProps>(
    ({
      headerNodes,
      document,
      schema,
      setSchema,
      isPublished,
      stopAt,
      setStopAt,
      draggedItemKeyRef,
      draggedItemParentPathRef,
      jsonEditMode,
      schemaEditMode,
      projectedRows,
      visibleColumns,
      rowCount,
      primitiveEditStore,
      onCellCommit,
      columnWidth: propColumnWidth,
      onCellHoverStart,
      onCellHoverEnd,
      overscan,
      jumpOverscan,
    }) => {
      const { rowHeight, columnWidth: storeColumnWidth } =
        useSheetOptionsStore()
      const columnWidth = propColumnWidth ?? storeColumnWidth

      const [structuredEditSession, setStructuredEditSession] =
        React.useState<JsonTableStructuredEditSession | null>(null)
      const primitiveActiveCellStoreRef = useRef(
        createJsonTablePrimitiveActiveCellStore()
      )
      const structuredEditSessionIdRef = useRef(0)

      const totalWidth = fixedGridColumnWidths(visibleColumns).reduce(
        (total, widthPx) => total + widthPx,
        0
      )

      const rowHeightPx = getRowHeightPx(rowHeight)
      const isJsonEditable = jsonEditMode === "editable"
      const resolvedOverscan =
        overscan ??
        (isJsonEditable
          ? defaultEditableRowOverscan
          : defaultReadOnlyRowOverscan)
      const resolvedJumpOverscan = jumpOverscan ?? resolvedOverscan
      const scrollRef = useRef<HTMLDivElement>(null)
      const headerScrollRef = useRef<HTMLDivElement>(null)
      const rowWindowRef = useRef<HTMLTableSectionElement>(null)
      const getReadOnlyRowPatchState =
        React.useCallback((): ReadOnlyJsonRowPatchState => {
          return {
            isEnabled: !isJsonEditable,
            projectedRows,
            rowHeightPx,
            visibleColumns,
          }
        }, [isJsonEditable, projectedRows, rowHeightPx, visibleColumns])
      const rowPatcher = useReadOnlyJsonRowPatcher({
        rowWindowRef,
        getState: getReadOnlyRowPatchState,
      })
      const rowScrollStrategy = React.useMemo(
        () =>
          isJsonEditable ? undefined : { handleViewport: rowPatcher.patch },
        [isJsonEditable, rowPatcher]
      )
      const { columnItems, leftPad, rightPad, virtualRows, totalRowSize } =
        useFixedGridVirtualization({
          rowCount,
          columnCount: visibleColumns.length,
          rowSize: rowHeightPx,
          columnSize: getColumnWidthPx(columnWidth),
          rowOverscan: resolvedOverscan,
          columnOverscan: editableColumnOverscan,
          jumpRowOverscan: resolvedJumpOverscan,
          jumpColumnOverscan: editableColumnOverscan,
          minimumRenderedRows: 1,
          rowScrollStrategy,
          scrollRef,
          virtualizeColumns: isJsonEditable,
        })
      const renderedColumnWindow =
        React.useMemo<JsonTableRenderedColumnWindow>(() => {
          if (!isJsonEditable) {
            return jsonTableFullRenderedColumnWindow(visibleColumns)
          }

          return jsonTableVirtualRenderedColumnWindow({
            columnItems,
            leftPadWidthPx: leftPad,
            rightPadWidthPx: rightPad,
            schemaVisibleColumns: visibleColumns,
          })
        }, [columnItems, isJsonEditable, leftPad, rightPad, visibleColumns])

      React.useLayoutEffect(() => {
        rowPatcher.invalidate()
      }, [rowPatcher, virtualRows, renderedColumnWindow, projectedRows])
      recordJsonTableRender("SingleFileVirtualizedTable", document.id, {
        columnCount: visibleColumns.length,
        primitiveActiveFieldPath:
          primitiveActiveCellStoreRef.current.getSnapshot()?.fieldPath ?? null,
        structuredEditSessionFieldPath:
          structuredEditSession?.fieldPath ?? null,
        isJsonEditable,
        rowCount,
        virtualRows: virtualRows.length,
      })
      const setPrimitiveActiveCell = React.useCallback(
        (activeCell: JsonTablePrimitiveActiveCell | null) => {
          primitiveActiveCellStoreRef.current.setSnapshot(activeCell)
          if (activeCell) setStructuredEditSession(null)
        },
        []
      )
      const setStructuredEditSessionOverlayOpen = React.useCallback(
        (open: boolean) => {
          setStructuredEditSession((currentSession) =>
            currentSession && currentSession.isOverlayOpen !== open
              ? { ...currentSession, isOverlayOpen: open }
              : currentSession
          )
        },
        []
      )
      const closeStructuredEditSession = React.useCallback(() => {
        setStructuredEditSession(null)
      }, [])
      const startStructuredEditSession = React.useCallback(
        (
          projectedCell: ProjectedRow["cells"][number],
          intent: JsonTableActivationIntent
        ) => {
          if (!projectedCell?.materializedFieldPath) return
          const nextCellId = jsonTableCellId(
            document.id,
            projectedCell.materializedFieldPath
          )
          const nextSessionId = structuredEditSessionIdRef.current + 1
          structuredEditSessionIdRef.current = nextSessionId
          primitiveActiveCellStoreRef.current.setSnapshot(null)
          setStructuredEditSession({
            id: nextSessionId,
            cellId: nextCellId,
            docId: document.id,
            fieldPath: projectedCell.materializedFieldPath,
            intent,
            isOverlayOpen: true,
          })
        },
        [document.id]
      )

      const handleBodyScroll = React.useCallback(
        (event: React.UIEvent<HTMLDivElement>) => {
          if (headerScrollRef.current) {
            headerScrollRef.current.scrollLeft = event.currentTarget.scrollLeft
          }
        },
        []
      )

      return (
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          {/* Header: a fixed, opaque bar outside the vertical scroll. It
                scrolls horizontally in sync with the body so fields stay
                aligned, while rows scroll underneath it. A sticky header
                inside the transformed/virtualized body shows rows through it
                (transforms break sticky) — the CSV viewer uses the same
                separated-header approach. */}
          <div
            ref={headerScrollRef}
            className="w-full shrink-0 overflow-x-hidden bg-muted/30"
          >
            <table
              data-slot="table"
              className="relative flex w-full flex-col rounded-none bg-muted/30"
              style={getFixedGridCanvasStyle({ minWidth: totalWidth })}
            >
              <SingleFileTableHeader
                columnWidth={columnWidth}
                headerNodes={headerNodes}
                schema={schema}
                setSchema={setSchema}
                isPublished={isPublished}
                stopAt={stopAt}
                setStopAt={setStopAt}
                draggedItemKeyRef={draggedItemKeyRef}
                draggedItemParentPathRef={draggedItemParentPathRef}
                schemaEditMode={schemaEditMode}
              />
            </table>
          </div>
          <FixedGridViewport
            scrollRef={scrollRef}
            dataSlot="json-table-scroll"
            className="w-full flex-1 overflow-auto"
            onScroll={handleBodyScroll}
          >
            <table
              data-slot="table"
              className="relative flex w-full flex-col rounded-none bg-background"
              style={getFixedGridCanvasStyle({ minWidth: totalWidth })}
            >
              <TableBody
                ref={rowWindowRef}
                className="relative w-full bg-background"
                style={getFixedGridRowWindowStyle({
                  height: totalRowSize,
                  minWidth: "100%",
                })}
              >
                {virtualRows.map((virtualRow, slotIndex) => {
                  // Editable mode keeps row identity so focused editor state
                  // cannot move to another document row. Read-only mode reuses
                  // visible row shells to avoid replacement spikes while
                  // scrolling through large tables.
                  const rowIdx = virtualRow.index
                  const rowKey = isJsonEditable
                    ? `row-${rowIdx}`
                    : `slot-${slotIndex}`
                  const projectedRow = projectedRows[rowIdx]
                  return (
                    <SingleFileFormRow
                      key={rowKey}
                      rowIdx={rowIdx}
                      rowTopPx={virtualRow.start}
                      document={document}
                      projectedRow={projectedRow}
                      schema={schema}
                      renderedColumnWindow={renderedColumnWindow}
                      rowHeightPx={rowHeightPx}
                      primitiveActiveCellStore={
                        primitiveActiveCellStoreRef.current
                      }
                      primitiveEditStore={primitiveEditStore}
                      setPrimitiveActiveCell={setPrimitiveActiveCell}
                      structuredEditSession={structuredEditSession}
                      startStructuredEditSession={startStructuredEditSession}
                      setStructuredEditSessionOverlayOpen={
                        setStructuredEditSessionOverlayOpen
                      }
                      closeStructuredEditSession={closeStructuredEditSession}
                      onCellHoverStart={onCellHoverStart}
                      onCellHoverEnd={onCellHoverEnd}
                      onCellCommit={onCellCommit}
                      isJsonEditable={isJsonEditable}
                    />
                  )
                })}
              </TableBody>
            </table>
          </FixedGridViewport>
        </div>
      )
    }
  )
SingleFileVirtualizedTable.displayName = "SingleFileVirtualizedTable"
