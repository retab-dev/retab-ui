"use client";

import * as React from "react";

import { joinEffectKey } from "@/lib/effect-key";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { useMountEffect } from "@/hooks/use-mount-effect";

import { getPdfPhysicalScrollHeight } from "./pdf-viewer-layout";
import type { PdfDocumentLayoutState } from "./pdf-viewer-document-layout";
import type { PdfDocument } from "./pdf-viewer-document-resource";
import {
  PDF_DOCUMENT_ANCHOR_BLOCK_PROPERTY,
  type PdfDocumentPagesLayerProps,
} from "./pdf-viewer-pages-layer";
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
  const writeDocumentAnchorBlockOffset = React.useCallback(() => {
    const documentSurfaceElement = documentSurfaceElementRef.current;
    if (!documentSurfaceElement) return;

    const metrics = getScrollMetrics();
    documentSurfaceElement.style.setProperty(
      PDF_DOCUMENT_ANCHOR_BLOCK_PROPERTY,
      `${getPdfReadingMarkerBlockOffset({
        scrollTop: metrics.scrollTop,
        viewportHeight: metrics.viewportHeight,
      })}px`,
    );
  }, [getScrollMetrics]);
  const measureBeforeLayoutMotion = React.useCallback(() => {
    measureScroll();
    writeDocumentAnchorBlockOffset();
  }, [measureScroll, writeDocumentAnchorBlockOffset]);
  const measureBeforeLayoutMotionRef = React.useRef(
    measureBeforeLayoutMotion,
  );
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
    transition: layout.transition,
    viewportElement,
  });
  const renderedPageCache = usePdfRenderedPageCache(document);
  const shouldUseRenderedPageCache =
    performanceOptions?.renderedPageCache !== false;
  const {
    activePageNumbers: activeRenderPageNumbers,
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
  const handlePageRenderTiming = React.useCallback(
    (timing: PdfPageRenderTiming) => {
      handleScheduledPageRenderTiming(timing);
      onPageRenderTiming?.(timing);
    },
    [handleScheduledPageRenderTiming, onPageRenderTiming],
  );
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

  const handleViewportScroll = React.useCallback(() => {
    suspendScrollInteractions();
    handleScroll();
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
      renderCache: shouldUseRenderedPageCache ? renderedPageCache : undefined,
      renderPageNumbers,
      renderPageOverlay,
      renderScale: layout.renderScale,
      rotation: layout.rotation,
      scale: layout.displayScale,
      scrollPageOffset,
      setDocumentSurfaceElement,
      setScrollInteractionElement,
      setPageSize: layout.setPageSize,
      visualScale: layout.visualScale,
      viewportHeight: viewportElement?.clientHeight ?? 0,
      visiblePageNumbers,
    },
    setViewportElement,
  };
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
