"use client";

import * as React from "react";

import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";
import { cn } from "@/lib/utils";

import type { FileViewerDocumentAlign } from "./file-viewer-renderer-contract";
import type {
  FileViewerDocumentSurfaceMotionResolver,
  FileViewerDocumentSurfaceSettleSnapshotReader,
} from "./file-viewer-motion-kernel";
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
  readSettleSnapshot: FileViewerDocumentSurfaceSettleSnapshotReader;
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
  readSettleSnapshot,
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
        readSettleSnapshot,
        resolveSurfaceMotionStyle,
        visualStageElement,
      ])
    : null;
  useKeyedLayoutEffect(documentSurfaceKey, () => {
    if (!visualStageElement) return;
    return registerDocumentSurface({
      element: visualStageElement,
      readSettleSnapshot,
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
  const scrollRangeStyle = {
    contain: "layout size style",
    height: physicalScrollHeight,
    minWidth: layout.maxPageWidth,
    width: layout.maxPageWidth,
  } satisfies React.CSSProperties;
  const visualClipStyle = {
    contain: "paint style",
    overflow: "clip",
  } satisfies React.CSSProperties;
  const visualStageStyle = {
    height: physicalScrollHeight,
    minWidth: layout.maxPageWidth,
    width: layout.maxPageWidth,
  } satisfies React.CSSProperties;

  const documentContent = (
    <div
      data-slot="pdf-viewer-scroll-range"
      className={cn("relative", getPdfDocumentFrameAlignClass(documentAlign))}
      style={scrollRangeStyle}
    >
      <div
        data-slot="pdf-viewer-visual-clip"
        data-layout-transitioning={isLayoutTransitioning ? "" : undefined}
        className="absolute inset-0"
        style={visualClipStyle}
      >
        <div
          ref={setVisualStageElement}
          data-slot="pdf-viewer-visual-stage"
          className="relative"
          style={visualStageStyle}
        >
          {renderedWindow ? (
            <div
              ref={setScrollInteractionElement}
              data-slot="pdf-page-window"
              className="absolute inset-0"
              style={{
                contain: "layout style",
                isolation: "isolate",
              }}
            >
              {/* Pages sit at their settled layout positions for the whole
                  motion (commit-then-relax); the kernel's single surface
                  transform on the visual stage is the only in-flight style. */}
              {renderedWindow.pages.map((page) => (
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
                    top: renderedWindow.beforeHeight + page.windowTop,
                    width: page.width,
                    height: page.height,
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
          ) : null}
        </div>
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
