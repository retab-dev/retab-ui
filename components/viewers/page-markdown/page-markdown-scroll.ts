"use client"

import * as React from "react"

import {
  findPageMarkdownPageByOffset,
  getPageMarkdownPageLayout,
  type PageMarkdownLayoutModel,
} from "./page-markdown-layout"
import { clamp } from "./page-markdown-scale"

export function usePageMarkdownScroll({
  layout,
  onScrollProgressChange,
  onVisiblePageChange,
  pageCount,
  resetKey,
}: {
  layout: PageMarkdownLayoutModel
  onScrollProgressChange?: (progress: number) => void
  onVisiblePageChange?: (pageNumber: number) => void
  pageCount: number
  resetKey?: unknown
}) {
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null)
  const lastReportedPageNumberRef = React.useRef(0)
  const scrollFrameRef = React.useRef(0)
  const viewportResetKeyRef = React.useRef<unknown>(resetKey)
  const didMountResetEffectRef = React.useRef(false)
  const [viewportElement, setViewportElementState] =
    React.useState<HTMLDivElement | null>(null)
  const [currentPageState, setCurrentPageState] = React.useState<{
    pageNumber: number
    resetKey: unknown
  }>(() => ({ pageNumber: 1, resetKey }))
  const currentPage = Object.is(currentPageState.resetKey, resetKey)
    ? currentPageState.pageNumber
    : 1

  const resetViewportForKey = React.useCallback(
    (element: HTMLDivElement, key: unknown) => {
      viewportResetKeyRef.current = key
      element.scrollTop = 0
      scrollViewportTo(element, 0, { behavior: "auto" })
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

    const viewportHeight =
      viewportElement.clientHeight ||
      viewportElement.getBoundingClientRect().height
    const scrollable =
      viewportElement.scrollHeight - viewportElement.clientHeight
    const progress =
      scrollable > 0 ? clamp(viewportElement.scrollTop / scrollable, 0, 1) : 0
    onScrollProgressChange?.(progress)

    const markerOffset = viewportElement.scrollTop + viewportHeight * 0.2
    const visiblePageNumber = findPageMarkdownPageByOffset(layout, markerOffset)

    if (
      visiblePageNumber >= 1 &&
      visiblePageNumber <= pageCount &&
      visiblePageNumber !== lastReportedPageNumberRef.current
    ) {
      lastReportedPageNumberRef.current = visiblePageNumber
      setCurrentPageState((previousState) =>
        Object.is(previousState.resetKey, resetKey) &&
        previousState.pageNumber === visiblePageNumber
          ? previousState
          : { pageNumber: visiblePageNumber, resetKey }
      )
      onVisiblePageChange?.(visiblePageNumber)
    }
  }, [layout, onScrollProgressChange, onVisiblePageChange, pageCount, resetKey])
  const measureScrollRef = React.useRef(measureScroll)
  React.useLayoutEffect(() => {
    measureScrollRef.current = measureScroll
  }, [measureScroll])

  const handleScroll = React.useCallback(() => {
    if (scrollFrameRef.current) return
    if (typeof requestAnimationFrame !== "function") {
      measureScrollRef.current()
      return
    }
    scrollFrameRef.current = -1
    const requestedFrame = requestAnimationFrame(() =>
      measureScrollRef.current()
    )
    if (scrollFrameRef.current === -1) {
      scrollFrameRef.current = requestedFrame
    }
  }, [])

  React.useEffect(() => {
    if (!didMountResetEffectRef.current) {
      didMountResetEffectRef.current = true
      return
    }
    lastReportedPageNumberRef.current = 0
    setCurrentPageState((previousState) =>
      Object.is(previousState.resetKey, resetKey) &&
      previousState.pageNumber === 1
        ? previousState
        : { pageNumber: 1, resetKey }
    )
    const viewportElement = viewportElementRef.current
    if (viewportElement) resetViewportForKey(viewportElement, resetKey)
  }, [resetKey, resetViewportForKey])

  const scrollToPage = React.useCallback(
    (pageNumber: number, options?: ScrollToOptions) => {
      const viewportElement = viewportElementRef.current
      if (!viewportElement || pageNumber < 1 || pageNumber > pageCount) return

      const pageLayout = getPageMarkdownPageLayout(layout, pageNumber)
      if (!pageLayout) return

      scrollViewportTo(viewportElement, Math.max(0, pageLayout.offsetTop), {
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
    if (
      scrollFrameRef.current > 0 &&
      typeof cancelAnimationFrame === "function"
    ) {
      cancelAnimationFrame(scrollFrameRef.current)
      scrollFrameRef.current = 0
    }
  }, [measureScroll])

  React.useEffect(
    () => () => {
      if (
        scrollFrameRef.current > 0 &&
        typeof cancelAnimationFrame === "function"
      ) {
        cancelAnimationFrame(scrollFrameRef.current)
      }
    },
    []
  )

  return {
    currentPage,
    getViewportElement,
    handleScroll,
    measureScroll,
    scrollToPage,
    setViewportElement,
    viewportElement,
  }
}

function scrollViewportTo(
  viewportElement: HTMLDivElement,
  top: number,
  options?: ScrollToOptions
) {
  if (typeof viewportElement.scrollTo === "function") {
    viewportElement.scrollTo({ top, ...options })
    return
  }
  viewportElement.scrollTop = top
}
