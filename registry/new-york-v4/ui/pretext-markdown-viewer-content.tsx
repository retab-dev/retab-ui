"use client"

import * as React from "react"

import type { ViewerResource } from "@/lib/viewer-resource"

import {
  createPretextMarkdownDocument,
  findPretextMarkdownHeadingById,
} from "./pretext-markdown-document-model"
import {
  layoutPretextMarkdownDocument,
  type PretextMarkdownChunkFrame,
} from "./pretext-markdown-layout"
import { PretextMarkdownChunkRenderer } from "./pretext-markdown-renderer"
import {
  patchPretextMarkdownChunkTables,
  pretextMarkdownChunkId,
} from "./pretext-markdown-table-accessibility"
import {
  getPretextMarkdownFrameScrollAnchor,
  getPretextMarkdownScrollTopForLineRange,
  getPretextMarkdownVisibleChunkFrames,
  markdownChunkIntersectsLineRange,
  resolvePretextMarkdownScrollAnchor,
  type PretextMarkdownScrollAnchor,
} from "./pretext-markdown-virtualizer"
import { ScrollArea } from "./scroll-area"
import { TextViewerFrame, TextViewerToolbar } from "./text-viewer-chrome"
import { normalizeTextLineRange } from "./text-viewer-ranges"
import {
  readTextResource,
  resolvedTextViewerBounds,
  splitTextLines,
} from "./text-viewer-resource"
import { clampTextViewerScale } from "./text-viewer-scale"
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types"

const VIEWER_HORIZONTAL_PADDING = 16
const DEFAULT_VIEWPORT_HEIGHT = 600
const DEFAULT_VIEWPORT_WIDTH = 800
const INITIAL_CONTENT_WIDTH = 768
const OVERSCAN_PX = 640
const SOURCE_FONT_SIZE = 13
const SOURCE_LINE_HEIGHT = 22
const SOURCE_OVERSCAN_LINES = 24

type PretextMarkdownViewMode = "rendered" | "source"

