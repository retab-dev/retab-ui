"use client";

import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { useMountEffect } from "@/hooks/use-mount-effect";

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
  getPptxRenderedSlideWindow,
  getPptxRenderSlides,
  getPptxSlideTop,
  readPptxScrollMetrics,
  PPTX_READING_MARKER_RATIO,
  PPTX_RENDER_WINDOW_OVERSCAN_PX,
  type PptxSlideLayout,
  type PptxScrollMetrics,
  type PptxVirtualSlide,
} from "./pptx-viewer-visible-slide";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";

type SlideRenderState = "idle" | "rendering" | "rendered" | "failed";
type PptxScrollDirection = -1 | 0 | 1;

export const PPTX_SLIDE_GAP = 16;
export const PPTX_SLIDE_PADDING = 16;
const PPTX_TRANSITION_WINDOW_RELEASE_MS = 260;
const PPTX_UPWARD_SCROLL_LEAD_PX = PPTX_RENDER_WINDOW_OVERSCAN_PX;

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
  documentSurfaceRef?: React.Ref<HTMLDivElement>;
  viewportRef: React.Ref<HTMLDivElement>;
  getScrollMetrics?: () => PptxScrollMetrics;
  isTransitioning?: boolean;
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
  documentSurfaceRef,
  viewportRef,
  getScrollMetrics,
  isTransitioning = false,
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
    canvas: null,
    hasMeasuredScroll: false,
    lastScrollDirection: 0,
    lastScrollTop: 0,
    resetKey: "",
    slides: new Map(),
    window: null,
  });
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null);
  const projectSlidesRef = React.useRef<() => void>(() => {});
  const isTransitioningRef = React.useRef(isTransitioning);
  const transitionWindowReleaseTimerRef = React.useRef<number | null>(null);
  isTransitioningRef.current = isTransitioning;
  const layoutResetKey = `${layout.slideCount}:${layout.slideWidth}:${layout.slideHeight}:${layout.slideStride}:${layout.totalHeight}:${zoomScale}:${rotation}`;

  const projectSlides = React.useCallback(() => {
    projectionFrameRef.current = null;
    const result = projectPptxSlides({
      activity,
      cache: projectionCacheRef.current,
      canvas: canvasRef.current,
      eager,
      getScrollMetrics,
      isTransitioning: isTransitioningRef.current,
      layout,
      onSlideRenderTiming,
      renderSlideOverlay,
      resetKey: layoutResetKey,
      rotation,
      source,
      viewport: viewportElementRef.current,
      zoomScale,
    });
    if (
      result.fillOverscanNextFrame &&
      projectionFrameRef.current === null &&
      typeof requestAnimationFrame === "function"
    ) {
      projectionFrameRef.current = requestAnimationFrame(() =>
        projectSlidesRef.current(),
      );
    }
  }, [
    activity,
    eager,
    getScrollMetrics,
    layout,
    layoutResetKey,
    onSlideRenderTiming,
    renderSlideOverlay,
    rotation,
    source,
    zoomScale,
  ]);
  projectSlidesRef.current = projectSlides;

  const scheduleProjectSlides = React.useCallback(() => {
    if (projectionFrameRef.current !== null) return;
    if (typeof requestAnimationFrame !== "function") {
      projectSlides();
      return;
    }
    projectionFrameRef.current = requestAnimationFrame(projectSlides);
  }, [projectSlides]);

  useKeyedLayoutEffect(joinEffectKey([projectSlides]), () => {
    projectSlides();
  });

  const clearTransitionWindowReleaseTimer = React.useCallback(() => {
    if (transitionWindowReleaseTimerRef.current === null) return;
    window.clearTimeout(transitionWindowReleaseTimerRef.current);
    transitionWindowReleaseTimerRef.current = null;
  }, []);

  // The sidebar slide freezes the visible-slide window (see projectPptxSlides).
  // Once the motion settles — scroll rebased to the re-fit layout — re-derive the
  // window after the sampled motion window, so cleanup never reads as motion
  // churn.
  useKeyedLayoutEffect(
    joinEffectKey(["pptx-transition", isTransitioning]),
    () => {
      clearTransitionWindowReleaseTimer();
      if (isTransitioning) return;

      transitionWindowReleaseTimerRef.current = window.setTimeout(() => {
        transitionWindowReleaseTimerRef.current = null;
        projectSlidesRef.current();
      }, PPTX_TRANSITION_WINDOW_RELEASE_MS);
    },
  );

  useMountEffect(() => () => {
    if (
      projectionFrameRef.current !== null &&
      typeof cancelAnimationFrame === "function"
    ) {
      cancelAnimationFrame(projectionFrameRef.current);
    }
    clearTransitionWindowReleaseTimer();
    disposePptxSlideProjectionCache(projectionCacheRef.current);
  });

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
        style={{ overflowAnchor: "none" }}
      >
        <div
          ref={documentSurfaceRef}
          className="relative mx-auto min-w-0"
          data-slot="pptx-viewer-document-surface"
          style={{
            contain: "layout style",
            minWidth: layout.slideWidth,
            width: layout.slideWidth,
          }}
        >
          <div
            ref={setCanvasRef}
            className="relative h-full w-full"
            data-slot="pptx-slide-virtual-canvas"
          />
        </div>
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

  useKeyedLayoutEffect(
    joinEffectKey([
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
    ]),
    () => {
      const canvas = canvasElementRef.current;
      if (!canvas) return;

      let cancelled = false;
      const renderScale = zoomScale * pixelRatio;
      if (isProjectedLive && !isProjectedLive()) return;

      const cachedResult = source.drawCachedBitmap({
        canvas,
        renderScale,
        slideIndex,
      });
      if (cachedResult) {
        notifySlideRenderTiming(getSlideRenderTiming?.(), {
          cached: true,
          durationMs: 0,
          pixelRatio,
          renderScale,
          slideNumber: slideIndex + 1,
          status: cachedResult.status,
        });
        if (cachedResult.status !== "cancelled") {
          setRenderState(
            cachedResult.status === "failed" ? "failed" : "rendered",
          );
        }
        return () => {
          cancelled = true;
        };
      }

      setRenderState("rendering");

      const start = () => {
        if (isProjectedLive && !isProjectedLive()) return;
        const startedAt = now();
        const startedCached = source.hasBitmap({ slideIndex, renderScale });
        const cachedResult = source.drawCachedBitmap({
          canvas,
          renderScale,
          slideIndex,
        });
        if (cachedResult) {
          notifySlideRenderTiming(getSlideRenderTiming?.(), {
            cached: true,
            durationMs: now() - startedAt,
            pixelRatio,
            renderScale,
            slideNumber: slideIndex + 1,
            status: cachedResult.status,
          });
          if (cachedResult.status !== "cancelled") {
            setRenderState(
              cachedResult.status === "failed" ? "failed" : "rendered",
            );
          }
          return;
        }
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

      if (shouldRenderImmediately || eager || !activity.isScrolling()) {
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
    },
  );

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
  canvas: HTMLDivElement | null;
  hasMeasuredScroll: boolean;
  lastScrollDirection: PptxScrollDirection;
  lastScrollTop: number;
  resetKey: string;
  slides: Map<number, PptxProjectedSlide>;
  window: PptxSlideProjectionWindow | null;
};

type PptxSlideProjectionResult = {
  fillOverscanNextFrame: boolean;
};

type PptxSlideProjectionWindow = {
  after: HTMLDivElement;
  before: HTMLDivElement;
  content: HTMLDivElement;
  sticky: HTMLDivElement;
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
  getScrollMetrics,
  isTransitioning,
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
  getScrollMetrics?: () => PptxScrollMetrics;
  isTransitioning: boolean;
  layout: PptxSlideLayout;
  onSlideRenderTiming?: (timing: PptxSlideRenderTiming) => void;
  renderSlideOverlay?: (props: PptxSlideOverlayProps) => React.ReactNode;
  resetKey: string;
  rotation: number;
  source: PptxSource;
  viewport: HTMLDivElement | null;
  zoomScale: number;
}): PptxSlideProjectionResult {
  if (!canvas) return { fillOverscanNextFrame: false };

  if (cache.canvas !== canvas) {
    disposePptxSlideProjectionCache(cache);
    cache.canvas = canvas;
  }

  const sourceKey = getPptxProjectionSourceKey(source);
  const nextResetKey = `${sourceKey}:${resetKey}`;

  // Slides mounted before the sidebar motion began. Held for the duration of the
  // transition so the fit-width re-fit — which shifts the scroll model under the
  // reader before the shell rebases it — can't churn the reading slide out of the
  // mounted set. While transitioning, use this exact set: unioning with the new
  // live window introduces add/remove churn in the sampled motion window.
  const heldSlideIndexes =
    isTransitioning && cache.slides.size > 0 ? [...cache.slides.keys()] : [];
  const isHoldingTransitionWindow = heldSlideIndexes.length > 0;

  if (cache.resetKey !== nextResetKey) {
    // The fit-width re-fit changes zoomScale (part of the reset key), but the
    // mounted slides stay valid — only their size/position changes, re-patched
    // below. Disposing mid-transition would tear down and remount the reading
    // slide, defeating the hold; keep the cache and adopt the new key in place.
    if (heldSlideIndexes.length === 0) {
      disposePptxSlideProjectionCache(cache);
    }
    cache.resetKey = nextResetKey;
  }

  const viewportHeight =
    viewport?.clientHeight || viewport?.getBoundingClientRect().height || 0;
  const metrics =
    getScrollMetrics?.() ??
    readPptxScrollMetrics({
      scrollPageOffset: 0,
      totalHeight: layout.totalHeight,
      viewportElement: viewport,
    });
  const measuredScrollDirection = getPptxScrollDirection({
    canMeasureDirection: cache.hasMeasuredScroll,
    previousScrollTop: cache.lastScrollTop,
    scrollTop: metrics.scrollTop,
  });
  const scrollDirection =
    measuredScrollDirection === 0
      ? cache.lastScrollDirection
      : measuredScrollDirection;
  if (measuredScrollDirection !== 0) {
    cache.lastScrollDirection = measuredScrollDirection;
  }
  const fitPerfectly = shouldFitPptxPerfectly({
    canFitPerfectly: cache.hasMeasuredScroll,
    previousScrollTop: cache.lastScrollTop,
    scrollTop: metrics.scrollTop,
    viewportHeight: metrics.viewportHeight,
  });
  cache.hasMeasuredScroll = true;
  cache.lastScrollTop = metrics.scrollTop;

  setPptxStyle(canvas, "contain", "layout style");
  setPptxPixelStyle(canvas, "height", metrics.physicalScrollHeight);
  setPptxPixelStyle(canvas, "min-width", layout.slideWidth);
  setPptxPixelStyle(canvas, "width", layout.slideWidth);

  const liveSlides = getPptxRenderSlides({
    fitPerfectly,
    layout,
    scrollTop: metrics.scrollTop,
    viewportHeight: metrics.viewportHeight || viewportHeight,
  });
  const liveSlideIndexes = new Set(
    liveSlides.map((virtualSlide) => virtualSlide.index),
  );
  // Held slides are kept mounted for continuity but must not re-raster: they
  // retain their existing bitmap (rendered at the pre-motion scale) and are
  // disposed once the delayed transition release runs.
  const heldOnlyIndexes = new Set(
    isHoldingTransitionWindow
      ? heldSlideIndexes
      : heldSlideIndexes.filter((index) => !liveSlideIndexes.has(index)),
  );
  const virtualSlides = isHoldingTransitionWindow
    ? getHeldPptxVirtualSlides(heldSlideIndexes, layout)
    : unionPptxVirtualSlides(liveSlides, heldSlideIndexes, layout);
  const renderedWindow = getPptxRenderedSlideWindow({
    layout,
    physicalScrollHeight: metrics.physicalScrollHeight,
    scrollPageOffset: metrics.scrollPageOffset,
    slides: virtualSlides,
    viewportHeight: metrics.viewportHeight || viewportHeight,
  });
  const visibleSlideIndexes = new Set(
    virtualSlides.map((virtualSlide) => virtualSlide.index),
  );
  const projectionWindow = ensurePptxProjectionWindow(cache, canvas);

  for (const [slideIndex, projectedSlide] of cache.slides) {
    if (visibleSlideIndexes.has(slideIndex)) continue;
    disposePptxProjectedSlide(projectedSlide);
    cache.slides.delete(slideIndex);
  }

  if (!renderedWindow) {
    syncPptxProjectionWindow(projectionWindow, {
      afterHeight: metrics.physicalScrollHeight,
      beforeHeight: 0,
      height: 0,
      stickyInset: 0,
    });
    return { fillOverscanNextFrame: fitPerfectly };
  }

  syncPptxProjectionWindow(projectionWindow, renderedWindow);

  let previousShell: HTMLElement | null = null;
  for (const virtualSlide of renderedWindow.slides) {
    const existingSlide = cache.slides.get(virtualSlide.index);
    const projectedSlide =
      existingSlide ?? createPptxProjectedSlide(virtualSlide);
    patchPptxProjectedSlide(projectedSlide.shell, virtualSlide);
    // A held-only slide that already has a bitmap keeps it: repositioned above
    // but not re-rendered, so the transition adds no raster work.
    const retainHeldRaster =
      heldOnlyIndexes.has(virtualSlide.index) &&
      existingSlide != null &&
      existingSlide.renderKey !== "";
    if (!retainHeldRaster) {
      renderPptxProjectedSlide({
        activity,
        eager,
        onSlideRenderTiming,
        projectedSlide,
        priority: getPptxSlideRenderPriority({
          layout,
          scrollDirection,
          scrollTop: metrics.scrollTop,
          viewportHeight: metrics.viewportHeight || viewportHeight,
          virtualSlide,
        }),
        renderSlideOverlay,
        rotation,
        source,
        virtualSlide,
        zoomScale,
      });
    }
    cache.slides.set(virtualSlide.index, projectedSlide);
    placePptxProjectedSlide(
      projectionWindow.content,
      projectedSlide.shell,
      previousShell,
    );
    previousShell = projectedSlide.shell;
  }

  return { fillOverscanNextFrame: fitPerfectly };
}

