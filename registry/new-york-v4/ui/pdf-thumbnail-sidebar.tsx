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
import { useOptionalPdfViewerThumbnails } from "./pdf-viewer-context"
import { usePdfThumbnailDocument } from "./use-pdf-thumbnail-document"
import { usePdfThumbnailPageMetrics } from "./use-pdf-thumbnail-page-metrics"
import { usePdfThumbnailWindow } from "./use-pdf-thumbnail-window"
import { useThumbnailRailFollow } from "./use-thumbnail-rail-follow"
import { useIsClient } from "./use-is-client"
import { ViewerErrorBoundary } from "./viewer-error"

export interface PdfThumbnailSidebarProps {
  /** Same resource object passed to PdfResourceViewer. */
  resource?: ViewerResource
  /** 1-based current page; its thumbnail is highlighted. */
  currentPage?: number | null
  /** Click a thumbnail to jump the document to that page. */
  onSelectPage?: (page: number) => void
  /** Thumbnail width in CSS pixels. */
  width?: number
  className?: string
}

export function PdfThumbnailSidebar(props: PdfThumbnailSidebarProps) {
  return <PdfViewerThumbnails {...props} />
}

export function PdfViewerThumbnails(props: PdfThumbnailSidebarProps) {
  const thumbnails = useOptionalPdfViewerThumbnails()
  const resource = props.resource ?? thumbnails?.resource
  const currentPage = props.currentPage ?? thumbnails?.currentPage
  const onSelectPage = props.onSelectPage ?? thumbnails?.onSelectPage
  const isClient = useIsClient()

  if (!resource) {
    throw new Error(
      "PdfViewerThumbnails requires a resource prop or PdfViewerProvider."
    )
  }

  if (!isClient) {
    return <SidebarFallback className={props.className} />
  }

  return (
    <ViewerErrorBoundary
      className={cn("h-full", props.className)}
      download={resource.originalDownload}
      format="pdf"
      onRetry={() => clearPdfDocumentResource(resource.content)}
      resetKey={resource.keys.resource}
      sourceKind={resource.sourceKind}
      variant="inline"
    >
      <React.Suspense fallback={<SidebarFallback />}>
        <PdfThumbnailSidebarInner
          {...props}
          resource={resource}
          currentPage={currentPage}
          onSelectPage={onSelectPage}
          className="h-full"
        />
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
}: Omit<PdfThumbnailSidebarProps, "resource"> & { resource: ViewerResource }) {
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
