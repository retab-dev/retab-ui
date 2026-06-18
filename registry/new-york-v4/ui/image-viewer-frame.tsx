"use client"

import * as React from "react"
import { createRoot, type Root } from "react-dom/client"

import {
  ImageSourceDisposedError,
  toImageFormatError,
  type FrameSource,
} from "@/lib/image-frame-source"
import {
  frameCssSize,
  frameIndexToNumber,
  type FrameOverlayProps,
  type QuarterTurn,
} from "@/lib/image-geometry"
import { isResourceError } from "@/lib/viewer-errors"
import {
  type ImageFrameRenderTiming,
  type ImageViewerProps,
} from "@/components/ui/image-viewer-types"
import { ScrollArea } from "@/components/ui/scroll-area"

import {
  getImageFrameLayout,
  getVisibleImageFrameNumbers,
  type ImageFrameLayout,
  type ImageFrameLayoutModel,
} from "./image-viewer-virtualization"

const IMAGE_SCROLL_IDLE_MS = 120
const IMAGE_PREFETCH_AHEAD_FRAMES = 2
const IMAGE_RETAINED_DECODED_PIXEL_BUDGET = 24_000_000
const IMAGE_RETAINED_RENDERED_PIXEL_BUDGET = 32_000_000

type ImageRenderQuality = "high" | "low"

export interface ImageFrameProps {
  source: FrameSource
  frameIndex: number
  scale: number
  rotation: QuarterTurn
  renderQuality?: ImageRenderQuality
  renderOverlay?: (props: FrameOverlayProps) => React.ReactNode
  onFrameRenderTiming?: (timing: ImageFrameRenderTiming) => void
}

type ImageProjectionCallback = NonNullable<
  | ImageViewerProps["onFrameRenderTiming"]
  | ImageViewerProps["renderFrameOverlay"]
>

export interface ImageFrameScrollerProps {
  source: FrameSource
  layout: ImageFrameLayoutModel
  scale: number
  rotation: QuarterTurn
  frameListRef: React.Ref<HTMLDivElement>
  viewportRef: React.Ref<HTMLDivElement>
  onScroll: () => void
  renderFrameOverlay?: ImageViewerProps["renderFrameOverlay"]
  onFrameRenderTiming?: ImageViewerProps["onFrameRenderTiming"]
}

export function ImageFrame({
  source,
  frameIndex,
  scale,
  rotation,
  renderQuality = "high",
  renderOverlay,
  onFrameRenderTiming,
}: ImageFrameProps) {
  const descriptor = source.frames[frameIndex]
  const frameRect = frameCssSize(descriptor.intrinsicSize, scale, rotation)
  const frameNumber = frameIndexToNumber(frameIndex)

  return (
    <div
      className="relative shadow-sm ring-1 ring-border"
      style={{ width: frameRect.width, height: frameRect.height }}
      data-slot="image-frame"
      data-frame={frameNumber}
      data-frame-number={frameNumber}
    >
      <ImageFrameCanvas
        source={source}
        frameIndex={frameIndex}
        scale={scale}
        rotation={rotation}
        renderQuality={renderQuality}
        onFrameRenderTiming={onFrameRenderTiming}
      />
      {renderOverlay ? (
        <div className="pointer-events-none absolute inset-0">
          {renderOverlay({
            frameNumber,
            frameRect,
            scale,
            rotation,
          })}
        </div>
      ) : null}
    </div>
  )
}

