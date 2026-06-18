"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"

import { ScrollArea } from "./scroll-area"
import { TextViewerControls, TextViewerFrame } from "./text-viewer-chrome"
import {
  createPreparedTextDocument,
  getCodeVisibleLineWindow,
  getInlineVisibleLineWindow,
  getTableVisibleRowWindow,
  layoutTextDocument,
  materializeCodeVisibleLines,
  materializeInlineVisibleLines,
  resolveTextViewerMode,
  serializeMarkdownTableForClipboard,
  textFrameIntersectsLineRange,
  type CodeTextBlockFrame,
  type ImageTextBlockFrame,
  type InlineTextBlockFrame,
  type PreparedCodeTextBlock,
  type PreparedImageTextBlock,
  type PreparedInlineTextBlock,
  type PreparedRuleTextBlock,
  type PreparedTableTextBlock,
  type PreparedTextBlock,
  type PreparedTextDocument,
  type RuleTextBlockFrame,
  type TableRowWindow,
  type TableTextBlockFrame,
  type TextBlockFrame,
  type TextDocumentFrame,
  type TextLineWindow,
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
import {
  useViewerControlsRegistration,
  type ViewerControlsState,
} from "./viewer-controls"

const TEXT_VIEWER_HORIZONTAL_PADDING = 16
const TEXT_VIEWER_INITIAL_TEXT_WIDTH = 768
const TEXT_VIEWER_OVERSCAN_PX = 320
const TEXT_VIEWER_HIGHLIGHT_STYLE = {
  backgroundColor:
    "color-mix(in oklab, var(--foreground) 8%, var(--background))",
  boxShadow: "inset 2px 0 0 0 var(--primary)",
} satisfies React.CSSProperties

type TextViewerContentProps = Omit<TextViewerProps, "source"> & {
  resource: ViewerResource
  retryVersion: number
  forwardedRef?: React.ForwardedRef<TextViewerHandle>
}

export function TextViewerContent({
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
  mode: forcedMode,
}: TextViewerContentProps) {
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
      forcedMode ??
      resolveTextViewerMode({
        fileName: resource.fileName,
        mimeType: resource.content.mimeType,
      }),
    [forcedMode, resource.content.mimeType, resource.fileName]
  )
  const downloadAction = download ? resource.originalDownload : null

  const [fontScale, setFontScale] = React.useState(1)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const pendingScrollAnchorRef = React.useRef<TextFrameScrollAnchor | null>(
    null
  )
  const viewport = useTextVirtualViewport(viewportRef)
  const viewportHeight = viewport.clientHeight || 600
  const viewportWidth = viewport.clientWidth || 800
  const fontEpoch = useTextViewerFontEpoch()
  const [contentWidth, setContentWidth] = React.useState(
    TEXT_VIEWER_INITIAL_TEXT_WIDTH
  )

  const preparedDocument = React.useMemo(
    () =>
      createPreparedTextDocument({
        mode,
        style: { fontScale: 1 },
        text,
      }),
    [fontEpoch, mode, text]
  )
  const frame = React.useMemo(
    () =>
      layoutTextDocument({
        contentWidth,
        document: preparedDocument,
        fontScale,
      }),
    [contentWidth, fontScale, preparedDocument]
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
  const zoomOut = React.useCallback(() => zoom(1 / 1.2), [zoom])
  const zoomIn = React.useCallback(() => zoom(1.2), [zoom])
  useTextControlsRegistration({
    downloadAction,
    fontScale,
    onResetZoom: resetZoom,
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    wordCount: preparedDocument.wordCount,
  })

  React.useImperativeHandle(
    forwardedRef ?? null,
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

  const scrollMarkdownFragment = React.useCallback(
    (event: React.MouseEvent) => {
      const href = localFragmentHrefFromEventTarget(event.target)
      if (!href) return

      const targetId = decodeMarkdownFragmentHref(href)
      const targetIndex = markdownHeadingBlockIndex(
        preparedDocument.blocks,
        targetId
      )
      const targetFrame = frame.frames[targetIndex]
      const scrollElement = viewportRef.current
      if (!targetFrame || !scrollElement) return

      event.preventDefault()
      scrollElement.scrollTo({
        behavior: "smooth",
        top: Math.max(0, targetFrame.top),
      })
      if (window.location.hash !== href) {
        window.history.replaceState(null, "", href)
      }
    },
    [frame.frames, preparedDocument.blocks]
  )

  return (
    <TextViewerFrame className={className} bare={bare}>
      {controls ? (
        <TextViewerControls
          wordCount={preparedDocument.wordCount}
          fontScale={fontScale}
          downloadAction={downloadAction}
          onZoomOut={zoomOut}
          onZoomIn={zoomIn}
          onResetZoom={resetZoom}
        />
      ) : null}
      <ScrollArea
        className="min-h-0 flex-1 bg-background"
        orientation="vertical"
        viewportClassName="bg-background"
        viewportProps={{ onClickCapture: scrollMarkdownFragment }}
        viewportRef={viewportRef}
      >
        <TextVirtualCanvas
          contentWidth={contentWidth}
          document={preparedDocument}
          frame={frame}
          highlightRange={highlightRange}
          scrollTop={viewport.scrollTop}
          viewportHeight={viewportHeight}
          viewportWidth={viewportWidth}
        />
      </ScrollArea>
    </TextViewerFrame>
  )
}

function useTextControlsRegistration({
  downloadAction,
  fontScale,
  onResetZoom,
  onZoomIn,
  onZoomOut,
  wordCount,
}: {
  downloadAction: ViewerResource["originalDownload"] | null
  fontScale: number
  onResetZoom: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  wordCount: number
}) {
  const onControlsChange = useViewerControlsRegistration()
  const controlsState = React.useMemo<ViewerControlsState>(
    () => ({
      title: `${wordCount} word${wordCount === 1 ? "" : "s"}`,
      zoom: {
        scale: fontScale,
        onZoomOut,
        onZoomIn,
        onFit: onResetZoom,
        fitLabel: "Reset zoom",
      },
      downloads: downloadAction ? [downloadAction] : [],
    }),
    [downloadAction, fontScale, onResetZoom, onZoomIn, onZoomOut, wordCount]
  )

  React.useEffect(() => {
    if (!onControlsChange) return
    onControlsChange(controlsState)
    return () => onControlsChange(null)
  }, [onControlsChange, controlsState])
}

type TextVirtualCanvasProps = {
  contentWidth: number
  document: PreparedTextDocument
  frame: TextDocumentFrame
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  scrollTop: number
  viewportHeight: number
  viewportWidth: number
}

const TextVirtualCanvas = React.memo(
  TextVirtualCanvasImpl,
  areTextVirtualCanvasPropsEqual
)

function TextVirtualCanvasImpl({
  contentWidth,
  document,
  frame,
  highlightRange,
  scrollTop,
  viewportHeight,
  viewportWidth,
}: TextVirtualCanvasProps) {
  const virtualItems = React.useMemo(
    () =>
      getTextFrameVirtualItems({
        frames: frame.frames,
        overscanPx: TEXT_VIEWER_OVERSCAN_PX,
        scrollTop,
        viewportHeight,
      }),
    [frame.frames, scrollTop, viewportHeight]
  )
  const viewportTop = scrollTop - TEXT_VIEWER_OVERSCAN_PX
  const viewportBottom = scrollTop + viewportHeight + TEXT_VIEWER_OVERSCAN_PX

  return (
    <div
      className="relative min-w-0"
      data-slot="text-virtual-canvas"
      style={{
        height: frame.totalHeight,
        minWidth: viewportWidth,
      }}
    >
      {virtualItems.map((item) => {
        const block = document.blocks[item.index]
        const blockFrame = frame.frames[item.index]
        if (!block || !blockFrame) return null
        return (
          <TextBlock
            key={item.index}
            block={block}
            contentWidth={contentWidth}
            frame={blockFrame}
            highlightRange={highlightRange}
            viewportBottom={viewportBottom}
            viewportTop={viewportTop}
          />
        )
      })}
    </div>
  )
}

function areTextVirtualCanvasPropsEqual(
  previous: TextVirtualCanvasProps,
  next: TextVirtualCanvasProps
) {
  return (
    previous.contentWidth === next.contentWidth &&
    previous.document === next.document &&
    previous.frame === next.frame &&
    previous.viewportHeight === next.viewportHeight &&
    previous.viewportWidth === next.viewportWidth &&
    isSameHighlightRange(previous.highlightRange, next.highlightRange) &&
    textProjectionWindowKey(
      previous.frame.frames,
      previous.scrollTop,
      previous.viewportHeight
    ) ===
      textProjectionWindowKey(
        next.frame.frames,
        next.scrollTop,
        next.viewportHeight
      )
  )
}

type TextBlockProps = {
  block: PreparedTextBlock
  contentWidth: number
  frame: TextBlockFrame
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  viewportBottom: number
  viewportTop: number
}

const TextBlock = React.memo(TextBlockImpl, areTextBlockPropsEqual)

function TextBlockImpl({
  block,
  contentWidth,
  frame,
  highlightRange,
  viewportBottom,
  viewportTop,
}: TextBlockProps) {
  if (block.kind !== frame.kind) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        `Text viewer block/frame mismatch: block=${block.kind}, frame=${frame.kind}`
      )
    }
    return null
  }

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
          contentWidth={contentWidth}
          frame={frame as CodeTextBlockFrame}
          isHighlighted={isHighlighted}
          viewportBottom={viewportBottom}
          viewportTop={viewportTop}
        />
      )
    case "image":
      return (
        <ImageTextBlock
          block={block}
          frame={frame as ImageTextBlockFrame}
          isHighlighted={isHighlighted}
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
    case "table":
      return (
        <TableTextBlock
          block={block}
          frame={frame as TableTextBlockFrame}
          isHighlighted={isHighlighted}
          viewportBottom={viewportBottom}
          viewportTop={viewportTop}
        />
      )
  }
}

