"use client"

import * as React from "react"

import { inferCsvDialect } from "@/lib/csv"
import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"

const CsvViewerDocument = React.lazy(() =>
  import("@/components/ui/csv-viewer").then((m) => ({
    default: m.CsvViewerDocument,
  }))
)

export function CsvFileContent({
  resource,
  className,
  bare,
  controls = false,
  isolateStyles,
}: {
  resource: ViewerResource
  className?: string
  bare?: boolean
  controls?: boolean
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
      <CsvViewerDocument
        source={source}
        dialect={dialect}
        fillHeight
        controls={controls}
        isolateStyles={isolateStyles}
      />
    </div>
  )
}
