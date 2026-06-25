"use client";

import * as React from "react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { type FrameSource } from "@/lib/image-frame-source";
import { normalizeRotation, rotatedSize } from "@/lib/image-geometry";
import {
  type ImageViewerHandle,
  type ImageViewerProps,
} from "@/components/ui/image-viewer-types";

import {
  getCurrentImageFrameNumber,
  getImageFrameLayout,
  getImageLogicalScrollTop,
  getImagePhysicalScrollHeight,
  resolveImagePhysicalScrollPosition,
  type ImageFrameVirtualizationScrollMetrics,
  type ImageFrameLayoutModel,
} from "./image-viewer-virtualization";
import { joinEffectKey } from "@/lib/effect-key";

const IMAGE_SCROLL_HEADROOM = 48;
const IMAGE_READING_MARKER_RATIO = 0.2;
const IMAGE_VIEWER_HORIZONTAL_PADDING = 32;
const IMAGE_SCROLL_POSITION_EPSILON = 1;

/** Bounds for the viewer's zoom range, shared by fit-width and the controls. */
export const MIN_VIEWER_SCALE = 0.25;
export const MAX_VIEWER_SCALE = 5;

export function useFrameListWidth() {
  const [frameListWidth, setFrameListWidth] = React.useState<number | null>(
    null,
  );
  const frameListRef = React.useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    setFrameListWidth(element.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setFrameListWidth((entry.target as HTMLElement).clientWidth);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { frameListRef, frameListWidth };
}

export function useImageViewerScale(
  source: FrameSource,
  controlledScale: number | undefined,
  defaultScale: number | undefined,
  onScaleChange: ImageViewerProps["onScaleChange"],
  frameListWidth: number | null,
) {
  const isScaleControlled = controlledScale !== undefined;
  const [uncontrolledScale, setUncontrolledScale] = React.useState<
    number | null
  >(() =>
    defaultScale === undefined ? null : normalizeViewerScale(defaultScale),
  );
  const [rawRotation, setRawRotation] = React.useState(0);

  useKeyedMountEffect(
    joinEffectKey(["image-scale-reset", defaultScale, source]),
    () => {
      setRawRotation(0);
      setUncontrolledScale(
        defaultScale === undefined ? null : normalizeViewerScale(defaultScale),
      );
    },
  );

  const rotation = normalizeRotation(rawRotation);
  const widestFrameWidth = Math.max(
    1,
    ...source.frames.map(
      (frame) => rotatedSize(frame.intrinsicSize, rotation).width,
    ),
  );
  const fitWidthScale = frameListWidth
    ? (frameListWidth - IMAGE_VIEWER_HORIZONTAL_PADDING) / widestFrameWidth
    : 1;
  const scale =
    controlledScale !== undefined
      ? normalizeViewerScale(controlledScale)
      : uncontrolledScale !== null
        ? normalizeViewerScale(uncontrolledScale)
        : Math.min(MAX_VIEWER_SCALE, Math.max(MIN_VIEWER_SCALE, fitWidthScale));

  const scaleControlsDisabled = isScaleControlled && !onScaleChange;
  const setViewerScale = React.useCallback(
    (nextScale: number | null) => {
      const normalized =
        nextScale == null ? null : normalizeViewerScale(nextScale);
      if (isScaleControlled) {
        onScaleChange?.(normalized);
        return;
      }
      setUncontrolledScale(normalized);
    },
    [isScaleControlled, onScaleChange],
  );
  const rotateClockwise = React.useCallback(() => {
    setRawRotation((value) => (value + 90) % 360);
  }, []);

  return {
    rotateClockwise,
    rotation,
    scale,
    scaleControlsDisabled,
    setViewerScale,
  };
}

function normalizeViewerScale(scale: number): number {
  return Number.isFinite(scale) && scale > 0
    ? Math.min(MAX_VIEWER_SCALE, Math.max(MIN_VIEWER_SCALE, scale))
    : MIN_VIEWER_SCALE;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeFrameAreaPercent(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

type ImageReadingAnchor =
  | {
      kind: "top";
    }
  | {
      frameNumber: number;
      kind: "frame";
      yPercent: number;
    };

type ImageScrollMetrics = ImageFrameVirtualizationScrollMetrics & {
  physicalScrollHeight: number;
  physicalScrollTop: number;
};

export function useVisibleFrame(
  layout: ImageFrameLayoutModel,
  resetKey: unknown,
  onScrollProgressChange: ImageViewerProps["onScrollProgressChange"],
  onVisibleFrameChange: ImageViewerProps["onVisibleFrameChange"],
) {
  const [currentFrameNumber, setCurrentFrameNumber] = React.useState(1);
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null);
  const [scrollViewportElement, setScrollViewportElement] =
    React.useState<HTMLDivElement | null>(null);
  const lastReportedFrameNumber = React.useRef(0);
  const scrollPageOffsetRef = React.useRef(0);
  const committedLayoutRef = React.useRef(layout);
  const committedResetKeyRef = React.useRef<unknown>(resetKey);

  useKeyedMountEffect(joinEffectKey(["image-visible-reset", resetKey]), () => {
    lastReportedFrameNumber.current = 0;
    scrollPageOffsetRef.current = 0;
    setCurrentFrameNumber(1);
    const viewport = scrollViewportRef.current;
    if (viewport) {
      setViewportPhysicalScrollTop(viewport, 0);
      viewport.scrollTo?.({ top: 0, behavior: "auto" });
    }
  });

  const setScrollViewportRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      scrollViewportRef.current = element;
      setScrollViewportElement(element);
    },
    [],
  );

  const readScrollMetrics = React.useCallback(
    () =>
      readImageScrollMetrics({
        scrollPageOffset: scrollPageOffsetRef.current,
        totalHeight: layout.totalHeight,
        viewportElement: scrollViewportRef.current,
      }),
    [layout.totalHeight],
  );

  const syncPhysicalScrollPosition = React.useCallback(
    (viewport: HTMLDivElement) => {
      const metrics = readImageScrollMetrics({
        scrollPageOffset: scrollPageOffsetRef.current,
        totalHeight: layout.totalHeight,
        viewportElement: viewport,
      });
      if (metrics.physicalScrollHeight >= layout.totalHeight) {
        scrollPageOffsetRef.current = 0;
        return {
          ...metrics,
          scrollPageOffset: 0,
        };
      }

      const position = resolveImagePhysicalScrollPosition({
        logicalScrollTop: metrics.scrollTop,
        scrollPageOffset: metrics.scrollPageOffset,
        totalHeight: layout.totalHeight,
        viewportHeight: metrics.viewportHeight,
      });
      scrollPageOffsetRef.current = position.scrollPageOffset;
      setViewportPhysicalScrollTop(viewport, position.physicalScrollTop);

      return {
        ...metrics,
        physicalScrollTop: position.physicalScrollTop,
        scrollPageOffset: position.scrollPageOffset,
      };
    },
    [layout.totalHeight],
  );

  const scrollViewportToLogicalTop = React.useCallback(
    (
      viewport: HTMLDivElement,
      targetTop: number,
      options?: ScrollToOptions,
    ) => {
      const physicalScrollHeight = getImagePhysicalScrollHeight({
        totalHeight: layout.totalHeight,
        viewportHeight: viewport.clientHeight,
      });
      const position =
        physicalScrollHeight < layout.totalHeight
          ? resolveImagePhysicalScrollPosition({
              logicalScrollTop: targetTop,
              scrollPageOffset: scrollPageOffsetRef.current,
              totalHeight: layout.totalHeight,
              viewportHeight: viewport.clientHeight,
            })
          : {
              physicalScrollTop: Math.max(0, targetTop),
              scrollPageOffset: 0,
            };
      scrollPageOffsetRef.current = position.scrollPageOffset;
      scrollViewportToPhysicalTop(viewport, position.physicalScrollTop, {
        behavior: "auto",
        ...options,
      });
    },
    [layout.totalHeight],
  );

  useKeyedMountEffect(joinEffectKey(["image-anchor", layout, resetKey]), () => {
    const previousLayout = committedLayoutRef.current;
    const previousResetKey = committedResetKeyRef.current;
    committedLayoutRef.current = layout;
    committedResetKeyRef.current = resetKey;

    if (!Object.is(previousResetKey, resetKey)) return;
    if (Object.is(previousLayout, layout)) return;

    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const previousLogicalScrollTop = getImageLogicalScrollTop({
      physicalScrollTop: viewport.scrollTop,
      scrollPageOffset: scrollPageOffsetRef.current,
      totalHeight: previousLayout.totalHeight,
      viewportHeight: viewport.clientHeight,
    });
    const anchor = captureImageReadingAnchor(
      previousLayout,
      viewport,
      previousLogicalScrollTop,
    );
    if (!anchor) return;

    const targetTop = getImageReadingAnchorScrollTop(layout, viewport, anchor);
    if (targetTop != null) {
      scrollViewportToLogicalTop(viewport, targetTop);
    }
  });

  const handleScroll = React.useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    const metrics = syncPhysicalScrollPosition(viewport);
    const isRebased = metrics.physicalScrollHeight < layout.totalHeight;
    const scrollable = isRebased
      ? layout.totalHeight - metrics.viewportHeight
      : viewport.scrollHeight - metrics.viewportHeight;
    const progress =
      scrollable > 0
        ? clamp01(
            (isRebased ? metrics.scrollTop : viewport.scrollTop) / scrollable,
          )
        : 0;
    onScrollProgressChange?.(progress);

    const frameNumber = getCurrentImageFrameNumber({
      layout,
      scrollTop: metrics.scrollTop,
      viewportHeight: metrics.viewportHeight,
    });
    if (frameNumber && frameNumber !== lastReportedFrameNumber.current) {
      lastReportedFrameNumber.current = frameNumber;
      setCurrentFrameNumber(frameNumber);
      onVisibleFrameChange?.(frameNumber);
    }
  }, [
    layout,
    onScrollProgressChange,
    onVisibleFrameChange,
    syncPhysicalScrollPosition,
  ]);

  return {
    currentFrameNumber,
    getScrollMetrics: readScrollMetrics,
    handleScroll,
    scrollToLogicalTop: scrollViewportToLogicalTop,
    scrollViewportElement,
    scrollViewportRef,
    setScrollViewportRef,
  };
}

