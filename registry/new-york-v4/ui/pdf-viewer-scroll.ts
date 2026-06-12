import * as React from "react"

import {
  findPdfPageByOffset,
  getPdfPageLayout,
  type PdfPageLayoutModel,
} from "./pdf-viewer-layout"
import { clamp } from "./pdf-viewer-scale"
import type { PdfPageScrollTarget } from "./pdf-viewer-types"

const PDF_SCROLL_TARGET_HEADROOM = 48

export function usePdfScroll({
  pageCount,
  layout,
  onVisiblePageChange,
  onScrollProgressChange,
}: {
  pageCount: number
  layout: PdfPageLayoutModel
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
    const progress =
      scrollable > 0 ? clamp(viewportElement.scrollTop / scrollable, 0, 1) : 0
    onScrollProgressChange?.(progress)

    const viewportRect = viewportElement.getBoundingClientRect()
    const markerOffset = viewportElement.scrollTop + viewportRect.height * 0.2
    const visiblePage = findPdfPageByOffset(layout, markerOffset)

    if (
      visiblePage >= 1 &&
      visiblePage <= pageCount &&
      visiblePage !== lastReportedPageRef.current
    ) {
      lastReportedPageRef.current = visiblePage
      setCurrentPage(visiblePage)
      onVisiblePageChange?.(visiblePage)
    }
  }, [layout, onScrollProgressChange, onVisiblePageChange, pageCount])
  const measureScrollRef = React.useRef(measureScroll)
  measureScrollRef.current = measureScroll

  const handleScroll = React.useCallback(() => {
    if (scrollFrameRef.current) return
    scrollFrameRef.current = requestAnimationFrame(() =>
      measureScrollRef.current()
    )
  }, [])

  const scrollToPageTarget = React.useCallback(
    (
      pageNumber: number,
      target: PdfPageScrollTarget,
      options?: ScrollToOptions
    ) => {
      const viewportElement = viewportElementRef.current
      if (!viewportElement || pageNumber < 1 || pageNumber > pageCount) return

      const pageLayout = getPdfPageLayout(layout, pageNumber)
      if (!pageLayout) return

      const targetTopPercent = clamp(target.top, 0, 100)
      const targetTop =
        pageLayout.offsetTop +
        (targetTopPercent / 100) * pageLayout.height -
        PDF_SCROLL_TARGET_HEADROOM

      viewportElement.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
        ...options,
      })
    },
    [layout, pageCount]
  )
  const getViewportElement = React.useCallback(
    () => viewportElementRef.current,
    []
  )

  React.useEffect(() => {
    if (scrollFrameRef.current) {
      cancelAnimationFrame(scrollFrameRef.current)
      scrollFrameRef.current = 0
    }
  }, [measureScroll])

  React.useEffect(
    () => () => {
      if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current)
    },
    []
  )

  return {
    currentPage,
    viewportElement,
    setViewportElement,
    measureScroll,
    handleScroll,
    scrollToPageTarget,
    getViewportElement,
  }
}
