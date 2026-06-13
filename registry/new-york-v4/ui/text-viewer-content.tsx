"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"

import { ScrollArea } from "./scroll-area"
import { TextViewerFrame, TextViewerToolbar } from "./text-viewer-chrome"
import {
  createPreparedTextDocument,
  layoutTextDocument,
  materializeCodeVisibleLines,
  materializeInlineVisibleLines,
  resolveTextViewerMode,
  textFrameIntersectsLineRange,
  type CodeTextBlockFrame,
  type InlineTextBlockFrame,
  type PreparedCodeTextBlock,
  type PreparedInlineTextBlock,
  type PreparedRuleTextBlock,
  type PreparedTextBlock,
  type RuleTextBlockFrame,
  type TextBlockFrame,
} from "./text-viewer-layout"
import { isLineInRange, normalizeTextLineRange } from "./text-viewer-ranges"
import {
  readTextResource,
  resolvedTextViewerBounds,
} from "./text-viewer-resource"
import {
  clampTextViewerScale,
  TEXT_VIEWER_BLOCK_PADDING,
} from "./text-viewer-scale"
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types"
import {
  getTextFrameScrollAnchor,
  getTextFrameVirtualItems,
  useTextVirtualViewport,
  type TextFrameScrollAnchor,
} from "./text-viewer-virtualization"

