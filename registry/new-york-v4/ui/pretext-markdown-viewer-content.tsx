"use client"

import * as React from "react"

import type { ViewerResource } from "@/lib/viewer-resource"

import {
  createPretextMarkdownDocument,
  findPretextMarkdownHeadingById,
  findPretextMarkdownPageForLine,
  getPretextMarkdownVisiblePageFrames,
  layoutPretextMarkdownDocument,
  markdownPageIntersectsLineRange,
  type PretextMarkdownDocumentFrame,
  type PretextMarkdownPageFrame,
} from "./pretext-markdown-document-model"
import { PretextMarkdownPageRenderer } from "./pretext-markdown-renderer"
import { ScrollArea } from "./scroll-area"
import { TextViewerFrame, TextViewerToolbar } from "./text-viewer-chrome"
import { normalizeTextLineRange } from "./text-viewer-ranges"
import {
  readTextResource,
  resolvedTextViewerBounds,
} from "./text-viewer-resource"
import { clampTextViewerScale } from "./text-viewer-scale"
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types"

const VIEWER_HORIZONTAL_PADDING = 16
const DEFAULT_VIEWPORT_HEIGHT = 600
const DEFAULT_VIEWPORT_WIDTH = 800
const INITIAL_CONTENT_WIDTH = 768
const OVERSCAN_PX = 640

type ViewportSize = {
  height: number
  width: number
}

type ScrollAnchor = {
  offsetWithinPage: number
  pageIndex: number
}

