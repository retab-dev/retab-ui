"use client"

import * as React from "react"

import { type FrameSource } from "@/lib/image-frame-source"
import { normalizeRotation, rotatedSize } from "@/lib/image-geometry"
import {
  type ImageViewerHandle,
  type ImageViewerProps,
} from "@/components/ui/image-viewer-types"

import {
  getCurrentImageFrameNumber,
  getImageFrameLayout,
  type ImageFrameLayoutModel,
} from "./image-viewer-virtualization"

const IMAGE_SCROLL_HEADROOM = 48
const IMAGE_READING_MARKER_RATIO = 0.2
const IMAGE_VIEWER_HORIZONTAL_PADDING = 32

/** Bounds for the viewer's zoom range, shared by fit-width and the toolbar. */
export const MIN_VIEWER_SCALE = 0.25
export const MAX_VIEWER_SCALE = 5

export function useFrameListWidth() {
  const [frameListWidth, setFrameListWidth] = React.useState<number | null>(
    null
  )
  const frameListRef = React.useCallback((element: HTMLDivElement | null) => {
    if (!element) return
    setFrameListWidth(element.clientWidth)
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setFrameListWidth((entry.target as HTMLElement).clientWidth)
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { frameListRef, frameListWidth }
}

export function useImageViewerScale(
  source: FrameSource,
  controlledScale: number | undefined,
  defaultScale: number | undefined,
  onScaleChange: ImageViewerProps["onScaleChange"],
  frameListWidth: number | null
) {
  const isScaleControlled = controlledScale !== undefined
  const [uncontrolledScale, setUncontrolledScale] = React.useState<
    number | null
  >(() =>
    defaultScale === undefined ? null : normalizeViewerScale(defaultScale)
  )
  const [rawRotation, setRawRotation] = React.useState(0)

  React.useLayoutEffect(() => {
    setRawRotation(0)
    setUncontrolledScale(
      defaultScale === undefined ? null : normalizeViewerScale(defaultScale)
    )
  }, [defaultScale, source])

  const rotation = normalizeRotation(rawRotation)
  const widestFrameWidth = Math.max(
    1,
    ...source.frames.map(
      (frame) => rotatedSize(frame.intrinsicSize, rotation).width
    )
  )
  const fitWidthScale = frameListWidth
    ? (frameListWidth - IMAGE_VIEWER_HORIZONTAL_PADDING) / widestFrameWidth
    : 1
  const scale =
    controlledScale !== undefined
      ? normalizeViewerScale(controlledScale)
      : uncontrolledScale !== null
        ? normalizeViewerScale(uncontrolledScale)
        : Math.min(MAX_VIEWER_SCALE, Math.max(MIN_VIEWER_SCALE, fitWidthScale))

  const scaleControlsDisabled = isScaleControlled && !onScaleChange
  const setViewerScale = React.useCallback(
    (nextScale: number | null) => {
      const normalized =
        nextScale == null ? null : normalizeViewerScale(nextScale)
      if (isScaleControlled) {
        onScaleChange?.(normalized)
        return
      }
      setUncontrolledScale(normalized)
    },
    [isScaleControlled, onScaleChange]
  )
  const rotateClockwise = React.useCallback(() => {
    setRawRotation((value) => (value + 90) % 360)
  }, [])

  return {
    rotateClockwise,
    rotation,
    scale,
    scaleControlsDisabled,
    setViewerScale,
  }
}

function normalizeViewerScale(scale: number): number {
  return Number.isFinite(scale) && scale > 0
    ? Math.min(MAX_VIEWER_SCALE, Math.max(MIN_VIEWER_SCALE, scale))
    : MIN_VIEWER_SCALE
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function normalizeFrameAreaPercent(value: number): number | null {
  if (!Number.isFinite(value)) return null
  return Math.min(100, Math.max(0, value))
}

type ImageReadingAnchor =
  | {
      kind: "top"
    }
  | {
      frameNumber: number
      kind: "frame"
      yPercent: number
    }

export function useVisibleFrame(
  layout: ImageFrameLayoutModel,
  resetKey: unknown,
  onScrollProgressChange: ImageViewerProps["onScrollProgressChange"],
  onVisibleFrameChange: ImageViewerProps["onVisibleFrameChange"]
) {
  const [currentFrameNumber, setCurrentFrameNumber] = React.useState(1)
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null)
  const [scrollViewportElement, setScrollViewportElement] =
    React.useState<HTMLDivElement | null>(null)
  const lastReportedFrameNumber = React.useRef(0)
  const committedLayoutRef = React.useRef(layout)
  const committedResetKeyRef = React.useRef<unknown>(resetKey)

  // Swapping the displayed document remounts the frame DOM and resets the
  // scroll position, but this hook's state survives because the content
  // component updates in place. Reset to the first frame when the source
  // changes so the page indicator tracks the new document instead of carrying
  // over a stale page number. (The "of N" clamp hid this when swapping to a
  // shorter document.) A layout effect resets before paint, so the stale page
  // never flashes.
  React.useLayoutEffect(() => {
    lastReportedFrameNumber.current = 0
    setCurrentFrameNumber(1)
  }, [resetKey])

  const setScrollViewportRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      scrollViewportRef.current = element
      setScrollViewportElement(element)
    },
    []
  )

  React.useLayoutEffect(() => {
    const previousLayout = committedLayoutRef.current
    const previousResetKey = committedResetKeyRef.current
    committedLayoutRef.current = layout
    committedResetKeyRef.current = resetKey

    if (!Object.is(previousResetKey, resetKey)) return
    if (Object.is(previousLayout, layout)) return

    const viewport = scrollViewportRef.current
    if (!viewport) return

    const anchor = captureImageReadingAnchor(previousLayout, viewport)
    if (!anchor) return

    restoreImageReadingAnchor(layout, viewport, anchor)
  }, [layout, resetKey])

  const handleScroll = React.useCallback(() => {
    const viewport = scrollViewportRef.current
    if (!viewport) return
    const scrollable = viewport.scrollHeight - viewport.clientHeight
    onScrollProgressChange?.(
      scrollable > 0 ? clamp01(viewport.scrollTop / scrollable) : 0
    )

    const frameNumber = getCurrentImageFrameNumber({
      layout,
      scrollTop: viewport.scrollTop,
      viewportHeight: viewport.clientHeight,
    })
    if (frameNumber && frameNumber !== lastReportedFrameNumber.current) {
      lastReportedFrameNumber.current = frameNumber
      setCurrentFrameNumber(frameNumber)
      onVisibleFrameChange?.(frameNumber)
    }
  }, [layout, onScrollProgressChange, onVisibleFrameChange])

  return {
    currentFrameNumber,
    handleScroll,
    scrollViewportElement,
    scrollViewportRef,
    setScrollViewportRef,
  }
}

