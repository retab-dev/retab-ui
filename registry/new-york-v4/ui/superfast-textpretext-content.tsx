"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"

import { PlainTextViewerFrame } from "./plain-text-viewer-frame"
import { ScrollArea } from "./scroll-area"
import {
  layoutSuperfastTextpretextDocument,
  type SuperfastTextpretextChunkFrame,
  type SuperfastTextpretextDocumentFrame,
} from "./superfast-textpretext-layout"
import {
  createSuperfastTextpretextDocument,
  type SuperfastTextpretextChunk,
  type SuperfastTextpretextDocument,
} from "./superfast-textpretext-model"
import {
  getSuperfastTextpretextFrameScrollAnchor,
  getSuperfastTextpretextScrollTopForLineRange,
  getSuperfastTextpretextVisibleChunkFrames,
  resolveSuperfastTextpretextScrollAnchor,
  superfastTextpretextChunkIntersectsLineRange,
  type SuperfastTextpretextScrollAnchor,
} from "./superfast-textpretext-virtualizer"
import {
  TextViewerFallback,
  TextViewerFrame,
  TextViewerToolbar,
} from "./text-viewer-chrome"
import {
  normalizeTextLineRange,
  type NormalizedTextLineRange,
} from "./text-viewer-ranges"
import {
  readTextResource,
  resolvedTextViewerBounds,
} from "./text-viewer-resource"
import { clampTextViewerScale } from "./text-viewer-scale"
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types"

const HORIZONTAL_PADDING = 16
const INITIAL_TEXT_WIDTH = 768
const OVERSCAN_PX = 640

