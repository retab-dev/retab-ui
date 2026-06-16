import * as React from "react"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { ViewerControlsSkeleton } from "@/components/ui/viewer-controls"

export function PdfViewerFallback({
  className,
  bare = false,
  controls = true,
}: {
  className?: string
  bare?: boolean
  controls?: boolean
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="pdf-viewer"
    >
      {controls ? <ViewerControlsSkeleton position zoom rotate download /> : null}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col items-center p-4">
          <PageAspectSkeleton />
        </div>
      </div>
    </div>
  )
}

export function PageSkeleton() {
  return <Skeleton className="size-full rounded-md" />
}

function PageAspectSkeleton() {
  return (
    <Skeleton
      aria-hidden
      className="w-full rounded-md"
      data-slot="pdf-page-skeleton"
      style={{ aspectRatio: "8.5 / 11" }}
    />
  )
}
