"use client"

import * as React from "react"
import { Download } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
// Type-only — erased at compile time; the sanitizer loads lazily at runtime.
import type * as DOMPurifyNS from "dompurify"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

// Heavy, format-specific viewers are code-split: only the one matching the file
// is ever fetched. Each is a thin client component that lazy-loads its own parser
// (pdfjs, mammoth, pptxviewjs, SheetJS, utif) internally.
const PdfViewer = React.lazy(() =>
  import("@/components/ui/pdf-viewer").then((m) => ({ default: m.PdfViewer }))
)
const DocxViewer = React.lazy(() =>
  import("@/components/ui/docx-viewer").then((m) => ({ default: m.DocxViewer }))
)
const ImageViewer = React.lazy(() =>
  import("@/components/ui/image-viewer").then((m) => ({ default: m.ImageViewer }))
)
const PptxViewer = React.lazy(() =>
  import("@/components/ui/pptx-viewer").then((m) => ({ default: m.PptxViewer }))
)
const XlsxViewer = React.lazy(() =>
  import("@/components/ui/xlsx-viewer").then((m) => ({ default: m.XlsxViewer }))
)
const CsvViewer = React.lazy(() =>
  import("@/components/ui/csv-viewer").then((m) => ({ default: m.CsvViewer }))
)

// --- type detection ----------------------------------------------------------

export type FileCategory =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "csv"
  | "image"
  | "markdown"
  | "html"
  | "text"
  | "unsupported"

const EXTENSION_CATEGORY: Record<string, FileCategory> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  xls: "xlsx",
  xlsm: "xlsx",
  pptx: "pptx",
  csv: "csv",
  tsv: "csv",
  // images (incl. multi-page TIFF, handled by the image viewer)
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  bmp: "image",
  svg: "image",
  ico: "image",
  tif: "image",
  tiff: "image",
  // markup
  md: "markdown",
  markdown: "markdown",
  mdx: "markdown",
  html: "html",
  htm: "html",
  // text & code
  txt: "text",
  text: "text",
  log: "text",
  json: "text",
  jsonl: "text",
  json5: "text",
  ndjson: "text",
  xml: "text",
  yaml: "text",
  yml: "text",
  toml: "text",
  ini: "text",
  env: "text",
  js: "text",
  mjs: "text",
  cjs: "text",
  jsx: "text",
  ts: "text",
  tsx: "text",
  css: "text",
  scss: "text",
  less: "text",
  py: "text",
  rb: "text",
  go: "text",
  rs: "text",
  java: "text",
  kt: "text",
  c: "text",
  h: "text",
  cpp: "text",
  cc: "text",
  cs: "text",
  php: "text",
  sh: "text",
  bash: "text",
  zsh: "text",
  sql: "text",
  graphql: "text",
  proto: "text",
  lua: "text",
  r: "text",
  swift: "text",
  scala: "text",
  pl: "text",
  vue: "text",
  svelte: "text",
}

function categoryFromMime(mime: string): FileCategory | null {
  const m = mime.toLowerCase().split(";")[0].trim()
  if (m === "application/pdf") return "pdf"
  if (m.includes("wordprocessingml")) return "docx"
  if (m.includes("spreadsheet") || m.includes("ms-excel")) return "xlsx"
  if (m.includes("presentation") || m.includes("ms-powerpoint")) return "pptx"
  if (m === "text/csv" || m === "text/tab-separated-values") return "csv"
  if (m === "text/markdown") return "markdown"
  if (m === "text/html") return "html"
  if (m.startsWith("image/")) return "image"
  if (m === "application/json" || m === "application/xml") return "text"
  if (m.startsWith("text/")) return "text"
  return null
}

