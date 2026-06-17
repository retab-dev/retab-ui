"use client"

import * as React from "react"

import { xlsxColumnLabel, type XlsxCell } from "@/lib/xlsx-workbook"
import { fixedGridColumnWidths } from "@/components/ui/fixed-grid-columns"
import {
  getFixedGridCanvasStyle,
  getFixedGridRowWindowStyle,
} from "@/components/ui/fixed-grid-layout"
import type { GridCellCoordinate } from "@/components/ui/fixed-grid-selection"
import { buildVirtualGridTemplate } from "@/components/ui/fixed-grid-template"
import { FixedGridViewport } from "@/components/ui/fixed-grid-viewport"
import {
  useFixedGridVirtualization,
  useFixedRowPool,
  type FixedGridRowPoolSlot,
} from "@/components/ui/fixed-grid-virtualization"
import { HeaderAwareScrollbar } from "@/components/ui/header-aware-scrollbar"
import {
  XLSX_BASE_COLUMN_WIDTH,
  XLSX_BASE_FONT_SIZE,
  XLSX_BASE_GUTTER_WIDTH,
  XLSX_BASE_ROW_HEIGHT,
} from "@/components/ui/xlsx-grid-constants"
import {
  Spacer,
  XlsxGridRow,
  type XlsxGridColumnItem,
} from "@/components/ui/xlsx-grid-row"
import { XLSX_SCROLLBAR_CSS } from "@/components/ui/xlsx-grid-scrollbar"
import { ScrollerShell } from "@/components/ui/xlsx-shadow-scope"
import {
  useXlsxRowPatcher,
  type XlsxRowPatchState,
} from "@/registry/new-york-v4/ui/xlsx-viewer-row-patcher"

export { XlsxGridSkeleton } from "@/components/ui/xlsx-grid-skeleton"

const ROW_OVERSCAN = 4
const JUMP_ROW_OVERSCAN = 0
const COLUMN_OVERSCAN = 2
const JUMP_COLUMN_OVERSCAN = 0

export interface XlsxScrollRequest {
  sheetIndex: number
  rowIndex: number
  columnIndex: number
  behavior: ScrollBehavior
  nonce: number
}

type XlsxGridCellRef = GridCellCoordinate

