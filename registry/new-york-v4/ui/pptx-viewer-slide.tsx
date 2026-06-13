"use client"

import * as React from "react"
import { createRoot, type Root } from "react-dom/client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

import {
  getScaledSlideSize,
  getVisibleSlideSize,
  type PptxSize,
  type PptxSlideOverlayProps,
  type PptxSlideRenderTiming,
} from "./pptx-viewer-core"
import { type PptxScrollActivity } from "./pptx-viewer-scroll"
import { type PptxSource } from "./pptx-viewer-source"
import {
  createPptxSlideLayout,
  getPptxVirtualSlides,
  type PptxSlideLayout,
  type PptxVirtualSlide,
} from "./pptx-viewer-visible-slide"

type SlideRenderState = "idle" | "rendering" | "rendered" | "failed"

export const PPTX_SLIDE_GAP = 16
export const PPTX_SLIDE_PADDING = 16
const PPTX_SLIDE_OVERSCAN = 2

export interface PptxSlideScrollerProps {
  source: PptxSource
  zoomScale: number
  rotation: number
  layout?: PptxSlideLayout
  eager: boolean
  activity: PptxScrollActivity
  renderSlideOverlay?: (props: PptxSlideOverlayProps) => React.ReactNode
  onSlideRenderTiming?: (timing: PptxSlideRenderTiming) => void
  containerRef: React.Ref<HTMLDivElement>
  viewportRef: React.Ref<HTMLDivElement>
  onScroll: () => void
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
    [providedLayout, rotation, source.baseSize, source.slideCount, zoomScale]
  )
  const canvasRef = React.useRef<HTMLDivElement | null>(null)
  const projectionFrameRef = React.useRef<number | null>(null)
  const projectionCacheRef = React.useRef<PptxSlideProjectionCache>({
    resetKey: "",
    slides: new Map(),
  })
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null)
  const layoutResetKey = `${layout.slideCount}:${layout.slideWidth}:${layout.slideHeight}:${layout.slideStride}:${layout.totalHeight}:${zoomScale}:${rotation}`

  const projectSlides = React.useCallback(() => {
    projectionFrameRef.current = null
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
    })
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
  ])

  const scheduleProjectSlides = React.useCallback(() => {
    if (projectionFrameRef.current !== null) return
    if (typeof requestAnimationFrame !== "function") {
      projectSlides()
      return
    }
    projectionFrameRef.current = requestAnimationFrame(projectSlides)
  }, [projectSlides])

  React.useLayoutEffect(() => {
    projectSlides()
  }, [projectSlides])

  React.useEffect(
    () => () => {
      if (
        projectionFrameRef.current !== null &&
        typeof cancelAnimationFrame === "function"
      ) {
        cancelAnimationFrame(projectionFrameRef.current)
      }
      disposePptxSlideProjectionCache(projectionCacheRef.current)
    },
    []
  )

  const setViewportRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      viewportElementRef.current = element
      assignPptxRef(viewportRef, element)
      projectSlides()
    },
    [projectSlides, viewportRef]
  )

  const setCanvasRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      canvasRef.current = element
      assignPptxRef(containerRef, element)
      projectSlides()
    },
    [containerRef, projectSlides]
  )

  const handleScroll = React.useCallback(() => {
    onScroll()
    scheduleProjectSlides()
  }, [onScroll, scheduleProjectSlides])

  return (
    <ScrollArea
      className="min-h-0 flex-1"
      viewportRef={setViewportRef}
      viewportProps={{ onScroll: handleScroll }}
    >
      <div
        ref={setCanvasRef}
        className="relative mx-auto min-w-0"
        data-slot="pptx-slide-virtual-canvas"
      />
    </ScrollArea>
  )
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
}: {
  source: PptxSource
  slideIndex: number
  zoomScale: number
  rotation: number
  eager: boolean
  activity: PptxScrollActivity
  renderSlideOverlay?: (props: PptxSlideOverlayProps) => React.ReactNode
  getSlideRenderTiming?: () =>
    | ((timing: PptxSlideRenderTiming) => void)
    | undefined
  isProjectedLive?: () => boolean
}) {
  const slideSize = getScaledSlideSize(source.baseSize, zoomScale)
  const visibleSize = getVisibleSlideSize(slideSize, rotation)

  return (
    <div
      className="relative shadow-sm ring-1 ring-border"
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
  )
}

