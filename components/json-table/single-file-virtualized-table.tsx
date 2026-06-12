"use client"

import React, { useRef, useState } from "react"
import type { JSONSchema7 } from "json-schema"

import { fixedGridColumnWidths } from "@/components/ui/fixed-grid-columns"
import {
  getFixedGridCanvasStyle,
  getFixedGridRowWindowStyle,
} from "@/components/ui/fixed-grid-layout"
import { FixedGridViewport } from "@/components/ui/fixed-grid-viewport"
import { useFixedRowVirtualization } from "@/components/ui/fixed-grid-virtualization"
import {
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { JsonTableHeaderCell } from "@/components/json-table/header-cell"
import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import type {
  JsonTableJsonEditMode,
  JsonTableSchemaEditMode,
} from "@/components/json-table/json-table-edit-modes"
import type { ProjectedRow } from "@/components/json-table/lib/document-projection"
import { setValueAtMaterializedPath } from "@/components/json-table/lib/document-patches"
import { buildHeaderGridRows } from "@/components/json-table/lib/header-nodes"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import type { TableDocument } from "@/components/json-table/lib/projects-types"

import { SingleFileFormRow } from "./single-file-form-row"
import {
  getColumnWidthPx,
  getRowHeightPx,
  useSheetOptionsStore,
  type ColumnWidth,
} from "./table-options-store"

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
  onUpdateDocument?: (patch: Record<string, unknown>) => Promise<void>
  columnWidth?: ColumnWidth
  onCellHoverStart?: (info: {
    docId: string
    fieldPath: string
    rect: DOMRect
  }) => void
  onCellHoverEnd?: () => void
  /** Rows to render beyond the viewport on each side (virtualization buffer). Default 12. */
  overscan?: number
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
      onUpdateDocument,
      columnWidth: propColumnWidth,
      onCellHoverStart,
      onCellHoverEnd,
      overscan = 12,
    }) => {
      const { rowHeight, columnWidth: storeColumnWidth } =
        useSheetOptionsStore()
      const columnWidth = propColumnWidth ?? storeColumnWidth

      // Which object/array cell editor is open. Held at the table level so it
      // survives row virtualization.
      const [openEditorPath, setOpenEditorPath] = useState<string | null>(null)
      const [activeCellPath, setActiveCellPath] = useState<string | null>(null)
      const activeCellPathRef = useRef<string | null>(null)
      const lockedCellPathRef = useRef<string | null>(null)
      const hoveredCellElementRef = useRef<HTMLElement | null>(null)
      const documentDataRef = useRef(document.data)
      const pendingDocumentDataRef = useRef<Record<string, unknown> | null>(
        null
      )

      React.useEffect(() => {
        documentDataRef.current = document.data
        if (pendingDocumentDataRef.current === document.data) {
          pendingDocumentDataRef.current = null
        }
      }, [document.data])

      const totalWidth = fixedGridColumnWidths(visibleColumns).reduce(
        (total, widthPx) => total + widthPx,
        0
      )

      const rowHeightPx = getRowHeightPx(rowHeight)
      const scrollRef = useRef<HTMLDivElement>(null)
      const headerScrollRef = useRef<HTMLDivElement>(null)
      const { virtualRows, totalRowSize } = useFixedRowVirtualization({
        rowCount,
        rowSize: rowHeightPx,
        rowOverscan: overscan,
        scrollRef,
      })
      const isJsonEditable = jsonEditMode === "editable"
      const handleDocumentDataChange = React.useCallback(
        (
          _docId: string,
          materializedFieldPath: string,
          value: unknown
        ) => {
          if (!onUpdateDocument) return

          const baseData =
            pendingDocumentDataRef.current ?? documentDataRef.current
          const nextData = setValueAtMaterializedPath(
            baseData,
            materializedFieldPath,
            value
          )
          pendingDocumentDataRef.current = nextData
          onUpdateDocument({ data: nextData })
        },
        [onUpdateDocument]
      )
      const setActiveCellElement = React.useCallback(
        (cell: HTMLElement | null) => {
          const activeElement = cell?.isConnected ? cell : null
          const fieldPath = activeElement?.dataset.fieldPath ?? null

          if (activeCellPathRef.current === fieldPath) return

          activeCellPathRef.current = fieldPath
          setActiveCellPath(fieldPath)

          if (fieldPath && activeElement) {
            onCellHoverStart?.({
              docId: document.id,
              fieldPath,
              rect: activeElement.getBoundingClientRect(),
            })
          } else {
            onCellHoverEnd?.()
          }
        },
        [document.id, onCellHoverEnd, onCellHoverStart]
      )

      const handleBodyPointerMove = React.useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
          if (!isJsonEditable) return

          const target = event.target instanceof Element ? event.target : null
          const cell = target?.closest('[data-json-table-editable-cell="true"]')
          const editableCell =
            cell instanceof HTMLElement && event.currentTarget.contains(cell)
              ? cell
              : null

          hoveredCellElementRef.current = editableCell

          if (lockedCellPathRef.current) return

          setActiveCellElement(editableCell)
        },
        [isJsonEditable, setActiveCellElement]
      )

      const handleBodyPointerLeave = React.useCallback(() => {
        hoveredCellElementRef.current = null

        if (lockedCellPathRef.current) return

        setActiveCellElement(null)
      }, [setActiveCellElement])

      React.useEffect(() => {
        if (!isJsonEditable) return

        const handleDocumentPointerMove = (event: PointerEvent) => {
          const scroller = scrollRef.current
          const target = event.target

          if (!scroller || !(target instanceof Node)) return
          if (scroller.contains(target)) return

          hoveredCellElementRef.current = null

          if (lockedCellPathRef.current) return

          setActiveCellElement(null)
        }

        globalThis.document.addEventListener(
          "pointermove",
          handleDocumentPointerMove
        )
        return () => {
          globalThis.document.removeEventListener(
            "pointermove",
            handleDocumentPointerMove
          )
        }
      }, [isJsonEditable, setActiveCellElement])

      const handleCellActivityLockChange = React.useCallback(
        (fieldPath: string, locked: boolean) => {
          if (locked) {
            lockedCellPathRef.current = fieldPath

            if (activeCellPathRef.current !== fieldPath) {
              activeCellPathRef.current = fieldPath
              setActiveCellPath(fieldPath)
            }

            return
          }

          if (lockedCellPathRef.current !== fieldPath) return

          lockedCellPathRef.current = null
          setActiveCellElement(hoveredCellElementRef.current)
        },
        [setActiveCellElement]
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
            onPointerMove={handleBodyPointerMove}
            onPointerLeave={handleBodyPointerLeave}
            onScroll={(e) => {
              if (headerScrollRef.current) {
                headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
              }
              if (!lockedCellPathRef.current) {
                hoveredCellElementRef.current = null
                setActiveCellElement(null)
              }
            }}
          >
            <table
              data-slot="table"
              className="relative flex w-full flex-col rounded-none bg-background"
              style={getFixedGridCanvasStyle({ minWidth: totalWidth })}
            >
              <TableBody
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
                  return (
                    <SingleFileFormRow
                      key={rowKey}
                      rowIdx={rowIdx}
                      rowTopPx={virtualRow.start}
                      document={document}
                      projectedRow={projectedRows[rowIdx]}
                      schema={schema}
                      visibleColumns={visibleColumns}
                      rowHeightPx={rowHeightPx}
                      openEditorPath={openEditorPath}
                      setOpenEditorPath={setOpenEditorPath}
                      activeCellPath={activeCellPath}
                      onCellActivityLockChange={handleCellActivityLockChange}
                      onDocumentDataChange={handleDocumentDataChange}
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
