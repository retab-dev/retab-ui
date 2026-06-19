"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";
import { createRoot, type Root } from "react-dom/client";

import { Skeleton } from "@/components/ui/skeleton";

import {
  getPptxRenderPixelRatio,
  getScaledSlideSize,
  getVisibleSlideSize,
  type PptxSize,
  type PptxSlideOverlayProps,
  type PptxSlideRenderPriority,
  type PptxSlideRenderTiming,
} from "./pptx-viewer-core";
import { type PptxScrollActivity } from "./pptx-viewer-scroll";
import { type PptxSource } from "./pptx-viewer-source";
import {
  createPptxSlideLayout,
  getPptxVirtualSlides,
  type PptxSlideLayout,
  type PptxVirtualSlide,
} from "./pptx-viewer-visible-slide";

type SlideRenderState = "idle" | "rendering" | "rendered" | "failed";

export const PPTX_SLIDE_GAP = 16;
export const PPTX_SLIDE_PADDING = 16;
const PPTX_SLIDE_OVERSCAN = 2;
const PPTX_READING_MARKER_RATIO = 0.2;

export interface PptxSlideScrollerProps {
  source: PptxSource;
  zoomScale: number;
  rotation: number;
  layout?: PptxSlideLayout;
  eager: boolean;
  activity: PptxScrollActivity;
  renderSlideOverlay?: (props: PptxSlideOverlayProps) => React.ReactNode;
  onSlideRenderTiming?: (timing: PptxSlideRenderTiming) => void;
  containerRef: React.Ref<HTMLDivElement>;
  viewportRef: React.Ref<HTMLDivElement>;
  onScroll: () => void;
}

export function PptxSlideScroller({
  source,
  zoomScale,
  rotation,
  layout: providedLayout,
  eager,
  activity,
  renderSlideOverlay,
  onSlideRenderTiming,
  containerRef,
  viewportRef,
  onScroll,
}: PptxSlideScrollerProps) {
  const layout = React.useMemo(
    () =>
      providedLayout ??
      createPptxSlideLayout({
        baseSize: source.baseSize,
        zoomScale,
        rotation,
        slideCount: source.slideCount,
        slideGap: PPTX_SLIDE_GAP,
        slidePadding: PPTX_SLIDE_PADDING,
      }),
    [providedLayout, rotation, source.baseSize, source.slideCount, zoomScale],
  );
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const projectionFrameRef = React.useRef<number | null>(null);
  const projectionCacheRef = React.useRef<PptxSlideProjectionCache>({
    resetKey: "",
    slides: new Map(),
  });
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null);
  const layoutResetKey = `${layout.slideCount}:${layout.slideWidth}:${layout.slideHeight}:${layout.slideStride}:${layout.totalHeight}:${zoomScale}:${rotation}`;

  const projectSlides = React.useCallback(() => {
    projectionFrameRef.current = null;
    projectPptxSlides({
      activity,
      cache: projectionCacheRef.current,
      canvas: canvasRef.current,
      eager,
      layout,
      onSlideRenderTiming,
      renderSlideOverlay,
      resetKey: layoutResetKey,
      rotation,
      source,
      viewport: viewportElementRef.current,
      zoomScale,
    });
  }, [
    activity,
    eager,
    layout,
    layoutResetKey,
    onSlideRenderTiming,
    renderSlideOverlay,
    rotation,
    source,
    zoomScale,
  ]);

  const scheduleProjectSlides = React.useCallback(() => {
    if (projectionFrameRef.current !== null) return;
    if (typeof requestAnimationFrame !== "function") {
      projectSlides();
      return;
    }
    projectionFrameRef.current = requestAnimationFrame(projectSlides);
  }, [projectSlides]);

  React.useLayoutEffect(() => {
    projectSlides();
  }, [projectSlides]);

  React.useEffect(
    () => () => {
      if (
        projectionFrameRef.current !== null &&
        typeof cancelAnimationFrame === "function"
      ) {
        cancelAnimationFrame(projectionFrameRef.current);
      }
      disposePptxSlideProjectionCache(projectionCacheRef.current);
    },
    [],
  );

  const setViewportRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      viewportElementRef.current = element;
      assignPptxRef(viewportRef, element);
      assignPptxRef(containerRef, element);
    },
    [containerRef, viewportRef],
  );

  const setCanvasRef = React.useCallback((element: HTMLDivElement | null) => {
    canvasRef.current = element;
  }, []);

  const handleScroll = React.useCallback(() => {
    onScroll();
    scheduleProjectSlides();
  }, [onScroll, scheduleProjectSlides]);

  return (
    <div className="size-full min-h-0 flex-1">
      <div
        ref={setViewportRef}
        className="focus-visible:ring-ring focus-visible:ring-offset-background h-full overflow-auto rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        data-slot="scroll-area-viewport"
        onScroll={handleScroll}
      >
        <div
          ref={setCanvasRef}
          className="relative mx-auto min-w-0"
          data-slot="pptx-slide-virtual-canvas"
        />
      </div>
    </div>
  );
}