function ImageFrameCanvas({
  source,
  frameIndex,
  scale,
  rotation,
  renderQuality,
  onFrameRenderTiming,
}: {
  source: FrameSource
  frameIndex: number
  scale: number
  rotation: QuarterTurn
  renderQuality: ImageRenderQuality
  onFrameRenderTiming?: (timing: ImageFrameRenderTiming) => void
}) {
  const descriptor = source.frames[frameIndex]
  const dpr = getImageDevicePixelRatio()
  const frameRect = frameCssSize(descriptor.intrinsicSize, scale, rotation)
  const [drawError, setDrawError] = React.useState<Error | null>(null)

  if (drawError) throw drawError

  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      canvas.width = Math.max(1, Math.floor(frameRect.width * dpr))
      canvas.height = Math.max(1, Math.floor(frameRect.height * dpr))

      let cancelled = false
      let settled = false
      let reported = false
      const cached = source.hasDecodedFrame(frameIndex)
      const startedAt = now()
      const renderScale = scale * dpr
      const report = (status: ImageFrameRenderTiming["status"]) => {
        if (reported) return
        reported = true
        notifyImageFrameRenderTiming(onFrameRenderTiming, {
          cached,
          durationMs: now() - startedAt,
          frameNumber: frameIndexToNumber(frameIndex),
          pixelRatio: dpr,
          renderScale,
          status,
        })
      }
      source
        .acquire(frameIndex)
        .then((bitmap) => {
          settled = true
          if (cancelled) return
          ctx.save()
          try {
            ctx.scale(dpr, dpr)
            ctx.translate(frameRect.width / 2, frameRect.height / 2)
            ctx.rotate((rotation * Math.PI) / 180)
            const drawWidth = descriptor.intrinsicSize.width * scale
            const drawHeight = descriptor.intrinsicSize.height * scale
            ctx.imageSmoothingQuality = renderQuality
            ctx.drawImage(
              bitmap,
              -drawWidth / 2,
              -drawHeight / 2,
              drawWidth,
              drawHeight
            )
          } finally {
            ctx.restore()
          }
          report("rendered")
        })
        .catch((error) => {
          settled = true
          if (error instanceof ImageSourceDisposedError) return
          if (!cancelled) {
            report("failed")
            setDrawError(
              isResourceError(error)
                ? error
                : toImageFormatError(error, {
                    kind: "decode_failed",
                    message: "Image decode failed",
                  })
            )
          }
        })

      return () => {
        cancelled = true
        if (!settled) report("cancelled")
        source.release(frameIndex)
      }
    },
    [
      descriptor.intrinsicSize.height,
      descriptor.intrinsicSize.width,
      dpr,
      frameIndex,
      frameRect.height,
      frameRect.width,
      onFrameRenderTiming,
      renderQuality,
      rotation,
      scale,
      source,
    ]
  )

  return (
    <canvas
      ref={canvasRef}
      style={{ width: frameRect.width, height: frameRect.height }}
      className="block bg-white"
    />
  )
}

export function ImageFrameScroller({
  source,
  layout,
  scale,
  rotation,
  frameListRef,
  viewportRef,
  onScroll,
  renderFrameOverlay,
  onFrameRenderTiming,
}: ImageFrameScrollerProps) {
  const canvasRef = React.useRef<HTMLDivElement | null>(null)
  const projectionFrameRef = React.useRef<number | null>(null)
  const idleTimerRef = React.useRef<number | null>(null)
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null)
  const projectionCacheRef = React.useRef<ImageFrameProjectionCache>({
    clock: 0,
    frames: new Map(),
    resetKey: "",
  })
  const scrollStateRef = React.useRef({
    direction: 1,
    isScrolling: false,
    scrollTop: 0,
  })
  const sourceKey = getImageProjectionSourceKey(source)
  const layoutResetKey = [
    sourceKey,
    layout.frameCount,
    layout.maxFrameWidth,
    layout.totalHeight,
    scale,
    rotation,
  ].join("\u0000")

  const projectFrames = React.useCallback(() => {
    projectionFrameRef.current = null
    projectImageFrames({
      cache: projectionCacheRef.current,
      canvas: canvasRef.current,
      layout,
      onFrameRenderTiming,
      renderFrameOverlay,
      renderQuality: scrollStateRef.current.isScrolling ? "low" : "high",
      resetKey: layoutResetKey,
      rotation,
      scale,
      scrollDirection: scrollStateRef.current.direction,
      source,
      sourceKey,
      viewport: viewportElementRef.current,
    })
  }, [
    layout,
    layoutResetKey,
    onFrameRenderTiming,
    renderFrameOverlay,
    rotation,
    scale,
    source,
    sourceKey,
  ])

  const scheduleProjectFrames = React.useCallback(() => {
    if (projectionFrameRef.current !== null) return
    if (typeof requestAnimationFrame !== "function") {
      projectFrames()
      return
    }
    projectionFrameRef.current = requestAnimationFrame(projectFrames)
  }, [projectFrames])

  React.useLayoutEffect(() => {
    projectFrames()
  }, [projectFrames])

  React.useEffect(
    () => () => {
      if (
        projectionFrameRef.current !== null &&
        typeof cancelAnimationFrame === "function"
      ) {
        cancelAnimationFrame(projectionFrameRef.current)
      }
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current)
      }
      disposeImageFrameProjectionCache(projectionCacheRef.current)
    },
    []
  )

  const setViewportRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      viewportElementRef.current = element
      if (element) scrollStateRef.current.scrollTop = element.scrollTop
      assignImageRef(viewportRef, element)
    },
    [viewportRef]
  )

  const setCanvasRef = React.useCallback((element: HTMLDivElement | null) => {
    canvasRef.current = element
  }, [])

  const handleScroll = React.useCallback(() => {
    onScroll()
    const viewport = viewportElementRef.current
    const scrollTop = viewport?.scrollTop ?? 0
    const previousScrollTop = scrollStateRef.current.scrollTop
    if (scrollTop > previousScrollTop) {
      scrollStateRef.current.direction = 1
    } else if (scrollTop < previousScrollTop) {
      scrollStateRef.current.direction = -1
    }
    scrollStateRef.current.scrollTop = scrollTop
    scrollStateRef.current.isScrolling = true
    scheduleProjectFrames()

    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current)
    }
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null
      scrollStateRef.current.isScrolling = false
      scheduleProjectFrames()
    }, IMAGE_SCROLL_IDLE_MS)
  }, [onScroll, scheduleProjectFrames])

  return (
    <ScrollArea
      className="min-h-0 flex-1"
      viewportRef={setViewportRef}
      viewportProps={{ onScroll: handleScroll }}
    >
      <div
        ref={frameListRef}
        className="relative min-h-full w-full"
        style={{ height: layout.totalHeight }}
      >
        <div
          ref={setCanvasRef}
          className="relative mx-auto h-full w-full"
          data-slot="image-frame-virtual-canvas"
          style={{
            minWidth: layout.maxFrameWidth + layout.padding * 2,
          }}
        />
      </div>
    </ScrollArea>
  )
}