export function PretextMarkdownViewerContent({
  resource,
  className,
  toolbar = true,
  highlight,
  bare = false,
  maxBytes,
  maxLines,
  retryVersion,
  forwardedRef,
}: TextViewerProps & {
  resource: ViewerResource
  retryVersion: number
  forwardedRef?: React.ForwardedRef<TextViewerHandle>
}) {
  const bounds = React.useMemo(
    () => resolvedTextViewerBounds({ maxBytes, maxLines }),
    [maxBytes, maxLines]
  )
  const text = React.useMemo(
    () =>
      readTextResource({
        bounds,
        content: resource.content,
        retryVersion,
      }),
    [bounds, resource.content, retryVersion]
  )
  const downloadAction = React.useMemo(
    () => resource.originalDownload,
    [resource]
  )
  const [fontScale, setFontScale] = React.useState(1)
  const [scrollTop, setScrollTop] = React.useState(0)
  const [measuredHeights, setMeasuredHeights] = React.useState(
    () => new Map<number, number>()
  )
  const pendingScrollAnchorRef = React.useRef<ScrollAnchor | null>(null)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const fontEpoch = useTextViewerFontEpoch()
  const [contentWidth, setContentWidth] = React.useState(INITIAL_CONTENT_WIDTH)
  const [viewportSize, setViewportSize] = React.useState<ViewportSize>({
    height: 0,
    width: 0,
  })
  const viewportHeight = viewportSize.height || DEFAULT_VIEWPORT_HEIGHT
  const viewportWidth = viewportSize.width || DEFAULT_VIEWPORT_WIDTH

  const document = React.useMemo(
    () => createPretextMarkdownDocument(text),
    [text]
  )
  const frame = React.useMemo(() => {
    void fontEpoch
    return layoutPretextMarkdownDocument({
      contentWidth,
      document,
      fontScale,
      measuredHeights,
    })
  }, [contentWidth, document, fontEpoch, fontScale, measuredHeights])
  const highlightStart = highlight?.start
  const highlightEnd = highlight?.end
  const highlightRange = React.useMemo(
    () =>
      normalizeTextLineRange(
        highlightStart == null || highlightEnd == null
          ? null
          : { end: highlightEnd, start: highlightStart },
        document.sourceLineCount
      ),
    [document.sourceLineCount, highlightEnd, highlightStart]
  )
  const visibleFrames = React.useMemo(
    () =>
      getPretextMarkdownVisiblePageFrames({
        frames: frame.pages,
        overscanPx: OVERSCAN_PX,
        scrollTop,
        viewportHeight,
      }),
    [frame.pages, scrollTop, viewportHeight]
  )

  const captureScrollAnchor = React.useCallback(() => {
    pendingScrollAnchorRef.current = getFrameScrollAnchor({
      frame,
      scrollTop: viewportRef.current?.scrollTop ?? scrollTop,
    })
  }, [frame, scrollTop])

  React.useLayoutEffect(() => {
    setMeasuredHeights(new Map())
  }, [document])

  React.useLayoutEffect(() => {
    const scrollElement = viewportRef.current
    if (!scrollElement) return

    const readViewportSize = () => {
      const nextWidth = scrollElement.clientWidth
      const nextHeight = scrollElement.clientHeight
      setViewportSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { height: nextHeight, width: nextWidth }
      )
    }

    readViewportSize()
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(readViewportSize)
    resizeObserver?.observe(scrollElement)

    return () => {
      resizeObserver?.disconnect()
    }
  }, [])

  React.useLayoutEffect(() => {
    const nextContentWidth = Math.max(
      1,
      viewportWidth - VIEWER_HORIZONTAL_PADDING * 2
    )
    setContentWidth((current) => {
      if (current === nextContentWidth) return current
      captureScrollAnchor()
      return nextContentWidth
    })
  }, [captureScrollAnchor, viewportWidth])

  React.useLayoutEffect(() => {
    const anchor = pendingScrollAnchorRef.current
    const scrollElement = viewportRef.current
    if (!anchor || !scrollElement) return

    pendingScrollAnchorRef.current = null
    const nextFrame = frame.pages[anchor.pageIndex]
    if (!nextFrame) return

    scrollElement.scrollTop = Math.max(
      0,
      nextFrame.top +
        Math.min(anchor.offsetWithinPage, Math.max(0, nextFrame.height - 1))
    )
  }, [frame.pages])

  const recordMeasuredHeight = React.useCallback(
    (pageIndex: number, height: number) => {
      if (!Number.isFinite(height) || height <= 0) return
      setMeasuredHeights((current) => {
        if (Math.abs((current.get(pageIndex) ?? 0) - height) < 1) {
          return current
        }
        captureScrollAnchor()
        const next = new Map(current)
        next.set(pageIndex, height)
        return next
      })
    },
    [captureScrollAnchor]
  )

  const scrollLineRange = React.useCallback(
    (
      range: ReturnType<typeof normalizeTextLineRange>,
      options?: ScrollToOptions
    ) => {
      const scrollElement = viewportRef.current
      if (!scrollElement || !range) return

      const page =
        findPretextMarkdownPageForLine(document.pages, range.start) ??
        document.pages[0]
      const targetFrame = page ? frame.pages[page.index] : null
      if (!targetFrame) return

      const targetTop =
        targetFrame.height <= scrollElement.clientHeight
          ? targetFrame.top -
            (scrollElement.clientHeight - targetFrame.height) / 2
          : targetFrame.top

      scrollElement.scrollTo({
        behavior: "smooth",
        top: Math.max(0, targetTop),
        ...options,
      })
    },
    [document.pages, frame.pages]
  )

  const scrollToPageFrame = React.useCallback(
    (pageIndex: number, options?: ScrollToOptions) => {
      const scrollElement = viewportRef.current
      const targetFrame = frame.pages[pageIndex]
      if (!scrollElement || !targetFrame) return false

      scrollElement.scrollTo({
        behavior: "smooth",
        top: Math.max(0, targetFrame.top),
        ...options,
      })
      return true
    },
    [frame.pages]
  )

  const handleFragmentClick = React.useCallback(
    (event: React.MouseEvent) => {
      const href = localFragmentHrefFromEventTarget(event.target)
      if (!href) return

      const headingId = decodeMarkdownFragmentHref(href)
      const heading = findPretextMarkdownHeadingById(document, headingId)
      if (!heading) return

      event.preventDefault()
      if (scrollToPageFrame(heading.pageIndex)) {
        if (window.location.hash !== href) {
          window.history.replaceState(null, "", href)
        }
      }
    },
    [document, scrollToPageFrame]
  )

  const zoom = (factor: number) => {
    captureScrollAnchor()
    setFontScale((scale) => clampTextViewerScale(scale * factor))
  }

  const resetZoom = () => {
    captureScrollAnchor()
    setFontScale(1)
  }

  React.useImperativeHandle(
    forwardedRef ?? null,
    () => ({
      getViewportElement: () => viewportRef.current,
      scrollToLineRange: (range, options) => {
        scrollLineRange(
          normalizeTextLineRange(range, document.sourceLineCount),
          options
        )
      },
    }),
    [document.sourceLineCount, scrollLineRange]
  )

  React.useEffect(() => {
    scrollLineRange(highlightRange)
  }, [highlightRange, scrollLineRange])

  return (
    <TextViewerFrame className={className} bare={bare}>
      {toolbar ? (
        <TextViewerToolbar
          wordCount={document.wordCount}
          fontScale={fontScale}
          downloadAction={downloadAction}
          onZoomOut={() => zoom(1 / 1.2)}
          onZoomIn={() => zoom(1.2)}
          onResetZoom={resetZoom}
        />
      ) : null}
      <ScrollArea
        className="min-h-0 flex-1 bg-background"
        orientation="vertical"
        viewportClassName="bg-background"
        viewportRef={viewportRef}
        viewportProps={{
          onClickCapture: handleFragmentClick,
          onScroll: (event) => {
            setScrollTop(event.currentTarget.scrollTop)
          },
        }}
      >
        <div
          className="relative min-w-0"
          data-projection="react-gfm-pretext-markdown"
          data-slot="pretext-markdown-virtual-canvas"
          style={{
            height: frame.totalHeight,
            minWidth: viewportWidth,
          }}
        >
          {visibleFrames.map((pageFrame) => {
            const page = document.pages[pageFrame.index]
            if (!page) return null
            return (
              <PretextMarkdownPage
                key={page.index}
                frame={pageFrame}
                highlighted={markdownPageIntersectsLineRange({
                  page,
                  range: highlightRange,
                })}
                onMeasuredHeight={recordMeasuredHeight}
              >
                <PretextMarkdownPageRenderer page={page} />
              </PretextMarkdownPage>
            )
          })}
        </div>
      </ScrollArea>
    </TextViewerFrame>
  )
}

