"use client"

import * as React from "react"

import { type FrameDescriptor } from "@/lib/image-frame-source"
import {
  frameCssSize,
  frameIndexToNumber,
  type QuarterTurn,
} from "@/lib/image-geometry"

export const IMAGE_FRAME_GAP = 16
export const IMAGE_FRAME_PADDING = 16

export type ImageFrameLayout = {
  frameIndex: number
  frameNumber: number
  width: number
  height: number
  offsetTop: number
}

export type ImageFrameLayoutModel = {
  frameCount: number
  gap: number
  padding: number
  totalHeight: number
  maxFrameWidth: number
  frames: readonly ImageFrameLayout[]
}

export function createImageFrameLayout({
  frames,
  scale,
  rotation,
  gap = IMAGE_FRAME_GAP,
  padding = IMAGE_FRAME_PADDING,
}: {
  frames: readonly FrameDescriptor[]
  scale: number
  rotation: QuarterTurn
  gap?: number
  padding?: number
}): ImageFrameLayoutModel {
  let offsetTop = padding
  let maxFrameWidth = 0
  const frameLayouts = frames.map((frame, frameIndex) => {
    const frameRect = frameCssSize(frame.intrinsicSize, scale, rotation)
    const layout = {
      frameIndex,
      frameNumber: frameIndexToNumber(frameIndex),
      width: frameRect.width,
      height: frameRect.height,
      offsetTop,
    }
    offsetTop += frameRect.height + gap
    maxFrameWidth = Math.max(maxFrameWidth, frameRect.width)
    return layout
  })

  return {
    frameCount: frames.length,
    gap,
    padding,
    totalHeight: frames.length === 0 ? 0 : offsetTop - gap + padding,
    maxFrameWidth,
    frames: frameLayouts,
  }
}

export function getImageFrameLayout(
  layout: ImageFrameLayoutModel,
  frameNumber: number
): ImageFrameLayout | undefined {
  if (!Number.isInteger(frameNumber)) return undefined
  return layout.frames[frameNumber - 1]
}

export function findImageFrameByOffset(
  layout: ImageFrameLayoutModel,
  offset: number
): number {
  if (layout.frameCount === 0) return 1

  let low = 0
  let high = layout.frames.length - 1
  let match = 0

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (layout.frames[mid].offsetTop <= offset) {
      match = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return layout.frames[match].frameNumber
}

export function getVisibleImageFrameNumbers({
  layout,
  scrollTop,
  viewportHeight,
  overscanFrames = 2,
}: {
  layout: ImageFrameLayoutModel
  scrollTop: number
  viewportHeight: number
  overscanFrames?: number
}): readonly number[] {
  if (layout.frameCount === 0) return []

  const measurementHeight = Math.max(1, viewportHeight)
  const startOffset = Math.max(0, scrollTop - measurementHeight)
  const endOffset = scrollTop + measurementHeight * 2
  const firstVisibleFrame = findImageFrameByOffset(layout, startOffset)
  const lastVisibleFrame = findImageFrameByOffset(layout, endOffset)
  const firstFrame = Math.max(1, firstVisibleFrame - overscanFrames)
  const lastFrame = Math.min(
    layout.frameCount,
    lastVisibleFrame + overscanFrames
  )

  return Array.from(
    { length: lastFrame - firstFrame + 1 },
    (_, index) => firstFrame + index
  )
}

export function getCurrentImageFrameNumber({
  layout,
  scrollTop,
  viewportHeight,
}: {
  layout: ImageFrameLayoutModel
  scrollTop: number
  viewportHeight: number
}): number {
  return findImageFrameByOffset(layout, scrollTop + viewportHeight * 0.2)
}

export function useImageFrameVirtualization({
  layout,
  resetKey,
  viewportElement,
}: {
  layout: ImageFrameLayoutModel
  resetKey?: unknown
  viewportElement: HTMLDivElement | null
}) {
  const measureFrameRef = React.useRef(0)
  const lastMeasuredResetKeyRef = React.useRef<unknown>(resetKey)
  const getCurrentVisibleFrameNumbers = React.useCallback(
    () =>
      getVisibleImageFrameNumbers({
        layout,
        scrollTop: Object.is(lastMeasuredResetKeyRef.current, resetKey)
          ? (viewportElement?.scrollTop ?? 0)
          : 0,
        viewportHeight: viewportElement?.clientHeight ?? 0,
      }),
    [layout, resetKey, viewportElement]
  )
  const [state, setState] = React.useState<{
    layout: ImageFrameLayoutModel
    resetKey: unknown
    visibleFrameNumbers: readonly number[]
  }>(() => ({
    layout,
    resetKey,
    visibleFrameNumbers: getVisibleImageFrameNumbers({
      layout,
      scrollTop: viewportElement?.scrollTop ?? 0,
      viewportHeight: viewportElement?.clientHeight ?? 0,
    }),
  }))
  const visibleFrameNumbers =
    Object.is(state.layout, layout) && Object.is(state.resetKey, resetKey)
      ? state.visibleFrameNumbers
      : getVisibleImageFrameNumbers({
          layout,
          scrollTop: Object.is(state.resetKey, resetKey)
            ? (viewportElement?.scrollTop ?? 0)
            : 0,
          viewportHeight: viewportElement?.clientHeight ?? 0,
        })

  const measureVisibleFramesNow = React.useCallback(() => {
    measureFrameRef.current = 0
    const nextFrameNumbers = getCurrentVisibleFrameNumbers()
    lastMeasuredResetKeyRef.current = resetKey
    setState((previousState) =>
      Object.is(previousState.layout, layout) &&
      Object.is(previousState.resetKey, resetKey) &&
      areFrameNumbersEqual(previousState.visibleFrameNumbers, nextFrameNumbers)
        ? previousState
        : { layout, resetKey, visibleFrameNumbers: nextFrameNumbers }
    )
  }, [getCurrentVisibleFrameNumbers, layout, resetKey])
  const measureVisibleFramesNowRef = React.useRef(measureVisibleFramesNow)

  React.useLayoutEffect(() => {
    measureVisibleFramesNowRef.current = measureVisibleFramesNow
  }, [measureVisibleFramesNow])

  const measureVisibleFrames = React.useCallback(() => {
    if (measureFrameRef.current) return
    measureFrameRef.current = requestAnimationFrame(() =>
      measureVisibleFramesNowRef.current()
    )
  }, [])

  React.useEffect(() => {
    if (measureFrameRef.current) {
      cancelAnimationFrame(measureFrameRef.current)
      measureFrameRef.current = 0
    }
    measureVisibleFramesNow()
  }, [measureVisibleFramesNow])

  React.useEffect(
    () => () => {
      if (measureFrameRef.current) {
        cancelAnimationFrame(measureFrameRef.current)
      }
    },
    []
  )

  return { visibleFrameNumbers, measureVisibleFrames }
}

function areFrameNumbersEqual(
  previousFrameNumbers: readonly number[],
  nextFrameNumbers: readonly number[]
): boolean {
  if (previousFrameNumbers.length !== nextFrameNumbers.length) return false
  return previousFrameNumbers.every(
    (frameNumber, index) => frameNumber === nextFrameNumbers[index]
  )
}