function PptxSlideCanvas({
  source,
  slideIndex,
  zoomScale,
  eager,
  activity,
  getSlideRenderTiming,
  isProjectedLive,
}: {
  source: PptxSource
  slideIndex: number
  zoomScale: number
  eager: boolean
  activity: PptxScrollActivity
  getSlideRenderTiming?: () =>
    | ((timing: PptxSlideRenderTiming) => void)
    | undefined
  isProjectedLive?: () => boolean
}) {
  const rawDpr = typeof window !== "undefined" ? window.devicePixelRatio : 1
  const dpr = Number.isFinite(rawDpr) && rawDpr > 0 ? rawDpr : 1
  const slideSize = getScaledSlideSize(source.baseSize, zoomScale)
  const [renderState, setRenderState] = React.useState<SlideRenderState>("idle")

  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      let cancelled = false
      const renderScale = zoomScale * dpr
      const immediateCached = source.hasBitmap({ slideIndex, renderScale })
      setRenderState("rendering")

      const start = () => {
        if (isProjectedLive && !isProjectedLive()) return
        const startedAt = now()
        const startedCached = source.hasBitmap({ slideIndex, renderScale })
        source
          .renderSlide({
            slideIndex,
            canvas,
            renderScale,
            isLive: () => !cancelled,
          })
          .then((result) => {
            if (cancelled || (isProjectedLive && !isProjectedLive())) return
            notifySlideRenderTiming(getSlideRenderTiming?.(), {
              cached: startedCached,
              durationMs: now() - startedAt,
              renderScale,
              slideNumber: slideIndex + 1,
              status: result.status,
            })
            if (result.status === "cancelled") return
            setRenderState(result.status === "failed" ? "failed" : "rendered")
          })
          .catch(() => {
            if (cancelled || (isProjectedLive && !isProjectedLive())) return
            notifySlideRenderTiming(getSlideRenderTiming?.(), {
              cached: startedCached,
              durationMs: now() - startedAt,
              renderScale,
              slideNumber: slideIndex + 1,
              status: "failed",
            })
            setRenderState("failed")
          })
      }

      if (eager || immediateCached || !activity.isScrolling()) {
        start()
        return () => {
          cancelled = true
        }
      }

      const off = activity.onIdle(() => {
        if (!cancelled && (!isProjectedLive || isProjectedLive())) start()
      })
      return () => {
        cancelled = true
        off()
      }
    },
    [
      activity,
      dpr,
      eager,
      getSlideRenderTiming,
      isProjectedLive,
      zoomScale,
      slideIndex,
      source,
    ]
  )

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ width: slideSize.width, height: slideSize.height }}
        className="block h-full w-full bg-white"
      />
      {renderState === "failed" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted p-4 text-center text-xs text-muted-foreground">
          Couldn&apos;t render slide {slideIndex + 1}.
        </div>
      ) : null}
      {renderState !== "rendered" && renderState !== "failed" ? (
        <Skeleton className="pointer-events-none absolute inset-0 rounded-none" />
      ) : null}
    </>
  )
}

function notifySlideRenderTiming(
  callback: ((timing: PptxSlideRenderTiming) => void) | undefined,
  timing: PptxSlideRenderTiming
) {
  try {
    callback?.(timing)
  } catch {
    /* Instrumentation callbacks must not affect slide rendering. */
  }
}

function now() {
  return typeof performance === "undefined" ? Date.now() : performance.now()
}

type PptxSlideProjectionCache = {
  resetKey: string
  slides: Map<number, PptxProjectedSlide>
}

type PptxProjectedSlide = {
  activity: PptxScrollActivity | null
  isLive: boolean
  onSlideRenderTiming:
    | ((timing: PptxSlideRenderTiming) => void)
    | null
    | undefined
  renderSlideOverlay:
    | ((props: PptxSlideOverlayProps) => React.ReactNode)
    | null
    | undefined
  renderKey: string
  root: Root
  shell: HTMLElement
  source: PptxSource | null
}

const pptxProjectionSourceKeys = new WeakMap<PptxSource, number>()
let nextPptxProjectionSourceKey = 1

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
  activity: PptxScrollActivity
  cache: PptxSlideProjectionCache
  canvas: HTMLDivElement | null
  eager: boolean
  layout: PptxSlideLayout
  onSlideRenderTiming?: (timing: PptxSlideRenderTiming) => void
  renderSlideOverlay?: (props: PptxSlideOverlayProps) => React.ReactNode
  resetKey: string
  rotation: number
  source: PptxSource
  viewport: HTMLDivElement | null
  zoomScale: number
}) {
  if (!canvas) return

  const sourceKey = getPptxProjectionSourceKey(source)
  canvas.style.height = `${layout.totalHeight}px`
  canvas.style.minWidth = `${layout.slideWidth}px`

  if (cache.resetKey !== `${sourceKey}:${resetKey}`) {
    disposePptxSlideProjectionCache(cache)
    cache.resetKey = `${sourceKey}:${resetKey}`
  }

  const virtualSlides = getPptxVirtualSlides({
    layout,
    overscanSlides: PPTX_SLIDE_OVERSCAN,
    scrollTop: viewport?.scrollTop ?? 0,
    viewportHeight:
      viewport?.clientHeight || viewport?.getBoundingClientRect().height || 0,
  })
  const visibleSlideIndexes = new Set(
    virtualSlides.map((virtualSlide) => virtualSlide.index)
  )

  for (const [slideIndex, projectedSlide] of cache.slides) {
    if (visibleSlideIndexes.has(slideIndex)) continue
    disposePptxProjectedSlide(projectedSlide)
    cache.slides.delete(slideIndex)
  }

  for (const virtualSlide of virtualSlides) {
    const projectedSlide =
      cache.slides.get(virtualSlide.index) ??
      createPptxProjectedSlide(virtualSlide)
    patchPptxProjectedSlide(projectedSlide.shell, virtualSlide)
    renderPptxProjectedSlide({
      activity,
      eager,
      onSlideRenderTiming,
      projectedSlide,
      renderSlideOverlay,
      rotation,
      source,
      virtualSlide,
      zoomScale,
    })
    cache.slides.set(virtualSlide.index, projectedSlide)
    canvas.append(projectedSlide.shell)
  }
}

