import * as React from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";

import {
  getPdfPreloadPageNumbers,
  getPdfRenderPageNumbers,
  getPdfVisiblePageNumbers,
  PDF_RENDER_WINDOW_OVERSCAN_PX,
  type PdfPageLayoutModel,
} from "./pdf-viewer-layout";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";

type PdfPageWindow = {
  scrollPageOffset: number;
  visiblePageNumbers: readonly number[];
  renderPageNumbers: readonly number[];
  preloadPageNumbers: readonly number[];
};

export type PdfPageVirtualizationScrollMetrics = {
  scrollPageOffset: number;
  scrollTop: number;
  viewportHeight: number;
};

export function usePdfPageVirtualization({
  getScrollMetrics,
  isLayoutTransitioning = false,
  layout,
  resetKey,
  viewportElement,
}: {
  getScrollMetrics?: () => PdfPageVirtualizationScrollMetrics;
  isLayoutTransitioning?: boolean;
  layout: PdfPageLayoutModel;
  resetKey?: unknown;
  viewportElement: HTMLDivElement | null;
}) {
  const measureFrameRef = React.useRef(0);
  const hasMeasuredScrollRef = React.useRef(false);
  const lastMeasuredLayoutRef = React.useRef(layout);
  const lastMeasuredResetKeyRef = React.useRef<unknown>(resetKey);
  const lastMeasuredScrollTopRef = React.useRef(0);
  const getCurrentScrollMetrics =
    React.useCallback((): PdfPageVirtualizationScrollMetrics => {
      return Object.is(lastMeasuredResetKeyRef.current, resetKey) &&
        getScrollMetrics
        ? getScrollMetrics()
        : {
            scrollPageOffset: 0,
            scrollTop: Object.is(lastMeasuredResetKeyRef.current, resetKey)
              ? (viewportElement?.scrollTop ?? 0)
              : 0,
            viewportHeight: viewportElement?.clientHeight ?? 0,
          };
    }, [getScrollMetrics, resetKey, viewportElement]);
  const getPageWindow = React.useCallback(
    (
      metrics: PdfPageVirtualizationScrollMetrics,
      fitPerfectly = false,
    ): PdfPageWindow => {
      const renderPageNumbers = getPdfRenderPageNumbers({
        fitPerfectly,
        layout,
        scrollTop: metrics.scrollTop,
        viewportHeight: metrics.viewportHeight,
      });

      return {
        scrollPageOffset: metrics.scrollPageOffset,
        visiblePageNumbers: getPdfVisiblePageNumbers({
          layout,
          scrollTop: metrics.scrollTop,
          viewportHeight: metrics.viewportHeight,
        }),
        renderPageNumbers,
        preloadPageNumbers: getPdfPreloadPageNumbers({
          layout,
          renderPageNumbers,
        }),
      };
    },
    [layout],
  );
  const getCurrentVisiblePageNumbers = React.useCallback((): PdfPageWindow => {
    return getPageWindow(getCurrentScrollMetrics());
  }, [getCurrentScrollMetrics, getPageWindow]);
  const getResetPageWindow = React.useCallback(() => {
    const viewportHeight = viewportElement?.clientHeight ?? 0;
    const renderPageNumbers = getPdfRenderPageNumbers({
      layout,
      scrollTop: 0,
      viewportHeight,
    });

    return {
      scrollPageOffset: 0,
      visiblePageNumbers: getPdfVisiblePageNumbers({
        layout,
        scrollTop: 0,
        viewportHeight,
      }),
      renderPageNumbers,
      preloadPageNumbers: getPdfPreloadPageNumbers({
        layout,
        renderPageNumbers,
      }),
    };
  }, [layout, viewportElement]);
  const [state, setState] = React.useState<{
    layout: PdfPageLayoutModel;
    resetKey: unknown;
    pageWindow: PdfPageWindow;
  }>(() => ({
    layout,
    resetKey,
    pageWindow: getCurrentVisiblePageNumbers(),
  }));
  const pageWindow =
    Object.is(state.layout, layout) && Object.is(state.resetKey, resetKey)
      ? state.pageWindow
      : Object.is(state.resetKey, resetKey)
        ? createTransitionPageWindow({
            currentPageWindow: getCurrentVisiblePageNumbers(),
            isLayoutTransitioning,
            layout,
            previousPageWindow: state.pageWindow,
          })
        : getResetPageWindow();

  const measureVisiblePagesNow = React.useCallback(() => {
    measureFrameRef.current = 0;
    const metrics = getCurrentScrollMetrics();
    const fitPerfectly = shouldFitPdfPerfectly({
      canFitPerfectly:
        hasMeasuredScrollRef.current &&
        Object.is(lastMeasuredLayoutRef.current, layout) &&
        Object.is(lastMeasuredResetKeyRef.current, resetKey),
      previousScrollTop: lastMeasuredScrollTopRef.current,
      scrollTop: metrics.scrollTop,
      viewportHeight: metrics.viewportHeight,
    });
    const currentPageWindow = getPageWindow(metrics, fitPerfectly);
    lastMeasuredLayoutRef.current = layout;
    lastMeasuredResetKeyRef.current = resetKey;
    lastMeasuredScrollTopRef.current = metrics.scrollTop;
    hasMeasuredScrollRef.current = true;
    setState((previousState) => {
      const nextPageWindow = createTransitionPageWindow({
        currentPageWindow,
        isLayoutTransitioning,
        layout,
        previousPageWindow: previousState.pageWindow,
      });

      return Object.is(previousState.layout, layout) &&
        Object.is(previousState.resetKey, resetKey) &&
        arePageWindowsEqual(previousState.pageWindow, nextPageWindow)
        ? previousState
        : { layout, resetKey, pageWindow: nextPageWindow };
    });
    if (fitPerfectly && measureFrameRef.current === 0) {
      measureFrameRef.current = requestAnimationFrame(() =>
        measureVisiblePagesNowRef.current(),
      );
    }
  }, [
    getCurrentScrollMetrics,
    getPageWindow,
    isLayoutTransitioning,
    layout,
    resetKey,
  ]);
  const measureVisiblePagesNowRef = React.useRef(measureVisiblePagesNow);
  useKeyedLayoutEffect(joinEffectKey([measureVisiblePagesNow]), () => {
    measureVisiblePagesNowRef.current = measureVisiblePagesNow;
  });

  const measureVisiblePages = React.useCallback(() => {
    if (measureFrameRef.current) return;
    measureFrameRef.current = requestAnimationFrame(() =>
      measureVisiblePagesNowRef.current(),
    );
  }, []);

  useKeyedMountEffect(joinEffectKey([measureVisiblePagesNow]), () => {
    if (measureFrameRef.current) {
      cancelAnimationFrame(measureFrameRef.current);
      measureFrameRef.current = 0;
    }
    measureVisiblePagesNow();
  });

  useMountEffect(() => () => {
    if (measureFrameRef.current) {
      cancelAnimationFrame(measureFrameRef.current);
    }
  });

  return {
    scrollPageOffset: pageWindow.scrollPageOffset,
    visiblePageNumbers: pageWindow.visiblePageNumbers,
    renderPageNumbers: pageWindow.renderPageNumbers,
    preloadPageNumbers: pageWindow.preloadPageNumbers,
    measureVisiblePages,
  };
}

