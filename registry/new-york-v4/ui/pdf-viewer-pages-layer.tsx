"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import type { FileViewerDocumentAlign } from "./file-viewer-renderer-contract";
import { useOptionalFileViewerRendererEnvironment } from "./file-viewer-renderer-frame";
import {
  getPdfRenderedPageWindow,
  type PdfPageLayoutModel,
} from "./pdf-viewer-layout";
import { PdfPage } from "./pdf-viewer-page";
import type { PdfRenderedPageCache } from "./pdf-viewer-render-cache";
import { PageSkeleton } from "./pdf-viewer-states";
import type {
  PageOverlayProps,
  PdfPageRenderTiming,
  PdfPageSize,
} from "./pdf-viewer-types";
import type { PdfDocument } from "./pdf-viewer-document-resource";

export const PDF_DOCUMENT_ANCHOR_BLOCK_PROPERTY =
  "--pdf-viewer-document-anchor-block";

export type PdfDocumentPagesLayerProps = {
  activeRenderPageNumbers: readonly number[];
  containerRef: React.RefCallback<HTMLDivElement>;
  devicePixelRatio: number;
  document: PdfDocument;
  documentAlign: FileViewerDocumentAlign | null;
  documentKey: string;
  isLayoutTransitioning: boolean;
  layout: PdfPageLayoutModel;
  onPageRenderTiming?: (timing: PdfPageRenderTiming) => void;
  physicalScrollHeight: number;
  renderCache?: PdfRenderedPageCache;
  renderPageNumbers: readonly number[];
  renderPageOverlay?: (props: PageOverlayProps) => React.ReactNode;
  renderScale: number;
  rotation: number;
  scale: number;
  scrollPageOffset: number;
  setDocumentSurfaceElement: React.RefCallback<HTMLElement>;
  setScrollInteractionElement: React.RefCallback<HTMLDivElement>;
  setPageSize: (pageNumber: number, size: PdfPageSize) => void;
  visualScale: number;
  viewportHeight: number;
  visiblePageNumbers: readonly number[];
};

