"use client"

import * as React from "react"
import { Download, Maximize, Minus, Plus } from "lucide-react"
// Type-only import — erased at compile time, so docx-preview never loads on the
// server (it touches the DOM at call time).
import type * as DocxPreview from "docx-preview"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

// docx-preview is browser-only, so it is imported lazily on the client. jszip
// (its single dependency) is resolved by the bundler from the installed package.
let docxPromise: Promise<typeof DocxPreview> | null = null
function loadDocxPreview() {
  if (!docxPromise) {
    docxPromise = import("docx-preview")
  }
  return docxPromise
}

// We render faithful, paginated pages and override docx-preview's built-in
// chrome (gray backdrop, drop shadow) so pages match the rest of the viewers.
const RENDER_OPTIONS: Partial<DocxPreview.Options> = {
  inWrapper: true,
  breakPages: true,
  ignoreLastRenderedPageBreak: false,
  experimental: true,
  renderHeaders: true,
  renderFooters: true,
  renderFootnotes: true,
}

// Scoped overrides for docx-preview's default wrapper/section styling.
const SCOPED_STYLES = `
[data-slot="docx-viewer"] .docx-wrapper {
  background: transparent;
  padding: 0;
  gap: 1rem;
}
[data-slot="docx-viewer"] .docx-wrapper > section.docx {
  margin-bottom: 0;
  box-shadow: 0 0 0 1px var(--border), 0 1px 2px 0 rgb(0 0 0 / 0.05);
}`

// --- resource cache: stable promises so React `use()` can read them -----------

// Cache an ArrayBuffer, not a Blob. docx-preview forwards its input straight to
// JSZip; a Blob makes JSZip convert it via `new FileReader().readAsArrayBuffer`,
// which is flaky under dev/HMR (a transient FileReader without that method throws
// intermittently). An ArrayBuffer skips that path entirely — JSZip reads it
// directly — so the render is deterministic.
const bufferCache = new Map<string, Promise<ArrayBuffer>>()

