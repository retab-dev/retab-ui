"use client"

import * as React from "react"
import { PanelLeft, PanelRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, type ButtonProps } from "@/components/ui/button"

export type ViewerRootProps = React.ComponentProps<"div"> & {
  bare?: boolean
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  mode?: ViewerSidebarRequestedMode
  inlineBreakpoint?: number
  sidebarSide?: ViewerSidebarSide
  sidebarCollapsible?: ViewerSidebarCollapsible
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

type ViewerSidebarRegistrationContextValue = {
  defaultSidebarCollapsible: ViewerSidebarCollapsible
  defaultSidebarSide: ViewerSidebarSide
  hasSidebar: boolean
  sidebarState: ViewerSidebarContextValue
  registerSidebar: (registration: ViewerSidebarRegistration) => () => void
  rootId: string
  sidebarId: string
  sidebarSide: ViewerSidebarSide
  setLastTriggerElement: (element: HTMLElement | null) => void
}

const VIEWER_SIDEBAR_INLINE_BREAKPOINT = 768
const VIEWER_SIDEBAR_MODE_HYSTERESIS = 16
const VIEWER_SIDEBAR_WIDTH = "10rem"

const ViewerSidebarStateContext =
  React.createContext<ViewerSidebarContextValue | null>(null)
const ViewerSidebarRegistrationContext =
  React.createContext<ViewerSidebarRegistrationContextValue | null>(null)

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

const useIsoLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

function isAriaDisabled(value: unknown): boolean {
  return value === true || value === "true"
}

export function useViewerSidebar(): ViewerSidebarContextValue {
  const context = React.useContext(ViewerSidebarStateContext)
  if (!context) {
    throw new Error("useViewerSidebar must be used within a ViewerRoot.")
  }
  return context
}

export function useOptionalViewerSidebar(): ViewerSidebarContextValue | null {
  return React.useContext(ViewerSidebarStateContext)
}

function useViewerSidebarRegistrationContext(
  consumer: string
): ViewerSidebarRegistrationContextValue {
  const context = React.useContext(ViewerSidebarRegistrationContext)
  if (!context) {
    throw new Error(`${consumer} must be used within a ViewerRoot.`)
  }
  return context
}

export function ViewerRoot({
  bare = false,
  className,
  style,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  mode = "auto",
  inlineBreakpoint = VIEWER_SIDEBAR_INLINE_BREAKPOINT,
  sidebarSide = "left",
  sidebarCollapsible = "offcanvas",
  ...props
}: ViewerRootProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const reactId = React.useId()
  const rootId = `${reactId}-viewer-root`
  const fallbackSidebarId = `${reactId}-viewer-sidebar`
  const isControlled = openProp !== undefined
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const open = openProp ?? internalOpen
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
        requestedMode: mode,
        width: null,
        inlineBreakpoint,
      })
    )

  React.useEffect(() => {
    openRef.current = open
  }, [open])

  React.useEffect(() => {
    if (mode === "auto") return
    setResolvedSidebarMode((currentMode) => {
      const nextMode = mode
      return currentMode === nextMode ? currentMode : nextMode
    })
  }, [mode])

  useIsoLayoutEffect(() => {
    const element = rootRef.current
    const ResizeObserverConstructor = globalThis.ResizeObserver
    if (!element || typeof ResizeObserverConstructor === "undefined") return
    if (mode !== "auto") {
      setResolvedSidebarMode(mode)
      return
    }

    const updateMode = () => {
      const nextWidth = element.getBoundingClientRect().width
      if (nextWidth === 0) return

      setResolvedSidebarMode((currentMode) => {
        const nextMode = resolveMeasuredSidebarMode({
          currentMode,
          hasMeasured: hasMeasuredSidebarWidthRef.current,
          requestedMode: mode,
          width: nextWidth,
          inlineBreakpoint,
        })

        hasMeasuredSidebarWidthRef.current = true
        return currentMode === nextMode ? currentMode : nextMode
      })
    }

    updateMode()

    const observer = new ResizeObserverConstructor(updateMode)
    observer.observe(element)

    return () => observer.disconnect()
  }, [inlineBreakpoint, mode])

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
      onOpenChange?.(nextOpen)
    },
    [isControlled, onOpenChange, open]
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

  const hasSidebar = registeredSidebar !== null
  const effectiveOpen = registeredSidebar?.collapsible === "none" ? true : open
  const state: ViewerSidebarState = effectiveOpen ? "expanded" : "collapsed"
  const canToggleSidebar =
    hasSidebar && registeredSidebar.collapsible !== "none"
  const sidebarId = registeredSidebar?.id ?? fallbackSidebarId
  const resolvedSidebarSide = registeredSidebar?.side ?? sidebarSide
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

  const sidebarStateContext = React.useMemo<ViewerSidebarContextValue>(
    () => ({
      state,
      open: effectiveOpen,
      setOpen,
      toggleSidebar,
      canToggleSidebar,
      mode: resolvedSidebarMode,
    }),
    [
      state,
      effectiveOpen,
      setOpen,
      toggleSidebar,
      canToggleSidebar,
      resolvedSidebarMode,
    ]
  )

  const sidebarRegistrationContext =
    React.useMemo<ViewerSidebarRegistrationContextValue>(
      () => ({
        defaultSidebarCollapsible: sidebarCollapsible,
        defaultSidebarSide: sidebarSide,
        hasSidebar,
        sidebarState: sidebarStateContext,
        registerSidebar,
        rootId,
        sidebarId,
        sidebarSide: resolvedSidebarSide,
        setLastTriggerElement,
      }),
      [
        hasSidebar,
        sidebarCollapsible,
        resolvedSidebarSide,
        sidebarStateContext,
        registerSidebar,
        rootId,
        sidebarId,
        sidebarSide,
        setLastTriggerElement,
      ]
    )

  return (
    <ViewerSidebarStateContext.Provider value={sidebarStateContext}>
      <ViewerSidebarRegistrationContext.Provider
        value={sidebarRegistrationContext}
      >
        <div
          ref={rootRef}
          data-slot="viewer-root"
          data-viewer-root-id={rootId}
          className={cn(
            "relative flex min-h-0 flex-col overflow-hidden",
            bare ? "h-full" : "rounded-xl border bg-muted/30",
            className
          )}
          style={
            {
              ...style,
              "--viewer-sidebar-width": sidebarWidth,
            } as React.CSSProperties
          }
          {...props}
        />
      </ViewerSidebarRegistrationContext.Provider>
    </ViewerSidebarStateContext.Provider>
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
  return (
    <div
      data-slot="viewer-body"
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
  side: sideProp,
  collapsible: collapsibleProp,
  width = VIEWER_SIDEBAR_WIDTH,
  style,
  id: idProp,
  ...props
}: ViewerSidebarProps) {
  const registrationContext =
    useViewerSidebarRegistrationContext("ViewerSidebar")
  const {
    defaultSidebarCollapsible,
    defaultSidebarSide,
    registerSidebar,
    sidebarState,
  } = registrationContext
  const reactId = React.useId()
  const instanceId = `${reactId}-viewer-sidebar-instance`
  const generatedSidebarId = `${reactId}-viewer-sidebar`
  const sidebarId = idProp ?? generatedSidebarId
  const sidebarRef = React.useRef<HTMLElement | null>(null)
  const collapsible = collapsibleProp ?? defaultSidebarCollapsible
  const side = sideProp ?? defaultSidebarSide
  const open = collapsible === "none" ? true : sidebarState.open
  const state: ViewerSidebarState = open ? "expanded" : "collapsed"
  const mode = sidebarState.mode
  const isCollapsed = collapsible !== "none" && !open
  const styleWithoutWidth: React.CSSProperties = { ...style }
  delete styleWithoutWidth.width

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

    if (!element) {
      return
    }

    return registerSidebar({
      collapsible,
      element,
      id: sidebarId,
      instanceId,
      side,
      width,
    })
  }, [collapsible, instanceId, registerSidebar, side, sidebarId, width])

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
        "z-30 min-h-0 flex-shrink-0 overflow-hidden",
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
        className,
        "w-(--viewer-sidebar-width)"
      )}
      style={
        {
          ...styleWithoutWidth,
          "--viewer-sidebar-width": width,
        } as React.CSSProperties
      }
      {...props}
      {...hiddenProps}
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
  "aria-disabled": ariaDisabled,
  ...props
}: ViewerSidebarTriggerProps) {
  const {
    hasSidebar,
    sidebarState,
    rootId,
    sidebarId,
    sidebarSide,
    setLastTriggerElement,
  } = useViewerSidebarRegistrationContext("ViewerSidebarTrigger")
  const { canToggleSidebar, open, state, toggleSidebar } = sidebarState
  const isDisabled = Boolean(
    disabled || loading || isAriaDisabled(ariaDisabled) || !canToggleSidebar
  )
  const Icon = sidebarSide === "right" ? PanelRight : PanelLeft

  return (
    <Button
      aria-controls={hasSidebar ? sidebarId : undefined}
      aria-disabled={isDisabled ? true : ariaDisabled}
      aria-expanded={hasSidebar ? open : undefined}
      aria-label={ariaLabel}
      className={cn("size-8", className)}
      data-side={sidebarSide}
      data-slot="viewer-sidebar-trigger"
      data-state={state}
      data-viewer-root-id={rootId}
      data-viewer-sidebar-trigger=""
      disabled={isDisabled}
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
