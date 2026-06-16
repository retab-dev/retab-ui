"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { ViewerControlsSkeleton } from "@/components/ui/viewer-controls"

export function ImageViewerFallback({
  className,
  bare = false,
  fallbackFrameSize,
  scale,
  controls = true,
}: {
  className?: string
  bare?: boolean
  fallbackFrameSize?: { width: number; height: number }
  scale?: number
  controls?: boolean
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
      {controls ? <ViewerControlsSkeleton position zoom rotate download /> : null}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col items-center p-4">
          <ImageFrameSkeleton frameSize={fallbackFrameSize} scale={scale} />
        </div>
      </div>
    </div>
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