function PptxSlideFrame({
  source,
  slideIndex,
  zoomScale,
  rotation,
  eager,
  activity,
  renderSlideOverlay,
  getSlideRenderTiming,
  isProjectedLive,
  priority,
  shouldRenderImmediately,
}: {
  source: PptxSource;
  slideIndex: number;
  zoomScale: number;
  rotation: number;
  eager: boolean;
  activity: PptxScrollActivity;
  renderSlideOverlay?: (props: PptxSlideOverlayProps) => React.ReactNode;
  getSlideRenderTiming?: () =>
    | ((timing: PptxSlideRenderTiming) => void)
    | undefined;
  isProjectedLive?: () => boolean;
  priority: PptxSlideRenderPriority;
  shouldRenderImmediately: boolean;
}) {
  const slideSize = getScaledSlideSize(source.baseSize, zoomScale);
  const visibleSize = getVisibleSlideSize(slideSize, rotation);

  return (
    <div
      className="ring-border relative shadow-sm ring-1"
      style={{ width: visibleSize.width, height: visibleSize.height }}
      data-slot="pptx-slide"
      data-slide-number={slideIndex + 1}
    >
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width: slideSize.width,
          height: slideSize.height,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        }}
      >
        <PptxSlideCanvas
          source={source}
          slideIndex={slideIndex}
          zoomScale={zoomScale}
          eager={eager}
          activity={activity}
          getSlideRenderTiming={getSlideRenderTiming}
          isProjectedLive={isProjectedLive}
          priority={priority}
          shouldRenderImmediately={shouldRenderImmediately}
        />
      </div>
      {renderSlideOverlay ? (
        <PptxSlideOverlay
          slideNumber={slideIndex + 1}
          visibleSize={visibleSize}
          zoomScale={zoomScale}
          rotation={rotation}
          renderSlideOverlay={renderSlideOverlay}
        />
      ) : null}
    </div>
  );
}

