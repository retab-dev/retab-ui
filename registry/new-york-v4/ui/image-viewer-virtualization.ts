"use client";

import * as React from "react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { type FrameDescriptor } from "@/lib/image-frame-source";
import {
  frameCssSize,
  frameIndexToNumber,
  type QuarterTurn,
} from "@/lib/image-geometry";

import { joinEffectKey } from "@/lib/effect-key";

export const IMAGE_FRAME_GAP = 16;
export const IMAGE_FRAME_PADDING = 16;
export const IMAGE_RENDER_FIT_PERFECTLY_OVERSCAN_PX =
  IMAGE_FRAME_GAP + IMAGE_FRAME_PADDING;
export const IMAGE_RENDER_WINDOW_OVERSCAN_PX = 1000;
export const IMAGE_VISIBLE_FRAME_OVERSCAN = 2;
export const IMAGE_PRELOAD_FRAME_OVERSCAN = 4;
export const IMAGE_SCROLL_REBASE_CONTAINER_PX = 12_000_000;
export const IMAGE_SCROLL_REBASE_TRIGGER_PX = 1_000_000;
export const IMAGE_SCROLL_REBASE_TARGET_PX = 2_000_000;
export const IMAGE_SCROLL_REBASE_TARGET_BOTTOM_PX =
  IMAGE_SCROLL_REBASE_CONTAINER_PX - IMAGE_SCROLL_REBASE_TARGET_PX;
export const IMAGE_SCROLL_REBASE_THRESHOLD_PX =
  IMAGE_SCROLL_REBASE_CONTAINER_PX - IMAGE_SCROLL_REBASE_TRIGGER_PX;

export type ImageFrameLayout = {
  frameIndex: number;
  frameNumber: number;
  width: number;
  height: number;
  offsetTop: number;
};

export type ImageFrameLayoutModel = {
  frameCount: number;
  gap: number;
  padding: number;
  totalHeight: number;
  maxFrameWidth: number;
  frames: readonly ImageFrameLayout[];
};

export type ImageRenderedFrameLayout = ImageFrameLayout & {
  windowTop: number;
};

export type ImageRenderedFrameWindow = {
  afterHeight: number;
  beforeHeight: number;
  frames: readonly ImageRenderedFrameLayout[];
  height: number;
  stickyInset: number;
};

export type ImageRenderPixelWindow = {
  bottom: number;
  top: number;
};

export type ImageScrollRebasePosition = {
  physicalScrollTop: number;
  scrollPageOffset: number;
};

export type ImageFrameVirtualizationScrollMetrics = {
  scrollPageOffset: number;
  scrollTop: number;
  viewportHeight: number;
};

type ImageFrameWindow = {
  scrollPageOffset: number;
  visibleFrameNumbers: readonly number[];
  renderFrameNumbers: readonly number[];
  preloadFrameNumbers: readonly number[];
};

export function createImageFrameLayout({
  frames,
  scale,
  rotation,
  gap = IMAGE_FRAME_GAP,
  padding = IMAGE_FRAME_PADDING,
}: {
  frames: readonly FrameDescriptor[];
  scale: number;
  rotation: QuarterTurn;
  gap?: number;
  padding?: number;
}): ImageFrameLayoutModel {
  let offsetTop = padding;
  let maxFrameWidth = 0;
  const frameLayouts = frames.map((frame, frameIndex) => {
    const frameRect = frameCssSize(frame.intrinsicSize, scale, rotation);
    const layout = {
      frameIndex,
      frameNumber: frameIndexToNumber(frameIndex),
      width: frameRect.width,
      height: frameRect.height,
      offsetTop,
    };
    offsetTop += frameRect.height + gap;
    maxFrameWidth = Math.max(maxFrameWidth, frameRect.width);
    return layout;
  });

  return {
    frameCount: frames.length,
    gap,
    padding,
    totalHeight: frames.length === 0 ? 0 : offsetTop - gap + padding,
    maxFrameWidth,
    frames: frameLayouts,
  };
}

export function getImageFrameLayout(
  layout: ImageFrameLayoutModel,
  frameNumber: number,
): ImageFrameLayout | undefined {
  if (!Number.isInteger(frameNumber)) return undefined;
  return layout.frames[frameNumber - 1];
}

