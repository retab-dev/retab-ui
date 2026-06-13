"use client"

import * as React from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"

import {
  clearPdfDocumentResource,
  readPdfDocumentResource,
  readPdfPageResource,
  releasePdfDocumentResource,
  retainPdfDocumentResource,
} from "@/lib/pdf-document-resource"
import { cn } from "@/lib/utils"
import { createViewerResource } from "@/lib/viewer-resource"
import { useFixedRowVirtualization } from "@/components/ui/fixed-grid-virtualization"
import { Spinner } from "@/components/ui/spinner"

import { getPdfCanvasPixelSize } from "./pdf-viewer-canvas"
import { toPdfRenderFailedError } from "./pdf-viewer-render-error"
import { ViewerErrorBoundary } from "./viewer-error"

const THUMBNAIL_OVERSCAN = 16
const THUMBNAIL_INITIAL_VIEWPORT_HEIGHT = 680
const THUMBNAIL_DEFAULT_ASPECT = 4 / 3
const THUMBNAIL_LABEL_AND_GAP_HEIGHT = 22
const THUMBNAIL_MAX_DEVICE_PIXEL_RATIO = 1
const THUMBNAIL_FOLLOW_MARGIN = 24
const THUMBNAIL_PROGRAMMATIC_SCROLL_WINDOW_MS = 120
const THUMBNAIL_USER_SCROLL_IDLE_MS = 400

interface ThumbnailFollowState {
  isPointerInsideRail: boolean
  isUserScrollingRail: boolean
  lastProgrammaticScrollAt: number
  idleTimer: number | null
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
      onRetry={() => clearPdfDocumentResource(resource.content)}
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
  const doc = readPdfDocumentResource(content)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const followStateRef = React.useRef<ThumbnailFollowState>({
    isPointerInsideRail: false,
    isUserScrollingRail: false,
    lastProgrammaticScrollAt: 0,
    idleTimer: null,
  })
  const estimatedRowHeight =
    Math.ceil(width * THUMBNAIL_DEFAULT_ASPECT) + THUMBNAIL_LABEL_AND_GAP_HEIGHT
  const { virtualRows, totalRowSize } = useFixedRowVirtualization({
    rowCount: doc.numPages,
    rowSize: estimatedRowHeight,
    rowOverscan: THUMBNAIL_OVERSCAN,
    initialViewportHeight: THUMBNAIL_INITIAL_VIEWPORT_HEIGHT,
    scrollRef: viewportRef,
  })

  React.useEffect(() => {
    retainPdfDocumentResource(content, doc)
    return () => releasePdfDocumentResource(content, doc)
  }, [content, doc])

  React.useEffect(() => {
    const state = followStateRef.current
    return () => {
      if (state.idleTimer != null) window.clearTimeout(state.idleTimer)
    }
  }, [])

  React.useEffect(() => {
    const page = normalizeThumbnailPage(currentPage, doc.numPages)
    if (page == null) return

    const state = followStateRef.current
    if (state.isPointerInsideRail || state.isUserScrollingRail) return

    const viewport = viewportRef.current
    if (!viewport) return

    const index = page - 1
    const item = virtualRows.find((item) => item.index === index)
    const itemStart = item?.start ?? index * estimatedRowHeight
    const itemSize = item?.size ?? estimatedRowHeight
    const top = itemStart - viewport.scrollTop
    const bottom = top + itemSize
    const minTop = THUMBNAIL_FOLLOW_MARGIN
    const maxBottom = viewport.clientHeight - THUMBNAIL_FOLLOW_MARGIN
    const isAtDocumentStart =
      itemStart <= THUMBNAIL_FOLLOW_MARGIN &&
      viewport.scrollTop <= THUMBNAIL_FOLLOW_MARGIN

    if ((top >= minTop || isAtDocumentStart) && bottom <= maxBottom) return

    const maxScrollTop = Math.max(0, totalRowSize - viewport.clientHeight)
    const targetTop = Math.min(
      maxScrollTop,
      Math.max(0, itemStart - viewport.clientHeight / 2 + itemSize / 2)
    )

    state.lastProgrammaticScrollAt = performance.now()
    viewport.scrollTo?.({ top: targetTop, behavior: "smooth" })
  }, [currentPage, doc.numPages, estimatedRowHeight, totalRowSize, virtualRows])

  const handlePointerEnter = React.useCallback(() => {
    followStateRef.current.isPointerInsideRail = true
  }, [])

  const handlePointerLeave = React.useCallback(() => {
    followStateRef.current.isPointerInsideRail = false
  }, [])

  const handleScroll = React.useCallback(() => {
    const state = followStateRef.current
    const elapsed = performance.now() - state.lastProgrammaticScrollAt
    if (elapsed < THUMBNAIL_PROGRAMMATIC_SCROLL_WINDOW_MS) return

    state.isUserScrollingRail = true
    if (state.idleTimer != null) window.clearTimeout(state.idleTimer)
    state.idleTimer = window.setTimeout(() => {
      state.isUserScrollingRail = false
      state.idleTimer = null
    }, THUMBNAIL_USER_SCROLL_IDLE_MS)
  }, [])

  return (
    <div
      ref={viewportRef}
      data-slot="pdf-thumbnail-sidebar"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onScroll={handleScroll}
      className={cn("h-full overflow-auto bg-muted/30 p-2", className)}
    >
      <div className="relative w-full" style={{ height: totalRowSize }}>
        {virtualRows.map((item) => {
          const pageNumber = item.index + 1

          return (
            <div
              key={item.index}
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

function normalizeThumbnailPage(
  page: number | null | undefined,
  pageCount: number
): number | null {
  return page != null &&
    Number.isInteger(page) &&
    page >= 1 &&
    page <= pageCount
    ? page
    : null
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
  const page = readPdfPageResource(doc, pageNumber)
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
