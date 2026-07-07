"use client";

import * as React from "react";

import { joinEffectKey } from "@/lib/effect-key";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { useMountEffect } from "@/hooks/use-mount-effect";

import {
  getPdfPageLayout,
  getPdfPhysicalScrollHeight,
} from "./pdf-viewer-layout";
import type { PdfDocumentLayoutState } from "./pdf-viewer-document-layout";
import type { PdfDocument } from "./pdf-viewer-document-resource";
import type { PdfDocumentPagesLayerProps } from "./pdf-viewer-pages-layer";
import { PDF_DOCUMENT_ANCHOR_WINDOW_BLOCK_PROPERTY } from "./pdf-viewer-motion-contract";
import { FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT } from "./file-viewer-elements";
import { usePdfRenderedPageCache } from "./pdf-viewer-render-cache";
import {
  PDF_SCROLLING_PAGE_RENDER_CONCURRENCY,
  usePdfPageRenderScheduler,
} from "./pdf-viewer-render-scheduler";
import {
  getPdfReadingMarkerBlockOffset,
  usePdfScroll,
} from "./pdf-viewer-scroll";
import type {
  PageOverlayProps,
  PdfPageRenderTiming,
  PdfViewerHandle,
  PdfViewerPerformanceOptions,
} from "./pdf-viewer-types";
import { usePdfViewerTelemetry } from "./pdf-viewer-telemetry";
import { usePdfPageVirtualization } from "./pdf-viewer-virtualization";

export type PdfDocumentRuntimeState = {
  currentPage: number;
  handle: PdfViewerHandle;
  handleViewportScroll: () => void;
  pagesLayerProps: PdfDocumentPagesLayerProps;
  setViewportElement: (element: HTMLDivElement | null) => void;
};

