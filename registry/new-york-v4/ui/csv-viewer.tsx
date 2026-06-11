"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  ChevronDown,
  ChevronUp,
  Download,
  Maximize,
  Minus,
  Plus,
} from "lucide-react"

import { createCsvParser, parseCsv, streamCsv, type ParsedCsv } from "@/lib/csv"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type Row = string[]

/** A column to render: its true index plus its track size. */
interface ColumnItem {
  index: number
  size: number
}

const ROW_NUMBER_WIDTH = 56
// Base font size at 100% zoom; scales linearly with `scale`.
const BASE_FONT = 13

// A native vertical scrollbar spans the full scroller height and paints on top
// of everything (z-index can't cover it), so it overlaps the sticky header. Hide
// the vertical bar (WebKit) and draw a custom thumb below the header instead;
// keep the native horizontal bar, styled to match.
const SCROLLBAR_CSS = `
[data-slot="csv-body"]::-webkit-scrollbar { width: 10px; height: 10px; }
[data-slot="csv-body"]::-webkit-scrollbar:vertical { display: none; }
[data-slot="csv-body"]::-webkit-scrollbar-track { background: transparent; }
[data-slot="csv-body"]::-webkit-scrollbar-thumb {
  background-color: color-mix(in oklab, var(--foreground) 22%, transparent);
  border-radius: 9999px;
  border: 3px solid transparent;
  background-clip: content-box;
}
[data-slot="csv-body"]::-webkit-scrollbar-thumb:hover {
  background-color: color-mix(in oklab, var(--foreground) 38%, transparent);
}
`

// Custom vertical scroll indicator that sits BELOW a sticky header (the native
// vertical bar is hidden by SCROLLBAR_CSS). Tracks the scroller's scrollTop and
// is draggable.
function HeaderAwareScrollbar({
  scrollRef,
  headerHeight,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>
  headerHeight: number
}) {
  const [thumb, setThumb] = React.useState({ height: 0, top: 0, show: false })
  const drag = React.useRef<{ y: number; scroll: number } | null>(null)

  const measure = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollHeight, clientHeight, scrollTop } = el
    const track = clientHeight - headerHeight
    if (scrollHeight <= clientHeight + 1 || track <= 0) {
      setThumb((t) => (t.show ? { ...t, show: false } : t))
      return
    }
    const height = Math.max(28, (clientHeight / scrollHeight) * track)
    const max = scrollHeight - clientHeight
    const top = max > 0 ? (scrollTop / max) * (track - height) : 0
    setThumb({ height, top, show: true })
  }, [scrollRef, headerHeight])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    measure()
    el.addEventListener("scroll", measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => {
      el.removeEventListener("scroll", measure)
      observer.disconnect()
    }
  }, [scrollRef, measure])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current
    if (!el) return
    e.preventDefault()
    drag.current = { y: e.clientY, scroll: el.scrollTop }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current
    const d = drag.current
    if (!el || !d) return
    const track = el.clientHeight - headerHeight
    const height = Math.max(28, (el.clientHeight / el.scrollHeight) * track)
    const denom = track - height
    if (denom <= 0) return
    const max = el.scrollHeight - el.clientHeight
    el.scrollTop = d.scroll + ((e.clientY - d.y) / denom) * max
  }
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  if (!thumb.show) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-0 z-30 w-2.5"
      style={{ top: headerHeight, bottom: 0 }}
    >
      <div
        className="pointer-events-auto absolute right-0.5 w-1.5 rounded-full bg-foreground/25 transition-colors hover:bg-foreground/40"
        style={{ height: thumb.height, top: thumb.top }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
    </div>
  )
}

// useLayoutEffect on the server logs a warning; fall back to useEffect there. The
// shadow root only exists on the client, so the effect is a no-op during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

