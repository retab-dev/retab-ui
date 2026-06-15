"use client"

import * as React from "react"
import { Download, Maximize, Minus, Plus, RotateCw } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ViewerDownloadAction } from "@/lib/viewer-download"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ViewerDownloadControl,
  type ViewerDownloadErrorHandler,
} from "@/components/ui/viewer-download"

export type ViewerToolbarPosition =
  | {
      kind: "page" | "slide" | "frame"
      current: number
      total?: number
    }
  | {
      label: React.ReactNode
    }

export type ViewerToolbarZoom = {
  scale: number | null
  onZoomOut: () => void
  onZoomIn: () => void
  onFit?: () => void
  onReset?: () => void
  fitLabel?: string
  isDisabled?: boolean
}

export type ViewerToolbarRotate = {
  onRotate: () => void
  isDisabled?: boolean
}

export type ViewerToolbarState = {
  position?: ViewerToolbarPosition | null
  zoom?: ViewerToolbarZoom | null
  rotate?: ViewerToolbarRotate | null
  downloads?: ViewerDownloadAction[]
  extra?: React.ReactNode
}

type ViewerToolbarRegistration = (state: ViewerToolbarState | null) => void

const ViewerToolbarRegistrationContext =
  React.createContext<ViewerToolbarRegistration | null>(null)

export function ViewerToolbarRegistrationProvider({
  children,
  onToolbarStateChange,
}: {
  children: React.ReactNode
  onToolbarStateChange: ViewerToolbarRegistration
}) {
  return (
    <ViewerToolbarRegistrationContext.Provider value={onToolbarStateChange}>
      {children}
    </ViewerToolbarRegistrationContext.Provider>
  )
}

export function useViewerToolbarRegistration(): ViewerToolbarRegistration | null {
  return React.useContext(ViewerToolbarRegistrationContext)
}

export type ViewerToolbarProps = Omit<React.ComponentProps<"div">, "title"> & {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  position?: ViewerToolbarPosition | null
  zoom?: ViewerToolbarZoom | null
  rotate?: ViewerToolbarRotate | null
  downloads?: ViewerDownloadAction[]
  onDownloadError?: ViewerDownloadErrorHandler
  loading?: boolean
  size?: "default" | "sm"
  extra?: React.ReactNode
}

export type ViewerToolbarSkeletonProps = Omit<
  React.ComponentProps<"div">,
  "title"
> & {
  title?: boolean
  subtitle?: boolean
  position?: boolean
  zoom?: boolean
  rotate?: boolean
  download?: boolean
  extra?: React.ReactNode
}

export const VIEWER_TOOLBAR_HEIGHT_PX = 40

export function ViewerToolbar({
  className,
  title,
  subtitle,
  position,
  zoom,
  rotate,
  downloads,
  onDownloadError,
  loading = false,
  size = "default",
  extra,
  ...props
}: ViewerToolbarProps) {
  const hasDownloads = Boolean(downloads?.length)
  const hasActions = Boolean(zoom || rotate || hasDownloads || extra)
  const hasPlainTitle = typeof title === "string" || typeof title === "number"
  const hasMetadataGroup = loading || title != null || subtitle != null

  return (
    <div
      data-slot="viewer-toolbar"
      className={cn(
        "flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2",
        size === "sm" && "h-9 px-2",
        className
      )}
      {...props}
    >
      {hasMetadataGroup ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          {loading ? (
            <span
              aria-hidden
              className="size-2 flex-shrink-0 animate-pulse rounded-full bg-primary"
            />
          ) : null}
          {title != null ? (
            <div
              className={cn(
                "min-w-0 px-1",
                hasPlainTitle && "truncate text-xs font-medium"
              )}
            >
              {title}
            </div>
          ) : null}
          {subtitle != null ? (
            <span className="hidden min-w-0 truncate px-1 text-xs text-muted-foreground tabular-nums sm:inline">
              {subtitle}
            </span>
          ) : null}
          {position ? (
            <span className="flex-shrink-0 px-1 text-xs text-muted-foreground tabular-nums">
              {formatViewerToolbarPosition(position)}
            </span>
          ) : null}
        </div>
      ) : position ? (
        <span className="flex-shrink-0 px-1 text-xs text-muted-foreground tabular-nums">
          {formatViewerToolbarPosition(position)}
        </span>
      ) : (
        <div className="min-w-0 flex-1" />
      )}

      {hasActions ? (
        <div className="ml-auto flex flex-shrink-0 items-center gap-1">
          {zoom ? <ViewerToolbarZoomControls zoom={zoom} /> : null}
          {zoom && rotate ? <ViewerToolbarSeparator /> : null}
          {rotate ? <ViewerToolbarRotateControl rotate={rotate} /> : null}
          {(zoom || rotate) && hasDownloads ? <ViewerToolbarSeparator /> : null}
          {hasDownloads ? (
            <ViewerDownloadControl
              actions={downloads ?? []}
              onError={onDownloadError}
            />
          ) : null}
          {(zoom || rotate || hasDownloads) && extra ? (
            <ViewerToolbarSeparator />
          ) : null}
          {extra}
        </div>
      ) : null}
    </div>
  )
}

