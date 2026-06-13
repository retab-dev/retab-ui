"use client"

import * as React from "react"
import { RotateCcw } from "lucide-react"

import { type ViewerDownloadAction } from "@/lib/viewer-download"

import { Button } from "./button"
import { Skeleton } from "./skeleton"
import {
  TextCodeViewerFrame,
  TextCodeViewerToolbarFrame,
  TextCodeViewerZoomControls,
} from "./text-code-viewer-chrome"
import { ViewerDownloadControl } from "./viewer-download"

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

export function CodeViewerToolbar({
  lineCount,
  fontScale,
  downloadAction,
  onZoomOut,
  onZoomIn,
  onResetZoom,
}: {
  lineCount: number
  fontScale: number
  downloadAction: ViewerDownloadAction
  onZoomOut: () => void
  onZoomIn: () => void
  onResetZoom: () => void
}) {
  return (
    <TextCodeViewerToolbarFrame
      leading={`${lineCount} line${lineCount === 1 ? "" : "s"}`}
      trailing={
        <>
          <TextCodeViewerZoomControls
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

export function CodeViewerFallback({
  className,
  toolbar = true,
  bare,
}: {
  className?: string
  toolbar?: boolean
  bare?: boolean
}) {
  return (
    <CodeViewerFrame className={className} bare={bare}>
      {toolbar ? (
        <TextCodeViewerToolbarFrame
          leading={<Skeleton className="inline-block h-3 w-16 align-middle" />}
          trailing={<TextCodeViewerZoomControls disabled fontScale={1} />}
        />
      ) : null}
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