function unionPptxVirtualSlides(
  windowSlides: PptxVirtualSlide[],
  heldIndexes: number[],
  layout: PptxSlideLayout,
): PptxVirtualSlide[] {
  if (heldIndexes.length === 0) return windowSlides;

  const byIndex = new Map(windowSlides.map((slide) => [slide.index, slide]));
  for (const index of heldIndexes) {
    if (byIndex.has(index)) continue;
    if (index < 0 || index >= layout.slideCount) continue;
    const slideNumber = index + 1;
    byIndex.set(index, {
      height: layout.slideHeight,
      index,
      key: String(slideNumber),
      slideNumber,
      top: getPptxSlideTop(layout, index),
      width: layout.slideWidth,
    });
  }

  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

function getHeldPptxVirtualSlides(
  heldIndexes: number[],
  layout: PptxSlideLayout,
) {
  return unionPptxVirtualSlides([], heldIndexes, layout);
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
  virtualSlide: PptxVirtualSlide & { windowTop: number },
) {
  setPptxStyle(
    shell,
    "transform",
    `translate(-50%, ${virtualSlide.windowTop}px)`,
  );
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

function setPptxStyle(element: HTMLElement, property: string, value: string) {
  if (element.style.getPropertyValue(property) === value) return;
  element.style.setProperty(property, value);
}

function ensurePptxProjectionWindow(
  cache: PptxSlideProjectionCache,
  canvas: HTMLDivElement,
): PptxSlideProjectionWindow {
  const existing = cache.window;
  if (existing?.before.parentElement === canvas) return existing;

  const before = document.createElement("div");
  const sticky = document.createElement("div");
  const content = document.createElement("div");
  const after = document.createElement("div");

  before.dataset.slot = "pptx-slide-window-before";
  sticky.dataset.slot = "pptx-slide-sticky-window";
  content.dataset.slot = "pptx-slide-sticky-content";
  after.dataset.slot = "pptx-slide-window-after";

  before.style.contain = "layout size";
  sticky.style.position = "sticky";
  sticky.style.left = "0";
  sticky.style.width = "100%";
  sticky.style.overflow = "visible";
  sticky.style.contain = "layout style inline-size";
  sticky.style.isolation = "isolate";
  sticky.style.display = "flex";
  sticky.style.flexDirection = "column";
  content.style.position = "relative";
  content.style.width = "100%";
  after.style.contain = "layout size";

  sticky.append(content);
  canvas.replaceChildren(before, sticky, after);

  cache.window = { after, before, content, sticky };
  return cache.window;
}

function syncPptxProjectionWindow(
  projectionWindow: PptxSlideProjectionWindow,
  renderedWindow: {
    afterHeight: number;
    beforeHeight: number;
    height: number;
    stickyInset: number;
  },
) {
  setPptxPixelStyle(
    projectionWindow.before,
    "height",
    renderedWindow.beforeHeight,
  );
  setPptxStyle(
    projectionWindow.sticky,
    "top",
    `${renderedWindow.stickyInset}px`,
  );
  setPptxStyle(
    projectionWindow.sticky,
    "bottom",
    `${renderedWindow.stickyInset}px`,
  );
  setPptxPixelStyle(projectionWindow.sticky, "height", renderedWindow.height);
  setPptxPixelStyle(projectionWindow.content, "height", renderedWindow.height);
  setPptxPixelStyle(
    projectionWindow.after,
    "height",
    renderedWindow.afterHeight,
  );
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
    priority.isScrollLead,
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
      shouldRenderImmediately={
        priority.isCurrentSlide ||
        priority.isInViewport ||
        priority.isScrollLead
      }
    />,
  );
}

function getPptxSlideRenderPriority({
  layout,
  scrollDirection,
  scrollTop,
  viewportHeight,
  virtualSlide,
}: {
  layout: PptxSlideLayout;
  scrollDirection: PptxScrollDirection;
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
  const isInViewport = slideBottom > safeScrollTop && slideTop < viewportBottom;

  return {
    distanceFromReadingMarker: Math.abs(
      slideTop + virtualSlide.height / 2 - marker,
    ),
    isCurrentSlide: marker >= slideTop && marker < slideBottom,
    isInViewport,
    isScrollLead:
      scrollDirection < 0 &&
      !isInViewport &&
      slideTop < safeScrollTop &&
      slideBottom > safeScrollTop - PPTX_UPWARD_SCROLL_LEAD_PX,
  };
}

function getPptxScrollDirection({
  canMeasureDirection,
  previousScrollTop,
  scrollTop,
}: {
  canMeasureDirection: boolean;
  previousScrollTop: number;
  scrollTop: number;
}): PptxScrollDirection {
  if (!canMeasureDirection) return 0;
  const delta = scrollTop - previousScrollTop;
  if (delta < -1) return -1;
  if (delta > 1) return 1;
  return 0;
}

function disposePptxSlideProjectionCache(cache: PptxSlideProjectionCache) {
  for (const projectedSlide of cache.slides.values()) {
    disposePptxProjectedSlide(projectedSlide);
  }
  cache.slides.clear();
  cache.hasMeasuredScroll = false;
  cache.lastScrollDirection = 0;
  cache.lastScrollTop = 0;
  cache.window?.before.remove();
  cache.window?.sticky.remove();
  cache.window?.after.remove();
  cache.window = null;
}

function shouldFitPptxPerfectly({
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
      viewportHeight + PPTX_RENDER_WINDOW_OVERSCAN_PX * 2
  );
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