// Drop every `:has()` style rule from a constructed sheet (recursing into
// @media/@supports/@layer blocks). The table's own markup uses no `has-*`
// variants, so these rules never style it — but Blink would still re-run their
// invalidation against the table's subtree on each per-scroll mutation. Removing
// them is what takes the isolated table from a few ms of residual recalc down to
// ~nothing. Safe precisely because the table doesn't depend on any `:has()` rule.
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
// sheet object in many roots, so N tables cost one copy, not N. `:has()` rules are
// stripped (see stripHasRules). Cross-origin sheets (e.g. a font CDN) can't be
// read and are skipped; their declarations reach the table through inheritance
// where they apply to custom properties. Snapshotted at first use: later-added
// stylesheets (route CSS, HMR) won't appear, which is fine for the table's own
// utilities, present from first paint.
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
 * `contain` — can't match into them. Style recalc triggered by the table's
 * per-scroll mutations is then confined to the table's own subtree instead of the
 * whole document. The page's author CSS is copied in so utility classes still
 * resolve; theme custom properties and font size inherit through the boundary.
 *
 * Renders nothing until mounted (no SSR markup). The shadow root is attached in a
 * layout effect — which runs, and re-renders the portal, before the browser
 * paints — so there's no flash of an empty box on the client.
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

// Fetched blobs are cached per URL so a remount (or re-render) reuses the bytes
// already downloaded instead of re-fetching the file. Bounded (least-recently-
// used eviction) so a long session — or signed URLs, whose query string changes
// every re-sign and so never hits — doesn't accumulate blobs without limit.
const CSV_CACHE_MAX = 8
const csvBlobCache = new Map<string, Promise<Blob>>()
function fetchCsvBlob(src: string): Promise<Blob> {
  const cached = csvBlobCache.get(src)
  if (cached) {
    csvBlobCache.delete(src)
    csvBlobCache.set(src, cached)
    return cached
  }
  const p = fetch(src).then((r) => {
    if (!r.ok) throw new Error(`Failed to load file: ${r.status}`)
    return r.blob()
  })
  csvBlobCache.set(src, p)
  while (csvBlobCache.size > CSV_CACHE_MAX) {
    const oldest = csvBlobCache.keys().next().value as string
    csvBlobCache.delete(oldest)
  }
  return p
}

