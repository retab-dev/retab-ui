"use client"

import * as React from "react"

import { inferCsvDialect } from "@/lib/csv"
import type { ViewerResource } from "@/lib/viewer-resource"

import { ResourceDocShell } from "./file-viewer-chrome"

const CsvViewer = React.lazy(() =>
  import("@/components/ui/csv-viewer").then((m) => ({ default: m.CsvViewer }))
)

export function CsvDocViewer({
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
    <ResourceDocShell resource={resource} className={className} bare={bare}>
      <CsvViewer
        source={source}
        dialect={dialect}
        fillHeight
        toolbar={false}
        className="rounded-none border-0 bg-transparent"
        isolateStyles={isolateStyles}
      />
    </ResourceDocShell>
  )
}
