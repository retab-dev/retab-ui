"use client"

import * as React from "react"
import { Download, Maximize, Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

/** Base font metrics (Tailwind `text-xs`/`leading-5`) the zoom scales from. */
const BASE_FONT_PX = 12
const BASE_LINE_PX = 20
const MIN_SCALE = 0.5
const MAX_SCALE = 3

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n))

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

// --- resource cache: stable promises so React `use()` can read them -----------

const textCache = new Map<string, Promise<string>>()

function getTextResource(src: string): Promise<string> {
  let promise = textCache.get(src)
  if (!promise) {
    promise = fetch(src).then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${src}: ${res.status}`)
      return res.text()
    })
    textCache.set(src, promise)
  }
  return promise
}

/** Client gate without an effect — false during SSR, true after hydration. */
function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

// --- public API --------------------------------------------------------------

export interface TextViewerHandle {
  /** Scroll a 1-based inclusive line range into view. */
  scrollToLines: (
    lineStart: number,
    lineEnd: number,
    options?: ScrollToOptions
  ) => void
  getViewportElement: () => HTMLDivElement | null
}

export interface TextViewerProps {
  /** URL of the text file (same-origin or CORS-enabled). */
  src?: string
  /** Inline text, as an alternative to `src`. */
  value?: string
  className?: string
  toolbar?: boolean
  downloadFileName?: string
  /** 1-based inclusive line range to highlight, or null. */
  highlight?: { start: number; end: number } | null
  /** Drop the outer border/rounded/background so the viewer fills its container. */
  bare?: boolean
}

const LINE_SCROLL_HEADROOM = 64

export const TextViewer = React.forwardRef<TextViewerHandle, TextViewerProps>(
  function TextViewer(props, ref) {
    // Gate on the client so the fetch path only runs after hydration; inline
    // `value` renders immediately on both sides.
    const isClient = useIsClient()
    if (props.value === undefined && props.src && !isClient) {
      return (
        <TextViewerFallback className={props.className} bare={props.bare} />
      )
    }
    return (
      <React.Suspense
        fallback={
          <TextViewerFallback className={props.className} bare={props.bare} />
        }
      >
        <TextViewerInner {...props} forwardedRef={ref} />
      </React.Suspense>
    )
  }
)

function TextViewerInner({
  src,
  value,
  className,
  toolbar = true,
  downloadFileName,
  highlight,
  bare = false,
  forwardedRef,
}: TextViewerProps & {
  forwardedRef?: React.ForwardedRef<TextViewerHandle>
}) {
  const text =
    value !== undefined ? value : src ? React.use(getTextResource(src)) : ""
  const lines = React.useMemo(() => text.split("\n"), [text])

  const [fontScale, setFontScale] = React.useState(1)
  const zoom = (factor: number) =>
    setFontScale((s) => clamp(s * factor, MIN_SCALE, MAX_SCALE))

  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null)

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      scrollToLines: (lineStart, _lineEnd, options) => {
        const viewport = scrollViewportRef.current
        const row = viewport?.querySelector<HTMLElement>(
          `[data-line="${lineStart}"]`
        )
        if (!viewport || !row) return
        const rowRect = row.getBoundingClientRect()
        const viewportRect = viewport.getBoundingClientRect()
        const top =
          rowRect.top -
          viewportRect.top +
          viewport.scrollTop -
          LINE_SCROLL_HEADROOM
        viewport.scrollTo({
          top: Math.max(0, top),
          behavior: "smooth",
          ...options,
        })
      },
      getViewportElement: () => scrollViewportRef.current,
    }),
    []
  )

  const gutterWidth = `${String(lines.length).length + 1}ch`

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="text-viewer"
    >
      {toolbar ? (
        <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
          <span className="px-1 text-xs text-muted-foreground tabular-nums">
            {lines.length} line{lines.length === 1 ? "" : "s"}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <IconButton label="Zoom out" onClick={() => zoom(1 / 1.2)}>
              <Minus />
            </IconButton>
            <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
              {Math.round(fontScale * 100)}%
            </span>
            <IconButton label="Zoom in" onClick={() => zoom(1.2)}>
              <Plus />
            </IconButton>
            <IconButton label="Reset zoom" onClick={() => setFontScale(1)}>
              <Maximize />
            </IconButton>
            {src ? (
              <>
                <div className="mx-1 h-4 w-px bg-border" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  aria-label="Download"
                  title="Download"
                  render={
                    <a href={src} download={downloadFileName ?? true}>
                      <Download />
                    </a>
                  }
                />
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      <ScrollArea className="min-h-0 flex-1" viewportRef={scrollViewportRef}>
        <pre
          className="w-max min-w-full py-2 font-mono"
          style={{
            fontSize: `${BASE_FONT_PX * fontScale}px`,
            lineHeight: `${BASE_LINE_PX * fontScale}px`,
          }}
        >
          {lines.map((line, i) => {
            const n = i + 1
            const lit =
              highlight != null && n >= highlight.start && n <= highlight.end
            return (
              <div
                key={n}
                data-line={n}
                className={cn(
                  "flex px-2",
                  lit && "bg-primary/12 ring-1 ring-primary/30 ring-inset"
                )}
              >
                <span
                  className="flex-shrink-0 pr-3 text-right text-muted-foreground/60 select-none"
                  style={{ width: gutterWidth }}
                >
                  {n}
                </span>
                <span className="whitespace-pre">{line || " "}</span>
              </div>
            )
          })}
        </pre>
      </ScrollArea>
    </div>
  )
}

function TextViewerFallback({
  className,
  bare,
}: {
  className?: string
  bare?: boolean
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
      {/* Same toolbar chrome as the loaded viewer — with inert zoom controls — so
          nothing shifts when the real content fades in. */}
      <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
        <span className="px-1">
          <Skeleton className="inline-block h-3 w-16 align-middle" />
        </span>
        <div className="ml-auto flex items-center gap-1">
          <IconButton label="Zoom out" disabled tabIndex={-1} aria-hidden>
            <Minus />
          </IconButton>
          <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
            100%
          </span>
          <IconButton label="Zoom in" disabled tabIndex={-1} aria-hidden>
            <Plus />
          </IconButton>
          <IconButton label="Reset zoom" disabled tabIndex={-1} aria-hidden>
            <Maximize />
          </IconButton>
        </div>
      </div>
      <div className="space-y-2 p-4">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton
            key={i}
            className="h-4"
            style={{ width: `${40 + ((i * 13) % 55)}%` }}
          />
        ))}
      </div>
    </div>
  )
}