// Quote a field for CSV output: wrap in double quotes (doubling any inner
// quotes) when it contains a comma, quote, or newline; otherwise emit it as-is.
function escapeCsvField(value: string): string {
  const s = value ?? ""
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Serialize the currently-parsed columns + rows back to CSV text (CRLF line
// endings, per RFC 4180) so the toolbar's download always reflects what's shown,
// regardless of how the data was supplied (`src` / `value` / `data` / `source`).
function serializeCsv(columns: string[], rows: string[][]): string {
  const lines = [columns.map(escapeCsvField).join(",")]
  for (const row of rows) lines.push(row.map(escapeCsvField).join(","))
  return lines.join("\r\n")
}

// Derive a download filename from a `src` URL's last path segment, falling back
// to "data.csv".
function csvFileNameFromSrc(src?: string): string {
  if (!src) return "data.csv"
  try {
    const name = new URL(src, "http://_").pathname.split("/").pop()
    return name ? decodeURIComponent(name) : "data.csv"
  } catch {
    return "data.csv"
  }
}

export interface CsvViewerProps {
  /**
   * URL of a CSV/TSV file (same-origin or CORS-enabled). Fetched, then streamed
   * like `source` — so this is the URL-first entry point that matches every
   * other viewer. Takes precedence over `value`/`data`/`source` when set.
   */
  src?: string
  /** Raw CSV/TSV text. Provide this or `data`. */
  value?: string
  /** Pre-parsed data, if you already have columns + rows. */
  data?: ParsedCsv
  /**
   * A large CSV source to parse off the render path — a `File`/`Blob`, or a raw
   * CSV string. Rows stream in progressively, keeping the main thread
   * responsive. Prefer this over `value` for big inputs. For a remote file,
   * pass `src` instead and it's fetched then streamed the same way.
   */
  source?: Blob | string
  /**
   * Parse `source` in a Web Worker when available (falls back to a time-sliced
   * main-thread reader). Defaults to true. Ignored for `value` / `data`.
   */
  worker?: boolean
  /** Rows per progressive batch when streaming a `source`. Defaults to 5000. */
  batchSize?: number
  /** Field delimiter for `value` (defaults to ","; use "\t" for TSV). */
  delimiter?: string
  /** Treat the first record of `value` as a header row. Defaults to true. */
  hasHeader?: boolean
  /** Show the leading row-number column. Defaults to true. */
  showRowNumbers?: boolean
  /**
   * Virtualize rows and columns so only the visible window is in the DOM.
   * Defaults to true. Set false to render every cell (simpler, fine for small
   * tables; heavy for large ones).
   */
  virtualized?: boolean
  /**
   * Number of rows to render beyond the visible window when virtualizing, and
   * the default for columns. Higher values reduce blank flashes while
   * fast-scrolling at the cost of more DOM nodes. Defaults to 8. Ignored when
   * `virtualized` is false.
   */
  overscan?: number
  /**
   * Number of columns to render beyond the visible window when virtualizing.
   * Defaults to `overscan`. Tune separately from rows for very wide tables.
   */
  columnOverscan?: number
  /** Row height in pixels. Defaults to 33. */
  rowHeight?: number
  /** Column width in pixels. Defaults to 180. */
  columnWidth?: number
  /** Zoom multiplier on row height, column width, and font size. Defaults to 1. */
  scale?: number
  /**
   * Show the zoom controls in the footer. Defaults to true. Set false when a
   * host drives zoom through `scale` (e.g. file-viewer's toolbar), so there's
   * one zoom control rather than two.
   */
  showZoom?: boolean
  /**
   * Show the download button in the toolbar. Defaults to true. Set false when a
   * host wraps the viewer in its own chrome that already provides a download
   * action (e.g. file-viewer's DocShell), so there's one button rather than two.
   */
  showDownload?: boolean
  /** Scroll viewport height in pixels. Defaults to 480. Ignored when `fillHeight`. */
  height?: number
  /**
   * Fill the parent's height instead of using a fixed `height`: the body flexes
   * to fill the space between the header and footer. The parent must give the
   * component a definite height (e.g. a flex column with `min-h-0`). Defaults to
   * false.
   */
  fillHeight?: boolean
  /** Accessible label for the table. Defaults to "CSV data". */
  label?: string
  /** A cell to highlight (0-based row + column among data columns), or null. */
  activeCell?: { row: number; col: number } | null
  /**
   * Render the scrolling table inside a shadow root, isolating it from the host
   * page's style rules — in particular `:has()` selectors, whose invalidation
   * Blink does NOT scope by `contain`. On a page with a large `:has()` surface
   * (e.g. a Tailwind `has-*`-heavy docs site) every per-scroll cell mutation
   * otherwise forces a full-document `:has()` re-match, costing ~33ms of style
   * recalc per frame and capping scrolling near ~15fps. Isolation scopes that
   * work to the table's own small subtree, collapsing recalc to ~0.4ms and
   * keeping scroll at refresh rate. The page's author CSS is copied in (via
   * `adoptedStyleSheets`, falling back to cloned `<style>`/`<link>` nodes) so
   * utility classes still resolve; theme variables and font size inherit through
   * the boundary automatically. Defaults to false. Trade-offs when enabled: the
   * table is client-rendered only (no SSR markup), and host CSS can no longer
   * reach into the table to style or override it.
   */
  isolateStyles?: boolean
  className?: string
}

/** Imperative handle for `CsvViewer` — obtain it with a `ref`. */
export interface CsvViewerHandle {
  /** Scroll a 0-based (row, col) cell into view. */
  scrollToCell: (
    row: number,
    col: number,
    options?: { behavior?: ScrollBehavior }
  ) => void
  getViewportElement: () => HTMLDivElement | null
}

export const CsvViewer = React.forwardRef<CsvViewerHandle, CsvViewerProps>(
  function CsvViewer(
    {
      src,
      value,
      data,
      source,
      worker = true,
      batchSize = 5000,
      delimiter,
      hasHeader,
      showRowNumbers = true,
      virtualized = true,
      overscan = 8,
      columnOverscan,
      rowHeight = 33,
      columnWidth = 180,
      scale = 1,
      showZoom = true,
      showDownload = true,
      height = 480,
      fillHeight = false,
      label = "CSV data",
      activeCell,
      isolateStyles = false,
      className,
    }: CsvViewerProps,
    ref: React.ForwardedRef<CsvViewerHandle>
  ) {
    // A remote `src` is fetched to a Blob (cached per URL), then handed to the
    // same streaming path as a local `source` — so the URL entry point shares
    // all the worker/progressive-parse machinery rather than duplicating it.
    const [urlBlob, setUrlBlob] = React.useState<Blob | null>(null)
    const [urlError, setUrlError] = React.useState(false)
    React.useEffect(() => {
      if (!src) {
        setUrlBlob(null)
        setUrlError(false)
        return
      }
      let cancelled = false
      setUrlBlob(null)
      setUrlError(false)
      fetchCsvBlob(src).then(
        (blob) => !cancelled && setUrlBlob(blob),
        () => !cancelled && setUrlError(true)
      )
      return () => {
        cancelled = true
      }
    }, [src])
    // Fetching the blob is part of "loading"; until it lands there's no source,
    // so the stream stays empty without flashing the empty-state.
    const fetching = Boolean(src) && !urlBlob && !urlError
    const effectiveSource = src ? (urlBlob ?? undefined) : source

    const {
      columns: parsedColumns,
      rows: parsedRows,
      loading: dataLoading,
    } = useCsvData({
      data: src ? undefined : data,
      value: src ? undefined : value,
      source: effectiveSource,
      delimiter,
      hasHeader,
      worker,
      batchSize,
    })
    const loading = dataLoading || fetching

    // Sort is a single column + direction. We render straight from the raw
    // `string[][]` and, when sorted, keep only a lightweight array of row indices —
    // never per-row view objects — so a 200k-row file stays at data size in memory
    // instead of the hundreds of MB a full table row model would cost.
    const [sort, setSort] = React.useState<{
      index: number
      desc: boolean
    } | null>(null)
    const toggleSort = React.useCallback((index: number) => {
      setSort((s) =>
        !s || s.index !== index
          ? { index, desc: false }
          : s.desc
            ? null
            : { index, desc: true }
      )
    }, [])

    // `order` maps display position → source row index. Null means identity
    // (unsorted), so the common case allocates nothing.
    const order = React.useMemo<number[] | null>(() => {
      if (!sort) return null
      const idx = parsedRows.map((_, i) => i)
      const col = sort.index
      idx.sort((a, b) =>
        compareCells(parsedRows[a][col] ?? "", parsedRows[b][col] ?? "")
      )
      if (sort.desc) idx.reverse()
      return idx
    }, [parsedRows, sort])

    const rowAt = React.useCallback(
      (display: number): Row => parsedRows[order ? order[display] : display],
      [parsedRows, order]
    )

    const scrollRef = React.useRef<HTMLDivElement>(null)

    const colCount = parsedColumns.length
    const colOffset = showRowNumbers ? 1 : 0

    // Download the data as a CSV file. With a `src` URL we hand back the original
    // file byte-for-byte (the blob is already cached from the fetch that fed the
    // viewer, so this is free); otherwise — `value` / `data` / local `source` —
    // we serialize the parsed columns + rows, which matches what's on screen.
    const handleDownload = React.useCallback(async () => {
      const blob = src
        ? await fetchCsvBlob(src)
        : new Blob([serializeCsv(parsedColumns, parsedRows)], {
            type: "text/csv;charset=utf-8",
          })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = csvFileNameFromSrc(src)
      a.rel = "noreferrer"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }, [parsedColumns, parsedRows, src])

    // Zoom scales the track sizes and font; everything below derives from these.
    // The `scale` prop sets the baseline; the in-viewer +/- controls multiply it.
    const [zoom, setZoom] = React.useState(1)
    const effScale = scale * zoom
    const effRowHeight = Math.max(1, Math.round(rowHeight * effScale))
    const effColumnWidth = Math.max(1, Math.round(columnWidth * effScale))
    const effRowNumberWidth = Math.round(ROW_NUMBER_WIDTH * effScale)
    const fontSize = BASE_FONT * effScale

    const rowVirtualizer = useVirtualizer({
      count: parsedRows.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => effRowHeight,
      overscan,
    })

    const columnVirtualizer = useVirtualizer({
      horizontal: true,
      count: colCount,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => effColumnWidth,
      overscan: columnOverscan ?? overscan,
    })

    // Resolve the columns to render + the left/right spacer track widths. When
    // virtualization is off, render every column with zero padding.
    const { columnItems, leftPad, rightPad } = React.useMemo<{
      columnItems: ColumnItem[]
      leftPad: number
      rightPad: number
    }>(() => {
      if (!virtualized) {
        return {
          columnItems: parsedColumns.map((_, index) => ({
            index,
            size: effColumnWidth,
          })),
          leftPad: 0,
          rightPad: 0,
        }
      }
      const items = columnVirtualizer.getVirtualItems()
      const total = columnVirtualizer.getTotalSize()
      const left = items.length ? items[0].start : 0
      const right = items.length ? total - items[items.length - 1].end : 0
      return {
        columnItems: items.map((it) => ({ index: it.index, size: it.size })),
        leftPad: left,
        rightPad: right,
      }
      // getVirtualItems is recomputed on scroll/resize; depend on its identity.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      virtualized,
      effColumnWidth,
      parsedColumns,
      columnVirtualizer.getVirtualItems(),
      columnVirtualizer.getTotalSize(),
    ])

    // Re-measure when zoom changes the track sizes.
    React.useEffect(() => {
      rowVirtualizer.measure()
      columnVirtualizer.measure()
    }, [effRowHeight, effColumnWidth, rowVirtualizer, columnVirtualizer])

    // Imperative handle: scroll a (row, col) cell into view. `col` is 0-based
    // among data columns (the row-number column isn't in the column virtualizer).
    React.useImperativeHandle(
      ref,
      () => ({
        scrollToCell: (row, col, options) => {
          const behavior = options?.behavior ?? "smooth"
          rowVirtualizer.scrollToIndex(row, { align: "center", behavior })
          columnVirtualizer.scrollToIndex(col, { align: "center", behavior })
        },
        getViewportElement: () => scrollRef.current,
      }),
      [rowVirtualizer, columnVirtualizer]
    )

    // Memoize so its identity is stable across vertical scroll (columnItems only
    // changes on horizontal scroll/resize). A stable gridTemplate keeps CsvRow's
    // props stable, so React.memo skips the rows that stay put and only the rows
    // entering the window re-render.
    const gridTemplate = React.useMemo(
      () =>
        buildGridTemplate({
          showRowNumbers,
          rowNumberWidth: effRowNumberWidth,
          leftPad,
          columnItems,
          rightPad,
        }),
      [showRowNumbers, effRowNumberWidth, leftPad, columnItems, rightPad]
    )
    const totalWidth =
      (showRowNumbers ? effRowNumberWidth : 0) + colCount * effColumnWidth
    const virtualRows = rowVirtualizer.getVirtualItems()

    return (
      <div
        data-slot="csv-viewer"
        role="table"
        aria-label={label}
        aria-rowcount={parsedRows.length + 1}
        aria-colcount={colCount + colOffset}
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border bg-card",
          fillHeight && "min-h-0 flex-1",
          className
        )}
        style={{ fontSize }}
      >
        {/* Toolbar: row/column counts + zoom. Top-aligned to match the other file
            viewers' chrome (this was previously a bottom footer). */}
        <div className="flex shrink-0 items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {loading ? (
              <span
                aria-hidden
                className="size-2 animate-pulse rounded-full bg-primary"
              />
            ) : null}
            {parsedRows.length.toLocaleString()} row
            {parsedRows.length === 1 ? "" : "s"}
            {loading ? " · loading…" : ""}
          </span>
          <span className="flex items-center gap-2">
            <span>
              {colCount} column{colCount === 1 ? "" : "s"}
            </span>
            {showZoom ? (
              <span className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Zoom out"
                  title="Zoom out"
                  onClick={() =>
                    setZoom((z) => Math.max(0.25, Math.min(5, z / 1.2)))
                  }
                  className="inline-flex size-6 items-center justify-center rounded hover:bg-muted hover:text-foreground"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-10 text-center tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  aria-label="Zoom in"
                  title="Zoom in"
                  onClick={() =>
                    setZoom((z) => Math.max(0.25, Math.min(5, z * 1.2)))
                  }
                  className="inline-flex size-6 items-center justify-center rounded hover:bg-muted hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Reset zoom"
                  title="Reset zoom"
                  onClick={() => setZoom(1)}
                  className="inline-flex size-6 items-center justify-center rounded hover:bg-muted hover:text-foreground"
                >
                  <Maximize className="size-3.5" />
                </button>
              </span>
            ) : null}
            {showDownload ? (
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7"
                aria-label="Download"
                title="Download"
                onClick={handleDownload}
              >
                <Download />
              </Button>
            ) : null}
          </span>
        </div>
        {/* One scroll container: the header row and the data rows live in the same
          scroller, so they scroll together natively — no JS sync, so the columns
          stay locked to the header during horizontal scroll. The header sticks to
          the top during vertical scroll; the row-number column sticks to the
          left during horizontal scroll. */}
        <ScrollerShell
          isolate={isolateStyles}
          className={cn("relative", fillHeight && "min-h-0 flex-1")}
          style={fillHeight ? undefined : { height, maxHeight: "100%" }}
        >
          {/* Plain (non-hoisted) <style> so it lands inside the shadow root when
            isolated; the selector is attribute-scoped, so it's also harmless in
            the light-DOM path. */}
          <style>{SCROLLBAR_CSS}</style>
          <div
            ref={scrollRef}
            data-slot="csv-body"
            className="absolute inset-0 overflow-auto"
          >
            <div
              style={{
                width: totalWidth,
                minWidth: "100%",
                position: "relative",
              }}
            >
            {/* Header row — sticky to the top; same scroller as the rows below. */}
            <div
              role="row"
              aria-rowindex={1}
              data-slot="csv-header"
              className="sticky top-0 z-20 grid border-b"
              style={{
                gridTemplateColumns: gridTemplate,
                // `--muted` is a 4%-alpha tint (translucent by design), so it lets
                // scrolling rows show through. Blend two OPAQUE tokens instead — the
                // same pattern the gutter cells use — for a solid header.
                backgroundColor:
                  "color-mix(in oklab, var(--card) 92%, var(--foreground))",
              }}
            >
              {showRowNumbers ? (
                <div
                  role="columnheader"
                  aria-colindex={1}
                  aria-label="Row number"
                  className="sticky left-0 z-10 border-r bg-[color-mix(in_oklab,var(--card)_94%,var(--foreground))]"
                  style={{ height: effRowHeight }}
                />
              ) : null}
              <Spacer width={leftPad} />
              {columnItems.map((item) => (
                <HeaderCell
                  key={item.index}
                  name={parsedColumns[item.index] || `Column ${item.index + 1}`}
                  colIndex={colOffset + item.index + 1}
                  height={effRowHeight}
                  sorted={
                    sort?.index === item.index
                      ? sort.desc
                        ? "desc"
                        : "asc"
                      : false
                  }
                  onToggle={() => toggleSort(item.index)}
                />
              ))}
              <Spacer width={rightPad} />
            </div>

            {urlError ? (
              <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
                Couldn&apos;t load this file.
              </div>
            ) : parsedRows.length === 0 ? (
              // Stay blank while a source is still loading — only call it empty
              // once we know there are genuinely no rows.
              loading ? null : (
                <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
                  No rows
                </div>
              )
            ) : virtualized ? (
              // Absolutely-positioned rows in a spacer of the full virtual height.
              // The header above takes one row's height, so the virtualizer is off
              // by one row at the edges — the overscan window covers it.
              <div
                role="rowgroup"
                style={{
                  position: "relative",
                  height: rowVirtualizer.getTotalSize(),
                }}
              >
                {virtualRows.map((virtualRow) => (
                  <CsvRow
                    key={virtualRow.index}
                    cells={rowAt(virtualRow.index)}
                    index={virtualRow.index}
                    gridTemplate={gridTemplate}
                    rowHeight={effRowHeight}
                    showRowNumbers={showRowNumbers}
                    colOffset={colOffset}
                    columnItems={columnItems}
                    leftPad={leftPad}
                    rightPad={rightPad}
                    start={virtualRow.start}
                    activeCol={
                      activeCell?.row === virtualRow.index
                        ? activeCell.col
                        : null
                    }
                  />
                ))}
              </div>
            ) : (
              <div role="rowgroup">
                {parsedRows.map((_, index) => (
                  <CsvRow
                    key={index}
                    cells={rowAt(index)}
                    index={index}
                    gridTemplate={gridTemplate}
                    rowHeight={effRowHeight}
                    showRowNumbers={showRowNumbers}
                    colOffset={colOffset}
                    columnItems={columnItems}
                    leftPad={leftPad}
                    rightPad={rightPad}
                    activeCol={
                      activeCell?.row === index ? activeCell.col : null
                    }
                  />
                ))}
              </div>
            )}
            </div>
          </div>
          <HeaderAwareScrollbar
            scrollRef={scrollRef}
            headerHeight={effRowHeight}
          />
        </ScrollerShell>
      </div>
    )
  }
)

