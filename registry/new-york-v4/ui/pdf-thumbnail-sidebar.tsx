"use client"

import * as React from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"

import { cn } from "@/lib/utils"
import { createViewerResource } from "@/lib/viewer-resource"
import { Spinner } from "@/components/ui/spinner"

import {
  getDocumentResource,
  getPageResource,
  releaseDocumentResource,
  retainDocumentResource,
} from "./pdf-viewer-resource"

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
 * small pdfjs render of the page, rendered lazily as it scrolls into view (no
 * `useEffect` — an IntersectionObserver in a ref callback gates rendering), so
 * it scales to large documents. Reuses the PdfViewer's cached document.
 */
export function PdfThumbnailSidebar(props: PdfThumbnailSidebarProps) {
  return (
    <React.Suspense fallback={<SidebarFallback className={props.className} />}>
      <PdfThumbnailSidebarInner {...props} />
    </React.Suspense>
  )
}

function PdfThumbnailSidebarInner({
  src,
  currentPage,
  onSelectPage,
  width = 120,
  className,
}: PdfThumbnailSidebarProps) {
  const resource = React.useMemo(
    () => createViewerResource({ kind: "url", url: src }),
    [src]
  )
  const doc = React.use(getDocumentResource(resource))
  React.useEffect(() => {
    retainDocumentResource(resource, doc)
    return () => releaseDocumentResource(resource, doc)
  }, [doc, resource])

  return (
    <div
      data-slot="pdf-thumbnail-sidebar"
      className={cn(
        "flex h-full flex-col items-center gap-2 overflow-auto bg-muted/30 p-2",
        className
      )}
    >
      {Array.from({ length: doc.numPages }, (_, i) => (
        <Thumbnail
          key={i}
          doc={doc}
          pageNumber={i + 1}
          width={width}
          active={currentPage === i + 1}
          onSelect={() => onSelectPage?.(i + 1)}
        />
      ))}
    </div>
  )
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
  const [visible, setVisible] = React.useState(false)

  // Render only once the thumbnail nears the viewport (no effect).
  const observerRef = React.useCallback(
    (el: HTMLButtonElement | null) => {
      if (!el || visible) return
      if (typeof IntersectionObserver === "undefined") {
        setVisible(true)
        return
      }
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        },
        { rootMargin: "400px 0px" }
      )
      observer.observe(el)
      return () => observer.disconnect()
    },
    [visible]
  )

  return (
    <button
      ref={observerRef}
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
        style={{ width, aspectRatio: visible ? undefined : "3 / 4" }}
      >
        {visible ? (
          <React.Suspense fallback={<ThumbSkeleton />}>
            <ThumbnailCanvas doc={doc} pageNumber={pageNumber} width={width} />
          </React.Suspense>
        ) : (
          <ThumbSkeleton />
        )}
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
  const page = React.use(getPageResource(doc, pageNumber))
  // Default rotation uses the page's intrinsic /Rotate (correct orientation).
  const viewport = React.useMemo(() => {
    const base = page.getViewport({ scale: 1 })
    return page.getViewport({ scale: width / base.width })
  }, [page, width])
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
      task.promise.catch(() => {
        /* cancelled or failed — ignore */
      })
      return () => task.cancel()
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
  return (
    <div className="flex aspect-[3/4] w-full items-center justify-center bg-muted">
      <Spinner className="size-3 text-muted-foreground" />
    </div>
  )
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