function areTextBlockPropsEqual(
  previous: TextBlockProps,
  next: TextBlockProps
) {
  return (
    previous.block === next.block &&
    previous.frame === next.frame &&
    previous.contentWidth === next.contentWidth &&
    isSameHighlightRange(previous.highlightRange, next.highlightRange) &&
    textBlockVisibleWindowKey(
      previous.frame,
      previous.viewportTop,
      previous.viewportBottom
    ) ===
      textBlockVisibleWindowKey(
        next.frame,
        next.viewportTop,
        next.viewportBottom
      )
  )
}

function isSameHighlightRange(
  a: ReturnType<typeof normalizeTextLineRange>,
  b: ReturnType<typeof normalizeTextLineRange>
) {
  return (
    a === b ||
    (a != null && b != null && a.start === b.start && a.end === b.end)
  )
}

function textProjectionWindowKey(
  frames: readonly TextBlockFrame[],
  scrollTop: number,
  viewportHeight: number
) {
  const viewportTop = scrollTop - TEXT_VIEWER_OVERSCAN_PX
  const viewportBottom = scrollTop + viewportHeight + TEXT_VIEWER_OVERSCAN_PX
  return getTextFrameVirtualItems({
    frames,
    overscanPx: TEXT_VIEWER_OVERSCAN_PX,
    scrollTop,
    viewportHeight,
  })
    .map((item) => {
      const frame = frames[item.index]
      if (!frame) return `${item.index}:missing`
      return `${item.index}:${textBlockVisibleWindowKey(
        frame,
        viewportTop,
        viewportBottom
      )}`
    })
    .join("|")
}

