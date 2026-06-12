"use client"

import * as React from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

import { CSV_SCROLLBAR_CSS, HeaderAwareScrollbar } from "./csv-viewer-scrollbar"
import type { CsvCellAddress } from "./csv-viewer-state"
import { CsvStyleScope } from "./csv-viewer-style-scope"
import { fixedGridColumnWidths } from "./fixed-grid-columns"
import {
  getFixedGridCanvasStyle,
  getFixedGridRowWindowStyle,
} from "./fixed-grid-layout"
import { getFixedGridRowStyle } from "./fixed-grid-row-style"
import { buildVirtualGridTemplate } from "./fixed-grid-template"
import { FixedGridViewport } from "./fixed-grid-viewport"
import {
  useFixedGridVirtualization,
  type FixedGridColumnItem,
} from "./fixed-grid-virtualization"

type Row = string[]

export interface CsvGridHandle {
  scrollToCell: (
    cellAddress: CsvCellAddress,
    options?: { behavior?: ScrollBehavior }
  ) => void
  getViewportElement: () => HTMLDivElement | null
}

export interface CsvGridProps {
  columns: string[]
  sourceRows: string[][]
  activeCell: CsvCellAddress | null
  height: number
  fillHeight: boolean
  isolateStyles: boolean
  scale: number
  statusNode: React.ReactNode
}

const CSV_TABLE_LABEL = "CSV data"
const COLUMN_WIDTH = 180
const COLUMN_OVERSCAN = 2
const JUMP_COLUMN_OVERSCAN = 0
const ROW_HEIGHT = 33
const ROW_NUMBER_WIDTH = 56
const ROW_OVERSCAN = 4
const JUMP_ROW_OVERSCAN = 0
const SMALL_TABLE_ROW_LIMIT = 200
const SMALL_TABLE_COLUMN_LIMIT = 8

