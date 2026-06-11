"use client"

import * as React from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import type * as PptxNS from "pptxviewjs"
import type * as DocxPreview from "docx-preview"

import { cn } from "@/lib/utils"
import { FileThumbnail } from "@/components/ui/file-thumbnail"
import { getDocumentResource, getPageResource } from "@/components/ui/pdf-viewer"

/**
 * Generates a *first-unit* thumbnail for a document — page 1, first sheet, or
 * first slide — using the same standard libraries the Retab viewers use
 * (pdfjs-dist, @e965/xlsx, pptxviewjs, docx-preview), then drops it into the
 * dependency-free `FileThumbnail` shell.
 *
 * Unlike embedding a full viewer, this renders ONLY the first unit: no scrolling
 * pages, no sheet tabs, no toolbar. Each renderer suspends while it loads (the
 * shell shows a shimmer) and is wrapped in an error boundary so a failed parse
 * degrades to the muted fallback surface instead of crashing.
 */

export type DocumentKind =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "image"
  | "tiff"
  | "csv"
  | "markdown"
  | "html"
  | "text"

export interface DocumentThumbnailProps {
  src: string
  name: string
  type: string
  kind: DocumentKind
  className?: string
  previewAspectRatio?: number
}

export function DocumentThumbnail({
  src,
  name,
  type,
  kind,
  className,
  previewAspectRatio = 3 / 4,
}: DocumentThumbnailProps) {
  if (kind === "image") {
    return (
      <FileThumbnail
        file={{ name, type }}
        previewImageUrl={src}
        previewAspectRatio={previewAspectRatio}
        className={className}
        // Fill the frame top-aligned (like a rendered page) instead of cropping
        // to the middle, matching the document renderers below.
        previewClassName="object-top"
      />
    )
  }

  return (
    <FileThumbnail
      file={{ name, type }}
      previewAspectRatio={previewAspectRatio}
      className={className}
      previewContent={<ClientPreview src={src} kind={kind} />}
    />
  )
}

/**
 * Gate first-unit rendering to the client: pdfjs/pptxviewjs/docx-preview touch
 * `document` (and the xlsx parse uses a Worker), none of which exist during SSR.
 * On the server we render the shimmer; the real renderer mounts after hydration.
 */
function ClientPreview({ src, kind }: { src: string; kind: DocumentKind }) {
  const isClient = useIsClient()
  const inView = useInView()

  return (
    <div ref={inView.ref} className="absolute inset-0">
      {isClient && inView.seen ? (
        <ThumbnailErrorBoundary fallback={null}>
          <React.Suspense fallback={<ShimmerLayer />}>
            <FirstUnit src={src} kind={kind} />
          </React.Suspense>
        </ThumbnailErrorBoundary>
      ) : (
        <ShimmerLayer />
      )}
    </div>
  )
}

/**
 * Defer all of a thumbnail's work — the dynamic `import()`, the fetch, and the
 * decode — until it scrolls near the viewport. A document list with hundreds of
 * rows then only ever does work for what's on screen. `rootMargin` warms tiles
 * just before they appear so there's no visible pop-in.
 */
function useInView() {
  const [seen, setSeen] = React.useState(false)
  const seenRef = React.useRef(false)
  const ref = React.useCallback((el: HTMLElement | null) => {
    if (!el || seenRef.current) return
    if (typeof IntersectionObserver === "undefined") {
      seenRef.current = true
      setSeen(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          seenRef.current = true
          setSeen(true)
          observer.disconnect()
        }
      },
      { rootMargin: "300px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, seen }
}

function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

function FirstUnit({ src, kind }: { src: string; kind: DocumentKind }) {
  if (kind === "pdf") return <PdfFirstPage src={src} />
  if (kind === "xlsx") return <XlsxFirstSheet src={src} />
  if (kind === "pptx") return <PptxFirstSlide src={src} />
  if (kind === "docx") return <DocxFirstPage src={src} />
  if (kind === "tiff") return <TiffFirstPage src={src} />
  if (kind === "csv") return <CsvFirstRows src={src} />
  if (kind === "markdown") return <MarkdownFirstPage src={src} />
  if (kind === "html") return <HtmlFirstPage src={src} />
  if (kind === "text") return <TextFirstLines src={src} />
  return null
}

// ---------------------------------------------------------------------------
// Shared: fetch a document's text/bytes once and cache the promise so the
// Suspense `use()` reads are stable across re-renders.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Concurrency gate — every renderer parses a heavy library and does synchronous
// CPU work (UTIF decode, XLSX parse, canvas paint), all on the main thread. A
// grid of thumbnails that mounts at once would fire these in a single burst and
// jank the page. Cap how many heavy decodes run concurrently; the rest queue
// and start as slots free, spreading the work across frames.
// ---------------------------------------------------------------------------

const MAX_CONCURRENT_DECODES = 3
let activeDecodes = 0
const decodeQueue: Array<() => void> = []

function acquireDecodeSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    const grant = () => {
      activeDecodes++
      let released = false
      resolve(() => {
        if (released) return
        released = true
        activeDecodes--
        decodeQueue.shift()?.()
      })
    }
    if (activeDecodes < MAX_CONCURRENT_DECODES) grant()
    else decodeQueue.push(grant)
  })
}

