import * as React from "react"

import {
  findPdfPageByOffset,
  getPdfPageLayout,
  type PdfPageLayoutModel,
} from "./pdf-viewer-layout"
import { clamp } from "./pdf-viewer-scale"
import type { PdfPageAreaTarget } from "./pdf-viewer-types"

const PDF_SCROLL_TARGET_HEADROOM = 48
const PDF_SCROLL_TARGET_INLINE_HEADROOM = 32
const PDF_READING_MARKER_RATIO = 0.2

type PdfReadingAnchor =
  | {
      kind: "top"
    }
  | {
      kind: "page"
      pageNumber: number
      yPercent: number
    }

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

    const markerOffset =
      viewportElement.scrollTop +
      viewportElement.clientHeight * PDF_READING_MARKER_RATIO
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

  const committedLayoutRef = React.useRef(layout)
  const committedResetKeyRef = React.useRef<unknown>(resetKey)

  React.useLayoutEffect(() => {
    const previousLayout = committedLayoutRef.current
    const previousResetKey = committedResetKeyRef.current
    committedLayoutRef.current = layout
    committedResetKeyRef.current = resetKey

    if (!Object.is(previousResetKey, resetKey)) return
    if (Object.is(previousLayout, layout)) return

    const viewportElement = viewportElementRef.current
    if (!viewportElement) return

    const anchor = capturePdfReadingAnchor(previousLayout, viewportElement)
    if (!anchor) return

    restorePdfReadingAnchor(layout, viewportElement, anchor)
  }, [layout, resetKey])

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
      const targetHeightPercent = normalizeOptionalPercent(target.height)
      const areaTop =
        pageLayout.offsetTop + (targetTopPercent / 100) * pageLayout.height
      const areaBottom =
        areaTop + ((targetHeightPercent ?? 0) / 100) * pageLayout.height
      const visibleTop = viewportElement.scrollTop + PDF_SCROLL_TARGET_HEADROOM
      const visibleBottom =
        viewportElement.scrollTop +
        viewportElement.clientHeight -
        PDF_SCROLL_TARGET_HEADROOM
      let targetTop = areaTop - PDF_SCROLL_TARGET_HEADROOM

      if (targetHeightPercent != null && areaTop >= visibleTop) {
        targetTop =
          areaBottom > visibleBottom
            ? areaBottom -
              viewportElement.clientHeight +
              PDF_SCROLL_TARGET_HEADROOM
            : viewportElement.scrollTop
      }

      const targetLeft = getPdfPageAreaScrollLeft(viewportElement, layout, {
        pageLayout,
        left: target.left,
        width: target.width,
      })

      viewportElement.scrollTo({
        top: Math.max(0, targetTop),
        ...(targetLeft == null ? null : { left: targetLeft }),
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

function getPdfPageAreaScrollLeft(
  viewportElement: HTMLDivElement,
  layout: PdfPageLayoutModel,
  target: {
    pageLayout: NonNullable<ReturnType<typeof getPdfPageLayout>>
    left?: number
    width?: number
  }
) {
  const targetLeftPercent = normalizeOptionalPercent(target.left)
  const targetWidthPercent = normalizeOptionalPercent(target.width)
  if (targetLeftPercent == null || targetWidthPercent == null) return undefined

  const documentInlineOffset = Math.max(
    0,
    (viewportElement.clientWidth - layout.maxPageWidth) / 2
  )
  const pageInlineOffset =
    documentInlineOffset + (layout.maxPageWidth - target.pageLayout.width) / 2
  const areaLeft =
    pageInlineOffset + (targetLeftPercent / 100) * target.pageLayout.width
  const areaRight =
    areaLeft + (targetWidthPercent / 100) * target.pageLayout.width
  const visibleLeft =
    viewportElement.scrollLeft + PDF_SCROLL_TARGET_INLINE_HEADROOM
  const visibleRight =
    viewportElement.scrollLeft +
    viewportElement.clientWidth -
    PDF_SCROLL_TARGET_INLINE_HEADROOM

  if (areaLeft < visibleLeft) {
    return Math.max(0, areaLeft - PDF_SCROLL_TARGET_INLINE_HEADROOM)
  }
  if (areaRight > visibleRight) {
    return Math.max(
      0,
      areaRight -
        viewportElement.clientWidth +
        PDF_SCROLL_TARGET_INLINE_HEADROOM
    )
  }
  return viewportElement.scrollLeft
}

function normalizeOptionalPercent(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return undefined
  return clamp(value, 0, 100)
}

function capturePdfReadingAnchor(
  layout: PdfPageLayoutModel,
  viewportElement: HTMLDivElement
): PdfReadingAnchor | null {
  if (layout.pageCount === 0) return null
  if (viewportElement.scrollTop <= 0) return { kind: "top" }

  const viewportHeight = viewportElement.clientHeight
  const markerOffset =
    viewportElement.scrollTop + viewportHeight * PDF_READING_MARKER_RATIO
  const pageNumber = findPdfPageByOffset(layout, markerOffset)
  const pageLayout = getPdfPageLayout(layout, pageNumber)
  if (!pageLayout || pageLayout.height <= 0) return null

  return {
    kind: "page",
    pageNumber,
    yPercent: clamp(
      (markerOffset - pageLayout.offsetTop) / pageLayout.height,
      0,
      1
    ),
  }
}

function restorePdfReadingAnchor(
  layout: PdfPageLayoutModel,
  viewportElement: HTMLDivElement,
  anchor: PdfReadingAnchor
) {
  if (anchor.kind === "top") {
    viewportElement.scrollTop = 0
    return
  }

  const pageLayout = getPdfPageLayout(layout, anchor.pageNumber)
  if (!pageLayout) return

  const viewportHeight = viewportElement.clientHeight
  const targetTop =
    pageLayout.offsetTop +
    pageLayout.height * anchor.yPercent -
    viewportHeight * PDF_READING_MARKER_RATIO
  const maxScrollTop = Math.max(
    0,
    layout.totalHeight - viewportElement.clientHeight
  )
  viewportElement.scrollTop = clamp(targetTop, 0, maxScrollTop)
}
