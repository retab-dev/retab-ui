import * as React from "react"

import { readPdfPageResource } from "@/lib/pdf-document-resource"
import type { PdfDocumentProxy } from "@/lib/pdf-document-types"

import { getPdfCanvasPixelSize } from "./pdf-viewer-canvas"
import { toPdfRenderFailedError } from "./pdf-viewer-render-error"
import type {
  PageOverlayProps,
  PdfPageRenderStatus,
  PdfPageRenderTiming,
  PdfPageSize,
} from "./pdf-viewer-types"

export function PdfPage({
  document,
  pageNumber,
  scale,
  rotation,
  devicePixelRatio,
  renderOverlay,
  onRenderTiming,
  onSize,
}: {
  document: PdfDocumentProxy
  pageNumber: number
  scale: number
  rotation: number
  devicePixelRatio: number
  renderOverlay?: (props: PageOverlayProps) => React.ReactNode
  onRenderTiming?: (timing: PdfPageRenderTiming) => void
  onSize?: (pageNumber: number, size: PdfPageSize) => void
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

  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
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

      canvas.width = getPdfCanvasPixelSize(viewport.width, devicePixelRatio)
      canvas.height = getPdfCanvasPixelSize(viewport.height, devicePixelRatio)
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

function readNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now()
}
