"use client"

// Whole-file text viewer for source linking. It loads bounded text up front so
// every line is addressable, then virtualizes fixed-height rows for scrolling.
import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

import { cn } from "@/lib/utils"
import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource"
import type {
  BlobViewerSource,
  TextSource,
  UrlViewerSource,
} from "@/lib/viewer-source"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  TextViewerFallback,
  TextViewerFrame,
  TextViewerToolbar,
} from "@/components/ui/text-viewer-chrome"
import { scrollLineRangeMetricsIntoView } from "@/components/ui/text-viewer-layout"
import {
  isLineInRange,
  normalizeTextLineRange,
  type TextLineRange,
} from "@/components/ui/text-viewer-ranges"
import {
  readTextResource,
  resolvedTextViewerBounds,
  splitTextLines,
  type TextViewerBounds,
} from "@/components/ui/text-viewer-resource"
import { ViewerErrorBoundary } from "@/components/ui/viewer-error"

const BASE_FONT_PX = 12
const BASE_LINE_PX = 20
const MIN_SCALE = 0.25
const MAX_SCALE = 5
const TEXT_VIEWER_OVERSCAN = 24
const TEXT_VIEWER_BLOCK_PADDING = 8
const TEXT_VIEWER_INITIAL_VIEWPORT_HEIGHT = 600

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export type { TextLineRange }

interface TextVirtualLine {
  index: number
  key: React.Key
  size: number
  start: number
}

export interface TextViewerHandle {
  scrollToLineRange: (range: TextLineRange, options?: ScrollToOptions) => void
  getViewportElement: () => HTMLDivElement | null
}

export type TextDocumentSource = UrlViewerSource | BlobViewerSource | TextSource

export interface TextViewerProps extends TextViewerBounds {
  source: TextDocumentSource
  className?: string
  toolbar?: boolean
  /** 1-based inclusive line range to highlight, or null. */
  highlight?: TextLineRange | null
  /** Drop the outer border/rounded/background so the viewer fills its container. */
  bare?: boolean
}

export const TextViewer = React.forwardRef<TextViewerHandle, TextViewerProps>(
  function TextViewer(props, ref) {
    const [retryVersion, setRetryVersion] = React.useState(0)
    const isClient = useIsClient()
    const { source } = props
    const resource = React.useMemo(() => createViewerResource(source), [source])
    const resetKey = textViewerResetKey(resource, props, retryVersion)

    if (source.kind !== "text" && !isClient) {
      return (
        <TextViewerFallback
          className={props.className}
          toolbar={props.toolbar}
          bare={props.bare}
        />
      )
    }

    return (
      <ViewerErrorBoundary
        bare={props.bare}
        className={props.className}
        download={resource.getOriginalDownload()}
        format="text"
        resetKey={resetKey}
        sourceKind={resource.sourceKind}
        onRetry={() => setRetryVersion((version) => version + 1)}
      >
        <React.Suspense
          fallback={
            <TextViewerFallback
              className={props.className}
              toolbar={props.toolbar}
              bare={props.bare}
            />
          }
        >
          <TextViewerInner
            {...props}
            forwardedRef={ref}
            retryVersion={retryVersion}
            resource={resource}
          />
        </React.Suspense>
      </ViewerErrorBoundary>
    )
  }
)

function TextViewerInner({
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
  const text = readTextResource({ resource, retryVersion, bounds })
  const textLines = React.useMemo(() => splitTextLines(text), [text])
  const highlightRange = normalizeTextLineRange(highlight, textLines.length)
  const downloadAction = React.useMemo(
    () => resource.getOriginalDownload(),
    [resource]
  )

  const [fontScale, setFontScale] = React.useState(1)
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null)
  const lineHeight = BASE_LINE_PX * fontScale
  const lineVirtualizer = useVirtualizer({
    count: textLines.length,
    getScrollElement: () => viewportElementRef.current,
    estimateSize: () => lineHeight,
    overscan: TEXT_VIEWER_OVERSCAN,
    paddingStart: TEXT_VIEWER_BLOCK_PADDING,
    paddingEnd: TEXT_VIEWER_BLOCK_PADDING,
    initialRect: { width: 800, height: TEXT_VIEWER_INITIAL_VIEWPORT_HEIGHT },
  })

  const zoom = (factor: number) =>
    setFontScale((scale) => clamp(scale * factor, MIN_SCALE, MAX_SCALE))

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
            fontSize: `${BASE_FONT_PX * fontScale}px`,
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

function createInitialTextVirtualLines(
  lineCount: number,
  lineHeight: number
): TextVirtualLine[] {
  const windowLineCount = Math.min(
    lineCount,
    Math.ceil(TEXT_VIEWER_INITIAL_VIEWPORT_HEIGHT / lineHeight) +
      TEXT_VIEWER_OVERSCAN * 2
  )

  return Array.from({ length: windowLineCount }, (_, index) => ({
    index,
    key: index,
    size: lineHeight,
    start: TEXT_VIEWER_BLOCK_PADDING + index * lineHeight,
  }))
}

function TextLine({
  gutterWidth,
  isHighlighted,
  lineNumber,
  style,
  text,
}: {
  gutterWidth: string
  isHighlighted: boolean
  lineNumber: number
  style: React.CSSProperties
  text: string
}) {
  return (
    <div
      data-line-number={lineNumber}
      className={cn(
        "absolute top-0 left-0 flex min-w-full px-2",
        isHighlighted && "bg-primary/12 ring-1 ring-primary/30 ring-inset"
      )}
      style={style}
    >
      <span
        className="flex-shrink-0 pr-3 text-right text-muted-foreground/60 select-none"
        style={{ width: gutterWidth }}
      >
        {lineNumber}
      </span>
      <span className="whitespace-pre">{text || " "}</span>
    </div>
  )
}

function textViewerResetKey(
  resource: ViewerResource,
  props: Pick<TextViewerProps, "maxBytes" | "maxLines">,
  retryVersion: number
): string {
  return [
    resource.keys.resource,
    retryVersion,
    props.maxBytes ?? "",
    props.maxLines ?? "",
  ].join("\u0000")
}

function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}