export function SuperfastTextpretextContent({
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
  const document = React.useMemo(
    () => createSuperfastTextpretextDocument(text),
    [text]
  )
  const downloadAction = React.useMemo(
    () => resource.originalDownload,
    [resource]
  )
  const [fontScale, setFontScale] = React.useState(1)
  const [contentWidth, setContentWidth] = React.useState(INITIAL_TEXT_WIDTH)
  const [measuredHeights, setMeasuredHeights] = React.useState(
    () => new Map<number, number>()
  )
  const [viewportState, setViewportState] = React.useState({
    height: 600,
    scrollTop: 0,
    width: 800,
  })
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const pendingScrollAnchorRef =
    React.useRef<SuperfastTextpretextScrollAnchor | null>(null)
  const lastHighlightScrollRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    setMeasuredHeights(new Map())
  }, [document, fontScale])

  const frame = React.useMemo(
    () =>
      layoutSuperfastTextpretextDocument({
        contentWidth,
        document,
        fontScale,
        measuredHeights,
      }),
    [contentWidth, document, fontScale, measuredHeights]
  )
  const highlightRange = React.useMemo(
    () => normalizeTextLineRange(highlight, document.sourceLineCount),
    [document.sourceLineCount, highlight]
  )
  const captureScrollAnchor = React.useCallback(() => {
    pendingScrollAnchorRef.current = getSuperfastTextpretextFrameScrollAnchor({
      frames: frame.chunks,
      scrollTop: viewportRef.current?.scrollTop ?? 0,
    })
  }, [frame.chunks])
  const updateViewportState = React.useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const nextWidth = viewport.clientWidth || viewportState.width
    const nextHeight = viewport.clientHeight || viewportState.height
    const nextScrollTop = viewport.scrollTop

    setViewportState((current) =>
      current.width === nextWidth &&
      current.height === nextHeight &&
      current.scrollTop === nextScrollTop
        ? current
        : {
            height: nextHeight,
            scrollTop: nextScrollTop,
            width: nextWidth,
          }
    )
  }, [viewportState.height, viewportState.width])

  React.useLayoutEffect(() => {
    updateViewportState()
  }, [updateViewportState])

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(() => {
      updateViewportState()
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [updateViewportState])

  React.useLayoutEffect(() => {
    const nextContentWidth = Math.max(
      1,
      viewportState.width - HORIZONTAL_PADDING * 2
    )
    setContentWidth((current) => {
      if (current === nextContentWidth) return current
      captureScrollAnchor()
      return nextContentWidth
    })
  }, [captureScrollAnchor, viewportState.width])

  React.useLayoutEffect(() => {
    const anchor = pendingScrollAnchorRef.current
    const viewport = viewportRef.current
    if (!anchor || !viewport) return

    pendingScrollAnchorRef.current = null
    const nextScrollTop = resolveSuperfastTextpretextScrollAnchor({
      anchor,
      frames: frame.chunks,
    })
    if (nextScrollTop != null) viewport.scrollTop = nextScrollTop
  }, [frame.chunks])

  const setMeasuredChunkHeight = React.useCallback(
    (index: number, height: number) => {
      if (!Number.isFinite(height) || height <= 0) return
      setMeasuredHeights((current) => {
        const previous = current.get(index)
        if (previous != null && Math.abs(previous - height) < 1) return current
        captureScrollAnchor()
        const next = new Map(current)
        next.set(index, height)
        return next
      })
    },
    [captureScrollAnchor]
  )

  const scrollLineRange = React.useCallback(
    (range: NormalizedTextLineRange | null, options?: ScrollToOptions) => {
      const viewport = viewportRef.current
      if (!viewport || !range) return

      const top = getSuperfastTextpretextScrollTopForLineRange({
        chunks: document.chunks,
        frames: frame.chunks,
        range,
        viewportHeight: viewport.clientHeight || viewportState.height,
      })
      if (top == null) return

      viewport.scrollTo({
        behavior: "smooth",
        top,
        ...options,
      })
    },
    [document.chunks, frame.chunks, viewportState.height]
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
    const scrollKey = highlightRange
      ? `${document.text.length}:${highlightRange.start}:${highlightRange.end}`
      : null
    if (!scrollKey || lastHighlightScrollRef.current === scrollKey) return

    lastHighlightScrollRef.current = scrollKey
    scrollLineRange(highlightRange)
  }, [document.text.length, highlightRange, scrollLineRange])

  return (
    <TextViewerFrame className={className} bare={bare}>
      {toolbar ? (
        <TextViewerToolbar
          wordCount={document.wordCount}
          fontScale={fontScale}
          copyText={text}
          downloadAction={downloadAction}
          leading={`${document.chunks.length} chunks`}
          onZoomOut={() => zoom(1 / 1.2)}
          onZoomIn={() => zoom(1.2)}
          onResetZoom={resetZoom}
        />
      ) : null}
      <ScrollArea
        className="min-h-0 flex-1 bg-background"
        orientation="vertical"
        viewportClassName="bg-background"
        viewportProps={{ onScroll: updateViewportState }}
        viewportRef={viewportRef}
      >
        <SuperfastTextpretextCanvas
          document={document}
          frame={frame}
          highlightRange={highlightRange}
          onMeasureChunk={setMeasuredChunkHeight}
          scrollTop={viewportState.scrollTop}
          viewportHeight={viewportState.height}
          viewportWidth={viewportState.width}
        />
      </ScrollArea>
    </TextViewerFrame>
  )
}

export const SuperfastTextpretext = React.forwardRef<
  TextViewerHandle,
  TextViewerProps
>(function SuperfastTextpretext(props, ref) {
  return (
    <PlainTextViewerFrame
      props={props}
      forwardedRef={ref}
      clientFallbackPolicy="always"
      Fallback={TextViewerFallback}
      Content={SuperfastTextpretextContent}
    />
  )
})

type SuperfastTextpretextCanvasProps = {
  document: SuperfastTextpretextDocument
  frame: SuperfastTextpretextDocumentFrame
  highlightRange: NormalizedTextLineRange | null
  onMeasureChunk: (index: number, height: number) => void
  scrollTop: number
  viewportHeight: number
  viewportWidth: number
}