export function usePdfDocumentRuntime({
  document,
  documentKey,
  layout,
  onPageRenderTiming,
  onScrollProgressChange,
  onVisiblePageChange,
  performanceOptions,
  renderPageOverlay,
}: {
  document: PdfDocument;
  documentKey: string;
  layout: PdfDocumentLayoutState;
  onPageRenderTiming?: (timing: PdfPageRenderTiming) => void;
  onScrollProgressChange?: (progress: number) => void;
  onVisiblePageChange?: (page: number) => void;
  performanceOptions?: PdfViewerPerformanceOptions;
  renderPageOverlay?: (props: PageOverlayProps) => React.ReactNode;
}): PdfDocumentRuntimeState {
  const {
    currentPage,
    viewportElement,
    setViewportElement,
    measureScroll,
    handleScroll,
    scrollToPage,
    scrollToPageArea,
    getViewportElement,
    getScrollMetrics,
  } = usePdfScroll({
    isLayoutTransitioning: layout.rendererFrame.isTransitioning,
    pageCount: document.numPages,
    layout: layout.pageLayout,
    transition: layout.transition,
    resetKey: document,
    onVisiblePageChange,
    onScrollProgressChange,
  });
  const documentSurfaceElementRef = React.useRef<HTMLElement | null>(null);
  const anchorGeometryRef = React.useRef({
    isSliding: false,
    settleScale: null as number | null,
    totalBlockSize: 0,
    // Logical offset of the render window's first page; page-slot projection
    // grows from this origin during shell motion.
    renderWindowTop: 0,
  });
  anchorGeometryRef.current = {
    ...anchorGeometryRef.current,
    isSliding: layout.rendererFrame.isTransitioning,
    settleScale:
      layout.rendererFrame.fromInlineSize != null &&
      layout.rendererFrame.toInlineSize != null &&
      layout.rendererFrame.fromInlineSize > 0
        ? layout.rendererFrame.toInlineSize /
          layout.rendererFrame.fromInlineSize
        : null,
    totalBlockSize: layout.pageLayout.totalHeight,
  };
  const writeDocumentAnchorBlockOffset = React.useCallback(() => {
    const documentSurfaceElement = documentSurfaceElementRef.current;
    if (!documentSurfaceElement) return;

    const metrics = getScrollMetrics();
    const anchorGeometry = anchorGeometryRef.current;
    const anchorBlock = getPdfReadingMarkerBlockOffset({
      scrollTop: metrics.scrollTop,
      settleScale: anchorGeometry.isSliding ? anchorGeometry.settleScale : null,
      totalBlockSize: anchorGeometry.totalBlockSize,
      viewportHeight: metrics.viewportHeight,
    });
    const windowReadingOffset = Math.max(
      0,
      anchorBlock - anchorGeometry.renderWindowTop,
    );
    documentSurfaceElement.style.setProperty(
      PDF_DOCUMENT_ANCHOR_WINDOW_BLOCK_PROPERTY,
      `${windowReadingOffset}px`,
    );
  }, [getScrollMetrics]);
  const measureBeforeLayoutMotion = React.useCallback(() => {
    measureScroll();
    writeDocumentAnchorBlockOffset();
  }, [measureScroll, writeDocumentAnchorBlockOffset]);
  const measureBeforeLayoutMotionRef = React.useRef(measureBeforeLayoutMotion);
  measureBeforeLayoutMotionRef.current = measureBeforeLayoutMotion;
  const handleBeforeLayoutMotion = React.useCallback(() => {
    measureBeforeLayoutMotionRef.current();
  }, []);
  const setDocumentSurfaceElement = React.useCallback(
    (element: HTMLElement | null) => {
      const previousElement = documentSurfaceElementRef.current;
      if (previousElement === element) return;
      previousElement?.removeEventListener(
        FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT,
        handleBeforeLayoutMotion,
      );
      documentSurfaceElementRef.current = element;
      if (!element) return;
      element.addEventListener(
        FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT,
        handleBeforeLayoutMotion,
      );
      writeDocumentAnchorBlockOffset();
    },
    [handleBeforeLayoutMotion, writeDocumentAnchorBlockOffset],
  );
  const [shouldHoldPageWindowForRaster, setShouldHoldPageWindowForRaster] =
    React.useState(false);
  const {
    scrollPageOffset,
    visiblePageNumbers,
    renderPageNumbers,
    warmPageNumbers,
    preloadPageNumbers,
    measureVisiblePages,
  } = usePdfPageVirtualization({
    getScrollMetrics,
    isLayoutTransitioning: layout.rendererFrame.isTransitioning,
    layout: layout.pageLayout,
    resetKey: document,
    shouldHoldPageWindow: shouldHoldPageWindowForRaster,
    transition: layout.transition,
    viewportElement,
  });
  // Page slots scale from the top of the contiguous rendered block around the
  // reading position. Anchor compensation to that block's first page, ignoring
  // far-away preload pages that also live in renderPageNumbers.
  anchorGeometryRef.current.renderWindowTop = getPdfContiguousRenderWindowTop({
    layout: layout.pageLayout,
    renderPageNumbers,
    visiblePageNumbers,
  });
  const renderedPageCache = usePdfRenderedPageCache(document);
  const shouldUseRenderedPageCache =
    performanceOptions?.renderedPageCache !== false;
  const {
    activePageNumbers: activeRenderPageNumbers,
    isRenderQueueIdle,
    onPageRenderTiming: handleScheduledPageRenderTiming,
  } = usePdfPageRenderScheduler({
    pageNumbers: visiblePageNumbers,
    warmPageNumbers:
      performanceOptions?.directionAwarePreRender === false
        ? []
        : warmPageNumbers,
    lowPriorityPageNumbers:
      performanceOptions?.directionAwarePreRender === false
        ? []
        : preloadPageNumbers,
    scale: layout.renderScale,
    rotation: layout.rotation,
    devicePixelRatio: layout.pageDevicePixelRatio,
    resetKey: document,
    maxRunning: PDF_SCROLLING_PAGE_RENDER_CONCURRENCY,
    maxLowPriorityRunning:
      performanceOptions?.directionAwarePreRender === false ? 0 : 1,
  });
  useKeyedMountEffect(
    joinEffectKey([
      isRenderQueueIdle,
      layout.rendererFrame.phase,
      layout.transition.source,
    ]),
    () => {
      const isShellMotionActive =
        layout.rendererFrame.phase !== "idle" ||
        layout.transition.source === "viewer-shell";
      const nextShouldHold =
        isShellMotionActive ||
        (shouldHoldPageWindowForRaster && !isRenderQueueIdle);
      setShouldHoldPageWindowForRaster((previous) =>
        previous === nextShouldHold ? previous : nextShouldHold,
      );
    },
  );
  const handlePageRenderTiming = React.useCallback(
    (timing: PdfPageRenderTiming) => {
      handleScheduledPageRenderTiming(timing);
      onPageRenderTiming?.(timing);
    },
    [handleScheduledPageRenderTiming, onPageRenderTiming],
  );
  const readSettleSnapshot = React.useCallback(() => {
    const metrics = getScrollMetrics();
    const viewportElement = getViewportElement();

    return [
      metrics.scrollTop,
      metrics.physicalScrollTop,
      metrics.scrollPageOffset,
      metrics.viewportHeight,
      viewportElement?.scrollHeight ?? 0,
      viewportElement?.clientHeight ?? 0,
      layout.pageLayout.totalHeight,
      layout.pageLayout.maxPageWidth,
    ];
  }, [
    getScrollMetrics,
    getViewportElement,
    layout.pageLayout.maxPageWidth,
    layout.pageLayout.totalHeight,
  ]);
  usePdfViewerTelemetry({
    activeRenderPageNumbers,
    displayScale: layout.displayScale,
    documentKey,
    getDocumentSurfaceElement: () => documentSurfaceElementRef.current,
    getScrollMetrics,
    getViewportElement,
    layout: layout.pageLayout,
    pageDevicePixelRatio: layout.pageDevicePixelRatio,
    renderPageNumbers,
    renderScale: layout.renderScale,
    rendererFrame: layout.rendererFrame,
    visiblePageNumbers,
  });
  const scrollInteractionElementRef = React.useRef<HTMLDivElement | null>(null);
  const setScrollInteractionElement = React.useCallback(
    (element: HTMLDivElement | null) => {
      scrollInteractionElementRef.current = element;
    },
    [],
  );
  const suspendScrollInteractions = usePdfScrollInteractionSuspension(
    scrollInteractionElementRef,
  );

  useMountEffect(() => () => {
    documentSurfaceElementRef.current?.removeEventListener(
      FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT,
      handleBeforeLayoutMotion,
    );
    documentSurfaceElementRef.current = null;
  });

  useKeyedMountEffect(
    joinEffectKey([
      document.numPages,
      layout.displayScale,
      layout.rotation,
      measureScroll,
      writeDocumentAnchorBlockOffset,
      viewportElement,
    ]),
    () => {
      measureScroll();
      writeDocumentAnchorBlockOffset();
    },
  );

  // The before-layout-motion event fires before the motion target is known,
  // so the slide-start commit rewrites the block anchor with the
  // rebase-aware value; layout effects run before the first scaled tick.
  useKeyedLayoutEffect(
    joinEffectKey([
      layout.rendererFrame.isTransitioning,
      writeDocumentAnchorBlockOffset,
    ]),
    () => {
      if (!layout.rendererFrame.isTransitioning) return;
      writeDocumentAnchorBlockOffset();
    },
  );

  const handleViewportScroll = React.useCallback(() => {
    suspendScrollInteractions();
    const result = handleScroll();
    if (result?.source === "internal") return;
    writeDocumentAnchorBlockOffset();
    measureVisiblePages();
  }, [
    handleScroll,
    measureVisiblePages,
    suspendScrollInteractions,
    writeDocumentAnchorBlockOffset,
  ]);

  const handle = React.useMemo<PdfViewerHandle>(
    () => ({
      scrollToPage,
      scrollToPageArea,
      getViewportElement,
    }),
    [getViewportElement, scrollToPage, scrollToPageArea],
  );

  return {
    currentPage,
    handle,
    handleViewportScroll,
    pagesLayerProps: {
      activeRenderPageNumbers,
      containerRef: layout.containerRef,
      devicePixelRatio: layout.pageDevicePixelRatio,
      document,
      documentAlign: layout.rendererFrame.align,
      documentKey,
      isLayoutTransitioning: layout.rendererFrame.isTransitioning,
      layout: layout.pageLayout,
      onPageRenderTiming: handlePageRenderTiming,
      physicalScrollHeight: getPdfPhysicalScrollHeight({
        totalHeight: layout.pageLayout.totalHeight,
        viewportHeight: viewportElement?.clientHeight ?? 0,
      }),
      readSettleSnapshot,
      renderCache: shouldUseRenderedPageCache ? renderedPageCache : undefined,
      renderPageNumbers,
      renderPageOverlay,
      renderScale: layout.renderScale,
      resolveSurfaceMotionStyle: layout.resolveSurfaceMotionStyle,
      rotation: layout.rotation,
      scale: layout.displayScale,
      scrollPageOffset,
      setDocumentSurfaceElement,
      setScrollInteractionElement,
      setPageSize: layout.setPageSize,
      viewportHeight: viewportElement?.clientHeight ?? 0,
      visiblePageNumbers,
    },
    setViewportElement,
  };
}

