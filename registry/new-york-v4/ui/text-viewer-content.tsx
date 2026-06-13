"use client"

import * as React from "react"
import { layout, prepare } from "@chenglou/pretext"

import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TextViewerToolbar } from "@/components/ui/text-viewer-chrome"
import {
  isLineInRange,
  normalizeTextLineRange,
} from "@/components/ui/text-viewer-ranges"
import {
  readTextResource,
  resolvedTextViewerBounds,
  splitTextLines,
} from "@/components/ui/text-viewer-resource"

import { TextViewerFrame } from "./text-viewer-chrome"
import {
  clampTextViewerScale,
  TEXT_VIEWER_BLOCK_PADDING,
} from "./text-viewer-scale"
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types"
import { useTextVariableVirtualizer } from "./text-viewer-virtualization"

const TEXT_VIEWER_BASE_FONT_PX = 15
const TEXT_VIEWER_BASE_LINE_PX = 24
const TEXT_VIEWER_HORIZONTAL_PADDING = 16
const TEXT_VIEWER_INITIAL_TEXT_WIDTH = 706
const TEXT_VIEWER_OVERSCAN = 6
const TEXT_VIEWER_FONT_FAMILY = "Arial, sans-serif"
const TEXT_VIEWER_FONT_NAME = "Arial"
const TEXT_LAYOUT_CACHE_LIMIT = 50_000

const textLayoutHeightCache = new Map<string, number>()

interface TextLineLayout {
  height: number
}

export function TextViewerContent({
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
  const bounds = resolvedTextViewerBounds({ maxBytes, maxLines })
  const text = readTextResource({
    content: resource.content,
    retryVersion,
    bounds,
  })
  const textLines = React.useMemo(() => splitTextLines(text), [text])
  const wordCount = React.useMemo(() => countTextWords(text), [text])
  const highlightStart = highlight?.start
  const highlightEnd = highlight?.end
  const highlightRange = React.useMemo(
    () =>
      normalizeTextLineRange(
        highlightStart == null || highlightEnd == null
          ? null
          : { start: highlightStart, end: highlightEnd },
        textLines.length
      ),
    [highlightStart, highlightEnd, textLines.length]
  )
  const downloadAction = React.useMemo(
    () => resource.originalDownload,
    [resource]
  )

  const [fontScale, setFontScale] = React.useState(1)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const fontSize = TEXT_VIEWER_BASE_FONT_PX * fontScale
  const lineHeight = TEXT_VIEWER_BASE_LINE_PX * fontScale
  const [contentWidth, setContentWidth] = React.useState(
    TEXT_VIEWER_INITIAL_TEXT_WIDTH
  )
  const lineLayouts = React.useMemo(
    () =>
      layoutTextLines({
        contentWidth,
        fontSize,
        lineHeight,
        textLines,
      }),
    [contentWidth, fontSize, lineHeight, textLines]
  )
  const itemSizes = React.useMemo(
    () => lineLayouts.map((lineLayout) => lineLayout.height),
    [lineLayouts]
  )
  const { offsets, totalSize, virtualItems, viewportWidth } =
    useTextVariableVirtualizer({
      itemSizes,
      overscan: TEXT_VIEWER_OVERSCAN,
      paddingEnd: TEXT_VIEWER_BLOCK_PADDING,
      paddingStart: TEXT_VIEWER_BLOCK_PADDING,
      scrollRef: viewportRef,
    })

  React.useLayoutEffect(() => {
    const nextContentWidth = Math.max(
      1,
      viewportWidth - TEXT_VIEWER_HORIZONTAL_PADDING * 2
    )
    setContentWidth((current) =>
      current === nextContentWidth ? current : nextContentWidth
    )
  }, [viewportWidth])

  const scrollLineRange = React.useCallback(
    (
      range: ReturnType<typeof normalizeTextLineRange>,
      options?: ScrollToOptions
    ) => {
      const scrollElement = viewportRef.current
      if (!scrollElement || !range) return
      const startIndex = range.start - 1
      const endIndex = range.end - 1
      const startTop = offsets.starts[startIndex]
      const endTop = offsets.starts[endIndex]
      const endHeight = itemSizes[endIndex]
      if (startTop == null || endTop == null || endHeight == null) return

      const rangeBottom = endTop + endHeight
      const rangeHeight = rangeBottom - startTop
      const targetTop =
        rangeHeight <= scrollElement.clientHeight
          ? startTop - (scrollElement.clientHeight - rangeHeight) / 2
          : startTop

      scrollElement.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
        ...options,
      })
    },
    [itemSizes, offsets]
  )

  const zoom = (factor: number) =>
    setFontScale((scale) => clampTextViewerScale(scale * factor))

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      scrollToLineRange: (range, options) => {
        scrollLineRange(
          normalizeTextLineRange(range, textLines.length),
          options
        )
      },
      getViewportElement: () => viewportRef.current,
    }),
    [scrollLineRange, textLines.length]
  )

  React.useEffect(() => {
    scrollLineRange(highlightRange)
  }, [highlightRange, scrollLineRange])

  return (
    <TextViewerFrame className={className} bare={bare}>
      {toolbar ? (
        <TextViewerToolbar
          wordCount={wordCount}
          fontScale={fontScale}
          downloadAction={downloadAction}
          onZoomOut={() => zoom(1 / 1.2)}
          onZoomIn={() => zoom(1.2)}
          onResetZoom={() => setFontScale(1)}
        />
      ) : null}
      <ScrollArea
        className="min-h-0 flex-1 bg-background"
        orientation="vertical"
        viewportClassName="bg-background"
        viewportRef={viewportRef}
      >
        <div
          className="relative min-w-0"
          data-slot="text-virtual-canvas"
          style={{
            height: totalSize,
            minWidth: viewportWidth,
          }}
        >
          {virtualItems.map((item) => {
            const lineNumber = item.index + 1
            return (
              <TextLineBlock
                key={item.key}
                fontSize={fontSize}
                isHighlighted={isLineInRange(lineNumber, highlightRange)}
                lineHeight={lineHeight}
                lineNumber={lineNumber}
                text={textLines[item.index] ?? ""}
                style={{
                  height: item.size,
                  transform: `translateY(${item.start}px)`,
                }}
              />
            )
          })}
        </div>
      </ScrollArea>
    </TextViewerFrame>
  )
}