/** Run `fn` once a decode slot is free, always releasing it afterward. */
async function withDecodeSlot<T>(fn: () => Promise<T>): Promise<T> {
  const release = await acquireDecodeSlot()
  try {
    return await fn()
  } finally {
    release()
  }
}

/**
 * Profiling helper — logs `[thumb] <label> <ms>` when enabled. Gated on a global
 * so it costs nothing in normal use; the profiler sets it before navigation.
 */
async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const on =
    typeof globalThis !== "undefined" &&
    (globalThis as { __THUMB_PROFILE__?: boolean }).__THUMB_PROFILE__
  if (!on) return fn()
  const t0 = performance.now()
  try {
    return await fn()
  } finally {
    // eslint-disable-next-line no-console
    console.log(`[thumb] ${label} ${(performance.now() - t0).toFixed(1)}ms`)
  }
}

// A thumbnail only shows the head of a text document, so cap the download with
// a Range request — a 40 MB log costs the same as a small one. Servers that
// ignore Range just return the whole body (200), which still works.
const TEXT_HEAD_BYTES = 64 * 1024

const textCache = new Map<string, Promise<string>>()
function getText(src: string): Promise<string> {
  let p = textCache.get(src)
  if (!p) {
    p = timed(`text:fetch ${shortName(src)}`, async () => {
      const res = await fetch(src, {
        headers: { Range: `bytes=0-${TEXT_HEAD_BYTES - 1}` },
      })
      if (!res.ok) throw new Error(`Failed to load ${src}: ${res.status}`)
      return res.text()
    })
    textCache.set(src, p)
  }
  return p
}

function shortName(src: string): string {
  return src.split("/").pop() ?? src
}

/** Centered, clipped white surface that hosts a rendered first unit. */
function Surface({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-white">
      {children}
    </div>
  )
}

function ShimmerLayer() {
  return <div aria-hidden className="bg-muted absolute inset-0 animate-pulse" />
}

// ---------------------------------------------------------------------------
// PDF — page 1 via pdfjs (reuses the PdfViewer's cached document)
// ---------------------------------------------------------------------------

function PdfFirstPage({ src }: { src: string }) {
  const doc = React.use(getDocumentResource(src)) as PDFDocumentProxy
  const page = React.use(getPageResource(doc, 1))

  const RENDER_W = 520
  const viewport = React.useMemo(() => {
    const base = page.getViewport({ scale: 1 })
    return page.getViewport({ scale: RENDER_W / base.width })
  }, [page])
  const dpr =
    (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1

  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      const context = canvas.getContext("2d")
      if (!context) return
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      const task = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      })
      task.promise.catch(() => {})
      return () => task.cancel()
    },
    [page, viewport, dpr]
  )

  // Fill the frame width and top-align; the bottom of the page is clipped by
  // the square frame (object-top behavior), so the preview is full-bleed.
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <canvas ref={canvasRef} className="block w-full" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// XLSX — first sheet, top-left cells, as a compact static grid (@e965/xlsx)
// ---------------------------------------------------------------------------

interface XlsxPreview {
  rows: string[][]
}

const XLSX_MAX_ROWS = 16
const XLSX_MAX_COLS = 6

