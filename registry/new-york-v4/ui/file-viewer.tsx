"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Download, Maximize, Minus, Plus } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import Prism from "prismjs"
// Type-only — erased at compile time; the sanitizer loads lazily at runtime.
import type * as DOMPurifyNS from "dompurify"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

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

// --- profiling -----------------------------------------------------------------

/**
 * Logs `[file-viewer] <label> <ms>` when `globalThis.__FILE_VIEWER_PROFILE__` is
 * set. Costs nothing otherwise — a profiler flips the flag before navigation.
 */
async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const on =
    typeof globalThis !== "undefined" &&
    (globalThis as { __FILE_VIEWER_PROFILE__?: boolean }).__FILE_VIEWER_PROFILE__
  if (!on) return fn()
  const t0 = performance.now()
  try {
    return await fn()
  } finally {
    // eslint-disable-next-line no-console
    console.log(`[file-viewer] ${label} ${(performance.now() - t0).toFixed(1)}ms`)
  }
}

function baseName(src: string): string {
  return src.split("/").pop() ?? src
}

// --- resource caches: stable promises so React `use()` can read them ---------

// Caches are bounded (least-recently-used) so a long session — or signed URLs,
// whose query string changes every re-sign and so never hits — doesn't grow
// without limit. `lruGet` refreshes recency on a hit; `lruSet` inserts and
// evicts the oldest past the cap, handing each dropped entry to `onEvict` so a
// paired resource (e.g. the streaming text loader) can be released alongside it.
const RESOURCE_CACHE_MAX = 12
function lruGet<K, V>(map: Map<K, V>, key: K): V | undefined {
  const v = map.get(key)
  if (v !== undefined) {
    map.delete(key)
    map.set(key, v)
  }
  return v
}
function lruSet<K, V>(
  map: Map<K, V>,
  key: K,
  value: V,
  onEvict?: (key: K, value: V) => void
) {
  map.delete(key)
  map.set(key, value)
  while (map.size > RESOURCE_CACHE_MAX) {
    const oldest = map.keys().next().value as K
    const dropped = map.get(oldest) as V
    map.delete(oldest)
    onEvict?.(oldest, dropped)
  }
}

