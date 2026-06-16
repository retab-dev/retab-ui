"use client"

import * as React from "react"
import { AlertCircle, ChevronDown, ChevronUp, Search, X } from "lucide-react"

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
  getPretextMarkdownSourceLineForScrollTop,
  getPretextMarkdownVisibleChunkFrames,
  markdownChunkIntersectsLineRange,
  resolvePretextMarkdownScrollAnchor,
  type PretextMarkdownScrollAnchor,
} from "./pretext-markdown-virtualizer"
import { ScrollArea } from "./scroll-area"
import { TextViewerFrame, TextViewerControls } from "./text-viewer-chrome"
import { normalizeTextLineRange } from "./text-viewer-ranges"
import {
  readTextResource,
  resolvedTextViewerBounds,
  splitTextLines,
} from "./text-viewer-resource"
import { clampTextViewerScale } from "./text-viewer-scale"
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types"
import type { ViewerDownloadErrorHandler } from "./viewer-download"

const VIEWER_HORIZONTAL_PADDING = 16
const DEFAULT_VIEWPORT_HEIGHT = 600
const DEFAULT_VIEWPORT_WIDTH = 800
const INITIAL_CONTENT_WIDTH = 768
const OVERSCAN_PX = 640
const SOURCE_FONT_SIZE = 13
const SOURCE_LINE_HEIGHT = 22
const SOURCE_OVERSCAN_LINES = 24
const MAX_SEARCH_MATCHES = 10_000

type PretextMarkdownViewMode = "rendered" | "source"

type ViewportSize = {
  height: number
  width: number
}

type PretextMarkdownSearchMatch = {
  endLine: number
  endOffset: number
  index: number
  startLine: number
  startOffset: number
}