interface XlsxWorkerReply {
  id: number
  ok: boolean
  rows?: string[][]
  error?: string
}

let xlsxWorker: Worker | null = null
let xlsxReqId = 0
const xlsxPending = new Map<
  number,
  { resolve: (r: string[][]) => void; reject: (e: Error) => void }
>()

function getXlsxWorker(): Worker {
  if (!xlsxWorker) {
    xlsxWorker = new Worker(
      new URL("./document-thumbnail-xlsx.worker", import.meta.url)
    )
    xlsxWorker.onmessage = (e: MessageEvent<XlsxWorkerReply>) => {
      const { id, ok, rows, error } = e.data
      const entry = xlsxPending.get(id)
      if (!entry) return
      xlsxPending.delete(id)
      if (ok && rows) entry.resolve(rows)
      else entry.reject(new Error(error ?? "XLSX parse failed"))
    }
  }
  return xlsxWorker
}

function parseXlsxInWorker(buffer: ArrayBuffer): Promise<string[][]> {
  const worker = getXlsxWorker()
  const id = ++xlsxReqId
  return new Promise<string[][]>((resolve, reject) => {
    xlsxPending.set(id, { resolve, reject })
    worker.postMessage(
      { id, buffer, maxRows: XLSX_MAX_ROWS, maxCols: XLSX_MAX_COLS },
      [buffer]
    )
  })
}

const xlsxCache = new Map<string, Promise<XlsxPreview>>()
function getXlsxPreview(src: string): Promise<XlsxPreview> {
  let promise = xlsxCache.get(src)
  if (!promise) {
    promise = withDecodeSlot(() =>
      timed(`xlsx:total ${shortName(src)}`, async () => {
        const res = await fetch(src)
        if (!res.ok) throw new Error(`Failed to load spreadsheet: ${res.status}`)
        const buf = await res.arrayBuffer()
        // XLSX.read is synchronous CPU — parse it in the worker, off the UI thread.
        const rows = await timed("xlsx:worker-parse", () => parseXlsxInWorker(buf))
        return { rows }
      })
    )
    xlsxCache.set(src, promise)
  }
  return promise
}

function XlsxFirstSheet({ src }: { src: string }) {
  const { rows } = React.use(getXlsxPreview(src))
  // Top-left aligned and full-width so the sheet fills the frame; rows past the
  // bottom edge are clipped, matching a real spreadsheet thumbnail. Only inner
  // gridlines are drawn so the frame's own border stays the single outer edge.
  return <GridTable rows={rows} />
}

// ---------------------------------------------------------------------------
// PPTX — slide 1 via pptxviewjs renderSlide (no full viewer, no scroll)
// ---------------------------------------------------------------------------

let pptxLib: Promise<typeof PptxNS> | null = null
function loadPptx() {
  if (!pptxLib) pptxLib = import("pptxviewjs")
  return pptxLib
}

interface PptxFirstSlideSource {
  render: (canvas: HTMLCanvasElement, scale: number) => Promise<void>
  baseWidth: number
  baseHeight: number
}

const pptxCache = new Map<string, Promise<PptxFirstSlideSource>>()
function getPptxFirstSlide(src: string): Promise<PptxFirstSlideSource> {
  let promise = pptxCache.get(src)
  if (!promise) {
    promise = withDecodeSlot(() => timed(`pptx:total ${shortName(src)}`, async () => {
      const [res, mod] = await Promise.all([fetch(src), loadPptx()])
      if (!res.ok) throw new Error(`Failed to load presentation: ${res.status}`)
      const buf = await res.arrayBuffer()
      const { PPTXViewer } = mod
      const offscreen = document.createElement("canvas")
      const viewer = new PPTXViewer({ canvas: offscreen, slideSizeMode: "actual" })
      await viewer.loadFile(buf)
      const size = await readSlideSize(buf.slice(0))
      const render = async (canvas: HTMLCanvasElement, scale: number) => {
        await viewer.renderSlide(0, canvas, { scale, quality: "high" })
      }
      return { render, baseWidth: size.width, baseHeight: size.height }
    }))
    pptxCache.set(src, promise)
  }
  return promise
}