function PretextMarkdownPage({
  children,
  frame,
  highlighted,
  onMeasuredHeight,
}: {
  children: React.ReactNode
  frame: PretextMarkdownPageFrame
  highlighted: boolean
  onMeasuredHeight: (pageIndex: number, height: number) => void
}) {
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === "undefined") return

    const resizeObserver = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height
      if (height != null) onMeasuredHeight(frame.index, height)
    })
    resizeObserver.observe(element)
    return () => {
      resizeObserver.disconnect()
    }
  }, [frame.index, onMeasuredHeight])

  return (
    <div
      ref={ref}
      className={[
        "absolute right-4 left-4 rounded-md px-12 py-10",
        highlighted ? "bg-primary/10 ring-1 ring-primary/25" : "",
      ].join(" ")}
      data-pretext-markdown-page=""
      data-source-end-line={frame.sourceEndLine}
      data-source-start-line={frame.sourceStartLine}
      style={{
        minHeight: frame.estimatedHeight,
        transform: `translateY(${frame.top}px)`,
      }}
    >
      {children}
    </div>
  )
}

function getFrameScrollAnchor({
  frame,
  scrollTop,
}: {
  frame: PretextMarkdownDocumentFrame
  scrollTop: number
}): ScrollAnchor | null {
  if (!frame.pages.length) return null
  const page =
    frame.pages.find((item) => item.bottom > scrollTop) ??
    frame.pages[frame.pages.length - 1]
  if (!page) return null
  return {
    offsetWithinPage: Math.max(0, scrollTop - page.top),
    pageIndex: page.index,
  }
}

function localFragmentHrefFromEventTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null
  const link = target.closest<HTMLAnchorElement>('a[href^="#"]')
  const href = link?.getAttribute("href") ?? null
  return href && href.length > 1 ? href : null
}

function decodeMarkdownFragmentHref(href: string) {
  try {
    return decodeURIComponent(href.slice(1))
  } catch {
    return href.slice(1)
  }
}

function useTextViewerFontEpoch() {
  const [fontEpoch, setFontEpoch] = React.useState(0)

  React.useEffect(() => {
    const fonts = document.fonts
    if (!fonts) return

    let isMounted = true
    void fonts.ready.then(() => {
      if (isMounted) setFontEpoch((epoch) => epoch + 1)
    })

    return () => {
      isMounted = false
    }
  }, [])

  return fontEpoch
}
