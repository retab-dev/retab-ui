import * as React from "react"

import { clamp } from "./docx-viewer-core"

export function useDocxViewerScroll({
  onScrollProgressChange,
  onVisiblePageChange,
  ready,
}: {
  onScrollProgressChange?: (progress: number) => void
  onVisiblePageChange?: (page: number) => void
  ready: boolean
}) {
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null)
  const lastReported = React.useRef(0)
  const [currentPage, setCurrentPage] = React.useState(1)
  const scrollFrame = React.useRef(0)

  const resetScroll = React.useCallback(() => {
    setCurrentPage(1)
    lastReported.current = 0
    if (scrollViewportRef.current) scrollViewportRef.current.scrollTop = 0
  }, [])

  const measureScroll = React.useCallback(() => {
    scrollFrame.current = 0
    const viewport = scrollViewportRef.current
    if (!viewport) return
    const scrollable = viewport.scrollHeight - viewport.clientHeight
    onScrollProgressChange?.(
      scrollable > 0 ? clamp(viewport.scrollTop / scrollable, 0, 1) : 0
    )
    const rect = viewport.getBoundingClientRect()
    const marker = rect.top + rect.height * 0.2
    const pages = viewport.querySelectorAll<HTMLElement>("[data-page-number]")
    let current = 1
    for (const el of pages) {
      if (el.getBoundingClientRect().top <= marker) {
        current = Number(el.dataset.pageNumber)
      } else {
        break
      }
    }
    if (current && current !== lastReported.current) {
      lastReported.current = current
      setCurrentPage(current)
      onVisiblePageChange?.(current)
    }
  }, [onScrollProgressChange, onVisiblePageChange])

  const handleScroll = React.useCallback(() => {
    if (scrollFrame.current) return
    scrollFrame.current = -1
    const requestedFrame = requestAnimationFrame(measureScroll)
    if (scrollFrame.current === -1) scrollFrame.current = requestedFrame
  }, [measureScroll])

  React.useEffect(() => {
    if (ready) measureScroll()
  }, [measureScroll, ready])

  React.useEffect(
    () => () => {
      if (scrollFrame.current > 0) cancelAnimationFrame(scrollFrame.current)
    },
    []
  )

  return {
    currentPage,
    handleScroll,
    measureScroll,
    resetScroll,
    scrollViewportRef,
  }
}