export function findImageFrameByOffset(
  layout: ImageFrameLayoutModel,
  offset: number,
): number {
  if (layout.frameCount === 0) return 1;

  let low = 0;
  let high = layout.frames.length - 1;
  let match = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (layout.frames[mid].offsetTop <= offset) {
      match = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return layout.frames[match].frameNumber;
}

export function getVisibleImageFrameNumbers({
  layout,
  scrollTop,
  viewportHeight,
  overscanFrames = IMAGE_VISIBLE_FRAME_OVERSCAN,
}: {
  layout: ImageFrameLayoutModel;
  scrollTop: number;
  viewportHeight: number;
  overscanFrames?: number;
}): readonly number[] {
  if (layout.frameCount === 0) return [];

  const measurementHeight = Math.max(1, viewportHeight);
  return getImageFrameNumbersInRange({
    layout,
    startOffset: Math.max(0, scrollTop - measurementHeight),
    endOffset: scrollTop + measurementHeight * 2,
    overscanFrames,
  });
}

export function getImageRenderFrameNumbers({
  fitPerfectly = false,
  fitPerfectlyOverscanPx = IMAGE_RENDER_FIT_PERFECTLY_OVERSCAN_PX,
  layout,
  overscanPx = IMAGE_RENDER_WINDOW_OVERSCAN_PX,
  scrollTop,
  viewportHeight,
}: {
  fitPerfectly?: boolean;
  fitPerfectlyOverscanPx?: number;
  layout: ImageFrameLayoutModel;
  overscanPx?: number;
  scrollTop: number;
  viewportHeight: number;
}): readonly number[] {
  if (layout.frameCount === 0) return [];

  const window = createImageWindowFromScrollPosition({
    fitPerfectly,
    fitPerfectlyOverscanPx,
    overscanPx,
    scrollHeight: layout.totalHeight,
    scrollTop,
    viewportHeight,
  });

  return getImageFrameNumbersInRange({
    layout,
    startOffset: window.top,
    endOffset: window.bottom,
    overscanFrames: 0,
  });
}

export function getImagePreloadFrameNumbers({
  layout,
  renderFrameNumbers,
  overscanFrames = IMAGE_PRELOAD_FRAME_OVERSCAN,
}: {
  layout: ImageFrameLayoutModel;
  renderFrameNumbers: readonly number[];
  overscanFrames?: number;
}): readonly number[] {
  if (layout.frameCount === 0 || renderFrameNumbers.length === 0) return [];

  const firstRenderFrame = renderFrameNumbers[0];
  const lastRenderFrame = renderFrameNumbers[renderFrameNumbers.length - 1];
  return createFrameNumberRange(
    Math.max(1, firstRenderFrame - overscanFrames),
    Math.min(layout.frameCount, lastRenderFrame + overscanFrames),
  );
}

export function getImageRenderedFrameWindow({
  frameNumbers,
  layout,
  physicalScrollHeight = layout.totalHeight,
  scrollPageOffset = 0,
  viewportHeight,
}: {
  frameNumbers: readonly number[];
  layout: ImageFrameLayoutModel;
  physicalScrollHeight?: number;
  scrollPageOffset?: number;
  viewportHeight: number;
}): ImageRenderedFrameWindow | null {
  const frames = frameNumbers
    .map((frameNumber) => getImageFrameLayout(layout, frameNumber))
    .filter((frame): frame is ImageFrameLayout => Boolean(frame))
    .sort((left, right) => left.frameNumber - right.frameNumber);

  if (frames.length === 0) return null;

  const logicalBeforeHeight = frames[0].offsetTop;
  const windowBottom = Math.max(
    ...frames.map((frame) => frame.offsetTop + frame.height),
  );
  const height = Math.max(0, windowBottom - logicalBeforeHeight);
  const beforeHeight = getImagePagedLayoutTop({
    logicalTop: logicalBeforeHeight,
    scrollPageOffset,
    totalHeight: layout.totalHeight,
    viewportHeight,
  });
  const safeViewportHeight =
    Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 0;
  const safePhysicalScrollHeight = Math.max(
    0,
    finiteNumber(physicalScrollHeight),
  );
  const stickyInset =
    safeViewportHeight > 0 ? -Math.max(0, height - safeViewportHeight) : 0;

  return {
    afterHeight: Math.max(0, safePhysicalScrollHeight - beforeHeight - height),
    beforeHeight,
    frames: frames.map((frame) => ({
      ...frame,
      windowTop: frame.offsetTop - logicalBeforeHeight,
    })),
    height,
    stickyInset,
  };
}

export function createImageWindowFromScrollPosition({
  fitPerfectly = false,
  fitPerfectlyOverscanPx = 0,
  overscanPx,
  scrollHeight,
  scrollTop,
  viewportHeight,
}: {
  fitPerfectly?: boolean;
  fitPerfectlyOverscanPx?: number;
  overscanPx: number;
  scrollHeight: number;
  scrollTop: number;
  viewportHeight: number;
}): ImageRenderPixelWindow {
  const safeOverscanPx = safePadding(overscanPx);
  const safeScrollHeight = Math.max(0, finiteNumber(scrollHeight));
  const safeScrollTop = Math.max(0, finiteNumber(scrollTop));
  const safeViewportHeight = Math.max(0, finiteNumber(viewportHeight));
  const windowHeight = safeViewportHeight + safeOverscanPx * 2;
  const fitPerfectlyOverscan = safePadding(fitPerfectlyOverscanPx);
  const effectiveHeight = fitPerfectly
    ? safeViewportHeight + fitPerfectlyOverscan * 2
    : windowHeight;

  if (windowHeight >= safeScrollHeight || fitPerfectly) {
    const fitScrollTop = Math.min(safeScrollTop, safeScrollHeight);
    const top = Math.max(fitScrollTop - fitPerfectlyOverscan, 0);
    const bottom = Math.min(fitScrollTop + effectiveHeight, safeScrollHeight);
    return {
      bottom: Math.ceil(Math.max(bottom, top)),
      top: Math.floor(Math.max(0, top)),
    };
  }

  const scrollCenter = safeScrollTop + safeViewportHeight / 2;
  let top = scrollCenter - windowHeight / 2;
  let bottom = top + windowHeight;

  if (top < 0) {
    top = 0;
    bottom = windowHeight;
  }
  if (bottom > safeScrollHeight) {
    bottom = safeScrollHeight;
    top = safeScrollHeight - windowHeight;
  }

  return {
    bottom: Math.ceil(Math.max(bottom, top)),
    top: Math.floor(Math.max(0, top)),
  };
}

export function getImagePhysicalScrollHeight({
  totalHeight,
  viewportHeight,
}: {
  totalHeight: number;
  viewportHeight: number;
}) {
  const safeTotalHeight = safeSize(totalHeight);
  return shouldRebaseImageScroll({
    totalHeight: safeTotalHeight,
    viewportHeight,
  })
    ? Math.min(safeTotalHeight, IMAGE_SCROLL_REBASE_CONTAINER_PX)
    : safeTotalHeight;
}

export function getImageLogicalScrollTop({
  physicalScrollTop,
  scrollPageOffset,
  totalHeight,
  viewportHeight,
}: {
  physicalScrollTop: number;
  scrollPageOffset: number;
  totalHeight: number;
  viewportHeight: number;
}) {
  return clamp(
    finiteNumber(physicalScrollTop) + safePadding(scrollPageOffset),
    0,
    getImageMaxLogicalScrollTop({ totalHeight, viewportHeight }),
  );
}

export function resolveImagePhysicalScrollPosition({
  logicalScrollTop,
  scrollPageOffset,
  totalHeight,
  viewportHeight,
}: {
  logicalScrollTop: number;
  scrollPageOffset: number;
  totalHeight: number;
  viewportHeight: number;
}): ImageScrollRebasePosition {
  const safeLogicalScrollTop = clamp(
    finiteNumber(logicalScrollTop),
    0,
    getImageMaxLogicalScrollTop({ totalHeight, viewportHeight }),
  );

  if (!shouldRebaseImageScroll({ totalHeight, viewportHeight })) {
    return {
      physicalScrollTop: clamp(
        safeLogicalScrollTop,
        0,
        getImageMaxPhysicalScrollTop({ totalHeight, viewportHeight }),
      ),
      scrollPageOffset: 0,
    };
  }

  const currentPageOffset = clampImageScrollPageOffset({
    scrollPageOffset,
    totalHeight,
    viewportHeight,
  });
  const physicalScrollTop = safeLogicalScrollTop - currentPageOffset;
  const maxPhysicalScrollTop = getImageMaxPhysicalScrollTop({
    totalHeight,
    viewportHeight,
  });
  const maxPageOffset = getImageMaxScrollPageOffset({
    totalHeight,
    viewportHeight,
  });
  const shouldMoveDown =
    physicalScrollTop > IMAGE_SCROLL_REBASE_THRESHOLD_PX &&
    currentPageOffset < maxPageOffset;
  const shouldMoveUp =
    physicalScrollTop < IMAGE_SCROLL_REBASE_TRIGGER_PX && currentPageOffset > 0;

  if (
    physicalScrollTop < 0 ||
    physicalScrollTop > maxPhysicalScrollTop ||
    shouldMoveDown ||
    shouldMoveUp
  ) {
    return resolveImageScrollPageWindow({
      logicalScrollTop: safeLogicalScrollTop,
      preferredPhysicalScrollTop: shouldMoveUp
        ? Math.min(IMAGE_SCROLL_REBASE_TARGET_BOTTOM_PX, maxPhysicalScrollTop)
        : IMAGE_SCROLL_REBASE_TARGET_PX,
      totalHeight,
      viewportHeight,
    });
  }

  return {
    physicalScrollTop: roundImageScrollPixel(
      clamp(physicalScrollTop, 0, maxPhysicalScrollTop),
    ),
    scrollPageOffset: currentPageOffset,
  };
}

export function getImagePagedLayoutTop({
  logicalTop,
  scrollPageOffset,
  totalHeight,
  viewportHeight,
}: {
  logicalTop: number;
  scrollPageOffset: number;
  totalHeight: number;
  viewportHeight: number;
}) {
  if (!shouldRebaseImageScroll({ totalHeight, viewportHeight })) {
    return finiteNumber(logicalTop);
  }
  return Math.max(0, finiteNumber(logicalTop) - safePadding(scrollPageOffset));
}

export function getCurrentImageFrameNumber({
  layout,
  scrollTop,
  viewportHeight,
}: {
  layout: ImageFrameLayoutModel;
  scrollTop: number;
  viewportHeight: number;
}): number {
  return findImageFrameByOffset(layout, scrollTop + viewportHeight * 0.2);
}

export function useImageFrameVirtualization({
  getScrollMetrics,
  layout,
  resetKey,
  viewportElement,
}: {
  getScrollMetrics?: () => ImageFrameVirtualizationScrollMetrics;
  layout: ImageFrameLayoutModel;
  resetKey?: unknown;
  viewportElement: HTMLDivElement | null;
}) {
  const measureFrameRef = React.useRef(0);
  const hasMeasuredScrollRef = React.useRef(false);
  const lastMeasuredResetKeyRef = React.useRef<unknown>(resetKey);
  const lastMeasuredScrollTopRef = React.useRef(0);
  const getCurrentScrollMetrics =
    React.useCallback((): ImageFrameVirtualizationScrollMetrics => {
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
  const getFrameWindow = React.useCallback(
    (
      metrics: ImageFrameVirtualizationScrollMetrics,
      fitPerfectly = false,
    ): ImageFrameWindow => {
      const renderFrameNumbers = getImageRenderFrameNumbers({
        fitPerfectly,
        layout,
        scrollTop: metrics.scrollTop,
        viewportHeight: metrics.viewportHeight,
      });

      return {
        scrollPageOffset: metrics.scrollPageOffset,
        visibleFrameNumbers: getVisibleImageFrameNumbers({
          layout,
          scrollTop: metrics.scrollTop,
          viewportHeight: metrics.viewportHeight,
        }),
        renderFrameNumbers,
        preloadFrameNumbers: getImagePreloadFrameNumbers({
          layout,
          renderFrameNumbers,
        }),
      };
    },
    [layout],
  );
  const getCurrentVisibleFrameNumbers =
    React.useCallback((): ImageFrameWindow => {
      return getFrameWindow(getCurrentScrollMetrics());
    }, [getCurrentScrollMetrics, getFrameWindow]);
  const getResetFrameWindow = React.useCallback(() => {
    const viewportHeight = viewportElement?.clientHeight ?? 0;
    const renderFrameNumbers = getImageRenderFrameNumbers({
      layout,
      scrollTop: 0,
      viewportHeight,
    });

    return {
      scrollPageOffset: 0,
      visibleFrameNumbers: getVisibleImageFrameNumbers({
        layout,
        scrollTop: 0,
        viewportHeight,
      }),
      renderFrameNumbers,
      preloadFrameNumbers: getImagePreloadFrameNumbers({
        layout,
        renderFrameNumbers,
      }),
    };
  }, [layout, viewportElement]);
  const [state, setState] = React.useState<{
    layout: ImageFrameLayoutModel;
    resetKey: unknown;
    frameWindow: ImageFrameWindow;
  }>(() => ({
    layout,
    resetKey,
    frameWindow: getCurrentVisibleFrameNumbers(),
  }));
  const frameWindow =
    Object.is(state.layout, layout) && Object.is(state.resetKey, resetKey)
      ? state.frameWindow
      : Object.is(state.resetKey, resetKey)
        ? getCurrentVisibleFrameNumbers()
        : getResetFrameWindow();

  const measureVisibleFramesNow = React.useCallback(() => {
    measureFrameRef.current = 0;
    const metrics = getCurrentScrollMetrics();
    const fitPerfectly = shouldFitImagePerfectly({
      canFitPerfectly:
        hasMeasuredScrollRef.current &&
        Object.is(lastMeasuredResetKeyRef.current, resetKey),
      previousScrollTop: lastMeasuredScrollTopRef.current,
      scrollTop: metrics.scrollTop,
      viewportHeight: metrics.viewportHeight,
    });
    const nextFrameWindow = getFrameWindow(metrics, fitPerfectly);
    lastMeasuredResetKeyRef.current = resetKey;
    lastMeasuredScrollTopRef.current = metrics.scrollTop;
    hasMeasuredScrollRef.current = true;
    setState((previousState) =>
      Object.is(previousState.layout, layout) &&
      Object.is(previousState.resetKey, resetKey) &&
      areFrameWindowsEqual(previousState.frameWindow, nextFrameWindow)
        ? previousState
        : { layout, resetKey, frameWindow: nextFrameWindow },
    );
    if (fitPerfectly && measureFrameRef.current === 0) {
      measureFrameRef.current = requestAnimationFrame(() =>
        measureVisibleFramesNowRef.current(),
      );
    }
  }, [getCurrentScrollMetrics, getFrameWindow, layout, resetKey]);
  const measureVisibleFramesNowRef = React.useRef(measureVisibleFramesNow);
  useKeyedLayoutEffect(joinEffectKey([measureVisibleFramesNow]), () => {
    measureVisibleFramesNowRef.current = measureVisibleFramesNow;
  });

  const measureVisibleFrames = React.useCallback(() => {
    if (measureFrameRef.current) return;
    measureFrameRef.current = requestAnimationFrame(() =>
      measureVisibleFramesNowRef.current(),
    );
  }, []);

  useKeyedMountEffect(
    joinEffectKey(["image-virtualization-measure", measureVisibleFramesNow]),
    () => {
      if (measureFrameRef.current) {
        cancelAnimationFrame(measureFrameRef.current);
        measureFrameRef.current = 0;
      }
      measureVisibleFramesNow();
    },
  );

  useMountEffect(() => {
    return () => {
      if (measureFrameRef.current) {
        cancelAnimationFrame(measureFrameRef.current);
      }
    };
  });

  return {
    scrollPageOffset: frameWindow.scrollPageOffset,
    visibleFrameNumbers: frameWindow.visibleFrameNumbers,
    renderFrameNumbers: frameWindow.renderFrameNumbers,
    preloadFrameNumbers: frameWindow.preloadFrameNumbers,
    measureVisibleFrames,
  };
}

function getImageFrameNumbersInRange({
  layout,
  startOffset,
  endOffset,
  overscanFrames,
}: {
  layout: ImageFrameLayoutModel;
  startOffset: number;
  endOffset: number;
  overscanFrames: number;
}) {
  const safeStartOffset = Math.max(0, startOffset);
  const safeEndOffset = Math.max(safeStartOffset, endOffset);
  const firstVisibleFrame = findImageFrameByOffset(layout, safeStartOffset);
  const lastVisibleFrame = findImageFrameByOffset(layout, safeEndOffset);
  const firstFrame = Math.max(1, firstVisibleFrame - overscanFrames);
  const lastFrame = Math.min(
    layout.frameCount,
    lastVisibleFrame + overscanFrames,
  );

  return createFrameNumberRange(firstFrame, lastFrame);
}

function createFrameNumberRange(firstFrame: number, lastFrame: number) {
  if (lastFrame < firstFrame) return [];

  return Array.from(
    { length: lastFrame - firstFrame + 1 },
    (_, index) => firstFrame + index,
  );
}

function shouldRebaseImageScroll({
  totalHeight,
  viewportHeight,
}: {
  totalHeight: number;
  viewportHeight: number;
}) {
  return (
    getImageMaxLogicalScrollTop({ totalHeight, viewportHeight }) >
    IMAGE_SCROLL_REBASE_THRESHOLD_PX
  );
}

function getImageMaxLogicalScrollTop({
  totalHeight,
  viewportHeight,
}: {
  totalHeight: number;
  viewportHeight: number;
}) {
  return Math.max(
    safeSize(totalHeight) - Math.max(0, finiteNumber(viewportHeight)),
    0,
  );
}

function getImageMaxPhysicalScrollTop({
  totalHeight,
  viewportHeight,
}: {
  totalHeight: number;
  viewportHeight: number;
}) {
  return Math.max(
    getImagePhysicalScrollHeight({ totalHeight, viewportHeight }) -
      Math.max(0, finiteNumber(viewportHeight)),
    0,
  );
}

function getImageMaxScrollPageOffset({
  totalHeight,
  viewportHeight,
}: {
  totalHeight: number;
  viewportHeight: number;
}) {
  return Math.max(
    getImageMaxLogicalScrollTop({ totalHeight, viewportHeight }) -
      getImageMaxPhysicalScrollTop({ totalHeight, viewportHeight }),
    0,
  );
}

function clampImageScrollPageOffset({
  scrollPageOffset,
  totalHeight,
  viewportHeight,
}: {
  scrollPageOffset: number;
  totalHeight: number;
  viewportHeight: number;
}) {
  return clamp(
    safePadding(scrollPageOffset),
    0,
    getImageMaxScrollPageOffset({ totalHeight, viewportHeight }),
  );
}

function resolveImageScrollPageWindow({
  logicalScrollTop,
  preferredPhysicalScrollTop,
  totalHeight,
  viewportHeight,
}: {
  logicalScrollTop: number;
  preferredPhysicalScrollTop: number;
  totalHeight: number;
  viewportHeight: number;
}): ImageScrollRebasePosition {
  let physicalScrollTop = roundImageScrollPixel(
    clamp(
      finiteNumber(preferredPhysicalScrollTop),
      0,
      getImageMaxPhysicalScrollTop({ totalHeight, viewportHeight }),
    ),
  );
  let scrollPageOffset = clampImageScrollPageOffset({
    scrollPageOffset: logicalScrollTop - physicalScrollTop,
    totalHeight,
    viewportHeight,
  });

  physicalScrollTop = roundImageScrollPixel(
    clamp(
      logicalScrollTop - scrollPageOffset,
      0,
      getImageMaxPhysicalScrollTop({ totalHeight, viewportHeight }),
    ),
  );
  scrollPageOffset = clampImageScrollPageOffset({
    scrollPageOffset: logicalScrollTop - physicalScrollTop,
    totalHeight,
    viewportHeight,
  });

  return { physicalScrollTop, scrollPageOffset };
}

function shouldFitImagePerfectly({
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
      viewportHeight + IMAGE_RENDER_WINDOW_OVERSCAN_PX * 2
  );
}

function areFrameWindowsEqual(
  previousFrameWindow: ImageFrameWindow,
  nextFrameWindow: ImageFrameWindow,
): boolean {
  return (
    previousFrameWindow.scrollPageOffset === nextFrameWindow.scrollPageOffset &&
    areFrameNumbersEqual(
      previousFrameWindow.visibleFrameNumbers,
      nextFrameWindow.visibleFrameNumbers,
    ) &&
    areFrameNumbersEqual(
      previousFrameWindow.renderFrameNumbers,
      nextFrameWindow.renderFrameNumbers,
    ) &&
    areFrameNumbersEqual(
      previousFrameWindow.preloadFrameNumbers,
      nextFrameWindow.preloadFrameNumbers,
    )
  );
}

function finiteNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function roundImageScrollPixel(value: number) {
  if (typeof window === "undefined") return Math.round(value);
  const ratio = window.devicePixelRatio || 1;
  return Math.round(value * ratio) / ratio;
}

function safePadding(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function safeSize(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function areFrameNumbersEqual(
  previousFrameNumbers: readonly number[],
  nextFrameNumbers: readonly number[],
): boolean {
  if (previousFrameNumbers.length !== nextFrameNumbers.length) return false;
  return previousFrameNumbers.every(
    (frameNumber, index) => frameNumber === nextFrameNumbers[index],
  );
}
