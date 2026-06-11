"use client"

import * as React from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import type * as PptxNS from "pptxviewjs"
import type * as DocxPreview from "docx-preview"

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

export type DocumentKind = "pdf" | "docx" | "xlsx" | "pptx" | "image"

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
  if (!isClient) return <ShimmerLayer />
  return (
    <ThumbnailErrorBoundary fallback={null}>
      <React.Suspense fallback={<ShimmerLayer />}>
        <FirstUnit src={src} kind={kind} />
      </React.Suspense>
    </ThumbnailErrorBoundary>
  )
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
  return null
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

let xlsxLib: Promise<typeof import("@e965/xlsx")> | null = null
function loadXlsx() {
  if (!xlsxLib) xlsxLib = import("@e965/xlsx")
  return xlsxLib
}

const xlsxCache = new Map<string, Promise<XlsxPreview>>()
function getXlsxPreview(src: string): Promise<XlsxPreview> {
  let promise = xlsxCache.get(src)
  if (!promise) {
    promise = (async () => {
      const [res, XLSX] = await Promise.all([fetch(src), loadXlsx()])
      if (!res.ok) throw new Error(`Failed to load spreadsheet: ${res.status}`)
      const buf = await res.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const grid = XLSX.utils.sheet_to_json<string[]>(ws, {
        header: 1,
        blankrows: false,
        defval: "",
        raw: false,
      })
      const rows = grid
        .slice(0, 16)
        .map((r) => (Array.isArray(r) ? r.slice(0, 6).map((c) => `${c ?? ""}`) : []))
      return { rows }
    })()
    xlsxCache.set(src, promise)
  }
  return promise
}

function XlsxFirstSheet({ src }: { src: string }) {
  const { rows } = React.use(getXlsxPreview(src))
  const colCount = Math.max(1, ...rows.map((r) => r.length))
  // Top-left aligned and full-width so the sheet fills the frame; rows past the
  // bottom edge are clipped, matching a real spreadsheet thumbnail.
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <table className="w-full border-collapse text-[7px] leading-tight">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {Array.from({ length: colCount }, (_, c) => (
                <td
                  key={c}
                  className="text-foreground/80 max-w-[64px] truncate border border-slate-200 px-1 py-[2px]"
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
    promise = (async () => {
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
    })()
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
    promise = fetch(src).then((res) => {
      if (!res.ok) throw new Error(`Failed to load DOCX: ${res.status}`)
      return res.arrayBuffer()
    })
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
      void (async () => {
        const docx = await loadDocxPreview()
        if (!active) return
        el.innerHTML = ""
        await docx.renderAsync(bytes.slice(0), el, undefined, {
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          experimental: true,
        })
      })()
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