const EMU_PER_PX = 9525
async function readSlideSize(buf: ArrayBuffer) {
  try {
    const mod = (await import("jszip")) as unknown as {
      default?: { loadAsync(b: ArrayBuffer): Promise<JSZipLike> }
      loadAsync?: (b: ArrayBuffer) => Promise<JSZipLike>
    }
    const JSZip = (mod.default ?? mod) as {
      loadAsync(b: ArrayBuffer): Promise<JSZipLike>
    }
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
    /* fall through */
  }
  return { width: 960, height: 720 }
}

interface JSZipLike {
  file(path: string): { async(type: "string"): Promise<string> } | null
}

function PptxFirstSlide({ src }: { src: string }) {
  const source = React.use(getPptxFirstSlide(src))
  const RENDER_W = 640
  const scale = RENDER_W / (source.baseWidth || 960)

  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      let cancelled = false
      source.render(canvas, scale).catch(() => {})
      return () => {
        cancelled = true
        void cancelled
      }
    },
    [source, scale]
  )

  return (
    <Surface>
      <canvas
        ref={canvasRef}
        className="block max-h-full max-w-full shadow-sm"
        style={{ aspectRatio: `${source.baseWidth} / ${source.baseHeight}` }}
      />
    </Surface>
  )
}

// ---------------------------------------------------------------------------
// DOCX — first page via docx-preview (ArrayBuffer input avoids the FileReader
// path), scaled to fit the frame width, clipped to the first page.
// ---------------------------------------------------------------------------

let docxLib: Promise<typeof DocxPreview> | null = null
function loadDocxPreview() {
  if (!docxLib) docxLib = import("docx-preview")
  return docxLib
}

const docxCache = new Map<string, Promise<ArrayBuffer>>()
function getDocxBytes(src: string): Promise<ArrayBuffer> {
  let promise = docxCache.get(src)
  if (!promise) {
    promise = timed(`docx:fetch ${shortName(src)}`, () =>
      fetch(src).then((res) => {
        if (!res.ok) throw new Error(`Failed to load DOCX: ${res.status}`)
        return res.arrayBuffer()
      })
    )
    docxCache.set(src, promise)
  }
  return promise
}

const DOCX_PAGE_W = 816 // US Letter at 96dpi

function DocxFirstPage({ src }: { src: string }) {
  const bytes = React.use(getDocxBytes(src))
  const [frameWidth, setFrameWidth] = React.useState<number | null>(null)

  // Measure the frame so we can scale the natural-size page down to fit.
  const frameRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    setFrameWidth(el.clientWidth)
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setFrameWidth(w)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Render docx-preview into the container once it mounts.
  const renderRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return
      let active = true
      void withDecodeSlot(() =>
        timed(`docx:render ${shortName(src)}`, async () => {
          // Cancelled while queued for a slot — skip the work entirely.
          if (!active) return
          const docx = await loadDocxPreview()
          if (!active) return
          el.innerHTML = ""
          await docx.renderAsync(bytes.slice(0), el, undefined, {
            inWrapper: true,
            breakPages: true,
            ignoreLastRenderedPageBreak: false,
            experimental: true,
          })
        })
      )
      return () => {
        active = false
      }
    },
    [bytes]
  )

  const scale = frameWidth ? frameWidth / DOCX_PAGE_W : null

  return (
    <Surface>
      <div ref={frameRef} className="absolute inset-0 overflow-hidden bg-white">
        <div
          className="absolute top-0 left-0 origin-top-left [&_.docx-wrapper]:!bg-transparent [&_.docx-wrapper]:!p-0 [&_section.docx]:!mb-0 [&_section.docx]:!shadow-none"
          style={{
            width: DOCX_PAGE_W,
            transform: scale ? `scale(${scale})` : undefined,
            visibility: scale ? "visible" : "hidden",
          }}
        >
          <div ref={renderRef} />
        </div>
      </div>
    </Surface>
  )
}

// ---------------------------------------------------------------------------
// TIFF — first page via UTIF, decoded + downscaled + encoded inside a Web Worker
// so none of that synchronous CPU touches the UI thread. A single persistent
// worker (UTIF loaded once) serves every TIFF request by id; the concurrency
// gate already bounds how many are in flight.
// ---------------------------------------------------------------------------