function textBlockVisibleWindowKey(
  frame: TextBlockFrame,
  viewportTop: number,
  viewportBottom: number
) {
  switch (frame.kind) {
    case "inline":
      return lineWindowKey(
        getInlineVisibleLineWindow({
          frame,
          viewportBottom,
          viewportTop,
        })
      )
    case "code":
      return lineWindowKey(
        getCodeVisibleLineWindow({
          frame,
          viewportBottom,
          viewportTop,
        })
      )
    case "table":
      return tableRowWindowKey(
        getTableVisibleRowWindow({
          frame,
          viewportBottom,
          viewportTop,
        })
      )
    case "image":
    case "rule":
      return "static"
  }
}

function lineWindowKey(window: TextLineWindow | null) {
  return window ? `${window.firstLine}:${window.lastLine}` : "none"
}

function tableRowWindowKey(window: TableRowWindow) {
  return `${window.startIndex}:${window.endIndex}`
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
  const headingLevel = inlineHeadingLevel(block)
  const role =
    headingLevel == null && frame.markerText
      ? "listitem"
      : headingLevel == null
        ? undefined
        : "heading"
  const ariaLevel =
    headingLevel ?? (frame.markerText ? frame.listDepth : undefined)

  return (
    <div
      className="absolute left-0 w-full px-4"
      data-slot="text-line"
      data-text-highlighted={isHighlighted ? "" : undefined}
      data-source-line={frame.sourceStartLine}
      data-list-depth={frame.listDepth || undefined}
      data-quote-depth={frame.quoteDepth || undefined}
      role={role}
      aria-level={ariaLevel}
      id={block.headingId ?? undefined}
      data-heading-id={block.headingId ?? undefined}
      style={{
        height: frame.height,
        transform: `translateY(${frame.top}px)`,
        ...(isHighlighted ? TEXT_VIEWER_HIGHLIGHT_STYLE : null),
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
            transform: `scale(${frame.scale})`,
            transformOrigin: "left top",
          }}
        >
          {line.fragments.map((fragment, fragmentIndex) => {
            const style =
              fragment.leadingGap > 0
                ? {
                    font: fragment.font,
                    letterSpacing: 0,
                    marginLeft: fragment.leadingGap,
                  }
                : { font: fragment.font, letterSpacing: 0 }
            if (fragment.href) {
              const isFragment = isLocalFragmentHref(fragment.href)
              return (
                <a
                  key={fragmentIndex}
                  className={fragment.className}
                  href={fragment.href}
                  rel={isFragment ? undefined : "noopener noreferrer"}
                  style={style}
                  target={isFragment ? undefined : "_blank"}
                  title={fragment.title ?? undefined}
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

function inlineHeadingLevel(block: PreparedInlineTextBlock) {
  if (block.variant === "heading-1") return 1
  if (block.variant === "heading-2") return 2
  return undefined
}

function CodeTextBlock({
  block,
  contentWidth,
  frame,
  isHighlighted,
  viewportBottom,
  viewportTop,
}: {
  block: PreparedCodeTextBlock
  contentWidth: number
  frame: CodeTextBlockFrame
  isHighlighted: boolean
  viewportBottom: number
  viewportTop: number
}) {
  const lines = materializeCodeVisibleLines({
    block,
    contentWidth,
    frame,
    viewportBottom,
    viewportTop,
  })

  return (
    <div
      className="absolute left-0 w-full px-4"
      data-slot="text-line"
      data-text-highlighted={isHighlighted ? "" : undefined}
      data-source-line={frame.sourceStartLine}
      data-list-depth={frame.listDepth || undefined}
      data-quote-depth={frame.quoteDepth || undefined}
      role={frame.markerText ? "listitem" : undefined}
      aria-level={frame.markerText ? frame.listDepth : undefined}
      style={{
        height: frame.height,
        transform: `translateY(${frame.top}px)`,
        ...(isHighlighted ? TEXT_VIEWER_HIGHLIGHT_STYLE : null),
      }}
    >
      <BlockChrome frame={frame} />
      <CodeBlockToolbar block={block} frame={frame} />
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
                font: block.font,
                left: 12,
                lineHeight: `${frame.lineHeight}px`,
                top,
                transform: `scale(${frame.scale})`,
                transformOrigin: "left top",
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

function CodeBlockToolbar({
  block,
  frame,
}: {
  block: PreparedCodeTextBlock
  frame: CodeTextBlockFrame
}) {
  return (
    <div
      className="absolute z-10 flex items-center gap-1"
      style={{
        left: 16 + frame.contentLeft + Math.max(0, frame.width - 66),
        top: 6,
      }}
    >
      {block.language ? (
        <span className="rounded bg-background/90 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground shadow-sm">
          {block.language}
        </span>
      ) : null}
      <CopyTextButton label="Copy code block" text={block.fallbackText} />
    </div>
  )
}

function CopyTextButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = React.useState(false)

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      className="rounded bg-background/90 p-1 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1200)
        })
      }}
    >
      {copied ? (
        <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="size-3" />
      )}
    </button>
  )
}

function ImageTextBlock({
  block,
  frame,
  isHighlighted,
}: {
  block: PreparedImageTextBlock
  frame: ImageTextBlockFrame
  isHighlighted: boolean
}) {
  const [imageState, setImageState] = React.useState<
    "idle" | "loaded" | "failed"
  >(block.src ? "idle" : "failed")

  React.useEffect(() => {
    setImageState(block.src ? "idle" : "failed")
  }, [block.src])

  const showImage = Boolean(block.src) && imageState !== "failed"

  return (
    <figure
      className="absolute left-0 w-full px-4"
      data-slot="text-line"
      data-text-highlighted={isHighlighted ? "" : undefined}
      data-source-line={frame.sourceStartLine}
      data-list-depth={frame.listDepth || undefined}
      data-quote-depth={frame.quoteDepth || undefined}
      role={frame.markerText ? "listitem" : undefined}
      aria-level={frame.markerText ? frame.listDepth : undefined}
      style={{
        height: frame.height,
        transform: `translateY(${frame.top}px)`,
        ...(isHighlighted ? TEXT_VIEWER_HIGHLIGHT_STYLE : null),
      }}
    >
      <BlockChrome frame={frame} />
      {showImage ? (
        <>
          <img
            alt={block.alt}
            className="absolute rounded-md border bg-muted object-contain"
            data-image-state={imageState}
            onError={() => setImageState("failed")}
            onLoad={() => setImageState("loaded")}
            src={block.src ?? undefined}
            title={block.title ?? undefined}
            style={{
              height: frame.imageHeight,
              left: 16 + frame.contentLeft,
              maxWidth: "calc(100% - 32px)",
              width: frame.imageWidth,
            }}
          />
          {imageState === "idle" ? (
            <div
              aria-hidden="true"
              className="absolute rounded-md border bg-muted/70"
              data-image-state="loading"
              style={{
                height: frame.imageHeight,
                left: 16 + frame.contentLeft,
                width: frame.imageWidth,
              }}
            />
          ) : null}
        </>
      ) : (
        <div
          className="absolute flex items-center rounded-md border bg-muted px-4 text-sm text-muted-foreground"
          role="img"
          aria-label={block.alt}
          data-image-state="failed"
          style={{
            height: frame.imageHeight,
            left: 16 + frame.contentLeft,
            width: frame.imageWidth,
          }}
        >
          {block.alt}
        </div>
      )}
    </figure>
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
      className="absolute left-0 w-full px-4"
      data-slot="text-line"
      data-text-highlighted={isHighlighted ? "" : undefined}
      data-source-line={frame.sourceStartLine}
      data-list-depth={frame.listDepth || undefined}
      data-quote-depth={frame.quoteDepth || undefined}
      role={frame.markerText ? "listitem" : undefined}
      aria-level={frame.markerText ? frame.listDepth : undefined}
      style={{
        height: frame.height,
        transform: `translateY(${frame.top}px)`,
        ...(isHighlighted ? TEXT_VIEWER_HIGHLIGHT_STYLE : null),
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

function TableTextBlock({
  block,
  frame,
  isHighlighted,
  viewportBottom,
  viewportTop,
}: {
  block: PreparedTableTextBlock
  frame: TableTextBlockFrame
  isHighlighted: boolean
  viewportBottom: number
  viewportTop: number
}) {
  const rowWindow = getTableVisibleRowWindow({
    frame,
    viewportBottom,
    viewportTop,
  })
  const visibleRows = block.rows.slice(rowWindow.startIndex, rowWindow.endIndex)
  const headerIdPrefix = `markdown-table-${frame.sourceStartLine}-${frame.sourceEndLine}`

  return (
    <div
      className="absolute left-0 w-full px-4"
      data-slot="text-line"
      data-text-highlighted={isHighlighted ? "" : undefined}
      data-source-line={frame.sourceStartLine}
      data-list-depth={frame.listDepth || undefined}
      data-quote-depth={frame.quoteDepth || undefined}
      role={frame.markerText ? "listitem" : undefined}
      aria-level={frame.markerText ? frame.listDepth : undefined}
      style={{
        height: frame.height,
        transform: `translateY(${frame.top}px)`,
        ...(isHighlighted ? TEXT_VIEWER_HIGHLIGHT_STYLE : null),
      }}
    >
      <BlockChrome frame={frame} />
      <div
        className="absolute max-w-[calc(100%-32px)] overflow-hidden rounded-md border"
        style={{
          height: frame.height,
          left: 16 + frame.contentLeft,
          width: frame.tableWidth,
        }}
      >
        <div className="absolute top-1 right-1 z-10">
          <CopyTextButton
            label="Copy table"
            text={serializeMarkdownTableForClipboard(block)}
          />
        </div>
        <div className="h-full overflow-x-auto">
          <table
            className="border-collapse text-left text-[13px]"
            style={{ width: frame.tableWidth }}
          >
            <colgroup>
              {frame.columnWidths.map((width, index) => (
                <col key={index} style={{ width }} />
              ))}
            </colgroup>
            <thead className="bg-muted">
              <tr style={{ height: frame.headerHeight }}>
                {block.header.map((cell, index) => (
                  <th
                    key={index}
                    className="border-b px-3.5 py-2 font-semibold text-foreground"
                    id={`${headerIdPrefix}-column-${index}`}
                    scope="col"
                    style={{ textAlign: block.alignments[index] ?? "left" }}
                  >
                    <TableCellContent cell={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowWindow.beforeHeight > 0 ? (
                <tr
                  aria-hidden="true"
                  style={{ height: rowWindow.beforeHeight }}
                >
                  <td colSpan={block.header.length || 1} />
                </tr>
              ) : null}
              {visibleRows.map((row, rowIndex) => (
                <tr
                  key={rowWindow.startIndex + rowIndex}
                  data-source-line={
                    frame.rowSourceStartLines[rowWindow.startIndex + rowIndex]
                  }
                  style={{
                    height:
                      frame.rowHeights[rowWindow.startIndex + rowIndex] ?? 0,
                  }}
                >
                  {block.header.map((_, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="border-t px-3.5 py-1.5 align-top text-foreground"
                      headers={`${headerIdPrefix}-column-${cellIndex}`}
                      style={{
                        textAlign: block.alignments[cellIndex] ?? "left",
                      }}
                    >
                      <TableCellContent cell={row[cellIndex]} />
                    </td>
                  ))}
                </tr>
              ))}
              {rowWindow.afterHeight > 0 ? (
                <tr
                  aria-hidden="true"
                  style={{ height: rowWindow.afterHeight }}
                >
                  <td colSpan={block.header.length || 1} />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function TableCellContent({
  cell,
}: {
  cell: PreparedTableTextBlock["header"][number] | undefined
}) {
  if (!cell) return null
  if (cell.href) {
    const isFragment = isLocalFragmentHref(cell.href)
    return (
      <a
        className={cn("wrap-break-word", cell.className)}
        href={cell.href}
        rel={isFragment ? undefined : "noopener noreferrer"}
        target={isFragment ? undefined : "_blank"}
        title={cell.title ?? undefined}
      >
        {cell.text}
      </a>
    )
  }
  return (
    <span className={cn("wrap-break-word", cell.className)}>{cell.text}</span>
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

function markdownHeadingBlockIndex(
  blocks: readonly PreparedTextBlock[],
  headingId: string
) {
  return blocks.findIndex((block) => {
    return block.kind === "inline" && block.headingId === headingId
  })
}

function isLocalFragmentHref(href: string) {
  return href.startsWith("#")
}