function captureImageReadingAnchor(
  layout: ImageFrameLayoutModel,
  viewport: HTMLDivElement,
  scrollTop: number,
): ImageReadingAnchor | null {
  if (layout.frameCount === 0) return null;
  if (scrollTop <= 0) return { kind: "top" };

  const markerOffset =
    scrollTop + viewport.clientHeight * IMAGE_READING_MARKER_RATIO;
  const frameNumber = getCurrentImageFrameNumber({
    layout,
    scrollTop,
    viewportHeight: viewport.clientHeight,
  });
  const frame = getImageFrameLayout(layout, frameNumber);
  if (!frame || frame.height <= 0) return null;

  return {
    frameNumber,
    kind: "frame",
    yPercent: clamp01((markerOffset - frame.offsetTop) / frame.height),
  };
}

function getImageReadingAnchorScrollTop(
  layout: ImageFrameLayoutModel,
  viewport: HTMLDivElement,
  anchor: ImageReadingAnchor,
): number | null {
  if (anchor.kind === "top") {
    return 0;
  }

  const frame = getImageFrameLayout(layout, anchor.frameNumber);
  if (!frame) return null;

  const targetTop =
    frame.offsetTop +
    frame.height * anchor.yPercent -
    viewport.clientHeight * IMAGE_READING_MARKER_RATIO;
  const maxScrollTop = Math.max(0, layout.totalHeight - viewport.clientHeight);
  return Math.min(maxScrollTop, Math.max(0, targetTop));
}