// Target raster width for the decoded TIFF page. The tile is ~90–140px on
// screen; rendering at 2× keeps it crisp without encoding a full-res scan.
const TIFF_TARGET_W = 320

interface TiffWorkerReply {
  id: number
  ok: boolean
  blob?: Blob
  error?: string
}

let tiffWorker: Worker | null = null
let tiffReqId = 0
const tiffPending = new Map<number, { resolve: (b: Blob) => void; reject: (e: Error) => void }>()

function getTiffWorker(): Worker {
  if (!tiffWorker) {
    tiffWorker = new Worker(
      new URL("./document-thumbnail-tiff.worker", import.meta.url)
    )
    tiffWorker.onmessage = (e: MessageEvent<TiffWorkerReply>) => {
      const { id, ok, blob, error } = e.data
      const entry = tiffPending.get(id)
      if (!entry) return
      tiffPending.delete(id)
      if (ok && blob) entry.resolve(blob)
      else entry.reject(new Error(error ?? "TIFF decode failed"))
    }
  }
  return tiffWorker
}

function decodeTiffInWorker(buffer: ArrayBuffer): Promise<Blob> {
  const worker = getTiffWorker()
  const id = ++tiffReqId
  return new Promise<Blob>((resolve, reject) => {
    tiffPending.set(id, { resolve, reject })
    // Transfer the bytes so they aren't copied onto the worker heap.
    worker.postMessage({ id, buffer, targetWidth: TIFF_TARGET_W }, [buffer])
  })
}

const tiffCache = new Map<string, Promise<string>>()
function getTiffFirstPage(src: string): Promise<string> {
  let p = tiffCache.get(src)
  if (!p) {
    p = withDecodeSlot(() =>
      timed(`tiff:total ${shortName(src)}`, async () => {
        const buf = await timed("tiff:fetch", () =>
          fetch(src).then((r) => {
            if (!r.ok) throw new Error(`Failed to load TIFF: ${r.status}`)
            return r.arrayBuffer()
          })
        )
        // decode + downscale + encode all happen in the worker, off the UI thread.
        const blob = await timed("tiff:worker-decode", () => decodeTiffInWorker(buf))
        return URL.createObjectURL(blob)
      })
    )
    tiffCache.set(src, p)
  }
  return p
}