function getDocxResource(src: string): Promise<ArrayBuffer> {
  let promise = bufferCache.get(src)
  if (!promise) {
    promise = fetch(src).then((res) => {
      if (!res.ok) throw new Error(`Failed to load DOCX: ${res.status}`)
      return res.arrayBuffer()
    })
    bufferCache.set(src, promise)
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

export interface DocxViewerProps {
  /** URL of the .docx (same-origin or CORS-enabled). */
  src: string
  className?: string
  /** Fixed zoom; when omitted the viewer fits page width to the container. */
  scale?: number
  toolbar?: boolean
  downloadFileName?: string
  /** Fired with the 1-based page nearest the top of the viewport as you scroll. */
  onVisiblePageChange?: (page: number) => void
  /** Fired with scroll progress in [0, 1] (for a fine-grained scroll cursor). */
  onScrollProgressChange?: (progress: number) => void
  /** Drop the outer border/rounded/background so the viewer fills its container. */
  bare?: boolean
  /** Rendered as a full-width strip directly below the toolbar (e.g. a legend). */
  header?: React.ReactNode
  /** Rendered as a left rail alongside the scrolling pages (e.g. a page ribbon). */
  aside?: React.ReactNode
}

export function DocxViewer(props: DocxViewerProps) {
  const isClient = useIsClient()
  if (!isClient) {
    return <DocxViewerFallback className={props.className} bare={props.bare} />
  }
  return (
    <DocxErrorBoundary className={props.className} resetKey={props.src}>
      <React.Suspense
        fallback={<DocxViewerFallback className={props.className} bare={props.bare} />}
      >
        <DocxViewerInner {...props} />
      </React.Suspense>
    </DocxErrorBoundary>
  )
}

function DocxViewerInner({
  src,
  className,
  scale: fixedScale,
  toolbar = true,
  downloadFileName,
  onVisiblePageChange,
  onScrollProgressChange,
  bare = false,
  header,
  aside,
}: DocxViewerProps) {
  const buffer = React.use(getDocxResource(src))

  const [manualScale, setManualScale] = React.useState<number | null>(
    fixedScale ?? null
  )
  const [containerWidth, setContainerWidth] = React.useState<number | null>(null)
  // Known only after docx-preview lays the document out.
  const [numPages, setNumPages] = React.useState(0)
  const [pageWidth, setPageWidth] = React.useState<number | null>(null)
  const [ready, setReady] = React.useState(false)
  const [renderError, setRenderError] = React.useState<Error | null>(null)
  if (renderError) throw renderError

  // Measure the container with a ResizeObserver attached in the ref callback.
  // Coalesce to one update per frame so dragging a resize handle doesn't trigger
  // a fit-width recompute per pixel.
  const containerRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    setContainerWidth(el.clientWidth)
    let frame = 0
    let latest = el.clientWidth
    const observer = new ResizeObserver((entries) => {
      // Use clientWidth (content + padding), matching the init read above, so
      // the `- 32` in fitScale subtracts the p-4 padding exactly once. Using
      // entry.contentRect.width here (which already excludes padding) would
      // double-subtract it, shrinking the page 32px below the full content
      // width — and below the w-full skeleton that stands in for it.
      for (const entry of entries) latest = (entry.target as HTMLElement).clientWidth
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setContainerWidth(latest)
      })
    })
    observer.observe(el)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  // Report the page nearest the top of the scroll viewport as the user scrolls.
  // We watch the actual scroll container (not the browser viewport) so the
  // current-page cursor stays in sync even when the viewer is embedded.
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null)
  const lastReported = React.useRef(0)
  // Coalesce scroll work to one frame: the layout reads below (getBoundingClientRect
  // over every page) shouldn't run on every scroll event.
  const scrollFrame = React.useRef(0)
  const measureScroll = React.useCallback(() => {
    scrollFrame.current = 0
    const viewport = scrollViewportRef.current
    if (!viewport) return
    const scrollable = viewport.scrollHeight - viewport.clientHeight
    onScrollProgressChange?.(scrollable > 0 ? viewport.scrollTop / scrollable : 0)
    const rect = viewport.getBoundingClientRect()
    const marker = rect.top + rect.height * 0.2
    const pages = viewport.querySelectorAll<HTMLElement>("[data-page-number]")
    let current = 1
    for (const el of pages) {
      if (el.getBoundingClientRect().top <= marker) {
        current = Number(el.dataset.pageNumber)
      } else {
        break
      }
    }
    if (current && current !== lastReported.current) {
      lastReported.current = current
      onVisiblePageChange?.(current)
    }
  }, [onVisiblePageChange, onScrollProgressChange])
  const handleScroll = React.useCallback(() => {
    if (scrollFrame.current) return
    scrollFrame.current = requestAnimationFrame(measureScroll)
  }, [measureScroll])
  React.useEffect(
    () => () => {
      if (scrollFrame.current) cancelAnimationFrame(scrollFrame.current)
    },
    []
  )

  const fitScale = containerWidth && pageWidth ? (containerWidth - 32) / pageWidth : 1
  const scale = manualScale ?? fitScale
  // Mirror the live scale into a ref so the render effect can divide measured
  // (zoomed) page sizes back to natural units without re-running on every zoom.
  const scaleRef = React.useRef(scale)
  React.useEffect(() => {
    scaleRef.current = scale
  })

  // Render the document once per source. docx-preview writes imperatively into
  // `host`, which React keeps empty, so the two never fight over the subtree.
  const hostRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    setReady(false)
    setNumPages(0)
    loadDocxPreview()
      .then(({ renderAsync }) => {
        if (cancelled) return
        host.replaceChildren()
        return renderAsync(buffer, host, undefined, RENDER_OPTIONS)
      })
      .then(() => {
        if (cancelled || !hostRef.current) return
        // Tag pages for scroll tracking and hand off-screen pages to the browser
        // via `content-visibility` — a long document then only lays out and
        // paints the pages near the viewport. Intrinsic sizes (measured in the
        // page's own, un-zoomed units) keep the scrollbar stable.
        const pages = Array.from(
          host.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx")
        )
        const z = scaleRef.current || 1
        // Two passes so we never interleave reads with writes: measure everything
        // first (one layout), then style everything. Interleaving would force a
        // synchronous reflow per page — O(n) layout thrash on long documents.
        const sizes = pages.map((el) => {
          const r = el.getBoundingClientRect()
          return [Math.round(r.width / z), Math.round(r.height / z)] as const
        })
        pages.forEach((el, i) => {
          el.dataset.pageNumber = String(i + 1)
          el.style.contentVisibility = "auto"
          el.style.containIntrinsicSize = `${sizes[i][0]}px ${sizes[i][1]}px`
        })
        setNumPages(pages.length)
        setPageWidth(pages.length ? sizes[0][0] : null)
        setReady(true)
      })
      .catch((err) => {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err : new Error("Failed to render DOCX"))
        }
      })
    return () => {
      cancelled = true
    }
  }, [buffer])

  const zoom = (factor: number) => setManualScale(clamp(scale * factor, 0.25, 5))

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="docx-viewer"
    >
      <style>{SCOPED_STYLES}</style>
      {toolbar ? (
        <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
          <span className="px-1 text-xs text-muted-foreground tabular-nums">
            {ready ? (
              <>
                {numPages} page{numPages === 1 ? "" : "s"}
              </>
            ) : (
              // Page count is unknown until docx-preview lays out — skeleton it.
              <Skeleton className="inline-block h-3 w-12 align-middle" />
            )}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <IconButton label="Zoom out" onClick={() => zoom(1 / 1.2)}>
              <Minus />
            </IconButton>
            <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
              {ready ? (
                `${Math.round(scale * 100)}%`
              ) : (
                // Fit-width % depends on the measured page width — skeleton it.
                <Skeleton className="inline-block h-3 w-8 align-middle" />
              )}
            </span>
            <IconButton label="Zoom in" onClick={() => zoom(1.2)}>
              <Plus />
            </IconButton>
            <IconButton label="Fit width" onClick={() => setManualScale(null)}>
              <Maximize />
            </IconButton>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7"
              aria-label="Download"
              title="Download"
              render={
                <a
                  href={src}
                  download={downloadFileName}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <Download />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {aside ? (
          <div data-slot="docx-viewer-aside" className="flex-shrink-0">
            {aside}
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {header ? <div data-slot="docx-viewer-header">{header}</div> : null}
          <ScrollArea
            className="min-h-0 flex-1"
            viewportRef={scrollViewportRef}
            viewportProps={
              onVisiblePageChange || onScrollProgressChange
                ? { onScroll: handleScroll }
                : undefined
            }
          >
            <div ref={containerRef} className="flex flex-col items-center p-4">
              {/* A document-shaped skeleton stands in for the pages until
                  docx-preview lays them out. Rendered before the host (which is
                  taller than the viewport) so the invisible, not-yet-measured
                  host stays below the fold during the brief measure window. */}
              {!ready ? <DocxSkeleton /> : null}
              {/* docx-preview renders the .docx-wrapper into this host; `zoom`
                  scales the laid-out pages (and scroll height) cheaply. Kept
                  invisible (not display:none — it must stay measurable) until
                  `ready`, so the first frame the user sees is already at the
                  measured fit-width zoom. Otherwise the page paints at zoom 1,
                  then snaps to fit once measured — the load flicker/resize. */}
              <div
                ref={hostRef}
                className={cn(
                  "w-full transition-opacity duration-200",
                  ready ? "opacity-100" : "opacity-0"
                )}
                style={{ zoom: scale }}
              />
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
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

// Shown while the document resource and docx-preview load (before DocxViewerInner
// mounts). Same chrome as the loaded viewer — a toolbar with skeletoned values
// plus a document-shaped skeleton — so the topbar is always present and there is
// no spinner anywhere; nothing jumps when the real document fades in.
function DocxViewerFallback({
  className,
  bare = false,
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
      data-slot="docx-viewer"
    >
      <DocxToolbarSkeleton />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col items-center p-4">
          <DocxSkeleton />
        </div>
      </div>
    </div>
  )
}

// A static mirror of the real toolbar: the two undetermined values (page count,
// zoom %) are skeletons; the controls are present but inert.
function DocxToolbarSkeleton() {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      <span className="px-1">
        <Skeleton className="inline-block h-3 w-12 align-middle" />
      </span>
      <div className="ml-auto flex items-center gap-1">
        <ToolbarIconPlaceholder>
          <Minus />
        </ToolbarIconPlaceholder>
        <span className="w-12 text-center">
          <Skeleton className="inline-block h-3 w-8 align-middle" />
        </span>
        <ToolbarIconPlaceholder>
          <Plus />
        </ToolbarIconPlaceholder>
        <ToolbarIconPlaceholder>
          <Maximize />
        </ToolbarIconPlaceholder>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <ToolbarIconPlaceholder>
          <Download />
        </ToolbarIconPlaceholder>
      </div>
    </div>
  )
}

function ToolbarIconPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-7"
      disabled
      tabIndex={-1}
      aria-hidden
    >
      {children}
    </Button>
  )
}

// A plain gray page-shaped block stands in for the document while it loads.
// The sample is US Letter (w:pgSz 12240 × 15840 twips = 8.5" × 11"), so the
// aspect matches the rendered page; `w-full` inside the container's p-4 equals
// the fit-width page width — so the block is the same size as the document that
// replaces it. (For A4 docs this would be 210 / 297.)
function DocxSkeleton() {
  return (
    <Skeleton aria-hidden className="w-full rounded-sm" style={{ aspectRatio: "8.5 / 11" }} />
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

class DocxErrorBoundary extends React.Component<
  { children: React.ReactNode; className?: string; resetKey?: unknown },
  { error: boolean }
> {
  state = { error: false }
  // Recover when the source changes: a new file gets a fresh attempt instead
  // of staying stuck on the previous file's error.
  componentDidUpdate(prev: { resetKey?: unknown }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: false })
    }
  }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    if (this.state.error) {
      return (
        <div
          className={cn(
            "flex min-h-64 items-center justify-center rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground",
            this.props.className
          )}
        >
          Couldn&apos;t load this document.
        </div>
      )
    }
    return this.props.children
  }
}