function buildGridTemplate({
  showRowNumbers,
  rowNumberWidth,
  leftPad,
  columnItems,
  rightPad,
}: {
  showRowNumbers: boolean
  rowNumberWidth: number
  leftPad: number
  columnItems: ColumnItem[]
  rightPad: number
}) {
  const cols = columnItems.map((c) => `${c.size}px`).join(" ")
  return [
    showRowNumbers ? `${rowNumberWidth}px` : null,
    `${leftPad}px`,
    cols,
    `${rightPad}px`,
  ]
    .filter(Boolean)
    .join(" ")
}

function Spacer({ width }: { width: number }) {
  // Always rendered (even at 0px) so the DOM track count matches the template.
  return <div role="presentation" aria-hidden style={{ width }} />
}

function HeaderCell({
  name,
  colIndex,
  height,
  sorted,
  onToggle,
}: {
  name: string
  colIndex: number
  height: number
  sorted: "asc" | "desc" | false
  onToggle: () => void
}) {
  return (
    <div
      role="columnheader"
      aria-colindex={colIndex}
      aria-sort={
        sorted === "asc"
          ? "ascending"
          : sorted === "desc"
            ? "descending"
            : "none"
      }
      data-slot="csv-header-cell"
      className="border-r last:border-r-0"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1 px-3 text-left font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none"
        style={{ height }}
        title={`Sort by ${name}`}
      >
        <span className="truncate">{name}</span>
        {sorted ? (
          sorted === "asc" ? (
            <ChevronUp
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : (
            <ChevronDown
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )
        ) : null}
      </button>
    </div>
  )
}

/** Alphanumeric compare: numeric when both sides parse as finite numbers. */
function compareCells(a: string, b: string): number {
  const na = Number(a)
  const nb = Number(b)
  if (a !== "" && b !== "" && !Number.isNaN(na) && !Number.isNaN(nb)) {
    return na - nb
  }
  return a < b ? -1 : a > b ? 1 : 0
}

const CsvRow = React.memo(function CsvRow({
  cells,
  index,
  gridTemplate,
  rowHeight,
  showRowNumbers,
  colOffset,
  columnItems,
  leftPad,
  rightPad,
  start,
  activeCol,
}: {
  cells: Row | undefined
  index: number
  gridTemplate: string
  rowHeight: number
  showRowNumbers: boolean
  colOffset: number
  columnItems: ColumnItem[]
  leftPad: number
  rightPad: number
  /** Absolute Y offset when virtualized; undefined renders in normal flow. */
  start?: number
  /** Data-column index to highlight in this row, or null. */
  activeCol?: number | null
}) {
  // Built from primitive props so a row that stays in the window keeps a stable
  // identity and React.memo skips it — only rows entering the window re-render.
  const style: React.CSSProperties =
    start === undefined
      ? { gridTemplateColumns: gridTemplate, height: rowHeight }
      : {
          gridTemplateColumns: gridTemplate,
          height: rowHeight,
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          transform: `translateY(${start}px)`,
        }
  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      data-slot="csv-row"
      className="group grid border-b hover:bg-muted/40"
      style={style}
    >
      {showRowNumbers ? (
        <div
          role="rowheader"
          aria-colindex={1}
          data-slot="csv-row-number"
          className="sticky left-0 z-[1] flex items-center justify-end border-r bg-card px-2 text-muted-foreground tabular-nums group-hover:bg-[color-mix(in_oklab,var(--card)_97%,var(--foreground))]"
        >
          {index + 1}
        </div>
      ) : null}
      <Spacer width={leftPad} />
      {columnItems.map((item) => {
        const text = cells?.[item.index] ?? ""
        const lit = activeCol === item.index
        return (
          <div
            key={item.index}
            role="cell"
            aria-colindex={colOffset + item.index + 1}
            data-slot="csv-cell"
            className={cn(
              "flex items-center truncate border-r px-3 last:border-r-0",
              lit &&
                "bg-primary/12 ring-1 ring-primary/50 ring-offset-0 ring-inset"
            )}
            title={text}
          >
            <span className="truncate">{text}</span>
          </div>
        )
      })}
      <Spacer width={rightPad} />
    </div>
  )
})