function createPptxProjectedSlide(virtualSlide: PptxVirtualSlide) {
  const shell = document.createElement("div")
  shell.className = "absolute left-1/2 -translate-x-1/2"
  shell.dataset.slot = "pptx-slide-slot"
  shell.dataset.virtualSlideNumber = String(virtualSlide.slideNumber)
  return {
    activity: null,
    isLive: true,
    onSlideRenderTiming: null,
    renderSlideOverlay: null,
    renderKey: "",
    root: createRoot(shell),
    shell,
    source: null,
  }
}

function patchPptxProjectedSlide(
  shell: HTMLElement,
  virtualSlide: PptxVirtualSlide
) {
  shell.style.top = `${virtualSlide.top}px`
  shell.style.width = `${virtualSlide.width}px`
  shell.style.height = `${virtualSlide.height}px`
}

function renderPptxProjectedSlide({
  activity,
  eager,
  onSlideRenderTiming,
  projectedSlide,
  renderSlideOverlay,
  rotation,
  source,
  virtualSlide,
  zoomScale,
}: {
  activity: PptxScrollActivity
  eager: boolean
  onSlideRenderTiming?: (timing: PptxSlideRenderTiming) => void
  projectedSlide: PptxProjectedSlide
  renderSlideOverlay?: (props: PptxSlideOverlayProps) => React.ReactNode
  rotation: number
  source: PptxSource
  virtualSlide: PptxVirtualSlide
  zoomScale: number
}) {
  const renderKey = [
    virtualSlide.index,
    getPptxProjectionSourceKey(source),
    source.baseSize.width,
    source.baseSize.height,
    zoomScale,
    rotation,
    eager,
  ].join("\u0000")
  const shouldRender =
    projectedSlide.renderKey !== renderKey ||
    projectedSlide.source !== source ||
    projectedSlide.activity !== activity ||
    projectedSlide.renderSlideOverlay !== renderSlideOverlay

  projectedSlide.onSlideRenderTiming = onSlideRenderTiming

  if (!shouldRender) {
    return
  }

  projectedSlide.renderKey = renderKey
  projectedSlide.source = source
  projectedSlide.activity = activity
  projectedSlide.renderSlideOverlay = renderSlideOverlay
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
    />
  )
}

function disposePptxSlideProjectionCache(cache: PptxSlideProjectionCache) {
  for (const projectedSlide of cache.slides.values()) {
    disposePptxProjectedSlide(projectedSlide)
  }
  cache.slides.clear()
}

function disposePptxProjectedSlide(projectedSlide: PptxProjectedSlide) {
  projectedSlide.isLive = false
  deferPptxRootUnmount(projectedSlide.root)
  projectedSlide.shell.remove()
}

function deferPptxRootUnmount(root: Root) {
  const unmount = () => root.unmount()
  if (typeof queueMicrotask === "function") {
    queueMicrotask(unmount)
    return
  }
  window.setTimeout(unmount, 0)
}

function assignPptxRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return
  if (typeof ref === "function") {
    ref(value)
    return
  }
  ref.current = value
}

function getPptxProjectionSourceKey(source: PptxSource) {
  const existingKey = pptxProjectionSourceKeys.get(source)
  if (existingKey) return existingKey
  const key = nextPptxProjectionSourceKey
  nextPptxProjectionSourceKey += 1
  pptxProjectionSourceKeys.set(source, key)
  return key
}

function PptxSlideOverlay({
  slideNumber,
  visibleSize,
  zoomScale,
  rotation,
  renderSlideOverlay,
}: {
  slideNumber: number
  visibleSize: PptxSize
  zoomScale: number
  rotation: number
  renderSlideOverlay: (props: PptxSlideOverlayProps) => React.ReactNode
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
  )
}