function PptxSlideCanvas({
  source,
  slideIndex,
  zoomScale,
  eager,
  activity,
  getSlideRenderTiming,
  isProjectedLive,
  priority,
  shouldRenderImmediately,
}: {
  source: PptxSource;
  slideIndex: number;
  zoomScale: number;
  eager: boolean;
  activity: PptxScrollActivity;
  getSlideRenderTiming?: () =>
    | ((timing: PptxSlideRenderTiming) => void)
    | undefined;
  isProjectedLive?: () => boolean;
  priority: PptxSlideRenderPriority;
  shouldRenderImmediately: boolean;
}) {
  const rawDpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  const pixelRatio = getPptxRenderPixelRatio(rawDpr);
  const slideSize = getScaledSlideSize(source.baseSize, zoomScale);
  const [renderState, setRenderState] =
    React.useState<SlideRenderState>("idle");
  const canvasElementRef = React.useRef<HTMLCanvasElement | null>(null);

  const canvasRef = React.useCallback((canvas: HTMLCanvasElement | null) => {
    canvasElementRef.current = canvas;
  }, []);

  React.useEffect(() => {
    const canvas = canvasElementRef.current;
    if (!canvas) return;

    let cancelled = false;
    const renderScale = zoomScale * pixelRatio;
    const immediateCached = source.hasBitmap({ slideIndex, renderScale });
    setRenderState("rendering");

    const start = () => {
      if (isProjectedLive && !isProjectedLive()) return;
      const startedAt = now();
      const startedCached = source.hasBitmap({ slideIndex, renderScale });
      source
        .renderSlide({
          slideIndex,
          canvas,
          renderScale,
          isLive: () => !cancelled,
          priority,
        })
        .then((result) => {
          if (cancelled || (isProjectedLive && !isProjectedLive())) return;
          notifySlideRenderTiming(getSlideRenderTiming?.(), {
            cached: startedCached,
            durationMs: now() - startedAt,
            pixelRatio,
            renderScale,
            slideNumber: slideIndex + 1,
            status: result.status,
          });
          if (result.status === "cancelled") return;
          setRenderState(result.status === "failed" ? "failed" : "rendered");
        })
        .catch(() => {
          if (cancelled || (isProjectedLive && !isProjectedLive())) return;
          notifySlideRenderTiming(getSlideRenderTiming?.(), {
            cached: startedCached,
            durationMs: now() - startedAt,
            pixelRatio,
            renderScale,
            slideNumber: slideIndex + 1,
            status: "failed",
          });
          setRenderState("failed");
        });
    };

    if (
      shouldRenderImmediately ||
      eager ||
      immediateCached ||
      !activity.isScrolling()
    ) {
      start();
      return () => {
        cancelled = true;
      };
    }

    const off = activity.onIdle(() => {
      if (!cancelled && (!isProjectedLive || isProjectedLive())) start();
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [
    activity,
    eager,
    getSlideRenderTiming,
    isProjectedLive,
    pixelRatio,
    priority,
    shouldRenderImmediately,
    zoomScale,
    slideIndex,
    source,
  ]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ width: slideSize.width, height: slideSize.height }}
        className="block h-full w-full bg-white"
      />
      {renderState === "failed" ? (
        <div className="bg-muted text-muted-foreground absolute inset-0 flex items-center justify-center p-4 text-center text-xs">
          Couldn&apos;t render slide {slideIndex + 1}.
        </div>
      ) : null}
      {renderState !== "rendered" && renderState !== "failed" ? (
        <Skeleton className="pointer-events-none absolute inset-0 rounded-none" />
      ) : null}
    </>
  );
}

function notifySlideRenderTiming(
  callback: ((timing: PptxSlideRenderTiming) => void) | undefined,
  timing: PptxSlideRenderTiming,
) {
  try {
    callback?.(timing);
  } catch {
    /* Instrumentation callbacks must not affect slide rendering. */
  }
}

function now() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

type PptxSlideProjectionCache = {
  resetKey: string;
  slides: Map<number, PptxProjectedSlide>;
};

type PptxProjectedSlide = {
  activity: PptxScrollActivity | null;
  isLive: boolean;
  onSlideRenderTiming:
    | ((timing: PptxSlideRenderTiming) => void)
    | null
    | undefined;
  renderSlideOverlay:
    | ((props: PptxSlideOverlayProps) => React.ReactNode)
    | null
    | undefined;
  renderKey: string;
  root: Root;
  shell: HTMLElement;
  source: PptxSource | null;
};

const pptxProjectionSourceKeys = new WeakMap<PptxSource, number>();
let nextPptxProjectionSourceKey = 1;

function projectPptxSlides({
  activity,
  cache,
  canvas,
  eager,
  layout,
  onSlideRenderTiming,
  renderSlideOverlay,
  resetKey,
  rotation,
  source,
  viewport,
  zoomScale,
}: {
  activity: PptxScrollActivity;
  cache: PptxSlideProjectionCache;
  canvas: HTMLDivElement | null;
  eager: boolean;
  layout: PptxSlideLayout;
  onSlideRenderTiming?: (timing: PptxSlideRenderTiming) => void;
  renderSlideOverlay?: (props: PptxSlideOverlayProps) => React.ReactNode;
  resetKey: string;
  rotation: number;
  source: PptxSource;
  viewport: HTMLDivElement | null;
  zoomScale: number;
}) {
  if (!canvas) return;

  const sourceKey = getPptxProjectionSourceKey(source);
  setPptxPixelStyle(canvas, "height", layout.totalHeight);
  setPptxPixelStyle(canvas, "min-width", layout.slideWidth);

  if (cache.resetKey !== `${sourceKey}:${resetKey}`) {
    disposePptxSlideProjectionCache(cache);
    cache.resetKey = `${sourceKey}:${resetKey}`;
  }

  const scrollTop = viewport?.scrollTop ?? 0;
  const viewportHeight =
    viewport?.clientHeight || viewport?.getBoundingClientRect().height || 0;
  const virtualSlides = getPptxVirtualSlides({
    layout,
    overscanSlides: PPTX_SLIDE_OVERSCAN,
    scrollTop,
    viewportHeight,
  });
  const visibleSlideIndexes = new Set(
    virtualSlides.map((virtualSlide) => virtualSlide.index),
  );

  for (const [slideIndex, projectedSlide] of cache.slides) {
    if (visibleSlideIndexes.has(slideIndex)) continue;
    disposePptxProjectedSlide(projectedSlide);
    cache.slides.delete(slideIndex);
  }

  let previousShell: HTMLElement | null = null;
  for (const virtualSlide of virtualSlides) {
    const projectedSlide =
      cache.slides.get(virtualSlide.index) ??
      createPptxProjectedSlide(virtualSlide);
    patchPptxProjectedSlide(projectedSlide.shell, virtualSlide);
    renderPptxProjectedSlide({
      activity,
      eager,
      onSlideRenderTiming,
      projectedSlide,
      priority: getPptxSlideRenderPriority({
        layout,
        scrollTop,
        viewportHeight,
        virtualSlide,
      }),
      renderSlideOverlay,
      rotation,
      source,
      virtualSlide,
      zoomScale,
    });
    cache.slides.set(virtualSlide.index, projectedSlide);
    placePptxProjectedSlide(canvas, projectedSlide.shell, previousShell);
    previousShell = projectedSlide.shell;
  }
}

function createPptxProjectedSlide(virtualSlide: PptxVirtualSlide) {
  const shell = document.createElement("div");
  shell.className = "absolute top-0 left-1/2";
  shell.dataset.slot = "pptx-slide-slot";
  shell.dataset.virtualSlideNumber = String(virtualSlide.slideNumber);
  return {
    activity: null,
    isLive: true,
    onSlideRenderTiming: null,
    renderSlideOverlay: null,
    renderKey: "",
    root: createRoot(shell),
    shell,
    source: null,
  };
}

function patchPptxProjectedSlide(
  shell: HTMLElement,
  virtualSlide: PptxVirtualSlide,
) {
  setPptxStyle(shell, "transform", `translate(-50%, ${virtualSlide.top}px)`);
  setPptxPixelStyle(shell, "width", virtualSlide.width);
  setPptxPixelStyle(shell, "height", virtualSlide.height);
}

function placePptxProjectedSlide(
  canvas: HTMLElement,
  shell: HTMLElement,
  previousShell: HTMLElement | null,
) {
  const nextSibling = previousShell
    ? previousShell.nextSibling
    : canvas.firstChild;
  if (shell === nextSibling) return;
  canvas.insertBefore(shell, nextSibling);
}

function setPptxPixelStyle(
  element: HTMLElement,
  property: "height" | "min-width" | "width",
  value: number,
) {
  setPptxStyle(element, property, `${value}px`);
}

function setPptxStyle(
  element: HTMLElement,
  property: "height" | "min-width" | "transform" | "width",
  value: string,
) {
  if (element.style.getPropertyValue(property) === value) return;
  element.style.setProperty(property, value);
}

function renderPptxProjectedSlide({
  activity,
  eager,
  onSlideRenderTiming,
  projectedSlide,
  priority,
  renderSlideOverlay,
  rotation,
  source,
  virtualSlide,
  zoomScale,
}: {
  activity: PptxScrollActivity;
  eager: boolean;
  onSlideRenderTiming?: (timing: PptxSlideRenderTiming) => void;
  projectedSlide: PptxProjectedSlide;
  priority: PptxSlideRenderPriority;
  renderSlideOverlay?: (props: PptxSlideOverlayProps) => React.ReactNode;
  rotation: number;
  source: PptxSource;
  virtualSlide: PptxVirtualSlide;
  zoomScale: number;
}) {
  const renderKey = [
    virtualSlide.index,
    getPptxProjectionSourceKey(source),
    source.baseSize.width,
    source.baseSize.height,
    zoomScale,
    rotation,
    eager,
    priority.isCurrentSlide,
    priority.isInViewport,
  ].join("\u0000");
  const shouldRender =
    projectedSlide.renderKey !== renderKey ||
    projectedSlide.source !== source ||
    projectedSlide.activity !== activity ||
    projectedSlide.renderSlideOverlay !== renderSlideOverlay;

  projectedSlide.onSlideRenderTiming = onSlideRenderTiming;

  if (!shouldRender) {
    return;
  }

  projectedSlide.renderKey = renderKey;
  projectedSlide.source = source;
  projectedSlide.activity = activity;
  projectedSlide.renderSlideOverlay = renderSlideOverlay;
  projectedSlide.root.render(
    <PptxSlideFrame
      source={source}
      slideIndex={virtualSlide.index}
      zoomScale={zoomScale}
      rotation={rotation}
      eager={eager}
      activity={activity}
      renderSlideOverlay={renderSlideOverlay}
      getSlideRenderTiming={() =>
        projectedSlide.onSlideRenderTiming ?? undefined
      }
      isProjectedLive={() => projectedSlide.isLive}
      priority={priority}
      shouldRenderImmediately={priority.isCurrentSlide || priority.isInViewport}
    />,
  );
}

function getPptxSlideRenderPriority({
  layout,
  scrollTop,
  viewportHeight,
  virtualSlide,
}: {
  layout: PptxSlideLayout;
  scrollTop: number;
  viewportHeight: number;
  virtualSlide: PptxVirtualSlide;
}): PptxSlideRenderPriority {
  const safeScrollTop =
    Number.isFinite(scrollTop) && scrollTop > 0 ? scrollTop : 0;
  const safeViewportHeight =
    Number.isFinite(viewportHeight) && viewportHeight > 0
      ? viewportHeight
      : layout.slideHeight;
  const marker = safeScrollTop + safeViewportHeight * PPTX_READING_MARKER_RATIO;
  const slideTop = virtualSlide.top;
  const slideBottom = slideTop + virtualSlide.height;
  const viewportBottom = safeScrollTop + safeViewportHeight;

  return {
    distanceFromReadingMarker: Math.abs(
      slideTop + virtualSlide.height / 2 - marker,
    ),
    isCurrentSlide: marker >= slideTop && marker < slideBottom,
    isInViewport: slideBottom > safeScrollTop && slideTop < viewportBottom,
  };
}

function disposePptxSlideProjectionCache(cache: PptxSlideProjectionCache) {
  for (const projectedSlide of cache.slides.values()) {
    disposePptxProjectedSlide(projectedSlide);
  }
  cache.slides.clear();
}

function disposePptxProjectedSlide(projectedSlide: PptxProjectedSlide) {
  projectedSlide.isLive = false;
  deferPptxRootUnmount(projectedSlide.root);
  projectedSlide.shell.remove();
}

function deferPptxRootUnmount(root: Root) {
  const unmount = () => root.unmount();
  if (typeof queueMicrotask === "function") {
    queueMicrotask(unmount);
    return;
  }
  window.setTimeout(unmount, 0);
}

function assignPptxRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  ref.current = value;
}

function getPptxProjectionSourceKey(source: PptxSource) {
  const existingKey = pptxProjectionSourceKeys.get(source);
  if (existingKey) return existingKey;
  const key = nextPptxProjectionSourceKey;
  nextPptxProjectionSourceKey += 1;
  pptxProjectionSourceKeys.set(source, key);
  return key;
}

function PptxSlideOverlay({
  slideNumber,
  visibleSize,
  zoomScale,
  rotation,
  renderSlideOverlay,
}: {
  slideNumber: number;
  visibleSize: PptxSize;
  zoomScale: number;
  rotation: number;
  renderSlideOverlay: (props: PptxSlideOverlayProps) => React.ReactNode;
}) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {renderSlideOverlay({
        slideNumber,
        width: visibleSize.width,
        height: visibleSize.height,
        scale: zoomScale,
        rotation,
      })}
    </div>
  );
}