interface CsvDataState {
  columns: string[]
  rows: string[][]
  loading: boolean
}

/**
 * Resolve the table's data from one of three inputs:
 * - `data`: already parsed (sync).
 * - `value`: a CSV string, parsed synchronously (fine for small inputs).
 * - `source`: a Blob/File/string streamed off the render path (worker when
 *   available, else a time-sliced main-thread reader), with rows appended
 *   progressively.
 */
function useCsvData({
  data,
  value,
  source,
  delimiter,
  hasHeader = true,
  worker = true,
  batchSize = 5000,
}: {
  data?: ParsedCsv
  value?: string
  source?: Blob | string
  delimiter?: string
  hasHeader?: boolean
  worker?: boolean
  batchSize?: number
}): CsvDataState {
  const sync = React.useMemo<ParsedCsv | null>(() => {
    if (data) return data
    if (source == null && value != null) {
      return parseCsv(value, { delimiter, hasHeader })
    }
    return null
  }, [data, value, source, delimiter, hasHeader])

  const [stream, setStream] = React.useState<CsvDataState>({
    columns: [],
    rows: [],
    loading: false,
  })

  React.useEffect(() => {
    if (source == null) return

    let cancelled = false
    const controller = new AbortController()
    const rows: string[][] = []
    let cols: string[] = []
    setStream({ columns: [], rows: [], loading: true })

    const onColumns = (c: string[]) => {
      if (cancelled) return
      cols = c
      setStream((s) => ({ ...s, columns: c }))
    }
    const onRows = (batch: string[][]) => {
      if (cancelled) return
      for (const r of batch) rows.push(r)
      setStream({ columns: cols, rows: rows.slice(), loading: true })
    }
    const onDone = () => {
      if (cancelled) return
      setStream((s) => ({ ...s, loading: false }))
    }

    const runMainThread = () =>
      void streamCsv(
        source,
        { onColumns, onRows, onDone, onError: onDone },
        { delimiter, hasHeader, batchSize, signal: controller.signal }
      )

    let w: Worker | null = null
    if (worker && typeof Worker !== "undefined") {
      try {
        w = buildCsvWorker()
        w.onmessage = (event: MessageEvent) => {
          const m = event.data
          if (m.type === "columns") onColumns(m.columns)
          else if (m.type === "rows") onRows(m.rows)
          else if (m.type === "done" || m.type === "error") {
            onDone()
            w?.terminate()
          }
        }
        w.onerror = () => {
          w?.terminate()
          w = null
          if (!cancelled) runMainThread()
        }
        w.postMessage({ source, delimiter, hasHeader, batchSize })
      } catch {
        w = null
        runMainThread()
      }
    } else {
      runMainThread()
    }

    return () => {
      cancelled = true
      controller.abort()
      try {
        w?.terminate()
      } catch {
        // ignore
      }
    }
  }, [source, delimiter, hasHeader, worker, batchSize])

  if (sync) return { columns: sync.columns, rows: sync.rows, loading: false }
  return stream
}

