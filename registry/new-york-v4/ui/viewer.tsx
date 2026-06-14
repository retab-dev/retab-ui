"use client"

import * as React from "react"
import { PanelLeft, PanelRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, type ButtonProps } from "@/components/ui/button"

export type ViewerRootProps = React.ComponentProps<"div"> & {
  bare?: boolean
  defaultSidebarOpen?: boolean
  sidebarOpen?: boolean
  onSidebarOpenChange?: (open: boolean) => void
  sidebarMode?: ViewerSidebarRequestedMode
  sidebarInlineBreakpoint?: number
}

export type ViewerSidebarMode = "inline" | "overlay"
export type ViewerSidebarRequestedMode = "auto" | ViewerSidebarMode
export type ViewerSidebarState = "expanded" | "collapsed"

export type ViewerSidebarContextValue = {
  state: ViewerSidebarState
  open: boolean
  setOpen: (value: boolean | ((open: boolean) => boolean)) => void
  toggleSidebar: () => void
  mode: ViewerSidebarMode
  requestedMode: ViewerSidebarRequestedMode
  sidebarId: string
}

const VIEWER_SIDEBAR_INLINE_BREAKPOINT = 768
const VIEWER_SIDEBAR_WIDTH = "10rem"

const ViewerSidebarContext =
  React.createContext<ViewerSidebarContextValue | null>(null)

function resolveSidebarMode({
  requestedMode,
  width,
  inlineBreakpoint,
}: {
  requestedMode: ViewerSidebarRequestedMode
  width: number | null
  inlineBreakpoint: number
}): ViewerSidebarMode {
  if (requestedMode !== "auto") return requestedMode
  if (width === null) return "overlay"
  return width >= inlineBreakpoint ? "inline" : "overlay"
}

function useIsoLayoutEffect(
  effect: React.EffectCallback,
  deps: React.DependencyList
) {
  const useEffect =
    typeof window === "undefined" ? React.useEffect : React.useLayoutEffect
  useEffect(effect, deps)
}

function isAriaDisabled(value: unknown): boolean {
  return value === true || value === "true"
}

export function useViewerSidebar(): ViewerSidebarContextValue {
  const context = React.useContext(ViewerSidebarContext)
  if (!context) {
    throw new Error("useViewerSidebar must be used within a ViewerRoot.")
  }
  return context
}

export function useOptionalViewerSidebar(): ViewerSidebarContextValue | null {
  return React.useContext(ViewerSidebarContext)
}