function TextLineBlock({
  fontSize,
  isHighlighted,
  lineHeight,
  lineNumber,
  style,
  text,
}: {
  fontSize: number
  isHighlighted: boolean
  lineHeight: number
  lineNumber: number
  style: React.CSSProperties
  text: string
}) {
  return (
    <div
      data-source-line={lineNumber}
      data-slot="text-line"
      className={cn(
        "absolute top-0 left-0 w-full px-4",
        isHighlighted && "bg-primary/12 ring-1 ring-primary/30 ring-inset"
      )}
      style={style}
    >
      <span
        className="block min-w-0 break-words whitespace-pre-wrap text-foreground"
        style={{
          fontFamily: TEXT_VIEWER_FONT_FAMILY,
          fontSize,
          lineHeight: `${lineHeight}px`,
          tabSize: 8,
        }}
      >
        {text || " "}
      </span>
    </div>
  )
}

function layoutTextLines({
  contentWidth,
  fontSize,
  lineHeight,
  textLines,
}: {
  contentWidth: number
  fontSize: number
  lineHeight: number
  textLines: readonly string[]
}): TextLineLayout[] {
  return textLines.map((line) => ({
    height: measureTextLineHeight({
      contentWidth,
      fontSize,
      lineHeight,
      text: line,
    }),
  }))
}

function measureTextLineHeight({
  contentWidth,
  fontSize,
  lineHeight,
  text,
}: {
  contentWidth: number
  fontSize: number
  lineHeight: number
  text: string
}) {
  const cacheKey = [
    Math.round(contentWidth),
    Math.round(fontSize * 100) / 100,
    Math.round(lineHeight * 100) / 100,
    text,
  ].join("\u0000")
  const cachedHeight = textLayoutHeightCache.get(cacheKey)
  if (cachedHeight != null) return cachedHeight

  const height = measureTextLineHeightUncached({
    contentWidth,
    fontSize,
    lineHeight,
    text,
  })
  textLayoutHeightCache.set(cacheKey, height)
  trimTextLayoutHeightCache()
  return height
}

function measureTextLineHeightUncached({
  contentWidth,
  fontSize,
  lineHeight,
  text,
}: {
  contentWidth: number
  fontSize: number
  lineHeight: number
  text: string
}) {
  try {
    const font = `400 ${fontSize}px ${TEXT_VIEWER_FONT_NAME}`
    const prepared = prepare(text || " ", font, { whiteSpace: "pre-wrap" })
    return Math.max(
      lineHeight,
      layout(prepared, contentWidth, lineHeight).height
    )
  } catch {
    return estimateWrappedHeight({ contentWidth, lineHeight, text })
  }
}

function estimateWrappedHeight({
  contentWidth,
  lineHeight,
  text,
}: {
  contentWidth: number
  lineHeight: number
  text: string
}) {
  const averageGlyphWidth = lineHeight * 0.45
  const columns = Math.max(1, Math.floor(contentWidth / averageGlyphWidth))
  const visualLineCount = Math.max(
    1,
    text.split("\n").reduce((count, line) => {
      return count + Math.max(1, Math.ceil((line || " ").length / columns))
    }, 0)
  )
  return visualLineCount * lineHeight
}

function trimTextLayoutHeightCache() {
  while (textLayoutHeightCache.size > TEXT_LAYOUT_CACHE_LIMIT) {
    const firstKey = textLayoutHeightCache.keys().next().value
    if (firstKey == null) return
    textLayoutHeightCache.delete(firstKey)
  }
}

function countTextWords(text: string) {
  const matches = text.trim().match(/\S+/g)
  return matches?.length ?? 0
}
