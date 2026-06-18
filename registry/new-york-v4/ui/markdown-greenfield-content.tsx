"use client"

import * as React from "react"

import type { ViewerResource } from "@/lib/viewer-resource"

import {
  createMarkdownGreenfieldDocument,
  findMarkdownGreenfieldChunkByBlockId,
  findMarkdownGreenfieldChunkBySourceLine,
  findMarkdownGreenfieldFragmentTargetById,
  type MarkdownGreenfieldChunk,
} from "./markdown-greenfield-document"
import { useMarkdownGreenfieldDocument } from "./markdown-greenfield-document-store"
import {
  layoutMarkdownGreenfieldDocument,
  MARKDOWN_GREENFIELD_LAYOUT_POLICY_VERSION,
  type MarkdownGreenfieldChunkFrame,
  type MarkdownGreenfieldMeasurementContext,
} from "./markdown-greenfield-layout"
import { MarkdownGreenfieldChunkRenderer } from "./markdown-greenfield-renderer"
import {
  getMarkdownGreenfieldScrollAnchor,
  getMarkdownGreenfieldScrollTopForLineRange,
  getMarkdownGreenfieldVisibleFrames,
  resolveMarkdownGreenfieldScrollAnchor,
  type MarkdownGreenfieldScrollAnchor,
} from "./markdown-greenfield-virtualizer"
import type {
  MarkdownHastElement,
  MarkdownHastNode,
} from "./markdown-hast-types"
import { ScrollArea } from "./scroll-area"
import { TextViewerControls, TextViewerFrame } from "./text-viewer-chrome"
import { normalizeTextLineRange } from "./text-viewer-ranges"
import {
  readTextResource,
  resolvedTextViewerBounds,
} from "./text-viewer-resource"
import { clampTextViewerScale } from "./text-viewer-scale"
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types"
import type { ViewerDownloadErrorHandler } from "./viewer-download"

const DEFAULT_VIEWPORT_HEIGHT = 640
const DEFAULT_VIEWPORT_WIDTH = 900
const INITIAL_CONTENT_WIDTH = 820
const VIEWER_HORIZONTAL_PADDING = 32
const OVERSCAN_PX = 800
const MARKDOWN_GREENFIELD_HIGHLIGHT_STYLE = {
  backgroundColor:
    "color-mix(in oklab, var(--foreground) 8%, var(--background))",
  boxShadow: "inset 2px 0 0 0 var(--primary)",
} satisfies React.CSSProperties

type MarkdownIdleWindow = Window &
  typeof globalThis & {
    cancelIdleCallback?: Window["cancelIdleCallback"]
    requestIdleCallback?: Window["requestIdleCallback"]
  }

type ViewportSize = {
  height: number
  width: number
}

type MarkdownScrollToLineOptions = ScrollToOptions & {
  preferredChunkId?: string | null
}

