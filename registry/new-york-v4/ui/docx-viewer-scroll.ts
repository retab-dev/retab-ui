import * as React from "react"

import { clamp } from "./docx-viewer-core"

const DOCX_READING_MARKER_RATIO = 0.2

type DocxReadingAnchor =
  | {
      kind: "top"
    }
  | {
      kind: "page"
      pageNumber: number
      yPercent: number
    }

export function useDocxViewerScroll({
  layoutKey,
  onScrollProgressChange,
  onVisiblePageChange,
  ready,
}: {
  layoutKey: unknown
  onScrollProgressChange?: (progress: number) => void
  onVisiblePageChange?: (page: number) => void
  ready: boolean
}) {
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null)
  const lastReported = React.useRef(0)
  const latestAnchorRef = React.useRef<DocxReadingAnchor>({ kind: "top" })
  const committedLayoutKeyRef = React.useRef(layoutKey)
  const [currentPage, setCurrentPage] = React.useState(1)
  const scrollFrame = React.useRef(0)

  const resetScroll = React.useCallback(() => {
    setCurrentPage(1)
    lastReported.current = 0
    latestAnchorRef.current = { kind: "top" }
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
    const marker = rect.top + rect.height * DOCX_READING_MARKER_RATIO
    const pages = viewport.querySelectorAll<HTMLElement>("[data-page-number]")
    let current = 1
    let currentPageElement: HTMLElement | null = null
    for (const el of pages) {
      if (el.getBoundingClientRect().top <= marker) {
        current = Number(el.dataset.pageNumber)
        currentPageElement = el
      } else {
        break
      }
    }
    latestAnchorRef.current = captureDocxReadingAnchor(
      viewport,
      currentPageElement,
      current
    )
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

  React.useLayoutEffect(() => {
    const previousLayoutKey = committedLayoutKeyRef.current
    committedLayoutKeyRef.current = layoutKey
    if (!ready) return
    if (Object.is(previousLayoutKey, layoutKey)) return

    const viewport = scrollViewportRef.current
    if (!viewport) return

    restoreDocxReadingAnchor(viewport, latestAnchorRef.current)
    measureScroll()
  }, [layoutKey, measureScroll, ready])

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

function captureDocxReadingAnchor(
  viewport: HTMLDivElement,
  pageElement: HTMLElement | null,
  pageNumber: number
): DocxReadingAnchor {
  if (viewport.scrollTop <= 0) return { kind: "top" }
  if (!pageElement || pageNumber < 1) return { kind: "top" }

  const viewportRect = viewport.getBoundingClientRect()
  const pageRect = pageElement.getBoundingClientRect()
  if (pageRect.height <= 0) return { kind: "top" }

  const marker =
    viewportRect.top + viewportRect.height * DOCX_READING_MARKER_RATIO
  return {
    kind: "page",
    pageNumber,
    yPercent: clamp((marker - pageRect.top) / pageRect.height, 0, 1),
  }
}

function restoreDocxReadingAnchor(
  viewport: HTMLDivElement,
  anchor: DocxReadingAnchor
) {
  if (anchor.kind === "top") {
    viewport.scrollTop = 0
    return
  }

  const pageElement = viewport.querySelector<HTMLElement>(
    `[data-page-number="${anchor.pageNumber}"]`
  )
  if (!pageElement) return

  const viewportRect = viewport.getBoundingClientRect()
  const pageRect = pageElement.getBoundingClientRect()
  if (pageRect.height <= 0) return

  const marker =
    viewportRect.top + viewportRect.height * DOCX_READING_MARKER_RATIO
  const pageTopInViewport = pageRect.top - viewportRect.top
  const targetTop =
    viewport.scrollTop +
    pageTopInViewport +
    pageRect.height * anchor.yPercent -
    (marker - viewportRect.top)
  const maxScrollTop = Math.max(
    0,
    viewport.scrollHeight - viewport.clientHeight
  )
  viewport.scrollTop = clamp(targetTop, 0, maxScrollTop)
}