const textCache = new Map<string, Promise<string>>()
function getText(src: string): Promise<string> {
  let p = lruGet(textCache, src)
  if (!p) {
    p = timed(`text:fetch ${baseName(src)}`, () =>
      fetch(src).then((r) => {
        if (!r.ok) throw new Error(`Failed to load file: ${r.status}`)
        return r.text()
      })
    )
    lruSet(textCache, src, p)
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
  let p = lruGet(markdownCache, src)
  if (!p) {
    p = timed(`markdown:render ${baseName(src)}`, () =>
      Promise.all([getText(src), import("marked"), loadSanitizer()]).then(
        async ([text, { marked }, DOMPurify]) => {
          const dirty = String(await marked.parse(text, { gfm: true }))
          return DOMPurify.sanitize(dirty)
        }
      )
    )
    lruSet(markdownCache, src, p)
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
  /**
   * Render the scrolling content inside a shadow root, isolating it from the host
   * page's style rules — in particular `:has()` selectors, whose invalidation
   * Blink does NOT scope by `contain`. On a page with a large `:has()` surface,
   * the virtualized viewers (text/log/JSON, CSV, XLSX) otherwise pay a full
   * document `:has()` re-match on every per-scroll row mutation; isolation scopes
   * that to the grid's own subtree and keeps scrolling at refresh rate. Only
   * affects the categories that virtualize a dense grid; pages/slides/images are
   * unaffected either way. Defaults to false. When on, host CSS can't reach into
   * the grid to style it.
   */
  isolateStyles?: boolean
}

export function FileViewer(props: FileViewerProps) {
  const isClient = useIsClient()
  // Detect the category up front (from the props we already have) so the fallback
  // can mirror the chrome of whichever viewer is about to mount — both before
  // hydration and while that viewer's code-split chunk downloads. The download
  // name matches what FileViewerInner passes through.
  const name = props.fileName ?? props.src
  const category = props.as ?? detectCategory(name, props.mimeType)
  const download = props.fileName ?? extractName(props.src)
  const fallback = (
    <ViewerFallback
      category={category}
      fileName={download}
      src={props.src}
      className={props.className}
      bare={props.bare}
    />
  )
  if (!isClient) {
    return fallback
  }
  return (
    <FileErrorBoundary className={props.className} resetKey={props.src}>
      <React.Suspense fallback={fallback}>
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
  isolateStyles = false,
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
      return <XlsxViewer src={src} className={className} bare={bare} downloadFileName={download} isolateStyles={isolateStyles} />
    case "csv":
      return (
        <CsvFromUrl
          src={src}
          fileName={download}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    case "markdown":
      return <MarkdownDocViewer src={src} fileName={download} className={className} bare={bare} />
    case "html":
      return <HtmlDocViewer src={src} fileName={download} className={className} bare={bare} />
    case "text":
      return <TextDocViewer src={src} fileName={download} className={className} bare={bare} isolateStyles={isolateStyles} />
    default:
      return <UnsupportedCard src={src} fileName={download} className={className} bare={bare} />
  }
}

// --- text / code / JSON viewer (streamed + virtualized) ----------------------
//
// This is intentionally NOT the standalone `text-viewer.tsx` (`TextViewer`), and
// the two should not be merged. They optimize for opposite goals:
//   • This one byte-range *streams* + virtualizes, so it can open a 200 MB log
//     without holding it all in memory — but it can't guarantee an arbitrary
//     line is present, so it has no line highlight / scroll-to-line.
//   • `TextViewer` fetches the *whole* file and renders every line, because the
//     source-linking system (`text-source.tsx`) needs every line addressable to
//     highlight + scroll to an extraction's source span.
// Merging would force one design to sabotage the other.

const TEXT_FONT = 12.5
const TEXT_LINE_HEIGHT = 20
const TEXT_CHAR_WIDTH = TEXT_FONT * 0.6 // monospace approximation

// --- JSON syntax highlighting ------------------------------------------------
// Only JSON is highlighted; log/text/code/unknown render as plain mono (cheaper,
// and avoids carrying a grammar per format). JSON has no multi-line tokens —
// strings can't hold raw newlines and standard JSON has no comments — so each
// line tokenizes independently with no carried state. We exploit that: tokenize
// only the *visible* lines, cached, so cost is bounded by the viewport, not the
// file size. No whole-file ceiling needed; one giant minified/invalid line is
// the only pathological case, guarded by JSON_LINE_MAX below.

// We never auto-scan the DOM — this component tokenizes explicitly.
Prism.manual = true

/** Longest line we'll tokenize; longer lines (minified/invalid JSON) stay plain. */
const JSON_LINE_MAX = 2000

/**
 * Inlined JSON grammar so the component depends only on Prism's `tokenize` core,
 * registers nothing on the global Prism, and stays self-contained.
 */
const JSON_GRAMMAR: Prism.Grammar = {
  property: {
    pattern: /"(?:\\.|[^\\"\r\n])*"(?=\s*:)/,
    greedy: true,
  },
  string: {
    pattern: /"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
    greedy: true,
  },
  number: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,
  punctuation: /[{}[\],]/,
  operator: /:/,
  boolean: /\b(?:false|true)\b/,
  null: { pattern: /\bnull\b/, alias: "keyword" },
}

/** json/json5 → the grammar; everything else → null (plain mono). */
function highlightGrammar(fileName: string): Prism.Grammar | null {
  return /\.(json|json5)$/i.test(fileName) ? JSON_GRAMMAR : null
}

interface Leaf {
  /** Prism token type, or "" for plain text (whitespace, structure). */
  type: string
  text: string
}

/** Flatten Prism's (possibly nested) token stream into typed leaf spans. */
function flattenTokens(
  tokens: (string | Prism.Token)[],
  parentType = "",
  out: Leaf[] = []
): Leaf[] {
  for (const tok of tokens) {
    if (typeof tok === "string") {
      out.push({ type: parentType, text: tok })
    } else if (Array.isArray(tok.content)) {
      flattenTokens(tok.content as (string | Prism.Token)[], tok.type, out)
    } else if (typeof tok.content === "string") {
      out.push({ type: tok.type, text: tok.content })
    } else {
      flattenTokens([tok.content as Prism.Token], tok.type, out)
    }
  }
  return out
}

/** Token type → CSS class; classes are themed via the variables in SYNTAX_STYLE. */
const TOKEN_CLASS: Record<string, string> = {
  property: "fv-tok-key",
  string: "fv-tok-string",
  number: "fv-tok-number",
  boolean: "fv-tok-keyword",
  null: "fv-tok-keyword",
  keyword: "fv-tok-keyword",
  punctuation: "fv-tok-punct",
  operator: "fv-tok-punct",
}

/** Token colors as CSS variables so light/dark comes from the theme, not a fixed
 *  palette. Defaults are GitHub-ish; override the vars to retheme. */
const SYNTAX_STYLE = `
.fv-tok-key { color: var(--fv-syntax-key, #0550ae); }
.fv-tok-string { color: var(--fv-syntax-string, #0a7d33); }
.fv-tok-number { color: var(--fv-syntax-number, #b5690c); }
.fv-tok-keyword { color: var(--fv-syntax-keyword, #8250df); }
.fv-tok-punct { color: var(--fv-syntax-punct, color-mix(in oklab, var(--foreground) 55%, transparent)); }
.dark .fv-tok-key { color: var(--fv-syntax-key, #6cb6ff); }
.dark .fv-tok-string { color: var(--fv-syntax-string, #8ddb8c); }
.dark .fv-tok-number { color: var(--fv-syntax-number, #e3b341); }
.dark .fv-tok-keyword { color: var(--fv-syntax-keyword, #dcbdfb); }
`

/** One rendered line: plain text on the fast path, token spans when highlighted. */
function LineContent({ line, leaves }: { line: string; leaves: Leaf[] | null }) {
  if (line === "") return <>{" "}</>
  if (!leaves) return <>{line}</>
  return (
    <>
      {leaves.map((leaf, i) =>
        leaf.type && TOKEN_CLASS[leaf.type] ? (
          <span key={i} className={TOKEN_CLASS[leaf.type]}>
            {leaf.text}
          </span>
        ) : (
          <React.Fragment key={i}>{leaf.text}</React.Fragment>
        )
      )}
    </>
  )
}
// How much of the file to reveal per step. The first frame paints after one
// chunk instead of waiting for (and splitting) the whole file, and a 200 MB log
// only ever holds what's been scrolled to in memory + the bytes not yet read.
const TEXT_PAGE_BYTES = 512 * 1024
// Start loading the next chunk when the viewport is within this many px of the
// bottom, so scrolling stays ahead of the reader.
const TEXT_LOAD_AHEAD_PX = 600

interface TextSnapshot {
  text: string
  bytesLoaded: number
  totalBytes: number | null
  done: boolean
}

// Per-source loader: the running text + a streaming TextDecoder so multibyte
// characters split across a byte-range boundary decode correctly. Lives in a
// module cache (not component state) so a remount reuses the bytes already read.
interface TextLoaderState extends TextSnapshot {
  decoder: TextDecoder
}

const textLoaderCache = new Map<string, TextLoaderState>()

interface RangeResult {
  buf: ArrayBuffer
  /** 200 means the server ignored Range and returned the whole file. */
  whole: boolean
  /** Total file size from Content-Range / Content-Length, when known. */
  total: number | null
}

async function fetchRange(src: string, start: number, end: number): Promise<RangeResult> {
  const res = await fetch(src, { headers: { Range: `bytes=${start}-${end}` } })
  if (res.status === 416) return { buf: new ArrayBuffer(0), whole: false, total: null }
  if (!res.ok) throw new Error(`Failed to load file: ${res.status}`)
  const buf = await res.arrayBuffer()
  let total: number | null = null
  const contentRange = res.headers.get("content-range")
  if (contentRange) {
    const m = contentRange.match(/\/(\d+)\s*$/)
    if (m) total = Number(m[1])
  } else {
    const len = Number(res.headers.get("content-length"))
    if (Number.isFinite(len) && len > 0) total = len
  }
  return { buf, whole: res.status === 200, total }
}

function snapshotOf(loader: TextLoaderState): TextSnapshot {
  return {
    text: loader.text,
    bytesLoaded: loader.bytesLoaded,
    totalBytes: loader.totalBytes,
    done: loader.done,
  }
}

/**
 * First-chunk loader read via `React.use()` so the text viewer suspends like
 * every other viewer — no effect, no stream lifecycle to clean up. `loadAll`
 * (JSON) fetches the whole file since it can only be pretty-printed complete;
 * everything else fetches just the first byte-range page for an instant paint.
 * Cached per source so a remount resolves instantly and resumes where it left off.
 */
const firstChunkCache = new Map<string, Promise<TextSnapshot>>()
function loadFirstChunk(src: string, loadAll: boolean): Promise<TextSnapshot> {
  let p = lruGet(firstChunkCache, src)
  if (!p) {
    p = timed(`text:first-chunk ${baseName(src)}`, async () => {
      const decoder = new TextDecoder()
      if (loadAll) {
        const res = await fetch(src)
        if (!res.ok) throw new Error(`Failed to load file: ${res.status}`)
        const text = await res.text()
        const loader: TextLoaderState = {
          text,
          bytesLoaded: text.length,
          totalBytes: text.length,
          done: true,
          decoder,
        }
        textLoaderCache.set(src, loader)
        return snapshotOf(loader)
      }
      const { buf, whole, total } = await fetchRange(src, 0, TEXT_PAGE_BYTES - 1)
      const text = decoder.decode(buf, { stream: !whole })
      const bytesLoaded = buf.byteLength
      const done =
        whole ||
        buf.byteLength < TEXT_PAGE_BYTES ||
        (total != null && bytesLoaded >= total)
      const loader: TextLoaderState = {
        text: done && !whole ? text + decoder.decode() : text,
        bytesLoaded,
        totalBytes: whole ? bytesLoaded : total,
        done,
        decoder,
      }
      textLoaderCache.set(src, loader)
      return snapshotOf(loader)
    })
    // Evict the paired streaming loader alongside the first-chunk entry, so the
    // two caches stay in lockstep (both keyed by src).
    lruSet(firstChunkCache, src, p, (key) => textLoaderCache.delete(key))
  }
  return p
}

/** Fetch the next byte-range page and append it. Event-driven (scroll), so no effect. */
async function loadNextChunk(src: string): Promise<TextSnapshot> {
  const loader = textLoaderCache.get(src)
  if (!loader || loader.done) {
    return loader
      ? snapshotOf(loader)
      : { text: "", bytesLoaded: 0, totalBytes: null, done: true }
  }
  const start = loader.bytesLoaded
  const { buf, total } = await fetchRange(src, start, start + TEXT_PAGE_BYTES - 1)
  loader.bytesLoaded += buf.byteLength
  if (total != null) loader.totalBytes = total
  const reachedEnd =
    buf.byteLength === 0 ||
    buf.byteLength < TEXT_PAGE_BYTES ||
    (loader.totalBytes != null && loader.bytesLoaded >= loader.totalBytes)
  loader.text += loader.decoder.decode(buf, { stream: !reachedEnd })
  if (reachedEnd) loader.done = true
  return snapshotOf(loader)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// --- style isolation (shadow DOM) --------------------------------------------

// useLayoutEffect on the server logs a warning; fall back to useEffect there. The
// shadow root only exists on the client, so the effect is a no-op during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

// Drop every `:has()` style rule from a constructed sheet (recursing into
// @media/@supports/@layer blocks). The text grid's own markup uses no `has-*`
// variants, so these rules never style it — but Blink would still re-run their
// invalidation against the grid's subtree on each per-scroll mutation. Removing
// them is what takes the isolated grid from a few ms of residual recalc down to
// ~nothing. Safe precisely because the grid doesn't depend on any `:has()` rule.
function stripHasRules(owner: CSSStyleSheet | CSSGroupingRule) {
  const rules = owner.cssRules
  if (!rules) return
  for (let i = rules.length - 1; i >= 0; i--) {
    const r = rules[i]
    if ((r as CSSStyleRule).selectorText?.includes(":has(")) {
      try {
        owner.deleteRule(i)
      } catch {
        // ignore a rule that can't be removed
      }
    } else if ((r as CSSGroupingRule).cssRules?.length) {
      stripHasRules(r as CSSGroupingRule)
    }
  }
}

// The page's author CSS, mirrored into constructible stylesheets once and shared
// (by reference) across every isolated instance — `adoptedStyleSheets` allows one
// sheet object in many roots. `:has()` rules are stripped (see stripHasRules).
// Cross-origin sheets (e.g. a font CDN) can't be read and are skipped; their
// declarations reach the grid through inheritance where they apply to custom
// properties. Snapshotted at first use: later-added stylesheets (route CSS, HMR)
// won't appear, which is fine for the grid's own utilities, present from first
// paint.
let sharedSheets: CSSStyleSheet[] | null = null
function getSharedSheets(): CSSStyleSheet[] {
  if (sharedSheets) return sharedSheets
  const out: CSSStyleSheet[] = []
  for (const ss of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = ss.cssRules
    } catch {
      continue // cross-origin: unreadable, skip
    }
    let text = ""
    for (const rule of Array.from(rules)) text += rule.cssText + "\n"
    try {
      const sheet = new CSSStyleSheet()
      // @import rules are dropped by replaceSync per spec — harmless here, since
      // the imported sheet also appears separately in document.styleSheets.
      sheet.replaceSync(text)
      stripHasRules(sheet)
      out.push(sheet)
    } catch {
      // skip any sheet that can't be reconstructed
    }
  }
  sharedSheets = out
  return out
}

/**
 * Renders its children inside a shadow root so the host document's style rules —
 * in particular `:has()` selectors, whose invalidation Blink does NOT scope by
 * `contain` — can't match into them. Style recalc triggered by the grid's
 * per-scroll mutations is then confined to the grid's own subtree instead of the
 * whole document. The page's author CSS is copied in so utility classes still
 * resolve; theme custom properties, font size, and line height inherit through
 * the boundary.
 *
 * Renders nothing until mounted (no SSR markup — the viewer is client-only
 * anyway). The shadow root is attached in a layout effect, which re-renders the
 * portal before the browser paints, so there's no flash of an empty box.
 */
function ShadowScope({
  className,
  style,
  children,
}: {
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const hostRef = React.useRef<HTMLDivElement>(null)
  const [root, setRoot] = React.useState<ShadowRoot | null>(null)

  useIsomorphicLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const sr = host.shadowRoot ?? host.attachShadow({ mode: "open" })
    try {
      sr.adoptedStyleSheets = getSharedSheets()
    } catch {
      // adoptedStyleSheets / constructible sheets unsupported: clone the page's
      // style source nodes in instead (heavier, but the same visual result).
      for (const node of Array.from(
        document.querySelectorAll('style, link[rel="stylesheet"]')
      )) {
        try {
          sr.appendChild(node.cloneNode(true))
        } catch {
          // ignore a node that can't be cloned
        }
      }
    }
    setRoot(sr)
  }, [])

  return (
    <div ref={hostRef} className={className} style={style}>
      {root ? createPortal(children, root) : null}
    </div>
  )
}

