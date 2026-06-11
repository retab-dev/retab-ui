"use client"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

import { DEFAULT_PPTX_SLIDE_SIZE } from "./pptx-viewer-core"
import { PptxToolbarSkeleton } from "./pptx-viewer-toolbar"

export function PptxViewerFallback({
  className,
  bare = false,
}: {
  className?: string
  bare?: boolean
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
      <PptxToolbarSkeleton />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col items-center p-4">
          <PptxSlideSkeleton />
        </div>
      </div>
    </div>
  )
}

function PptxSlideSkeleton() {
  return (
    <Skeleton
      aria-hidden
      className="w-full"
      style={{
        aspectRatio: `${DEFAULT_PPTX_SLIDE_SIZE.width} / ${DEFAULT_PPTX_SLIDE_SIZE.height}`,
      }}
    />
  )
}
