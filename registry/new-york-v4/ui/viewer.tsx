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
  canToggleSidebar: boolean
  mode: ViewerSidebarMode
  sidebarId: string
}

type ViewerSidebarSide = "left" | "right"
type ViewerSidebarCollapsible = "offcanvas" | "none"
type ViewerSidebarRegistration = {
  collapsible: ViewerSidebarCollapsible
  element: HTMLElement
  id: string
  instanceId: string
  side: ViewerSidebarSide
  width: string
}

type ViewerSidebarInternalContextValue = {
  publicSidebar: ViewerSidebarContextValue
  registerSidebar: (registration: ViewerSidebarRegistration) => () => void
  rootId: string
  sidebarSide: ViewerSidebarSide
  setLastTriggerElement: (element: HTMLElement | null) => void
}

const VIEWER_SIDEBAR_INLINE_BREAKPOINT = 768
const VIEWER_SIDEBAR_MODE_HYSTERESIS = 16
const VIEWER_SIDEBAR_WIDTH = "10rem"

const ViewerSidebarContext =
  React.createContext<ViewerSidebarContextValue | null>(null)
const ViewerSidebarInternalContext =
  React.createContext<ViewerSidebarInternalContextValue | null>(null)

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

function resolveMeasuredSidebarMode({
  currentMode,
  hasMeasured,
  inlineBreakpoint,
  requestedMode,
  width,
}: {
  currentMode: ViewerSidebarMode
  hasMeasured: boolean
  inlineBreakpoint: number
  requestedMode: ViewerSidebarRequestedMode
  width: number
}): ViewerSidebarMode {
  if (requestedMode !== "auto") return requestedMode
  if (!hasMeasured) {
    return width >= inlineBreakpoint ? "inline" : "overlay"
  }

  if (currentMode === "inline") {
    return width < inlineBreakpoint - VIEWER_SIDEBAR_MODE_HYSTERESIS
      ? "overlay"
      : "inline"
  }

  return width > inlineBreakpoint + VIEWER_SIDEBAR_MODE_HYSTERESIS
    ? "inline"
    : "overlay"
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

function useOptionalViewerSidebarInternal(): ViewerSidebarInternalContextValue | null {
  return React.useContext(ViewerSidebarInternalContext)
}

function useViewerSidebarInternal(): ViewerSidebarInternalContextValue {
  const context = React.useContext(ViewerSidebarInternalContext)
  if (!context) {
    throw new Error("useViewerSidebar must be used within a ViewerRoot.")
  }
  return context
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
  const rootId = `${reactId}-viewer-root`
  const fallbackSidebarId = `${reactId}-viewer-sidebar`
  const isControlled = sidebarOpenProp !== undefined
  const [internalOpen, setInternalOpen] = React.useState(defaultSidebarOpen)
  const open = sidebarOpenProp ?? internalOpen
  const openRef = React.useRef(open)
  const hasMeasuredSidebarWidthRef = React.useRef(false)
  const lastTriggerElementRef = React.useRef<HTMLElement | null>(null)
  const registeredSidebarRef = React.useRef<ViewerSidebarRegistration | null>(
    null
  )
  const [registeredSidebar, setRegisteredSidebar] =
    React.useState<ViewerSidebarRegistration | null>(null)
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

      setResolvedSidebarMode((currentMode) => {
        const nextMode = resolveMeasuredSidebarMode({
          currentMode,
          hasMeasured: hasMeasuredSidebarWidthRef.current,
          requestedMode: sidebarMode,
          width: nextWidth,
          inlineBreakpoint: sidebarInlineBreakpoint,
        })

        hasMeasuredSidebarWidthRef.current = true
        return currentMode === nextMode ? currentMode : nextMode
      })
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

      if (nextOpen === previousOpen) {
        return
      }

      if (!isControlled) {
        openRef.current = nextOpen
        setInternalOpen(nextOpen)
      }
      onSidebarOpenChange?.(nextOpen)
    },
    [isControlled, onSidebarOpenChange, open]
  )

  const registerSidebar = React.useCallback(
    (registration: ViewerSidebarRegistration) => {
      const currentRegistration = registeredSidebarRef.current

      if (
        currentRegistration &&
        currentRegistration.instanceId !== registration.instanceId
      ) {
        throw new Error(
          "ViewerRoot supports one primary ViewerSidebar. Use a nested ViewerRoot for a complete nested viewer, or put secondary content inside ViewerSurface."
        )
      }

      registeredSidebarRef.current = registration
      setRegisteredSidebar(registration)

      return () => {
        if (
          registeredSidebarRef.current?.instanceId !== registration.instanceId
        ) {
          return
        }

        registeredSidebarRef.current = null
        setRegisteredSidebar(null)
      }
    },
    []
  )

  const toggleSidebar = React.useCallback(() => {
    setOpen((currentOpen) => !currentOpen)
  }, [setOpen])

  const state: ViewerSidebarState = open ? "expanded" : "collapsed"
  const canToggleSidebar =
    registeredSidebar !== null && registeredSidebar.collapsible !== "none"
  const sidebarId = registeredSidebar?.id ?? fallbackSidebarId
  const sidebarSide = registeredSidebar?.side ?? "left"
  const sidebarWidth = registeredSidebar?.width ?? VIEWER_SIDEBAR_WIDTH
  const setLastTriggerElement = React.useCallback(
    (element: HTMLElement | null) => {
      lastTriggerElementRef.current = element
    },
    []
  )

  React.useEffect(() => {
    if (
      !open ||
      !canToggleSidebar ||
      resolvedSidebarMode !== "overlay" ||
      typeof document === "undefined"
    ) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        const triggerElement =
          lastTriggerElementRef.current?.isConnected === true
            ? lastTriggerElementRef.current
            : rootRef.current?.querySelector<HTMLElement>(
                "[data-viewer-sidebar-trigger]"
              )
        triggerElement?.focus()
      }
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (
        target instanceof Node &&
        registeredSidebar?.element.contains(target)
      ) {
        return
      }

      if (target instanceof Element) {
        const triggerElement = target.closest<HTMLElement>(
          "[data-viewer-sidebar-trigger]"
        )
        if (triggerElement?.dataset.viewerRootId === rootId) {
          return
        }
      }

      setOpen(false)
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("pointerdown", handlePointerDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [
    canToggleSidebar,
    open,
    registeredSidebar,
    resolvedSidebarMode,
    rootId,
    setOpen,
  ])

  const sidebarContext = React.useMemo<ViewerSidebarContextValue>(
    () => ({
      state,
      open,
      setOpen,
      toggleSidebar,
      canToggleSidebar,
      mode: resolvedSidebarMode,
      sidebarId,
    }),
    [
      state,
      open,
      setOpen,
      toggleSidebar,
      canToggleSidebar,
      resolvedSidebarMode,
      sidebarId,
    ]
  )

  const sidebarInternalContext =
    React.useMemo<ViewerSidebarInternalContextValue>(
      () => ({
        publicSidebar: sidebarContext,
        registerSidebar,
        rootId,
        sidebarSide,
        setLastTriggerElement,
      }),
      [
        sidebarContext,
        registerSidebar,
        rootId,
        sidebarSide,
        setLastTriggerElement,
      ]
    )

  return (
    <ViewerSidebarContext.Provider value={sidebarContext}>
      <ViewerSidebarInternalContext.Provider value={sidebarInternalContext}>
        <div
          ref={rootRef}
          data-slot="viewer-root"
          data-viewer-root-id={rootId}
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
              "--viewer-sidebar-width": sidebarWidth,
              ...style,
            } as React.CSSProperties
          }
          {...props}
        />
      </ViewerSidebarInternalContext.Provider>
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
  side?: ViewerSidebarSide
  collapsible?: ViewerSidebarCollapsible
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
  const sidebar = useOptionalViewerSidebarInternal()
  const publicSidebar = sidebar?.publicSidebar
  const reactId = React.useId()
  const instanceId = `${reactId}-viewer-sidebar-instance`
  const sidebarId = `${reactId}-viewer-sidebar`
  const sidebarRef = React.useRef<HTMLElement | null>(null)
  const collapsible = collapsibleProp ?? (sidebar ? "offcanvas" : "none")
  const open = collapsible === "none" ? true : (publicSidebar?.open ?? true)
  const state: ViewerSidebarState = open ? "expanded" : "collapsed"
  const mode = publicSidebar?.mode ?? "inline"
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

  useIsoLayoutEffect(() => {
    const element = sidebarRef.current

    if (!sidebar || !element) {
      return
    }

    return sidebar.registerSidebar({
      collapsible,
      element,
      id: sidebarId,
      instanceId,
      side,
      width,
    })
  }, [collapsible, instanceId, side, sidebar, sidebarId, width])

  const hiddenProps = isCollapsed
    ? ({
        "aria-hidden": true,
        inert: true,
      } as React.HTMLAttributes<HTMLElement>)
    : {}

  return (
    <aside
      ref={sidebarRef}
      id={sidebarId}
      data-slot="viewer-sidebar"
      data-collapsible={collapsible}
      data-side={side}
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

export type ViewerSurfaceProps = React.ComponentProps<"div">

export function ViewerSurface({ className, ...props }: ViewerSurfaceProps) {
  return (
    <div
      data-slot="viewer-surface"
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}
      {...props}
    />
  )
}

