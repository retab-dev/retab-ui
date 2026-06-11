"use client"

import * as React from "react"
import { Download, Maximize, Minus, Plus, RotateCw } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"

// utif ships no types — declare the slice of the API we use. It decodes
// multi-page TIFFs (the IFD list) that browsers can't decode natively.
type Ifd = { t256?: number[]; t257?: number[]; width?: number; height?: number }
interface Utif {
  decode(buf: ArrayBuffer | Uint8Array): Ifd[]
  decodeImage(buf: ArrayBuffer | Uint8Array, ifd: Ifd): void
  toRGBA8(ifd: Ifd): Uint8Array
}

// utif touches no browser globals, but it's only needed on the TIFF path, so we
// load it lazily and only once.
let utifPromise: Promise<Utif> | null = null
function loadUtif(): Promise<Utif> {
  if (!utifPromise) {
    utifPromise = import(
      // @ts-expect-error utif ships no type declarations; typed via the Utif interface.
      "utif"
    ).then((m) => (m.default ?? m) as unknown as Utif)
  }
  return utifPromise
}

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
    const UTIF = await loadUtif()
    const ifds = UTIF.decode(buf)
    if (ifds.length === 0) throw new Error("TIFF has no frames")
    const frames: FrameMeta[] = ifds.map((ifd) => ({
      width: ifd.t256?.[0] ?? ifd.width ?? 0,
      height: ifd.t257?.[0] ?? ifd.height ?? 0,
    }))
    return createSource("tiff", frames, async (i) => {
      const ifd = ifds[i]
      // decodeImage mutates the ifd in place; toRGBA8 reads from it.
      UTIF.decodeImage(buf, ifd)
      const rgba = UTIF.toRGBA8(ifd)
      const w = ifd.width ?? frames[i].width
      const h = ifd.height ?? frames[i].height
      // Copy into a fresh ArrayBuffer-backed clamped array (utif may hand back a
      // view, and ImageData rejects SharedArrayBuffer-backed buffers).
      const data = new ImageData(new Uint8ClampedArray(rgba), w, h)
      return createImageBitmap(data)
    })
  }

  // Plain image: let the browser decode it natively (off-main-thread via
  // createImageBitmap). One probe gives us the intrinsic size for layout.
  const blob = new Blob([buf], { type: contentType ?? "" })
  const probe = await createImageBitmap(blob)
  const frames: FrameMeta[] = [{ width: probe.width, height: probe.height }]
  probe.close()
  return createSource("image", frames, () => createImageBitmap(blob))
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

export function ImageViewer(props: ImageViewerProps) {
  const isClient = useIsClient()
  if (!isClient) {
    return <ImageViewerFallback className={props.className} bare={props.bare} />
  }
  return (
    <ImageErrorBoundary className={props.className}>
      <React.Suspense
        fallback={<ImageViewerFallback className={props.className} bare={props.bare} />}
      >
        <ImageViewerInner {...props} />
      </React.Suspense>
    </ImageErrorBoundary>
  )
}

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
}: ImageViewerProps) {
  const source = React.use(getImageSource(src))
  const baseWidth = source.frames[0]?.width || 1

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

  // Report the frame nearest the top of the scroll viewport as the user scrolls.
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
    setManualScale(clamp(scale * factor, 0.25, 8))

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
            <div ref={containerRef} className="flex flex-col items-center gap-4 p-4">
              {source.frames.map((frame, i) => (
                <ImageFrame
                  key={i}
                  source={source}
                  index={i}
                  frame={frame}
                  scale={scale}
                  rotation={rotation}
                  scrollViewportRef={scrollViewportRef}
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
  scrollViewportRef,
  renderOverlay,
}: {
  source: ImageSource
  index: number
  frame: FrameMeta
  scale: number
  rotation: number
  scrollViewportRef: React.RefObject<HTMLDivElement | null>
  renderOverlay?: (props: ImagePageOverlayProps) => React.ReactNode
}) {
  const [inView, setInView] = React.useState(false)

  // Lazily mount the canvas only when the frame nears the viewport. The wrapper
  // is always sized from the frame's intrinsic dimensions, so scroll height and
  // overlay coordinates are correct whether or not the pixels are decoded yet.
  const wrapperRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return
      const root = scrollViewportRef.current ?? null
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
    },
    [scrollViewportRef]
  )

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
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <Spinner className="size-4 text-muted-foreground" />
        </div>
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
  const dpr =
    (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1
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
