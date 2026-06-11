"use client"

import * as React from "react"
import { Download, Maximize, Minus, Plus, RotateCw } from "lucide-react"
// Type-only imports — erased at compile time, so the libraries never load on the
// server (pptxviewjs touches `document` at module eval).
import type * as PptxNS from "pptxviewjs"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"

// pptxviewjs renders each slide to a <canvas> — the same model pdf.js uses — with
// zero runtime deps of its own beyond jszip. Imported lazily on the client only.
type PptxModule = typeof PptxNS
let pptxPromise: Promise<PptxModule> | null = null
function loadPptx(): Promise<PptxModule> {
  if (!pptxPromise) pptxPromise = import("pptxviewjs")
  return pptxPromise
}

// jszip has no need for full types here — we only read one file from the deck to
// recover the slide size. A minimal local shape keeps the component self-contained.
interface JSZipLike {
  loadAsync(data: ArrayBuffer): Promise<{
    file(path: string): { async(type: "string"): Promise<string> } | null
  }>
}
let jszipPromise: Promise<JSZipLike> | null = null
function loadJSZip(): Promise<JSZipLike> {
  if (!jszipPromise) {
    jszipPromise = import("jszip").then(
      (m) => ((m as { default?: unknown }).default ?? m) as unknown as JSZipLike
    )
  }
  return jszipPromise
}

// EMU (English Metric Units) → CSS px at 96dpi. OOXML measures in EMU; 914400
// EMU = 1 inch, 96 px = 1 inch ⇒ 9525 EMU = 1 px.
const EMU_PER_PX = 9525
const DEFAULT_SLIDE = { width: 960, height: 720 } // 4:3 fallback

interface PptxSource {
  slideCount: number
  /** Native slide size in CSS px (uniform across the deck in OOXML). */
  baseWidth: number
  baseHeight: number
  /**
   * Render slide `index` into `canvas` at `scale` (multiplier on native size).
   * Calls are serialized: the underlying viewer holds one drawing context, so
   * concurrent renders to different canvases would race.
   */
  render(index: number, canvas: HTMLCanvasElement, scale: number): Promise<void>
}

