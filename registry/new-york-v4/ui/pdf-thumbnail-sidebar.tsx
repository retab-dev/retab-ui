"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { PDFDocumentProxy } from "pdfjs-dist"

import { cn } from "@/lib/utils"
import { createViewerResource } from "@/lib/viewer-resource"
import { Spinner } from "@/components/ui/spinner"

import { getPdfCanvasPixelSize } from "./pdf-viewer-canvas"
import { toPdfRenderFailedError } from "./pdf-viewer-render-error"
import {
  clearDocumentResource,
  readDocumentResource,
  readPageResource,
  releaseDocumentResource,
  retainDocumentResource,
} from "./pdf-viewer-resource"
import { ViewerErrorBoundary } from "./viewer-error"

const THUMBNAIL_OVERSCAN = 16
const THUMBNAIL_INITIAL_VIEWPORT_HEIGHT = 680
const THUMBNAIL_DEFAULT_ASPECT = 4 / 3
const THUMBNAIL_LABEL_AND_GAP_HEIGHT = 22
const THUMBNAIL_MAX_DEVICE_PIXEL_RATIO = 1

interface ThumbnailVirtualItem {
  index: number
  key: React.Key
  start: number
  size: number
}

export interface PdfThumbnailSidebarProps {
  /** Same URL as the PdfViewer; the document load is shared by resource cache key. */
  src: string
  /** 1-based current page; its thumbnail is highlighted. */
  currentPage?: number | null
  /** Click a thumbnail → jump the document to that page. */
  onSelectPage?: (page: number) => void
  /** Thumbnail width in CSS pixels. */
  width?: number
  className?: string
}

/**
 * A page-thumbnail rail for the PdfViewer `slots.left` rail. Each thumbnail is a
 * small pdfjs render of the page. The rail is virtualized, so only the visible
 * rows plus overscan mount and render, even for large documents. Reuses the
 * PdfViewer's cached document.
 */
export function PdfThumbnailSidebar(props: PdfThumbnailSidebarProps) {
  const resource = React.useMemo(
    () => createViewerResource({ kind: "url", url: props.src }),
    [props.src]
  )

  return (
    <ViewerErrorBoundary
      className={props.className}
      download={resource.originalDownload}
      format="pdf"
      onRetry={() => clearDocumentResource(resource.content)}
      resetKey={resource.keys.resource}
      sourceKind={resource.sourceKind}
      variant="inline"
    >
      <React.Suspense
        fallback={<SidebarFallback className={props.className} />}
      >
        <PdfThumbnailSidebarInner {...props} resource={resource} />
      </React.Suspense>
    </ViewerErrorBoundary>
  )
}

function PdfThumbnailSidebarInner({
  resource,
  currentPage,
  onSelectPage,
  width = 120,
  className,
}: PdfThumbnailSidebarProps & {
  resource: ReturnType<typeof createViewerResource>
}) {
  const content = resource.content
  const doc = readDocumentResource(content)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const estimatedRowHeight =
    Math.ceil(width * THUMBNAIL_DEFAULT_ASPECT) + THUMBNAIL_LABEL_AND_GAP_HEIGHT
  const virtualizer = useVirtualizer({
    count: doc.numPages,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: THUMBNAIL_OVERSCAN,
    initialRect: {
      width,
      height: THUMBNAIL_INITIAL_VIEWPORT_HEIGHT,
    },
  })

  React.useEffect(() => {
    retainDocumentResource(content, doc)
    return () => releaseDocumentResource(content, doc)
  }, [content, doc])

  const measuredVirtualItems = virtualizer.getVirtualItems()
  const virtualItems =
    measuredVirtualItems.length > 0
      ? measuredVirtualItems
      : createInitialThumbnailVirtualItems(doc.numPages, estimatedRowHeight)

  return (
    <div
      ref={viewportRef}
      data-slot="pdf-thumbnail-sidebar"
      className={cn("h-full overflow-auto bg-muted/30 p-2", className)}
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualItems.map((item) => {
          const pageNumber = item.index + 1

          return (
            <div
              key={item.key}
              data-index={item.index}
              className="absolute top-0 left-0 flex w-full justify-center pb-2"
              style={{
                height: item.size,
                transform: `translateY(${item.start}px)`,
              }}
            >
              <Thumbnail
                doc={doc}
                pageNumber={pageNumber}
                width={width}
                active={currentPage === pageNumber}
                onSelect={() => onSelectPage?.(pageNumber)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function createInitialThumbnailVirtualItems(
  pageCount: number,
  estimatedRowHeight: number
): ThumbnailVirtualItem[] {
  const rowCount = Math.min(
    pageCount,
    Math.ceil(THUMBNAIL_INITIAL_VIEWPORT_HEIGHT / estimatedRowHeight) +
      THUMBNAIL_OVERSCAN * 2
  )

  return Array.from({ length: rowCount }, (_, index) => ({
    index,
    key: index,
    start: index * estimatedRowHeight,
    size: estimatedRowHeight,
  }))
}

function Thumbnail({
  doc,
  pageNumber,
  width,
  active,
  onSelect,
}: {
  doc: PDFDocumentProxy
  pageNumber: number
  width: number
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-active={active}
      aria-current={active ? "page" : undefined}
      className="flex flex-shrink-0 flex-col items-center gap-1 outline-none"
    >
      <div
        className={cn(
          "overflow-hidden rounded-sm bg-white ring-2 transition-shadow",
          active ? "ring-primary" : "ring-border"
        )}
        style={{ width }}
      >
        <React.Suspense fallback={<ThumbSkeleton />}>
          <ThumbnailCanvas doc={doc} pageNumber={pageNumber} width={width} />
        </React.Suspense>
      </div>
      <span
        className={cn(
          "text-[10px] tabular-nums",
          active ? "font-semibold text-foreground" : "text-muted-foreground"
        )}
      >
        {pageNumber}
      </span>
    </button>
  )
}

function ThumbnailCanvas({
  doc,
  pageNumber,
  width,
}: {
  doc: PDFDocumentProxy
  pageNumber: number
  width: number
}) {
  const page = readPageResource(doc, pageNumber)
  // Default rotation uses the page's intrinsic /Rotate (correct orientation).
  const viewport = React.useMemo(() => {
    const base = page.getViewport({ scale: 1 })
    return page.getViewport({ scale: width / base.width })
  }, [page, width])
  const dpr = Math.min(
    (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1,
    THUMBNAIL_MAX_DEVICE_PIXEL_RATIO
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

function ThumbSkeleton() {
  return <div className="aspect-[3/4] w-full bg-muted" />
}

function SidebarFallback({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full items-center justify-center bg-muted/30",
        className
      )}
    >
      <Spinner className="size-4 text-muted-foreground" />
    </div>
  )
}