/**
 * Build a self-contained CSV worker by serializing the parser into a Blob URL.
 * This keeps the worker dependency-free (no separate bundled file) while sharing
 * one source of truth for parsing. The worker reads a Blob with `.text()` so the
 * full string is never materialized on the main thread.
 */
function buildCsvWorker(): Worker {
  const src =
    "var createCsvParser = " +
    createCsvParser.toString() +
    ";\n" +
    "self.onmessage = async function (e) {\n" +
    "  var d = e.data, source = d.source, delimiter = d.delimiter, hasHeader = d.hasHeader, batchSize = d.batchSize || 5000;\n" +
    "  try {\n" +
    "    var text = typeof source === 'string' ? source : await source.text();\n" +
    "    var parser = createCsvParser({ delimiter: delimiter });\n" +
    "    var records = parser.push(text).concat(parser.flush());\n" +
    "    var width = 0, columns = [], start = 0;\n" +
    "    if (records.length) {\n" +
    "      if (hasHeader) { columns = records[0]; width = columns.length; start = 1; }\n" +
    "      else { width = records[0].length; for (var k = 0; k < width; k++) columns.push('Column ' + (k + 1)); }\n" +
    "    }\n" +
    "    self.postMessage({ type: 'columns', columns: columns });\n" +
    "    var batch = [];\n" +
    "    for (var i = start; i < records.length; i++) {\n" +
    "      var rec = records[i];\n" +
    "      if (rec.length < width) { while (rec.length < width) rec.push(''); }\n" +
    "      else if (rec.length > width) { rec = rec.slice(0, width); }\n" +
    "      batch.push(rec);\n" +
    "      if (batch.length >= batchSize) { self.postMessage({ type: 'rows', rows: batch }); batch = []; }\n" +
    "    }\n" +
    "    if (batch.length) self.postMessage({ type: 'rows', rows: batch });\n" +
    "    self.postMessage({ type: 'done' });\n" +
    "  } catch (err) { self.postMessage({ type: 'error', message: String(err) }); }\n" +
    "};\n"
  const blob = new Blob([src], { type: "text/javascript" })
  return new Worker(URL.createObjectURL(blob))
}

export { type ParsedCsv }
