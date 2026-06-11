import * as React from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"

import { getPageResource } from "./pdf-viewer-resource"
import type { PageOverlayProps, PdfPageSize } from "./pdf-viewer-types"

export function PdfPage({
  document,
  pageNumber,
  scale,
  rotation,
  renderOverlay,
  onSize,
}: {
  document: PDFDocumentProxy
  pageNumber: number
  scale: number
  rotation: number
  renderOverlay?: (props: PageOverlayProps) => React.ReactNode
  onSize?: (pageNumber: number, size: PdfPageSize) => void
}) {
  const page = React.use(getPageResource(document, pageNumber))
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
  const devicePixelRatio =
    (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1

  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      const context = canvas.getContext("2d")
      if (!context) return

      canvas.width = Math.floor(viewport.width * devicePixelRatio)
      canvas.height = Math.floor(viewport.height * devicePixelRatio)
      const renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform:
          devicePixelRatio !== 1
            ? [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0]
            : undefined,
      })
      renderTask.promise.catch(() => {
        /* cancelled or failed render */
      })
      return () => renderTask.cancel()
    },
    [devicePixelRatio, page, viewport]
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
