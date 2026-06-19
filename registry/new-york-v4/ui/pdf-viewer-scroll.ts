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
const PDF_SCROLL_IDLE_MS = 120
const PDF_SCROLL_POSITION_EPSILON = 1

type PdfReadingAnchor =
  | {
      kind: "top"
    }
  | {
      kind: "page"
      pageNumber: number
      yPercent: number
    }

type PdfScrollIntent =
  | {
      kind: "idle"
    }
  | {
      kind: "user"
    }
  | {
      kind: "programmatic"
      behavior: ScrollBehavior
      sequence: number
      target: PdfPageAreaTarget
      targetTop: number
      targetLeft?: number
    }

type PdfResolvedPageAreaTarget = {
  top: number
  left?: number
}

export function usePdfScrollActivity() {
  const [isScrolling, setIsScrolling] = React.useState(false)
  const [scrollDirection, setScrollDirection] = React.useState(1)
  const idleTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const scrollTopRef = React.useRef(0)

  const handleScrollActivity = React.useCallback((viewport?: HTMLElement) => {
    const scrollTop = viewport?.scrollTop ?? scrollTopRef.current
    const previousScrollTop = scrollTopRef.current
    if (scrollTop > previousScrollTop) {
      setScrollDirection(1)
    } else if (scrollTop < previousScrollTop) {
      setScrollDirection(-1)
    }
    scrollTopRef.current = scrollTop

    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
    }

    setIsScrolling(true)
    idleTimeoutRef.current = setTimeout(() => {
      idleTimeoutRef.current = null
      setIsScrolling(false)
    }, PDF_SCROLL_IDLE_MS)
  }, [])

  React.useEffect(
    () => () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current)
    },
    []
  )

  return { isScrolling, scrollDirection, handleScrollActivity }
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
  const scrollIntentRef = React.useRef<PdfScrollIntent>({ kind: "idle" })
  const scrollIntentSequenceRef = React.useRef(0)
  const programmaticScrollIdleTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null)
  const [viewportElement, setViewportElementState] =
    React.useState<HTMLDivElement | null>(null)
  const [currentPageState, setCurrentPageState] = React.useState<{
    resetKey: unknown
    page: number
  }>(() => ({ resetKey, page: 1 }))
  const currentPage = Object.is(currentPageState.resetKey, resetKey)
    ? currentPageState.page
    : 1

  const clearProgrammaticScrollIdleTimeout = React.useCallback(() => {
    if (programmaticScrollIdleTimeoutRef.current) {
      clearTimeout(programmaticScrollIdleTimeoutRef.current)
      programmaticScrollIdleTimeoutRef.current = null
    }
  }, [])

  const completeProgrammaticScroll = React.useCallback(
    (sequence: number) => {
      if (
        scrollIntentRef.current.kind === "programmatic" &&
        scrollIntentRef.current.sequence === sequence
      ) {
        scrollIntentRef.current = { kind: "idle" }
      }
      clearProgrammaticScrollIdleTimeout()
    },
    [clearProgrammaticScrollIdleTimeout]
  )

  const scheduleProgrammaticScrollCompletion = React.useCallback(
    (sequence: number) => {
      clearProgrammaticScrollIdleTimeout()
      programmaticScrollIdleTimeoutRef.current = setTimeout(() => {
        completeProgrammaticScroll(sequence)
      }, PDF_SCROLL_IDLE_MS)
    },
    [clearProgrammaticScrollIdleTimeout, completeProgrammaticScroll]
  )

  const markUserScrollIntent = React.useCallback(() => {
    clearProgrammaticScrollIdleTimeout()
    scrollIntentRef.current = { kind: "user" }
  }, [clearProgrammaticScrollIdleTimeout])

  const resetViewportForKey = React.useCallback(
    (element: HTMLDivElement, key: unknown) => {
      viewportResetKeyRef.current = key
      clearProgrammaticScrollIdleTimeout()
      scrollIntentRef.current = { kind: "idle" }
      setViewportScrollTop(element, 0)
      element.scrollTo?.({ top: 0, behavior: "auto" })
    },
    [clearProgrammaticScrollIdleTimeout]
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

    const scrollIntent = scrollIntentRef.current
    if (scrollIntent.kind === "programmatic") {
      const target = getPdfPageAreaScrollTarget(
        viewportElement,
        layout,
        pageCount,
        scrollIntent.target
      )
      if (!target) return

      const targetChanged =
        Math.abs(scrollIntent.targetTop - target.top) >
          PDF_SCROLL_POSITION_EPSILON ||
        Math.abs((scrollIntent.targetLeft ?? 0) - (target.left ?? 0)) >
          PDF_SCROLL_POSITION_EPSILON

      scrollIntent.targetTop = target.top
      scrollIntent.targetLeft = target.left
      if (targetChanged) {
        scrollViewportToPageAreaTarget(viewportElement, target, {
          behavior: scrollIntent.behavior,
        })
        scheduleProgrammaticScrollCompletion(scrollIntent.sequence)
      }
      return
    }

    const anchor = capturePdfReadingAnchor(previousLayout, viewportElement)
    if (!anchor) return

    restorePdfReadingAnchor(layout, viewportElement, anchor)
  }, [layout, pageCount, resetKey, scheduleProgrammaticScrollCompletion])

  const handleScroll = React.useCallback(() => {
    const scrollIntent = scrollIntentRef.current
    if (scrollIntent.kind === "programmatic") {
      scheduleProgrammaticScrollCompletion(scrollIntent.sequence)
    } else {
      scrollIntentRef.current = { kind: "user" }
    }

    if (scrollFrameRef.current) return
    scrollFrameRef.current = requestAnimationFrame(() =>
      measureScrollRef.current()
    )
  }, [scheduleProgrammaticScrollCompletion])

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

  React.useEffect(() => {
    const viewportElement = viewportElementRef.current
    if (!viewportElement) return

    const handleScrollEnd = () => {
      const scrollIntent = scrollIntentRef.current
      if (scrollIntent.kind === "programmatic") {
        completeProgrammaticScroll(scrollIntent.sequence)
      } else {
        scrollIntentRef.current = { kind: "idle" }
      }
    }

    viewportElement.addEventListener?.("wheel", markUserScrollIntent, {
      passive: true,
    })
    viewportElement.addEventListener?.("touchstart", markUserScrollIntent, {
      passive: true,
    })
    viewportElement.addEventListener?.("pointerdown", markUserScrollIntent)
    viewportElement.addEventListener?.("keydown", markUserScrollIntent)
    viewportElement.addEventListener?.("scrollend", handleScrollEnd)

    return () => {
      viewportElement.removeEventListener?.("wheel", markUserScrollIntent)
      viewportElement.removeEventListener?.("touchstart", markUserScrollIntent)
      viewportElement.removeEventListener?.("pointerdown", markUserScrollIntent)
      viewportElement.removeEventListener?.("keydown", markUserScrollIntent)
      viewportElement.removeEventListener?.("scrollend", handleScrollEnd)
    }
  }, [completeProgrammaticScroll, markUserScrollIntent, viewportElement])

  const scrollToPageArea = React.useCallback(
    (target: PdfPageAreaTarget, options?: ScrollToOptions) => {
      const viewportElement = viewportElementRef.current
      const pageAreaTarget = viewportElement
        ? getPdfPageAreaScrollTarget(viewportElement, layout, pageCount, target)
        : null
      if (!viewportElement || !pageAreaTarget) return

      const behavior = options?.behavior ?? "smooth"
      const sequence = scrollIntentSequenceRef.current + 1
      scrollIntentSequenceRef.current = sequence
      clearProgrammaticScrollIdleTimeout()
      scrollIntentRef.current = {
        kind: "programmatic",
        behavior,
        sequence,
        target: copyPdfPageAreaTarget(target),
        targetTop: pageAreaTarget.top,
        targetLeft: pageAreaTarget.left,
      }
      scrollViewportToPageAreaTarget(viewportElement, pageAreaTarget, {
        behavior: "smooth",
        ...options,
      })
      scheduleProgrammaticScrollCompletion(sequence)
    },
    [
      clearProgrammaticScrollIdleTimeout,
      layout,
      pageCount,
      scheduleProgrammaticScrollCompletion,
    ]
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
      clearProgrammaticScrollIdleTimeout()
    },
    [clearProgrammaticScrollIdleTimeout]
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

