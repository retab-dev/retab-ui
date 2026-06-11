"use client"

import * as React from "react"

import { DocShell, useZoom, ZoomActions } from "./file-viewer-chrome"
import { loadTextResource } from "./file-viewer-text-resource"

export function HtmlDocViewer({
  src,
  fileName,
  className,
  bare,
  descriptorSignal,
}: {
  src: string
  fileName: string
  className?: string
  bare?: boolean
  descriptorSignal: AbortSignal
}) {
  const html = React.use(loadTextResource({ src, signal: descriptorSignal }))
  const { scale, zoom, reset } = useZoom()
  return (
    <DocShell
      fileName={fileName}
      src={src}
      className={className}
      bare={bare}
      actions={<ZoomActions scale={scale} zoom={zoom} reset={reset} />}
    >
      <SandboxedDoc html={html} title={fileName} scale={scale} />
    </DocShell>
  )
}

function SandboxedDoc({
  html,
  title,
  scale = 1,
}: {
  html: string
  title: string
  scale?: number
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white">
      <iframe
        sandbox=""
        srcDoc={html}
        title={title}
        className="h-full w-full border-0 bg-white"
        style={{ zoom: scale }}
      />
    </div>
  )
}
