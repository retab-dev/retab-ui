"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

import type { ViewerResource } from "@/lib/viewer-resource"

import { CodeViewerFrame, CodeViewerToolbar } from "./code-viewer-chrome"
import { scrollLineRangeMetricsIntoView } from "./code-viewer-layout"
import { CodeLine } from "./code-viewer-line"
import {
  clampCodeViewerScale,
  CODE_VIEWER_BASE_FONT_PX,
  CODE_VIEWER_BASE_LINE_PX,
  CODE_VIEWER_BLOCK_PADDING,
  CODE_VIEWER_INITIAL_VIEWPORT_HEIGHT,
  CODE_VIEWER_OVERSCAN,
} from "./code-viewer-scale"
import type { CodeViewerHandle, CodeViewerProps } from "./code-viewer-types"
import { createInitialCodeVirtualLines } from "./code-viewer-virtualization"
import { isLineInRange, normalizeTextLineRange } from "./line-ranges"
import {
  readTextResource,
  resolvedTextViewerBounds,
  splitTextLines,
} from "./plain-text-resource"
import { ScrollArea } from "./scroll-area"

export function CodeViewerContent({
  resource,
  className,
  toolbar = true,
  highlight,
  bare = false,
  maxBytes,
  maxLines,
  retryVersion,
  forwardedRef,
}: CodeViewerProps & {
  resource: ViewerResource
  retryVersion: number
  forwardedRef?: React.ForwardedRef<CodeViewerHandle>
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
  const lineHeight = CODE_VIEWER_BASE_LINE_PX * fontScale
  const lineVirtualizer = useVirtualizer({
    count: textLines.length,
    getScrollElement: () => viewportElementRef.current,
    estimateSize: () => lineHeight,
    overscan: CODE_VIEWER_OVERSCAN,
    paddingStart: CODE_VIEWER_BLOCK_PADDING,
    paddingEnd: CODE_VIEWER_BLOCK_PADDING,
    initialRect: {
      width: 800,
      height: CODE_VIEWER_INITIAL_VIEWPORT_HEIGHT,
    },
  })

  const zoom = (factor: number) =>
    setFontScale((scale) => clampCodeViewerScale(scale * factor))

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
          paddingStart: CODE_VIEWER_BLOCK_PADDING,
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
      paddingStart: CODE_VIEWER_BLOCK_PADDING,
    })
  }, [highlightRange, lineHeight])

  const gutterWidth = `${String(textLines.length).length + 1}ch`
  const measuredVirtualLines = lineVirtualizer.getVirtualItems()
  const virtualLines =
    measuredVirtualLines.length > 0
      ? measuredVirtualLines
      : createInitialCodeVirtualLines(textLines.length, lineHeight)

  return (
    <CodeViewerFrame className={className} bare={bare}>
      {toolbar ? (
        <CodeViewerToolbar
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
            fontSize: `${CODE_VIEWER_BASE_FONT_PX * fontScale}px`,
            lineHeight: `${lineHeight}px`,
            height: lineVirtualizer.getTotalSize(),
          }}
        >
          {virtualLines.map((virtualLine) => {
            const lineNumber = virtualLine.index + 1
            return (
              <CodeLine
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
    </CodeViewerFrame>
  )
}
