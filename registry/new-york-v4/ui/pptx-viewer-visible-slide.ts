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
  slideWidth: number
  slideStride: number
  totalHeight: number
}

export interface PptxVirtualSlide {
  height: number
  index: number
  key: string
  slideNumber: number
  top: number
  width: number
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
    slideWidth: visibleSize.width,
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

export function getPptxSlideTop(layout: PptxSlideLayout, slideIndex: number) {
  return layout.slideTopPadding + slideIndex * layout.slideStride
}

export function getPptxVirtualSlides({
  layout,
  overscanSlides = 2,
  scrollTop,
  viewportHeight,
}: {
  layout: PptxSlideLayout
  overscanSlides?: number
  scrollTop: number
  viewportHeight: number
}): PptxVirtualSlide[] {
  if (layout.slideCount === 0) return []

  const safeViewportHeight =
    Number.isFinite(viewportHeight) && viewportHeight > 0
      ? viewportHeight
      : layout.slideHeight
  const safeScrollTop =
    Number.isFinite(scrollTop) && scrollTop > 0 ? scrollTop : 0
  const safeOverscanSlides =
    Number.isFinite(overscanSlides) && overscanSlides > 0
      ? Math.floor(overscanSlides)
      : 0
  const firstVisibleIndex =
    layout.slideStride > 0
      ? Math.floor(
          (safeScrollTop - layout.slideTopPadding) / layout.slideStride
        )
      : 0
  const lastVisibleIndex =
    layout.slideStride > 0
      ? Math.floor(
          (safeScrollTop + safeViewportHeight - layout.slideTopPadding) /
            layout.slideStride
        )
      : 0
  const firstIndex = clamp(
    firstVisibleIndex - safeOverscanSlides,
    0,
    layout.slideCount - 1
  )
  const lastIndex = clamp(
    lastVisibleIndex + safeOverscanSlides,
    0,
    layout.slideCount - 1
  )

  return Array.from(
    { length: lastIndex - firstIndex + 1 },
    (_, offset): PptxVirtualSlide => {
      const index = firstIndex + offset
      const slideNumber = index + 1
      return {
        height: layout.slideHeight,
        index,
        key: String(slideNumber),
        slideNumber,
        top: getPptxSlideTop(layout, index),
        width: layout.slideWidth,
      }
    }
  )
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
