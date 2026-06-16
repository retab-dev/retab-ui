"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"

import { ViewerFallback } from "./file-viewer-fallback"
import { loadTextResource } from "./file-viewer-text-resource"
import { isAbortError } from "./viewer-abortable-request"
import { useZoom, ZoomActions } from "./viewer-zoom"

type HtmlLoadState =
  | { status: "loading"; key: unknown }
  | { status: "loaded"; key: unknown; html: string }
  | { status: "error"; key: unknown; error: unknown }

export function HtmlFileContent({
  resource,
  className,
  bare,
  descriptorSignal,
}: {
  resource: ViewerResource
  className?: string
  bare?: boolean
  descriptorSignal: AbortSignal
}) {
  if (resource.content.payload.kind === "text") {
    return (
      <HtmlFileContentFrame
        key={resource.content.key}
        resource={resource}
        html={resource.content.payload.text}
        className={className}
        bare={bare}
      />
    )
  }
  return (
    <HtmlFileResource
      resource={resource}
      className={className}
      bare={bare}
      descriptorSignal={descriptorSignal}
    />
  )
}

function HtmlFileResource({
  resource,
  className,
  bare,
  descriptorSignal,
}: {
  resource: ViewerResource
  className?: string
  bare?: boolean
  descriptorSignal: AbortSignal
}) {
  const content = resource.content
  const contentKey = content.key
  const [state, setState] = React.useState<HtmlLoadState>({
    status: "loading",
    key: contentKey,
  })

  React.useEffect(() => {
    let active = true
    const controller = new AbortController()
    const abortLocal = () => controller.abort()
    setState({ status: "loading", key: contentKey })

    if (descriptorSignal.aborted) {
      abortLocal()
    } else {
      descriptorSignal.addEventListener("abort", abortLocal, { once: true })
    }

    loadTextResource({
      content,
      fileName: resource.fileName,
      signal: controller.signal,
    }).then(
      (html) => {
        if (active && !controller.signal.aborted) {
          setState({ status: "loaded", key: contentKey, html })
        }
      },
      (error: unknown) => {
        if (!active || isAbortError(error)) return
        setState({ status: "error", key: contentKey, error })
      }
    )

    return () => {
      active = false
      descriptorSignal.removeEventListener("abort", abortLocal)
      abortLocal()
    }
  }, [content, contentKey, descriptorSignal, resource.fileName])

  if (state.key !== contentKey) {
    return (
      <ViewerFallback resource={resource} className={className} bare={bare} />
    )
  }
  if (state.status === "error") {
    throw state.error
  }
  if (state.status === "loading") {
    return (
      <ViewerFallback resource={resource} className={className} bare={bare} />
    )
  }

  const { html } = state
  return (
    <HtmlFileContentFrame
      key={contentKey}
      resource={resource}
      html={html}
      className={className}
      bare={bare}
    />
  )
}

function HtmlFileContentFrame({
  resource,
  html,
  className,
  bare,
}: {
  resource: ViewerResource
  html: string
  className?: string
  bare?: boolean
}) {
  const fileName = resource.fileName
  const { scale, zoom, reset } = useZoom()
  return (
    <div
      data-slot="html-file-viewer-content"
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden bg-card",
        bare ? "h-full" : "min-h-64",
        className
      )}
    >
      <HtmlContentToolbar scale={scale} zoom={zoom} reset={reset} />
      <SandboxedDoc html={html} title={fileName} scale={scale} />
    </div>
  )
}

function HtmlContentToolbar({
  scale,
  zoom,
  reset,
}: {
  scale: number
  zoom: (factor: number) => void
  reset: () => void
}) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-end gap-1 border-b bg-card px-2">
      <ZoomActions scale={scale} zoom={zoom} reset={reset} />
    </div>
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
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-white p-4">
      <iframe
        sandbox=""
        srcDoc={html}
        title={title}
        className="h-full min-h-0 w-full flex-1 border-0 bg-white"
        style={{ zoom: scale }}
      />
    </div>
  )
}