function captureImageReadingAnchor(
  layout: ImageFrameLayoutModel,
  viewport: HTMLDivElement
): ImageReadingAnchor | null {
  if (layout.frameCount === 0) return null
  if (viewport.scrollTop <= 0) return { kind: "top" }

  const markerOffset =
    viewport.scrollTop + viewport.clientHeight * IMAGE_READING_MARKER_RATIO
  const frameNumber = getCurrentImageFrameNumber({
    layout,
    scrollTop: viewport.scrollTop,
    viewportHeight: viewport.clientHeight,
  })
  const frame = getImageFrameLayout(layout, frameNumber)
  if (!frame || frame.height <= 0) return null

  return {
    frameNumber,
    kind: "frame",
    yPercent: clamp01((markerOffset - frame.offsetTop) / frame.height),
  }
}

function restoreImageReadingAnchor(
  layout: ImageFrameLayoutModel,
  viewport: HTMLDivElement,
  anchor: ImageReadingAnchor
) {
  if (anchor.kind === "top") {
    viewport.scrollTop = 0
    return
  }

  const frame = getImageFrameLayout(layout, anchor.frameNumber)
  if (!frame) return

  const targetTop =
    frame.offsetTop +
    frame.height * anchor.yPercent -
    viewport.clientHeight * IMAGE_READING_MARKER_RATIO
  const maxScrollTop = Math.max(0, layout.totalHeight - viewport.clientHeight)
  viewport.scrollTop = Math.min(maxScrollTop, Math.max(0, targetTop))
}

export function useImageViewerHandle(
  forwardedRef: React.ForwardedRef<ImageViewerHandle> | undefined,
  scrollViewportRef: React.RefObject<HTMLDivElement | null>,
  layout: ImageFrameLayoutModel
) {
  React.useImperativeHandle(
    forwardedRef ?? null,
    () => ({
      scrollToFrameArea: (frameNumber, area, options) => {
        const areaTop = normalizeFrameAreaPercent(area.top)
        if (areaTop == null) return
        const viewport = scrollViewportRef.current
        const frame = getImageFrameLayout(layout, frameNumber)
        if (!viewport || !frame) return
        const targetTop =
          frame.offsetTop +
          (areaTop / 100) * frame.height -
          IMAGE_SCROLL_HEADROOM
        viewport.scrollTo({
          top: Math.max(0, targetTop),
          behavior: "smooth",
          ...options,
        })
      },
      getViewportElement: () => scrollViewportRef.current,
    }),
    [layout, scrollViewportRef]
  )
}
