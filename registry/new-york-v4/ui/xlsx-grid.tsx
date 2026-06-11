"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

import { xlsxColumnLabel, type XlsxCell } from "@/lib/xlsx-workbook"
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
import {
  HeaderAwareScrollbar,
  XLSX_SCROLLBAR_CSS,
} from "@/components/ui/xlsx-grid-scrollbar"
import { ScrollerShell } from "@/components/ui/xlsx-shadow-scope"

export { XlsxGridSkeleton } from "@/components/ui/xlsx-grid-skeleton"

export interface XlsxScrollRequest {
  sheetIndex: number
  rowIndex: number
  columnIndex: number
  behavior: ScrollBehavior
  nonce: number
}

interface XlsxGridCellRef {
  rowIndex: number
  columnIndex: number
}

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
  const rowHeight = Math.round(XLSX_BASE_ROW_HEIGHT * scale)
  const columnWidth = Math.round(XLSX_BASE_COLUMN_WIDTH * scale)
  const gutterWidth = Math.round(XLSX_BASE_GUTTER_WIDTH * scale)
  const fontSize = XLSX_BASE_FONT_SIZE * scale

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const setScrollElement = React.useCallback(
    (element: HTMLDivElement | null) => {
      scrollRef.current = element
      if (viewportRef) viewportRef.current = element
    },
    [viewportRef]
  )

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 30,
  })
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columnCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => columnWidth,
    overscan: 30,
  })

  React.useEffect(() => {
    rowVirtualizer.measure()
    columnVirtualizer.measure()
  }, [rowHeight, columnWidth, rowVirtualizer, columnVirtualizer])

  const requestNonce = scrollRequest?.nonce
  React.useEffect(() => {
    if (!scrollRequest) return
    rowVirtualizer.scrollToIndex(scrollRequest.rowIndex, {
      align: "center",
      behavior: scrollRequest.behavior,
    })
    columnVirtualizer.scrollToIndex(scrollRequest.columnIndex, {
      align: "center",
      behavior: scrollRequest.behavior,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestNonce])

  const virtualColumns = columnVirtualizer.getVirtualItems()
  const totalColumnSize = columnVirtualizer.getTotalSize()
  const { columnItems, leftPad, rightPad } = React.useMemo(() => {
    const left = virtualColumns.length ? virtualColumns[0].start : 0
    const right = virtualColumns.length
      ? totalColumnSize - virtualColumns[virtualColumns.length - 1].end
      : 0
    return {
      columnItems: virtualColumns.map((item) => ({
        columnIndex: item.index,
        size: item.size,
      })) as XlsxGridColumnItem[],
      leftPad: left,
      rightPad: right,
    }
  }, [virtualColumns, totalColumnSize])

  const gridTemplate = React.useMemo(
    () => buildGridTemplate({ gutterWidth, leftPad, columnItems, rightPad }),
    [gutterWidth, leftPad, columnItems, rightPad]
  )
  const totalWidth = gutterWidth + columnCount * columnWidth
  const virtualRows = rowVirtualizer.getVirtualItems()

  if (rowCount === 0 || columnCount === 0) {
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
        <div
          ref={setScrollElement}
          data-slot="xlsx-body"
          role="grid"
          aria-label={sheetName}
          aria-rowcount={rowCount}
          aria-colcount={columnCount}
          tabIndex={0}
          className="absolute inset-0 overflow-auto"
        >
          <div
            style={{
              width: totalWidth,
              minWidth: "100%",
              position: "relative",
            }}
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
                  key={item.columnIndex}
                  className="flex items-center justify-center border-r font-medium text-muted-foreground last:border-r-0"
                >
                  {xlsxColumnLabel(item.columnIndex)}
                </div>
              ))}
              <Spacer width={rightPad} />
            </div>

            <div
              style={{
                position: "relative",
                height: rowVirtualizer.getTotalSize(),
              }}
            >
              {virtualRows.map((virtualRow) => (
                <XlsxGridRow
                  key={virtualRow.index}
                  rowIndex={virtualRow.index}
                  getCell={getCell}
                  gridTemplate={gridTemplate}
                  rowHeight={rowHeight}
                  columnItems={columnItems}
                  leftPad={leftPad}
                  rightPad={rightPad}
                  start={virtualRow.start}
                  activeColumnIndex={
                    activeCell?.rowIndex === virtualRow.index
                      ? activeCell.columnIndex
                      : null
                  }
                />
              ))}
            </div>
          </div>
        </div>
        <HeaderAwareScrollbar scrollRef={scrollRef} headerHeight={rowHeight} />
      </ScrollerShell>
    </div>
  )
}

function buildGridTemplate({
  gutterWidth,
  leftPad,
  columnItems,
  rightPad,
}: {
  gutterWidth: number
  leftPad: number
  columnItems: XlsxGridColumnItem[]
  rightPad: number
}) {
  const visibleColumns = columnItems
    .map((column) => `${column.size}px`)
    .join(" ")
  return [`${gutterWidth}px`, `${leftPad}px`, visibleColumns, `${rightPad}px`]
    .filter(Boolean)
    .join(" ")
}
