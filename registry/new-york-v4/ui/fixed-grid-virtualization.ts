"use client"

import * as React from "react"

export interface FixedGridColumnItem {
  index: number
  size: number
}

export interface FixedGridVirtualItem {
  index: number
  start: number
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
  jumpRowOverscan = rowOverscan,
  jumpColumnOverscan = columnOverscan,
  scrollRef,
  virtualizeColumns = true,
}: {
  rowCount: number
  columnCount: number
  rowSize: number
  columnSize: number
  rowOverscan: number
  columnOverscan: number
  jumpRowOverscan?: number
  jumpColumnOverscan?: number
  scrollRef: React.RefObject<HTMLElement | null>
  virtualizeColumns?: boolean
}) {
  const [viewport, setViewport] = React.useState<FixedGridViewport>({
    scrollTop: 0,
    scrollLeft: 0,
    clientHeight: 0,
    clientWidth: 0,
    isJumpingRows: false,
    isJumpingColumns: false,
  })

  React.useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    let frame = 0
    let lastScrollTop = scrollElement.scrollTop
    let lastScrollLeft = scrollElement.scrollLeft

    const readViewport = () => {
      frame = 0
      const scrollTop = scrollElement.scrollTop
      const scrollLeft = scrollElement.scrollLeft
      const clientHeight = scrollElement.clientHeight
      const clientWidth = scrollElement.clientWidth
      const rowDelta = Math.abs(scrollTop - lastScrollTop)
      const columnDelta = Math.abs(scrollLeft - lastScrollLeft)
      lastScrollTop = scrollTop
      lastScrollLeft = scrollLeft

      setViewport((current) => {
        const next: FixedGridViewport = {
          scrollTop,
          scrollLeft,
          clientHeight,
          clientWidth,
          isJumpingRows: rowDelta > clientHeight * 0.45,
          isJumpingColumns: columnDelta > clientWidth * 0.45,
        }
        return fixedGridViewportEqual(current, next) ? current : next
      })
    }

    const scheduleRead = () => {
      if (frame) return
      frame = requestAnimationFrame(readViewport)
    }

    readViewport()
    scrollElement.addEventListener("scroll", scheduleRead, { passive: true })
    const observer = new ResizeObserver(scheduleRead)
    observer.observe(scrollElement)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      scrollElement.removeEventListener("scroll", scheduleRead)
      observer.disconnect()
    }
  }, [scrollRef])

  const totalRowSize = rowCount * rowSize
  const totalColumnSize = columnCount * columnSize
  const activeRowOverscan = viewport.isJumpingRows
    ? jumpRowOverscan
    : rowOverscan
  const activeColumnOverscan = viewport.isJumpingColumns
    ? jumpColumnOverscan
    : columnOverscan

  const virtualRows = React.useMemo(
    () =>
      fixedVirtualItems({
        count: rowCount,
        size: rowSize,
        scrollOffset: viewport.scrollTop,
        viewportSize: viewport.clientHeight,
        overscan: activeRowOverscan,
      }),
    [
      rowCount,
      rowSize,
      viewport.scrollTop,
      viewport.clientHeight,
      activeRowOverscan,
    ]
  )

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

    const virtualColumns = fixedVirtualItems({
      count: columnCount,
      size: columnSize,
      scrollOffset: viewport.scrollLeft,
      viewportSize: viewport.clientWidth,
      overscan: activeColumnOverscan,
    })

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
    viewport.scrollLeft,
    viewport.clientWidth,
    activeColumnOverscan,
    totalColumnSize,
  ])

  const scrollToCell = React.useCallback(
    ({
      rowIndex,
      columnIndex,
      align = "center",
      behavior = "smooth",
    }: FixedGridScrollTarget) => {
      const scrollElement = scrollRef.current
      if (!scrollElement) return
      scrollElement.scrollTo({
        top: fixedScrollOffset({
          index: rowIndex,
          itemSize: rowSize,
          viewportSize: scrollElement.clientHeight,
          align,
        }),
        left: fixedScrollOffset({
          index: columnIndex,
          itemSize: columnSize,
          viewportSize: scrollElement.clientWidth,
          align,
        }),
        behavior,
      })
    },
    [columnSize, rowSize, scrollRef]
  )

  return {
    virtualRows,
    totalRowSize,
    totalColumnSize,
    scrollToCell,
    ...columnWindow,
  }
}

interface FixedGridViewport {
  scrollTop: number
  scrollLeft: number
  clientHeight: number
  clientWidth: number
  isJumpingRows: boolean
  isJumpingColumns: boolean
}

interface FixedVirtualWindow {
  count: number
  size: number
  scrollOffset: number
  viewportSize: number
  overscan: number
}

function fixedVirtualItems({
  count,
  size,
  scrollOffset,
  viewportSize,
  overscan,
}: FixedVirtualWindow): (FixedGridVirtualItem & { end: number })[] {
  if (count <= 0 || size <= 0) return []
  const visibleStart = Math.floor(scrollOffset / size)
  const visibleEnd = Math.ceil((scrollOffset + viewportSize) / size)
  const start = Math.max(0, visibleStart - overscan)
  const end = Math.min(count - 1, visibleEnd + overscan)
  return Array.from({ length: end - start + 1 }, (_, offset) => {
    const index = start + offset
    const itemStart = index * size
    return {
      index,
      start: itemStart,
      size,
      end: itemStart + size,
    }
  })
}

function fixedScrollOffset({
  index,
  itemSize,
  viewportSize,
  align,
}: {
  index: number
  itemSize: number
  viewportSize: number
  align: NonNullable<FixedGridScrollTarget["align"]>
}) {
  const start = index * itemSize
  if (align === "end") return start - viewportSize + itemSize
  if (align === "center") return start - viewportSize / 2 + itemSize / 2
  return start
}

function fixedGridViewportEqual(
  left: FixedGridViewport,
  right: FixedGridViewport
) {
  return (
    left.scrollTop === right.scrollTop &&
    left.scrollLeft === right.scrollLeft &&
    left.clientHeight === right.clientHeight &&
    left.clientWidth === right.clientWidth &&
    left.isJumpingRows === right.isJumpingRows &&
    left.isJumpingColumns === right.isJumpingColumns
  )
}