function extensionOf(name: string): string | null {
  const clean = name.split(/[?#]/)[0]
  const base = clean.split("/").pop() ?? clean
  const dot = base.lastIndexOf(".")
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : null
}

/** Resolve a file to a viewer category from its name/extension, then MIME type. */
export function detectCategory(
  fileName: string,
  mimeType?: string
): FileCategory {
  const ext = extensionOf(fileName)
  if (ext && EXTENSION_CATEGORY[ext]) return EXTENSION_CATEGORY[ext]
  if (mimeType) {
    const fromMime = categoryFromMime(mimeType)
    if (fromMime) return fromMime
  }
  return "unsupported"
}

// --- resource caches: stable promises so React `use()` can read them ---------

const textCache = new Map<string, Promise<string>>()
function getText(src: string): Promise<string> {
  let p = textCache.get(src)
  if (!p) {
    p = fetch(src).then((r) => {
      if (!r.ok) throw new Error(`Failed to load file: ${r.status}`)
      return r.text()
    })
    textCache.set(src, p)
  }
  return p
}

const blobCache = new Map<string, Promise<Blob>>()
function getBlob(src: string): Promise<Blob> {
  let p = blobCache.get(src)
  if (!p) {
    p = fetch(src).then((r) => {
      if (!r.ok) throw new Error(`Failed to load file: ${r.status}`)
      return r.blob()
    })
    blobCache.set(src, p)
  }
  return p
}

// DOMPurify, loaded once and configured to send links to a new tab. Markdown is
// rendered inline (for theme-perfect typography), so the HTML must be sanitized.
type Sanitizer = typeof DOMPurifyNS.default
let sanitizerPromise: Promise<Sanitizer> | null = null
function loadSanitizer() {
  if (!sanitizerPromise) {
    sanitizerPromise = import("dompurify").then((m) => {
      const DOMPurify = m.default
      DOMPurify.addHook("afterSanitizeAttributes", (node) => {
        if (node.tagName === "A" && node.getAttribute("href")) {
          node.setAttribute("target", "_blank")
          node.setAttribute("rel", "noopener noreferrer")
        }
      })
      return DOMPurify
    })
  }
  return sanitizerPromise
}

const markdownCache = new Map<string, Promise<string>>()
function getMarkdownHtml(src: string): Promise<string> {
  let p = markdownCache.get(src)
  if (!p) {
    p = Promise.all([getText(src), import("marked"), loadSanitizer()]).then(
      async ([text, { marked }, DOMPurify]) => {
        const dirty = String(await marked.parse(text, { gfm: true }))
        return DOMPurify.sanitize(dirty)
      }
    )
    markdownCache.set(src, p)
  }
  return p
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

export interface FileViewerProps {
  /** URL of the file (same-origin or CORS-enabled). */
  src: string
  /** File name, used for type detection and the download button. Falls back to `src`. */
  fileName?: string
  /** Optional MIME hint, used when the extension is missing or ambiguous. */
  mimeType?: string
  /** Force a category, bypassing detection. */
  as?: FileCategory
  className?: string
  /** Drop the outer border/background so the viewer fills its container. */
  bare?: boolean
}

export function FileViewer(props: FileViewerProps) {
  const isClient = useIsClient()
  if (!isClient) {
    return <ViewerFallback className={props.className} bare={props.bare} />
  }
  return (
    <FileErrorBoundary className={props.className}>
      <React.Suspense
        fallback={<ViewerFallback className={props.className} bare={props.bare} />}
      >
        <FileViewerInner {...props} />
      </React.Suspense>
    </FileErrorBoundary>
  )
}

function FileViewerInner({
  src,
  fileName,
  mimeType,
  as,
  className,
  bare = false,
}: FileViewerProps) {
  const name = fileName ?? src
  const category = as ?? detectCategory(name, mimeType)
  const download = fileName ?? extractName(src)

  switch (category) {
    case "pdf":
      return <PdfViewer src={src} className={className} bare={bare} downloadFileName={download} />
    case "docx":
      return <DocxViewer src={src} className={className} bare={bare} />
    case "image":
      return <ImageViewer src={src} className={className} bare={bare} downloadFileName={download} />
    case "pptx":
      return <PptxViewer src={src} className={className} bare={bare} downloadFileName={download} />
    case "xlsx":
      return <XlsxViewer src={src} className={className} bare={bare} downloadFileName={download} />
    case "csv":
      return <CsvFromUrl src={src} className={className} />
    case "markdown":
      return <MarkdownDocViewer src={src} fileName={download} className={className} bare={bare} />
    case "html":
      return <HtmlDocViewer src={src} fileName={download} className={className} bare={bare} />
    case "text":
      return <TextDocViewer src={src} fileName={download} className={className} bare={bare} />
    default:
      return <UnsupportedCard src={src} fileName={download} className={className} bare={bare} />
  }
}

// --- text / code / JSON viewer (virtualized) ---------------------------------

const TEXT_FONT = 12.5
const TEXT_LINE_HEIGHT = 20
const TEXT_CHAR_WIDTH = TEXT_FONT * 0.6 // monospace approximation

function TextDocViewer({
  src,
  fileName,
  className,
  bare,
}: {
  src: string
  fileName: string
  className?: string
  bare?: boolean
}) {
  const raw = React.use(getText(src))

  // Pretty-print JSON so it's readable regardless of how it was minified.
  const text = React.useMemo(() => {
    if (/\.(json|json5)$/i.test(fileName)) {
      try {
        return JSON.stringify(JSON.parse(raw), null, 2)
      } catch {
        /* not valid JSON — show as-is */
      }
    }
    return raw
  }, [raw, fileName])

  const lines = React.useMemo(() => text.replace(/\n$/, "").split("\n"), [text])
  const maxChars = React.useMemo(
    () => lines.reduce((m, l) => Math.max(m, l.length), 0),
    [lines]
  )

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => TEXT_LINE_HEIGHT,
    overscan: 16,
  })

  const digits = String(lines.length).length
  const gutterWidth = Math.max(40, 12 + digits * 8)
  const contentWidth = Math.ceil(maxChars * TEXT_CHAR_WIDTH) + 24
  const totalWidth = gutterWidth + contentWidth

  return (
    <DocShell
      fileName={fileName}
      src={src}
      className={className}
      bare={bare}
      meta={`${lines.length.toLocaleString()} line${lines.length === 1 ? "" : "s"}`}
    >
      <div
        className="relative min-h-0 flex-1 overflow-hidden bg-card font-mono"
        style={{ fontSize: TEXT_FONT, lineHeight: `${TEXT_LINE_HEIGHT}px` }}
      >
        {/* Full-height line-number rail behind the scroller, pinned at the left so
            it survives horizontal scroll and runs to the bottom of the viewer. Its
            tinted fill against the white content is the boundary — no border line,
            which would otherwise be covered by the row cells and look broken. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-0 bg-[color-mix(in_oklab,var(--card)_96%,var(--foreground))]"
          style={{ width: gutterWidth }}
        />
        <div ref={scrollRef} className="absolute inset-0 overflow-auto">
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: totalWidth,
              minWidth: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((item) => (
              <div
                key={item.index}
                className="grid"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: TEXT_LINE_HEIGHT,
                  transform: `translateY(${item.start}px)`,
                  gridTemplateColumns: `${gutterWidth}px 1fr`,
                }}
              >
                {/* Opaque (matches the rail) so long lines can't show through it. */}
                <div className="sticky left-0 z-[1] flex items-center justify-end bg-[color-mix(in_oklab,var(--card)_96%,var(--foreground))] pr-2 text-[0.6875rem] tabular-nums text-muted-foreground select-none">
                  {item.index + 1}
                </div>
                <div className="flex items-center whitespace-pre px-3 text-foreground">
                  {lines[item.index] === "" ? " " : lines[item.index]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DocShell>
  )
}

// --- markdown & HTML (sandboxed iframe) --------------------------------------

function MarkdownDocViewer({
  src,
  fileName,
  className,
  bare,
}: {
  src: string
  fileName: string
  className?: string
  bare?: boolean
}) {
  // Sanitized upstream in getMarkdownHtml (marked → DOMPurify).
  const html = React.use(getMarkdownHtml(src))
  return (
    <DocShell fileName={fileName} src={src} className={className} bare={bare}>
      {/* React 19 hoists + dedupes this by `href`, so it's injected once. */}
      <style href="fv-markdown" precedence="default">
        {MARKDOWN_STYLE}
      </style>
      <div className="min-h-0 flex-1 overflow-auto bg-card">
        <div
          className="fv-markdown mx-auto max-w-3xl px-6 py-5"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </DocShell>
  )
}

function HtmlDocViewer({
  src,
  fileName,
  className,
  bare,
}: {
  src: string
  fileName: string
  className?: string
  bare?: boolean
}) {
  const html = React.use(getText(src))
  return (
    <DocShell fileName={fileName} src={src} className={className} bare={bare}>
      <SandboxedDoc html={html} title={fileName} />
    </DocShell>
  )
}

/** Render arbitrary HTML safely: a sandbox with no scripts and no same-origin
 *  access, so untrusted markup can display but cannot run code or reach the app. */
function SandboxedDoc({ html, title }: { html: string; title: string }) {
  return (
    <iframe
      sandbox=""
      srcDoc={html}
      title={title}
      className="h-full w-full border-0 bg-white"
    />
  )
}

// --- CSV (delegates to CsvViewer, which wants content rather than a URL) ------

function CsvFromUrl({ src, className }: { src: string; className?: string }) {
  const blob = React.use(getBlob(src))
  const [height, setHeight] = React.useState(0)

  const ref = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    setHeight(el.clientHeight)
    const observer = new ResizeObserver((entries) => {
      for (const e of entries) setHeight(e.contentRect.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={cn("min-h-0", className)}>
      {height > 0 ? (
        <CsvViewer source={blob} height={height} className="h-full" />
      ) : null}
    </div>
  )
}

// --- shared shell + fallbacks ------------------------------------------------

function DocShell({
  fileName,
  src,
  meta,
  className,
  bare,
  children,
}: {
  fileName: string
  src: string
  meta?: string
  className?: string
  bare?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      data-slot="file-viewer"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-card" : "rounded-xl border bg-muted/30",
        className
      )}
    >
      <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b bg-card px-3">
        <span className="truncate text-xs font-medium" title={fileName}>
          {fileName}
        </span>
        {meta ? (
          <span className="flex-shrink-0 text-xs text-muted-foreground tabular-nums">
            {meta}
          </span>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto size-7"
          aria-label="Download"
          title="Download"
          render={<a href={src} download={fileName} target="_blank" rel="noreferrer" />}
        >
          <Download />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

function UnsupportedCard({
  src,
  fileName,
  className,
  bare,
}: {
  src: string
  fileName: string
  className?: string
  bare?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-8 text-center",
        bare ? "h-full bg-muted/20" : "min-h-64 rounded-xl border bg-muted/30",
        className
      )}
      data-slot="file-viewer"
    >
      <p className="text-sm text-muted-foreground">
        No preview for{" "}
        <span className="font-medium text-foreground">{fileName}</span>.
      </p>
      <Button
        variant="outline"
        size="sm"
        render={<a href={src} download={fileName} target="_blank" rel="noreferrer" />}
      >
        <Download className="mr-1.5 size-4" />
        Download
      </Button>
    </div>
  )
}

function ViewerFallback({
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

function extractName(src: string): string {
  const clean = src.split(/[?#]/)[0]
  return clean.split("/").pop() || "file"
}

class FileErrorBoundary extends React.Component<
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
          Couldn&apos;t load this file.
        </div>
      )
    }
    return this.props.children
  }
}

// Typography for inline-rendered markdown, scoped to `.fv-markdown` and built on
// the app's own theme tokens — so it matches the surrounding UI and follows
// light/dark automatically (the tokens are redefined under `.dark`).
const MARKDOWN_STYLE = `
.fv-markdown { color: var(--foreground); font-size: 0.875rem; line-height: 1.7; word-wrap: break-word; }
.fv-markdown > :first-child { margin-top: 0; }
.fv-markdown > :last-child { margin-bottom: 0; }
.fv-markdown h1, .fv-markdown h2, .fv-markdown h3, .fv-markdown h4, .fv-markdown h5, .fv-markdown h6 { font-weight: 600; line-height: 1.3; margin: 1.5em 0 0.6em; }
.fv-markdown h1 { font-size: 1.55em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
.fv-markdown h2 { font-size: 1.3em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
.fv-markdown h3 { font-size: 1.12em; }
.fv-markdown h4 { font-size: 1em; }
.fv-markdown p, .fv-markdown ul, .fv-markdown ol, .fv-markdown blockquote, .fv-markdown pre, .fv-markdown table { margin: 0 0 1em; }
.fv-markdown ul, .fv-markdown ol { padding-left: 1.5em; }
.fv-markdown ul { list-style: disc; }
.fv-markdown ol { list-style: decimal; }
.fv-markdown li { margin: 0.25em 0; }
.fv-markdown li > ul, .fv-markdown li > ol { margin: 0.25em 0; }
.fv-markdown a { color: var(--primary); text-decoration: underline; text-underline-offset: 2px; }
.fv-markdown strong { font-weight: 600; }
.fv-markdown code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85em; background: var(--muted); padding: 0.15em 0.4em; border-radius: 4px; }
.fv-markdown pre { background: var(--muted); padding: 0.9em 1em; border-radius: 8px; overflow-x: auto; }
.fv-markdown pre code { background: none; padding: 0; font-size: 0.85em; }
.fv-markdown blockquote { padding-left: 1em; border-left: 3px solid var(--border); color: var(--muted-foreground); }
.fv-markdown table { border-collapse: collapse; display: block; width: max-content; max-width: 100%; overflow-x: auto; }
.fv-markdown th, .fv-markdown td { border: 1px solid var(--border); padding: 0.4em 0.75em; text-align: left; }
.fv-markdown th { background: var(--muted); font-weight: 600; }
.fv-markdown img { max-width: 100%; }
.fv-markdown hr { border: none; border-top: 1px solid var(--border); margin: 1.5em 0; }
`