type ImageFrameProjectionCache = {
  clock: number
  frames: Map<number, ProjectedImageFrame>
  resetKey: string
}

type ProjectedImageFrame = {
  decodedPixels: number
  isLive: boolean
  lastSeen: number
  renderedPixels: number
  renderKey: string
  root: Root
  shell: HTMLElement
}

const imageProjectionSourceKeys = new WeakMap<FrameSource, number>()
const imageProjectionCallbackKeys = new WeakMap<
  ImageProjectionCallback,
  number
>()
let nextImageProjectionSourceKey = 1
let nextImageProjectionCallbackKey = 1

function projectImageFrames({
  cache,
  canvas,
  layout,
  onFrameRenderTiming,
  renderFrameOverlay,
  renderQuality,
  resetKey,
  rotation,
  scale,
  scrollDirection,
  source,
  sourceKey,
  viewport,
}: {
  cache: ImageFrameProjectionCache
  canvas: HTMLDivElement | null
  layout: ImageFrameLayoutModel
  onFrameRenderTiming?: ImageViewerProps["onFrameRenderTiming"]
  renderFrameOverlay?: ImageViewerProps["renderFrameOverlay"]
  renderQuality: ImageRenderQuality
  resetKey: string
  rotation: QuarterTurn
  scale: number
  scrollDirection: number
  source: FrameSource
  sourceKey: number
  viewport: HTMLDivElement | null
}) {
  if (!canvas) return

  if (cache.resetKey !== resetKey) {
    disposeImageFrameProjectionCache(cache)
    cache.resetKey = resetKey
  }

  cache.clock += 1
  const viewportHeight =
    viewport?.clientHeight || viewport?.getBoundingClientRect().height || 0
  const visibleFrameNumbers = getVisibleImageFrameNumbers({
    layout,
    scrollTop: viewport?.scrollTop ?? 0,
    viewportHeight,
  })
  const visibleFrameIndexes = new Set<number>()

  let previousShell: HTMLElement | null = null
  for (const frameNumber of visibleFrameNumbers) {
    const frame = getImageFrameLayout(layout, frameNumber)
    if (!frame) continue
    visibleFrameIndexes.add(frame.frameIndex)
    const projectedFrame =
      cache.frames.get(frame.frameIndex) ?? createProjectedImageFrame(frame)
    projectedFrame.lastSeen = cache.clock
    projectedFrame.decodedPixels = frameDecodedPixels(source, frame.frameIndex)
    projectedFrame.renderedPixels = frameRenderedPixels(frame)
    patchProjectedImageFrame(projectedFrame.shell, frame)
    renderProjectedImageFrame({
      frame,
      onFrameRenderTiming,
      projectedFrame,
      renderFrameOverlay,
      renderQuality,
      rotation,
      scale,
      source,
      sourceKey,
    })
    cache.frames.set(frame.frameIndex, projectedFrame)
    placeProjectedImageFrame(canvas, projectedFrame.shell, previousShell)
    previousShell = projectedFrame.shell
  }

  schedulePrefetchImageFrames({
    frameNumbers: visibleFrameNumbers,
    layout,
    scrollDirection,
    source,
  })
  evictImageFrameProjectionCache(cache, visibleFrameIndexes)
}

