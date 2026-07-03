"use client";

import * as React from "react";

import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";
import { cn } from "@/lib/utils";

import type { FileViewerDocumentAlign } from "./file-viewer-renderer-contract";
import type { FileViewerDocumentSurfaceMotionResolver } from "./file-viewer-motion-kernel";
import { useOptionalFileViewerRendererEnvironment } from "./file-viewer-renderer-frame";
import {
  PDF_PAGE_GAP,
  getPdfRenderedPageWindow,
  type PdfPageLayoutModel,
  type PdfRenderedPageLayout,
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
import { PDF_DOCUMENT_MOTION_SCALE_PROPERTY } from "./pdf-viewer-motion-contract";

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
  resolveSurfaceMotionStyle: FileViewerDocumentSurfaceMotionResolver;
  rotation: number;
  scale: number;
  scrollPageOffset: number;
  setDocumentSurfaceElement: React.RefCallback<HTMLElement>;
  setScrollInteractionElement: React.RefCallback<HTMLDivElement>;
  setPageSize: (pageNumber: number, size: PdfPageSize) => void;
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
  resolveSurfaceMotionStyle,
  rotation,
  scale,
  scrollPageOffset,
  setDocumentSurfaceElement,
  setScrollInteractionElement,
  setPageSize,
  viewportHeight,
  visiblePageNumbers,
}: PdfDocumentPagesLayerProps) {
  const visiblePageNumberSet = React.useMemo(
    () => new Set(visiblePageNumbers),
    [visiblePageNumbers],
  );
  const { registerDocumentSurface } =
    useOptionalFileViewerRendererEnvironment();
  const [visualStageElement, setVisualStageElementState] =
    React.useState<HTMLElement | null>(null);
  const setVisualStageElement = React.useCallback(
    (element: HTMLElement | null) => {
      setVisualStageElementState((previousElement) =>
        previousElement === element ? previousElement : element,
      );
      setDocumentSurfaceElement(element);
    },
    [setDocumentSurfaceElement],
  );
  const documentSurfaceKey = visualStageElement
    ? joinEffectKey([
        registerDocumentSurface,
        resolveSurfaceMotionStyle,
        visualStageElement,
      ])
    : null;
  useKeyedLayoutEffect(documentSurfaceKey, () => {
    if (!visualStageElement) return;
    return registerDocumentSurface({
      element: visualStageElement,
      resolveMotionStyle: resolveSurfaceMotionStyle,
    });
  });
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
  const visualStageStyle = {
    minWidth: layout.maxPageWidth,
    width: layout.maxPageWidth,
  } satisfies React.CSSProperties;
  const motionWindowHeight = renderedWindow
    ? getPdfMotionWindowHeight(renderedWindow)
    : null;
  const motionStickyInset = renderedWindow
    ? getPdfMotionStickyInset(renderedWindow, viewportHeight)
    : null;
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
                bottom: motionStickyInset ?? renderedWindow.stickyInset,
                contain: "layout style inline-size",
                height: motionWindowHeight ?? renderedWindow.height,
                isolation: "isolate",
                top: motionStickyInset ?? renderedWindow.stickyInset,
              }}
            >
              <div
                data-slot="pdf-page-window"
                className="relative"
                style={{
                  contain: "layout style",
                  height: motionWindowHeight ?? renderedWindow.height,
                }}
              >
                {renderedWindow.pages.map((page, pageIndex) => (
                  <div
                    key={page.pageNumber}
                    className="absolute left-1/2 flex -translate-x-1/2 items-start justify-center"
                    data-layout-transitioning={
                      isLayoutTransitioning ? "" : undefined
                    }
                    data-slot="pdf-page-slot"
                    data-page-number={page.pageNumber}
                    data-visible={
                      visiblePageNumberSet.has(page.pageNumber) ? "" : undefined
                    }
                    style={{
                      top: getPdfMotionPageTop(page, pageIndex),
                      width: page.width,
                      height: getPdfMotionLength(page.height),
                    }}
                  >
                    <div
                      data-slot="pdf-page-motion-frame"
                      style={{
                        height: page.height,
                        transform: `scaleY(var(${PDF_DOCUMENT_MOTION_SCALE_PROPERTY}, 1))`,
                        transformOrigin: "center top",
                        width: page.width,
                        willChange: isLayoutTransitioning
                          ? "transform"
                          : undefined,
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

function getPdfMotionLength(length: number) {
  return `calc(${formatPdfMotionLengthBase(length)}px * var(${PDF_DOCUMENT_MOTION_SCALE_PROPERTY}, 1))`;
}

function getPdfMotionPageTop(page: PdfRenderedPageLayout, pageIndex: number) {
  const gapTotal = pageIndex * PDF_PAGE_GAP;
  const scaledTop = Math.max(0, page.windowTop - gapTotal);
  if (gapTotal === 0) return getPdfMotionLength(scaledTop);

  return `calc(${formatPdfMotionLengthBase(scaledTop)}px * var(${PDF_DOCUMENT_MOTION_SCALE_PROPERTY}, 1) + ${gapTotal}px)`;
}

function getPdfMotionWindowHeight(renderedWindow: {
  height: number;
  pages: readonly PdfRenderedPageLayout[];
}) {
  const gapTotal = Math.max(0, renderedWindow.pages.length - 1) * PDF_PAGE_GAP;
  const scaledHeight = Math.max(0, renderedWindow.height - gapTotal);
  if (gapTotal === 0) return getPdfMotionLength(scaledHeight);

  return `calc(${formatPdfMotionLengthBase(scaledHeight)}px * var(${PDF_DOCUMENT_MOTION_SCALE_PROPERTY}, 1) + ${gapTotal}px)`;
}

function getPdfMotionStickyInset(
  renderedWindow: {
    height: number;
    pages: readonly PdfRenderedPageLayout[];
  },
  viewportHeight: number,
) {
  const motionWindowHeight = getPdfMotionWindowHeight(renderedWindow);
  const safeViewportHeight =
    Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 0;

  return `min(0px, calc(${formatPdfMotionLengthBase(
    safeViewportHeight,
  )}px - (${motionWindowHeight})))`;
}

function formatPdfMotionLengthBase(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : 0;
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