type ViewportSize = {
  height: number
  width: number
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
  const [viewMode, setViewMode] =
    React.useState<PretextMarkdownViewMode>("rendered")
  const [scrollTop, setScrollTop] = React.useState(0)
  const [measuredHeights, setMeasuredHeights] = React.useState(
    () => new Map<number, number>()
  )
  const pendingScrollAnchorRef =
    React.useRef<PretextMarkdownScrollAnchor | null>(null)
  const resolvedHashRef = React.useRef<string | null>(null)
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
  const sourceLines = React.useMemo(() => splitTextLines(text), [text])
  const sourceLineHeight = SOURCE_LINE_HEIGHT * fontScale
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
      getPretextMarkdownVisibleChunkFrames({
        frames: frame.chunks,
        overscanPx: OVERSCAN_PX,
        scrollTop,
        viewportHeight,
      }),
    [frame.chunks, scrollTop, viewportHeight]
  )

  const captureScrollAnchor = React.useCallback(() => {
    pendingScrollAnchorRef.current = getPretextMarkdownFrameScrollAnchor({
      frames: frame.chunks,
      scrollTop: viewportRef.current?.scrollTop ?? scrollTop,
    })
  }, [frame.chunks, scrollTop])

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
    const nextScrollTop = resolvePretextMarkdownScrollAnchor({
      anchor,
      frames: frame.chunks,
    })
    if (nextScrollTop != null) scrollElement.scrollTop = nextScrollTop
  }, [frame.chunks])

  const recordMeasuredHeight = React.useCallback(
    (chunkIndex: number, height: number) => {
      if (!Number.isFinite(height) || height <= 0) return
      setMeasuredHeights((current) => {
        if (Math.abs((current.get(chunkIndex) ?? 0) - height) < 1) {
          return current
        }
        captureScrollAnchor()
        const next = new Map(current)
        next.set(chunkIndex, height)
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

      if (viewMode === "source") {
        scrollElement.scrollTo({
          behavior: "smooth",
          top: Math.max(0, (range.start - 1) * sourceLineHeight),
          ...options,
        })
        return
      }

      const targetTop = getPretextMarkdownScrollTopForLineRange({
        chunks: document.chunks,
        frames: frame.chunks,
        range,
        viewportHeight: scrollElement.clientHeight,
      })
      if (targetTop == null) return

      scrollElement.scrollTo({
        behavior: "smooth",
        top: targetTop,
        ...options,
      })
    },
    [document.chunks, frame.chunks, sourceLineHeight, viewMode]
  )

  const scrollToChunkFrame = React.useCallback(
    (chunkIndex: number, options?: ScrollToOptions) => {
      const scrollElement = viewportRef.current
      const targetFrame = frame.chunks[chunkIndex]
      if (!scrollElement || !targetFrame) return false

      scrollElement.scrollTo({
        behavior: "smooth",
        top: Math.max(0, targetFrame.top),
        ...options,
      })
      return true
    },
    [frame.chunks]
  )

  const resolveFragmentHref = React.useCallback(
    (href: string, options?: ScrollToOptions) => {
      if (href.length <= 1) return false

      const headingId = decodeMarkdownFragmentHref(href)
      const heading = findPretextMarkdownHeadingById(document, headingId)
      if (!heading) return false

      return scrollToChunkFrame(heading.chunkIndex, options)
    },
    [document, scrollToChunkFrame]
  )

  const resolveCurrentHash = React.useCallback(
    (options?: ScrollToOptions) => {
      const href = window.location.hash
      if (!href || href.length <= 1) return false
      if (resolvedHashRef.current === href) return true
      if (!resolveFragmentHref(href, options)) return false

      resolvedHashRef.current = href
      return true
    },
    [resolveFragmentHref]
  )

  const handleFragmentClick = React.useCallback(
    (event: React.MouseEvent) => {
      const href = localFragmentHrefFromEventTarget(event.target)
      if (!href) return

      if (!resolveFragmentHref(href)) return

      event.preventDefault()
      resolvedHashRef.current = href
      if (window.location.hash !== href) {
        window.history.replaceState(null, "", href)
      }
    },
    [resolveFragmentHref]
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

  React.useEffect(() => {
    resolvedHashRef.current = null
  }, [document])

  React.useEffect(() => {
    resolveCurrentHash({ behavior: "auto" })
  }, [resolveCurrentHash])

  React.useEffect(() => {
    const handleHashChange = () => {
      resolvedHashRef.current = null
      resolveCurrentHash({ behavior: "auto" })
    }

    window.addEventListener("hashchange", handleHashChange)
    return () => {
      window.removeEventListener("hashchange", handleHashChange)
    }
  }, [resolveCurrentHash])

  return (
    <TextViewerFrame className={className} bare={bare}>
      {toolbar ? (
        <TextViewerToolbar
          wordCount={document.wordCount}
          fontScale={fontScale}
          leading={
            <PretextMarkdownViewModeControl
              mode={viewMode}
              wordCount={document.wordCount}
              onModeChange={(nextMode) => {
                setViewMode(nextMode)
                setScrollTop(0)
                viewportRef.current?.scrollTo({ behavior: "auto", top: 0 })
              }}
            />
          }
          copyLabel="Copy Markdown"
          copyText={document.text}
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
          onClickCapture:
            viewMode === "rendered" ? handleFragmentClick : undefined,
          onScroll: (event) => {
            setScrollTop(event.currentTarget.scrollTop)
          },
        }}
      >
        {viewMode === "source" ? (
          <PretextMarkdownSourceCanvas
            fontScale={fontScale}
            highlightRange={highlightRange}
            lines={sourceLines}
            scrollTop={scrollTop}
            viewportHeight={viewportHeight}
            viewportWidth={viewportWidth}
          />
        ) : (
          <div
            className="relative min-w-0"
            data-projection="react-gfm-pretext-markdown"
            data-slot="pretext-markdown-virtual-canvas"
            style={{
              height: frame.totalHeight,
              minWidth: viewportWidth,
            }}
          >
            {visibleFrames.map((chunkFrame) => {
              const chunk = document.chunks[chunkFrame.index]
              if (!chunk) return null
              return (
                <PretextMarkdownChunk
                  key={chunk.index}
                  frame={chunkFrame}
                  highlighted={markdownChunkIntersectsLineRange({
                    chunk,
                    range: highlightRange,
                  })}
                  onMeasuredHeight={recordMeasuredHeight}
                >
                  <PretextMarkdownChunkRenderer
                    chunk={chunk}
                    referenceDefinitionsMarkdown={
                      document.referenceDefinitionsMarkdown
                    }
                  />
                </PretextMarkdownChunk>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </TextViewerFrame>
  )
}

function PretextMarkdownViewModeControl({
  mode,
  wordCount,
  onModeChange,
}: {
  mode: PretextMarkdownViewMode
  wordCount: number
  onModeChange: (mode: PretextMarkdownViewMode) => void
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
        {wordCount} word{wordCount === 1 ? "" : "s"}
      </span>
      <span
        aria-label="Markdown view mode"
        className="inline-flex overflow-hidden rounded-md border bg-muted/35 p-0.5"
        role="group"
      >
        {(["rendered", "source"] as const).map((item) => (
          <button
            key={item}
            aria-pressed={mode === item}
            className={[
              "h-6 px-2 text-xs font-medium capitalize transition-colors",
              mode === item
                ? "rounded-sm bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
            type="button"
            onClick={() => onModeChange(item)}
          >
            {item === "source" ? "Text" : "Rendered"}
          </button>
        ))}
      </span>
    </span>
  )
}

function PretextMarkdownSourceCanvas({
  fontScale,
  highlightRange,
  lines,
  scrollTop,
  viewportHeight,
  viewportWidth,
}: {
  fontScale: number
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  lines: readonly string[]
  scrollTop: number
  viewportHeight: number
  viewportWidth: number
}) {
  const lineHeight = SOURCE_LINE_HEIGHT * fontScale
  const fontSize = SOURCE_FONT_SIZE * fontScale
  const lineCount = Math.max(1, lines.length)
  const startLineIndex = Math.max(
    0,
    Math.floor(scrollTop / lineHeight) - SOURCE_OVERSCAN_LINES
  )
  const endLineIndex = Math.min(
    lineCount,
    Math.ceil((scrollTop + viewportHeight) / lineHeight) + SOURCE_OVERSCAN_LINES
  )
  const visibleLines = lines.slice(startLineIndex, endLineIndex)
  const gutterWidth = Math.max(44, String(lineCount).length * 8 + 24)

  return (
    <div
      className="relative min-w-0 overflow-x-auto bg-background font-mono text-foreground"
      data-slot="pretext-markdown-source-canvas"
      style={{
        fontSize,
        height: lineCount * lineHeight,
        lineHeight: `${lineHeight}px`,
        minWidth: viewportWidth,
        tabSize: 2,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none sticky left-0 z-10 h-full border-r bg-muted/35"
        style={{ width: gutterWidth }}
      />
      {visibleLines.map((line, offset) => {
        const lineIndex = startLineIndex + offset
        const lineNumber = lineIndex + 1
        const highlighted =
          highlightRange != null &&
          lineNumber >= highlightRange.start &&
          lineNumber <= highlightRange.end

        return (
          <div
            key={lineNumber}
            className={[
              "absolute right-0 left-0 grid whitespace-pre",
              highlighted ? "bg-primary/10 ring-1 ring-primary/20" : "",
            ].join(" ")}
            data-source-line={lineNumber}
            style={{
              gridTemplateColumns: `${gutterWidth}px max-content`,
              height: lineHeight,
              transform: `translateY(${lineIndex * lineHeight}px)`,
            }}
          >
            <span className="sticky left-0 border-r bg-muted/35 pr-3 text-right text-muted-foreground select-none">
              {lineNumber}
            </span>
            <span className="px-4">{line || " "}</span>
          </div>
        )
      })}
    </div>
  )
}

function PretextMarkdownChunk({
  children,
  frame,
  highlighted,
  onMeasuredHeight,
}: {
  children: React.ReactNode
  frame: PretextMarkdownChunkFrame
  highlighted: boolean
  onMeasuredHeight: (chunkIndex: number, height: number) => void
}) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const chunkId = pretextMarkdownChunkId({
    index: frame.index,
    sourceStartLine: frame.sourceStartLine,
  })

  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const patchTables = () => {
      patchPretextMarkdownChunkTables({ chunkId, root: element })
    }

    patchTables()
    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(patchTables)
    mutationObserver?.observe(element, {
      childList: true,
      subtree: true,
    })

    if (typeof ResizeObserver === "undefined") {
      return () => {
        mutationObserver?.disconnect()
      }
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height
      patchTables()
      if (height != null) onMeasuredHeight(frame.index, height)
    })
    resizeObserver.observe(element)
    return () => {
      mutationObserver?.disconnect()
      resizeObserver.disconnect()
    }
  }, [chunkId, frame.index, onMeasuredHeight])

  return (
    <div
      ref={ref}
      className={[
        "absolute right-4 left-4 px-12",
        highlighted ? "bg-primary/10 ring-1 ring-primary/25" : "",
      ].join(" ")}
      id={chunkId}
      data-pretext-markdown-chunk=""
      data-pretext-markdown-hostile={frame.isHostile ? "" : undefined}
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
