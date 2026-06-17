"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { SourceFieldLink } from "@/components/ui/source-field-link"

export type JsonFormSourceLink = SourceFieldLink
export type SourceFieldLinkActions = Omit<SourceFieldLink, "activePath">

const SourceFieldActivePathContext = React.createContext<string | null>(null)
const SourceFieldActionsContext =
  React.createContext<SourceFieldLinkActions | null>(null)

type SourceTableCell = HTMLElement

export function JsonFormSourceLinkProvider({
  sourceLink,
  children,
}: {
  sourceLink?: JsonFormSourceLink
  children: React.ReactNode
}) {
  const onFieldHover = sourceLink?.onFieldHover
  const selectField = sourceLink?.selectField
  const sourceFieldActions = React.useMemo<SourceFieldLinkActions | null>(
    () => (onFieldHover ? { onFieldHover, selectField } : null),
    [onFieldHover, selectField]
  )

  return (
    <SourceFieldActionsContext.Provider value={sourceFieldActions}>
      <SourceFieldActivePathContext.Provider
        value={sourceLink?.activePath ?? null}
      >
        {children}
      </SourceFieldActivePathContext.Provider>
    </SourceFieldActionsContext.Provider>
  )
}

export function useSourceFieldActivePath(): string | null {
  return React.useContext(SourceFieldActivePathContext)
}

export function useSourceFieldActions(): SourceFieldLinkActions | null {
  return React.useContext(SourceFieldActionsContext)
}

