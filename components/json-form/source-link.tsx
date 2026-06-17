"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { SourceFieldLink } from "@/components/ui/source-field-link"

export type JsonFormSourceLink = SourceFieldLink
export type JsonFormSourceLinkActions = Omit<SourceFieldLink, "activePath">

const ActiveSourcePathContext = React.createContext<string | null>(null)
const SourceLinkActionsContext =
  React.createContext<JsonFormSourceLinkActions | null>(null)

type SourceTableCell = HTMLElement
const SOURCE_PATH_ATTRIBUTE = "data-source-path"
const SOURCE_ACTIVE_ATTRIBUTE = "data-source-active"
const SOURCE_CELL_SELECTOR = `[${SOURCE_PATH_ATTRIBUTE}]`
const TABLE_CELL_SELECTOR = "[data-table-cell]"
const SCROLL_SOURCE_HOVER_INTERVAL_MS = 32

export function JsonFormSourceLinkProvider({
  sourceLink,
  children,
}: {
  sourceLink?: JsonFormSourceLink
  children: React.ReactNode
}) {
  const onFieldHover = sourceLink?.onFieldHover
  const selectField = sourceLink?.selectField
  const sourceLinkActions = React.useMemo<JsonFormSourceLinkActions | null>(
    () => (onFieldHover ? { onFieldHover, selectField } : null),
    [onFieldHover, selectField]
  )

  return (
    <SourceLinkActionsContext.Provider value={sourceLinkActions}>
      <ActiveSourcePathContext.Provider
        value={sourceLink?.activePath ?? null}
      >
        {children}
      </ActiveSourcePathContext.Provider>
    </SourceLinkActionsContext.Provider>
  )
}

export function useActiveSourcePath(): string | null {
  return React.useContext(ActiveSourcePathContext)
}

export function useSourceLinkActions(): JsonFormSourceLinkActions | null {
  return React.useContext(SourceLinkActionsContext)
}

