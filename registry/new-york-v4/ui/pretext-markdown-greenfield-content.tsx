"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, Search, X } from "lucide-react"

import type { ViewerResource } from "@/lib/viewer-resource"

import {
  createPretextMarkdownGreenfieldDocument,
  findPretextMarkdownGreenfieldChunkByBlockId,
  findPretextMarkdownGreenfieldChunkBySourceLine,
  findPretextMarkdownGreenfieldFragmentTargetById,
  type PretextMarkdownGreenfieldChunk,
} from "./pretext-markdown-greenfield-document"
import {
  layoutPretextMarkdownGreenfieldDocument,
  PRETEXT_MARKDOWN_GREENFIELD_LAYOUT_POLICY_VERSION,
  type PretextMarkdownGreenfieldChunkFrame,
  type PretextMarkdownGreenfieldMeasurementContext,
} from "./pretext-markdown-greenfield-layout"
import { PretextMarkdownGreenfieldChunkRenderer } from "./pretext-markdown-greenfield-renderer"
import {
  getPretextMarkdownGreenfieldScrollAnchor,
  getPretextMarkdownGreenfieldScrollTopForLineRange,
  getPretextMarkdownGreenfieldSourceLineForScrollTop,
  getPretextMarkdownGreenfieldVisibleFrames,
  resolvePretextMarkdownGreenfieldScrollAnchor,
  type PretextMarkdownGreenfieldScrollAnchor,
} from "./pretext-markdown-greenfield-virtualizer"
import type {
  PretextMarkdownHastElement,
  PretextMarkdownHastNode,
} from "./pretext-markdown-hast-types"
import { ScrollArea } from "./scroll-area"
import { TextViewerControls, TextViewerFrame } from "./text-viewer-chrome"
import { normalizeTextLineRange } from "./text-viewer-ranges"
import {
  readTextResource,
  resolvedTextViewerBounds,
  splitTextLines,
} from "./text-viewer-resource"
import { clampTextViewerScale } from "./text-viewer-scale"
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types"
import type { ViewerDownloadErrorHandler } from "./viewer-download"

const DEFAULT_VIEWPORT_HEIGHT = 640
const DEFAULT_VIEWPORT_WIDTH = 900
const INITIAL_CONTENT_WIDTH = 820
const VIEWER_HORIZONTAL_PADDING = 32
const OVERSCAN_PX = 800
const SOURCE_LINE_HEIGHT = 22
const MAX_SEARCH_MATCHES = 10_000

type PretextMarkdownGreenfieldViewMode = "rendered" | "source"

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

type PretextMarkdownScrollToLineOptions = ScrollToOptions & {
  preferredChunkId?: string | null
}