export function useSourceLinkedTableCells({
  tableRef,
  refreshKey,
}: {
  tableRef: React.RefObject<HTMLElement | null>
  refreshKey: unknown
}) {
  const activePath = useSourceFieldActivePath()
  const sourceFieldActions = useSourceFieldActions()
  const sourceLinked = Boolean(sourceFieldActions)
  const activeSourceCellRef = React.useRef<Element | null>(null)
  const hoveredSourcePathRef = React.useRef<string | null>(null)
  const pendingHoverPathRef = React.useRef<string | null>(null)
  const pendingHoverFrameRef = React.useRef<number | null>(null)
  const pendingScrollHoverFrameRef = React.useRef<number | null>(null)
  const latestPointerPointRef = React.useRef<{ x: number; y: number } | null>(
    null
  )
  const isScrollingRef = React.useRef(false)

  const setActiveSourceCell = React.useCallback((cell: Element | null) => {
    if (activeSourceCellRef.current === cell) return
    activeSourceCellRef.current?.removeAttribute("data-anchor-active")
    if (cell) cell.setAttribute("data-anchor-active", "true")
    activeSourceCellRef.current = cell
  }, [])

  React.useEffect(() => {
    if (!sourceLinked || !activePath) {
      setActiveSourceCell(null)
      return
    }
    if (
      hoveredSourcePathRef.current === activePath &&
      activeSourceCellRef.current?.getAttribute("data-anchor-path") ===
        activePath
    ) {
      return
    }

    const table = tableRef.current
    if (!table) return
    for (const cell of table.querySelectorAll("[data-anchor-path]")) {
      if (cell.getAttribute("data-anchor-path") === activePath) {
        setActiveSourceCell(cell)
        return
      }
    }
    setActiveSourceCell(null)
  }, [activePath, sourceLinked, refreshKey, setActiveSourceCell, tableRef])

  const getCellFromTarget = React.useCallback(
    (target: EventTarget | null): SourceTableCell | null => {
      if (!(target instanceof Element)) return null
      const cell = target.closest<SourceTableCell>("[data-table-cell]")
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
      if (!sourceFieldActions) return
      pendingHoverPathRef.current = path
      if (pendingHoverFrameRef.current !== null) return
      pendingHoverFrameRef.current = requestAnimationFrame(() => {
        pendingHoverFrameRef.current = null
        sourceFieldActions.onFieldHover(pendingHoverPathRef.current)
      })
    },
    [sourceFieldActions]
  )

  const setHoveredSourcePath = React.useCallback(
    (path: string | null, cell: Element | null) => {
      if (!sourceFieldActions) return
      if (hoveredSourcePathRef.current === path) return
      hoveredSourcePathRef.current = path
      setActiveSourceCell(cell)
      reportHoveredSourcePath(path)
    },
    [sourceFieldActions, reportHoveredSourcePath, setActiveSourceCell]
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
      const sourcePath = cell?.dataset.anchorPath
      if (!sourcePath) return false
      cancelPendingHover()
      sourceFieldActions?.selectField?.(sourcePath)
      return true
    },
    [cancelPendingHover, sourceFieldActions]
  )

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!sourceFieldActions) return
      latestPointerPointRef.current = {
        x: event.clientX,
        y: event.clientY,
      }
      if (isScrollingRef.current) return
      const cell = getCellFromTarget(event.target)
      setHoveredSourcePath(cell?.dataset.anchorPath ?? null, cell)
    },
    [sourceFieldActions, getCellFromTarget, setHoveredSourcePath]
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
    if (!sourceFieldActions) return
    const point = latestPointerPointRef.current
    if (!point) return
    const ownerDocument = tableRef.current?.ownerDocument
    if (!ownerDocument) return
    const element = ownerDocument.elementFromPoint(point.x, point.y)
    const cell = getCellFromTarget(element)
    setHoveredSourcePath(cell?.dataset.anchorPath ?? null, cell)
  }, [sourceFieldActions, tableRef, getCellFromTarget, setHoveredSourcePath])

  const handleScrollEnd = React.useCallback(() => {
    isScrollingRef.current = false
    cancelPendingScrollHover()
    restoreHoveredSourceAtPointer()
  }, [cancelPendingScrollHover, restoreHoveredSourceAtPointer])

  const handleScrollMove = React.useCallback(() => {
    if (!sourceFieldActions || pendingScrollHoverFrameRef.current !== null) {
      return
    }
    pendingScrollHoverFrameRef.current = requestAnimationFrame(() => {
      pendingScrollHoverFrameRef.current = null
      restoreHoveredSourceAtPointer()
    })
  }, [sourceFieldActions, restoreHoveredSourceAtPointer])

  const handleFocus = React.useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      if (!sourceFieldActions) return
      const cell = getCellFromTarget(event.target)
      if (!cell) return
      hoveredSourcePathRef.current = cell.dataset.anchorPath ?? null
      setActiveSourceCell(cell)
      sourceFieldActions.onFieldHover(cell.dataset.anchorPath ?? null)
    },
    [sourceFieldActions, getCellFromTarget, setActiveSourceCell]
  )

  const handleBlur = React.useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      if (!sourceFieldActions) return
      const cell = getCellFromTarget(event.target)
      if (!cell || cell.contains(event.relatedTarget as Node | null)) return
      hoveredSourcePathRef.current = null
      setActiveSourceCell(null)
      sourceFieldActions.onFieldHover(null)
    },
    [sourceFieldActions, getCellFromTarget, setActiveSourceCell]
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
export function SourceFieldLinkShell({
  name,
  children,
}: {
  name: string
  children: React.ReactNode
}) {
  const activePath = useSourceFieldActivePath()
  const sourceFieldActions = useSourceFieldActions()
  if (!sourceFieldActions) return <>{children}</>
  const active = activePath === name

  return (
    <div
      onMouseEnter={() => sourceFieldActions.onFieldHover(name)}
      onMouseLeave={() => sourceFieldActions.onFieldHover(null)}
      onFocus={() => sourceFieldActions.onFieldHover(name)}
      onBlur={() => sourceFieldActions.onFieldHover(null)}
      onClick={() => sourceFieldActions.selectField?.(name)}
      onKeyDownCapture={(event) => {
        if (shouldSelectSourceFromKeyDown(event)) {
          sourceFieldActions.selectField?.(name)
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
