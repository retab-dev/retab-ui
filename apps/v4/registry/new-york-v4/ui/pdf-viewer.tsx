"use client"

import * as React from "react"
import {
  Download01Icon,
  MinusSignIcon,
  PlusSignIcon,
  RotateClockwiseIcon,
  SquareArrowExpand01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
// Type-only import — erased at compile time, so pdfjs never loads on the server.
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"

// pdfjs touches browser-only globals (DOMMatrix) at module eval, so it must be
// imported lazily on the client. The worker is resolved by the bundler from the
// installed package — no runtime CDN call.
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null
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

function getDocumentResource(src: string): Promise<PDFDocumentProxy> {
  let promise = documentCache.get(src)
  if (!promise) {
    promise = loadPdfjs().then((pdfjs) => pdfjs.getDocument(src).promise)
    documentCache.set(src, promise)
  }
  return promise
}

function getPageResource(doc: PDFDocumentProxy, pageNumber: number) {
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
}: PdfViewerProps) {
  const doc = React.use(getDocumentResource(src))
  const firstPage = React.use(getPageResource(doc, 1))
  const baseWidth = React.useMemo(
    () => firstPage.getViewport({ scale: 1 }).width,
    [firstPage]
  )

  const [manualScale, setManualScale] = React.useState<number | null>(
    fixedScale ?? null
  )
  const [rotation, setRotation] = React.useState(0)
  const [containerWidth, setContainerWidth] = React.useState<number | null>(null)

  // Measure the container with a ResizeObserver attached in the ref callback.
  const containerRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    setContainerWidth(el.clientWidth)
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Report the page nearest the top of the scroll viewport as the user scrolls.
  // We watch the actual scroll container (not the browser viewport) so the
  // current-page cursor stays in sync even when the viewer is embedded.
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null)
  const lastReported = React.useRef(0)
  const handleScroll = React.useCallback(() => {
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

  const fitScale = containerWidth ? (containerWidth - 32) / baseWidth : 1
  const scale = manualScale ?? fitScale

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
          <span className="px-1 text-xs text-muted-foreground tabular-nums">
            {doc.numPages} page{doc.numPages === 1 ? "" : "s"}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <IconButton label="Zoom out" onClick={() => zoom(1 / 1.2)}>
              <HugeiconsIcon icon={MinusSignIcon} />
            </IconButton>
            <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
              {Math.round(scale * 100)}%
            </span>
            <IconButton label="Zoom in" onClick={() => zoom(1.2)}>
              <HugeiconsIcon icon={PlusSignIcon} />
            </IconButton>
            <IconButton label="Fit width" onClick={() => setManualScale(null)}>
              <HugeiconsIcon icon={SquareArrowExpand01Icon} />
            </IconButton>
            <IconButton
              label="Rotate"
              onClick={() => setRotation((r) => (r + 90) % 360)}
            >
              <HugeiconsIcon icon={RotateClockwiseIcon} />
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
              <HugeiconsIcon icon={Download01Icon} />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {aside ? (
          <div data-slot="pdf-viewer-aside" className="flex-shrink-0">
            {aside}
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {header ? <div data-slot="pdf-viewer-header">{header}</div> : null}
          <ScrollArea
            className="min-h-0 flex-1"
            viewportRef={scrollViewportRef}
            viewportProps={
              onVisiblePageChange || onScrollProgressChange
                ? { onScroll: handleScroll }
                : undefined
            }
          >
            <div ref={containerRef} className="flex flex-col items-center gap-4 p-4">
              {Array.from({ length: doc.numPages }, (_, i) => (
                <React.Suspense key={i} fallback={<PageSkeleton />}>
                  <PdfPage
                    doc={doc}
                    pageNumber={i + 1}
                    scale={scale}
                    rotation={rotation}
                    renderOverlay={renderPageOverlay}
                  />
                </React.Suspense>
              ))}
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
      data-page-number={pageNumber}
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
  return (
    <div className="flex aspect-[3/4] w-full max-w-2xl items-center justify-center rounded-md bg-muted">
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
