"use client"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

import { DEFAULT_PPTX_SLIDE_SIZE } from "./pptx-viewer-core"
import { ViewerToolbarSkeleton } from "./viewer-toolbar"

export function PptxViewerFallback({
  className,
  bare = false,
  fallbackSlideSize = DEFAULT_PPTX_SLIDE_SIZE,
  toolbar = true,
}: {
  className?: string
  bare?: boolean
  fallbackSlideSize?: { width: number; height: number }
  toolbar?: boolean
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="pptx-viewer"
    >
      {toolbar ? <ViewerToolbarSkeleton position zoom rotate download /> : null}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col items-center p-4">
          <PptxSlideSkeleton slideSize={fallbackSlideSize} />
        </div>
      </div>
    </div>
  )
}

function PptxSlideSkeleton({
  slideSize,
}: {
  slideSize: { width: number; height: number }
}) {
  return (
    <Skeleton
      aria-hidden
      className="w-full"
      data-slot="pptx-slide-skeleton"
      style={{
        aspectRatio: `${slideSize.width} / ${slideSize.height}`,
      }}
    />
  )
}
