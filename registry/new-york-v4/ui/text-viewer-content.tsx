"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

import type { ViewerResource } from "@/lib/viewer-resource"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  TextViewerFrame,
  TextViewerToolbar,
} from "@/components/ui/text-viewer-chrome"
import { scrollLineRangeMetricsIntoView } from "@/components/ui/text-viewer-layout"
import { TextLine } from "@/components/ui/text-viewer-line"
import {
  isLineInRange,
  normalizeTextLineRange,
} from "@/components/ui/text-viewer-ranges"
import {
  readTextResource,
  resolvedTextViewerBounds,
  splitTextLines,
} from "@/components/ui/text-viewer-resource"

import {
  clampTextViewerScale,
  TEXT_VIEWER_BASE_FONT_PX,
  TEXT_VIEWER_BASE_LINE_PX,
  TEXT_VIEWER_BLOCK_PADDING,
  TEXT_VIEWER_INITIAL_VIEWPORT_HEIGHT,
  TEXT_VIEWER_OVERSCAN,
} from "./text-viewer-scale"
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types"
import { createInitialTextVirtualLines } from "./text-viewer-virtualization"

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
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null)
  const lineHeight = TEXT_VIEWER_BASE_LINE_PX * fontScale
  const lineVirtualizer = useVirtualizer({
    count: textLines.length,
    getScrollElement: () => viewportElementRef.current,
    estimateSize: () => lineHeight,
    overscan: TEXT_VIEWER_OVERSCAN,
    paddingStart: TEXT_VIEWER_BLOCK_PADDING,
    paddingEnd: TEXT_VIEWER_BLOCK_PADDING,
    initialRect: {
      width: 800,
      height: TEXT_VIEWER_INITIAL_VIEWPORT_HEIGHT,
    },
  })

  const zoom = (factor: number) =>
    setFontScale((scale) => clampTextViewerScale(scale * factor))

  React.useEffect(() => {
    lineVirtualizer.measure()
  }, [lineHeight, lineVirtualizer])

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      scrollToLineRange: (range, options) => {
        scrollLineRangeMetricsIntoView({
          viewportElement: viewportElementRef.current,
          range: normalizeTextLineRange(range, textLines.length),
          lineHeight,
          paddingStart: TEXT_VIEWER_BLOCK_PADDING,
          options,
        })
      },
      getViewportElement: () => viewportElementRef.current,
    }),
    [lineHeight, textLines.length]
  )

  React.useEffect(() => {
    scrollLineRangeMetricsIntoView({
      viewportElement: viewportElementRef.current,
      range: highlightRange,
      lineHeight,
      paddingStart: TEXT_VIEWER_BLOCK_PADDING,
    })
  }, [highlightRange, lineHeight])

  const gutterWidth = `${String(textLines.length).length + 1}ch`
  const measuredVirtualLines = lineVirtualizer.getVirtualItems()
  const virtualLines =
    measuredVirtualLines.length > 0
      ? measuredVirtualLines
      : createInitialTextVirtualLines(textLines.length, lineHeight)

  return (
    <TextViewerFrame className={className} bare={bare}>
      {toolbar ? (
        <TextViewerToolbar
          lineCount={textLines.length}
          fontScale={fontScale}
          downloadAction={downloadAction}
          onZoomOut={() => zoom(1 / 1.2)}
          onZoomIn={() => zoom(1.2)}
          onResetZoom={() => setFontScale(1)}
        />
      ) : null}
      <ScrollArea className="min-h-0 flex-1" viewportRef={viewportElementRef}>
        <pre
          className="relative w-max min-w-full font-mono"
          style={{
            fontSize: `${TEXT_VIEWER_BASE_FONT_PX * fontScale}px`,
            lineHeight: `${lineHeight}px`,
            height: lineVirtualizer.getTotalSize(),
          }}
        >
          {virtualLines.map((virtualLine) => {
            const lineNumber = virtualLine.index + 1
            return (
              <TextLine
                key={virtualLine.key}
                gutterWidth={gutterWidth}
                isHighlighted={isLineInRange(lineNumber, highlightRange)}
                lineNumber={lineNumber}
                text={textLines[virtualLine.index] ?? ""}
                style={{
                  height: virtualLine.size,
                  transform: `translateY(${virtualLine.start}px)`,
                }}
              />
            )
          })}
        </pre>
      </ScrollArea>
    </TextViewerFrame>
  )
}
