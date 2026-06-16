"use client"

import * as React from "react"

import { inferCsvDialect } from "@/lib/csv"
import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"

const CsvViewer = React.lazy(() =>
  import("@/components/ui/csv-viewer").then((m) => ({ default: m.CsvViewer }))
)

export function CsvFileContent({
  resource,
  className,
  bare,
  isolateStyles,
}: {
  resource: ViewerResource
  className?: string
  bare?: boolean
  isolateStyles?: boolean
}) {
  const source = resource.descriptor.source
  const dialect = inferCsvDialect({
    src: resource.content.directUrl ?? undefined,
    fileName: resource.fileName,
    mimeType: resource.mimeType,
  })
  return (
    <div
      data-slot="csv-file-viewer-content"
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden bg-card",
        bare ? "h-full" : "min-h-64",
        className
      )}
    >
      <CsvViewer
        source={source}
        dialect={dialect}
        fillHeight
        controls={false}
        className="rounded-none border-0 bg-transparent"
        isolateStyles={isolateStyles}
      />
    </div>
  )
}
