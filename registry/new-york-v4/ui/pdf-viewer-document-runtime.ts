"use client";

import * as React from "react";

import { joinEffectKey } from "@/lib/effect-key";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { useMountEffect } from "@/hooks/use-mount-effect";

import {
  findPdfPageByOffset,
  getPdfPageLayout,
  getPdfPhysicalScrollHeight,
} from "./pdf-viewer-layout";
import type { PdfDocumentLayoutState } from "./pdf-viewer-document-layout";
import type { PdfDocument } from "./pdf-viewer-document-resource";
import type { PdfDocumentPagesLayerProps } from "./pdf-viewer-pages-layer";
import { FILE_VIEWER_FIT_WIDTH_ANCHOR_BLOCK_PROPERTY } from "./file-viewer-fit-width-motion";
import { FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT } from "./file-viewer-elements";
import { usePdfRenderedPageCache } from "./pdf-viewer-render-cache";
import {
  PDF_SCROLLING_PAGE_RENDER_CONCURRENCY,
  usePdfPageRenderScheduler,
} from "./pdf-viewer-render-scheduler";
import { PDF_READING_MARKER_RATIO, usePdfScroll } from "./pdf-viewer-scroll";
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
  // The transform's anchor line, in the visual stage's own (physical scroll)
  // coordinates. Layout and scroll are already settled when a shell motion
  // slides. The idle write is the live reading-marker offset; the slide-start
  // write derives the EXACT fixed point of the rebase that just ran (see
  // below), so the transform's first frame reproduces the pre-toggle screen
  // even where the rebase clamped (document top/bottom).
  const preMotionAnchorRef = React.useRef<{
    pageNumber: number;
    screenRelTop: number;
  } | null>(null);
  const writeAnchorBlockOffsetPx = React.useCallback((anchorBlock: number) => {
    const documentSurfaceElement = documentSurfaceElementRef.current;
    if (!documentSurfaceElement) return;
    documentSurfaceElement.style.setProperty(
      FILE_VIEWER_FIT_WIDTH_ANCHOR_BLOCK_PROPERTY,
      `${Number.isFinite(anchorBlock) ? anchorBlock : 0}px`,
    );
  }, []);
  const writeDocumentAnchorBlockOffset = React.useCallback(() => {
    const metrics = getScrollMetrics();
    writeAnchorBlockOffsetPx(
      Math.max(0, metrics.physicalScrollTop) +
        Math.max(0, metrics.viewportHeight) * PDF_READING_MARKER_RATIO,
    );
  }, [getScrollMetrics, writeAnchorBlockOffsetPx]);
  // The transform must pin the exact screen line the slide-start commit
  // preserved, or the first sliding frame drifts off the pre-toggle screen.
  // Rather than assuming anything about the rebase or the layout models,
  // measure the fixed point: capture the marker page's screen-relative top
  // against the OLD layout model before the commit, then solve for the stage
  // anchor A that puts the same page top back on that screen line under the
  // NEW layout model and the first frame's scale s₀:
  //   s₀·O_new + (1 − s₀)·A − physicalScrollTop = screenRelTop_old
  // where O_new is the page's stage offset in the committed layout. This is
  // exact in both direct and rebased (paged) scroll spaces, at clamps, and
  // regardless of how measured/estimated page sizes shifted the models.
  const writeMotionAnchorBlockOffset = React.useCallback(() => {
    const metrics = getScrollMetrics();
    const fromInlineSize = layout.rendererFrame.fromInlineSize;
    const toInlineSize = layout.rendererFrame.toInlineSize;
    const preMotionAnchor = preMotionAnchorRef.current;
    const startScale =
      fromInlineSize != null && toInlineSize != null && toInlineSize > 0
        ? fromInlineSize / toInlineSize
        : 1;
    const newPageLayout = preMotionAnchor
      ? getPdfPageLayout(layout.pageLayout, preMotionAnchor.pageNumber)
      : null;

    if (
      !preMotionAnchor ||
      !newPageLayout ||
      Math.abs(1 - startScale) <= 0.001
    ) {
      writeDocumentAnchorBlockOffset();
      return;
    }

    const logicalDelta = metrics.scrollTop - metrics.physicalScrollTop;
    const stageOffset = newPageLayout.offsetTop - logicalDelta;
    writeAnchorBlockOffsetPx(
      (preMotionAnchor.screenRelTop +
        metrics.physicalScrollTop -
        startScale * stageOffset) /
        (1 - startScale),
    );
  }, [
    getScrollMetrics,
    layout.pageLayout,
    layout.rendererFrame.fromInlineSize,
    layout.rendererFrame.toInlineSize,
    writeAnchorBlockOffsetPx,
    writeDocumentAnchorBlockOffset,
  ]);
  const measureBeforeLayoutMotion = React.useCallback(() => {
    const metrics = getScrollMetrics();
    const markerOffset =
      metrics.scrollTop +
      Math.max(0, metrics.viewportHeight) * PDF_READING_MARKER_RATIO;
    const pageNumber = findPdfPageByOffset(layout.pageLayout, markerOffset);
    const pageLayout = getPdfPageLayout(layout.pageLayout, pageNumber);
    preMotionAnchorRef.current = pageLayout
      ? {
          pageNumber,
          screenRelTop: pageLayout.offsetTop - metrics.scrollTop,
        }
      : null;
    measureScroll();
  }, [getScrollMetrics, layout.pageLayout, measureScroll]);
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

  // displayScale now changes at slide START (commit-then-relax), so this
  // idle re-measure must not clobber the motion's fixed-point anchor; the
  // transitioning effect below owns the anchor for the whole motion.
  useKeyedMountEffect(
    joinEffectKey([
      document.numPages,
      layout.displayScale,
      layout.rendererFrame.isTransitioning,
      layout.rotation,
      measureScroll,
      writeDocumentAnchorBlockOffset,
      viewportElement,
    ]),
    () => {
      measureScroll();
      if (layout.rendererFrame.isTransitioning) return;
      writeDocumentAnchorBlockOffset();
    },
  );

  // The before-layout-motion event fires before the layout jump and captures
  // the pre-toggle scroll; this effect runs inside the slide-start commit
  // AFTER the scroll rebase (hook order puts the scroll layout effect first),
  // so it can pin the transform to the rebase's exact fixed point before the
  // first frame paints.
  useKeyedLayoutEffect(
    joinEffectKey([
      layout.rendererFrame.isTransitioning,
      writeMotionAnchorBlockOffset,
    ]),
    () => {
      if (!layout.rendererFrame.isTransitioning) return;
      writeMotionAnchorBlockOffset();
    },
  );

  const handleViewportScroll = React.useCallback(() => {
    suspendScrollInteractions();
    const result = handleScroll();
    if (result?.source === "internal") return;
    // While the shell motion is in flight the anchor is the motion's fixed
    // point; a user scroll mid-slide must not retarget it to the marker.
    if (!layout.rendererFrame.isTransitioning) {
      writeDocumentAnchorBlockOffset();
    }
    measureVisiblePages();
  }, [
    handleScroll,
    layout.rendererFrame.isTransitioning,
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
