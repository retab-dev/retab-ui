"use client"

import * as React from "react"

import {
  clamp,
  getScaledSlideSize,
  getVisibleSlideSize,
  type PptxSize,
} from "./pptx-viewer-core"

export interface PptxSlideLayout {
  slideCount: number
  slideTopPadding: number
  slideGap: number
  slideHeight: number
  slideStride: number
  totalHeight: number
}

export interface PptxSlideLayoutInput {
  baseSize: PptxSize
  zoomScale: number
  rotation: number
  slideCount: number
  slideGap: number
  slidePadding: number
}

export interface PptxVisibleSlideInput {
  layout: PptxSlideLayout
  onVisibleSlideChange?: (slide: number) => void
  onScrollProgressChange?: (progress: number) => void
}

export function createPptxSlideLayout({
  baseSize,
  zoomScale,
  rotation,
  slideCount,
  slideGap,
  slidePadding,
}: PptxSlideLayoutInput): PptxSlideLayout {
  const slideSize = getScaledSlideSize(baseSize, zoomScale)
  const visibleSize = getVisibleSlideSize(slideSize, rotation)
  const normalizedSlideCount = Number.isFinite(slideCount)
    ? Math.max(0, Math.floor(slideCount))
    : 0
  const normalizedSlideGap =
    Number.isFinite(slideGap) && slideGap > 0 ? slideGap : 0
  const normalizedSlidePadding =
    Number.isFinite(slidePadding) && slidePadding > 0 ? slidePadding : 0
  const gapCount = Math.max(0, normalizedSlideCount - 1)

  return {
    slideCount: normalizedSlideCount,
    slideTopPadding: normalizedSlidePadding,
    slideGap: normalizedSlideGap,
    slideHeight: visibleSize.height,
    slideStride: visibleSize.height + normalizedSlideGap,
    totalHeight:
      normalizedSlidePadding * 2 +
      visibleSize.height * normalizedSlideCount +
      normalizedSlideGap * gapCount,
  }
}

export function getPptxSlideAtScrollMarker(
  layout: PptxSlideLayout,
  markerScrollTop: number
) {
  if (layout.slideCount <= 1 || layout.slideStride <= 0) return 1

  const slideIndex = Math.floor(
    (markerScrollTop - layout.slideTopPadding) / layout.slideStride
  )
  return clamp(slideIndex + 1, 1, layout.slideCount)
}

export function usePptxVisibleSlide({
  layout,
  onVisibleSlideChange,
  onScrollProgressChange,
}: PptxVisibleSlideInput) {
  const [currentSlide, setCurrentSlide] = React.useState(1)
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null)
  const lastReportedSlide = React.useRef(0)
  const lastVisibleSlideCallback = React.useRef(onVisibleSlideChange)

  if (lastVisibleSlideCallback.current !== onVisibleSlideChange) {
    lastVisibleSlideCallback.current = onVisibleSlideChange
    lastReportedSlide.current = 0
  }

  const handleScroll = React.useCallback(() => {
    const viewport = scrollViewportRef.current
    if (!viewport) return

    const scrollable = viewport.scrollHeight - viewport.clientHeight
    onScrollProgressChange?.(
      scrollable > 0 ? clamp(viewport.scrollTop / scrollable, 0, 1) : 0
    )

    const markerScrollTop = viewport.scrollTop + viewport.clientHeight * 0.2
    const visibleSlide = getPptxSlideAtScrollMarker(layout, markerScrollTop)

    if (visibleSlide && visibleSlide !== lastReportedSlide.current) {
      lastReportedSlide.current = visibleSlide
      setCurrentSlide(visibleSlide)
      onVisibleSlideChange?.(visibleSlide)
    }
  }, [layout, onScrollProgressChange, onVisibleSlideChange])

  return { currentSlide, handleScroll, scrollViewportRef }
}
