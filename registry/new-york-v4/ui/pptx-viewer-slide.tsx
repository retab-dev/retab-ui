"use client"

import * as React from "react"

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

type SlideRenderState = "idle" | "rendering" | "rendered" | "failed"

export const PPTX_SLIDE_GAP = 16
export const PPTX_SLIDE_PADDING = 16

export interface PptxSlideScrollerProps {
  source: PptxSource
  zoomScale: number
  rotation: number
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
  eager,
  activity,
  renderSlideOverlay,
  onSlideRenderTiming,
  containerRef,
  viewportRef,
  onScroll,
}: PptxSlideScrollerProps) {
  return (
    <ScrollArea
      className="min-h-0 flex-1"
      viewportRef={viewportRef}
      viewportProps={{ onScroll }}
    >
      <div ref={containerRef} className="flex flex-col items-center gap-4 p-4">
        {Array.from({ length: source.slideCount }, (_, slideIndex) => (
          <PptxSlideFrame
            key={slideIndex}
            source={source}
            slideIndex={slideIndex}
            zoomScale={zoomScale}
            rotation={rotation}
            eager={eager}
            activity={activity}
            renderSlideOverlay={renderSlideOverlay}
            onSlideRenderTiming={onSlideRenderTiming}
          />
        ))}
      </div>
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
  onSlideRenderTiming,
}: {
  source: PptxSource
  slideIndex: number
  zoomScale: number
  rotation: number
  eager: boolean
  activity: PptxScrollActivity
  renderSlideOverlay?: (props: PptxSlideOverlayProps) => React.ReactNode
  onSlideRenderTiming?: (timing: PptxSlideRenderTiming) => void
}) {
  const [isNearViewport, setIsNearViewport] = React.useState(false)

  const frameRef = React.useCallback((element: HTMLDivElement | null) => {
    if (!element) return
    if (typeof IntersectionObserver === "undefined") {
      setIsNearViewport(true)
      return
    }
    const root = element.closest<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    let observer: IntersectionObserver | null = null
    try {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) setIsNearViewport(entry.isIntersecting)
        },
        { root, rootMargin: "150% 0px" }
      )
      observer.observe(element)
      return () => observer?.disconnect()
    } catch {
      observer?.disconnect()
      setIsNearViewport(true)
    }
  }, [])

  const slideSize = getScaledSlideSize(source.baseSize, zoomScale)
  const visibleSize = getVisibleSlideSize(slideSize, rotation)

  return (
    <div
      ref={frameRef}
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
        {isNearViewport ? (
          <PptxSlideCanvas
            source={source}
            slideIndex={slideIndex}
            zoomScale={zoomScale}
            eager={eager}
            activity={activity}
            onSlideRenderTiming={onSlideRenderTiming}
          />
        ) : (
          <Skeleton className="size-full rounded-none" />
        )}
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
  onSlideRenderTiming,
}: {
  source: PptxSource
  slideIndex: number
  zoomScale: number
  eager: boolean
  activity: PptxScrollActivity
  onSlideRenderTiming?: (timing: PptxSlideRenderTiming) => void
}) {
  const rawDpr = typeof window !== "undefined" ? window.devicePixelRatio : 1
  const dpr = Number.isFinite(rawDpr) && rawDpr > 0 ? rawDpr : 1
  const slideSize = getScaledSlideSize(source.baseSize, zoomScale)
  const [renderState, setRenderState] = React.useState<SlideRenderState>("idle")
  const onSlideRenderTimingRef = React.useRef(onSlideRenderTiming)
  onSlideRenderTimingRef.current = onSlideRenderTiming

  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      let cancelled = false
      const renderScale = zoomScale * dpr
      const immediateCached = source.hasBitmap({ slideIndex, renderScale })
      setRenderState("rendering")

      const start = () => {
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
            if (cancelled) return
            notifySlideRenderTiming(onSlideRenderTimingRef.current, {
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
            if (cancelled) return
            notifySlideRenderTiming(onSlideRenderTimingRef.current, {
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
        if (!cancelled) start()
      })
      return () => {
        cancelled = true
        off()
      }
    },
    [activity, dpr, eager, zoomScale, slideIndex, source]
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