function SuperfastTextpretextCanvas({
  document,
  frame,
  highlightRange,
  onMeasureChunk,
  scrollTop,
  viewportHeight,
  viewportWidth,
}: SuperfastTextpretextCanvasProps) {
  const visibleFrames = React.useMemo(
    () =>
      getSuperfastTextpretextVisibleChunkFrames({
        frames: frame.chunks,
        overscanPx: OVERSCAN_PX,
        scrollTop,
        viewportHeight,
      }),
    [frame.chunks, scrollTop, viewportHeight]
  )

  return (
    <div
      className="relative min-w-0"
      data-slot="superfast-textpretext-virtual-canvas"
      style={{
        height: frame.totalHeight,
        minWidth: viewportWidth,
      }}
    >
      {visibleFrames.map((chunkFrame) => {
        const chunk = document.chunks[chunkFrame.index]
        if (!chunk) return null

        return (
          <SuperfastTextpretextChunkView
            key={chunk.id}
            chunk={chunk}
            frame={chunkFrame}
            highlightRange={highlightRange}
            onMeasureChunk={onMeasureChunk}
          />
        )
      })}
    </div>
  )
}

function SuperfastTextpretextChunkView({
  chunk,
  frame,
  highlightRange,
  onMeasureChunk,
}: {
  chunk: SuperfastTextpretextChunk
  frame: SuperfastTextpretextChunkFrame
  highlightRange: NormalizedTextLineRange | null
  onMeasureChunk: (index: number, height: number) => void
}) {
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const isHighlighted = superfastTextpretextChunkIntersectsLineRange({
    chunk,
    range: highlightRange,
  })
  const highlightedLabel = isHighlighted
    ? `Highlighted source lines ${highlightRange?.start} to ${highlightRange?.end}`
    : undefined

  React.useLayoutEffect(() => {
    const node = contentRef.current
    if (!node) return

    const reportHeight = () => {
      const height = node.scrollHeight || node.offsetHeight
      onMeasureChunk(chunk.index, height)
    }
    reportHeight()

    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height
      if (height != null) onMeasureChunk(chunk.index, height)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [chunk.index, onMeasureChunk])

  return (
    <div
      className={cn(
        "absolute left-0 w-full px-4",
        isHighlighted && "bg-primary/12 ring-1 ring-primary/30 ring-inset"
      )}
      data-superfast-textpretext-chunk=""
      data-superfast-textpretext-highlighted={isHighlighted ? "" : undefined}
      data-source-highlight-start={
        isHighlighted ? highlightRange?.start : undefined
      }
      data-source-highlight-end={
        isHighlighted ? highlightRange?.end : undefined
      }
      data-source-start-line={chunk.sourceStartLine}
      data-source-end-line={chunk.sourceEndLine}
      role={isHighlighted ? "region" : undefined}
      aria-label={highlightedLabel}
      style={{
        minHeight: frame.estimatedHeight,
        transform: `translateY(${frame.top}px)`,
      }}
    >
      <div
        ref={contentRef}
        className="mx-auto max-w-4xl px-8 py-0"
        style={{
          minHeight: frame.estimatedHeight,
        }}
      >
        {chunk.kind === "blank-run" ? (
          <div
            aria-hidden="true"
            data-slot="superfast-textpretext-blank-run"
            style={{ height: frame.estimatedHeight }}
          />
        ) : chunk.kind === "preformatted" ? (
          <pre className="my-0 overflow-x-auto rounded-md border bg-muted/45 p-3 font-mono text-[0.85em] leading-relaxed break-words whitespace-pre-wrap text-foreground">
            <code>{chunk.text}</code>
          </pre>
        ) : (
          <p className="m-0 text-[15px] leading-6 break-words whitespace-pre-wrap text-foreground">
            {chunk.text}
          </p>
        )}
      </div>
    </div>
  )
}