export function PretextMarkdownViewerContent({
  resource,
  className,
  controls = true,
  download = true,
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
  const downloadAction = download ? resource.originalDownload : null
  const [fontScale, setFontScale] = React.useState(1)
  const [viewMode, setViewMode] =
    React.useState<PretextMarkdownViewMode>("rendered")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = React.useState(0)
  const [downloadError, setDownloadError] = React.useState("")
  const [scrollTop, setScrollTop] = React.useState(0)
  const [measuredHeights, setMeasuredHeights] = React.useState(
    () => new Map<number, number>()
  )
  const pendingScrollAnchorRef =
    React.useRef<PretextMarkdownScrollAnchor | null>(null)
  const pendingViewModeSourceLineRef = React.useRef<number | null>(null)
  const lastHighlightScrollRef = React.useRef<{
    document: ReturnType<typeof createPretextMarkdownDocument>
    end: number
    start: number
  } | null>(null)
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
  const isEmptyDocument = text.trim().length === 0
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
  const searchMatches = React.useMemo(
    () => buildPretextMarkdownSearchMatches(text, searchQuery),
    [searchQuery, text]
  )
  const activeSearchMatch =
    searchMatches.length === 0
      ? null
      : searchMatches[
          Math.min(activeSearchMatchIndex, searchMatches.length - 1)
        ]
  const activeSearchRange = React.useMemo(
    () =>
      activeSearchMatch
        ? normalizeTextLineRange(
            {
              end: activeSearchMatch.endLine,
              start: activeSearchMatch.startLine,
            },
            document.sourceLineCount
          )
        : null,
    [activeSearchMatch, document.sourceLineCount]
  )
  const visibleHighlightRange = activeSearchRange ?? highlightRange
  const handleDownloadError = React.useCallback<ViewerDownloadErrorHandler>(
    (error) => {
      if (error.kind === "aborted") return
      setDownloadError(error.message || "Could not download Markdown.")
    },
    []
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
        scrollElement.scrollTo(
          createPretextMarkdownScrollOptions({
            options,
            top: Math.max(0, (range.start - 1) * sourceLineHeight),
          })
        )
        return
      }

      const targetTop = getPretextMarkdownScrollTopForLineRange({
        chunks: document.chunks,
        frames: frame.chunks,
        range,
        viewportHeight: scrollElement.clientHeight,
      })
      if (targetTop == null) return

      scrollElement.scrollTo(
        createPretextMarkdownScrollOptions({ options, top: targetTop })
      )
    },
    [document.chunks, frame.chunks, sourceLineHeight, viewMode]
  )
  const scrollLineRangeRef = React.useRef(scrollLineRange)

  React.useLayoutEffect(() => {
    scrollLineRangeRef.current = scrollLineRange
  }, [scrollLineRange])

  const scrollToChunkFrame = React.useCallback(
    (chunkIndex: number, options?: ScrollToOptions) => {
      const scrollElement = viewportRef.current
      const targetFrame = frame.chunks[chunkIndex]
      if (!scrollElement || !targetFrame) return false

      scrollElement.scrollTo(
        createPretextMarkdownScrollOptions({
          options,
          top: Math.max(0, targetFrame.top),
        })
      )
      return true
    },
    [frame.chunks]
  )

  const sourceLineAtScrollTop = React.useCallback(
    (nextScrollTop: number) => {
      if (viewMode === "source") {
        return Math.max(
          1,
          Math.min(
            document.sourceLineCount,
            Math.floor(nextScrollTop / sourceLineHeight) + 1
          )
        )
      }

      return getPretextMarkdownSourceLineForScrollTop({
        chunks: document.chunks,
        frames: frame.chunks,
        scrollTop: nextScrollTop,
      })
    },
    [
      document.chunks,
      document.sourceLineCount,
      frame.chunks,
      sourceLineHeight,
      viewMode,
    ]
  )

  const switchViewMode = React.useCallback(
    (nextMode: PretextMarkdownViewMode) => {
      if (nextMode === viewMode) return

      const scrollElement = viewportRef.current
      if (scrollElement) {
        pendingViewModeSourceLineRef.current = sourceLineAtScrollTop(
          scrollElement.scrollTop
        )
      }
      setViewMode(nextMode)
    },
    [sourceLineAtScrollTop, viewMode]
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
        window.history.pushState(null, "", href)
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

  const goToSearchMatch = React.useCallback(
    (direction: 1 | -1) => {
      setActiveSearchMatchIndex((current) => {
        if (searchMatches.length === 0) return 0
        return (
          (current + direction + searchMatches.length) % searchMatches.length
        )
      })
    },
    [searchMatches.length]
  )

  const clearSearch = React.useCallback(() => {
    setSearchQuery("")
    setActiveSearchMatchIndex(0)
  }, [])

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
    if (!highlightRange) {
      lastHighlightScrollRef.current = null
      return
    }

    const last = lastHighlightScrollRef.current
    if (
      last &&
      last.document === document &&
      last.start === highlightRange.start &&
      last.end === highlightRange.end
    ) {
      return
    }

    lastHighlightScrollRef.current = {
      document,
      end: highlightRange.end,
      start: highlightRange.start,
    }
    scrollLineRangeRef.current(highlightRange)
  }, [document, highlightRange])

  React.useEffect(() => {
    setActiveSearchMatchIndex(0)
  }, [searchQuery])

  React.useEffect(() => {
    setActiveSearchMatchIndex((current) =>
      searchMatches.length === 0
        ? 0
        : Math.min(current, searchMatches.length - 1)
    )
  }, [searchMatches.length])

  React.useEffect(() => {
    if (!activeSearchRange) return
    scrollLineRangeRef.current(activeSearchRange, { behavior: "auto" })
  }, [activeSearchRange])

  React.useLayoutEffect(() => {
    const sourceLine = pendingViewModeSourceLineRef.current
    if (sourceLine == null) return

    pendingViewModeSourceLineRef.current = null
    scrollLineRange(
      normalizeTextLineRange(
        { end: sourceLine, start: sourceLine },
        document.sourceLineCount
      ),
      { behavior: "auto" }
    )
  }, [document.sourceLineCount, scrollLineRange, viewMode])

  React.useEffect(() => {
    resolvedHashRef.current = null
  }, [document])

  React.useEffect(() => {
    setDownloadError("")
  }, [downloadAction])

  React.useEffect(() => {
    resolveCurrentHash({ behavior: "auto" })
  }, [resolveCurrentHash])

  React.useEffect(() => {
    const handleFragmentNavigation = () => {
      resolvedHashRef.current = null
      resolveCurrentHash({ behavior: "auto" })
    }

    window.addEventListener("hashchange", handleFragmentNavigation)
    window.addEventListener("popstate", handleFragmentNavigation)
    return () => {
      window.removeEventListener("hashchange", handleFragmentNavigation)
      window.removeEventListener("popstate", handleFragmentNavigation)
    }
  }, [resolveCurrentHash])

  return (
    <TextViewerFrame className={className} bare={bare}>
      {controls ? (
        <TextViewerControls
          wordCount={document.wordCount}
          fontScale={fontScale}
          leading={
            <PretextMarkdownViewModeControl
              mode={viewMode}
              wordCount={document.wordCount}
              onModeChange={switchViewMode}
            />
          }
          copyLabel="Copy Markdown"
          copyText={document.text}
          downloadAction={downloadAction}
          onDownloadError={handleDownloadError}
          extra={
            <span className="flex min-w-0 items-center gap-2">
              <PretextMarkdownDownloadError message={downloadError} />
              <PretextMarkdownSearchControl
                activeMatchIndex={
                  activeSearchMatch ? activeSearchMatch.index : 0
                }
                matchCount={searchMatches.length}
                query={searchQuery}
                onClear={clearSearch}
                onNext={() => goToSearchMatch(1)}
                onPrevious={() => goToSearchMatch(-1)}
                onQueryChange={setSearchQuery}
              />
            </span>
          }
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
            highlightRange={visibleHighlightRange}
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
              height: isEmptyDocument
                ? Math.max(frame.totalHeight, viewportHeight)
                : frame.totalHeight,
              minWidth: viewportWidth,
            }}
          >
            {isEmptyDocument ? (
              <PretextMarkdownEmptyState />
            ) : (
              visibleFrames.map((chunkFrame) => {
                const chunk = document.chunks[chunkFrame.index]
                if (!chunk) return null
                return (
                  <PretextMarkdownChunk
                    key={chunk.index}
                    frame={chunkFrame}
                    highlightRange={visibleHighlightRange}
                    highlighted={markdownChunkIntersectsLineRange({
                      chunk,
                      range: visibleHighlightRange,
                    })}
                    onMeasuredHeight={recordMeasuredHeight}
                  >
                    <PretextMarkdownChunkRenderer
                      chunk={chunk}
                      footnoteDefinitionsMarkdown={
                        document.footnoteDefinitionsMarkdown
                      }
                      referenceDefinitionsMarkdown={
                        document.referenceDefinitionsMarkdown
                      }
                    />
                  </PretextMarkdownChunk>
                )
              })
            )}
          </div>
        )}
      </ScrollArea>
    </TextViewerFrame>
  )
}

