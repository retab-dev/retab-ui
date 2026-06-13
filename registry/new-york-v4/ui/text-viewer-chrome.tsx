"use client"

import * as React from "react"

import { type ViewerDownloadAction } from "@/lib/viewer-download"

import { Skeleton } from "./skeleton"
import {
  TextCodeViewerFrame,
  TextCodeViewerToolbarFrame,
  TextCodeViewerZoomControls,
} from "./text-code-viewer-chrome"
import { ViewerDownloadControl } from "./viewer-download"

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
    <TextCodeViewerFrame
      bare={bare}
      bareClassName="h-full bg-background"
      className={className}
      dataSlot="text-viewer"
      framedClassName="rounded-xl border bg-background"
    >
      {children}
    </TextCodeViewerFrame>
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
    <TextCodeViewerToolbarFrame
      leading={`${wordCount} word${wordCount === 1 ? "" : "s"}`}
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
