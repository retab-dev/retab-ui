import * as React from "react"

import { readPdfPageResource } from "@/lib/pdf-document-resource"
import type { PdfDocumentProxy } from "@/lib/pdf-document-types"

import { getPdfCanvasPixelSize } from "./pdf-viewer-canvas"
import {
  readPdfRenderedPageCache,
  writePdfRenderedPageCache,
  type PdfRenderedPageCache,
  type PdfRenderedPageSignature,
} from "./pdf-viewer-render-cache"
import { toPdfRenderFailedError } from "./pdf-viewer-render-error"
import type {
  PageOverlayProps,
  PdfPageRenderStatus,
  PdfPageRenderTiming,
  PdfPageSize,
} from "./pdf-viewer-types"

type PdfRenderedCanvas = {
  pageNumber: number
  scale: number
  rotation: number
  devicePixelRatio: number
  viewportWidth: number
  viewportHeight: number
}

export function PdfPage({
  document,
  pageNumber,
  scale,
  rotation,
  devicePixelRatio,
  renderOverlay,
  onRenderTiming,
  onSize,
  renderCache,
}: {
  document: PdfDocumentProxy
  pageNumber: number
  scale: number
  rotation: number
  devicePixelRatio: number
  renderOverlay?: (props: PageOverlayProps) => React.ReactNode
  onRenderTiming?: (timing: PdfPageRenderTiming) => void
  onSize?: (pageNumber: number, size: PdfPageSize) => void
  renderCache?: PdfRenderedPageCache
}) {
  const page = readPdfPageResource(document, pageNumber)
  const intrinsicViewport = React.useMemo(
    () => page.getViewport({ scale: 1, rotation: page.rotate ?? 0 }),
    [page]
  )

  React.useEffect(() => {
    onSize?.(pageNumber, {
      width: intrinsicViewport.width,
      height: intrinsicViewport.height,
    })
  }, [intrinsicViewport.height, intrinsicViewport.width, onSize, pageNumber])

  const viewport = React.useMemo(
    () =>
      page.getViewport({
        scale,
        rotation: ((page.rotate ?? 0) + rotation) % 360,
      }),
    [page, rotation, scale]
  )
  const [renderError, setRenderError] = React.useState<unknown>(null)
  if (renderError) throw renderError

  const renderedCanvasRef = React.useRef<PdfRenderedCanvas | null>(null)

  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      const renderSignature = {
        pageNumber,
        scale,
        rotation,
        devicePixelRatio,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
      } satisfies PdfRenderedPageSignature
      if (
        renderedCanvasRef.current &&
        canReuseRenderedCanvas(renderedCanvasRef.current, renderSignature)
      ) {
        return
      }

      const startedAt = readNow()
      let didReportRenderTiming = false
      const reportRenderTiming = (status: PdfPageRenderStatus) => {
        if (didReportRenderTiming) return
        didReportRenderTiming = true
        onRenderTiming?.({
          pageNumber,
          scale,
          rotation,
          devicePixelRatio,
          status,
          durationMs: Math.max(0, readNow() - startedAt),
        })
      }
      const context = canvas.getContext("2d")
      if (!context) {
        reportRenderTiming("failed")
        setRenderError(
          toPdfRenderFailedError(new Error("Canvas 2D context unavailable."))
        )
        return
      }

      const cached = readPdfRenderedPageCache(renderCache, renderSignature)
      if (cached) {
        canvas.width = cached.canvas.width
        canvas.height = cached.canvas.height
        context.drawImage(cached.canvas, 0, 0)
        renderedCanvasRef.current = cached
        reportRenderTiming("rendered")
        return
      }

      canvas.width = getPdfCanvasPixelSize(
        renderSignature.viewportWidth,
        devicePixelRatio
      )
      canvas.height = getPdfCanvasPixelSize(
        renderSignature.viewportHeight,
        devicePixelRatio
      )
      let renderTask: ReturnType<typeof page.render>
      try {
        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform:
            devicePixelRatio !== 1
              ? [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0]
              : undefined,
        })
      } catch (error) {
        reportRenderTiming("failed")
        setRenderError(toPdfRenderFailedError(error))
        return
      }
      let isActive = true
      renderTask.promise.then(
        () => {
          if (!isActive) return
          renderedCanvasRef.current = renderSignature
          writePdfRenderedPageCache({
            cache: renderCache,
            rendered: renderSignature,
            sourceCanvas: canvas,
          })
          reportRenderTiming("rendered")
        },
        (error) => {
          if (!isActive) return
          reportRenderTiming("failed")
          setRenderError(toPdfRenderFailedError(error))
        }
      )
      return () => {
        isActive = false
        if (!didReportRenderTiming) {
          reportRenderTiming("cancelled")
          renderTask.cancel()
        }
      }
    },
    [
      devicePixelRatio,
      onRenderTiming,
      page,
      pageNumber,
      renderCache,
      rotation,
      scale,
      viewport,
    ]
  )

  return (
    <div
      className="relative shadow-sm ring-1 ring-border"
      style={{ width: viewport.width, height: viewport.height }}
      data-slot="pdf-page"
      data-page={pageNumber}
    >
      <canvas
        ref={canvasRef}
        style={{ width: viewport.width, height: viewport.height }}
        className="block bg-white"
      />
      {renderOverlay ? (
        <div className="pointer-events-none absolute inset-0">
          {renderOverlay({
            pageNumber,
            width: viewport.width,
            height: viewport.height,
            scale,
            rotation,
          })}
        </div>
      ) : null}
    </div>
  )
}

function canReuseRenderedCanvas(
  rendered: PdfRenderedCanvas,
  requested: PdfRenderedCanvas
) {
  return (
    rendered.pageNumber === requested.pageNumber &&
    rendered.scale === requested.scale &&
    rendered.rotation === requested.rotation &&
    rendered.viewportWidth === requested.viewportWidth &&
    rendered.viewportHeight === requested.viewportHeight &&
    rendered.devicePixelRatio >= requested.devicePixelRatio
  )
}

function readNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now()
}