function getPdfContiguousRenderWindowTop({
  layout,
  renderPageNumbers,
  visiblePageNumbers,
}: {
  layout: PdfDocumentLayoutState["pageLayout"];
  renderPageNumbers: readonly number[];
  visiblePageNumbers: readonly number[];
}): number {
  if (renderPageNumbers.length === 0) return 0;
  const rendered = new Set(renderPageNumbers);
  const anchor =
    visiblePageNumbers.find((pageNumber) => rendered.has(pageNumber)) ??
    Math.min(...renderPageNumbers);
  let firstPage = anchor;
  while (rendered.has(firstPage - 1)) firstPage -= 1;
  return getPdfPageLayout(layout, firstPage)?.offsetTop ?? 0;
}

function usePdfScrollInteractionSuspension(
  scrollInteractionElementRef: React.RefObject<HTMLElement | null>,
) {
  const restoreTimeoutRef = React.useRef<number | null>(null);
  const scrollElementRef = React.useRef<HTMLElement | null>(null);

  const suspendScrollInteractions = React.useCallback(() => {
    const scrollElement = scrollInteractionElementRef.current;
    if (!scrollElement) return;

    if (restoreTimeoutRef.current !== null) {
      window.clearTimeout(restoreTimeoutRef.current);
    }
    scrollElementRef.current = scrollElement;
    scrollElement.style.pointerEvents = "none";
    if (isMobileSafari()) {
      scrollElement.style.overflowX = "hidden";
    }
    restoreTimeoutRef.current = window.setTimeout(() => {
      restoreTimeoutRef.current = null;
      restorePdfScrollInteractions(scrollElementRef.current);
      scrollElementRef.current = null;
    }, 120);
  }, [scrollInteractionElementRef]);

  useMountEffect(() => () => {
    if (restoreTimeoutRef.current !== null) {
      window.clearTimeout(restoreTimeoutRef.current);
      restoreTimeoutRef.current = null;
    }
    restorePdfScrollInteractions(scrollElementRef.current);
    scrollElementRef.current = null;
  });

  return suspendScrollInteractions;
}

function restorePdfScrollInteractions(element: HTMLElement | null) {
  if (!element) return;
  element.style.removeProperty("pointer-events");
  element.style.removeProperty("overflow-x");
}

function isMobileSafari() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent;
  return (
    /Safari/i.test(userAgent) &&
    /Mobile/i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS/i.test(userAgent)
  );
}