function getPdfPageAreaScrollTarget(
  viewportElement: HTMLDivElement,
  layout: PdfPageLayoutModel,
  pageCount: number,
  target: PdfPageAreaTarget
): PdfResolvedPageAreaTarget | null {
  const pageNumber = target.pageNumber
  if (pageNumber < 1 || pageNumber > pageCount) return null

  const pageLayout = getPdfPageLayout(layout, pageNumber)
  if (!pageLayout) return null

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
        ? areaBottom - viewportElement.clientHeight + PDF_SCROLL_TARGET_HEADROOM
        : viewportElement.scrollTop
  }

  const targetLeft = getPdfPageAreaScrollLeft(viewportElement, layout, {
    pageLayout,
    left: target.left,
    width: target.width,
  })

  return {
    top: Math.max(0, targetTop),
    ...(targetLeft == null ? null : { left: targetLeft }),
  }
}

function scrollViewportToPageAreaTarget(
  viewportElement: HTMLDivElement,
  target: PdfResolvedPageAreaTarget,
  options: ScrollToOptions
) {
  const hasTopChange =
    Math.abs(viewportElement.scrollTop - target.top) >
    PDF_SCROLL_POSITION_EPSILON
  const hasLeftChange =
    target.left != null &&
    Math.abs(viewportElement.scrollLeft - target.left) >
      PDF_SCROLL_POSITION_EPSILON

  if (!hasTopChange && !hasLeftChange) return

  viewportElement.scrollTo({
    top: target.top,
    ...(target.left == null ? null : { left: target.left }),
    ...options,
  })
}

function copyPdfPageAreaTarget(target: PdfPageAreaTarget): PdfPageAreaTarget {
  return {
    pageNumber: target.pageNumber,
    top: target.top,
    left: target.left,
    width: target.width,
    height: target.height,
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
    setViewportScrollTop(viewportElement, 0)
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
  setViewportScrollTop(viewportElement, clamp(targetTop, 0, maxScrollTop))
}

function setViewportScrollTop(
  viewportElement: HTMLDivElement,
  targetTop: number
) {
  if (
    Math.abs(viewportElement.scrollTop - targetTop) <=
    PDF_SCROLL_POSITION_EPSILON
  ) {
    return
  }

  viewportElement.scrollTop = targetTop
}
