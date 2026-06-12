"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

export interface FixedGridColumnItem {
  index: number
  size: number
}

export interface FixedGridScrollTarget {
  rowIndex: number
  columnIndex: number
  align?: "start" | "center" | "end" | "auto"
  behavior?: ScrollBehavior
}

export function useFixedGridVirtualization({
  rowCount,
  columnCount,
  rowSize,
  columnSize,
  rowOverscan,
  columnOverscan,
  scrollRef,
  virtualizeColumns = true,
}: {
  rowCount: number
  columnCount: number
  rowSize: number
  columnSize: number
  rowOverscan: number
  columnOverscan: number
  scrollRef: React.RefObject<HTMLElement | null>
  virtualizeColumns?: boolean
}) {
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowSize,
    overscan: rowOverscan,
  })

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columnCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => columnSize,
    overscan: columnOverscan,
  })

  React.useEffect(() => {
    rowVirtualizer.measure()
    columnVirtualizer.measure()
  }, [rowSize, columnSize, rowVirtualizer, columnVirtualizer])

  const virtualColumns = columnVirtualizer.getVirtualItems()
  const totalColumnSize = columnVirtualizer.getTotalSize()
  const columnWindow = React.useMemo<{
    columnItems: FixedGridColumnItem[]
    leftPad: number
    rightPad: number
  }>(() => {
    if (!virtualizeColumns) {
      return {
        columnItems: Array.from({ length: columnCount }, (_, index) => ({
          index,
          size: columnSize,
        })),
        leftPad: 0,
        rightPad: 0,
      }
    }

    if (virtualColumns.length === 0 && columnCount > 0) {
      const count = Math.min(columnCount, columnOverscan)
      return {
        columnItems: Array.from({ length: count }, (_, index) => ({
          index,
          size: columnSize,
        })),
        leftPad: 0,
        rightPad: Math.max(0, totalColumnSize - count * columnSize),
      }
    }

    return {
      columnItems: virtualColumns.map((item) => ({
        index: item.index,
        size: item.size,
      })),
      leftPad: virtualColumns.length ? virtualColumns[0].start : 0,
      rightPad: virtualColumns.length
        ? totalColumnSize - virtualColumns[virtualColumns.length - 1].end
        : 0,
    }
  }, [
    virtualizeColumns,
    columnCount,
    columnSize,
    columnOverscan,
    virtualColumns,
    totalColumnSize,
  ])

  const scrollToCell = React.useCallback(
    ({
      rowIndex,
      columnIndex,
      align = "center",
      behavior = "smooth",
    }: FixedGridScrollTarget) => {
      rowVirtualizer.scrollToIndex(rowIndex, { align, behavior })
      columnVirtualizer.scrollToIndex(columnIndex, { align, behavior })
    },
    [rowVirtualizer, columnVirtualizer]
  )

  return {
    virtualRows: rowVirtualizer.getVirtualItems(),
    totalRowSize: rowVirtualizer.getTotalSize(),
    totalColumnSize,
    scrollToCell,
    ...columnWindow,
  }
}
