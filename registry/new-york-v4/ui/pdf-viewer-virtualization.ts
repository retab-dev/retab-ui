import * as React from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";

import {
  getPdfPreloadPageNumbers,
  getPdfRenderPageNumbers,
  getPdfVisiblePageNumbers,
  type PdfPageLayoutModel,
} from "./pdf-viewer-layout";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";

type PdfPageWindow = {
  visiblePageNumbers: readonly number[];
  renderPageNumbers: readonly number[];
  preloadPageNumbers: readonly number[];
};

export function usePdfPageVirtualization({
  layout,
  resetKey,
  viewportElement,
}: {
  layout: PdfPageLayoutModel;
  resetKey?: unknown;
  viewportElement: HTMLDivElement | null;
}) {
  const measureFrameRef = React.useRef(0);
  const lastMeasuredResetKeyRef = React.useRef<unknown>(resetKey);
  const getCurrentVisiblePageNumbers = React.useCallback((): PdfPageWindow => {
    const scrollTop = Object.is(lastMeasuredResetKeyRef.current, resetKey)
      ? (viewportElement?.scrollTop ?? 0)
      : 0;
    const viewportHeight = viewportElement?.clientHeight ?? 0;
    const renderPageNumbers = getPdfRenderPageNumbers({
      layout,
      scrollTop,
      viewportHeight,
    });

    return {
      visiblePageNumbers: getPdfVisiblePageNumbers({
        layout,
        scrollTop,
        viewportHeight,
      }),
      renderPageNumbers,
      preloadPageNumbers: getPdfPreloadPageNumbers({
        layout,
        renderPageNumbers,
      }),
    };
  }, [layout, resetKey, viewportElement]);
  const getResetPageWindow = React.useCallback(() => {
    const renderPageNumbers = getPdfRenderPageNumbers({
      layout,
      scrollTop: 0,
      viewportHeight: viewportElement?.clientHeight ?? 0,
    });

    return {
      visiblePageNumbers: getPdfVisiblePageNumbers({
        layout,
        scrollTop: 0,
        viewportHeight: viewportElement?.clientHeight ?? 0,
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
        ? getCurrentVisiblePageNumbers()
        : getResetPageWindow();

  const measureVisiblePagesNow = React.useCallback(() => {
    measureFrameRef.current = 0;
    const nextPageWindow = getCurrentVisiblePageNumbers();
    lastMeasuredResetKeyRef.current = resetKey;
    setState((previousState) =>
      Object.is(previousState.layout, layout) &&
      Object.is(previousState.resetKey, resetKey) &&
      arePageWindowsEqual(previousState.pageWindow, nextPageWindow)
        ? previousState
        : { layout, resetKey, pageWindow: nextPageWindow },
    );
  }, [getCurrentVisiblePageNumbers, layout, resetKey]);
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
    visiblePageNumbers: pageWindow.visiblePageNumbers,
    renderPageNumbers: pageWindow.renderPageNumbers,
    preloadPageNumbers: pageWindow.preloadPageNumbers,
    measureVisiblePages,
  };
}

function arePageWindowsEqual(
  previousPageWindow: PdfPageWindow,
  nextPageWindow: PdfPageWindow,
) {
  return (
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
