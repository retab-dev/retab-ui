"use client"

import * as React from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"

import { readPdfPageResource } from "@/lib/pdf-document-resource"

import { getPdfCanvasPixelSize } from "./pdf-viewer-canvas"
import { toPdfRenderFailedError } from "./pdf-viewer-render-error"

const PDF_THUMBNAIL_MAX_DEVICE_PIXEL_RATIO = 1

export function PdfThumbnailCanvas({
  doc,
  pageNumber,
  width,
}: {
  doc: PDFDocumentProxy
  pageNumber: number
  width: number
}) {
  const page = readPdfPageResource(doc, pageNumber)
  const baseViewport = React.useMemo(
    () => page.getViewport({ scale: 1 }),
    [page]
  )
  const viewport = React.useMemo(
    () => page.getViewport({ scale: width / baseViewport.width }),
    [baseViewport.width, page, width]
  )
  const dpr = Math.min(
    (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1,
    PDF_THUMBNAIL_MAX_DEVICE_PIXEL_RATIO
  )
  const [renderError, setRenderError] = React.useState<unknown>(null)
  if (renderError) throw renderError

  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      const context = canvas.getContext("2d")
      if (!context) {
        setRenderError(
          toPdfRenderFailedError(new Error("Canvas 2D context unavailable."))
        )
        return
      }

      canvas.width = getPdfCanvasPixelSize(viewport.width, dpr)
      canvas.height = getPdfCanvasPixelSize(viewport.height, dpr)

      let task: ReturnType<typeof page.render>
      try {
        task = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        })
      } catch (error) {
        setRenderError(toPdfRenderFailedError(error))
        return
      }

      let isActive = true
      task.promise.catch((error) => {
        if (isActive) setRenderError(toPdfRenderFailedError(error))
      })

      return () => {
        isActive = false
        task.cancel()
      }
    },
    [page, viewport, dpr]
  )

  return (
    <canvas
      ref={canvasRef}
      style={{ width: viewport.width, height: viewport.height }}
      className="block"
    />
  )
}

export function PdfThumbnailSkeleton() {
  return <div className="aspect-[3/4] w-full bg-muted" />
}
