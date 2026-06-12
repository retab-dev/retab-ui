"use client"

import * as React from "react"

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

  const handleScroll = React.useCallback(() => {
    const viewport = scrollViewportRef.current
    if (!viewport) return

    const scrollable = viewport.scrollHeight - viewport.clientHeight
    onScrollProgressChange?.(
      scrollable > 0 ? viewport.scrollTop / scrollable : 0
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
