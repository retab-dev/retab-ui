"use client"

import * as React from "react"
import { Download, Maximize, Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ViewerDownloadAction } from "@/lib/viewer-download"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ViewerDownloadButton } from "@/components/ui/viewer-download"

export function DocxViewerFrame({
  bare = false,
  children,
  className,
}: {
  bare?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="docx-viewer"
    >
      {children}
    </div>
  )
}

export function DocxViewerBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

export function DocxViewerToolbar({
  currentPage,
  download,
  fitWidth,
  numPages,
  ready,
  scale,
  zoomIn,
  zoomOut,
}: {
  currentPage: number
  download?: ViewerDownloadAction | null
  fitWidth: () => void
  numPages: number
  ready: boolean
  scale: number
  zoomIn: () => void
  zoomOut: () => void
}) {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      <span className="px-1 text-xs text-muted-foreground tabular-nums">
        {ready ? (
          <>
            Page {Math.min(currentPage, numPages)} of {numPages}
          </>
        ) : (
          <Skeleton className="inline-block h-3 w-12 align-middle" />
        )}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <DocxToolbarButton label="Zoom out" onClick={zoomOut}>
          <Minus />
        </DocxToolbarButton>
        <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
          {ready ? (
            `${Math.round(scale * 100)}%`
          ) : (
            <Skeleton className="inline-block h-3 w-8 align-middle" />
          )}
        </span>
        <DocxToolbarButton label="Zoom in" onClick={zoomIn}>
          <Plus />
        </DocxToolbarButton>
        <DocxToolbarButton label="Fit width" onClick={fitWidth}>
          <Maximize />
        </DocxToolbarButton>
        <Separator orientation="vertical" className="mx-1 h-4" />
        {download ? <ViewerDownloadButton action={download} /> : null}
      </div>
    </div>
  )
}

export function DocxViewerFallback({
  bare = false,
  className,
  toolbar = true,
}: {
  bare?: boolean
  className?: string
  toolbar?: boolean
}) {
  return (
    <DocxViewerFrame bare={bare} className={className}>
      {toolbar ? <DocxToolbarSkeleton /> : null}
      <DocxViewerBody>
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="flex flex-col items-center p-4">
            <DocxSkeleton />
          </div>
        </div>
      </DocxViewerBody>
    </DocxViewerFrame>
  )
}

export function DocxToolbarSkeleton() {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      <span className="px-1">
        <Skeleton className="inline-block h-3 w-12 align-middle" />
      </span>
      <div className="ml-auto flex items-center gap-1">
        <DocxToolbarPlaceholder>
          <Minus />
        </DocxToolbarPlaceholder>
        <span className="w-12 text-center">
          <Skeleton className="inline-block h-3 w-8 align-middle" />
        </span>
        <DocxToolbarPlaceholder>
          <Plus />
        </DocxToolbarPlaceholder>
        <DocxToolbarPlaceholder>
          <Maximize />
        </DocxToolbarPlaceholder>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <DocxToolbarPlaceholder>
          <Download />
        </DocxToolbarPlaceholder>
      </div>
    </div>
  )
}

export function DocxSkeleton() {
  return (
    <Skeleton
      aria-hidden
      className="w-full rounded-sm"
      data-slot="docx-page-skeleton"
      style={{ aspectRatio: "8.5 / 11" }}
    />
  )
}

function DocxToolbarButton({
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

function DocxToolbarPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-7"
      disabled
      tabIndex={-1}
      aria-hidden
    >
      {children}
    </Button>
  )
}