export function MarkdownGreenfieldContent({
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
  const parsedDocument = useMarkdownGreenfieldDocument(text)
  const pendingDocument = React.useMemo(
    () => createMarkdownGreenfieldDocument(" "),
    []
  )
  const document = parsedDocument ?? pendingDocument
  const isDocumentPending = parsedDocument == null
  const documentMeasurementId = React.useMemo(
    () => measurementDocumentIdForText(text),
    [text]
  )
  const downloadAction = download ? resource.originalDownload : null
  const [downloadError, setDownloadError] = React.useState("")
  const [fontScale, setFontScale] = React.useState(1)
  const [measuredHeights, setMeasuredHeights] = React.useState(
    () => new Map<string, number>()
  )
  const [measuredHeightsRevision, setMeasuredHeightsRevision] =
    React.useState(0)
  const [scrollTop, setScrollTop] = React.useState(0)
  const [viewportSize, setViewportSize] = React.useState<ViewportSize>({
    height: 0,
    width: 0,
  })
  const [contentWidth, setContentWidth] = React.useState(INITIAL_CONTENT_WIDTH)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const scrollTopRef = React.useRef(0)
  const scrollFrameRef = React.useRef<number | null>(null)
  const pendingMeasuredHeightsRef = React.useRef(new Map<string, number>())
  const measuredHeightFrameRef = React.useRef<number | null>(null)
  const pendingAnchorRef = React.useRef<MarkdownGreenfieldScrollAnchor | null>(
    null
  )
  const prevFrameChunksRef = React.useRef<
    readonly MarkdownGreenfieldChunkFrame[] | null
  >(null)
  const viewportHeight = viewportSize.height || DEFAULT_VIEWPORT_HEIGHT
  const viewportWidth = viewportSize.width || DEFAULT_VIEWPORT_WIDTH
  const measuredHeightLookup = React.useMemo(
    () => ({
      get: (
        chunk: MarkdownGreenfieldChunk,
        context: MarkdownGreenfieldMeasurementContext
      ) =>
        measuredHeights.get(
          measuredHeightKey({
            chunk,
            context,
            documentMeasurementId,
          })
        ),
      cacheKey: `${documentMeasurementId}:${measuredHeightsRevision}`,
    }),
    [documentMeasurementId, measuredHeights, measuredHeightsRevision]
  )
  const frame = React.useMemo(
    () =>
      layoutMarkdownGreenfieldDocument({
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
  const visibleHighlightRange = highlightRange
  const visibleFrames = React.useMemo(
    () =>
      getMarkdownGreenfieldVisibleFrames({
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
    const liveScrollTop = viewportRef.current?.scrollTop ?? scrollTopRef.current
    pendingAnchorRef.current = getMarkdownGreenfieldScrollAnchor({
      frames: frame.chunks,
      scrollTop: liveScrollTop,
    })
  }, [frame.chunks])

  const commitScrollTop = React.useCallback((nextScrollTop: number) => {
    scrollTopRef.current = nextScrollTop
    setScrollTop(nextScrollTop)
  }, [])

  const scheduleScrollTop = React.useCallback(
    (nextScrollTop: number) => {
      scrollTopRef.current = nextScrollTop
      if (scrollFrameRef.current !== null) return
      if (typeof requestAnimationFrame !== "function") {
        commitScrollTop(scrollTopRef.current)
        return
      }
      scrollFrameRef.current = requestAnimationFrame(() => {
        scrollFrameRef.current = null
        commitScrollTop(scrollTopRef.current)
      })
    },
    [commitScrollTop]
  )

  const flushMeasuredHeights = React.useCallback(() => {
    measuredHeightFrameRef.current = null
    const pending = pendingMeasuredHeightsRef.current
    if (!pending.size) return
    pendingMeasuredHeightsRef.current = new Map()
    setMeasuredHeights((current) => {
      let next: Map<string, number> | null = null
      for (const [key, height] of pending) {
        if (Math.abs((current.get(key) ?? 0) - height) < 1) continue
        next ??= new Map(current)
        next.set(key, height)
      }
      if (!next) return current
      setMeasuredHeightsRevision((revision) => revision + 1)
      return next
    })
  }, [])

  const scheduleMeasuredHeightsFlush = React.useCallback(() => {
    if (measuredHeightFrameRef.current !== null) return
    if (typeof requestAnimationFrame !== "function") {
      flushMeasuredHeights()
      return
    }
    measuredHeightFrameRef.current = requestAnimationFrame(flushMeasuredHeights)
  }, [flushMeasuredHeights])

  React.useLayoutEffect(() => {
    setMeasuredHeights(new Map())
    setMeasuredHeightsRevision((revision) => revision + 1)
    commitScrollTop(0)
    viewportRef.current?.scrollTo({ left: 0, top: 0 })
  }, [commitScrollTop, document])

  React.useEffect(
    () => () => {
      if (
        scrollFrameRef.current !== null &&
        typeof cancelAnimationFrame === "function"
      ) {
        cancelAnimationFrame(scrollFrameRef.current)
      }
      if (
        measuredHeightFrameRef.current !== null &&
        typeof cancelAnimationFrame === "function"
      ) {
        cancelAnimationFrame(measuredHeightFrameRef.current)
      }
    },
    []
  )

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
      const nextScrollTop = resolveMarkdownGreenfieldScrollAnchor({
        anchor,
        frames: frame.chunks,
      })
      if (nextScrollTop == null) return
      viewport.scrollTop = nextScrollTop
      commitScrollTop(nextScrollTop)
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
    commitScrollTop(nextScrollTop)
  }, [commitScrollTop, frame.chunks])

  const scrollToLineRange = React.useCallback(
    (
      range: ReturnType<typeof normalizeTextLineRange>,
      options?: MarkdownScrollToLineOptions
    ) => {
      const viewport = viewportRef.current
      if (!viewport || !range) return

      const preferredChunkId =
        options?.preferredChunkId ??
        findMarkdownGreenfieldChunkBySourceLine(document, range.start)?.id
      const top = getMarkdownGreenfieldScrollTopForLineRange({
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
      commitScrollTop(top)
    },
    [commitScrollTop, document, frame.chunks, viewportHeight]
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

  // Subscribes to the browser's hash/history (a non-React external source) and
  // scrolls the matching fragment into view before paint.
  React.useLayoutEffect(() => {
    const scrollToCurrentHash = () => {
      const hash = window.location.hash
      if (!hash) return
      const target = findMarkdownGreenfieldFragmentTargetById(document, hash)
      if (!target) return
      const chunk = findMarkdownGreenfieldChunkByBlockId(
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

  const recordMeasuredHeight = React.useCallback(
    (chunk: MarkdownGreenfieldChunk, height: number) => {
      if (!Number.isFinite(height) || height <= 0) return
      const key = measuredHeightKey({
        chunk,
        context: {
          fontScale,
          policyVersion: MARKDOWN_GREENFIELD_LAYOUT_POLICY_VERSION,
          width: Math.max(1, contentWidth),
        },
        documentMeasurementId,
      })
      pendingMeasuredHeightsRef.current.set(key, height)
      scheduleMeasuredHeightsFlush()
    },
    [
      contentWidth,
      documentMeasurementId,
      fontScale,
      scheduleMeasuredHeightsFlush,
    ]
  )
  const handleDownloadError = React.useCallback<ViewerDownloadErrorHandler>(
    (error) => {
      if (error.kind === "aborted") return
      setDownloadError(error.message || "Could not download Markdown.")
    },
    []
  )
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
          downloadAction={downloadAction}
          extra={<DownloadError message={downloadError} />}
          fontScale={fontScale}
          wordCount={
            isDocumentPending
              ? estimateMarkdownWordCount(text)
              : document.wordCount
          }
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
          onClickCapture: (event) =>
            handleRenderedClick({ document, event, scrollToLineRange }),
          onScroll: (event) => scheduleScrollTop(event.currentTarget.scrollTop),
        }}
      >
        <div
          className="relative min-w-0"
          data-projection="unified-hast-markdown"
          data-slot="markdown-virtual-canvas"
          style={{
            height: Math.max(frame.totalHeight, viewportHeight),
            minWidth: viewportWidth,
          }}
        >
          {isDocumentPending ? null : (
            <DeferredNativeFindIndex
              chunks={document.chunks}
              lineCount={document.lineCount}
              scrollToLineRange={scrollToLineRange}
            />
          )}
          {isDocumentPending ? (
            <div
              aria-label="Preparing Markdown document"
              className="absolute inset-x-4 top-0 flex min-h-40 items-center justify-center text-sm text-muted-foreground"
              data-slot="markdown-loading-state"
              role="status"
            >
              Preparing Markdown...
            </div>
          ) : document.text.trim() ? (
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
                      policyVersion: MARKDOWN_GREENFIELD_LAYOUT_POLICY_VERSION,
                      width: Math.max(1, contentWidth),
                    },
                    documentMeasurementId,
                  })}
                  onMeasuredHeight={recordMeasuredHeight}
                >
                  <MarkdownGreenfieldChunkRenderer
                    chunk={chunk}
                    fontScale={fontScale}
                  />
                </ChunkFrame>
              )
            })
          ) : (
            <div
              aria-label="Empty Markdown document"
              className="absolute inset-x-4 top-0 flex min-h-40 items-center justify-center text-sm text-muted-foreground"
              data-slot="markdown-empty-state"
              role="status"
            >
              Empty Markdown document
            </div>
          )}
        </div>
      </ScrollArea>
    </TextViewerFrame>
  )
}