function createProjectedImageFrame(
  frame: ImageFrameLayout
): ProjectedImageFrame {
  const shell = document.createElement("div")
  shell.className = "absolute top-0 left-1/2"
  shell.dataset.slot = "image-frame-slot"
  shell.dataset.virtualFrameNumber = String(frame.frameNumber)

  return {
    decodedPixels: 0,
    isLive: true,
    lastSeen: 0,
    renderedPixels: 0,
    renderKey: "",
    root: createRoot(shell),
    shell,
  }
}

function patchProjectedImageFrame(shell: HTMLElement, frame: ImageFrameLayout) {
  shell.dataset.virtualFrameNumber = String(frame.frameNumber)
  setImageStyle(shell, "transform", `translate(-50%, ${frame.offsetTop}px)`)
  setImagePixelStyle(shell, "width", frame.width)
  setImagePixelStyle(shell, "height", frame.height)
}

function renderProjectedImageFrame({
  frame,
  onFrameRenderTiming,
  projectedFrame,
  renderFrameOverlay,
  renderQuality,
  rotation,
  scale,
  source,
  sourceKey,
}: {
  frame: ImageFrameLayout
  onFrameRenderTiming?: ImageViewerProps["onFrameRenderTiming"]
  projectedFrame: ProjectedImageFrame
  renderFrameOverlay?: ImageViewerProps["renderFrameOverlay"]
  renderQuality: ImageRenderQuality
  rotation: QuarterTurn
  scale: number
  source: FrameSource
  sourceKey: number
}) {
  const renderKey = [
    frame.frameIndex,
    sourceKey,
    frame.width,
    frame.height,
    scale,
    rotation,
    renderQuality,
    getImageProjectionCallbackKey(renderFrameOverlay),
    getImageProjectionCallbackKey(onFrameRenderTiming),
    getImageDevicePixelRatio(),
  ].join("\u0000")

  if (projectedFrame.renderKey === renderKey) return
  projectedFrame.renderKey = renderKey
  projectedFrame.root.render(
    <ImageFrame
      source={source}
      frameIndex={frame.frameIndex}
      scale={scale}
      rotation={rotation}
      renderQuality={renderQuality}
      onFrameRenderTiming={onFrameRenderTiming}
      renderOverlay={
        renderFrameOverlay
          ? ({ frameNumber, frameRect, scale, rotation }) =>
              renderFrameOverlay({
                frameNumber,
                width: frameRect.width,
                height: frameRect.height,
                scale,
                rotation,
              })
          : undefined
      }
    />
  )
}

function placeProjectedImageFrame(
  canvas: HTMLElement,
  shell: HTMLElement,
  previousShell: HTMLElement | null
) {
  const nextSibling = previousShell
    ? previousShell.nextSibling
    : canvas.firstChild
  if (shell === nextSibling) return
  canvas.insertBefore(shell, nextSibling)
}

function evictImageFrameProjectionCache(
  cache: ImageFrameProjectionCache,
  visibleFrameIndexes: ReadonlySet<number>
) {
  let decodedPixels = 0
  let renderedPixels = 0

  for (const frame of cache.frames.values()) {
    decodedPixels += frame.decodedPixels
    renderedPixels += frame.renderedPixels
  }

  if (
    decodedPixels <= IMAGE_RETAINED_DECODED_PIXEL_BUDGET &&
    renderedPixels <= IMAGE_RETAINED_RENDERED_PIXEL_BUDGET
  ) {
    return
  }

  const evictableFrames = [...cache.frames.entries()]
    .filter(([frameIndex]) => !visibleFrameIndexes.has(frameIndex))
    .sort(([, a], [, b]) => a.lastSeen - b.lastSeen)

  for (const [frameIndex, frame] of evictableFrames) {
    if (
      decodedPixels <= IMAGE_RETAINED_DECODED_PIXEL_BUDGET &&
      renderedPixels <= IMAGE_RETAINED_RENDERED_PIXEL_BUDGET
    ) {
      return
    }
    decodedPixels -= frame.decodedPixels
    renderedPixels -= frame.renderedPixels
    disposeProjectedImageFrame(frame)
    cache.frames.delete(frameIndex)
  }
}

