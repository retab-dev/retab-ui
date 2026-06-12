"use client"

// Whole-file text viewer for source linking. It intentionally stays separate
// from FileViewer's streamed text path: every line is rendered so text anchors
// can highlight and scroll to any 1-based line range.
import * as React from "react"

import type {
  BlobViewerSource,
  TextSource,
  UrlViewerSource,
} from "@/lib/viewer-source"
import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  TextViewerErrorState,
  TextViewerFallback,
  TextViewerFrame,
  TextViewerToolbar,
} from "@/components/ui/text-viewer-chrome"
import { scrollLineRangeIntoView } from "@/components/ui/text-viewer-layout"
import {
  isLineInRange,
  normalizeTextLineRange,
  type TextLineRange,
} from "@/components/ui/text-viewer-ranges"
import {
  readTextResource,
  resolvedTextViewerBounds,
  TextViewerInvalidBoundsError,
  TextViewerTooLargeError,
  type TextViewerBounds,
} from "@/components/ui/text-viewer-resource"

const BASE_FONT_PX = 12
const BASE_LINE_PX = 20
const MIN_SCALE = 0.25
const MAX_SCALE = 5

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export type { TextLineRange }

export interface TextViewerHandle {
  scrollToLineRange: (range: TextLineRange, options?: ScrollToOptions) => void
  getViewportElement: () => HTMLDivElement | null
}

export type TextDocumentSource =
  | UrlViewerSource
  | BlobViewerSource
  | TextSource

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
    const resetToken = textViewerResetToken(resource, props, retryVersion)

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
      <TextViewerErrorBoundary
        bare={props.bare}
        className={props.className}
        resetToken={resetToken}
        resource={resource}
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
      </TextViewerErrorBoundary>
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
  const textLines = React.useMemo(() => text.split("\n"), [text])
  const highlightRange = normalizeTextLineRange(highlight, textLines.length)
  const download = React.useMemo(() => resource.getDownload(), [resource])

  const [fontScale, setFontScale] = React.useState(1)
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null)

  const zoom = (factor: number) =>
    setFontScale((scale) => clamp(scale * factor, MIN_SCALE, MAX_SCALE))

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      scrollToLineRange: (range, options) => {
        scrollLineRangeIntoView({
          viewportElement: viewportElementRef.current,
          range: normalizeTextLineRange(range, textLines.length),
          options,
        })
      },
      getViewportElement: () => viewportElementRef.current,
    }),
    [textLines.length]
  )

  const gutterWidth = `${String(textLines.length).length + 1}ch`

  return (
    <TextViewerFrame className={className} bare={bare}>
      {toolbar ? (
        <TextViewerToolbar
          lineCount={textLines.length}
          fontScale={fontScale}
          download={download}
          onZoomOut={() => zoom(1 / 1.2)}
          onZoomIn={() => zoom(1.2)}
          onResetZoom={() => setFontScale(1)}
        />
      ) : null}
      <ScrollArea className="min-h-0 flex-1" viewportRef={viewportElementRef}>
        <pre
          className="w-max min-w-full py-2 font-mono"
          style={{
            fontSize: `${BASE_FONT_PX * fontScale}px`,
            lineHeight: `${BASE_LINE_PX * fontScale}px`,
          }}
        >
          {textLines.map((textLine, index) => {
            const lineNumber = index + 1
            return (
              <TextLine
                key={lineNumber}
                gutterWidth={gutterWidth}
                isHighlighted={isLineInRange(lineNumber, highlightRange)}
                lineNumber={lineNumber}
                text={textLine}
              />
            )
          })}
        </pre>
      </ScrollArea>
    </TextViewerFrame>
  )
}

function TextLine({
  gutterWidth,
  isHighlighted,
  lineNumber,
  text,
}: {
  gutterWidth: string
  isHighlighted: boolean
  lineNumber: number
  text: string
}) {
  return (
    <div
      data-line-number={lineNumber}
      className={cn(
        "flex px-2",
        isHighlighted && "bg-primary/12 ring-1 ring-primary/30 ring-inset"
      )}
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

class TextViewerErrorBoundary extends React.Component<
  {
    children: React.ReactNode
    className?: string
    bare?: boolean
    resource: ViewerResource
    resetToken: TextViewerResetToken
    onRetry: () => void
  },
  { error: unknown | null }
> {
  state: Readonly<{ error: unknown | null }> = { error: null }

  componentDidUpdate(prev: { resetToken: TextViewerResetToken }) {
    if (
      textViewerResetTokenChanged(prev.resetToken, this.props.resetToken) &&
      this.state.error
    ) {
      this.setState({ error: null })
    }
  }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  render() {
    if (this.state.error) {
      const tooLargeReason =
        this.state.error instanceof TextViewerTooLargeError
          ? this.state.error.reason
          : null
      const isInvalidBounds =
        this.state.error instanceof TextViewerInvalidBoundsError
      const isRetryable = Boolean(
        this.props.resource.source.kind === "url" &&
          !tooLargeReason &&
          !isInvalidBounds
      )
      return (
        <TextViewerErrorState
          className={this.props.className}
          bare={this.props.bare}
          message={textViewerErrorMessage({ tooLargeReason, isInvalidBounds })}
          isRetryable={isRetryable}
          download={this.props.resource.getDownload()}
          onRetry={this.props.onRetry}
        />
      )
    }

    return this.props.children
  }
}

function textViewerErrorMessage({
  tooLargeReason,
  isInvalidBounds,
}: {
  tooLargeReason: "bytes" | "lines" | null
  isInvalidBounds: boolean
}) {
  if (tooLargeReason) {
    return `This text file is too large to preview (${tooLargeReason} limit).`
  }
  if (isInvalidBounds) {
    return "Text viewer bounds are invalid."
  }
  return "Could not load this text file."
}

type TextViewerResetToken = {
  identityKey: string
  retryVersion: number
  maxBytes: number | undefined
  maxLines: number | undefined
}

function textViewerResetToken(
  resource: ViewerResource,
  props: Pick<TextViewerProps, "maxBytes" | "maxLines">,
  retryVersion: number
): TextViewerResetToken {
  return {
    identityKey: resource.identityKey,
    retryVersion,
    maxBytes: props.maxBytes,
    maxLines: props.maxLines,
  }
}

function textViewerResetTokenChanged(
  previous: TextViewerResetToken,
  next: TextViewerResetToken
) {
  if (previous.identityKey !== next.identityKey) return true
  if (previous.retryVersion !== next.retryVersion) return true
  if (previous.maxBytes !== next.maxBytes) return true
  if (previous.maxLines !== next.maxLines) return true
  return false
}

function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}
