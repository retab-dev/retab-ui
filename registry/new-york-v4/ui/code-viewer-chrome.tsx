"use client"

import * as React from "react"
import { RotateCcw } from "lucide-react"

import { type ViewerDownloadAction } from "@/lib/viewer-download-actions"

import { Button } from "./button"
import { Skeleton } from "./skeleton"
import { TextCodeViewerFrame } from "./text-code-viewer-chrome"
import { ViewerDownloadControl } from "./viewer-download"
import { ViewerControls, ViewerControlsSkeleton } from "./viewer-controls"

export function CodeViewerFrame({
  className,
  bare,
  children,
}: {
  className?: string
  bare?: boolean
  children: React.ReactNode
}) {
  return (
    <TextCodeViewerFrame
      bare={bare}
      bareClassName="h-full bg-muted/20"
      className={className}
      dataSlot="code-viewer"
      framedClassName="rounded-xl border bg-muted/30"
    >
      {children}
    </TextCodeViewerFrame>
  )
}

export function CodeViewerControls({
  lineCount,
  fontScale,
  downloadAction,
  onZoomOut,
  onZoomIn,
  onResetZoom,
}: {
  lineCount: number
  fontScale: number
  downloadAction?: ViewerDownloadAction | null
  onZoomOut: () => void
  onZoomIn: () => void
  onResetZoom: () => void
}) {
  return (
    <ViewerControls
      title={`${lineCount} line${lineCount === 1 ? "" : "s"}`}
      zoom={{
        scale: fontScale,
        onZoomOut,
        onZoomIn,
        onFit: onResetZoom,
        fitLabel: "Reset zoom",
      }}
      downloads={downloadAction ? [downloadAction] : undefined}
    />
  )
}

export function CodeViewerFallback({
  className,
  controls = true,
  download = true,
  bare,
}: {
  className?: string
  controls?: boolean
  download?: boolean
  bare?: boolean
}) {
  return (
    <CodeViewerFrame className={className} bare={bare}>
      {controls ? <ViewerControlsSkeleton title zoom download={download} /> : null}
      <div
        className="min-h-0 flex-1 space-y-2 overflow-hidden p-4"
        data-slot="code-body-skeleton"
      >
        {Array.from({ length: 12 }, (_, index) => (
          <Skeleton
            key={index}
            className="h-4"
            style={{ width: `${40 + ((index * 13) % 55)}%` }}
          />
        ))}
      </div>
    </CodeViewerFrame>
  )
}

export function CodeViewerErrorState({
  className,
  bare,
  message,
  isRetryable,
  downloadAction,
  onRetry,
}: {
  className?: string
  bare?: boolean
  message: string
  isRetryable: boolean
  downloadAction: ViewerDownloadAction
  onRetry: () => void
}) {
  return (
    <CodeViewerFrame className={className} bare={bare}>
      <div className="flex min-h-64 flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <p>{message}</p>
        <div className="flex items-center gap-2">
          {isRetryable ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw className="mr-1.5 size-4" />
              Retry
            </Button>
          ) : null}
          <ViewerDownloadControl
            actions={[downloadAction]}
            variant={message.includes("too large") ? "outline" : "ghost"}
            size="sm"
            className=""
            showLabel
          />
        </div>
      </div>
    </CodeViewerFrame>
  )
}