type ImageFramePrefetchInput = {
  frameNumbers: readonly number[]
  layout: ImageFrameLayoutModel
  scrollDirection: number
  source: FrameSource
}

function schedulePrefetchImageFrames(input: ImageFramePrefetchInput) {
  if (input.frameNumbers.length === 0) return
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => prefetchImageFrames(input))
    return
  }
  window.setTimeout(() => prefetchImageFrames(input), 0)
}

function prefetchImageFrames({
  frameNumbers,
  layout,
  scrollDirection,
  source,
}: ImageFramePrefetchInput) {
  if (frameNumbers.length === 0) return
  const edgeFrameNumber =
    scrollDirection >= 0
      ? frameNumbers[frameNumbers.length - 1]
      : frameNumbers[0]
  const prefetchFrameNumbers: number[] = []

  for (let offset = 1; offset <= IMAGE_PREFETCH_AHEAD_FRAMES; offset += 1) {
    const frameNumber =
      edgeFrameNumber + offset * (scrollDirection >= 0 ? 1 : -1)
    if (frameNumber < 1 || frameNumber > layout.frameCount) continue
    prefetchFrameNumbers.push(frameNumber)
  }

  source.prefetch(
    prefetchFrameNumbers.flatMap((frameNumber) => {
      const frame = getImageFrameLayout(layout, frameNumber)
      return frame ? [frame.frameIndex] : []
    })
  )
}

function frameDecodedPixels(source: FrameSource, frameIndex: number) {
  const size = source.frames[frameIndex]?.intrinsicSize
  return size ? size.width * size.height : 0
}

function frameRenderedPixels(frame: ImageFrameLayout) {
  const dpr = getImageDevicePixelRatio()
  return (
    Math.max(1, Math.floor(frame.width * dpr)) *
    Math.max(1, Math.floor(frame.height * dpr))
  )
}

function disposeImageFrameProjectionCache(cache: ImageFrameProjectionCache) {
  for (const projectedFrame of cache.frames.values()) {
    disposeProjectedImageFrame(projectedFrame)
  }
  cache.frames.clear()
}

function disposeProjectedImageFrame(projectedFrame: ProjectedImageFrame) {
  if (!projectedFrame.isLive) return
  projectedFrame.isLive = false
  deferImageRootUnmount(projectedFrame.root)
  projectedFrame.shell.remove()
}

function deferImageRootUnmount(root: Root) {
  const unmount = () => root.unmount()
  if (typeof queueMicrotask === "function") {
    queueMicrotask(unmount)
    return
  }
  window.setTimeout(unmount, 0)
}

function getImageProjectionSourceKey(source: FrameSource) {
  const cached = imageProjectionSourceKeys.get(source)
  if (cached) return cached
  const key = nextImageProjectionSourceKey
  nextImageProjectionSourceKey += 1
  imageProjectionSourceKeys.set(source, key)
  return key
}

function getImageProjectionCallbackKey(
  callback: ImageProjectionCallback | undefined
) {
  if (!callback) return 0
  const cached = imageProjectionCallbackKeys.get(callback)
  if (cached) return cached
  const key = nextImageProjectionCallbackKey
  nextImageProjectionCallbackKey += 1
  imageProjectionCallbackKeys.set(callback, key)
  return key
}

function getImageDevicePixelRatio() {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1
}

function setImagePixelStyle(
  element: HTMLElement,
  property: "height" | "width",
  value: number
) {
  setImageStyle(element, property, `${value}px`)
}

function setImageStyle(
  element: HTMLElement,
  property: "height" | "transform" | "width",
  value: string
) {
  if (element.style.getPropertyValue(property) === value) return
  element.style.setProperty(property, value)
}

function assignImageRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return
  if (typeof ref === "function") {
    ref(value)
    return
  }
  ref.current = value
}

function notifyImageFrameRenderTiming(
  callback: ((timing: ImageFrameRenderTiming) => void) | undefined,
  timing: ImageFrameRenderTiming
) {
  try {
    callback?.(timing)
  } catch {
    /* Instrumentation callbacks must not affect frame rendering. */
  }
}

function now() {
  return typeof performance === "undefined" ? Date.now() : performance.now()
}
