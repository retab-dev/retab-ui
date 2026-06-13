"use client"

import * as React from "react"

import { clearPdfDocumentResource } from "@/lib/pdf-document-resource"
import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"
import { Spinner } from "@/components/ui/spinner"

import {
  buildPdfThumbnailLayout,
  PDF_THUMBNAIL_INITIAL_VIEWPORT_HEIGHT,
  PDF_THUMBNAIL_OVERSCAN,
} from "./pdf-thumbnail-layout"
import { PdfThumbnailRail } from "./pdf-thumbnail-rail"
import { usePdfThumbnailDocument } from "./use-pdf-thumbnail-document"
import { usePdfThumbnailPageMetrics } from "./use-pdf-thumbnail-page-metrics"
import { usePdfThumbnailWindow } from "./use-pdf-thumbnail-window"
import { useThumbnailRailFollow } from "./use-thumbnail-rail-follow"
import { ViewerErrorBoundary } from "./viewer-error"

export interface PdfThumbnailSidebarProps {
  /** Same resource object passed to PdfResourceViewer. */
  resource: ViewerResource
  /** 1-based current page; its thumbnail is highlighted. */
  currentPage?: number | null
  /** Click a thumbnail to jump the document to that page. */
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
  const resource = props.resource

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
        <PdfThumbnailSidebarInner {...props} />
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
}: PdfThumbnailSidebarProps) {
  const doc = usePdfThumbnailDocument(resource)
  const pageMetrics = usePdfThumbnailPageMetrics(doc, doc)
  const { metricByPageNumber, pageCount, requestPageMetrics } = pageMetrics
  const viewportRef = React.useRef<HTMLDivElement | null>(null)

  const layout = React.useMemo(
    () =>
      buildPdfThumbnailLayout({
        pageCount,
        width,
        metricByPageNumber,
      }),
    [metricByPageNumber, pageCount, width]
  )
  const thumbnailWindow = usePdfThumbnailWindow({
    layout,
    viewportRef,
    overscan: PDF_THUMBNAIL_OVERSCAN,
    initialViewportHeight: PDF_THUMBNAIL_INITIAL_VIEWPORT_HEIGHT,
  })
  const follow = useThumbnailRailFollow({
    currentPage,
    layout,
    viewportRef,
    resetKey: doc,
  })
  React.useEffect(() => {
    requestPageMetrics(
      getRequestedThumbnailMetricPages({
        currentPage,
        pageCount: layout.pageCount,
        visibleItems: thumbnailWindow.visibleItems,
      })
    )
  }, [
    currentPage,
    layout.pageCount,
    requestPageMetrics,
    thumbnailWindow.visibleItems,
  ])

  return (
    <PdfThumbnailRail
      doc={doc}
      layout={layout}
      visibleItems={thumbnailWindow.visibleItems}
      currentPage={currentPage}
      viewportRef={viewportRef}
      onSelectPage={onSelectPage}
      onPageActivate={follow.onPageActivate}
      onPointerEnter={follow.onPointerEnter}
      onPointerLeave={follow.onPointerLeave}
      onScroll={follow.onScroll}
      className={className}
    />
  )
}

function getRequestedThumbnailMetricPages({
  currentPage,
  pageCount,
  visibleItems,
}: {
  currentPage: number | null | undefined
  pageCount: number
  visibleItems: readonly { pageNumber: number }[]
}) {
  const pageNumbers = new Set<number>()
  for (const item of visibleItems) pageNumbers.add(item.pageNumber)
  if (
    currentPage != null &&
    Number.isInteger(currentPage) &&
    currentPage >= 1 &&
    currentPage <= pageCount
  ) {
    pageNumbers.add(currentPage)
  }

  return pageNumbers
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
