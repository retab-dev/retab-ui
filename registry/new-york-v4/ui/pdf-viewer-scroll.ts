import * as React from "react"

import {
  findPdfPageByOffset,
  getPdfPageLayout,
  type PdfPageLayoutModel,
} from "./pdf-viewer-layout"
import { clamp } from "./pdf-viewer-scale"
import type { PdfPageAreaTarget } from "./pdf-viewer-types"

const PDF_SCROLL_TARGET_HEADROOM = 48

export function usePdfScroll({
  pageCount,
  layout,
  resetKey,
  onVisiblePageChange,
  onScrollProgressChange,
}: {
  pageCount: number
  layout: PdfPageLayoutModel
  resetKey?: unknown
  onVisiblePageChange?: (page: number) => void
  onScrollProgressChange?: (progress: number) => void
}) {
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null)
  const lastReportedPageRef = React.useRef(0)
  const scrollFrameRef = React.useRef(0)
  const viewportResetKeyRef = React.useRef<unknown>(resetKey)
  const didMountResetEffectRef = React.useRef(false)
  const [viewportElement, setViewportElementState] =
    React.useState<HTMLDivElement | null>(null)
  const [currentPageState, setCurrentPageState] = React.useState<{
    resetKey: unknown
    page: number
  }>(() => ({ resetKey, page: 1 }))
  const currentPage = Object.is(currentPageState.resetKey, resetKey)
    ? currentPageState.page
    : 1

  const resetViewportForKey = React.useCallback(
    (element: HTMLDivElement, key: unknown) => {
      viewportResetKeyRef.current = key
      element.scrollTop = 0
      element.scrollTo?.({ top: 0, behavior: "auto" })
    },
    []
  )

  const setViewportElement = React.useCallback(
    (element: HTMLDivElement | null) => {
      viewportElementRef.current = element
      if (element && !Object.is(viewportResetKeyRef.current, resetKey)) {
        resetViewportForKey(element, resetKey)
      }
      setViewportElementState(element)
    },
    [resetKey, resetViewportForKey]
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
      setCurrentPageState((previousState) =>
        Object.is(previousState.resetKey, resetKey) &&
        previousState.page === visiblePage
          ? previousState
          : { resetKey, page: visiblePage }
      )
      onVisiblePageChange?.(visiblePage)
    }
  }, [layout, onScrollProgressChange, onVisiblePageChange, pageCount, resetKey])
  const measureScrollRef = React.useRef(measureScroll)
  React.useLayoutEffect(() => {
    measureScrollRef.current = measureScroll
  }, [measureScroll])

  const handleScroll = React.useCallback(() => {
    if (scrollFrameRef.current) return
    scrollFrameRef.current = requestAnimationFrame(() =>
      measureScrollRef.current()
    )
  }, [])

  React.useEffect(() => {
    if (!didMountResetEffectRef.current) {
      didMountResetEffectRef.current = true
      return
    }
    lastReportedPageRef.current = 0
    setCurrentPageState((previousState) =>
      Object.is(previousState.resetKey, resetKey) && previousState.page === 1
        ? previousState
        : { resetKey, page: 1 }
    )
    const viewportElement = viewportElementRef.current
    if (viewportElement) {
      resetViewportForKey(viewportElement, resetKey)
    }
  }, [resetKey, resetViewportForKey])

  const scrollToPageArea = React.useCallback(
    (target: PdfPageAreaTarget, options?: ScrollToOptions) => {
      const viewportElement = viewportElementRef.current
      const pageNumber = target.pageNumber
      if (!viewportElement || pageNumber < 1 || pageNumber > pageCount) return

      const pageLayout = getPdfPageLayout(layout, pageNumber)
      if (!pageLayout) return

      const requestedTop = Number.isNaN(target.top) ? 0 : target.top
      const targetTopPercent = clamp(requestedTop, 0, 100)
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
  const scrollToPage = React.useCallback(
    (pageNumber: number, options?: ScrollToOptions) => {
      scrollToPageArea({ pageNumber, top: 0 }, options)
    },
    [scrollToPageArea]
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
    scrollToPage,
    scrollToPageArea,
    getViewportElement,
  }
}
