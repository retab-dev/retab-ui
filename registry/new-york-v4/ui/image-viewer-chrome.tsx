"use client"

import * as React from "react"
import { Download, Maximize, Minus, Plus, RotateCw } from "lucide-react"

import { cn } from "@/lib/utils"
import { type ViewerDownloadAction } from "@/lib/viewer-download"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ViewerDownloadControl } from "@/components/ui/viewer-download"

export interface ImageViewerToolbarProps {
  countLabel: string
  scale: number
  downloadAction: ViewerDownloadAction
  scaleControlsDisabled?: boolean
  onZoomOut(): void
  onZoomIn(): void
  onFitWidth(): void
  onRotate(): void
}

export function ImageViewerToolbar({
  countLabel,
  scale,
  downloadAction,
  scaleControlsDisabled = false,
  onZoomOut,
  onZoomIn,
  onFitWidth,
  onRotate,
}: ImageViewerToolbarProps) {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      <span className="px-1 text-xs text-muted-foreground tabular-nums">
        {countLabel}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <ToolbarIconButton
          label="Zoom out"
          onClick={onZoomOut}
          disabled={scaleControlsDisabled}
        >
          <Minus />
        </ToolbarIconButton>
        <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <ToolbarIconButton
          label="Zoom in"
          onClick={onZoomIn}
          disabled={scaleControlsDisabled}
        >
          <Plus />
        </ToolbarIconButton>
        <ToolbarIconButton
          label="Fit width"
          onClick={onFitWidth}
          disabled={scaleControlsDisabled}
        >
          <Maximize />
        </ToolbarIconButton>
        <ToolbarIconButton label="Rotate" onClick={onRotate}>
          <RotateCw />
        </ToolbarIconButton>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <ViewerDownloadControl actions={[downloadAction]} />
      </div>
    </div>
  )
}

export function ImageViewerFallback({
  className,
  bare = false,
  fallbackFrameSize,
  scale,
  toolbar = true,
}: {
  className?: string
  bare?: boolean
  fallbackFrameSize?: { width: number; height: number }
  scale?: number
  toolbar?: boolean
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="image-viewer"
    >
      {toolbar ? <ImageToolbarSkeleton /> : null}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col items-center p-4">
          <ImageFrameSkeleton frameSize={fallbackFrameSize} scale={scale} />
        </div>
      </div>
    </div>
  )
}

function ToolbarIconButton({
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

function ImageToolbarSkeleton() {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      <span className="px-1">
        <Skeleton className="inline-block h-3 w-12 align-middle" />
      </span>
      <div className="ml-auto flex items-center gap-1">
        <ToolbarIconPlaceholder>
          <Minus />
        </ToolbarIconPlaceholder>
        <span className="w-12 text-center">
          <Skeleton className="inline-block h-3 w-8 align-middle" />
        </span>
        <ToolbarIconPlaceholder>
          <Plus />
        </ToolbarIconPlaceholder>
        <ToolbarIconPlaceholder>
          <Maximize />
        </ToolbarIconPlaceholder>
        <ToolbarIconPlaceholder>
          <RotateCw />
        </ToolbarIconPlaceholder>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <ToolbarIconPlaceholder>
          <Download />
        </ToolbarIconPlaceholder>
      </div>
    </div>
  )
}

function ToolbarIconPlaceholder({ children }: { children: React.ReactNode }) {
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

function ImageFrameSkeleton({
  frameSize,
  scale,
}: {
  frameSize?: { width: number; height: number }
  scale?: number
}) {
  const normalizedScale =
    scale !== undefined && Number.isFinite(scale) && scale > 0
      ? Math.min(5, Math.max(0.25, scale))
      : null
  const style: React.CSSProperties | undefined = frameSize
    ? normalizedScale !== null
      ? {
          width: frameSize.width * normalizedScale,
          height: frameSize.height * normalizedScale,
        }
      : {
          aspectRatio: `${frameSize.width} / ${frameSize.height}`,
          minWidth: frameSize.width * 0.25,
        }
    : { aspectRatio: "4 / 3" }

  return (
    <Skeleton
      aria-hidden
      className="w-full rounded-none shadow-sm ring-1 ring-border"
      data-slot="image-frame-skeleton"
      style={style}
    />
  )
}
