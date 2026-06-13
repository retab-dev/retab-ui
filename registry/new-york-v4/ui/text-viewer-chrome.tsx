"use client"

import * as React from "react"
import { Maximize, Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { type ViewerDownloadAction } from "@/lib/viewer-download"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ViewerDownloadControl } from "@/components/ui/viewer-download"

export function TextViewerFrame({
  className,
  bare,
  children,
}: {
  className?: string
  bare?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-background" : "rounded-xl border bg-background",
        className
      )}
      data-slot="text-viewer"
    >
      {children}
    </div>
  )
}

export function TextViewerFallback({
  className,
  toolbar = true,
  bare,
}: {
  className?: string
  toolbar?: boolean
  bare?: boolean
}) {
  return (
    <TextViewerFrame className={className} bare={bare}>
      {toolbar ? (
        <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b bg-card px-3">
          <Skeleton className="h-3 w-16" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="size-5" />
            <Skeleton className="size-5" />
          </div>
        </div>
      ) : null}
      <div
        className="min-h-0 flex-1 space-y-3 overflow-hidden p-5"
        data-slot="text-body-skeleton"
      >
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton
            key={index}
            className="h-4"
            style={{ width: `${48 + ((index * 17) % 44)}%` }}
          />
        ))}
      </div>
    </TextViewerFrame>
  )
}

export function TextViewerToolbar({
  wordCount,
  fontScale,
  downloadAction,
  onZoomOut,
  onZoomIn,
  onResetZoom,
}: {
  wordCount: number
  fontScale: number
  downloadAction: ViewerDownloadAction
  onZoomOut: () => void
  onZoomIn: () => void
  onResetZoom: () => void
}) {
  return (
    <TextViewerToolbarFrame
      leading={`${wordCount} word${wordCount === 1 ? "" : "s"}`}
      trailing={
        <>
          <TextViewerZoomControls
            fontScale={fontScale}
            onZoomOut={onZoomOut}
            onZoomIn={onZoomIn}
            onResetZoom={onResetZoom}
          />
          <div className="mx-1 h-4 w-px bg-border" />
          <ViewerDownloadControl actions={[downloadAction]} />
        </>
      }
    />
  )
}

function TextViewerToolbarFrame({
  leading,
  trailing,
}: {
  leading: React.ReactNode
  trailing: React.ReactNode
}) {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      <span className="px-1 text-xs text-muted-foreground tabular-nums">
        {leading}
      </span>
      <div className="ml-auto flex items-center gap-1">{trailing}</div>
    </div>
  )
}

function TextViewerZoomControls({
  fontScale,
  disabled = false,
  onZoomOut,
  onZoomIn,
  onResetZoom,
}: {
  fontScale: number
  disabled?: boolean
  onZoomOut?: () => void
  onZoomIn?: () => void
  onResetZoom?: () => void
}) {
  const disabledProps = disabled
    ? ({ disabled: true, tabIndex: -1, "aria-hidden": true } as const)
    : {}

  return (
    <>
      <IconButton
        label="Zoom out"
        onClick={disabled ? undefined : onZoomOut}
        {...disabledProps}
      >
        <Minus />
      </IconButton>
      <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
        {Math.round(fontScale * 100)}%
      </span>
      <IconButton
        label="Zoom in"
        onClick={disabled ? undefined : onZoomIn}
        {...disabledProps}
      >
        <Plus />
      </IconButton>
      <IconButton
        label="Reset zoom"
        onClick={disabled ? undefined : onResetZoom}
        {...disabledProps}
      >
        <Maximize />
      </IconButton>
    </>
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