export function useSourceLinkedTableCells({
  tableRef,
  refreshKey,
}: {
  tableRef: React.RefObject<HTMLElement | null>
  refreshKey: unknown
}) {
  const activeSourcePath = useActiveSourcePath()
  const sourceLinkActions = useSourceLinkActions()
  const sourceLinked = Boolean(sourceLinkActions)
  const activeSourceCellRef = React.useRef<Element | null>(null)
  const hoveredSourcePathRef = React.useRef<string | null>(null)
  const pendingHoverPathRef = React.useRef<string | null>(null)
  const pendingHoverFrameRef = React.useRef<number | null>(null)
  const pendingScrollHoverFrameRef = React.useRef<number | null>(null)
  const latestScrollHoverAtRef = React.useRef(0)
  const latestPointerPointRef = React.useRef<{ x: number; y: number } | null>(
    null
  )
  const isScrollingRef = React.useRef(false)

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
      hoveredSourcePathRef.current === activeSourcePath &&
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
  }, [activeSourcePath, sourceLinked, refreshKey, setActiveSourceCell, tableRef])

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

  const reportHoveredSourcePath = React.useCallback(
    (path: string | null) => {
      if (!sourceLinkActions) return
      pendingHoverPathRef.current = path
      if (pendingHoverFrameRef.current !== null) return
      pendingHoverFrameRef.current = requestAnimationFrame(() => {
        pendingHoverFrameRef.current = null
        sourceLinkActions.onFieldHover(pendingHoverPathRef.current)
      })
    },
    [sourceLinkActions]
  )

  const setHoveredSourcePath = React.useCallback(
    (path: string | null, cell: Element | null) => {
      if (!sourceLinkActions) return
      if (hoveredSourcePathRef.current === path) return
      hoveredSourcePathRef.current = path
      setActiveSourceCell(cell)
      reportHoveredSourcePath(path)
    },
    [sourceLinkActions, reportHoveredSourcePath, setActiveSourceCell]
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
      sourceLinkActions?.selectField?.(sourcePath)
      return true
    },
    [cancelPendingHover, sourceLinkActions, sourcePathForCell]
  )

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!sourceLinkActions) return
      latestPointerPointRef.current = {
        x: event.clientX,
        y: event.clientY,
      }
      if (isScrollingRef.current) return
      const cell = getCellFromTarget(event.target)
      setHoveredSourcePath(sourcePathForCell(cell), cell)
    },
    [
      sourceLinkActions,
      getCellFromTarget,
      setHoveredSourcePath,
      sourcePathForCell,
    ]
  )

  const handlePointerLeave = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      latestPointerPointRef.current = {
        x: event.clientX,
        y: event.clientY,
      }
      setHoveredSourcePath(null, null)
    },
    [setHoveredSourcePath]
  )

  const handleScrollStart = React.useCallback(() => {
    isScrollingRef.current = true
  }, [])

  const restoreHoveredSourceAtPointer = React.useCallback(() => {
    if (!sourceLinkActions) return
    const point = latestPointerPointRef.current
    if (!point) return
    const ownerDocument = tableRef.current?.ownerDocument
    if (!ownerDocument) return
    const element = ownerDocument.elementFromPoint(point.x, point.y)
    const cell = getCellFromTarget(element)
    setHoveredSourcePath(sourcePathForCell(cell), cell)
  }, [
    sourceLinkActions,
    tableRef,
    getCellFromTarget,
    setHoveredSourcePath,
    sourcePathForCell,
  ])

  const handleScrollEnd = React.useCallback(() => {
    isScrollingRef.current = false
    cancelPendingScrollHover()
    latestScrollHoverAtRef.current = 0
    restoreHoveredSourceAtPointer()
  }, [cancelPendingScrollHover, restoreHoveredSourceAtPointer])

  const handleScrollMove = React.useCallback(() => {
    if (!sourceLinkActions || pendingScrollHoverFrameRef.current !== null) {
      return
    }
    const now = performance.now()
    if (now - latestScrollHoverAtRef.current < SCROLL_SOURCE_HOVER_INTERVAL_MS) {
      return
    }
    pendingScrollHoverFrameRef.current = requestAnimationFrame(() => {
      pendingScrollHoverFrameRef.current = null
      latestScrollHoverAtRef.current = performance.now()
      restoreHoveredSourceAtPointer()
    })
  }, [sourceLinkActions, restoreHoveredSourceAtPointer])

  const handleFocus = React.useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      if (!sourceLinkActions) return
      const cell = getCellFromTarget(event.target)
      if (!cell) return
      const sourcePath = sourcePathForCell(cell)
      hoveredSourcePathRef.current = sourcePath
      setActiveSourceCell(cell)
      sourceLinkActions.onFieldHover(sourcePath)
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
      hoveredSourcePathRef.current = null
      setActiveSourceCell(null)
      sourceLinkActions.onFieldHover(null)
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

function shouldSelectSourceFromKeyDown(event: React.KeyboardEvent): boolean {
  if (event.defaultPrevented || event.key !== "Enter") return false
  return !(event.target instanceof HTMLTextAreaElement)
}

/**
 * Wraps a scalar leaf so it reports its source path on hover/focus and lights up
 * as a card when active. Without a source link, it renders children unchanged.
 */
export function SourceLinkShell({
  sourcePath,
  children,
}: {
  sourcePath: string
  children: React.ReactNode
}) {
  const activeSourcePath = useActiveSourcePath()
  const sourceLinkActions = useSourceLinkActions()
  if (!sourceLinkActions) return <>{children}</>
  const active = activeSourcePath === sourcePath

  return (
    <div
      onMouseEnter={() => sourceLinkActions.onFieldHover(sourcePath)}
      onMouseLeave={() => sourceLinkActions.onFieldHover(null)}
      onFocus={() => sourceLinkActions.onFieldHover(sourcePath)}
      onBlur={() => sourceLinkActions.onFieldHover(null)}
      onClick={() => sourceLinkActions.selectField?.(sourcePath)}
      onKeyDownCapture={(event) => {
        if (shouldSelectSourceFromKeyDown(event)) {
          sourceLinkActions.selectField?.(sourcePath)
        }
      }}
      className={cn(
        "rounded-md border px-3 py-2 transition-colors",
        active
          ? "border-primary/40 bg-primary/5"
          : "border-transparent hover:bg-muted/60"
      )}
    >
      {children}
    </div>
  )
}
