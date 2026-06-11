import * as React from "react"

import { clamp } from "./pdf-viewer-scale"
import type { PdfPageArea } from "./pdf-viewer-types"

export type PdfScrollHandle = {
  scrollToPageArea: (
    pageNumber: number,
    area: PdfPageArea,
    options?: ScrollToOptions
  ) => void
  getViewportElement: () => HTMLDivElement | null
}

const SCROLL_HEADROOM = 48

export function usePdfScroll({
  pageCount,
  onVisiblePageChange,
  onScrollProgressChange,
}: {
  pageCount: number
  onVisiblePageChange?: (page: number) => void
  onScrollProgressChange?: (progress: number) => void
}) {
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null)
  const lastReportedPageRef = React.useRef(0)
  const scrollFrameRef = React.useRef(0)
  const [viewportElement, setViewportElementState] =
    React.useState<HTMLDivElement | null>(null)
  const [currentPage, setCurrentPage] = React.useState(1)

  const setViewportElement = React.useCallback(
    (element: HTMLDivElement | null) => {
      viewportElementRef.current = element
      setViewportElementState(element)
    },
    []
  )

  const measureScroll = React.useCallback(() => {
    scrollFrameRef.current = 0
    const viewportElement = viewportElementRef.current
    if (!viewportElement) return

    const scrollable =
      viewportElement.scrollHeight - viewportElement.clientHeight
    onScrollProgressChange?.(
      scrollable > 0 ? viewportElement.scrollTop / scrollable : 0
    )

    const viewportRect = viewportElement.getBoundingClientRect()
    const marker = viewportRect.top + viewportRect.height * 0.2
    const pageSlots =
      viewportElement.querySelectorAll<HTMLElement>("[data-page-number]")
    let visiblePage = 1
    for (const pageSlot of pageSlots) {
      if (pageSlot.getBoundingClientRect().top <= marker) {
        visiblePage = Number(pageSlot.dataset.pageNumber)
      } else {
        break
      }
    }

    if (
      visiblePage >= 1 &&
      visiblePage <= pageCount &&
      visiblePage !== lastReportedPageRef.current
    ) {
      lastReportedPageRef.current = visiblePage
      setCurrentPage(visiblePage)
      onVisiblePageChange?.(visiblePage)
    }
  }, [onScrollProgressChange, onVisiblePageChange, pageCount])

  const handleScroll = React.useCallback(() => {
    if (scrollFrameRef.current) return
    scrollFrameRef.current = requestAnimationFrame(measureScroll)
  }, [measureScroll])

  const scrollToPageArea = React.useCallback(
    (pageNumber: number, area: PdfPageArea, options?: ScrollToOptions) => {
      const viewportElement = viewportElementRef.current
      if (!viewportElement || pageNumber < 1 || pageNumber > pageCount) return

      const pageSlot = viewportElement.querySelector<HTMLElement>(
        `[data-page-number="${pageNumber}"]`
      )
      if (!pageSlot) return

      const pageSlotRect = pageSlot.getBoundingClientRect()
      const viewportRect = viewportElement.getBoundingClientRect()
      const pageTop =
        pageSlotRect.top - viewportRect.top + viewportElement.scrollTop
      const areaTop = clamp(area.top, 0, 100)
      const targetTop =
        pageTop + (areaTop / 100) * pageSlotRect.height - SCROLL_HEADROOM

      viewportElement.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
        ...options,
      })
    },
    [pageCount]
  )
  const getViewportElement = React.useCallback(
    () => viewportElementRef.current,
    []
  )

  React.useEffect(
    () => () => {
      if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current)
    },
    []
  )

  return {
    currentPage,
    viewportElement,
    viewportElementRef,
    setViewportElement,
    measureScroll,
    handleScroll,
    scrollToPageArea,
    getViewportElement,
  }
}
