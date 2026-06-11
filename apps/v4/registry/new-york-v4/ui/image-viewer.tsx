"use client"

import * as React from "react"
import { Download, Maximize, Minus, Plus, RotateCw } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

// Browsers can't decode multi-page TIFFs natively, so the heavy decode (UTIF)
// runs in a Web Worker (see ./image-viewer.worker): it transfers decoded
// ImageBitmaps back — keeping the pixels off the main heap — and frees UTIF's
// per-frame buffers, so the parser never enters the main bundle and decoding a
// long scan never blocks scrolling.
interface TiffWorkerInit {
  type: "init"
  ok: boolean
  frames?: FrameMeta[]
  error?: string
}
interface TiffWorkerDecoded {
  type: "decoded"
  id: number
  bitmap: ImageBitmap
}
interface TiffWorkerError {
  type: "error"
  id: number
  message: string
}
type TiffWorkerResponse = TiffWorkerInit | TiffWorkerDecoded | TiffWorkerError

// --- frame source: one model for plain images and multi-page TIFFs -----------
//
// A "frame" is one rasterizable image: a normal image has exactly one, a
// multi-page TIFF has one per IFD. We expose cheap per-frame dimensions up front
// (so the scroll height is correct without decoding any pixels) and an
// acquire/release pair that decodes lazily and caps how many decoded bitmaps we
// hold in memory at once.

interface FrameMeta {
  width: number
  height: number
}

interface ImageSource {
  kind: "image" | "tiff"
  frames: FrameMeta[]
  /** Decode (memoized) and pin frame `i` so it survives eviction while visible. */
  acquire(i: number): Promise<ImageBitmap>
  /** Unpin frame `i`; it becomes eligible for eviction. */
  release(i: number): void
}

// Cap on simultaneously-decoded bitmaps. A 100-page TIFF never holds 100
// full-res bitmaps: off-screen frames past this many are closed and re-decoded
// on scroll-back (cheap — the source bytes stay cached).
const MAX_DECODED = 16

function looksLikeTiff(
  src: string,
  contentType: string | null,
  buf: ArrayBuffer
): boolean {
  if (/\.tiff?($|\?)/i.test(src)) return true
  if (contentType && /image\/tiff/i.test(contentType)) return true
  // Magic bytes: "II*\0" (little-endian) or "MM\0*" (big-endian).
  const b = new Uint8Array(buf, 0, 4)
  return (
    (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
    (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)
  )
}

function createSource(
  kind: "image" | "tiff",
  frames: FrameMeta[],
  decode: (i: number) => Promise<ImageBitmap>
): ImageSource {
  const cache = new Map<number, ImageBitmap>()
  const inflight = new Map<number, Promise<ImageBitmap>>()
  const pins = new Set<number>()
  const recency: number[] = [] // least-recent first

  const touch = (i: number) => {
    const k = recency.indexOf(i)
    if (k >= 0) recency.splice(k, 1)
    recency.push(i)
  }
  const evict = () => {
    for (const i of [...recency]) {
      if (cache.size <= MAX_DECODED) break
      if (pins.has(i)) continue
      cache.get(i)?.close()
      cache.delete(i)
      recency.splice(recency.indexOf(i), 1)
    }
  }

  return {
    kind,
    frames,
    acquire(i) {
      pins.add(i)
      touch(i)
      const have = cache.get(i)
      if (have) return Promise.resolve(have)
      let p = inflight.get(i)
      if (!p) {
        p = decode(i).then((bmp) => {
          inflight.delete(i)
          cache.set(i, bmp)
          evict()
          return bmp
        })
        inflight.set(i, p)
      }
      return p
    },
    release(i) {
      pins.delete(i)
      evict()
    },
  }
}

async function buildImageSource(src: string): Promise<ImageSource> {
  const res = await fetch(src)
  if (!res.ok) throw new Error(`Failed to load image: ${res.status}`)
  const buf = await res.arrayBuffer()
  const contentType = res.headers.get("content-type")

  if (looksLikeTiff(src, contentType, buf)) {
    return buildTiffSource(buf)
  }

  // Plain image: let the browser decode it natively (off-main-thread via
  // createImageBitmap). One probe gives us the intrinsic size for layout.
  const blob = new Blob([buf], { type: contentType ?? "" })
  const probe = await createImageBitmap(blob)
  const frames: FrameMeta[] = [{ width: probe.width, height: probe.height }]
  probe.close()
  return createSource("image", frames, () => createImageBitmap(blob))
}

/**
 * Decode a multi-page TIFF in a worker. The byte buffer is transferred in once;
 * per-frame decode requests come back as transferred ImageBitmaps, so the heavy
 * decode and the pixels stay off the main thread entirely.
 */
function buildTiffSource(buffer: ArrayBuffer): Promise<ImageSource> {
  return new Promise((resolve, reject) => {
    if (typeof Worker === "undefined") {
      reject(new Error("Web Workers are unavailable in this environment"))
      return
    }
    const worker = new Worker(
      new URL("./image-viewer.worker", import.meta.url),
      { type: "module" }
    )
    const pending = new Map<
      number,
      { resolve: (b: ImageBitmap) => void; reject: (e: Error) => void }
    >()
    let nextId = 0

    worker.onmessage = (event: MessageEvent<TiffWorkerResponse>) => {
      const msg = event.data
      if (msg.type === "init") {
        if (!msg.ok || !msg.frames) {
          worker.terminate()
          reject(new Error(msg.error ?? "Failed to read TIFF"))
          return
        }
        const decode = (i: number) =>
          new Promise<ImageBitmap>((res, rej) => {
            const id = nextId++
            pending.set(id, { resolve: res, reject: rej })
            worker.postMessage({ type: "decode", id, index: i })
          })
        resolve(createSource("tiff", msg.frames, decode))
      } else if (msg.type === "decoded") {
        pending.get(msg.id)?.resolve(msg.bitmap)
        pending.delete(msg.id)
      } else if (msg.type === "error") {
        pending.get(msg.id)?.reject(new Error(msg.message))
        pending.delete(msg.id)
      }
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || "TIFF worker failed"))
    }
    // Transfer the bytes into the worker (no copy); it owns them thereafter.
    worker.postMessage({ type: "init", buffer }, [buffer])
  })
}

