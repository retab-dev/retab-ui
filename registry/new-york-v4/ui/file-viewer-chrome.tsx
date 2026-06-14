"use client"

import * as React from "react"
import { Maximize, Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ViewerDownloadButton } from "@/components/ui/viewer-download"
import { ViewerErrorState } from "@/components/ui/viewer-error"

import type { FileDescriptor } from "./file-viewer-core"

const TEXT_SKELETON_FONT = 12.5
const TEXT_SKELETON_LINE_HEIGHT = 20

export function ResourceDocShell({
  resource,
  meta,
  actions,
  className,
  bare,
  showHeader = !bare,
  children,
}: {
  resource: ViewerResource
  meta?: string
  actions?: React.ReactNode
  className?: string
  bare?: boolean
  showHeader?: boolean
  children: React.ReactNode
}) {
  const fileName = resource.fileName

  return (
    <div
      data-slot="file-viewer"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-card" : "rounded-xl border bg-muted/30",
        className
      )}
    >
      {showHeader ? (
        <div className="flex h-10 min-w-0 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
          <span
            className="min-w-0 flex-1 truncate px-1 text-xs font-medium"
            title={fileName}
          >
            {fileName}
          </span>
          {meta ? (
            <span className="max-w-[45%] min-w-0 flex-shrink truncate text-xs text-muted-foreground tabular-nums">
              {meta}
            </span>
          ) : null}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {actions}
            {actions ? (
              <Separator orientation="vertical" className="mx-1 h-4" />
            ) : null}
            <ViewerDownloadButton action={resource.originalDownload} />
          </div>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

function IconButton({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-7"
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </Button>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function useZoom() {
  const [scale, setScale] = React.useState(1)
  const zoom = React.useCallback(
    (factor: number) => setScale((s) => clamp(s * factor, 0.25, 5)),
    []
  )
  const reset = React.useCallback(() => setScale(1), [])
  return { scale, zoom, reset }
}

export function ZoomActions({
  scale,
  zoom,
  reset,
}: {
  scale: number
  zoom: (factor: number) => void
  reset: () => void
}) {
  return (
    <>
      <IconButton label="Zoom out" onClick={() => zoom(1 / 1.2)}>
        <Minus />
      </IconButton>
      <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
        {Math.round(scale * 100)}%
      </span>
      <IconButton label="Zoom in" onClick={() => zoom(1.2)}>
        <Plus />
      </IconButton>
      <IconButton label="Actual size" onClick={reset}>
        <Maximize />
      </IconButton>
    </>
  )
}

export function ZoomActionsSkeleton() {
  const inert = { disabled: true, tabIndex: -1, "aria-hidden": true } as const
  return (
    <>
      <IconButton label="Zoom out" {...inert}>
        <Minus />
      </IconButton>
      <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
        100%
      </span>
      <IconButton label="Zoom in" {...inert}>
        <Plus />
      </IconButton>
      <IconButton label="Actual size" {...inert}>
        <Maximize />
      </IconButton>
    </>
  )
}

export function UnsupportedCard({
  resource,
  className,
  bare,
  message = "No preview for",
}: {
  resource: ViewerResource
  className?: string
  bare?: boolean
  message?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-8 text-center",
        bare ? "h-full bg-muted/20" : "min-h-64 rounded-xl border bg-muted/30",
        className
      )}
      data-slot="file-viewer"
    >
      <p className="text-sm text-muted-foreground">
        {message}{" "}
        <span className="font-medium text-foreground">
          {resource.fileName}.
        </span>
      </p>
      <ViewerDownloadButton
        action={resource.originalDownload}
        variant="outline"
        size="sm"
        className=""
        showLabel
      />
    </div>
  )
}

export function ViewerFallback({
  resource,
  className,
  bare = false,
}: {
  resource: ViewerResource
  className?: string
  bare?: boolean
}) {
  const category = resource.descriptor.category
  const url = resource.content.directUrl

  if (
    url != null &&
    (category === "text" ||
      category === "markdown" ||
      category === "html" ||
      category === "csv")
  ) {
    return (
      <ResourceDocShell
        resource={resource}
        className={className}
        bare={bare}
        actions={<ZoomActionsSkeleton />}
      >
        {category === "csv" ? (
          <TableBodySkeleton />
        ) : category === "text" ? (
          <TextBodySkeleton />
        ) : (
          <div className="min-h-0 flex-1 bg-card p-4">
            <Skeleton className="size-full rounded-md" />
          </div>
        )}
      </ResourceDocShell>
    )
  }

  const tabular = category === "xlsx"
  const pageAspect =
    category === "pptx" || category === "image" ? "4 / 3" : "8.5 / 11"

  return (
    <div
      data-slot="file-viewer"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
    >
      {!bare ? (
        <div className="flex h-10 min-w-0 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
          <span className="min-w-0 flex-1 px-1">
            <Skeleton className="inline-block h-3 w-16 align-middle" />
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {category !== "unsupported" ? (
              <>
                <ZoomActionsSkeleton />
                <Separator orientation="vertical" className="mx-1 h-4" />
              </>
            ) : null}
            <ViewerDownloadButton action={resource.originalDownload} />
          </div>
        </div>
      ) : null}
      {tabular ? (
        <TableBodySkeleton />
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="flex flex-col items-center p-4">
            <Skeleton
              aria-hidden
              className="w-full rounded-md"
              style={{ aspectRatio: pageAspect }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function TextBodySkeleton() {
  const gutter = 44
  const widths = [
    82, 64, 91, 48, 73, 88, 56, 79, 95, 61, 70, 85, 52, 77, 90, 67, 83, 59, 74,
    86, 63, 80,
  ]
  return (
    <div
      aria-hidden
      className="relative min-h-0 flex-1 overflow-hidden bg-card font-mono"
      style={{
        fontSize: TEXT_SKELETON_FONT,
        lineHeight: `${TEXT_SKELETON_LINE_HEIGHT}px`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 bg-[color-mix(in_oklab,var(--card)_96%,var(--foreground))]"
        style={{ width: gutter }}
      />
      <div className="relative">
        {widths.map((w, i) => (
          <div
            key={i}
            className="grid items-center"
            style={{
              gridTemplateColumns: `${gutter}px 1fr`,
              height: TEXT_SKELETON_LINE_HEIGHT,
            }}
          >
            <div className="flex justify-end pr-2">
              <Skeleton className="h-2.5 w-3" />
            </div>
            <div className="px-3">
              <Skeleton className="h-2.5" style={{ width: `${w}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TableBodySkeleton() {
  const gutter = 52
  const colWidth = 150
  const cols = 6
  const rows = 14
  const widths = [70, 45, 88, 56, 62, 78]
  return (
    <div
      aria-hidden
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card text-sm"
    >
      <div className="flex border-b bg-muted/60">
        <div
          className="shrink-0 border-r"
          style={{ width: gutter, height: 33 }}
        />
        {Array.from({ length: cols }, (_, c) => (
          <div
            key={c}
            className="flex shrink-0 items-center border-r px-3"
            style={{ width: colWidth, height: 33 }}
          >
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex border-b" style={{ height: 33 }}>
            <div
              className="flex shrink-0 items-center justify-end border-r px-2"
              style={{ width: gutter }}
            >
              <Skeleton className="h-3 w-4" />
            </div>
            {Array.from({ length: cols }, (_, c) => (
              <div
                key={c}
                className="flex shrink-0 items-center border-r px-3"
                style={{ width: colWidth }}
              >
                <Skeleton
                  className="h-3"
                  style={{ width: `${widths[(r + c) % widths.length]}%` }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export class FileErrorBoundary extends React.Component<
  {
    children: React.ReactNode
    descriptor: FileDescriptor
    resource: ViewerResource
    className?: string
    resetKey?: unknown
  },
  { error: unknown | null }
> {
  state: Readonly<{ error: unknown | null }> = { error: null }

  componentDidUpdate(prev: { resetKey?: unknown }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  render() {
    if (this.state.error != null) {
      return (
        <ViewerErrorState
          error={this.state.error}
          format="file"
          sourceKind={this.props.resource.sourceKind}
          download={this.props.resource.originalDownload}
          className={this.props.className}
        />
      )
    }
    return this.props.children
  }
}