function DeferredNativeFindIndex({
  chunks,
  lineCount,
  scrollToLineRange,
}: {
  chunks: readonly MarkdownGreenfieldChunk[]
  lineCount: number
  scrollToLineRange: (
    range: ReturnType<typeof normalizeTextLineRange>,
    options?: MarkdownScrollToLineOptions
  ) => void
}) {
  const [isReady, setIsReady] = React.useState(false)

  React.useEffect(() => {
    setIsReady(false)
    const show = () => setIsReady(true)
    if (typeof window === "undefined") return
    const browserWindow = window as MarkdownIdleWindow
    if (browserWindow.requestIdleCallback && browserWindow.cancelIdleCallback) {
      const idleId = browserWindow.requestIdleCallback(show, { timeout: 400 })
      return () => browserWindow.cancelIdleCallback?.(idleId)
    }
    const timeoutId = browserWindow.setTimeout(show, 80)
    return () => browserWindow.clearTimeout(timeoutId)
  }, [chunks])

  if (!isReady) return null
  return (
    <NativeFindIndex
      chunks={chunks}
      lineCount={lineCount}
      scrollToLineRange={scrollToLineRange}
    />
  )
}

function NativeFindIndex({
  chunks,
  lineCount,
  scrollToLineRange,
}: {
  chunks: readonly MarkdownGreenfieldChunk[]
  lineCount: number
  scrollToLineRange: (
    range: ReturnType<typeof normalizeTextLineRange>,
    options?: MarkdownScrollToLineOptions
  ) => void
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 h-px w-px overflow-hidden opacity-0"
      data-slot="markdown-native-find-index"
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
  chunk: MarkdownGreenfieldChunk
  lineCount: number
  scrollToLineRange: (
    range: ReturnType<typeof normalizeTextLineRange>,
    options?: MarkdownScrollToLineOptions
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

function nativeFindTextForChunk(chunk: MarkdownGreenfieldChunk) {
  return chunk.hastChildren.map(nativeFindTextForHastNode).join(" ").trim()
}

function nativeFindTextForHastNode(node: MarkdownHastNode): string {
  if (node.type === "text" && typeof node.value === "string") return node.value
  const element = node as MarkdownHastElement
  if (!element || element.type !== "element") return ""

  if (element.tagName === "script" || element.tagName === "style") return ""
  return element.children.map(nativeFindTextForHastNode).join(" ")
}

function DownloadError({ message }: { message: string }) {
  if (!message) return null
  return (
    <span
      className="max-w-48 truncate text-xs text-destructive"
      data-slot="markdown-download-error"
      role="status"
    >
      {message}
    </span>
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
  chunk: MarkdownGreenfieldChunk
  frame: MarkdownGreenfieldChunkFrame
  highlightRange: { end: number; start: number } | null
  highlighted: boolean
  measurementKey: string
  onMeasuredHeight: (chunk: MarkdownGreenfieldChunk, height: number) => void
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
      ].join(" ")}
      data-markdown-chunk=""
      data-markdown-highlighted={highlighted ? "" : undefined}
      data-pretext-measured-height-key={measurementKey}
      data-source-highlight-end={highlighted ? highlightRange?.end : undefined}
      data-source-highlight-start={
        highlighted ? highlightRange?.start : undefined
      }
      data-source-end-line={frame.sourceEndLine}
      data-source-start-line={frame.sourceStartLine}
      role={highlighted ? "region" : undefined}
      style={{
        top: frame.top,
        ...(highlighted ? MARKDOWN_GREENFIELD_HIGHLIGHT_STYLE : null),
      }}
    >
      {children}
    </section>
  )
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
  document: ReturnType<typeof createMarkdownGreenfieldDocument>
  event: React.MouseEvent
  scrollToLineRange: (
    range: ReturnType<typeof normalizeTextLineRange>,
    options?: MarkdownScrollToLineOptions
  ) => void
}) {
  const link = (event.target as HTMLElement | null)?.closest("a[href]")
  const href = link?.getAttribute("href")
  if (!href?.startsWith("#")) return

  const target = findMarkdownGreenfieldFragmentTargetById(document, href)
  if (!target) return
  const chunk = findMarkdownGreenfieldChunkByBlockId(document, target.blockId)

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
  chunkFrame: MarkdownGreenfieldChunkFrame
  range: { end: number; start: number } | null
}) {
  if (!range) return false
  return (
    chunkFrame.sourceStartLine <= range.end &&
    chunkFrame.sourceEndLine >= range.start
  )
}

function measuredHeightKey({
  chunk,
  context,
  documentMeasurementId,
}: {
  chunk: MarkdownGreenfieldChunk
  context: MarkdownGreenfieldMeasurementContext
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

function estimateMarkdownWordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}