export function ViewerRoot({
  bare = false,
  className,
  style,
  defaultSidebarOpen = false,
  sidebarOpen: sidebarOpenProp,
  onSidebarOpenChange,
  sidebarMode = "auto",
  sidebarInlineBreakpoint = VIEWER_SIDEBAR_INLINE_BREAKPOINT,
  ...props
}: ViewerRootProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const reactId = React.useId()
  const sidebarId = `${reactId}-viewer-sidebar`
  const isControlled = sidebarOpenProp !== undefined
  const [internalOpen, setInternalOpen] = React.useState(defaultSidebarOpen)
  const open = sidebarOpenProp ?? internalOpen
  const openRef = React.useRef(open)
  const [resolvedSidebarMode, setResolvedSidebarMode] =
    React.useState<ViewerSidebarMode>(() =>
      resolveSidebarMode({
        requestedMode: sidebarMode,
        width: null,
        inlineBreakpoint: sidebarInlineBreakpoint,
      })
    )

  React.useEffect(() => {
    openRef.current = open
  }, [open])

  React.useEffect(() => {
    if (sidebarMode === "auto") return
    setResolvedSidebarMode((currentMode) => {
      const nextMode = sidebarMode
      return currentMode === nextMode ? currentMode : nextMode
    })
  }, [sidebarMode])

  useIsoLayoutEffect(() => {
    const element = rootRef.current
    const ResizeObserverConstructor = globalThis.ResizeObserver
    if (!element || typeof ResizeObserverConstructor === "undefined") return
    if (sidebarMode !== "auto") {
      setResolvedSidebarMode(sidebarMode)
      return
    }

    const updateMode = () => {
      const nextWidth = element.getBoundingClientRect().width
      if (nextWidth === 0) return

      const nextMode = resolveSidebarMode({
        requestedMode: sidebarMode,
        width: nextWidth,
        inlineBreakpoint: sidebarInlineBreakpoint,
      })
      setResolvedSidebarMode((currentMode) =>
        currentMode === nextMode ? currentMode : nextMode
      )
    }

    updateMode()

    const observer = new ResizeObserverConstructor(updateMode)
    observer.observe(element)

    return () => observer.disconnect()
  }, [sidebarInlineBreakpoint, sidebarMode])

  const setOpen = React.useCallback(
    (value: boolean | ((open: boolean) => boolean)) => {
      const previousOpen = isControlled ? open : openRef.current
      const nextOpen = typeof value === "function" ? value(previousOpen) : value

      if (!isControlled) {
        openRef.current = nextOpen
        setInternalOpen(nextOpen)
      }
      onSidebarOpenChange?.(nextOpen)
    },
    [isControlled, onSidebarOpenChange, open]
  )

  const toggleSidebar = React.useCallback(() => {
    setOpen((currentOpen) => !currentOpen)
  }, [setOpen])

  const state: ViewerSidebarState = open ? "expanded" : "collapsed"
  const sidebarContext = React.useMemo<ViewerSidebarContextValue>(
    () => ({
      state,
      open,
      setOpen,
      toggleSidebar,
      mode: resolvedSidebarMode,
      requestedMode: sidebarMode,
      sidebarId,
    }),
    [
      state,
      open,
      setOpen,
      toggleSidebar,
      resolvedSidebarMode,
      sidebarMode,
      sidebarId,
    ]
  )

  return (
    <ViewerSidebarContext.Provider value={sidebarContext}>
      <div
        ref={rootRef}
        data-slot="viewer-root"
        data-viewer-sidebar-mode={resolvedSidebarMode}
        data-viewer-sidebar-open={open ? "true" : "false"}
        data-viewer-sidebar-state={state}
        className={cn(
          "relative flex min-h-0 flex-col overflow-hidden",
          bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
          className
        )}
        style={
          {
            "--viewer-sidebar-width": VIEWER_SIDEBAR_WIDTH,
            ...style,
          } as React.CSSProperties
        }
        {...props}
      />
    </ViewerSidebarContext.Provider>
  )
}

export function ViewerHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="viewer-header"
      className={cn("flex-shrink-0 border-b bg-card", className)}
      {...props}
    />
  )
}

export function ViewerBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const sidebar = useOptionalViewerSidebar()
  return (
    <div
      data-slot="viewer-body"
      data-viewer-sidebar-mode={sidebar?.mode}
      data-viewer-sidebar-open={
        sidebar ? (sidebar.open ? "true" : "false") : undefined
      }
      data-viewer-sidebar-state={sidebar?.state}
      className={cn("relative flex min-h-0 flex-1 overflow-hidden", className)}
      {...props}
    />
  )
}

export type ViewerSidebarProps = React.ComponentProps<"aside"> & {
  side?: "left" | "right"
  collapsible?: "offcanvas" | "none"
  width?: string
}

