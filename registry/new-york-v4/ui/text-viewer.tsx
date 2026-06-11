"use client"

// Whole-file text viewer for source linking. It intentionally stays separate
// from FileViewer's streamed text path: every line is rendered so text anchors
// can highlight and scroll to any 1-based line range.
import * as React from "react"
import { Download, Maximize, Minus, Plus, RotateCcw } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { scrollLineRangeIntoView } from "@/components/ui/text-viewer-layout"
import {
  isLineInRange,
  normalizeTextLineRange,
  type TextLineRange,
} from "@/components/ui/text-viewer-ranges"
import {
  assertTextWithinBounds,
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

export interface TextViewerProps extends TextViewerBounds {
  /** URL of the text file (same-origin or CORS-enabled). */
  src?: string
  /** Inline text, as an alternative to `src`. */
  value?: string
  className?: string
  toolbar?: boolean
  downloadName?: string
  /** 1-based inclusive line range to highlight, or null. */
  highlight?: TextLineRange | null
  /** Drop the outer border/rounded/background so the viewer fills its container. */
  bare?: boolean
}

export const TextViewer = React.forwardRef<TextViewerHandle, TextViewerProps>(
  function TextViewer(props, ref) {
    const [retryVersion, setRetryVersion] = React.useState(0)
    const isClient = useIsClient()
    const resetToken = textViewerResetToken(props, retryVersion)

    if (props.value === undefined && props.src && !isClient) {
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
        downloadName={props.downloadName}
        resetToken={resetToken}
        src={props.src}
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
          />
        </React.Suspense>
      </TextViewerErrorBoundary>
    )
  }
)

function TextViewerInner({
  src,
  value,
  className,
  toolbar = true,
  downloadName,
  highlight,
  bare = false,
  maxBytes,
  maxLines,
  retryVersion,
  forwardedRef,
}: TextViewerProps & {
  retryVersion: number
  forwardedRef?: React.ForwardedRef<TextViewerHandle>
}) {
  const bounds = resolvedTextViewerBounds({ maxBytes, maxLines })
  const text =
    value !== undefined
      ? readInlineText(value, bounds)
      : src
        ? readTextResource({ src, retryVersion, bounds })
        : ""
  const textLines = React.useMemo(() => text.split("\n"), [text])
  const highlightRange = normalizeTextLineRange(highlight, textLines.length)

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
          src={src}
          downloadName={downloadName}
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

function TextViewerToolbar({
  lineCount,
  fontScale,
  src,
  downloadName,
  onZoomOut,
  onZoomIn,
  onResetZoom,
}: {
  lineCount: number
  fontScale: number
  src?: string
  downloadName?: string
  onZoomOut: () => void
  onZoomIn: () => void
  onResetZoom: () => void
}) {
  return (
    <TextViewerToolbarFrame
      leading={`${lineCount} line${lineCount === 1 ? "" : "s"}`}
      trailing={
        <>
          <TextViewerZoomControls
            fontScale={fontScale}
            onZoomOut={onZoomOut}
            onZoomIn={onZoomIn}
            onResetZoom={onResetZoom}
          />
          {src ? (
            <>
              <div className="mx-1 h-4 w-px bg-border" />
              <DownloadButton src={src} downloadName={downloadName} />
            </>
          ) : null}
        </>
      }
    />
  )
}

function TextViewerFallback({
  className,
  toolbar = true,
  bare,
}: {
  className?: string
  toolbar?: boolean
  bare?: boolean
}) {
  return (
    <TextViewerFrame className={className} bare={bare}>
      {toolbar ? (
        <TextViewerToolbarFrame
          leading={<Skeleton className="inline-block h-3 w-16 align-middle" />}
          trailing={<TextViewerZoomControls disabled fontScale={1} />}
        />
      ) : null}
      <div className="space-y-2 p-4">
        {Array.from({ length: 12 }, (_, index) => (
          <Skeleton
            key={index}
            className="h-4"
            style={{ width: `${40 + ((index * 13) % 55)}%` }}
          />
        ))}
      </div>
    </TextViewerFrame>
  )
}

class TextViewerErrorBoundary extends React.Component<
  {
    children: React.ReactNode
    className?: string
    bare?: boolean
    src?: string
    downloadName?: string
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
        this.props.src && !tooLargeReason && !isInvalidBounds
      )
      return (
        <TextViewerFrame
          className={this.props.className}
          bare={this.props.bare}
        >
          <div className="flex min-h-64 flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
            <p>{textViewerErrorMessage({ tooLargeReason, isInvalidBounds })}</p>
            <div className="flex items-center gap-2">
              {isRetryable ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.props.onRetry}
                >
                  <RotateCcw className="mr-1.5 size-4" />
                  Retry
                </Button>
              ) : null}
              {this.props.src ? (
                <Button
                  variant={tooLargeReason ? "outline" : "ghost"}
                  size="sm"
                  render={
                    <a
                      href={this.props.src}
                      download={this.props.downloadName}
                    />
                  }
                >
                  <Download className="mr-1.5 size-4" />
                  Download
                </Button>
              ) : null}
            </div>
          </div>
        </TextViewerFrame>
      )
    }

    return this.props.children
  }
}