export function XlsxGrid({
  rowCount,
  columnCount,
  getCell,
  sheetName,
  scale,
  activeCell,
  scrollRequest,
  isolateStyles,
  viewportRef,
}: {
  rowCount: number
  columnCount: number
  sheetName: string
  getCell: (rowIndex: number, columnIndex: number) => XlsxCell
  scale: number
  activeCell?: XlsxGridCellRef | null
  scrollRequest?: XlsxScrollRequest | null
  isolateStyles: boolean
  viewportRef?: React.RefObject<HTMLDivElement | null>
}) {
  const safeRowCount = normalizeGridCount(rowCount)
  const safeColumnCount = normalizeGridCount(columnCount)
  const safeScale = normalizeGridScale(scale)
  const rowHeight = Math.round(XLSX_BASE_ROW_HEIGHT * safeScale)
  const columnWidth = Math.round(XLSX_BASE_COLUMN_WIDTH * safeScale)
  const gutterWidth = Math.round(XLSX_BASE_GUTTER_WIDTH * safeScale)
  const fontSize = XLSX_BASE_FONT_SIZE * safeScale

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const rowWindowRef = React.useRef<HTMLDivElement>(null)
  const setScrollElement = React.useCallback(
    (element: HTMLDivElement | null) => {
      scrollRef.current = element
      if (viewportRef) viewportRef.current = element
    },
    [viewportRef]
  )
  const columnItemsRef = React.useRef<XlsxGridColumnItem[]>([])
  const getRowPatchState = React.useCallback(
    (): XlsxRowPatchState => ({
      activeCell: activeCell ?? null,
      columnCount: safeColumnCount,
      columnItems: columnItemsRef.current,
      getCell,
      rowCount: safeRowCount,
      rowHeight,
      sheetName,
    }),
    [activeCell, getCell, rowHeight, safeColumnCount, safeRowCount, sheetName]
  )
  const rowPatcher = useXlsxRowPatcher({
    rowWindowRef,
    getState: getRowPatchState,
  })
  const rowScrollStrategy = React.useMemo(
    () => ({ handleViewport: rowPatcher.patch }),
    [rowPatcher]
  )

  const {
    virtualRows,
    totalRowSize,
    totalColumnSize,
    columnItems: virtualColumnItems,
    leftPad,
    rightPad,
    scrollToCell,
    viewportClientHeight,
  } = useFixedGridVirtualization({
    rowCount: safeRowCount,
    columnCount: safeColumnCount,
    rowSize: rowHeight,
    columnSize: columnWidth,
    rowOverscan: ROW_OVERSCAN,
    columnOverscan: COLUMN_OVERSCAN,
    jumpRowOverscan: JUMP_ROW_OVERSCAN,
    jumpColumnOverscan: JUMP_COLUMN_OVERSCAN,
    minimumRenderedRows: 1,
    rowScrollStrategy,
    scrollRef,
  })

  const requestNonce = scrollRequest?.nonce
  React.useEffect(() => {
    if (!scrollRequest) return
    scrollToCell({
      rowIndex: scrollRequest.rowIndex,
      columnIndex: scrollRequest.columnIndex,
      behavior: scrollRequest.behavior,
      align: "center",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestNonce])

  const columnItems = React.useMemo(
    () =>
      virtualColumnItems.map((item) => ({
        key: String(item.index),
        widthPx: item.widthPx,
        metadata: { columnIndex: item.index },
      })) satisfies XlsxGridColumnItem[],
    [virtualColumnItems]
  )

  React.useLayoutEffect(() => {
    columnItemsRef.current = columnItems
  }, [columnItems])

  const gridTemplate = React.useMemo(
    () =>
      buildVirtualGridTemplate({
        leadingWidth: gutterWidth,
        leftPad,
        columnWidths: fixedGridColumnWidths(columnItems),
        rightPad,
      }),
    [gutterWidth, leftPad, columnItems, rightPad]
  )
  const totalWidth = gutterWidth + totalColumnSize
  const minimumRowPoolSize =
    Math.ceil(viewportClientHeight / rowHeight) + ROW_OVERSCAN * 2 + 2
  const rowPoolSlots = useFixedRowPool({
    minimumPoolSize: minimumRowPoolSize,
    rowCount: safeRowCount,
    virtualRows,
  })

  React.useLayoutEffect(() => {
    rowPatcher.resync(virtualRows)
  }, [
    rowPatcher,
    virtualRows,
    columnItems,
    rowHeight,
    safeRowCount,
    safeColumnCount,
    sheetName,
    getCell,
    activeCell,
  ])

  if (safeRowCount === 0 || safeColumnCount === 0) {
    return (
      <div
        className="flex flex-1 items-center justify-center bg-card text-xs text-muted-foreground"
        role="status"
        aria-label={`${sheetName} is empty`}
      >
        Empty sheet
      </div>
    )
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-card"
      style={{ fontSize }}
      data-slot="xlsx-grid"
    >
      <ScrollerShell
        isolate={isolateStyles}
        className="relative min-h-0 flex-1"
      >
        <style>{XLSX_SCROLLBAR_CSS}</style>
        <FixedGridViewport
          scrollRef={setScrollElement}
          dataSlot="xlsx-body"
          role="grid"
          aria-label={sheetName}
          aria-rowcount={safeRowCount}
          aria-colcount={safeColumnCount}
          tabIndex={0}
        >
          <div
            style={getFixedGridCanvasStyle({
              width: totalWidth,
              contain: true,
            })}
          >
            <div
              className="sticky top-0 z-20 grid border-b"
              style={{
                gridTemplateColumns: gridTemplate,
                height: rowHeight,
                backgroundColor:
                  "color-mix(in oklab, var(--card) 92%, var(--foreground))",
              }}
              aria-hidden
            >
              <div
                className="sticky left-0 z-10 border-r bg-[color-mix(in_oklab,var(--card)_94%,var(--foreground))]"
                style={{ height: rowHeight }}
              />
              <Spacer width={leftPad} />
              {columnItems.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-center border-r font-medium text-muted-foreground last:border-r-0"
                >
                  {xlsxColumnLabel(item.metadata.columnIndex)}
                </div>
              ))}
              <Spacer width={rightPad} />
            </div>

            <div
              ref={rowWindowRef}
              style={getFixedGridRowWindowStyle({ height: totalRowSize })}
            >
              {rowPoolSlots.map((slot) => (
                <XlsxGridRowSlot
                  key={slot.slotIndex}
                  slot={slot}
                  rowCount={safeRowCount}
                  getCell={getCell}
                  gridTemplate={gridTemplate}
                  rowHeight={rowHeight}
                  columnItems={columnItems}
                  leftPad={leftPad}
                  rightPad={rightPad}
                  activeCell={activeCell ?? null}
                />
              ))}
            </div>
          </div>
        </FixedGridViewport>
        <HeaderAwareScrollbar scrollRef={scrollRef} headerHeight={rowHeight} />
      </ScrollerShell>
    </div>
  )
}

function XlsxGridRowSlot({
  slot,
  rowCount,
  getCell,
  gridTemplate,
  rowHeight,
  columnItems,
  leftPad,
  rightPad,
  activeCell,
}: {
  slot: FixedGridRowPoolSlot
  rowCount: number
  getCell: (rowIndex: number, columnIndex: number) => XlsxCell
  gridTemplate: string
  rowHeight: number
  columnItems: XlsxGridColumnItem[]
  leftPad: number
  rightPad: number
  activeCell: XlsxGridCellRef | null
}) {
  const fallbackRowIndex =
    rowCount > 0 ? Math.min(slot.slotIndex, rowCount - 1) : 0
  const rowIndex = slot.virtualRow?.index ?? fallbackRowIndex

  return (
    <XlsxGridRow
      rowIndex={rowIndex}
      getCell={getCell}
      gridTemplate={gridTemplate}
      rowHeight={rowHeight}
      columnItems={columnItems}
      leftPad={leftPad}
      rightPad={rightPad}
      start={slot.virtualRow?.start ?? 0}
      hidden={slot.isHidden}
      activeColumnIndex={
        slot.virtualRow && activeCell?.rowIndex === rowIndex
          ? activeCell.columnIndex
          : null
      }
    />
  )
}

function normalizeGridCount(value: number) {
  return Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER
    ? Math.floor(value)
    : 0
}

function normalizeGridScale(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1
  return Math.min(5, Math.max(0.25, value))
}
