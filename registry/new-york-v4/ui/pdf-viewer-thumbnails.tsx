"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

import { clearPdfDocumentResource } from "@/lib/pdf-document-resource";
import { cn } from "@/lib/utils";
import type { ViewerResource } from "@/lib/viewer-resource";
import { Spinner } from "@/components/ui/spinner";

import {
  buildPdfThumbnailLayout,
  PDF_THUMBNAIL_INITIAL_VIEWPORT_HEIGHT,
  PDF_THUMBNAIL_OVERSCAN,
  type PdfThumbnailShape,
} from "./pdf-thumbnail-layout";
import { PdfThumbnailRailViewport } from "./pdf-thumbnail-rail";
import { usePdfViewerThumbnails } from "./pdf-viewer-context";
import { useIsClient } from "./use-is-client";
import { usePdfThumbnailDocument } from "./use-pdf-thumbnail-document";
import { usePdfThumbnailPageMetrics } from "./use-pdf-thumbnail-page-metrics";
import { usePdfThumbnailWindow } from "./use-pdf-thumbnail-window";
import { useThumbnailRailFollow } from "./use-thumbnail-rail-follow";
import { ViewerErrorBoundary } from "./viewer-error";

export interface PdfViewerThumbnailsProps {
  /** Thumbnail image width in CSS pixels. The sidebar shell owns rail width. */
  thumbnailWidth?: number;
  /** Preserve page aspect or crop each page preview into a square frame. */
  thumbnailShape?: PdfThumbnailShape;
  className?: string;
}

export interface PdfThumbnailRailProps {
  /** Same resource object passed to PdfResourceContent. */
  resource: ViewerResource;
  /** 1-based current page; its thumbnail is highlighted. */
  currentPage?: number | null;
  /** Click a thumbnail to jump the document to that page. */
  onSelectPage?: (page: number) => void;
  /** Thumbnail image width in CSS pixels. The sidebar shell owns rail width. */
  thumbnailWidth?: number;
  /** Preserve page aspect or crop each page preview into a square frame. */
  thumbnailShape?: PdfThumbnailShape;
  className?: string;
}

export function PdfViewerThumbnails({
  className,
  thumbnailShape,
  thumbnailWidth,
}: PdfViewerThumbnailsProps) {
  const thumbnails = usePdfViewerThumbnails();

  return (
    <PdfThumbnailRail
      className={className}
      currentPage={thumbnails.currentPage}
      onSelectPage={thumbnails.onSelectPage}
      resource={thumbnails.resource}
      thumbnailShape={thumbnailShape}
      thumbnailWidth={thumbnailWidth}
    />
  );
}

export function PdfThumbnailRail({
  className,
  currentPage,
  onSelectPage,
  resource,
  thumbnailShape,
  thumbnailWidth,
}: PdfThumbnailRailProps) {
  const isClient = useIsClient();

  if (!isClient) {
    return <ThumbnailsFallback className={className} />;
  }

  return (
    <ViewerErrorBoundary
      className={cn("h-full", className)}
      download={resource.originalDownload}
      format="pdf"
      onRetry={() => clearPdfDocumentResource(resource.content)}
      resetKey={resource.keys.resource}
      sourceKind={resource.sourceKind}
      variant="inline"
    >
      <React.Suspense fallback={<ThumbnailsFallback />}>
        <PdfThumbnailRailInner
          currentPage={currentPage}
          onSelectPage={onSelectPage}
          resource={resource}
          thumbnailShape={thumbnailShape}
          thumbnailWidth={thumbnailWidth}
          className="h-full"
        />
      </React.Suspense>
    </ViewerErrorBoundary>
  );
}

function PdfThumbnailRailInner({
  resource,
  currentPage,
  onSelectPage,
  thumbnailShape = "page",
  thumbnailWidth = 120,
  className,
}: PdfThumbnailRailProps) {
  const doc = usePdfThumbnailDocument(resource);
  const pageMetrics = usePdfThumbnailPageMetrics(doc, doc);
  const { metricByPageNumber, pageCount, requestPageMetrics } = pageMetrics;
  const viewportRef = React.useRef<HTMLDivElement | null>(null);

  const layout = React.useMemo(
    () =>
      buildPdfThumbnailLayout({
        pageCount,
        width: thumbnailWidth,
        shape: thumbnailShape,
        metricByPageNumber,
      }),
    [metricByPageNumber, pageCount, thumbnailShape, thumbnailWidth],
  );
  const thumbnailWindow = usePdfThumbnailWindow({
    layout,
    viewportRef,
    overscan: PDF_THUMBNAIL_OVERSCAN,
    initialViewportHeight: PDF_THUMBNAIL_INITIAL_VIEWPORT_HEIGHT,
  });
  const follow = useThumbnailRailFollow({
    currentPage,
    layout,
    viewportRef,
    resetKey: doc,
  });
  React.useEffect(() => {
    requestPageMetrics(
      getRequestedThumbnailMetricPages({
        currentPage,
        pageCount: layout.pageCount,
        visibleItems: thumbnailWindow.visibleItems,
      }),
    );
  }, [
    currentPage,
    layout.pageCount,
    requestPageMetrics,
    thumbnailWindow.visibleItems,
  ]);

  return (
    <PdfThumbnailRailViewport
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
  );
}

function getRequestedThumbnailMetricPages({
  currentPage,
  pageCount,
  visibleItems,
}: {
  currentPage: number | null | undefined;
  pageCount: number;
  visibleItems: readonly { pageNumber: number }[];
}) {
  const pageNumbers = new Set<number>();
  for (const item of visibleItems) pageNumbers.add(item.pageNumber);
  if (
    currentPage != null &&
    Number.isInteger(currentPage) &&
    currentPage >= 1 &&
    currentPage <= pageCount
  ) {
    pageNumbers.add(currentPage);
  }

  return pageNumbers;
}

function ThumbnailsFallback({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-muted/30 flex h-full items-center justify-center",
        className,
      )}
    >
      <Spinner className="text-muted-foreground size-4" />
    </div>
  );
}
