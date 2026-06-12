"use client"

import * as React from "react"

import { clamp } from "./pptx-viewer-core"

export interface PptxVisibleSlideInput {
  onVisibleSlideChange?: (slide: number) => void
  onScrollProgressChange?: (progress: number) => void
}

export function usePptxVisibleSlide({
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

    const rect = viewport.getBoundingClientRect()
    const marker = rect.top + rect.height * 0.2
    const slides = viewport.querySelectorAll<HTMLElement>("[data-slide-number]")
    let visibleSlide = 1
    for (const slide of slides) {
      if (slide.getBoundingClientRect().top <= marker) {
        visibleSlide = Number(slide.dataset.slideNumber)
      } else {
        break
      }
    }

    if (visibleSlide && visibleSlide !== lastReportedSlide.current) {
      lastReportedSlide.current = visibleSlide
      setCurrentSlide(visibleSlide)
      onVisibleSlideChange?.(visibleSlide)
    }
  }, [onScrollProgressChange, onVisibleSlideChange])

  return { currentSlide, handleScroll, scrollViewportRef }
}
