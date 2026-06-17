"use client"

import * as React from "react"

import type { SourceFieldLink } from "@/components/ui/source-field-link"

export type JsonFormSourceLinkActions = Omit<
  SourceFieldLink,
  "activeSourcePath"
>

type SourceTableCell = HTMLElement
type SourcePointerPoint = { x: number; y: number }
type TableSourceHoverState = {
  phase: "idle" | "hovering" | "scrolling"
  pointerPoint: SourcePointerPoint | null
  sourcePath: string | null
}

const SOURCE_PATH_ATTRIBUTE = "data-source-path"
const SOURCE_ACTIVE_ATTRIBUTE = "data-source-active"
const SOURCE_CELL_SELECTOR = `[${SOURCE_PATH_ATTRIBUTE}]`
const TABLE_CELL_SELECTOR = "[data-table-cell]"
const SCROLL_SOURCE_HOVER_INTERVAL_MS = 32

export function useSourceTableHoverController({
  tableRef,
  activeSourcePath,
  sourceLinkActions,
  refreshKey,
}: {
  tableRef: React.RefObject<HTMLElement | null>
  activeSourcePath: string | null
  sourceLinkActions: JsonFormSourceLinkActions | null
  refreshKey: unknown
}) {
  const sourceLinked = Boolean(sourceLinkActions)
  const activeSourceCellRef = React.useRef<Element | null>(null)
  const hoverStateRef = React.useRef<TableSourceHoverState>({
    phase: "idle",
    pointerPoint: null,
    sourcePath: null,
  })
  const pendingHoverPathRef = React.useRef<string | null>(null)
  const pendingHoverFrameRef = React.useRef<number | null>(null)
  const pendingScrollHoverFrameRef = React.useRef<number | null>(null)
  const latestScrollHoverAtRef = React.useRef(Number.NEGATIVE_INFINITY)

  const setActiveSourceCell = React.useCallback((cell: Element | null) => {
    if (activeSourceCellRef.current === cell) return
    activeSourceCellRef.current?.removeAttribute(SOURCE_ACTIVE_ATTRIBUTE)
    if (cell) cell.setAttribute(SOURCE_ACTIVE_ATTRIBUTE, "true")
    activeSourceCellRef.current = cell
  }, [])

  const sourcePathForCell = React.useCallback(
    (cell: Element | null): string | null =>
      cell?.getAttribute(SOURCE_PATH_ATTRIBUTE) ?? null,
    []
  )

  React.useEffect(() => {
    if (!sourceLinked || !activeSourcePath) {
      setActiveSourceCell(null)
      return
    }
    if (
      hoverStateRef.current.sourcePath === activeSourcePath &&
      activeSourceCellRef.current?.getAttribute(SOURCE_PATH_ATTRIBUTE) ===
        activeSourcePath
    ) {
      return
    }

    const table = tableRef.current
    if (!table) return
    for (const cell of table.querySelectorAll(SOURCE_CELL_SELECTOR)) {
      if (cell.getAttribute(SOURCE_PATH_ATTRIBUTE) === activeSourcePath) {
        setActiveSourceCell(cell)
        return
      }
    }
    setActiveSourceCell(null)
  }, [
    activeSourcePath,
    sourceLinked,
    refreshKey,
    setActiveSourceCell,
    tableRef,
  ])

  const getCellFromTarget = React.useCallback(
    (target: EventTarget | null): SourceTableCell | null => {
      if (!(target instanceof Element)) return null
      const cell = target.closest<SourceTableCell>(TABLE_CELL_SELECTOR)
      return cell && tableRef.current?.contains(cell) ? cell : null
    },
    [tableRef]
  )

  const cancelPendingHover = React.useCallback(() => {
    if (pendingHoverFrameRef.current === null) return
    cancelAnimationFrame(pendingHoverFrameRef.current)
    pendingHoverFrameRef.current = null
  }, [])

  const cancelPendingScrollHover = React.useCallback(() => {
    if (pendingScrollHoverFrameRef.current === null) return
    cancelAnimationFrame(pendingScrollHoverFrameRef.current)
    pendingScrollHoverFrameRef.current = null
  }, [])

  const reportHoverSourcePath = React.useCallback(
    (path: string | null) => {
      if (!sourceLinkActions) return
      pendingHoverPathRef.current = path
      if (pendingHoverFrameRef.current !== null) return
      pendingHoverFrameRef.current = requestAnimationFrame(() => {
        pendingHoverFrameRef.current = null
        sourceLinkActions.onSourceHover(pendingHoverPathRef.current)
      })
    },
    [sourceLinkActions]
  )

  const setHoverSourcePath = React.useCallback(
    (path: string | null, cell: Element | null) => {
      if (!sourceLinkActions) return
      const currentState = hoverStateRef.current
      if (currentState.sourcePath === path) return
      hoverStateRef.current = {
        phase:
          currentState.phase === "scrolling"
            ? "scrolling"
            : path
              ? "hovering"
              : "idle",
        pointerPoint: currentState.pointerPoint,
        sourcePath: path,
      }
      setActiveSourceCell(cell)
      reportHoverSourcePath(path)
    },
    [sourceLinkActions, reportHoverSourcePath, setActiveSourceCell]
  )

  React.useEffect(
    () => () => {
      cancelPendingHover()
      cancelPendingScrollHover()
    },
    [cancelPendingHover, cancelPendingScrollHover]
  )

  const selectCellSource = React.useCallback(
    (cell: HTMLElement | null) => {
      const sourcePath = sourcePathForCell(cell)
      if (!sourcePath) return false
      cancelPendingHover()
      sourceLinkActions?.selectSourcePath?.(sourcePath)
      return true
    },
    [cancelPendingHover, sourceLinkActions, sourcePathForCell]
  )

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!sourceLinkActions) return
      hoverStateRef.current = {
        ...hoverStateRef.current,
        pointerPoint: {
          x: event.clientX,
          y: event.clientY,
        },
      }
      if (hoverStateRef.current.phase === "scrolling") return
      const cell = getCellFromTarget(event.target)
      setHoverSourcePath(sourcePathForCell(cell), cell)
    },
    [
      sourceLinkActions,
      getCellFromTarget,
      setHoverSourcePath,
      sourcePathForCell,
    ]
  )

  const handlePointerLeave = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      hoverStateRef.current = {
        ...hoverStateRef.current,
        pointerPoint: {
          x: event.clientX,
          y: event.clientY,
        },
      }
      setHoverSourcePath(null, null)
    },
    [setHoverSourcePath]
  )

  const handleScrollStart = React.useCallback(() => {
    hoverStateRef.current = {
      phase: "scrolling",
      pointerPoint: hoverStateRef.current.pointerPoint,
      sourcePath: hoverStateRef.current.sourcePath,
    }
  }, [])

  const restoreHoverSourceAtPointer = React.useCallback(() => {
    if (!sourceLinkActions) return
    const point = hoverStateRef.current.pointerPoint
    if (!point) return
    const ownerDocument = tableRef.current?.ownerDocument
    if (!ownerDocument) return
    const element = ownerDocument.elementFromPoint(point.x, point.y)
    const cell = getCellFromTarget(element)
    setHoverSourcePath(sourcePathForCell(cell), cell)
  }, [
    sourceLinkActions,
    tableRef,
    getCellFromTarget,
    setHoverSourcePath,
    sourcePathForCell,
  ])

  const handleScrollEnd = React.useCallback(() => {
    hoverStateRef.current = {
      phase: hoverStateRef.current.sourcePath ? "hovering" : "idle",
      pointerPoint: hoverStateRef.current.pointerPoint,
      sourcePath: hoverStateRef.current.sourcePath,
    }
    cancelPendingScrollHover()
    latestScrollHoverAtRef.current = Number.NEGATIVE_INFINITY
    restoreHoverSourceAtPointer()
  }, [cancelPendingScrollHover, restoreHoverSourceAtPointer])

  const handleScrollMove = React.useCallback(() => {
    if (!sourceLinkActions || pendingScrollHoverFrameRef.current !== null) {
      return
    }
    const now = performance.now()
    if (
      now - latestScrollHoverAtRef.current <
      SCROLL_SOURCE_HOVER_INTERVAL_MS
    ) {
      return
    }
    pendingScrollHoverFrameRef.current = requestAnimationFrame(() => {
      pendingScrollHoverFrameRef.current = null
      latestScrollHoverAtRef.current = performance.now()
      restoreHoverSourceAtPointer()
    })
  }, [sourceLinkActions, restoreHoverSourceAtPointer])

  const handleFocus = React.useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      if (!sourceLinkActions) return
      const cell = getCellFromTarget(event.target)
      if (!cell) return
      const sourcePath = sourcePathForCell(cell)
      hoverStateRef.current = {
        phase: sourcePath ? "hovering" : "idle",
        pointerPoint: hoverStateRef.current.pointerPoint,
        sourcePath,
      }
      setActiveSourceCell(cell)
      sourceLinkActions.onSourceHover(sourcePath)
    },
    [
      sourceLinkActions,
      getCellFromTarget,
      setActiveSourceCell,
      sourcePathForCell,
    ]
  )

  const handleBlur = React.useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      if (!sourceLinkActions) return
      const cell = getCellFromTarget(event.target)
      if (!cell || cell.contains(event.relatedTarget as Node | null)) return
      hoverStateRef.current = {
        phase: "idle",
        pointerPoint: hoverStateRef.current.pointerPoint,
        sourcePath: null,
      }
      setActiveSourceCell(null)
      sourceLinkActions.onSourceHover(null)
    },
    [sourceLinkActions, getCellFromTarget, setActiveSourceCell]
  )

  return {
    sourceLinked,
    getCellFromTarget,
    selectCellSource,
    handlePointerMove,
    handlePointerLeave,
    handleFocus,
    handleBlur,
    handleScrollStart,
    handleScrollMove,
    handleScrollEnd,
  }
}