export function ViewerToolbarSkeleton({
  className,
  title = false,
  subtitle = false,
  position = false,
  zoom = false,
  rotate = false,
  download = false,
  extra,
  ...props
}: ViewerToolbarSkeletonProps) {
  const hasActions = zoom || rotate || download || Boolean(extra)

  return (
    <div
      data-slot="viewer-toolbar-skeleton"
      className={cn(
        "flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        {title ? (
          <span className="min-w-0 truncate px-1">
            <Skeleton className="inline-block h-3 w-24 align-middle" />
          </span>
        ) : null}
        {subtitle ? (
          <span className="hidden min-w-0 truncate px-1 sm:inline">
            <Skeleton className="inline-block h-3 w-16 align-middle" />
          </span>
        ) : null}
        {position ? (
          <span className="flex-shrink-0 px-1">
            <Skeleton className="inline-block h-3 w-12 align-middle" />
          </span>
        ) : null}
      </div>

      {hasActions ? (
        <div className="ml-auto flex flex-shrink-0 items-center gap-1">
          {zoom ? (
            <>
              <ViewerToolbarButton
                disabled
                aria-hidden
                tabIndex={-1}
                label="Zoom out"
              >
                <Minus />
              </ViewerToolbarButton>
              <span className="w-12 text-center">
                <Skeleton className="inline-block h-3 w-8 align-middle" />
              </span>
              <ViewerToolbarButton
                disabled
                aria-hidden
                tabIndex={-1}
                label="Zoom in"
              >
                <Plus />
              </ViewerToolbarButton>
              <ViewerToolbarButton
                disabled
                aria-hidden
                tabIndex={-1}
                label="Fit width"
              >
                <Maximize />
              </ViewerToolbarButton>
            </>
          ) : null}
          {zoom && rotate ? <ViewerToolbarSeparator /> : null}
          {rotate ? (
            <ViewerToolbarButton
              disabled
              aria-hidden
              tabIndex={-1}
              label="Rotate"
            >
              <RotateCw />
            </ViewerToolbarButton>
          ) : null}
          {(zoom || rotate) && download ? <ViewerToolbarSeparator /> : null}
          {download ? (
            <ViewerToolbarButton
              disabled
              aria-hidden
              tabIndex={-1}
              label="Download"
            >
              <Download />
            </ViewerToolbarButton>
          ) : null}
          {(zoom || rotate || download) && extra ? (
            <ViewerToolbarSeparator />
          ) : null}
          {extra}
        </div>
      ) : null}
    </div>
  )
}

export function ViewerToolbarButton({
  label,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn("size-7", className)}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </Button>
  )
}

export function formatViewerToolbarPosition(position: ViewerToolbarPosition) {
  if ("label" in position) return position.label

  const label =
    position.kind === "page"
      ? "Page"
      : position.kind === "slide"
        ? "Slide"
        : "Frame"
  const current =
    position.total == null
      ? position.current
      : Math.min(position.current, position.total)

  return position.total == null
    ? `${label} ${current}`
    : `${label} ${current} of ${position.total}`
}

function ViewerToolbarZoomControls({ zoom }: { zoom: ViewerToolbarZoom }) {
  const fitLabel = zoom.fitLabel ?? "Fit width"

  return (
    <>
      <ViewerToolbarButton
        label="Zoom out"
        onClick={zoom.onZoomOut}
        disabled={zoom.isDisabled}
      >
        <Minus />
      </ViewerToolbarButton>
      {zoom.onReset ? (
        <button
          type="button"
          className="w-12 text-center text-xs text-muted-foreground tabular-nums hover:text-foreground disabled:pointer-events-none disabled:opacity-64"
          title="Reset zoom"
          onClick={zoom.onReset}
          disabled={zoom.isDisabled}
        >
          {zoom.scale == null ? "Fit" : `${Math.round(zoom.scale * 100)}%`}
        </button>
      ) : (
        <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
          {zoom.scale == null ? "Fit" : `${Math.round(zoom.scale * 100)}%`}
        </span>
      )}
      <ViewerToolbarButton
        label="Zoom in"
        onClick={zoom.onZoomIn}
        disabled={zoom.isDisabled}
      >
        <Plus />
      </ViewerToolbarButton>
      {zoom.onFit ? (
        <ViewerToolbarButton
          label={fitLabel}
          onClick={zoom.onFit}
          disabled={zoom.isDisabled}
        >
          <Maximize />
        </ViewerToolbarButton>
      ) : null}
    </>
  )
}

function ViewerToolbarRotateControl({
  rotate,
}: {
  rotate: ViewerToolbarRotate
}) {
  return (
    <ViewerToolbarButton
      label="Rotate"
      onClick={rotate.onRotate}
      disabled={rotate.isDisabled}
    >
      <RotateCw />
    </ViewerToolbarButton>
  )
}

function ViewerToolbarSeparator() {
  return <Separator orientation="vertical" className="mx-1 h-4" />
}
