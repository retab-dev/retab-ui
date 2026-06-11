"use client"

import * as React from "react"
import {
  Download,
  Maximize,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCw,
} from "lucide-react"
// Type-only imports — erased at compile time, so pdfjs never loads on the server.
import type * as Pdfjs from "pdfjs-dist"
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"

// pdfjs touches browser-only globals (DOMMatrix) at module eval, so it must be
// imported lazily on the client. The worker is resolved by the bundler from the
// installed package — no runtime CDN call.
let pdfjsPromise: Promise<typeof Pdfjs> | null = null
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString()
      }
      return pdfjs
    })
  }
  return pdfjsPromise
}

// --- resource caches: stable promises so React `use()` can read them ---------

const documentCache = new Map<string, Promise<PDFDocumentProxy>>()
const pageCache = new WeakMap<PDFDocumentProxy, Map<number, Promise<PDFPageProxy>>>()

export function getDocumentResource(src: string): Promise<PDFDocumentProxy> {
  let promise = documentCache.get(src)
  if (!promise) {
    promise = loadPdfjs().then((pdfjs) => pdfjs.getDocument(src).promise)
    documentCache.set(src, promise)
  }
  return promise
}

export function getPageResource(doc: PDFDocumentProxy, pageNumber: number) {
  let pages = pageCache.get(doc)
  if (!pages) {
    pages = new Map()
    pageCache.set(doc, pages)
  }
  let promise = pages.get(pageNumber)
  if (!promise) {
    promise = doc.getPage(pageNumber)
    pages.set(pageNumber, promise)
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

export interface PdfPageOverlayProps {
  pageNumber: number
  /** Rendered page size in CSS pixels (post-scale, post-rotation). */
  width: number
  height: number
  scale: number
  rotation: number
}

export interface PdfViewerProps {
  /** URL of the PDF (same-origin or CORS-enabled). */
  src: string
  className?: string
  /** Fixed scale; when omitted the viewer fits page width to the container. */
  scale?: number
  toolbar?: boolean
  downloadFileName?: string
  /** Render absolutely-positioned overlays (e.g. bbox citations) on each page. */
  renderPageOverlay?: (props: PdfPageOverlayProps) => React.ReactNode
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
  /** Show a toolbar button that collapses/expands the `aside` rail. Default true when `aside` is set. */
  asideToggle?: boolean
  /** Initial open state of the `aside` rail. */
  defaultAsideOpen?: boolean
}

export function PdfViewer(props: PdfViewerProps) {
  const isClient = useIsClient()
  if (!isClient) {
    return <PdfViewerFallback className={props.className} bare={props.bare} />
  }
  return (
    <PdfErrorBoundary className={props.className}>
      <React.Suspense
        fallback={<PdfViewerFallback className={props.className} bare={props.bare} />}
      >
        <PdfViewerInner {...props} />
      </React.Suspense>
    </PdfErrorBoundary>
  )
}

function PdfViewerInner({
  src,
  className,
  scale: fixedScale,
  toolbar = true,
  downloadFileName,
  renderPageOverlay,
  onVisiblePageChange,
  onScrollProgressChange,
  bare = false,
  header,
  aside,
  asideToggle = true,
  defaultAsideOpen = true,
}: PdfViewerProps) {
  const doc = React.use(getDocumentResource(src))
  const firstPage = React.use(getPageResource(doc, 1))
  // First page stands in for every page's intrinsic size: most documents are
  // uniform, so this is enough to reserve scroll space before a page renders.
  const { width: baseWidth, height: baseHeight } = React.useMemo(() => {
    const vp = firstPage.getViewport({ scale: 1 })
    return { width: vp.width, height: vp.height }
  }, [firstPage])

  const [manualScale, setManualScale] = React.useState<number | null>(
    fixedScale ?? null
  )
  const [rotation, setRotation] = React.useState(0)
  const [containerWidth, setContainerWidth] = React.useState<number | null>(null)
  const [asideOpen, setAsideOpen] = React.useState(defaultAsideOpen)
  const showAsideToggle = Boolean(aside && asideToggle)

  // Measure the aside's natural width so we can collapse it by animating an
  // explicit pixel width → 0. (A grid 1fr→0fr trick doesn't collapse here: the
  // wrapper is a flex-shrink-0 flex item sized to its max-content, and grid
  // intrinsic sizing ignores fr.) The inner w-max keeps the content at its
  // natural width while the wrapper clips it, so the measurement stays stable
  // even while collapsed — reopening animates back to the same width.
  const [asideWidth, setAsideWidth] = React.useState<number | null>(null)
  const asideMeasureRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    setAsideWidth(Math.round(el.offsetWidth))
    const observer = new ResizeObserver(() =>
      setAsideWidth(Math.round(el.offsetWidth))
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Measure the container with a ResizeObserver attached in the ref callback.
  // Coalesce to one update per frame so dragging a resize handle doesn't trigger
  // a fit-width recompute (and a re-render of every visible canvas) per pixel.
  const containerRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    setContainerWidth(el.clientWidth)
    let frame = 0
    let latest = el.clientWidth
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) latest = entry.contentRect.width
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
  // Mirror the viewport element into state so the IntersectionObserver below can
  // root itself on the internal scroller (pages scroll inside it, not the window).
  const [viewportEl, setViewportEl] = React.useState<HTMLDivElement | null>(null)
  const setScrollViewport = React.useCallback((el: HTMLDivElement | null) => {
    scrollViewportRef.current = el
    setViewportEl(el)
  }, [])
  const lastReported = React.useRef(0)
  // Coalesce scroll work to one frame: the layout reads below (getBoundingClientRect
  // over every page slot) shouldn't run on every scroll event.
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

  // --- viewport virtualization ------------------------------------------------
  // Only pages near the viewport hold a live canvas; the rest stay as sized
  // placeholders so a long PDF doesn't rasterize every page (and every re-zoom)
  // at once. Slots are always mounted so scroll height — and external
  // `scrollIntoView([data-page-number])` — stay correct.
  const [visiblePages, setVisiblePages] = React.useState<ReadonlySet<number>>(
    () => new Set([1])
  )
  const observerRef = React.useRef<IntersectionObserver | null>(null)
  const slotEls = React.useRef<Set<HTMLElement>>(new Set())

  React.useEffect(() => {
    if (!viewportEl) return
    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          const next = new Set(prev)
          let changed = false
          for (const entry of entries) {
            const n = Number((entry.target as HTMLElement).dataset.pageNumber)
            if (!n) continue
            if (entry.isIntersecting) {
              if (!next.has(n)) {
                next.add(n)
                changed = true
              }
            } else if (next.delete(n)) {
              changed = true
            }
          }
          return changed ? next : prev
        })
      },
      // One viewport of pre-render buffer above and below keeps scrolling smooth.
      { root: viewportEl, rootMargin: "100% 0px" }
    )
    observerRef.current = observer
    for (const el of slotEls.current) observer.observe(el)
    return () => {
      observer.disconnect()
      observerRef.current = null
    }
  }, [viewportEl])

  // Slots mount before the observer exists (refs run before effects), so both
  // this callback and the effect above observe whatever the other hasn't yet.
  const registerSlot = React.useCallback((el: HTMLElement | null) => {
    if (!el) return
    slotEls.current.add(el)
    observerRef.current?.observe(el)
    return () => {
      slotEls.current.delete(el)
      observerRef.current?.unobserve(el)
    }
  }, [])

  const fitScale = containerWidth ? (containerWidth - 32) / baseWidth : 1
  const scale = manualScale ?? fitScale

  // Estimated rendered size of an un-rendered page at the current scale/rotation.
  const rotated = rotation % 180 !== 0
  const estWidth = Math.round((rotated ? baseHeight : baseWidth) * scale)
  const estHeight = Math.round((rotated ? baseWidth : baseHeight) * scale)

  const zoom = (factor: number) =>
    setManualScale(clamp(scale * factor, 0.25, 5))

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="pdf-viewer"
    >
      {/* Pecking order: toolbar spans the full width; below it the sidebar
          claims the full height and the header (legend) spans the main column. */}
      {toolbar ? (
        <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
          {showAsideToggle ? (
            <IconButton
              label={asideOpen ? "Hide sidebar" : "Show sidebar"}
              aria-pressed={asideOpen}
              onClick={() => setAsideOpen((open) => !open)}
            >
              {asideOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
            </IconButton>
          ) : null}
          <span className="px-1 text-xs text-muted-foreground tabular-nums">
            {doc.numPages} page{doc.numPages === 1 ? "" : "s"}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <IconButton label="Zoom out" onClick={() => zoom(1 / 1.2)}>
              <Minus />
            </IconButton>
            <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
              {Math.round(scale * 100)}%
            </span>
            <IconButton label="Zoom in" onClick={() => zoom(1.2)}>
              <Plus />
            </IconButton>
            <IconButton label="Fit width" onClick={() => setManualScale(null)}>
              <Maximize />
            </IconButton>
            <IconButton
              label="Rotate"
              onClick={() => setRotation((r) => (r + 90) % 360)}
            >
              <RotateCw />
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
          // Collapse by animating an explicit width → 0 (width-agnostic: the
          // natural width is measured, so any-width rail slides away cleanly).
          // The inner w-max holds the content at its natural size while the
          // wrapper clips it. No toggle (asideToggle=false) → always open.
          <div
            data-slot="pdf-viewer-aside"
            data-state={asideOpen ? "open" : "closed"}
            className={cn(
              "h-full flex-shrink-0 overflow-hidden",
              showAsideToggle && "transition-[width] duration-200 ease-out"
            )}
            style={
              showAsideToggle
                ? { width: asideOpen ? (asideWidth ?? undefined) : 0 }
                : undefined
            }
          >
            <div ref={asideMeasureRef} className="h-full w-max">
              {aside}
            </div>
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {header ? <div data-slot="pdf-viewer-header">{header}</div> : null}
          <ScrollArea
            className="min-h-0 flex-1"
            viewportRef={setScrollViewport}
            viewportProps={
              onVisiblePageChange || onScrollProgressChange
                ? { onScroll: handleScroll }
                : undefined
            }
          >
            <div ref={containerRef} className="flex flex-col items-center gap-4 p-4">
              {Array.from({ length: doc.numPages }, (_, i) => {
                const pageNumber = i + 1
                return (
                  <div
                    key={pageNumber}
                    ref={registerSlot}
                    data-slot="pdf-page-slot"
                    data-page-number={pageNumber}
                    className="flex items-center justify-center"
                    style={{ width: estWidth, minHeight: estHeight }}
                  >
                    {visiblePages.has(pageNumber) ? (
                      <React.Suspense fallback={<PageSkeleton />}>
                        <PdfPage
                          doc={doc}
                          pageNumber={pageNumber}
                          scale={scale}
                          rotation={rotation}
                          renderOverlay={renderPageOverlay}
                        />
                      </React.Suspense>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

function PdfPage({
  doc,
  pageNumber,
  scale,
  rotation,
  renderOverlay,
}: {
  doc: PDFDocumentProxy
  pageNumber: number
  scale: number
  rotation: number
  renderOverlay?: (props: PdfPageOverlayProps) => React.ReactNode
}) {
  const page = React.use(getPageResource(doc, pageNumber))
  const viewport = React.useMemo(
    // Add the user rotation to the page's intrinsic /Rotate so pages authored
    // with a rotation (common in form bundles) display in their true orientation.
    () => page.getViewport({ scale, rotation: ((page.rotate ?? 0) + rotation) % 360 }),
    [page, scale, rotation]
  )
  const dpr =
    (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1

  // Render into the canvas from a ref callback; cancel on cleanup (React 19).
  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      const context = canvas.getContext("2d")
      if (!context) return
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      const renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      })
      renderTask.promise.catch(() => {
        /* cancelled or failed render — ignore */
      })
      return () => renderTask.cancel()
    },
    [page, viewport, dpr]
  )

  return (
    <div
      className="relative shadow-sm ring-1 ring-border"
      style={{ width: viewport.width, height: viewport.height }}
      data-slot="pdf-page"
      data-page={pageNumber}
    >
      <canvas
        ref={canvasRef}
        style={{ width: viewport.width, height: viewport.height }}
        className="block bg-white"
      />
      {renderOverlay ? (
        <div className="pointer-events-none absolute inset-0">
          {renderOverlay({
            pageNumber,
            width: viewport.width,
            height: viewport.height,
            scale,
            rotation,
          })}
        </div>
      ) : null}
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

function PdfViewerFallback({
  className,
  bare = false,
}: {
  className?: string
  bare?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        bare ? "h-full bg-muted/20" : "min-h-64 rounded-xl border bg-muted/30",
        className
      )}
    >
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  )
}

function PageSkeleton() {
  // Fills the parent slot, which already reserves the page's estimated size.
  return (
    <div className="flex size-full min-h-32 flex-1 items-center justify-center self-stretch rounded-md bg-muted">
      <Spinner className="size-4 text-muted-foreground" />
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

class PdfErrorBoundary extends React.Component<
  { children: React.ReactNode; className?: string },
  { error: boolean }
> {
  state = { error: false }
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
          Couldn&apos;t load this PDF.
        </div>
      )
    }
    return this.props.children
  }
}