const TEXT_VIEWER_HORIZONTAL_PADDING = 16
const TEXT_VIEWER_INITIAL_TEXT_WIDTH = 768
const TEXT_VIEWER_OVERSCAN_PX = 320

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
  const mode = React.useMemo(
    () =>
      resolveTextViewerMode({
        fileName: resource.fileName,
        mimeType: resource.content.mimeType,
      }),
    [resource.content.mimeType, resource.fileName]
  )
  const downloadAction = React.useMemo(
    () => resource.originalDownload,
    [resource]
  )

  const [fontScale, setFontScale] = React.useState(1)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const pendingScrollAnchorRef = React.useRef<TextFrameScrollAnchor | null>(
    null
  )
  const viewport = useTextVirtualViewport(viewportRef)
  const viewportHeight = viewport.clientHeight || 600
  const viewportWidth = viewport.clientWidth || 800
  const [contentWidth, setContentWidth] = React.useState(
    TEXT_VIEWER_INITIAL_TEXT_WIDTH
  )

  const preparedDocument = React.useMemo(
    () =>
      createPreparedTextDocument({
        mode,
        style: { fontScale },
        text,
      }),
    [fontScale, mode, text]
  )
  const frame = React.useMemo(
    () =>
      layoutTextDocument({
        contentWidth,
        document: preparedDocument,
      }),
    [contentWidth, preparedDocument]
  )
  const highlightStart = highlight?.start
  const highlightEnd = highlight?.end
  const highlightRange = React.useMemo(
    () =>
      normalizeTextLineRange(
        highlightStart == null || highlightEnd == null
          ? null
          : { end: highlightEnd, start: highlightStart },
        preparedDocument.sourceLineCount
      ),
    [highlightEnd, highlightStart, preparedDocument.sourceLineCount]
  )
  const virtualItems = React.useMemo(
    () =>
      getTextFrameVirtualItems({
        frames: frame.frames,
        overscanPx: TEXT_VIEWER_OVERSCAN_PX,
        scrollTop: viewport.scrollTop,
        viewportHeight,
      }),
    [frame.frames, viewport.scrollTop, viewportHeight]
  )

  const captureScrollAnchor = React.useCallback(() => {
    pendingScrollAnchorRef.current = getTextFrameScrollAnchor({
      frames: frame.frames,
      scrollTop: viewportRef.current?.scrollTop ?? 0,
    })
  }, [frame.frames])

  React.useLayoutEffect(() => {
    const nextContentWidth = Math.max(
      1,
      viewportWidth - TEXT_VIEWER_HORIZONTAL_PADDING * 2
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
    const nextFrame = frame.frames[anchor.index]
    if (!nextFrame) return

    scrollElement.scrollTop = Math.max(
      0,
      nextFrame.top +
        Math.min(anchor.offsetWithinFrame, Math.max(0, nextFrame.height - 1))
    )
  }, [frame.frames])

  const scrollLineRange = React.useCallback(
    (
      range: ReturnType<typeof normalizeTextLineRange>,
      options?: ScrollToOptions
    ) => {
      const scrollElement = viewportRef.current
      if (!scrollElement || !range) return

      const targetFrame =
        frame.frames.find((item) =>
          textFrameIntersectsLineRange({ frame: item, range })
        ) ?? frame.frames[0]
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
    [frame.frames]
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
    forwardedRef,
    () => ({
      getViewportElement: () => viewportRef.current,
      scrollToLineRange: (range, options) => {
        scrollLineRange(
          normalizeTextLineRange(range, preparedDocument.sourceLineCount),
          options
        )
      },
    }),
    [preparedDocument.sourceLineCount, scrollLineRange]
  )

  React.useEffect(() => {
    scrollLineRange(highlightRange)
  }, [highlightRange, scrollLineRange])

  return (
    <TextViewerFrame className={className} bare={bare}>
      {toolbar ? (
        <TextViewerToolbar
          wordCount={preparedDocument.wordCount}
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
      >
        <div
          className="relative min-w-0"
          data-slot="text-virtual-canvas"
          style={{
            height: frame.totalHeight,
            minWidth: viewportWidth,
          }}
        >
          {virtualItems.map((item) => {
            const block = preparedDocument.blocks[item.index]
            const blockFrame = frame.frames[item.index]
            if (!block || !blockFrame) return null
            return (
              <TextBlock
                key={item.index}
                block={block}
                contentWidth={contentWidth}
                frame={blockFrame}
                highlightRange={highlightRange}
                viewportBottom={
                  viewport.scrollTop + viewportHeight + TEXT_VIEWER_OVERSCAN_PX
                }
                viewportTop={viewport.scrollTop - TEXT_VIEWER_OVERSCAN_PX}
              />
            )
          })}
        </div>
      </ScrollArea>
    </TextViewerFrame>
  )
}

function TextBlock({
  block,
  contentWidth,
  frame,
  highlightRange,
  viewportBottom,
  viewportTop,
}: {
  block: PreparedTextBlock
  contentWidth: number
  frame: TextBlockFrame
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  viewportBottom: number
  viewportTop: number
}) {
  if (block.kind !== frame.kind) return null

  const isHighlighted =
    frame.sourceStartLine === frame.sourceEndLine
      ? isLineInRange(frame.sourceStartLine, highlightRange)
      : textFrameIntersectsLineRange({ frame, range: highlightRange })

  switch (block.kind) {
    case "inline":
      return (
        <InlineTextBlock
          block={block}
          contentWidth={contentWidth}
          frame={frame as InlineTextBlockFrame}
          isHighlighted={isHighlighted}
          viewportBottom={viewportBottom}
          viewportTop={viewportTop}
        />
      )
    case "code":
      return (
        <CodeTextBlock
          block={block}
          frame={frame as CodeTextBlockFrame}
          isHighlighted={isHighlighted}
          viewportBottom={viewportBottom}
          viewportTop={viewportTop}
        />
      )
    case "rule":
      return (
        <RuleTextBlock
          block={block}
          frame={frame as RuleTextBlockFrame}
          isHighlighted={isHighlighted}
        />
      )
  }
}

function InlineTextBlock({
  block,
  contentWidth,
  frame,
  isHighlighted,
  viewportBottom,
  viewportTop,
}: {
  block: PreparedInlineTextBlock
  contentWidth: number
  frame: InlineTextBlockFrame
  isHighlighted: boolean
  viewportBottom: number
  viewportTop: number
}) {
  const lines = materializeInlineVisibleLines({
    block,
    frame,
    maxWidth: contentWidth,
    viewportBottom,
    viewportTop,
  })

  return (
    <div
      className={cn(
        "absolute left-0 w-full px-4",
        isHighlighted && "bg-primary/12 ring-1 ring-primary/30 ring-inset"
      )}
      data-slot="text-line"
      data-source-line={frame.sourceStartLine}
      style={{
        height: frame.height,
        transform: `translateY(${frame.top}px)`,
      }}
    >
      <BlockChrome frame={frame} />
      {lines.map((line, index) => (
        <div
          key={`${line.top}-${index}`}
          className="absolute flex w-max items-center gap-0"
          style={{
            height: frame.lineHeight,
            left: 16 + frame.contentLeft,
            top: line.top,
          }}
        >
          {line.fragments.map((fragment, fragmentIndex) => {
            const style =
              fragment.leadingGap > 0
                ? { marginLeft: fragment.leadingGap }
                : undefined
            if (fragment.href) {
              return (
                <a
                  key={fragmentIndex}
                  className={fragment.className}
                  href={fragment.href}
                  rel="noreferrer"
                  style={style}
                  target="_blank"
                >
                  {fragment.text}
                </a>
              )
            }
            return (
              <span
                key={fragmentIndex}
                className={fragment.className}
                style={style}
              >
                {fragment.text}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function CodeTextBlock({
  block,
  frame,
  isHighlighted,
  viewportBottom,
  viewportTop,
}: {
  block: PreparedCodeTextBlock
  frame: CodeTextBlockFrame
  isHighlighted: boolean
  viewportBottom: number
  viewportTop: number
}) {
  const lines = materializeCodeVisibleLines({
    block,
    frame,
    viewportBottom,
    viewportTop,
  })

  return (
    <div
      className={cn(
        "absolute left-0 w-full px-4",
        isHighlighted && "bg-primary/12 ring-1 ring-primary/30 ring-inset"
      )}
      data-slot="text-line"
      data-source-line={frame.sourceStartLine}
      style={{
        height: frame.height,
        transform: `translateY(${frame.top}px)`,
      }}
    >
      <BlockChrome frame={frame} />
      <pre
        className="absolute overflow-hidden rounded-md border bg-muted text-foreground"
        style={{
          height: frame.height,
          left: 16 + frame.contentLeft,
          width: frame.width,
        }}
      >
        <code>
          {lines.map(({ line, top }, index) => (
            <span
              key={`${top}-${index}`}
              className="absolute font-mono whitespace-pre"
              style={{
                fontSize: 13,
                left: 12,
                lineHeight: `${frame.lineHeight}px`,
                top,
              }}
            >
              {line.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

function RuleTextBlock({
  frame,
  isHighlighted,
}: {
  block: PreparedRuleTextBlock
  frame: RuleTextBlockFrame
  isHighlighted: boolean
}) {
  return (
    <div
      className={cn(
        "absolute left-0 w-full px-4",
        isHighlighted && "bg-primary/12 ring-1 ring-primary/30 ring-inset"
      )}
      data-slot="text-line"
      data-source-line={frame.sourceStartLine}
      style={{
        height: frame.height,
        transform: `translateY(${frame.top}px)`,
      }}
    >
      <BlockChrome frame={frame} />
      <div
        className="absolute h-px bg-border"
        style={{
          left: 16 + frame.contentLeft,
          top: Math.floor(frame.height / 2),
          width: frame.width,
        }}
      />
    </div>
  )
}

function BlockChrome({ frame }: { frame: TextBlockFrame }) {
  return (
    <>
      {frame.quoteRailLefts.map((left, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="absolute top-0 bottom-0 w-[3px] rounded-full bg-border"
          style={{ left: 16 + left }}
        />
      ))}
      {frame.markerText && frame.markerLeft != null ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute font-mono text-xs whitespace-pre",
            frame.markerClassName
          )}
          style={{
            left: 16 + frame.markerLeft,
            top:
              frame.kind === "inline"
                ? Math.max(0, Math.round((frame.lineHeight - 12) / 2))
                : 10,
          }}
        >
          {frame.markerText}
        </span>
      ) : null}
    </>
  )
}
