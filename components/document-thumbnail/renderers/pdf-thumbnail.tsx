"use client"

import * as React from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"

import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"
import {
  getDocumentResource,
  getPageResource,
} from "@/components/ui/pdf-viewer"
import { useThumbnailResource } from "@/components/document-thumbnail/cache"
import type { ThumbnailAnchor } from "@/components/document-thumbnail/types"
import { ANCHOR_CORNER } from "@/components/document-thumbnail/types"

// Page 1 via pdfjs, reusing the PdfViewer's cached document.
export function PdfFirstPage({
  resource,
  anchor,
}: {
  resource: ViewerResource
  anchor: ThumbnailAnchor
}) {
  const doc = useThumbnailResource(
    getDocumentResource(resource)
  ) as PDFDocumentProxy
  const page = useThumbnailResource(getPageResource(doc, 1))

  const RENDER_W = 520
  const viewport = React.useMemo(() => {
    const base = page.getViewport({ scale: 1 })
    return page.getViewport({ scale: RENDER_W / base.width })
  }, [page])
  const dpr = (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1

  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      const context = canvas.getContext("2d")
      if (!context) return
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      const task = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      })
      task.promise.catch(() => {})
      return () => task.cancel()
    },
    [page, viewport, dpr]
  )

  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <canvas
        ref={canvasRef}
        className={cn("absolute block w-full", ANCHOR_CORNER[anchor])}
      />
    </div>
  )
}