/** The scroll container — optionally inside a shadow root for style isolation. */
function ScrollerShell({
  isolate,
  className,
  style,
  children,
}: {
  isolate: boolean
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  if (isolate) {
    return (
      <ShadowScope className={className} style={style}>
        {children}
      </ShadowScope>
    )
  }
  return (
    <div className={className} style={style}>
      {children}
    </div>
  )
}

function TextDocViewer({
  src,
  fileName,
  className,
  bare,
  isolateStyles,
}: {
  src: string
  fileName: string
  className?: string
  bare?: boolean
  isolateStyles?: boolean
}) {
  // JSON must be fully present before it can be parsed + pretty-printed.
  const isJson = /\.(json|json5)$/i.test(fileName)
  // Suspends until the first byte-range page is ready — like every other viewer.
  const initial = React.use(loadFirstChunk(src, isJson))

  const [snap, setSnap] = React.useState<TextSnapshot>(initial)
  const [loadingMore, setLoadingMore] = React.useState(false)
  // Reset state during render when the source changes (no effect needed). `use`
  // above re-suspends on a new src, so `initial` is already the new file here.
  const [renderedSrc, setRenderedSrc] = React.useState(src)
  const grammar = React.useMemo(() => highlightGrammar(fileName), [fileName])
  // Per-line token cache keyed by line text: identical lines and re-scrolls reuse
  // work, so only newly revealed lines ever tokenize. Reset when the file changes.
  const tokenCacheRef = React.useRef<Map<string, Leaf[]>>(new Map())
  if (renderedSrc !== src) {
    setRenderedSrc(src)
    setSnap(initial)
    setLoadingMore(false)
    tokenCacheRef.current = new Map()
  }

  const lineLeaves = React.useCallback(
    (line: string): Leaf[] | null => {
      if (!grammar || line.length === 0 || line.length > JSON_LINE_MAX) return null
      const cache = tokenCacheRef.current
      let leaves = cache.get(line)
      if (!leaves) {
        leaves = flattenTokens(Prism.tokenize(line, grammar))
        cache.set(line, leaves)
      }
      return leaves
    },
    [grammar]
  )

  const loadMore = React.useCallback(() => {
    setLoadingMore((busy) => {
      if (busy) return busy
      void loadNextChunk(src).then((next) => {
        setSnap(next)
        setLoadingMore(false)
      })
      return true
    })
  }, [src])

  const text = React.useMemo(() => {
    if (isJson && snap.done) {
      try {
        return JSON.stringify(JSON.parse(snap.text), null, 2)
      } catch {
        /* not valid JSON — show as-is */
      }
    }
    return snap.text
  }, [snap.text, snap.done, isJson])

  const lines = React.useMemo(() => text.replace(/\n$/, "").split("\n"), [text])
  const maxChars = React.useMemo(
    () => lines.reduce((m, l) => Math.max(m, l.length), 0),
    [lines]
  )

  // Zoom scales the font and every pixel metric derived from it.
  const { scale, zoom, reset } = useZoom()
  const fontSize = TEXT_FONT * scale
  const lineHeight = Math.round(TEXT_LINE_HEIGHT * scale)
  const charWidth = TEXT_CHAR_WIDTH * scale

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => lineHeight,
    overscan: 16,
  })
  // Row height changes with zoom — re-measure so the total size stays correct.
  React.useLayoutEffect(() => {
    virtualizer.measure()
  }, [lineHeight, virtualizer])

  // Pull the next page as the viewport nears the end of what's loaded.
  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (snap.done || loadingMore) return
      const el = e.currentTarget
      if (el.scrollHeight - el.scrollTop - el.clientHeight < TEXT_LOAD_AHEAD_PX) {
        loadMore()
      }
    },
    [snap.done, loadingMore, loadMore]
  )

  const digits = String(Math.max(lines.length, 1)).length
  const gutterWidth = Math.round(Math.max(40, 12 + digits * 8) * scale)
  const contentWidth = Math.ceil(maxChars * charWidth) + 24
  const totalWidth = gutterWidth + contentWidth

  const meta = snap.done
    ? `${lines.length.toLocaleString()} line${lines.length === 1 ? "" : "s"}`
    : `${lines.length.toLocaleString()} lines · ${formatBytes(snap.bytesLoaded)}${
        snap.totalBytes ? ` / ${formatBytes(snap.totalBytes)}` : ""
      } loaded`

  return (
    <DocShell
      fileName={fileName}
      src={src}
      className={className}
      bare={bare}
      meta={meta}
      actions={<ZoomActions scale={scale} zoom={zoom} reset={reset} />}
    >
      <ScrollerShell
        isolate={!!isolateStyles}
        className="relative min-h-0 flex-1 overflow-hidden bg-card font-mono"
        style={{ fontSize, lineHeight: `${lineHeight}px` }}
      >
        {/* Plain (non-hoisted) <style> so it lands inside the shadow root when
          isolated; the token classes it targets live inside the scroller. */}
        {grammar ? <style>{SYNTAX_STYLE}</style> : null}
        {/* Full-height line-number rail behind the scroller, pinned at the left so
            it survives horizontal scroll and runs to the bottom of the viewer. Its
            tinted fill against the white content is the boundary — no border line,
            which would otherwise be covered by the row cells and look broken. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-0 bg-[color-mix(in_oklab,var(--card)_96%,var(--foreground))]"
          style={{ width: gutterWidth }}
        />
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-auto"
        >
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
                  height: lineHeight,
                  transform: `translateY(${item.start}px)`,
                  gridTemplateColumns: `${gutterWidth}px 1fr`,
                }}
              >
                {/* Opaque (matches the rail) so long lines can't show through it. */}
                <div
                  className="sticky left-0 z-[1] flex items-center justify-end bg-[color-mix(in_oklab,var(--card)_96%,var(--foreground))] pr-2 tabular-nums text-muted-foreground select-none"
                  style={{ fontSize: Math.round(fontSize * 0.85) }}
                >
                  {item.index + 1}
                </div>
                <div className="flex items-center whitespace-pre px-3 text-foreground">
                  <LineContent
                    line={lines[item.index]}
                    leaves={lineLeaves(lines[item.index])}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollerShell>
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
  const { scale, zoom, reset } = useZoom()
  return (
    <DocShell
      fileName={fileName}
      src={src}
      className={className}
      bare={bare}
      actions={<ZoomActions scale={scale} zoom={zoom} reset={reset} />}
    >
      {/* React 19 hoists + dedupes this by `href`, so it's injected once. */}
      <style href="fv-markdown" precedence="default">
        {MARKDOWN_STYLE}
      </style>
      <div className="min-h-0 flex-1 overflow-auto bg-card">
        <div
          className="fv-markdown mx-auto max-w-3xl px-6 py-5"
          style={{ zoom: scale }}
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
  const { scale, zoom, reset } = useZoom()
  return (
    <DocShell
      fileName={fileName}
      src={src}
      className={className}
      bare={bare}
      actions={<ZoomActions scale={scale} zoom={zoom} reset={reset} />}
    >
      <SandboxedDoc html={html} title={fileName} scale={scale} />
    </DocShell>
  )
}

/** Render arbitrary HTML safely: a sandbox with no scripts and no same-origin
 *  access, so untrusted markup can display but cannot run code or reach the app. */
function SandboxedDoc({
  html,
  title,
  scale = 1,
}: {
  html: string
  title: string
  scale?: number
}) {
  // `zoom` grows the iframe's layout box past the wrapper, so it scrolls.
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white">
      <iframe
        sandbox=""
        srcDoc={html}
        title={title}
        className="h-full w-full border-0 bg-white"
        style={{ zoom: scale }}
      />
    </div>
  )
}

