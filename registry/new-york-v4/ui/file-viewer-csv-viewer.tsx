"use client"

import * as React from "react"

import { inferCsvDialect } from "@/lib/csv"

import type { CsvDocumentSource } from "./csv-viewer-resource"
import { DocShell } from "./file-viewer-chrome"

const CsvViewer = React.lazy(() =>
  import("@/components/ui/csv-viewer").then((m) => ({ default: m.CsvViewer }))
)

export function CsvDocViewer({
  source,
  fileName,
  mimeType,
  className,
  bare,
  isolateStyles,
}: {
  source: CsvDocumentSource
  fileName: string
  mimeType?: string
  className?: string
  bare?: boolean
  isolateStyles?: boolean
}) {
  const src = source.kind === "url" ? source.url : undefined
  const dialect = inferCsvDialect({ src, fileName, mimeType })
  return (
    <DocShell fileName={fileName} src={src} className={className} bare={bare}>
      <CsvViewer
        source={source}
        dialect={dialect}
        fillHeight
        toolbar={false}
        className="rounded-none border-0 bg-transparent"
        isolateStyles={isolateStyles}
      />
    </DocShell>
  )
}