export function ViewerSidebar({
  className,
  side = "left",
  collapsible: collapsibleProp,
  width = VIEWER_SIDEBAR_WIDTH,
  style,
  ...props
}: ViewerSidebarProps) {
  const sidebar = useOptionalViewerSidebar()
  const sidebarRef = React.useRef<HTMLElement | null>(null)
  const collapsible = collapsibleProp ?? (sidebar ? "offcanvas" : "none")
  const open = collapsible === "none" ? true : (sidebar?.open ?? true)
  const state: ViewerSidebarState = open ? "expanded" : "collapsed"
  const mode = sidebar?.mode ?? "inline"
  const isCollapsed = collapsible !== "none" && !open

  React.useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.requestAnimationFrame !== "function"
    ) {
      sidebarRef.current?.setAttribute(
        "data-viewer-sidebar-transitions",
        "ready"
      )
      return
    }
    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        sidebarRef.current?.setAttribute(
          "data-viewer-sidebar-transitions",
          "ready"
        )
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [])

  const hiddenProps = isCollapsed
    ? ({
        "aria-hidden": true,
        inert: true,
      } as React.HTMLAttributes<HTMLElement>)
    : {}

  return (
    <aside
      ref={sidebarRef}
      id={sidebar?.sidebarId}
      data-slot="viewer-sidebar"
      data-collapsible={collapsible}
      data-side={side}
      data-state={state}
      data-viewer-sidebar-mode={mode}
      data-viewer-sidebar-open={open ? "true" : "false"}
      data-viewer-sidebar-state={state}
      className={cn(
        "z-30 min-h-0 w-(--viewer-sidebar-width) flex-shrink-0 overflow-hidden bg-background",
        "transition-none data-[viewer-sidebar-transitions=ready]:transition-[translate,margin-left,margin-right,border-color] data-[viewer-sidebar-transitions=ready]:duration-200 data-[viewer-sidebar-transitions=ready]:ease-out",
        collapsible === "none" &&
          "relative translate-x-0 shadow-none data-[side=right]:order-last",
        collapsible === "offcanvas" &&
          mode === "inline" &&
          "relative translate-x-0 shadow-none data-[side=right]:order-last",
        collapsible === "offcanvas" &&
          mode === "inline" &&
          !open &&
          side === "left" &&
          "-ml-(--viewer-sidebar-width) border-transparent",
        collapsible === "offcanvas" &&
          mode === "inline" &&
          !open &&
          side === "right" &&
          "-mr-(--viewer-sidebar-width) border-transparent",
        collapsible === "offcanvas" &&
          mode === "overlay" &&
          "absolute inset-y-0 shadow-lg",
        collapsible === "offcanvas" &&
          mode === "overlay" &&
          side === "left" &&
          "left-0",
        collapsible === "offcanvas" &&
          mode === "overlay" &&
          side === "right" &&
          "right-0 order-last",
        collapsible === "offcanvas" &&
          mode === "overlay" &&
          !open &&
          side === "left" &&
          "pointer-events-none -translate-x-full border-transparent",
        collapsible === "offcanvas" &&
          mode === "overlay" &&
          !open &&
          side === "right" &&
          "pointer-events-none translate-x-full border-transparent",
        className
      )}
      style={
        {
          "--viewer-sidebar-width": width,
          ...style,
        } as React.CSSProperties
      }
      {...hiddenProps}
      {...props}
    />
  )
}

export function ViewerSurface({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="viewer-surface"
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}
      {...props}
    />
  )
}

export type ViewerSidebarTriggerProps = ButtonProps & {
  side?: "left" | "right"
}

export function ViewerSidebarTrigger({
  side = "left",
  className,
  disabled,
  loading,
  onClick,
  children,
  size = "icon",
  variant = "ghost",
  "aria-label": ariaLabel = "Toggle sidebar",
  ...props
}: ViewerSidebarTriggerProps) {
  const { open, sidebarId, state, toggleSidebar } = useViewerSidebar()
  const ariaDisabled = props["aria-disabled"]
  const isDisabled = Boolean(
    disabled || loading || isAriaDisabled(ariaDisabled)
  )
  const Icon = side === "right" ? PanelRight : PanelLeft

  return (
    <Button
      aria-controls={sidebarId}
      aria-disabled={isDisabled ? true : ariaDisabled}
      aria-expanded={open}
      aria-label={ariaLabel}
      className={cn("size-8", className)}
      data-side={side}
      data-slot="viewer-sidebar-trigger"
      data-state={state}
      data-viewer-sidebar-trigger=""
      disabled={disabled}
      loading={loading}
      onClick={(event) => {
        if (isDisabled) {
          event.preventDefault()
          return
        }

        onClick?.(event)
        if (!event.defaultPrevented) {
          toggleSidebar()
        }
      }}
      size={size}
      variant={variant}
      {...props}
    >
      {children ?? (
        <>
          <Icon />
          <span className="sr-only">Toggle sidebar</span>
        </>
      )}
    </Button>
  )
}
