"use client"

import * as React from "react"

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

const MINIMUM_ROW_WINDOW = 32
const INITIAL_COLUMN_WINDOW = 8

export interface FixedGridColumnItem {
  index: number
  widthPx: number
}

export interface FixedGridVirtualItem {
  index: number
  start: number
  size: number
  end: number
}

export interface FixedGridScrollTarget {
  rowIndex: number
  columnIndex: number
  align?: "start" | "center" | "end" | "auto"
  behavior?: ScrollBehavior
}

export interface FixedRowScrollTarget {
  rowIndex: number
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
  scrollElement,
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
  scrollElement?: HTMLElement | null
  virtualizeColumns?: boolean
}) {
  const viewport = useFixedGridViewport(scrollElement ?? scrollRef.current)

  const totalRowSize = rowCount * rowSize
  const totalColumnSize = columnCount * columnSize
  const activeRowOverscan = viewport.isJumpingRows
    ? jumpRowOverscan
    : rowOverscan
  const activeColumnOverscan =
    viewport.isJumpingColumns || viewport.isJumpingRows
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
        minimumVisibleCount: MINIMUM_ROW_WINDOW,
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
          widthPx: columnSize,
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
      minimumVisibleCount: INITIAL_COLUMN_WINDOW,
    })

    return {
      columnItems: virtualColumns.map((item) => ({
        index: item.index,
        widthPx: item.size,
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

export function useFixedRowVirtualization({
  rowCount,
  rowSize,
  rowOverscan,
  jumpRowOverscan = rowOverscan,
  scrollRef,
}: {
  rowCount: number
  rowSize: number
  rowOverscan: number
  jumpRowOverscan?: number
  scrollRef: React.RefObject<HTMLElement | null>
}) {
  const [range, setRange] = React.useState({ start: 0, end: 0 })
  const rangeRef = React.useRef(range)
  const rafRef = React.useRef(0)
  const totalRowSize = rowCount * rowSize

  const setMeasuredRange = React.useCallback((next: typeof range) => {
    const current = rangeRef.current
    if (current.start === next.start && current.end === next.end) return
    rangeRef.current = next
    setRange(next)
  }, [])

  const measure = React.useCallback(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement || rowCount <= 0 || rowSize <= 0) {
      setMeasuredRange({ start: 0, end: 0 })
      return
    }

    const scrollTop = scrollElement.scrollTop
    const viewportHeight = scrollElement.clientHeight
    const firstVisibleRow = Math.floor(scrollTop / rowSize)
    const visibleRowCount = Math.ceil(viewportHeight / rowSize)
    const previous = rangeRef.current
    const isJumping =
      Math.abs(firstVisibleRow - previous.start) > visibleRowCount * 0.45
    const activeOverscan = isJumping ? jumpRowOverscan : rowOverscan
    const start = Math.max(0, firstVisibleRow - activeOverscan)
    const end = Math.min(
      rowCount,
      firstVisibleRow + visibleRowCount + activeOverscan
    )

    if (previous.end > rowCount || previous.start >= rowCount) {
      setMeasuredRange({ start, end })
      return
    }

    const bufferRows = Math.max(1, Math.floor(activeOverscan / 2))
    const visibleStart = firstVisibleRow
    const visibleEnd = Math.min(rowCount, firstVisibleRow + visibleRowCount)
    const hasBeforeBuffer =
      previous.start === 0 || visibleStart >= previous.start + bufferRows
    const hasAfterBuffer =
      previous.end === rowCount || visibleEnd <= previous.end - bufferRows

    if (hasBeforeBuffer && hasAfterBuffer) return
    setMeasuredRange({ start, end })
  }, [
    jumpRowOverscan,
    rowCount,
    rowOverscan,
    rowSize,
    scrollRef,
    setMeasuredRange,
  ])

  React.useLayoutEffect(() => {
    measure()
  }, [measure])

  React.useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    const scheduleMeasure = () => {
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        measure()
      })
    }

    scrollElement.addEventListener("scroll", scheduleMeasure, {
      passive: true,
    })
    const observer = new ResizeObserver(scheduleMeasure)
    observer.observe(scrollElement)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      scrollElement.removeEventListener("scroll", scheduleMeasure)
      observer.disconnect()
    }
  }, [scrollRef, measure])

  const virtualRows = React.useMemo(
    () =>
      Array.from({ length: range.end - range.start }, (_, offset) => {
        const index = range.start + offset
        const start = index * rowSize
        return {
          index,
          start,
          size: rowSize,
          end: start + rowSize,
        }
      }),
    [range, rowSize]
  )

  const scrollToRow = React.useCallback(
    ({
      rowIndex,
      align = "center",
      behavior = "smooth",
    }: FixedRowScrollTarget) => {
      const scrollElement = scrollRef.current
      if (!scrollElement) return
      scrollElement.scrollTo({
        top: fixedScrollOffset({
          index: rowIndex,
          itemSize: rowSize,
          viewportSize: scrollElement.clientHeight,
          align,
        }),
        behavior,
      })
    },
    [rowSize, scrollRef]
  )

  return {
    virtualRows,
    totalRowSize,
    scrollToRow,
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
  minimumVisibleCount?: number
}

function useFixedGridViewport(scrollElement: HTMLElement | null | undefined) {
  const [viewport, setViewport] = React.useState<FixedGridViewport>({
    scrollTop: 0,
    scrollLeft: 0,
    clientHeight: 0,
    clientWidth: 0,
    isJumpingRows: false,
    isJumpingColumns: false,
  })

  useIsomorphicLayoutEffect(() => {
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
  }, [scrollElement])

  return viewport
}

export function fixedVirtualItems({
  count,
  size,
  scrollOffset,
  viewportSize,
  overscan,
  minimumVisibleCount = 1,
}: FixedVirtualWindow): FixedGridVirtualItem[] {
  if (count <= 0 || size <= 0) return []
  const effectiveViewportSize = Math.max(
    viewportSize,
    size * minimumVisibleCount
  )
  const visibleStart = Math.floor(scrollOffset / size)
  const visibleEnd = Math.ceil((scrollOffset + effectiveViewportSize) / size)
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

export function fixedScrollOffset({
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