export function useImageViewerHandle(
  forwardedRef: React.ForwardedRef<ImageViewerHandle> | undefined,
  scrollViewportRef: React.RefObject<HTMLDivElement | null>,
  layout: ImageFrameLayoutModel,
  scrollToLogicalTop: (
    viewport: HTMLDivElement,
    targetTop: number,
    options?: ScrollToOptions,
  ) => void,
) {
  React.useImperativeHandle(
    forwardedRef ?? null,
    () => ({
      scrollToFrameArea: (frameNumber, area, options) => {
        const areaTop = normalizeFrameAreaPercent(area.top);
        if (areaTop == null) return;
        const viewport = scrollViewportRef.current;
        const frame = getImageFrameLayout(layout, frameNumber);
        if (!viewport || !frame) return;
        const targetTop =
          frame.offsetTop +
          (areaTop / 100) * frame.height -
          IMAGE_SCROLL_HEADROOM;
        scrollToLogicalTop(viewport, Math.max(0, targetTop), {
          behavior: "smooth",
          ...options,
        });
      },
      getViewportElement: () => scrollViewportRef.current,
    }),
    [layout, scrollToLogicalTop, scrollViewportRef],
  );
}

function readImageScrollMetrics({
  scrollPageOffset,
  totalHeight,
  viewportElement,
}: {
  scrollPageOffset: number;
  totalHeight: number;
  viewportElement: HTMLDivElement | null;
}): ImageScrollMetrics {
  const viewportHeight = viewportElement?.clientHeight ?? 0;
  const physicalScrollTop = viewportElement?.scrollTop ?? 0;
  const physicalScrollHeight = getImagePhysicalScrollHeight({
    totalHeight,
    viewportHeight,
  });
  return {
    physicalScrollHeight,
    physicalScrollTop,
    scrollPageOffset,
    scrollTop: getImageLogicalScrollTop({
      physicalScrollTop,
      scrollPageOffset,
      totalHeight,
      viewportHeight,
    }),
    viewportHeight,
  };
}

function setViewportPhysicalScrollTop(
  viewport: HTMLDivElement,
  physicalScrollTop: number,
) {
  if (
    Math.abs(viewport.scrollTop - physicalScrollTop) <=
    IMAGE_SCROLL_POSITION_EPSILON
  ) {
    return;
  }
  viewport.scrollTop = physicalScrollTop;
}

function scrollViewportToPhysicalTop(
  viewport: HTMLDivElement,
  physicalScrollTop: number,
  options?: ScrollToOptions,
) {
  if (typeof viewport.scrollTo === "function") {
    viewport.scrollTo({
      top: physicalScrollTop,
      ...options,
    });
    return;
  }
  viewport.scrollTop = physicalScrollTop;
}
