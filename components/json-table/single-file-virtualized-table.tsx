"use client"

import React, { useRef, useState } from "react"
import type { JSONSchema7 } from "json-schema"

import { JsonTableHeaderCell } from "@/components/json-table/header-from-schema"
import {
  buildHeaderGridRows,
  getLeafHeaderNodes,
} from "@/components/json-table/lib/header-nodes"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-retab/table"

import { HoverInfoContext } from "./hover-info-context"
import type { HoverInfo } from "./hover-info-context"
import { useFixedRowWindow } from "./lib/use-fixed-row-window"
import type { PathInfo } from "./path-utils"
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
  editMode: "descriptionOnly" | "editable" | "readOnly"
  tableAndPaths: { table: unknown[][]; paths: (PathInfo | undefined)[][] }
  visibleKeys: string[]
  rowCount: number
  onUpdateDocument?: (patch: Record<string, unknown>) => Promise<void>
  columnWidth?: ColumnWidth
  allowEditing?: boolean
  onCellHoverStart?: (info: {
    docId: string
    fieldPath: string
    rect: DOMRect
  }) => void
  /** Rows to render beyond the viewport on each side (virtualization buffer). Default 30. */
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
    editMode,
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
    editMode: "descriptionOnly" | "editable" | "readOnly"
  }) => {
    // Header rows derived straight from the schema header tree: each group spans
    // its leaves; shallower leaves get continuation cells so the grid stays
    // aligned.
    const headerRows = buildHeaderGridRows(headerNodes)

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
                    leafCount={getLeafHeaderNodes(cell.node).length}
                    schema={schema}
                    setSchema={setSchema}
                    stopAt={stopAt}
                    setStopAt={setStopAt}
                    columnWidth={columnWidth}
                    isPublished={isPublished}
                    draggedItemKeyRef={draggedItemKeyRef}
                    draggedItemParentPathRef={draggedItemParentPathRef}
                    editMode={editMode}
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
      editMode,
      tableAndPaths,
      visibleKeys,
      rowCount,
      onUpdateDocument,
      columnWidth: propColumnWidth,
      allowEditing = true,
      onCellHoverStart,
      overscan = 30,
    }) => {
      const { rowHeight, columnWidth: storeColumnWidth } =
        useSheetOptionsStore()
      const columnWidth = propColumnWidth ?? storeColumnWidth

      // Add hover info state for DataCell hover functionality
      const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)

      // Which object/array cell has its inline editor popover open (by field
      // key). Held at the table level so it survives row virtualization.
      const [openPopover, setOpenPopover] = useState<string | null>(null)

      const totalWidth = visibleKeys.length * getColumnWidthPx(columnWidth)

      // ── Row virtualization ──────────────────────────────────────────────
      // Rows are a fixed height, so the visible window is plain arithmetic — no
      // per-row measurement, no library. The header lives in its own bar
      // *outside* this scroll container (so `top` is just `index * rowHeight`,
      // no scroll-margin offset to correct for), and each mounted row is
      // absolutely positioned inside a spacer of the full list height.
      const rowHeightPx = getRowHeightPx(rowHeight)
      const scrollRef = useRef<HTMLDivElement>(null)
      const headerScrollRef = useRef<HTMLDivElement>(null)
      const bodyRef = useRef<HTMLTableSectionElement>(null)
      // `ready` gates the first paint: the window is unknown until the viewport
      // is measured in a layout effect, which keeps SSR (zero rows) and the
      // first client render in sync, then fills in before the browser paints.
      const { start, end, totalHeight, ready } = useFixedRowWindow({
        scrollRef,
        rowCount,
        rowHeight: rowHeightPx,
        overscan,
      })

      return (
        <HoverInfoContext.Provider value={{ hoverInfo, setHoverInfo }}>
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
              <Table
                className="relative flex w-full flex-col rounded-none bg-muted/30"
                style={{ minWidth: `${totalWidth}px` }}
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
                  editMode={editMode}
                />
              </Table>
            </div>
            <div
              ref={scrollRef}
              className="w-full flex-1 overflow-auto"
              onScroll={(e) => {
                if (headerScrollRef.current) {
                  headerScrollRef.current.scrollLeft =
                    e.currentTarget.scrollLeft
                }
              }}
            >
              <Table
                className="relative flex w-full flex-col rounded-none bg-background"
                style={{
                  minWidth: `${totalWidth}px`,
                }}
              >
                <TableBody
                  ref={bodyRef}
                  className="relative w-full bg-background"
                  style={{
                    height: `${totalHeight}px`,
                    minWidth: "100%",
                  }}
                >
                  {ready
                    ? Array.from({ length: end - start }, (_, i) => {
                        // One DOM row per row in the visible window, keyed by row
                        // index: rows mount/unmount as they enter/leave. Each row's
                        // props are memoized on primitives, so rows that stay put
                        // are skipped by React.memo.
                        const rowIdx = start + i
                        return (
                          <SingleFileFormRow
                            key={rowIdx}
                            rowIdx={rowIdx}
                            document={document}
                            paths={tableAndPaths.paths}
                            schema={schema}
                            visibleKeys={visibleKeys}
                            openPopover={openPopover}
                            setOpenPopover={setOpenPopover}
                            onUpdateDocument={onUpdateDocument}
                            allowEditing={allowEditing}
                            onCellHoverStart={onCellHoverStart}
                          />
                        )
                      })
                    : null}
                </TableBody>
              </Table>
            </div>
          </div>
        </HoverInfoContext.Provider>
      )
    }
  )
SingleFileVirtualizedTable.displayName = "SingleFileVirtualizedTable"