function PretextMarkdownEmptyState() {
  return (
    <div
      aria-label="Empty Markdown document"
      className="absolute inset-x-4 top-0 flex min-h-40 items-center justify-center px-12 text-sm text-muted-foreground"
      data-slot="pretext-markdown-empty-state"
      role="status"
    >
      Empty Markdown document
    </div>
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

function PretextMarkdownDownloadError({ message }: { message: string }) {
  if (!message) return null

  return (
    <span
      aria-live="polite"
      className="hidden min-w-0 items-center gap-1 rounded-md border border-destructive/25 bg-destructive/10 px-2 py-1 text-xs text-destructive sm:inline-flex"
      data-slot="pretext-markdown-download-error"
      role="status"
    >
      <AlertCircle className="size-3.5 flex-shrink-0" aria-hidden="true" />
      <span className="truncate">{message}</span>
    </span>
  )
}

function PretextMarkdownSearchControl({
  activeMatchIndex,
  matchCount,
  query,
  onClear,
  onNext,
  onPrevious,
  onQueryChange,
}: {
  activeMatchIndex: number
  matchCount: number
  query: string
  onClear: () => void
  onNext: () => void
  onPrevious: () => void
  onQueryChange: (query: string) => void
}) {
  const searchId = React.useId()
  const statusId = React.useId()
  const hasQuery = query.trim().length > 0
  const hasMatches = matchCount > 0
  const status = !hasQuery
    ? "No search"
    : hasMatches
      ? `${Math.min(activeMatchIndex + 1, matchCount)} / ${matchCount}`
      : "No matches"

  return (
    <form
      role="search"
      className="flex min-w-0 items-center gap-1"
      data-slot="pretext-markdown-search"
      onSubmit={(event) => {
        event.preventDefault()
        onNext()
      }}
    >
      <label className="sr-only" htmlFor={searchId}>
        Search Markdown
      </label>
      <span className="relative block w-36 min-w-0 sm:w-44">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={searchId}
          aria-describedby={statusId}
          aria-label="Search Markdown"
          className="h-7 w-full rounded-md border bg-background pr-7 pl-7 text-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          data-slot="pretext-markdown-search-input"
          placeholder="Search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              onClear()
              return
            }
            if (event.key !== "Enter") return

            event.preventDefault()
            if (event.shiftKey) onPrevious()
            else onNext()
          }}
        />
        {hasQuery ? (
          <button
            aria-label="Clear Markdown search"
            className="absolute top-1/2 right-1 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            type="button"
            onClick={onClear}
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </span>
      <span
        id={statusId}
        aria-live="polite"
        className="hidden w-12 text-center text-xs text-muted-foreground tabular-nums sm:inline"
        data-slot="pretext-markdown-search-status"
      >
        {hasQuery ? status : ""}
      </span>
      <button
        aria-label="Previous Markdown search match"
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        disabled={!hasMatches}
        title="Previous Markdown search match"
        type="button"
        onClick={onPrevious}
      >
        <ChevronUp aria-hidden="true" className="size-4" />
      </button>
      <button
        aria-label="Next Markdown search match"
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        disabled={!hasMatches}
        title="Next Markdown search match"
        type="button"
        onClick={onNext}
      >
        <ChevronDown aria-hidden="true" className="size-4" />
      </button>
    </form>
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
      aria-label="Markdown source"
      className="relative min-w-0 overflow-x-auto bg-background font-mono text-foreground"
      data-slot="pretext-markdown-source-canvas"
      role="region"
      style={{
        fontSize,
        height: lineCount * lineHeight,
        lineHeight: `${lineHeight}px`,
        minWidth: viewportWidth,
        tabSize: 2,
      }}
      tabIndex={0}
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
              "absolute top-0 right-0 left-0 grid whitespace-pre",
              highlighted ? "bg-primary/10 ring-1 ring-primary/20" : "",
            ].join(" ")}
            data-source-line={lineNumber}
            style={{
              gridTemplateColumns: `${gutterWidth}px max-content`,
              height: lineHeight,
              transform: `translateY(${lineIndex * lineHeight}px)`,
            }}
          >
            <span
              aria-hidden="true"
              className="sticky left-0 border-r bg-muted/35 pr-3 text-right text-muted-foreground select-none"
            >
              {lineNumber}
            </span>
            <span className="px-4" data-source-line-content="">
              {line || " "}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function buildPretextMarkdownSearchMatches(
  text: string,
  query: string
): PretextMarkdownSearchMatch[] {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) return []

  const lineStarts = getPretextMarkdownLineStarts(text)
  const lowerText = text.toLowerCase()
  const lowerQuery = normalizedQuery.toLowerCase()
  const matches: PretextMarkdownSearchMatch[] = []
  let offset = 0

  while (matches.length < MAX_SEARCH_MATCHES) {
    const startOffset = lowerText.indexOf(lowerQuery, offset)
    if (startOffset === -1) break

    const endOffset = startOffset + lowerQuery.length
    matches.push({
      endLine: getPretextMarkdownLineNumberForOffset(
        lineStarts,
        Math.max(startOffset, endOffset - 1)
      ),
      endOffset,
      index: matches.length,
      startLine: getPretextMarkdownLineNumberForOffset(lineStarts, startOffset),
      startOffset,
    })
    offset = endOffset
  }

  return matches
}

