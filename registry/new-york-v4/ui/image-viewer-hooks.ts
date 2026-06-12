"use client"

import * as React from "react"

import { type FrameSource } from "@/lib/image-frame-source"
import { normalizeRotation, rotatedSize } from "@/lib/image-geometry"
import {
  type ImageViewerHandle,
  type ImageViewerProps,
} from "@/components/ui/image-viewer-types"

const IMAGE_SCROLL_HEADROOM = 48
const IMAGE_VIEWER_HORIZONTAL_PADDING = 32

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
  frameListWidth: number | null
) {
  const isScaleControlled = controlledScale !== undefined
  const [uncontrolledScale, setUncontrolledScale] = React.useState<
    number | null
  >(null)
  const [rawRotation, setRawRotation] = React.useState(0)
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
    controlledScale ?? uncontrolledScale ?? Math.max(0.25, fitWidthScale)

  const setViewerScale = React.useCallback(
    (nextScale: number | null) => {
      if (isScaleControlled) return
      setUncontrolledScale(nextScale)
    },
    [isScaleControlled]
  )
  const rotateClockwise = React.useCallback(() => {
    setRawRotation((value) => (value + 90) % 360)
  }, [])

  return {
    isScaleControlled,
    rotateClockwise,
    rotation,
    scale,
    setViewerScale,
  }
}

export function useVisibleFrame(
  onScrollProgressChange: ImageViewerProps["onScrollProgressChange"],
  onVisibleFrameChange: ImageViewerProps["onVisibleFrameChange"]
) {
  const [currentFrameNumber, setCurrentFrameNumber] = React.useState(1)
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null)
  const lastReportedFrameNumber = React.useRef(0)

  const handleScroll = React.useCallback(() => {
    const viewport = scrollViewportRef.current
    if (!viewport) return
    const scrollable = viewport.scrollHeight - viewport.clientHeight
    onScrollProgressChange?.(
      scrollable > 0 ? viewport.scrollTop / scrollable : 0
    )

    const frameNumber = findVisibleFrameNumber(viewport)
    if (frameNumber && frameNumber !== lastReportedFrameNumber.current) {
      lastReportedFrameNumber.current = frameNumber
      setCurrentFrameNumber(frameNumber)
      onVisibleFrameChange?.(frameNumber)
    }
  }, [onScrollProgressChange, onVisibleFrameChange])

  return { currentFrameNumber, handleScroll, scrollViewportRef }
}

export function useImageViewerHandle(
  forwardedRef: React.ForwardedRef<ImageViewerHandle> | undefined,
  scrollViewportRef: React.RefObject<HTMLDivElement | null>
) {
  React.useImperativeHandle(
    forwardedRef,
    () => ({
      scrollToFrameArea: (frameNumber, area, options) => {
        const viewport = scrollViewportRef.current
        const frame = viewport?.querySelector<HTMLElement>(
          `[data-frame-number="${frameNumber}"]`
        )
        if (!viewport || !frame) return
        const frameRect = frame.getBoundingClientRect()
        const viewportRect = viewport.getBoundingClientRect()
        const frameTop = frameRect.top - viewportRect.top + viewport.scrollTop
        const targetTop =
          frameTop + (area.top / 100) * frameRect.height - IMAGE_SCROLL_HEADROOM
        viewport.scrollTo({
          top: Math.max(0, targetTop),
          behavior: "smooth",
          ...options,
        })
      },
      getViewportElement: () => scrollViewportRef.current,
    }),
    [scrollViewportRef]
  )
}

function findVisibleFrameNumber(viewport: HTMLElement): number {
  const viewportRect = viewport.getBoundingClientRect()
  const markerY = viewportRect.top + viewportRect.height * 0.2
  const markerX = viewportRect.left + viewportRect.width / 2
  const elementsFromPoint = viewport.ownerDocument.elementsFromPoint?.(
    markerX,
    markerY
  )
  for (const element of elementsFromPoint ?? []) {
    const frame = element.closest<HTMLElement>("[data-frame-number]")
    const frameNumber = Number(frame?.dataset.frameNumber)
    if (frameNumber) return frameNumber
  }

  const frames = viewport.querySelectorAll<HTMLElement>("[data-frame-number]")
  let frameNumber = 1
  for (const frame of frames) {
    if (frame.getBoundingClientRect().top <= markerY) {
      frameNumber = Number(frame.dataset.frameNumber)
    } else {
      break
    }
  }
  return frameNumber
}