function TiffFirstPage({ src }: { src: string }) {
  const url = React.use(getTiffFirstPage(src))
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="block w-full" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// CSV — first rows as a compact grid (naive split; good enough for a preview).
// ---------------------------------------------------------------------------

function CsvFirstRows({ src }: { src: string }) {
  const raw = React.use(getText(src))
  const rows = React.useMemo(
    () =>
      raw
        .split(/\r?\n/)
        .filter((l) => l.length > 0)
        .slice(0, 16)
        .map((l) => l.split(",").slice(0, 6)),
    [raw]
  )
  return <GridTable rows={rows} headerRow />
}

/** Internal-gridline table shared by the XLSX and CSV previews. */
function GridTable({ rows, headerRow }: { rows: string[][]; headerRow?: boolean }) {
  const colCount = Math.max(1, ...rows.map((r) => r.length))
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <table className="w-full border-collapse text-[7px] leading-tight">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {Array.from({ length: colCount }, (_, c) => (
                <td
                  key={c}
                  className={cn(
                    "max-w-[64px] truncate border-r border-b border-slate-200 px-1 py-[2px] last:border-r-0",
                    headerRow && r === 0
                      ? "text-foreground bg-slate-50 font-semibold"
                      : "text-foreground/80"
                  )}
                >
                  {row[c] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Markdown & HTML — rendered into a sandboxed iframe sized to a fixed page
// width, then scaled to the frame so the top of the document fills the tile.
// ---------------------------------------------------------------------------

let mdLibs: Promise<
  [typeof import("marked"), typeof import("dompurify")]
> | null = null
function loadMarkdown() {
  if (!mdLibs) mdLibs = Promise.all([import("marked"), import("dompurify")])
  return mdLibs
}

const markdownCache = new Map<string, Promise<string>>()
function getMarkdownDoc(src: string): Promise<string> {
  let p = markdownCache.get(src)
  if (!p) {
    p = timed(`markdown:total ${shortName(src)}`, async () => {
      const [text, [{ marked }, DOMPurifyMod]] = await Promise.all([
        getText(src),
        loadMarkdown(),
      ])
      const DOMPurify = (
        DOMPurifyMod as unknown as { default?: typeof DOMPurifyMod }
      ).default
      const sanitize = DOMPurify?.sanitize ?? (DOMPurifyMod as { sanitize: (s: string) => string }).sanitize
      const body = sanitize(await marked.parse(text))
      return `<!doctype html><html><head><meta charset="utf-8"><style>
        body{margin:0;padding:18px;font:14px/1.6 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;color:#0f172a}
        h1{font-size:1.6em;margin:.1em 0 .5em;border-bottom:1px solid #e2e8f0;padding-bottom:.25em}
        h2{font-size:1.3em;margin:1em 0 .4em;border-bottom:1px solid #e2e8f0;padding-bottom:.25em}
        h3{font-size:1.1em;margin:1em 0 .3em}
        p,ul,ol{margin:0 0 .8em}ul,ol{padding-left:1.4em}
        code{font-family:ui-monospace,SFMono-Regular,monospace;background:#f1f5f9;padding:.1em .35em;border-radius:4px;font-size:.85em}
        pre{background:#f1f5f9;padding:12px;border-radius:8px;overflow:hidden}pre code{background:none;padding:0}
        table{border-collapse:collapse;width:100%}td,th{border:1px solid #e2e8f0;padding:4px 8px;text-align:left}
        a{color:#4f46e5}blockquote{margin:0 0 .8em;padding-left:12px;border-left:3px solid #e2e8f0;color:#475569}
      </style></head><body>${body}</body></html>`
    })
    markdownCache.set(src, p)
  }
  return p
}

function MarkdownFirstPage({ src }: { src: string }) {
  const html = React.use(getMarkdownDoc(src))
  return <IframeDoc html={html} />
}

function HtmlFirstPage({ src }: { src: string }) {
  const html = React.use(getText(src))
  return <IframeDoc html={html} />
}

/**
 * Renders an HTML string into a fixed-size (square) sandboxed iframe and scales
 * it to the measured frame width, so the top of the page fills the tile. The
 * iframe is inert (no scripts, no pointer events).
 */
function IframeDoc({ html }: { html: string }) {
  const [frameWidth, setFrameWidth] = React.useState<number | null>(null)
  const ref = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    setFrameWidth(el.clientWidth)
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setFrameWidth(w)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const BASE = 820
  const scale = frameWidth ? frameWidth / BASE : null

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden bg-white">
      <iframe
        srcDoc={html}
        title=""
        sandbox=""
        scrolling="no"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none origin-top-left border-0"
        style={{
          width: BASE,
          height: BASE,
          transform: scale ? `scale(${scale})` : undefined,
          visibility: scale ? "visible" : "hidden",
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Text / code / JSON / log — first lines in a mini code surface with a gutter.
// ---------------------------------------------------------------------------

function TextFirstLines({ src }: { src: string }) {
  const raw = React.use(getText(src))
  const text = React.useMemo(() => {
    if (/\.(json|json5|ndjson|jsonl)$/i.test(src)) {
      try {
        return JSON.stringify(JSON.parse(raw), null, 2)
      } catch {
        /* not strict JSON — show as-is */
      }
    }
    return raw
  }, [raw, src])

  const lines = React.useMemo(
    () => text.replace(/\n$/, "").split("\n").slice(0, 34),
    [text]
  )

  return (
    <div className="bg-card absolute inset-0 overflow-hidden">
      <div className="font-mono text-[6px] leading-[1.7]">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="w-[16px] shrink-0 bg-slate-50 pr-[3px] text-right text-slate-300 select-none">
              {i + 1}
            </span>
            <span className="text-foreground/80 whitespace-pre pl-[5px]">
              {line || " "}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error boundary — a failed parse degrades to FileThumbnail's fallback surface.
// ---------------------------------------------------------------------------

class ThumbnailErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) {
      // `null` lets FileThumbnail fall through to its own muted fallback surface.
      return this.props.fallback
    }
    return this.props.children
  }
}