function getPretextMarkdownLineStarts(text: string) {
  const lineStarts = [0]
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") lineStarts.push(index + 1)
  }
  return lineStarts
}

function getPretextMarkdownLineNumberForOffset(
  lineStarts: readonly number[],
  offset: number
) {
  let low = 0
  let high = lineStarts.length - 1

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (lineStarts[middle]! <= offset) low = middle + 1
    else high = middle - 1
  }

  return Math.max(1, high + 1)
}

function PretextMarkdownChunk({
  children,
  frame,
  highlightRange,
  highlighted,
  onMeasuredHeight,
}: {
  children: React.ReactNode
  frame: PretextMarkdownChunkFrame
  highlightRange: ReturnType<typeof normalizeTextLineRange>
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
      aria-label={
        highlighted && highlightRange
          ? `Highlighted source lines ${highlightRange.start}-${highlightRange.end}`
          : undefined
      }
      data-pretext-markdown-chunk=""
      data-pretext-markdown-highlighted={highlighted ? "" : undefined}
      data-pretext-markdown-hostile={frame.isHostile ? "" : undefined}
      data-source-highlight-end={
        highlighted && highlightRange ? highlightRange.end : undefined
      }
      data-source-highlight-start={
        highlighted && highlightRange ? highlightRange.start : undefined
      }
      data-source-end-line={frame.sourceEndLine}
      data-source-start-line={frame.sourceStartLine}
      role={highlighted ? "region" : undefined}
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

function createPretextMarkdownScrollOptions({
  options,
  top,
}: {
  options?: ScrollToOptions
  top: number
}): ScrollToOptions {
  const behavior = options?.behavior ?? "smooth"
  return {
    ...options,
    behavior:
      behavior === "smooth" && prefersReducedMotion() ? "auto" : behavior,
    top,
  }
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
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
