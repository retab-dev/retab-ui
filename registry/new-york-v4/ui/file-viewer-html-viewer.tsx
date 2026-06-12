"use client"

import * as React from "react"

import type { ViewerDownloadAction } from "@/lib/viewer-download"

import { isAbortError } from "./file-viewer-async"
import {
  DocShell,
  useZoom,
  ViewerFallback,
  ZoomActions,
} from "./file-viewer-chrome"
import { loadTextResource } from "./file-viewer-text-resource"

type HtmlLoadState =
  | { status: "loading"; key: unknown }
  | { status: "loaded"; key: unknown; html: string }
  | { status: "error"; key: unknown; error: unknown }

export function HtmlDocViewer({
  html,
  blob,
  src,
  fileName,
  downloadAction,
  className,
  bare,
  descriptorSignal,
}: {
  html?: string
  blob?: Blob
  src?: string
  fileName: string
  downloadAction?: ViewerDownloadAction
  className?: string
  bare?: boolean
  descriptorSignal?: AbortSignal
}) {
  if (html != null) {
    return (
      <HtmlDocViewerContent
        html={html}
        src={src}
        fileName={fileName}
        downloadAction={downloadAction}
        className={className}
        bare={bare}
      />
    )
  }
  if (blob) {
    return (
      <HtmlDocViewerBlob
        blob={blob}
        src={src}
        fileName={fileName}
        downloadAction={downloadAction}
        className={className}
        bare={bare}
      />
    )
  }
  if (!src || !descriptorSignal) {
    throw new Error("HtmlDocViewer requires src and descriptorSignal")
  }
  return (
    <HtmlDocViewerResource
      src={src}
      fileName={fileName}
      downloadAction={downloadAction}
      className={className}
      bare={bare}
      descriptorSignal={descriptorSignal}
    />
  )
}

function HtmlDocViewerBlob({
  blob,
  src,
  fileName,
  downloadAction,
  className,
  bare,
}: {
  blob: Blob
  src?: string
  fileName: string
  downloadAction?: ViewerDownloadAction
  className?: string
  bare?: boolean
}) {
  const [state, setState] = React.useState<HtmlLoadState>({
    status: "loading",
    key: blob,
  })

  React.useEffect(() => {
    let active = true
    setState({ status: "loading", key: blob })

    blob.text().then(
      (html) => {
        if (active) setState({ status: "loaded", key: blob, html })
      },
      (error: unknown) => {
        if (active) setState({ status: "error", key: blob, error })
      }
    )

    return () => {
      active = false
    }
  }, [blob])

  if (state.key !== blob) {
    return (
      <ViewerFallback
        category="html"
        fileName={fileName}
        src={src}
        className={className}
        bare={bare}
      />
    )
  }
  if (state.status === "error") {
    throw state.error
  }
  if (state.status === "loading") {
    return (
      <ViewerFallback
        category="html"
        fileName={fileName}
        src={src}
        className={className}
        bare={bare}
      />
    )
  }

  return (
    <HtmlDocViewerContent
      html={state.html}
      src={src}
      fileName={fileName}
      downloadAction={downloadAction}
      className={className}
      bare={bare}
    />
  )
}

function HtmlDocViewerResource({
  src,
  fileName,
  downloadAction,
  className,
  bare,
  descriptorSignal,
}: {
  src: string
  fileName: string
  downloadAction?: ViewerDownloadAction
  className?: string
  bare?: boolean
  descriptorSignal: AbortSignal
}) {
  const [state, setState] = React.useState<HtmlLoadState>({
    status: "loading",
    key: src,
  })

  React.useEffect(() => {
    let active = true
    setState({ status: "loading", key: src })

    loadTextResource({ src, signal: descriptorSignal }).then(
      (html) => {
        if (active && !descriptorSignal.aborted) {
          setState({ status: "loaded", key: src, html })
        }
      },
      (error: unknown) => {
        if (!active || isAbortError(error)) return
        setState({ status: "error", key: src, error })
      }
    )

    return () => {
      active = false
    }
  }, [descriptorSignal, src])

  if (state.key !== src) {
    return (
      <ViewerFallback
        category="html"
        fileName={fileName}
        src={src}
        className={className}
        bare={bare}
      />
    )
  }
  if (state.status === "error") {
    throw state.error
  }
  if (state.status === "loading") {
    return (
      <ViewerFallback
        category="html"
        fileName={fileName}
        src={src}
        className={className}
        bare={bare}
      />
    )
  }

  const { html } = state
  return (
    <HtmlDocViewerContent
      html={html}
      src={src}
      fileName={fileName}
      downloadAction={downloadAction}
      className={className}
      bare={bare}
    />
  )
}

function HtmlDocViewerContent({
  html,
  src,
  fileName,
  downloadAction,
  className,
  bare,
}: {
  html: string
  src?: string
  fileName: string
  downloadAction?: ViewerDownloadAction
  className?: string
  bare?: boolean
}) {
  const { scale, zoom, reset } = useZoom()
  return (
    <DocShell
      fileName={fileName}
      src={src}
      downloadAction={downloadAction}
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