// --- resource cache: stable promises so React `use()` can read them ----------

const sourceCache = new Map<string, Promise<ImageSource>>()
function getImageSource(src: string): Promise<ImageSource> {
  let promise = sourceCache.get(src)
  if (!promise) {
    promise = buildImageSource(src)
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

export interface ImagePageOverlayProps {
  /** 1-based frame index (a TIFF page; always 1 for single images). */
  pageNumber: number
  /** Rendered frame size in CSS pixels (post-scale, post-rotation). */
  width: number
  height: number
  scale: number
  rotation: number
}

/**
 * Imperative handle for driving the viewer from outside (e.g. scroll to the
 * source of a hovered field). Obtain it with a `ref` on `<ImageViewer>`.
 */
export interface ImageViewerHandle {
  /**
   * Scroll a frame's normalized area into view. `area` fields are percentages
   * [0, 100] of the rendered frame; only `top` is required. Pass
   * `behavior: "auto"` for an instant jump (e.g. on hover).
   */
  scrollToFrameArea: (
    frameNumber: number,
    area: { top: number; left?: number; width?: number; height?: number },
    options?: ScrollToOptions
  ) => void
  /** The scrolling viewport element, or null before the image loads. */
  getViewportElement: () => HTMLDivElement | null
}

/** Headroom left above a scrolled-to area so it doesn't sit flush under the toolbar. */
const IMAGE_SCROLL_HEADROOM = 48

export interface ImageViewerProps {
  /** URL of the image (same-origin or CORS-enabled). PNG/JPEG/WebP/GIF/AVIF or TIFF. */
  src: string
  className?: string
  /** Fixed scale; when omitted the viewer fits frame width to the container. */
  scale?: number
  toolbar?: boolean
  downloadFileName?: string
  /** Render absolutely-positioned overlays (e.g. bbox citations) on each frame. */
  renderPageOverlay?: (props: ImagePageOverlayProps) => React.ReactNode
  /** Fired with the 1-based frame nearest the top of the viewport as you scroll. */
  onVisiblePageChange?: (page: number) => void
  /** Fired with scroll progress in [0, 1] (for a fine-grained scroll cursor). */
  onScrollProgressChange?: (progress: number) => void
  /** Drop the outer border/rounded/background so the viewer fills its container. */
  bare?: boolean
  /** Rendered as a full-width strip directly below the toolbar (e.g. a legend). */
  header?: React.ReactNode
  /** Rendered as a left rail alongside the scrolling frames (e.g. a page ribbon). */
  aside?: React.ReactNode
}

export const ImageViewer = React.forwardRef<
  ImageViewerHandle,
  ImageViewerProps
>(function ImageViewer(props, ref) {
  const isClient = useIsClient()
  if (!isClient) {
    return <ImageViewerFallback className={props.className} bare={props.bare} />
  }
  return (
    <ImageErrorBoundary className={props.className}>
      <React.Suspense
        fallback={
          <ImageViewerFallback className={props.className} bare={props.bare} />
        }
      >
        <ImageViewerInner {...props} forwardedRef={ref} />
      </React.Suspense>
    </ImageErrorBoundary>
  )
})

function ImageViewerInner({
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
  forwardedRef,
}: ImageViewerProps & {
  forwardedRef?: React.ForwardedRef<ImageViewerHandle>
}) {
  const source = React.use(getImageSource(src))
  const baseWidth = source.frames[0]?.width || 1

  const [manualScale, setManualScale] = React.useState<number | null>(
    fixedScale ?? null
  )
  const [rotation, setRotation] = React.useState(0)
  const [containerWidth, setContainerWidth] = React.useState<number | null>(
    null
  )

  // Measure the container with a ResizeObserver attached in the ref callback.
  const containerRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    setContainerWidth(el.clientWidth)
    const observer = new ResizeObserver((entries) => {
      // clientWidth (content + padding), matching the init read above, so the
      // `- 32` in fitScale subtracts the p-4 padding exactly once (contentRect
      // already excludes it, which would double-subtract and shrink the image).
      for (const entry of entries)
        setContainerWidth((entry.target as HTMLElement).clientWidth)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Report the frame nearest the top of the scroll viewport as the user scrolls.
  // We watch the actual scroll container (not the browser viewport) so the
  // current-page cursor stays in sync even when the viewer is embedded.
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null)
  const lastReported = React.useRef(0)
  const handleScroll = React.useCallback(() => {
    const viewport = scrollViewportRef.current
    if (!viewport) return
    const scrollable = viewport.scrollHeight - viewport.clientHeight
    onScrollProgressChange?.(
      scrollable > 0 ? viewport.scrollTop / scrollable : 0
    )
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

  // Imperative handle: scroll a frame's normalized area into view. Reads the
  // always-mounted frame slot's live rect, so it stays correct across zoom and
  // rotation. `area.top` is a % of the rendered frame height.
  React.useImperativeHandle(
    forwardedRef,
    () => ({
      scrollToFrameArea: (frameNumber, area, options) => {
        const viewport = scrollViewportRef.current
        const slot = viewport?.querySelector<HTMLElement>(
          `[data-page-number="${frameNumber}"]`
        )
        if (!viewport || !slot) return
        const slotRect = slot.getBoundingClientRect()
        const viewportRect = viewport.getBoundingClientRect()
        const frameTop = slotRect.top - viewportRect.top + viewport.scrollTop
        const targetTop =
          frameTop + (area.top / 100) * slotRect.height - IMAGE_SCROLL_HEADROOM
        viewport.scrollTo({
          top: Math.max(0, targetTop),
          behavior: "smooth",
          ...options,
        })
      },
      getViewportElement: () => scrollViewportRef.current,
    }),
    []
  )

  const frameCount = source.frames.length
  const countLabel =
    source.kind === "tiff"
      ? `${frameCount} page${frameCount === 1 ? "" : "s"}`
      : `${frameCount} image${frameCount === 1 ? "" : "s"}`

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="image-viewer"
    >
      {/* Pecking order: toolbar spans the full width; below it the sidebar
          claims the full height and the header (legend) spans the main column. */}
      {toolbar ? (
        <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
          <span className="px-1 text-xs text-muted-foreground tabular-nums">
            {countLabel}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <IconButton label="Zoom out" onClick={() => zoom(1 / 1.2)}>
              <Minus />
            </IconButton>
            <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
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
          <div data-slot="image-viewer-aside" className="flex-shrink-0">
            {aside}
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {header ? <div data-slot="image-viewer-header">{header}</div> : null}
          <ScrollArea
            className="min-h-0 flex-1"
            viewportRef={scrollViewportRef}
            viewportProps={
              onVisiblePageChange || onScrollProgressChange
                ? { onScroll: handleScroll }
                : undefined
            }
          >
            <div
              ref={containerRef}
              className="flex flex-col items-center gap-4 p-4"
            >
              {source.frames.map((frame, i) => (
                <ImageFrame
                  key={i}
                  source={source}
                  index={i}
                  frame={frame}
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

function ImageFrame({
  source,
  index,
  frame,
  scale,
  rotation,
  renderOverlay,
}: {
  source: ImageSource
  index: number
  frame: FrameMeta
  scale: number
  rotation: number
  renderOverlay?: (props: ImagePageOverlayProps) => React.ReactNode
}) {
  const [inView, setInView] = React.useState(false)

  // Lazily mount the canvas only when the frame nears the viewport. The wrapper
  // is always sized from the frame's intrinsic dimensions, so scroll height and
  // overlay coordinates are correct whether or not the pixels are decoded yet.
  const wrapperRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    // Derive the scroll container from the DOM rather than a React ref: ref
    // callbacks fire children-first, so a parent ref isn't populated yet on the
    // first mount. closest() reads the live DOM and is always correct.
    const root = el.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting)
      },
      // Generous margin: decode a screen ahead/behind so scrolling stays ahead
      // of the decode, but no further (keeps the decoded-bitmap set small).
      { root, rootMargin: "150% 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Rotation swaps the box for 90°/270°.
  const rotated = rotation === 90 || rotation === 270
  const renderedW = (rotated ? frame.height : frame.width) * scale
  const renderedH = (rotated ? frame.width : frame.height) * scale

  return (
    <div
      ref={wrapperRef}
      className="relative shadow-sm ring-1 ring-border"
      style={{ width: renderedW, height: renderedH }}
      data-slot="image-frame"
      data-page={index + 1}
      data-page-number={index + 1}
    >
      {inView ? (
        <FrameCanvas
          source={source}
          index={index}
          frame={frame}
          scale={scale}
          rotation={rotation}
        />
      ) : (
        // A plain gray block fills the frame box (already sized to the image),
        // so the skeleton is exactly the size of the image it stands in for.
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
      {renderOverlay ? (
        <div className="pointer-events-none absolute inset-0">
          {renderOverlay({
            pageNumber: index + 1,
            width: renderedW,
            height: renderedH,
            scale,
            rotation,
          })}
        </div>
      ) : null}
    </div>
  )
}

function FrameCanvas({
  source,
  index,
  frame,
  scale,
  rotation,
}: {
  source: ImageSource
  index: number
  frame: FrameMeta
  scale: number
  rotation: number
}) {
  const dpr = (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1
  const rotated = rotation === 90 || rotation === 270
  const cssW = (rotated ? frame.height : frame.width) * scale
  const cssH = (rotated ? frame.width : frame.height) * scale

  // Acquire the bitmap (decoded off-thread by createImageBitmap), draw it into a
  // DPR-scaled canvas, and release the frame on cleanup so it can be evicted.
  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      canvas.width = Math.max(1, Math.floor(cssW * dpr))
      canvas.height = Math.max(1, Math.floor(cssH * dpr))
      let cancelled = false
      source.acquire(index).then((bitmap) => {
        if (cancelled) return
        ctx.save()
        ctx.scale(dpr, dpr)
        // Rotate about the canvas center, then draw the frame at native scale.
        ctx.translate(cssW / 2, cssH / 2)
        ctx.rotate((rotation * Math.PI) / 180)
        const drawW = frame.width * scale
        const drawH = frame.height * scale
        ctx.imageSmoothingQuality = "high"
        ctx.drawImage(bitmap, -drawW / 2, -drawH / 2, drawW, drawH)
        ctx.restore()
      })
      return () => {
        cancelled = true
        source.release(index)
      }
    },
    [source, index, frame.width, frame.height, scale, rotation, cssW, cssH, dpr]
  )

  return (
    <canvas
      ref={canvasRef}
      style={{ width: cssW, height: cssH }}
      className="block bg-white"
    />
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

// Shown before the client component mounts (SSR/pre-hydration). Same chrome as
// the loaded viewer — a toolbar with skeletoned values plus a frame-shaped
// skeleton — so the top bar is always present and nothing jumps when the real
// image fades in.
function ImageViewerFallback({
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
      data-slot="image-viewer"
    >
      <ImageToolbarSkeleton />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col items-center p-4">
          <ImageFrameSkeleton />
        </div>
      </div>
    </div>
  )
}

// A static mirror of the real toolbar: the two undetermined values (frame count,
// zoom %) are skeletons; the controls are present but inert.
function ImageToolbarSkeleton() {
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
        <ToolbarIconPlaceholder>
          <RotateCw />
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

// An image-shaped skeleton stands in for the frame before it is measured (the
// SSR fallback and the image-load suspense). The real frame's aspect is unknown
// until it loads, so a neutral 4:3 placeholder fills the container width; the
// measured frame replaces it once decoded.
function ImageFrameSkeleton() {
  return (
    <Skeleton aria-hidden className="w-full" style={{ aspectRatio: "4 / 3" }} />
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

class ImageErrorBoundary extends React.Component<
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
          Couldn&apos;t load this image.
        </div>
      )
    }
    return this.props.children
  }
}