export const CsvGrid = React.forwardRef<CsvGridHandle, CsvGridProps>(
  function CsvGrid(
    {
      columns,
      sourceRows,
      activeCell,
      height,
      fillHeight,
      isolateStyles,
      scale,
      statusNode,
    },
    ref
  ) {
    const [sort, setSort] = React.useState<{
      columnIndex: number
      descending: boolean
    } | null>(null)

    const toggleSort = React.useCallback((columnIndex: number) => {
      setSort((current) =>
        !current || current.columnIndex !== columnIndex
          ? { columnIndex, descending: false }
          : current.descending
            ? null
            : { columnIndex, descending: true }
      )
    }, [])

    const rowOrder = React.useMemo<number[] | null>(() => {
      if (!sort) return null
      const order = sourceRows.map((_, rowIndex) => rowIndex)
      const { columnIndex } = sort
      order.sort((a, b) =>
        compareCells(
          sourceRows[a][columnIndex] ?? "",
          sourceRows[b][columnIndex] ?? ""
        )
      )
      if (sort.descending) order.reverse()
      return order
    }, [sourceRows, sort])

    const displayIndexByRowIndex = React.useMemo<Map<
      number,
      number
    > | null>(() => {
      if (!rowOrder) return null
      const map = new Map<number, number>()
      rowOrder.forEach((rowIndex, displayRowIndex) => {
        map.set(rowIndex, displayRowIndex)
      })
      return map
    }, [rowOrder])

    const rowAt = React.useCallback(
      (displayRowIndex: number): Row =>
        sourceRows[rowOrder ? rowOrder[displayRowIndex] : displayRowIndex],
      [sourceRows, rowOrder]
    )

    const rowIndexAt = React.useCallback(
      (displayRowIndex: number): number =>
        rowOrder ? rowOrder[displayRowIndex] : displayRowIndex,
      [rowOrder]
    )

    const viewportRef = React.useRef<HTMLDivElement>(null)
    const [viewportElement, setViewportElement] =
      React.useState<HTMLDivElement | null>(null)
    const setViewportRef = React.useCallback((node: HTMLDivElement | null) => {
      viewportRef.current = node
      setViewportElement((current) => (current === node ? current : node))
    }, [])
    const columnCount = columns.length
    const columnOffset = 1
    const shouldVirtualizeRows = sourceRows.length > SMALL_TABLE_ROW_LIMIT
    const shouldVirtualizeColumns = columnCount > SMALL_TABLE_COLUMN_LIMIT
    const effectiveRowHeight = Math.max(1, Math.round(ROW_HEIGHT * scale))
    const effectiveColumnWidth = Math.max(1, Math.round(COLUMN_WIDTH * scale))
    const effectiveRowNumberWidth = Math.round(ROW_NUMBER_WIDTH * scale)

    const {
      virtualRows,
      totalRowSize,
      totalColumnSize,
      columnItems,
      leftPad,
      rightPad,
      scrollToCell,
    } = useFixedGridVirtualization({
      rowCount: sourceRows.length,
      columnCount,
      rowSize: effectiveRowHeight,
      columnSize: effectiveColumnWidth,
      rowOverscan: ROW_OVERSCAN,
      columnOverscan: COLUMN_OVERSCAN,
      jumpRowOverscan: JUMP_ROW_OVERSCAN,
      jumpColumnOverscan: JUMP_COLUMN_OVERSCAN,
      scrollRef: viewportRef,
      scrollElement: viewportElement,
      virtualizeColumns: shouldVirtualizeColumns,
    })

    React.useImperativeHandle(
      ref,
      () => ({
        scrollToCell: (cellAddress, options) => {
          const behavior = options?.behavior ?? "smooth"
          const displayRowIndex =
            displayIndexByRowIndex?.get(cellAddress.rowIndex) ??
            cellAddress.rowIndex
          scrollToCell({
            rowIndex: displayRowIndex,
            columnIndex: cellAddress.columnIndex,
            behavior,
            align: "center",
          })
        },
        getViewportElement: () => viewportRef.current,
      }),
      [displayIndexByRowIndex, scrollToCell]
    )

    const gridTemplate = React.useMemo(
      () =>
        buildVirtualGridTemplate({
          leadingWidth: effectiveRowNumberWidth,
          leftPad,
          columnWidths: fixedGridColumnWidths(columnItems),
          rightPad,
        }),
      [effectiveRowNumberWidth, leftPad, columnItems, rightPad]
    )
    const totalWidth = effectiveRowNumberWidth + totalColumnSize

    return (
      <div
        data-slot="csv-grid"
        role="table"
        aria-label={CSV_TABLE_LABEL}
        aria-rowcount={sourceRows.length + 1}
        aria-colcount={columnCount + columnOffset}
        className={cn("relative", fillHeight && "min-h-0 flex-1")}
      >
        <CsvStyleScope
          isolate={isolateStyles}
          className={cn("relative", fillHeight && "h-full min-h-0")}
          style={fillHeight ? undefined : { height, maxHeight: "100%" }}
        >
          <style>{CSV_SCROLLBAR_CSS}</style>
          <FixedGridViewport scrollRef={setViewportRef} dataSlot="csv-body">
            <div
              style={getFixedGridCanvasStyle({
                width: totalWidth,
                contain: true,
              })}
            >
              <div
                role="row"
                aria-rowindex={1}
                data-slot="csv-header"
                className="sticky top-0 z-20 grid border-b"
                style={{
                  gridTemplateColumns: gridTemplate,
                  backgroundColor:
                    "color-mix(in oklab, var(--card) 92%, var(--foreground))",
                }}
              >
                <div
                  role="columnheader"
                  aria-colindex={1}
                  aria-label="Row number"
                  className="sticky left-0 z-10 border-r bg-[color-mix(in_oklab,var(--card)_94%,var(--foreground))]"
                  style={{ height: effectiveRowHeight }}
                />
                <Spacer width={leftPad} />
                {columnItems.map((item) => (
                  <HeaderCell
                    key={item.index}
                    name={columns[item.index] || `Column ${item.index + 1}`}
                    columnIndex={columnOffset + item.index + 1}
                    height={effectiveRowHeight}
                    sorted={
                      sort?.columnIndex === item.index
                        ? sort.descending
                          ? "desc"
                          : "asc"
                        : false
                    }
                    onToggle={() => toggleSort(item.index)}
                  />
                ))}
                <Spacer width={rightPad} />
              </div>

              {statusNode ? (
                statusNode
              ) : shouldVirtualizeRows ? (
                <div
                  role="rowgroup"
                  style={getFixedGridRowWindowStyle({ height: totalRowSize })}
                >
                  {virtualRows.map((virtualRow) => (
                    <CsvRow
                      key={virtualRow.index}
                      cells={rowAt(virtualRow.index)}
                      displayRowIndex={virtualRow.index}
                      rowIndex={rowIndexAt(virtualRow.index)}
                      gridTemplate={gridTemplate}
                      rowHeight={effectiveRowHeight}
                      columnOffset={columnOffset}
                      columnItems={columnItems}
                      leftPad={leftPad}
                      rightPad={rightPad}
                      start={virtualRow.start}
                      activeColumnIndex={
                        activeCell?.rowIndex === rowIndexAt(virtualRow.index)
                          ? activeCell.columnIndex
                          : null
                      }
                    />
                  ))}
                </div>
              ) : (
                <div role="rowgroup">
                  {sourceRows.map((_, displayRowIndex) => (
                    <CsvRow
                      key={displayRowIndex}
                      cells={rowAt(displayRowIndex)}
                      displayRowIndex={displayRowIndex}
                      rowIndex={rowIndexAt(displayRowIndex)}
                      gridTemplate={gridTemplate}
                      rowHeight={effectiveRowHeight}
                      columnOffset={columnOffset}
                      columnItems={columnItems}
                      leftPad={leftPad}
                      rightPad={rightPad}
                      activeColumnIndex={
                        activeCell?.rowIndex === rowIndexAt(displayRowIndex)
                          ? activeCell.columnIndex
                          : null
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </FixedGridViewport>
          <HeaderAwareScrollbar
            scrollRef={viewportRef}
            headerHeight={effectiveRowHeight}
          />
        </CsvStyleScope>
      </div>
    )
  }
)

function Spacer({ width }: { width: number }) {
  return <div role="presentation" aria-hidden style={{ width }} />
}

function HeaderCell({
  name,
  columnIndex,
  height,
  sorted,
  onToggle,
}: {
  name: string
  columnIndex: number
  height: number
  sorted: "asc" | "desc" | false
  onToggle: () => void
}) {
  return (
    <div
      role="columnheader"
      aria-colindex={columnIndex}
      aria-sort={
        sorted === "asc"
          ? "ascending"
          : sorted === "desc"
            ? "descending"
            : "none"
      }
      data-slot="csv-header-cell"
      className="border-r last:border-r-0"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1 px-3 text-left font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none"
        style={{ height }}
        title={`Sort by ${name}`}
      >
        <span className="truncate">{name}</span>
        {sorted ? (
          sorted === "asc" ? (
            <ChevronUp
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : (
            <ChevronDown
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )
        ) : null}
      </button>
    </div>
  )
}

function compareCells(a: string, b: string): number {
  const left = Number(a)
  const right = Number(b)
  if (a !== "" && b !== "" && !Number.isNaN(left) && !Number.isNaN(right)) {
    return left - right
  }
  return a < b ? -1 : a > b ? 1 : 0
}

const CsvRow = React.memo(function CsvRow({
  cells,
  displayRowIndex,
  rowIndex,
  gridTemplate,
  rowHeight,
  columnOffset,
  columnItems,
  leftPad,
  rightPad,
  start,
  activeColumnIndex,
}: {
  cells: Row | undefined
  displayRowIndex: number
  rowIndex: number
  gridTemplate: string
  rowHeight: number
  columnOffset: number
  columnItems: FixedGridColumnItem[]
  leftPad: number
  rightPad: number
  start?: number
  activeColumnIndex?: number | null
}) {
  const isVirtualized = start !== undefined
  const style: React.CSSProperties = !isVirtualized
    ? { gridTemplateColumns: gridTemplate, height: rowHeight }
    : getFixedGridRowStyle({
        gridTemplate,
        rowHeight,
        top: start,
      })
  return (
    <div
      role="row"
      aria-rowindex={displayRowIndex + 2}
      data-slot="csv-row"
      className={cn(
        "grid border-b",
        !isVirtualized && "group hover:bg-muted/40"
      )}
      style={style}
    >
      <div
        role="rowheader"
        aria-colindex={1}
        data-slot="csv-row-number"
        className={cn(
          "sticky left-0 z-[1] flex items-center justify-end border-r bg-card px-2 text-muted-foreground tabular-nums",
          !isVirtualized &&
            "group-hover:bg-[color-mix(in_oklab,var(--card)_97%,var(--foreground))]"
        )}
      >
        {rowIndex + 1}
      </div>
      <Spacer width={leftPad} />
      {columnItems.map((item) => {
        const text = cells?.[item.index] ?? ""
        const isActive = activeColumnIndex === item.index
        return (
          <div
            key={item.index}
            role="cell"
            aria-colindex={columnOffset + item.index + 1}
            data-slot="csv-cell"
            className={cn(
              "flex items-center truncate border-r px-3 last:border-r-0",
              isActive &&
                "bg-primary/12 ring-1 ring-primary/50 ring-offset-0 ring-inset"
            )}
            title={isVirtualized ? undefined : text}
          >
            <span className="truncate">{text}</span>
          </div>
        )
      })}
      <Spacer width={rightPad} />
    </div>
  )
})