async function readSlideSize(buf: ArrayBuffer) {
  try {
    const JSZip = await loadJSZip()
    const zip = await JSZip.loadAsync(buf)
    const xml = await zip.file("ppt/presentation.xml")?.async("string")
    const m = xml?.match(/<p:sldSz[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/)
    if (m) {
      return {
        width: Math.round(Number(m[1]) / EMU_PER_PX),
        height: Math.round(Number(m[2]) / EMU_PER_PX),
      }
    }
  } catch {
    /* fall through to default */
  }
  return DEFAULT_SLIDE
}

async function buildPptxSource(src: string): Promise<PptxSource> {
  const res = await fetch(src)
  if (!res.ok) throw new Error(`Failed to load presentation: ${res.status}`)
  const buf = await res.arrayBuffer()

  const [pptx, size] = await Promise.all([loadPptx(), readSlideSize(buf)])
  const { PPTXViewer } = pptx

  // The viewer needs a canvas; a tiny offscreen one satisfies construction —
  // per-slide renders target the canvas passed to render(), not this one.
  const offscreen = document.createElement("canvas")
  const viewer = new PPTXViewer({ canvas: offscreen, slideSizeMode: "actual" })
  await viewer.loadFile(buf)
  const slideCount = viewer.getSlideCount()

  // Serialize renders through a promise chain (single shared drawing context).
  let queue: Promise<unknown> = Promise.resolve()
  const render = (index: number, canvas: HTMLCanvasElement, scale: number) => {
    const run = queue
      .catch(() => {})
      .then(() => viewer.renderSlide(index, canvas, { scale, quality: "high" }))
    queue = run.catch(() => {})
    return run.then(() => undefined)
  }

  return { slideCount, baseWidth: size.width, baseHeight: size.height, render }
}

// --- resource cache: stable promises so React `use()` can read them ----------

const sourceCache = new Map<string, Promise<PptxSource>>()
function getPptxSource(src: string): Promise<PptxSource> {
  let promise = sourceCache.get(src)
  if (!promise) {
    promise = buildPptxSource(src)
    sourceCache.set(src, promise)
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

export interface PptxPageOverlayProps {
  /** 1-based slide index. */
  pageNumber: number
  /** Rendered slide size in CSS pixels (post-scale, post-rotation). */
  width: number
  height: number
  scale: number
  rotation: number
}

export interface PptxViewerProps {
  /** URL of the .pptx (same-origin or CORS-enabled). */
  src: string
  className?: string
  /** Fixed scale; when omitted the viewer fits slide width to the container. */
  scale?: number
  toolbar?: boolean
  downloadFileName?: string
  /** Render absolutely-positioned overlays (e.g. bbox citations) on each slide. */
  renderPageOverlay?: (props: PptxPageOverlayProps) => React.ReactNode
  /** Fired with the 1-based slide nearest the top of the viewport as you scroll. */
  onVisiblePageChange?: (page: number) => void
  /** Fired with scroll progress in [0, 1] (for a fine-grained scroll cursor). */
  onScrollProgressChange?: (progress: number) => void
  /** Drop the outer border/rounded/background so the viewer fills its container. */
  bare?: boolean
  /** Rendered as a full-width strip directly below the toolbar (e.g. a legend). */
  header?: React.ReactNode
  /** Rendered as a left rail alongside the scrolling slides (e.g. a thumbnail rail). */
  aside?: React.ReactNode
}

export function PptxViewer(props: PptxViewerProps) {
  const isClient = useIsClient()
  if (!isClient) {
    return <PptxViewerFallback className={props.className} bare={props.bare} />
  }
  return (
    <PptxErrorBoundary className={props.className}>
      <React.Suspense
        fallback={<PptxViewerFallback className={props.className} bare={props.bare} />}
      >
        <PptxViewerInner {...props} />
      </React.Suspense>
    </PptxErrorBoundary>
  )
}

function PptxViewerInner({
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
}: PptxViewerProps) {
  const source = React.use(getPptxSource(src))
  const baseWidth = source.baseWidth || 1

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

  // Report the slide nearest the top of the scroll viewport as the user scrolls.
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

  const zoom = (factor: number) => setManualScale(clamp(scale * factor, 0.25, 5))

  const slideCount = source.slideCount

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="pptx-viewer"
    >
      {toolbar ? (
        <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
          <span className="px-1 text-xs text-muted-foreground tabular-nums">
            {slideCount} slide{slideCount === 1 ? "" : "s"}
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
          <div data-slot="pptx-viewer-aside" className="flex-shrink-0">
            {aside}
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {header ? <div data-slot="pptx-viewer-header">{header}</div> : null}
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
              {Array.from({ length: slideCount }, (_, i) => (
                <PptxSlide
                  key={i}
                  source={source}
                  index={i}
                  scale={scale}
                  rotation={rotation}
                  renderOverlay={renderPageOverlay}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

function PptxSlide({
  source,
  index,
  scale,
  rotation,
  renderOverlay,
}: {
  source: PptxSource
  index: number
  scale: number
  rotation: number
  renderOverlay?: (props: PptxPageOverlayProps) => React.ReactNode
}) {
  const [inView, setInView] = React.useState(false)

  // Lazily mount/render the canvas only when the slide nears the viewport. The
  // wrapper is always sized from the slide's intrinsic dimensions, so scroll
  // height and overlay coordinates are correct whether or not it has rendered.
  const wrapperRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const root = el.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting)
      },
      { root, rootMargin: "150% 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const rotated = rotation === 90 || rotation === 270
  const cssW = source.baseWidth * scale
  const cssH = source.baseHeight * scale
  const boxW = (rotated ? source.baseHeight : source.baseWidth) * scale
  const boxH = (rotated ? source.baseWidth : source.baseHeight) * scale

  return (
    <div
      ref={wrapperRef}
      className="relative shadow-sm ring-1 ring-border"
      style={{ width: boxW, height: boxH }}
      data-slot="pptx-slide"
      data-page={index + 1}
      data-page-number={index + 1}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: cssW,
          height: cssH,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        }}
      >
        {inView ? (
          <SlideCanvas source={source} index={index} scale={scale} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white">
            <Spinner className="size-4 text-muted-foreground" />
          </div>
        )}
      </div>
      {renderOverlay ? (
        <div className="pointer-events-none absolute inset-0">
          {renderOverlay({
            pageNumber: index + 1,
            width: boxW,
            height: boxH,
            scale,
            rotation,
          })}
        </div>
      ) : null}
    </div>
  )
}

function SlideCanvas({
  source,
  index,
  scale,
}: {
  source: PptxSource
  index: number
  scale: number
}) {
  const dpr = (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1
  const cssW = source.baseWidth * scale
  const cssH = source.baseHeight * scale
  const [rendered, setRendered] = React.useState(false)

  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      let cancelled = false
      setRendered(false)
      // Render at DPR-scaled resolution for crispness; CSS keeps logical size.
      source
        .render(index, canvas, scale * dpr)
        .then(() => {
          if (!cancelled) setRendered(true)
        })
        .catch(() => {
          /* a single slide failing shouldn't break the deck */
        })
      return () => {
        cancelled = true
      }
    },
    [source, index, scale, dpr]
  )

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ width: cssW, height: cssH }}
        className="block h-full w-full bg-white"
      />
      {!rendered ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white">
          <Spinner className="size-4 text-muted-foreground" />
        </div>
      ) : null}
    </>
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

function PptxViewerFallback({
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

class PptxErrorBoundary extends React.Component<
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
          Couldn&apos;t load this presentation.
        </div>
      )
    }
    return this.props.children
  }
}