// --- CSV (delegates to CsvViewer, which fetches + streams the URL itself) -----

function CsvFromUrl({
  src,
  fileName,
  className,
  bare,
  isolateStyles,
}: {
  src: string
  fileName: string
  className?: string
  bare?: boolean
  isolateStyles?: boolean
}) {
  const { scale, zoom, reset } = useZoom()
  return (
    <DocShell
      fileName={fileName}
      src={src}
      actions={<ZoomActions scale={scale} zoom={zoom} reset={reset} />}
      className={className}
      bare={bare}
    >
      {/* Borderless + fillHeight so the table sits flush inside DocShell's body,
          flexing to fill the space below the toolbar (no manual measuring).
          The toolbar drives zoom via `scale`, so the footer's own zoom is off —
          one zoom control, matching the other DocShell formats. */}
      <CsvViewer
        src={src}
        fillHeight
        scale={scale}
        showZoom={false}
        showDownload={false}
        className="rounded-none border-0 bg-transparent"
        isolateStyles={isolateStyles}
      />
    </DocShell>
  )
}

// --- shared shell + fallbacks ------------------------------------------------

function DocShell({
  fileName,
  src,
  meta,
  actions,
  className,
  bare,
  children,
}: {
  fileName: string
  src: string
  meta?: string
  /** Toolbar controls (e.g. zoom) shown to the left of the download button. */
  actions?: React.ReactNode
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
      <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
        <span className="truncate px-1 text-xs font-medium" title={fileName}>
          {fileName}
        </span>
        {meta ? (
          <span className="flex-shrink-0 text-xs text-muted-foreground tabular-nums">
            {meta}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          {actions}
          {actions ? <Separator orientation="vertical" className="mx-1 h-4" /> : null}
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            aria-label="Download"
            title="Download"
            render={<a href={src} download={fileName} target="_blank" rel="noreferrer" />}
          >
            <Download />
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Shared zoom state for the content viewers (0.25×–5×, matching every viewer). */
function useZoom() {
  const [scale, setScale] = React.useState(1)
  const zoom = React.useCallback(
    (factor: number) => setScale((s) => clamp(s * factor, 0.25, 5)),
    []
  )
  const reset = React.useCallback(() => setScale(1), [])
  return { scale, zoom, reset }
}

/** The Zoom out / % / Zoom in / Actual-size toolbar cluster (DocShell `actions`). */
function ZoomActions({
  scale,
  zoom,
  reset,
}: {
  scale: number
  zoom: (factor: number) => void
  reset: () => void
}) {
  return (
    <>
      <IconButton label="Zoom out" onClick={() => zoom(1 / 1.2)}>
        <Minus />
      </IconButton>
      <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
        {Math.round(scale * 100)}%
      </span>
      <IconButton label="Zoom in" onClick={() => zoom(1.2)}>
        <Plus />
      </IconButton>
      <IconButton label="Actual size" onClick={reset}>
        <Maximize />
      </IconButton>
    </>
  )
}

/** Inert mirror of {@link ZoomActions} for skeletons, so the toolbar never jumps
 *  when the real (interactive) controls fade in. */
function ZoomActionsSkeleton() {
  const inert = { disabled: true, tabIndex: -1, "aria-hidden": true } as const
  return (
    <>
      <IconButton label="Zoom out" {...inert}>
        <Minus />
      </IconButton>
      <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
        100%
      </span>
      <IconButton label="Zoom in" {...inert}>
        <Plus />
      </IconButton>
      <IconButton label="Actual size" {...inert}>
        <Maximize />
      </IconButton>
    </>
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

// Shown before hydration and while the chosen format viewer's code-split chunk
// downloads. It mirrors the chrome of whatever is coming — a toolbar plus a
// body skeleton shaped to the category — so the top bar is always present and
// nothing jumps when the real viewer (or its own fallback) fades in.
function ViewerFallback({
  category,
  fileName,
  src,
  className,
  bare = false,
}: {
  category?: FileCategory
  fileName?: string
  src?: string
  className?: string
  bare?: boolean
}) {
  // Formats that render through DocShell, whose toolbar (filename + download)
  // needs no fetched data — show it for real, with a skeleton body, so the only
  // thing that fills in is the content itself.
  if (
    src != null &&
    fileName != null &&
    (category === "text" ||
      category === "markdown" ||
      category === "html" ||
      category === "csv")
  ) {
    return (
      <DocShell
        fileName={fileName}
        src={src}
        className={className}
        bare={bare}
        actions={<ZoomActionsSkeleton />}
      >
        {category === "csv" ? (
          <TableBodySkeleton />
        ) : category === "text" ? (
          <TextBodySkeleton />
        ) : (
          // markdown / html render prose or a sandboxed document — a plain block.
          <div className="min-h-0 flex-1 bg-card p-4">
            <Skeleton className="size-full rounded-md" />
          </div>
        )}
      </DocShell>
    )
  }

  // Leaf viewers (pdf/docx/image/pptx/xlsx) and unknowns: a shell with a generic
  // toolbar (same height/structure as every real toolbar) plus a body skeleton —
  // page-shaped for paged formats, grid-shaped for tabular ones.
  const tabular = category === "xlsx"
  const pageAspect =
    category === "pptx" || category === "image" ? "4 / 3" : "8.5 / 11"

  return (
    <div
      data-slot="file-viewer"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
    >
      <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
        <span className="px-1">
          <Skeleton className="inline-block h-3 w-16 align-middle" />
        </span>
        <div className="ml-auto flex items-center gap-1">
          {category !== "unsupported" ? (
            <>
              <ZoomActionsSkeleton />
              <Separator orientation="vertical" className="mx-1 h-4" />
            </>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            disabled
            tabIndex={-1}
            aria-hidden
          >
            <Download />
          </Button>
        </div>
      </div>
      {tabular ? (
        <TableBodySkeleton />
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="flex flex-col items-center p-4">
            <Skeleton
              aria-hidden
              className="w-full rounded-md"
              style={{ aspectRatio: pageAspect }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// A line-numbered skeleton matching TextDocViewer's body: a gutter rail with
// faux line numbers and monospace text bars of varying width — so the loading
// shape reads like the text/log/JSON it stands in for.
function TextBodySkeleton() {
  const gutter = 44
  // Deterministic widths so the lines look like real output (no Math.random).
  const widths = [
    82, 64, 91, 48, 73, 88, 56, 79, 95, 61, 70, 85, 52, 77, 90, 67, 83, 59, 74,
    86, 63, 80,
  ]
  return (
    <div
      aria-hidden
      className="relative min-h-0 flex-1 overflow-hidden bg-card font-mono"
      style={{ fontSize: TEXT_FONT, lineHeight: `${TEXT_LINE_HEIGHT}px` }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 bg-[color-mix(in_oklab,var(--card)_96%,var(--foreground))]"
        style={{ width: gutter }}
      />
      <div className="relative">
        {widths.map((w, i) => (
          <div
            key={i}
            className="grid items-center"
            style={{
              gridTemplateColumns: `${gutter}px 1fr`,
              height: TEXT_LINE_HEIGHT,
            }}
          >
            <div className="flex justify-end pr-2">
              <Skeleton className="h-2.5 w-3" />
            </div>
            <div className="px-3">
              <Skeleton className="h-2.5" style={{ width: `${w}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// A grid skeleton matching the csv/xlsx table: a header row, a row-number
// gutter, and cell bars — so the loading shape matches the final spreadsheet.
function TableBodySkeleton() {
  const gutter = 52
  const colWidth = 150
  const cols = 6
  const rows = 14
  const widths = [70, 45, 88, 56, 62, 78]
  return (
    <div
      aria-hidden
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card text-sm"
    >
      <div className="flex border-b bg-muted/60">
        <div
          className="shrink-0 border-r"
          style={{ width: gutter, height: 33 }}
        />
        {Array.from({ length: cols }, (_, c) => (
          <div
            key={c}
            className="flex shrink-0 items-center border-r px-3"
            style={{ width: colWidth, height: 33 }}
          >
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex border-b" style={{ height: 33 }}>
            <div
              className="flex shrink-0 items-center justify-end border-r px-2"
              style={{ width: gutter }}
            >
              <Skeleton className="h-3 w-4" />
            </div>
            {Array.from({ length: cols }, (_, c) => (
              <div
                key={c}
                className="flex shrink-0 items-center border-r px-3"
                style={{ width: colWidth }}
              >
                <Skeleton
                  className="h-3"
                  style={{ width: `${widths[(r + c) % widths.length]}%` }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function extractName(src: string): string {
  const clean = src.split(/[?#]/)[0]
  return clean.split("/").pop() || "file"
}

class FileErrorBoundary extends React.Component<
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
