"use client"

import * as React from "react"

import { inferCsvDialect } from "@/lib/csv"

import { DocShell, useZoom, ZoomActions } from "./file-viewer-chrome"

const CsvViewer = React.lazy(() =>
  import("@/components/ui/csv-viewer").then((m) => ({ default: m.CsvViewer }))
)

export function CsvDocViewer({
  src,
  fileName,
  mimeType,
  className,
  bare,
  isolateStyles,
}: {
  src: string
  fileName: string
  mimeType?: string
  className?: string
  bare?: boolean
  isolateStyles?: boolean
}) {
  const { scale, zoom, reset } = useZoom()
  const dialect = inferCsvDialect({ src, fileName, mimeType })
  return (
    <DocShell
      fileName={fileName}
      src={src}
      actions={<ZoomActions scale={scale} zoom={zoom} reset={reset} />}
      className={className}
      bare={bare}
    >
      <CsvViewer
        src={src}
        dialect={dialect}
        downloadName={fileName}
        fillHeight
        scale={scale}
        toolbar={false}
        className="rounded-none border-0 bg-transparent"
        isolateStyles={isolateStyles}
      />
    </DocShell>
  )
}