export function PretextMarkdownGreenfieldContent({
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
  const document = React.useMemo(
    () => createPretextMarkdownGreenfieldDocument(text),
    [text]
  )
  const documentMeasurementId = React.useMemo(
    () => measurementDocumentIdForText(text),
    [text]
  )
  const sourceLines = React.useMemo(() => splitTextLines(text), [text])
  const downloadAction = download ? resource.originalDownload : null
  const [downloadError, setDownloadError] = React.useState("")
  const [fontScale, setFontScale] = React.useState(1)
  const [measuredHeights, setMeasuredHeights] = React.useState(
    () => new Map<string, number>()
  )
  const [scrollTop, setScrollTop] = React.useState(0)
  const [viewMode, setViewMode] =
    React.useState<PretextMarkdownGreenfieldViewMode>("rendered")
  const [viewportSize, setViewportSize] = React.useState<ViewportSize>({
    height: 0,
    width: 0,
  })
  const [contentWidth, setContentWidth] = React.useState(INITIAL_CONTENT_WIDTH)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const pendingAnchorRef =
    React.useRef<PretextMarkdownGreenfieldScrollAnchor | null>(null)
  const prevFrameChunksRef = React.useRef<
    readonly PretextMarkdownGreenfieldChunkFrame[] | null
  >(null)
  const pendingModeSourceLineRef = React.useRef<number | null>(null)
  const viewportHeight = viewportSize.height || DEFAULT_VIEWPORT_HEIGHT
  const viewportWidth = viewportSize.width || DEFAULT_VIEWPORT_WIDTH
  const sourceLineHeight = SOURCE_LINE_HEIGHT * fontScale
  const measuredHeightLookup = React.useMemo(
    () => ({
      get: (
        chunk: PretextMarkdownGreenfieldChunk,
        context: PretextMarkdownGreenfieldMeasurementContext
      ) =>
        measuredHeights.get(
          measuredHeightKey({
            chunk,
            context,
            documentMeasurementId,
          })
        ),
    }),
    [documentMeasurementId, measuredHeights]
  )
  const frame = React.useMemo(
    () =>
      layoutPretextMarkdownGreenfieldDocument({
        contentWidth,
        document,
        fontScale,
        measuredHeights: measuredHeightLookup,
      }),
    [contentWidth, document, fontScale, measuredHeightLookup]
  )
  const highlightRange = React.useMemo(
    () => normalizeTextLineRange(highlight, document.lineCount),
    [document.lineCount, highlight]
  )
  const {
    activeSearchMatch,
    activeSearchRange,
    clearSearch,
    goToSearchMatch,
    searchMatches,
    searchQuery,
    setSearchQuery,
  } = useMarkdownSearch({ lineCount: document.lineCount, text })
  const visibleHighlightRange = activeSearchRange ?? highlightRange
  const visibleFrames = React.useMemo(
    () =>
      getPretextMarkdownGreenfieldVisibleFrames({
        frames: frame.chunks,
        overscanPx: OVERSCAN_PX,
        scrollTop,
        viewportHeight,
      }),
    [frame.chunks, scrollTop, viewportHeight]
  )
  const captureAnchor = React.useCallback(() => {
    // Read the live scroll position from the DOM rather than the `scrollTop`
    // state, which lags behind during fast scrolling. Capturing a stale value
    // here makes the anchor-restore effect yank the viewport back to an old
    // (often near-top) position when a freshly revealed chunk is measured.
    const liveScrollTop = viewportRef.current?.scrollTop ?? scrollTop
    pendingAnchorRef.current = getPretextMarkdownGreenfieldScrollAnchor({
      frames: frame.chunks,
      scrollTop: liveScrollTop,
    })
  }, [frame.chunks, scrollTop])

  React.useLayoutEffect(() => {
    setMeasuredHeights(new Map())
    setScrollTop(0)
    viewportRef.current?.scrollTo({ left: 0, top: 0 })
  }, [document])

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const readSize = () => {
      setViewportSize((current) => {
        const next = {
          height: viewport.clientHeight,
          width: viewport.clientWidth,
        }
        return current.height === next.height && current.width === next.width
          ? current
          : next
      })
    }

    readSize()
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(readSize)
    observer?.observe(viewport)
    return () => observer?.disconnect()
  }, [])

  React.useLayoutEffect(() => {
    const nextWidth = Math.max(1, viewportWidth - VIEWER_HORIZONTAL_PADDING * 2)
    setContentWidth((current) => {
      if (current === nextWidth) return current
      captureAnchor()
      return nextWidth
    })
  }, [captureAnchor, viewportWidth])

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current
    const previousChunks = prevFrameChunksRef.current
    prevFrameChunksRef.current = frame.chunks
    if (!viewport) return

    // Intentional full reflows (width, zoom, font readiness, mode switch) set an
    // explicit anchor and want to restore the reader's relative position.
    const anchor = pendingAnchorRef.current
    if (anchor) {
      pendingAnchorRef.current = null
      const nextScrollTop = resolvePretextMarkdownGreenfieldScrollAnchor({
        anchor,
        frames: frame.chunks,
      })
      if (nextScrollTop == null) return
      viewport.scrollTop = nextScrollTop
      setScrollTop(nextScrollTop)
      return
    }

    // Measurement-driven changes keep whatever the reader is looking at stable by
    // compensating scrollTop for the height delta of chunks ENTIRELY above the
    // viewport top. Only already-measured chunks (real height in both layouts)
    // count: a chunk's first estimate->measured correction happens as it is
    // revealed near/below the viewport, never while the reader sits above it, so
    // excluding it avoids the estimate-collapse plunge while still pinning the
    // viewport when async rich blocks above re-settle.
    if (!previousChunks) return
    const liveScrollTop = viewport.scrollTop
    const previousById = new Map(
      previousChunks.map((chunkFrame) => [chunkFrame.id, chunkFrame])
    )
    let delta = 0
    for (const chunkFrame of frame.chunks) {
      const previous = previousById.get(chunkFrame.id)
      if (
        previous &&
        previous.measuredHeight != null &&
        chunkFrame.measuredHeight != null &&
        previous.bottom <= liveScrollTop
      ) {
        delta += chunkFrame.measuredHeight - previous.measuredHeight
      }
    }
    if (delta === 0) return
    const nextScrollTop = Math.max(0, liveScrollTop + delta)
    viewport.scrollTop = nextScrollTop
    setScrollTop(nextScrollTop)
  }, [frame.chunks])

  const scrollToLineRange = React.useCallback(
    (
      range: ReturnType<typeof normalizeTextLineRange>,
      options?: PretextMarkdownScrollToLineOptions
    ) => {
      const viewport = viewportRef.current
      if (!viewport || !range) return

      const preferredChunkId =
        options?.preferredChunkId ??
        findPretextMarkdownGreenfieldChunkBySourceLine(document, range.start)
          ?.id
      const top =
        viewMode === "source"
          ? (range.start - 1) * sourceLineHeight
          : getPretextMarkdownGreenfieldScrollTopForLineRange({
              chunks: document.chunks,
              frames: frame.chunks,
              preferredChunkId,
              range,
              viewportHeight: viewport.clientHeight || viewportHeight,
            })
      if (top == null) return
      viewport.scrollTo({
        behavior: resolveScrollBehavior(options?.behavior),
        left: options?.left,
        top,
      })
      setScrollTop(top)
    },
    [document, frame.chunks, sourceLineHeight, viewMode, viewportHeight]
  )

  // A stable handle to the latest scrollToLineRange. The callback's identity
  // changes on every layout change (its deps include frame.chunks), so effects
  // that should fire only when their *target* changes must not depend on it
  // directly — otherwise each measurement re-runs them and yanks the viewport
  // back to the highlight/search/hash target while the reader is scrolling.
  const scrollToLineRangeRef = React.useRef(scrollToLineRange)
  React.useLayoutEffect(() => {
    scrollToLineRangeRef.current = scrollToLineRange
  }, [scrollToLineRange])

  React.useImperativeHandle(
    forwardedRef ?? null,
    () => ({
      getViewportElement: () => viewportRef.current,
      scrollToLineRange: (range, options) => {
        scrollToLineRangeRef.current(
          normalizeTextLineRange(range, document.lineCount),
          options
        )
      },
    }),
    [document.lineCount]
  )

  // Scrolling is an imperative DOM mutation that must run before paint to avoid
  // a visible jump, so these reactions to a changed target line/range live in
  // layout effects, not useEffect.
  React.useLayoutEffect(() => {
    if (!highlightRange) return
    scrollToLineRangeRef.current(highlightRange)
  }, [highlightRange])

  React.useLayoutEffect(() => {
    if (!activeSearchRange) return
    scrollToLineRangeRef.current(activeSearchRange, { behavior: "auto" })
  }, [activeSearchRange])

  // Subscribes to the browser's hash/history (a non-React external source) and
  // scrolls the matching fragment into view before paint.
  React.useLayoutEffect(() => {
    const scrollToCurrentHash = () => {
      const hash = window.location.hash
      if (!hash) return
      const target = findPretextMarkdownGreenfieldFragmentTargetById(
        document,
        hash
      )
      if (!target) return
      const chunk = findPretextMarkdownGreenfieldChunkByBlockId(
        document,
        target.blockId
      )
      scrollToLineRangeRef.current(
        normalizeTextLineRange(
          { end: target.sourceLine, start: target.sourceLine },
          document.lineCount
        ),
        { behavior: "auto", preferredChunkId: chunk?.id }
      )
    }

    scrollToCurrentHash()
    window.addEventListener("hashchange", scrollToCurrentHash)
    window.addEventListener("popstate", scrollToCurrentHash)
    return () => {
      window.removeEventListener("hashchange", scrollToCurrentHash)
      window.removeEventListener("popstate", scrollToCurrentHash)
    }
  }, [document])

  React.useLayoutEffect(() => {
    const sourceLine = pendingModeSourceLineRef.current
    if (sourceLine == null) return
    pendingModeSourceLineRef.current = null
    scrollToLineRange(
      normalizeTextLineRange(
        { end: sourceLine, start: sourceLine },
        document.lineCount
      ),
      { behavior: "auto" }
    )
  }, [document.lineCount, scrollToLineRange, viewMode])

  const recordMeasuredHeight = React.useCallback(
    (chunk: PretextMarkdownGreenfieldChunk, height: number) => {
      if (!Number.isFinite(height) || height <= 0) return
      const key = measuredHeightKey({
        chunk,
        context: {
          fontScale,
          policyVersion: PRETEXT_MARKDOWN_GREENFIELD_LAYOUT_POLICY_VERSION,
          width: Math.max(1, contentWidth),
        },
        documentMeasurementId,
      })
      setMeasuredHeights((current) => {
        if (Math.abs((current.get(key) ?? 0) - height) < 1) return current
        const next = new Map(current)
        next.set(key, height)
        return next
      })
    },
    [contentWidth, documentMeasurementId, fontScale]
  )
  const handleDownloadError = React.useCallback<ViewerDownloadErrorHandler>(
    (error) => {
      if (error.kind === "aborted") return
      setDownloadError(error.message || "Could not download Markdown.")
    },
    []
  )
  const switchMode = (nextMode: PretextMarkdownGreenfieldViewMode) => {
    if (nextMode === viewMode) return
    const currentScrollTop = viewportRef.current?.scrollTop ?? scrollTop
    pendingModeSourceLineRef.current =
      viewMode === "source"
        ? Math.max(1, Math.floor(currentScrollTop / sourceLineHeight) + 1)
        : getPretextMarkdownGreenfieldSourceLineForScrollTop({
            chunks: document.chunks,
            frames: frame.chunks,
            scrollTop: currentScrollTop,
          })
    setViewMode(nextMode)
  }
  const zoom = (factor: number) => {
    captureAnchor()
    setFontScale((scale) => clampTextViewerScale(scale * factor))
  }
  const resetZoom = () => {
    captureAnchor()
    setFontScale(1)
  }

  return (
    <TextViewerFrame className={className} bare={bare}>
      {controls ? (
        <TextViewerControls
          copyLabel="Copy Markdown"
          copyText={document.text}
          downloadAction={downloadAction}
          extra={
            <span className="flex min-w-0 items-center gap-2">
              <DownloadError message={downloadError} />
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
          fontScale={fontScale}
          leading={
            <ViewModeControl
              mode={viewMode}
              wordCount={document.wordCount}
              onModeChange={switchMode}
            />
          }
          wordCount={document.wordCount}
          onDownloadError={handleDownloadError}
          onResetZoom={resetZoom}
          onZoomIn={() => zoom(1.2)}
          onZoomOut={() => zoom(1 / 1.2)}
        />
      ) : null}
      {/* overflow-anchor:none disables the browser's native scroll anchoring,
          which otherwise fights this component's virtualization: as chunks
          mount/unmount and the canvas height corrects, the browser shifts
          scrollTop on its own, jerking the viewport while the reader scrolls. */}
      <ScrollArea
        className="min-h-0 flex-1 bg-background"
        orientation="vertical"
        viewportClassName="bg-background [overflow-anchor:none]"
        viewportRef={viewportRef}
        viewportProps={{
          onClickCapture:
            viewMode === "rendered"
              ? (event) =>
                  handleRenderedClick({ document, event, scrollToLineRange })
              : undefined,
          onScroll: (event) => setScrollTop(event.currentTarget.scrollTop),
        }}
      >
        {viewMode === "source" ? (
          <div
            className="relative min-w-max bg-background"
            data-slot="pretext-markdown-source-scroll-canvas"
            style={{
              height:
                Math.max(sourceLines.length, 1) *
                SOURCE_LINE_HEIGHT *
                fontScale,
              minWidth: viewportWidth,
            }}
          >
            <SourceCanvas
              fontScale={fontScale}
              highlightRange={visibleHighlightRange}
              lines={sourceLines}
              scrollTop={scrollTop}
              viewportHeight={viewportHeight}
            />
          </div>
        ) : (
          <div
            className="relative min-w-0"
            data-projection="unified-hast-pretext-markdown"
            data-slot="pretext-markdown-virtual-canvas"
            style={{
              height: Math.max(frame.totalHeight, viewportHeight),
              minWidth: viewportWidth,
            }}
          >
            <NativeFindIndex
              chunks={document.chunks}
              lineCount={document.lineCount}
              scrollToLineRange={scrollToLineRange}
            />
            {document.text.trim() ? (
              visibleFrames.map((chunkFrame) => {
                const chunk = document.chunks[chunkFrame.index]
                if (!chunk) return null
                return (
                  <ChunkFrame
                    key={chunk.id}
                    chunk={chunk}
                    frame={chunkFrame}
                    highlightRange={visibleHighlightRange}
                    highlighted={chunkIntersectsLineRange({
                      chunkFrame,
                      range: visibleHighlightRange,
                    })}
                    measurementKey={measuredHeightKey({
                      chunk,
                      context: {
                        fontScale,
                        policyVersion:
                          PRETEXT_MARKDOWN_GREENFIELD_LAYOUT_POLICY_VERSION,
                        width: Math.max(1, contentWidth),
                      },
                      documentMeasurementId,
                    })}
                    onMeasuredHeight={recordMeasuredHeight}
                  >
                    <PretextMarkdownGreenfieldChunkRenderer
                      chunk={chunk}
                      fontScale={fontScale}
                      onContentReady={() =>
                        measureChunkFrame(chunk, recordMeasuredHeight)
                      }
                      searchQuery={searchQuery}
                    />
                  </ChunkFrame>
                )
              })
            ) : (
              <div
                aria-label="Empty Markdown document"
                className="absolute inset-x-4 top-0 flex min-h-40 items-center justify-center text-sm text-muted-foreground"
                data-slot="pretext-markdown-empty-state"
                role="status"
              >
                Empty Markdown document
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </TextViewerFrame>
  )
}

function NativeFindIndex({
  chunks,
  lineCount,
  scrollToLineRange,
}: {
  chunks: readonly PretextMarkdownGreenfieldChunk[]
  lineCount: number
  scrollToLineRange: (
    range: ReturnType<typeof normalizeTextLineRange>,
    options?: PretextMarkdownScrollToLineOptions
  ) => void
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 h-px w-px overflow-hidden opacity-0"
      data-slot="pretext-markdown-native-find-index"
    >
      {chunks.map((chunk) => (
        <NativeFindEntry
          key={chunk.id}
          chunk={chunk}
          lineCount={lineCount}
          scrollToLineRange={scrollToLineRange}
        />
      ))}
    </div>
  )
}

function NativeFindEntry({
  chunk,
  lineCount,
  scrollToLineRange,
}: {
  chunk: PretextMarkdownGreenfieldChunk
  lineCount: number
  scrollToLineRange: (
    range: ReturnType<typeof normalizeTextLineRange>,
    options?: PretextMarkdownScrollToLineOptions
  ) => void
}) {
  const ref = React.useRef<HTMLSpanElement | null>(null)
  const text = nativeFindTextForChunk(chunk)

  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    element.setAttribute("hidden", "until-found")

    const handleBeforeMatch = () => {
      scrollToLineRange(
        normalizeTextLineRange(
          {
            end: chunk.sourceEndLine,
            start: chunk.sourceStartLine,
          },
          lineCount
        ),
        { behavior: "auto", preferredChunkId: chunk.id }
      )
      requestAnimationFrame(() => {
        element.setAttribute("hidden", "until-found")
      })
    }

    element.addEventListener("beforematch", handleBeforeMatch)
    return () => {
      element.removeEventListener("beforematch", handleBeforeMatch)
    }
  }, [
    chunk.id,
    chunk.sourceEndLine,
    chunk.sourceStartLine,
    lineCount,
    scrollToLineRange,
  ])

  return (
    <span
      ref={ref}
      className="absolute top-0 left-0 block h-px w-px overflow-hidden whitespace-pre"
      data-native-find-chunk-id={chunk.id}
      data-native-find-end-line={chunk.sourceEndLine}
      data-native-find-start-line={chunk.sourceStartLine}
    >
      {text || " "}
    </span>
  )
}

function nativeFindTextForChunk(chunk: PretextMarkdownGreenfieldChunk) {
  return chunk.hastChildren.map(nativeFindTextForHastNode).join(" ").trim()
}

function nativeFindTextForHastNode(node: PretextMarkdownHastNode): string {
  if (node.type === "text" && typeof node.value === "string") return node.value
  const element = node as PretextMarkdownHastElement
  if (!element || element.type !== "element") return ""

  if (element.tagName === "script" || element.tagName === "style") return ""
  return element.children.map(nativeFindTextForHastNode).join(" ")
}

function ViewModeControl({
  mode,
  wordCount,
  onModeChange,
}: {
  mode: PretextMarkdownGreenfieldViewMode
  wordCount: number
  onModeChange: (mode: PretextMarkdownGreenfieldViewMode) => void
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

function DownloadError({ message }: { message: string }) {
  if (!message) return null
  return (
    <span
      className="max-w-48 truncate text-xs text-destructive"
      data-slot="pretext-markdown-download-error"
      role="status"
    >
      {message}
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
      className="flex min-w-0 items-center gap-1"
      data-slot="pretext-markdown-search"
      role="search"
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

function ChunkFrame({
  children,
  chunk,
  frame,
  highlightRange,
  highlighted,
  measurementKey,
  onMeasuredHeight,
}: {
  children: React.ReactNode
  chunk: PretextMarkdownGreenfieldChunk
  frame: PretextMarkdownGreenfieldChunkFrame
  highlightRange: { end: number; start: number } | null
  highlighted: boolean
  measurementKey: string
  onMeasuredHeight: (
    chunk: PretextMarkdownGreenfieldChunk,
    height: number
  ) => void
}) {
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useLayoutEffect(() => {
    measure()
    const element = ref.current
    if (!element || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()

    function measure() {
      const element = ref.current
      if (!element) return
      onMeasuredHeight(chunk, element.getBoundingClientRect().height)
    }
  }, [chunk, onMeasuredHeight])

  return (
    <section
      ref={ref}
      aria-label={
        highlighted
          ? `Highlighted source lines ${highlightRange?.start}-${highlightRange?.end}`
          : `Markdown lines ${frame.sourceStartLine} to ${frame.sourceEndLine}`
      }
      className={[
        "absolute left-1/2 w-full max-w-4xl -translate-x-1/2 px-8 py-1",
        highlighted ? "ring-1 ring-primary/25 ring-inset" : "",
      ].join(" ")}
      data-pretext-markdown-chunk=""
      data-pretext-markdown-highlighted={highlighted ? "" : undefined}
      data-pretext-measured-height-key={measurementKey}
      data-source-highlight-end={highlighted ? highlightRange?.end : undefined}
      data-source-highlight-start={
        highlighted ? highlightRange?.start : undefined
      }
      data-source-end-line={frame.sourceEndLine}
      data-source-start-line={frame.sourceStartLine}
      role={highlighted ? "region" : undefined}
      style={{ top: frame.top }}
    >
      {children}
    </section>
  )
}

function SourceCanvas({
  fontScale,
  highlightRange,
  lines,
  scrollTop,
  viewportHeight,
}: {
  fontScale: number
  highlightRange: { end: number; start: number } | null
  lines: readonly string[]
  scrollTop: number
  viewportHeight: number
}) {
  const lineHeight = SOURCE_LINE_HEIGHT * fontScale
  const start = Math.max(0, Math.floor(scrollTop / lineHeight) - 24)
  const end = Math.min(
    lines.length,
    Math.ceil((scrollTop + viewportHeight) / lineHeight) + 24
  )

  return (
    <pre
      aria-label="Markdown source"
      className="absolute inset-x-0 top-0 m-0 min-w-max bg-background font-mono text-[13px] leading-none text-foreground"
      data-slot="pretext-markdown-source-canvas"
      role="region"
      style={{ height: Math.max(lines.length, 1) * lineHeight }}
      tabIndex={0}
    >
      {lines.slice(start, end).map((line, offset) => {
        const lineNumber = start + offset + 1
        const highlighted =
          highlightRange &&
          lineNumber >= highlightRange.start &&
          lineNumber <= highlightRange.end
        return (
          <div
            key={lineNumber}
            className={[
              "absolute inset-x-0 grid grid-cols-[4rem_minmax(0,1fr)] px-4",
              highlighted ? "bg-primary/12" : "",
            ].join(" ")}
            data-source-line={lineNumber}
            style={{
              height: lineHeight,
              lineHeight: `${lineHeight}px`,
              top: (lineNumber - 1) * lineHeight,
            }}
          >
            <span
              aria-hidden="true"
              className="pr-4 text-right text-muted-foreground select-none"
            >
              {lineNumber}
            </span>
            <code className="whitespace-pre" data-source-line-content="">
              {line || " "}
            </code>
          </div>
        )
      })}
    </pre>
  )
}

function useMarkdownSearch({
  lineCount,
  text,
}: {
  lineCount: number
  text: string
}) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)
  const searchMatches = React.useMemo(
    () => buildPretextMarkdownSearchMatches(text, searchQuery),
    [searchQuery, text]
  )
  const activeSearchMatch =
    searchMatches.length === 0
      ? null
      : searchMatches[Math.min(activeIndex, searchMatches.length - 1)]
  const activeSearchRange = React.useMemo(
    () =>
      activeSearchMatch
        ? normalizeTextLineRange(
            {
              end: activeSearchMatch.endLine,
              start: activeSearchMatch.startLine,
            },
            lineCount
          )
        : null,
    [activeSearchMatch, lineCount]
  )

  // Changing the query resets the active match in the same event that sets it,
  // rather than reacting to the change in an effect.
  const updateSearchQuery = React.useCallback((next: string) => {
    setSearchQuery(next)
    setActiveIndex(0)
  }, [])

  const goToSearchMatch = React.useCallback(
    (direction: 1 | -1) => {
      setActiveIndex((current) => {
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
    setActiveIndex(0)
  }, [])

  return {
    activeSearchMatch,
    activeSearchRange,
    clearSearch,
    goToSearchMatch,
    searchMatches,
    searchQuery,
    setSearchQuery: updateSearchQuery,
  }
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
    offset = Math.max(endOffset, startOffset + 1)
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
    if ((lineStarts[middle] ?? 0) <= offset) low = middle + 1
    else high = middle - 1
  }

  return Math.max(1, high + 1)
}

function resolveScrollBehavior(behavior: ScrollBehavior | undefined) {
  if (behavior) return behavior
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    return "auto"
  }
  return "smooth"
}

function handleRenderedClick({
  document,
  event,
  scrollToLineRange,
}: {
  document: ReturnType<typeof createPretextMarkdownGreenfieldDocument>
  event: React.MouseEvent
  scrollToLineRange: (
    range: ReturnType<typeof normalizeTextLineRange>,
    options?: PretextMarkdownScrollToLineOptions
  ) => void
}) {
  const link = (event.target as HTMLElement | null)?.closest("a[href]")
  const href = link?.getAttribute("href")
  if (!href?.startsWith("#")) return

  const target = findPretextMarkdownGreenfieldFragmentTargetById(document, href)
  if (!target) return
  const chunk = findPretextMarkdownGreenfieldChunkByBlockId(
    document,
    target.blockId
  )

  event.preventDefault()
  window.history.pushState(null, "", href)
  scrollToLineRange(
    normalizeTextLineRange(
      { end: target.sourceLine, start: target.sourceLine },
      document.lineCount
    ),
    { behavior: "smooth", preferredChunkId: chunk?.id }
  )
}

function chunkIntersectsLineRange({
  chunkFrame,
  range,
}: {
  chunkFrame: PretextMarkdownGreenfieldChunkFrame
  range: { end: number; start: number } | null
}) {
  if (!range) return false
  return (
    chunkFrame.sourceStartLine <= range.end &&
    chunkFrame.sourceEndLine >= range.start
  )
}

function measureChunkFrame(
  _chunk: PretextMarkdownGreenfieldChunk,
  _onMeasuredHeight: (
    chunk: PretextMarkdownGreenfieldChunk,
    height: number
  ) => void
) {
  // The wrapper frame owns ResizeObserver measurement. This callback exists so
  // rich children can request a measurement pass without knowing the wrapper.
}

function measuredHeightKey({
  chunk,
  context,
  documentMeasurementId,
}: {
  chunk: PretextMarkdownGreenfieldChunk
  context: PretextMarkdownGreenfieldMeasurementContext
  documentMeasurementId: string
}) {
  return [
    documentMeasurementId,
    chunk.id,
    Math.round(context.width),
    context.fontScale.toFixed(4),
    context.policyVersion,
  ].join(":")
}

function measurementDocumentIdForText(text: string) {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `md-${text.length}-${(hash >>> 0).toString(36)}`
}