export type ViewerSidebarTriggerProps = ButtonProps

export function ViewerSidebarTrigger({
  className,
  disabled,
  loading,
  onClick,
  onPointerDown,
  children,
  size = "icon",
  variant = "ghost",
  "aria-label": ariaLabel = "Toggle sidebar",
  ...props
}: ViewerSidebarTriggerProps) {
  const { publicSidebar, rootId, sidebarSide, setLastTriggerElement } =
    useViewerSidebarInternal()
  const { canToggleSidebar, open, sidebarId, state, toggleSidebar } =
    publicSidebar
  const ariaDisabled = props["aria-disabled"]
  const isDisabled = Boolean(
    disabled || loading || isAriaDisabled(ariaDisabled) || !canToggleSidebar
  )
  const Icon = sidebarSide === "right" ? PanelRight : PanelLeft

  return (
    <Button
      aria-controls={sidebarId}
      aria-disabled={isDisabled ? true : ariaDisabled}
      aria-expanded={open}
      aria-label={ariaLabel}
      className={cn("size-8", className)}
      data-side={sidebarSide}
      data-slot="viewer-sidebar-trigger"
      data-state={state}
      data-viewer-root-id={rootId}
      data-viewer-sidebar-trigger=""
      disabled={disabled}
      loading={loading}
      onClick={(event) => {
        setLastTriggerElement(event.currentTarget)
        if (isDisabled) {
          event.preventDefault()
          return
        }

        onClick?.(event)
        if (!event.defaultPrevented) {
          toggleSidebar()
        }
      }}
      onPointerDown={(event) => {
        setLastTriggerElement(event.currentTarget)
        onPointerDown?.(event)
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