export function PdfDocumentPagesLayer({
  activeRenderPageNumbers,
  containerRef,
  devicePixelRatio,
  document,
  documentAlign,
  documentKey,
  isLayoutTransitioning,
  layout,
  onPageRenderTiming,
  physicalScrollHeight,
  renderCache,
  renderPageNumbers,
  renderPageOverlay,
  renderScale,
  rotation,
  scale,
  scrollPageOffset,
  setDocumentSurfaceElement,
  setScrollInteractionElement,
  setPageSize,
  visualScale,
  viewportHeight,
  visiblePageNumbers,
}: PdfDocumentPagesLayerProps) {
  const visiblePageNumberSet = React.useMemo(
    () => new Set(visiblePageNumbers),
    [visiblePageNumbers],
  );
  const { setDocumentSurfaceElement: setFileViewerDocumentSurfaceElement } =
    useOptionalFileViewerRendererEnvironment();
  const setVisualStageElement = React.useCallback(
    (element: HTMLElement | null) => {
      setFileViewerDocumentSurfaceElement(element);
      setDocumentSurfaceElement(element);
    },
    [setDocumentSurfaceElement, setFileViewerDocumentSurfaceElement],
  );
  const activeRenderPageNumberSet = React.useMemo(
    () => new Set(activeRenderPageNumbers),
    [activeRenderPageNumbers],
  );
  const renderedWindow = React.useMemo(
    () =>
      getPdfRenderedPageWindow({
        layout,
        pageNumbers: renderPageNumbers,
        physicalScrollHeight,
        scrollPageOffset,
        viewportHeight,
      }),
    [
      layout,
      physicalScrollHeight,
      renderPageNumbers,
      scrollPageOffset,
      viewportHeight,
    ],
  );
  const isInsideDocumentFrame = documentAlign !== null;
  const isVisuallyScaling = Math.abs(visualScale - 1) > 0.001;
  const visualStageStyle = {
    minWidth: layout.maxPageWidth,
    transformOrigin: getPdfDocumentTransformOrigin(documentAlign),
    width: layout.maxPageWidth,
  } satisfies React.CSSProperties;
  const documentStyle = {
    contain: "layout style",
    height: physicalScrollHeight,
    minWidth: layout.maxPageWidth,
    width: layout.maxPageWidth,
  } satisfies React.CSSProperties;

  const documentContent = (
    <div
      ref={setVisualStageElement}
      data-slot="pdf-viewer-visual-stage"
      data-visual-scale={isVisuallyScaling ? visualScale : undefined}
      className={cn("relative", getPdfDocumentFrameAlignClass(documentAlign))}
      style={visualStageStyle}
    >
      <div
        data-slot="pdf-viewer-document"
        data-layout-transitioning={isLayoutTransitioning ? "" : undefined}
        className="relative"
        style={documentStyle}
      >
        {renderedWindow ? (
          <>
            <div
              aria-hidden
              data-slot="pdf-page-window-before"
              style={{
                contain: "layout size",
                height: renderedWindow.beforeHeight,
              }}
            />
            <div
              ref={setScrollInteractionElement}
              data-slot="pdf-page-sticky-window"
              className="sticky"
              style={{
                bottom: renderedWindow.stickyInset,
                contain: "layout style inline-size",
                height: renderedWindow.height,
                isolation: "isolate",
                top: renderedWindow.stickyInset,
              }}
            >
              <div
                data-slot="pdf-page-window"
                className="relative"
                style={{
                  contain: "layout style",
                  height: renderedWindow.height,
                }}
              >
                {renderedWindow.pages.map((page) => (
                  <div
                    key={page.pageNumber}
                    className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center"
                    data-layout-transitioning={
                      isLayoutTransitioning ? "" : undefined
                    }
                    data-slot="pdf-page-slot"
                    data-page-number={page.pageNumber}
                    data-visible={
                      visiblePageNumberSet.has(page.pageNumber) ? "" : undefined
                    }
                    style={{
                      top: page.windowTop,
                      width: page.width,
                      minHeight: page.height,
                    }}
                  >
                    {activeRenderPageNumberSet.has(page.pageNumber) ? (
                      <React.Suspense fallback={<PageSkeleton />}>
                        <PdfPage
                          document={document}
                          documentKey={documentKey}
                          pageNumber={page.pageNumber}
                          scale={scale}
                          renderScale={renderScale}
                          isLayoutTransitioning={isLayoutTransitioning}
                          rotation={rotation}
                          devicePixelRatio={devicePixelRatio}
                          renderCache={renderCache}
                          renderOverlay={renderPageOverlay}
                          onRenderTiming={onPageRenderTiming}
                          onSize={setPageSize}
                        />
                      </React.Suspense>
                    ) : (
                      <PageSkeleton />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div
              aria-hidden
              data-slot="pdf-page-window-after"
              style={{
                contain: "layout size",
                height: renderedWindow.afterHeight,
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      data-slot="pdf-viewer-fit-width-measure"
      className={cn(
        "relative min-w-0",
        isInsideDocumentFrame && "h-full w-full",
      )}
    >
      {documentContent}
    </div>
  );
}

function getPdfDocumentTransformOrigin(align: FileViewerDocumentAlign | null) {
  const blockOrigin = `var(${PDF_DOCUMENT_ANCHOR_BLOCK_PROPERTY}, 0px)`;

  switch (align) {
    case "center":
    case null:
      return `center ${blockOrigin}`;
    case "end":
      return `right ${blockOrigin}`;
    case "start":
      return `left ${blockOrigin}`;
  }
}

function getPdfDocumentFrameAlignClass(align: FileViewerDocumentAlign | null) {
  switch (align) {
    case "center":
    case null:
      return "mx-auto";
    case "end":
      return "ml-auto";
    case "start":
      return "mr-auto";
  }
}