function createTransitionPageWindow({
  currentPageWindow,
  isLayoutTransitioning,
  layout,
  previousPageWindow,
}: {
  currentPageWindow: PdfPageWindow;
  isLayoutTransitioning: boolean;
  layout: PdfPageLayoutModel;
  previousPageWindow: PdfPageWindow;
}): PdfPageWindow {
  if (!isLayoutTransitioning) return currentPageWindow;

  return {
    scrollPageOffset: currentPageWindow.scrollPageOffset,
    visiblePageNumbers: mergePageNumbers(
      layout,
      previousPageWindow.visiblePageNumbers,
      currentPageWindow.visiblePageNumbers,
    ),
    renderPageNumbers: mergePageNumbers(
      layout,
      previousPageWindow.renderPageNumbers,
      currentPageWindow.renderPageNumbers,
    ),
    preloadPageNumbers: mergePageNumbers(
      layout,
      previousPageWindow.preloadPageNumbers,
      currentPageWindow.preloadPageNumbers,
    ),
  };
}

function mergePageNumbers(
  layout: PdfPageLayoutModel,
  previousPageNumbers: readonly number[],
  currentPageNumbers: readonly number[],
) {
  return Array.from(new Set([...previousPageNumbers, ...currentPageNumbers]))
    .filter((pageNumber) => pageNumber >= 1 && pageNumber <= layout.pageCount)
    .sort((a, b) => a - b);
}

function arePageWindowsEqual(
  previousPageWindow: PdfPageWindow,
  nextPageWindow: PdfPageWindow,
) {
  return (
    previousPageWindow.scrollPageOffset === nextPageWindow.scrollPageOffset &&
    arePageNumbersEqual(
      previousPageWindow.visiblePageNumbers,
      nextPageWindow.visiblePageNumbers,
    ) &&
    arePageNumbersEqual(
      previousPageWindow.renderPageNumbers,
      nextPageWindow.renderPageNumbers,
    ) &&
    arePageNumbersEqual(
      previousPageWindow.preloadPageNumbers,
      nextPageWindow.preloadPageNumbers,
    )
  );
}

function arePageNumbersEqual(
  previousPageNumbers: readonly number[],
  nextPageNumbers: readonly number[],
) {
  if (previousPageNumbers.length !== nextPageNumbers.length) return false;
  return previousPageNumbers.every(
    (pageNumber, index) => pageNumber === nextPageNumbers[index],
  );
}

function shouldFitPdfPerfectly({
  canFitPerfectly,
  previousScrollTop,
  scrollTop,
  viewportHeight,
}: {
  canFitPerfectly: boolean;
  previousScrollTop: number;
  scrollTop: number;
  viewportHeight: number;
}) {
  return (
    canFitPerfectly &&
    viewportHeight > 0 &&
    Math.abs(scrollTop - previousScrollTop) >
      viewportHeight + PDF_RENDER_WINDOW_OVERSCAN_PX * 2
  );
}