function TextViewerToolbarFrame({
  leading,
  trailing,
}: {
  leading: React.ReactNode
  trailing: React.ReactNode
}) {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      <span className="px-1 text-xs text-muted-foreground tabular-nums">
        {leading}
      </span>
      <div className="ml-auto flex items-center gap-1">{trailing}</div>
    </div>
  )
}

function TextViewerZoomControls({
  fontScale,
  disabled = false,
  onZoomOut,
  onZoomIn,
  onResetZoom,
}: {
  fontScale: number
  disabled?: boolean
  onZoomOut?: () => void
  onZoomIn?: () => void
  onResetZoom?: () => void
}) {
  const disabledProps = disabled
    ? ({ disabled: true, tabIndex: -1, "aria-hidden": true } as const)
    : {}

  return (
    <>
      <IconButton
        label="Zoom out"
        onClick={disabled ? undefined : onZoomOut}
        {...disabledProps}
      >
        <Minus />
      </IconButton>
      <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
        {Math.round(fontScale * 100)}%
      </span>
      <IconButton
        label="Zoom in"
        onClick={disabled ? undefined : onZoomIn}
        {...disabledProps}
      >
        <Plus />
      </IconButton>
      <IconButton
        label="Reset zoom"
        onClick={disabled ? undefined : onResetZoom}
        {...disabledProps}
      >
        <Maximize />
      </IconButton>
    </>
  )
}

function TextViewerFrame({
  className,
  bare,
  children,
}: {
  className?: string
  bare?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="text-viewer"
    >
      {children}
    </div>
  )
}

function DownloadButton({
  src,
  downloadName,
}: {
  src: string
  downloadName?: string
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-7"
      aria-label="Download"
      title="Download"
      render={<a href={src} download={downloadName} />}
    >
      <Download />
    </Button>
  )
}

function IconButton({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-7"
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </Button>
  )
}

function readInlineText(
  value: string,
  bounds: ReturnType<typeof resolvedTextViewerBounds>
) {
  assertTextWithinBounds(value, bounds)
  return value
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

type TextViewerResetToken =
  | {
      kind: "value"
      value: string
      maxBytes: number | undefined
      maxLines: number | undefined
    }
  | {
      kind: "src"
      src: string | undefined
      retryVersion: number
      maxBytes: number | undefined
      maxLines: number | undefined
    }

function textViewerResetToken(
  props: Pick<TextViewerProps, "src" | "value" | "maxBytes" | "maxLines">,
  retryVersion: number
): TextViewerResetToken {
  if (props.value !== undefined) {
    return {
      kind: "value",
      value: props.value,
      maxBytes: props.maxBytes,
      maxLines: props.maxLines,
    }
  }
  return {
    kind: "src",
    src: props.src,
    retryVersion,
    maxBytes: props.maxBytes,
    maxLines: props.maxLines,
  }
}

function textViewerResetTokenChanged(
  previous: TextViewerResetToken,
  next: TextViewerResetToken
) {
  if (previous.kind !== next.kind) return true
  if (previous.maxBytes !== next.maxBytes) return true
  if (previous.maxLines !== next.maxLines) return true
  if (previous.kind === "value" && next.kind === "value") {
    return previous.value !== next.value
  }
  if (previous.kind === "src" && next.kind === "src") {
    return (
      previous.src !== next.src || previous.retryVersion !== next.retryVersion
    )
  }
  return true
}

function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}
