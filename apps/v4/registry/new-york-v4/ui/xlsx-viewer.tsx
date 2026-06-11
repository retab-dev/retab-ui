"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Download, Maximize, Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

// The heavy SheetJS parse runs in a Web Worker (see ./xlsx-viewer.worker), so a
// large workbook never freezes the UI thread. The worker owns @e965/xlsx and
// flattens each sheet into a compact shape (one text blob + transferable typed
// arrays) so crossing the worker boundary costs a string clone, not a clone of
// every cell object. The main thread reads cells synchronously off that — O(1),
// no re-materialization — and the parser never enters the main bundle.

/** One sheet, flattened for cheap transfer and O(1) reads. */
interface CompactSheet {
  name: string
  rows: number
  cols: number
  /** All cell texts concatenated in row-major order. */
  text: string
  /** Length rows*cols+1; cell `i`'s text is text.slice(offsets[i], offsets[i+1]). */
  offsets: Uint32Array
  /** Length rows*cols; 1 = numeric/date. */
  numeric: Uint8Array
}

type XlsxWorkerResponse =
  | { ok: true; sheets: CompactSheet[] }
  | { ok: false; error: string }

// --- workbook model ----------------------------------------------------------

interface Cell {
  /** Display text — the workbook's formatted value (Excel's "w"), not raw. */
  text: string
  /** Right-align numbers, like Excel. */
  numeric: boolean
}

interface SheetMeta {
  name: string
  rowCount: number
  colCount: number
}

interface XlsxSource {
  sheets: SheetMeta[]
  /**
   * Read one cell synchronously from the compact sheet — a typed-array index plus
   * a string slice. Memory stays flat regardless of size.
   */
  getCell(sheetIndex: number, row: number, col: number): Cell
}

async function buildXlsxSource(src: string): Promise<XlsxSource> {
  // Fetching is async I/O (no CPU on the UI thread); the bytes are then handed
  // off to the worker for the expensive parse.
  const res = await fetch(src)
  if (!res.ok) throw new Error(`Failed to load spreadsheet: ${res.status}`)
  const buf = await res.arrayBuffer()

  const compact = await parseInWorker(buf)
  const sheets: SheetMeta[] = compact.map((s) => ({
    name: s.name,
    rowCount: s.rows,
    colCount: s.cols,
  }))

  const getCell = (sheetIndex: number, row: number, col: number): Cell => {
    const s = compact[sheetIndex]
    if (!s || row >= s.rows || col >= s.cols) return EMPTY_CELL
    const idx = row * s.cols + col
    const start = s.offsets[idx]
    const end = s.offsets[idx + 1]
    if (start === end) return EMPTY_CELL // empty cell
    return { text: s.text.slice(start, end), numeric: s.numeric[idx] === 1 }
  }

  return { sheets, getCell }
}

/**
 * Parse the workbook off the main thread. The ArrayBuffer is transferred (not
 * copied) into the worker; the compact sheets come back with their typed arrays
 * transferred (zero-copy) and the worker is terminated.
 */
function parseInWorker(buffer: ArrayBuffer): Promise<CompactSheet[]> {
  return new Promise((resolve, reject) => {
    if (typeof Worker === "undefined") {
      reject(new Error("Web Workers are unavailable in this environment"))
      return
    }
    const worker = new Worker(
      new URL("./xlsx-viewer.worker", import.meta.url),
      { type: "module" }
    )
    worker.onmessage = (event: MessageEvent<XlsxWorkerResponse>) => {
      const data = event.data
      worker.terminate()
      if (data.ok) resolve(data.sheets)
      else reject(new Error(data.error))
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || "Spreadsheet worker failed"))
    }
    worker.postMessage({ buffer }, [buffer])
  })
}

const EMPTY_CELL: Cell = { text: "", numeric: false }

// --- resource cache: stable promises so React `use()` can read them ----------

const sourceCache = new Map<string, Promise<XlsxSource>>()
function getXlsxSource(src: string): Promise<XlsxSource> {
  let promise = sourceCache.get(src)
  if (!promise) {
    promise = buildXlsxSource(src)
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

/** Spreadsheet column label: 0 → A, 25 → Z, 26 → AA … */
function colLabel(index: number): string {
  let i = index + 1
  let label = ""
  while (i > 0) {
    const m = (i - 1) % 26
    label = String.fromCharCode(65 + m) + label
    i = Math.floor((i - 1) / 26)
  }
  return label
}

// Base track sizes at 100% zoom; everything scales linearly with `scale`.
const BASE_ROW_HEIGHT = 28
const BASE_COL_WIDTH = 128
const BASE_GUTTER = 52
const BASE_FONT = 13

// A native vertical scrollbar spans the full scroller height and paints on top
// of everything (z-index can't cover it), so it overlaps the sticky header. Hide
// the vertical bar (WebKit) and draw a custom thumb below the header instead;
// keep the native horizontal bar, styled to match.
const SCROLLBAR_CSS = `
[data-slot="xlsx-body"]::-webkit-scrollbar { width: 10px; height: 10px; }
[data-slot="xlsx-body"]::-webkit-scrollbar:vertical { display: none; }
[data-slot="xlsx-body"]::-webkit-scrollbar-track { background: transparent; }
[data-slot="xlsx-body"]::-webkit-scrollbar-thumb {
  background-color: color-mix(in oklab, var(--foreground) 22%, transparent);
  border-radius: 9999px;
  border: 3px solid transparent;
  background-clip: content-box;
}
[data-slot="xlsx-body"]::-webkit-scrollbar-thumb:hover {
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

interface ColumnItem {
  index: number
  size: number
}

// --- public API --------------------------------------------------------------

export interface XlsxViewerProps {
  /** URL of the .xlsx/.xls (same-origin or CORS-enabled). */
  src: string
  className?: string
  toolbar?: boolean
  downloadFileName?: string
  /** Sheet shown first. Defaults to 0. */
  defaultSheetIndex?: number
  /** Fired with the active sheet index when the user switches tabs. */
  onSheetChange?: (index: number) => void
  /** Drop the outer border/rounded/background so the viewer fills its container. */
  bare?: boolean
  /** Rendered as a full-width strip directly below the toolbar (e.g. a legend). */
  header?: React.ReactNode
  /** Rendered as a left rail alongside the grid. */
  aside?: React.ReactNode
  /** A cell to highlight (0-based row + column on `sheet`), or null. */
  activeCell?: { sheet: number; row: number; col: number } | null
}

/** Imperative handle for `XlsxViewer` — obtain it with a `ref`. */
export interface XlsxViewerHandle {
  /** Switch to `sheet` and scroll a 0-based (row, col) cell into view. */
  scrollToCell: (
    sheet: number,
    row: number,
    col: number,
    options?: { behavior?: ScrollBehavior }
  ) => void
}

/** A pending scroll request for the active sheet's grid. */
type XlsxScrollRequest = {
  sheet: number
  row: number
  col: number
  behavior: ScrollBehavior
  nonce: number
}

export const XlsxViewer = React.forwardRef<XlsxViewerHandle, XlsxViewerProps>(
  function XlsxViewer(props, ref) {
    const isClient = useIsClient()
    if (!isClient) {
      return (
        <XlsxViewerFallback className={props.className} bare={props.bare} />
      )
    }
    return (
      <XlsxErrorBoundary className={props.className}>
        <React.Suspense
          fallback={
            <XlsxViewerFallback className={props.className} bare={props.bare} />
          }
        >
          <XlsxViewerInner {...props} forwardedRef={ref} />
        </React.Suspense>
      </XlsxErrorBoundary>
    )
  }
)

function XlsxViewerInner({
  src,
  className,
  toolbar = true,
  downloadFileName,
  defaultSheetIndex = 0,
  onSheetChange,
  bare = false,
  header,
  aside,
  activeCell,
  forwardedRef,
}: XlsxViewerProps & {
  forwardedRef?: React.ForwardedRef<XlsxViewerHandle>
}) {
  const [activeSheet, setActiveSheet] = React.useState(
    Math.max(0, defaultSheetIndex)
  )
  const [scale, setScale] = React.useState(1)
  const [scrollReq, setScrollReq] = React.useState<XlsxScrollRequest | null>(
    null
  )
  const scrollNonce = React.useRef(0)

  // The grid body (<XlsxSheet>) reads the workbook and reports its sheet metadata
  // up here, so the shell, toolbar (name/size), and bottom tab bar paint
  // immediately and only the grid suspends while the worker parses the file. The
  // zoom controls need no source. `null` = not parsed yet.
  const [sheets, setSheets] = React.useState<SheetMeta[] | null>(null)
  const sheetCount = sheets?.length ?? 0
  const ready = sheets != null
  const handleReport = React.useCallback((next: SheetMeta[]) => {
    setSheets(next)
    // Pull the active index back in range if the new workbook has fewer sheets.
    setActiveSheet((a) => clamp(a, 0, Math.max(0, next.length - 1)))
  }, [])
  // Re-skeleton the chrome when the source changes — during render, not in an
  // effect. A parent reset effect runs *after* the body's report effect when a
  // cached workbook mounts in the same commit (child effects fire before parent
  // effects), which would clobber the report back to null and wedge the toolbar
  // and tab bar at skeleton forever. This render-phase reset only fires on an
  // actual src change and lands before any child effect.
  const [metaSrc, setMetaSrc] = React.useState(src)
  if (metaSrc !== src) {
    setMetaSrc(src)
    setSheets(null)
  }

  const selectSheet = (index: number) => {
    setActiveSheet(index)
    onSheetChange?.(index)
  }
  const zoom = (factor: number) => setScale((s) => clamp(s * factor, 0.5, 4))

  // Imperative handle: switch sheet + queue a scroll. The target sheet's grid is
  // keyed per sheet, so it (re)mounts with the request and scrolls on commit.
  React.useImperativeHandle(
    forwardedRef,
    () => ({
      scrollToCell: (sheet, row, col, options) => {
        setActiveSheet(sheet)
        scrollNonce.current += 1
        setScrollReq({
          sheet,
          row,
          col,
          behavior: options?.behavior ?? "smooth",
          nonce: scrollNonce.current,
        })
      },
    }),
    []
  )

  const sheet = sheets?.[activeSheet]

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="xlsx-viewer"
    >
      {toolbar ? (
        <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
          <span className="truncate px-1 text-xs font-medium">
            {ready ? (
              (sheet?.name ?? "—")
            ) : (
              // Sheet name is unknown until the workbook parses — skeleton it.
              <Skeleton className="inline-block h-3 w-24 align-middle" />
            )}
          </span>
          <span className="hidden px-1 text-xs text-muted-foreground tabular-nums sm:inline">
            {ready ? (
              sheet ? (
                `${sheet.rowCount.toLocaleString()} × ${sheet.colCount}`
              ) : (
                ""
              )
            ) : (
              <Skeleton className="inline-block h-3 w-16 align-middle" />
            )}
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
            <IconButton label="Actual size" onClick={() => setScale(1)}>
              <Maximize />
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
          <div data-slot="xlsx-viewer-aside" className="flex-shrink-0">
            {aside}
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {header ? <div data-slot="xlsx-viewer-header">{header}</div> : null}
          {/* Only the grid suspends while the workbook parses; a grid-shaped
              skeleton stands in so the shell never changes size. */}
          <React.Suspense fallback={<XlsxGridSkeleton />}>
            <XlsxSheet
              src={src}
              activeSheet={activeSheet}
              scale={scale}
              onReport={handleReport}
              activeCell={activeCell}
              scrollReq={scrollReq}
            />
          </React.Suspense>
        </div>
      </div>

      {sheets && sheets.length > 1 ? (
        <div
          data-slot="xlsx-viewer-tabs"
          className="flex flex-shrink-0 items-stretch gap-0.5 overflow-x-auto border-t bg-card px-1.5 py-1"
        >
          {sheets.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectSheet(i)}
              title={s.name}
              data-active={i === activeSheet}
              className={cn(
                "max-w-[10rem] flex-shrink-0 truncate rounded-md px-2.5 py-1 text-xs transition-colors",
                i === activeSheet
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60"
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// The grid body. This is the only part that reads the workbook, so it is the
// only part that suspends while the worker parses the file — the shell, toolbar,
// and tab bar above/below it have already painted. It reports the sheet metadata
// up to the chrome, then renders the active sheet's virtualized grid.
function XlsxSheet({
  src,
  activeSheet,
  scale,
  onReport,
  activeCell,
  scrollReq,
}: {
  src: string
  activeSheet: number
  scale: number
  onReport: (sheets: SheetMeta[]) => void
  activeCell?: { sheet: number; row: number; col: number } | null
  scrollReq?: XlsxScrollRequest | null
}) {
  const source = React.use(getXlsxSource(src))

  // Hand the sheet metadata up so the toolbar (name/size) and tab bar can render
  // from it. Fires once per workbook.
  React.useEffect(() => {
    onReport(source.sheets)
  }, [source, onReport])

  // Guard the index: the parent may still hold a stale (out-of-range) active
  // sheet for the frame before its clamping report lands.
  const safeIndex = clamp(activeSheet, 0, Math.max(0, source.sheets.length - 1))
  const sheet = source.sheets[safeIndex]
  const getCell = React.useCallback(
    (row: number, col: number) => source.getCell(safeIndex, row, col),
    [source, safeIndex]
  )

  const cellInSheet =
    activeCell && activeCell.sheet === safeIndex
      ? { row: activeCell.row, col: activeCell.col }
      : null
  const reqInSheet =
    scrollReq && scrollReq.sheet === safeIndex ? scrollReq : null

  return (
    // key on the sheet so the virtualizer resets cleanly per sheet.
    <SheetGrid
      key={safeIndex}
      rowCount={sheet?.rowCount ?? 0}
      colCount={sheet?.colCount ?? 0}
      getCell={getCell}
      scale={scale}
      activeCell={cellInSheet}
      scrollReq={reqInSheet}
    />
  )
}

function SheetGrid({
  rowCount,
  colCount,
  getCell,
  scale,
  activeCell,
  scrollReq,
}: {
  rowCount: number
  colCount: number
  getCell: (row: number, col: number) => Cell
  scale: number
  activeCell?: { row: number; col: number } | null
  scrollReq?: XlsxScrollRequest | null
}) {
  const rowHeight = Math.round(BASE_ROW_HEIGHT * scale)
  const colWidth = Math.round(BASE_COL_WIDTH * scale)
  const gutterWidth = Math.round(BASE_GUTTER * scale)
  const fontSize = BASE_FONT * scale

  const scrollRef = React.useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  })
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: colCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => colWidth,
    overscan: 4,
  })

  // Re-measure when zoom changes the track sizes.
  React.useEffect(() => {
    rowVirtualizer.measure()
    columnVirtualizer.measure()
  }, [rowHeight, colWidth, rowVirtualizer, columnVirtualizer])

  // Scroll to a requested cell. Keyed on the request nonce so the same cell can
  // be re-requested (e.g. after switching away and back).
  const reqNonce = scrollReq?.nonce
  React.useEffect(() => {
    if (!scrollReq) return
    rowVirtualizer.scrollToIndex(scrollReq.row, {
      align: "center",
      behavior: scrollReq.behavior,
    })
    columnVirtualizer.scrollToIndex(scrollReq.col, {
      align: "center",
      behavior: scrollReq.behavior,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqNonce])

  const { columnItems, leftPad, rightPad } = React.useMemo(() => {
    const items = columnVirtualizer.getVirtualItems()
    const total = columnVirtualizer.getTotalSize()
    const left = items.length ? items[0].start : 0
    const right = items.length ? total - items[items.length - 1].end : 0
    return {
      columnItems: items.map((it) => ({
        index: it.index,
        size: it.size,
      })) as ColumnItem[],
      leftPad: left,
      rightPad: right,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    colWidth,
    columnVirtualizer.getVirtualItems(),
    columnVirtualizer.getTotalSize(),
  ])

  // Memoized so its identity is stable across vertical scroll, keeping SheetRow's
  // props stable so React.memo can skip rows that stay in the window.
  const gridTemplate = React.useMemo(
    () => buildGridTemplate({ gutterWidth, leftPad, columnItems, rightPad }),
    [gutterWidth, leftPad, columnItems, rightPad]
  )
  const totalWidth = gutterWidth + colCount * colWidth
  const virtualRows = rowVirtualizer.getVirtualItems()

  if (rowCount === 0 || colCount === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-card text-xs text-muted-foreground">
        Empty sheet
      </div>
    )
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-card"
      style={{ fontSize }}
      data-slot="xlsx-grid"
    >
      {/* One scroll container: the header and rows scroll together natively, so
          the column letters stay locked to the cells during horizontal scroll
          (no JS sync). The header sticks to the top; the gutter sticks to the
          left. */}
      <div className="relative min-h-0 flex-1">
        <style href="xlsx-scrollbar" precedence="default">
          {SCROLLBAR_CSS}
        </style>
        <div
          ref={scrollRef}
          data-slot="xlsx-body"
          className="absolute inset-0 overflow-auto"
        >
          <div
            style={{ width: totalWidth, minWidth: "100%", position: "relative" }}
          >
            {/* Header row (column letters) — sticky to the top. */}
          <div
            className="sticky top-0 z-20 grid border-b"
            style={{
              gridTemplateColumns: gridTemplate,
              height: rowHeight,
              // `--muted` is a 4%-alpha tint (translucent by design), so it lets
              // scrolling rows show through. Blend two OPAQUE tokens instead — the
              // same pattern the gutter cells use — for a solid header.
              backgroundColor:
                "color-mix(in oklab, var(--card) 92%, var(--foreground))",
            }}
            aria-hidden
          >
            <div
              className="sticky left-0 z-10 border-r bg-[color-mix(in_oklab,var(--card)_94%,var(--foreground))]"
              style={{ height: rowHeight }}
            />
            <Spacer width={leftPad} />
            {columnItems.map((item) => (
              <div
                key={item.index}
                className="flex items-center justify-center border-r font-medium text-muted-foreground last:border-r-0"
              >
                {colLabel(item.index)}
              </div>
            ))}
            <Spacer width={rightPad} />
          </div>

          {/* Absolutely-positioned rows; the sticky header above takes one row's
              height, so the virtualizer is off by one row at the edges — the
              overscan window covers it. */}
          <div
            style={{
              position: "relative",
              height: rowVirtualizer.getTotalSize(),
            }}
          >
            {virtualRows.map((virtualRow) => (
              <SheetRow
                key={virtualRow.index}
                rowIndex={virtualRow.index}
                getCell={getCell}
                gridTemplate={gridTemplate}
                rowHeight={rowHeight}
                columnItems={columnItems}
                leftPad={leftPad}
                rightPad={rightPad}
                start={virtualRow.start}
                activeCol={
                  activeCell?.row === virtualRow.index ? activeCell.col : null
                }
              />
            ))}
          </div>
          </div>
        </div>
        <HeaderAwareScrollbar scrollRef={scrollRef} headerHeight={rowHeight} />
      </div>
    </div>
  )
}

// Memoized so a horizontal scroll (which only shifts columnItems) or a vertical
// scroll re-renders just the rows whose props actually changed.
const SheetRow = React.memo(function SheetRow({
  rowIndex,
  getCell,
  gridTemplate,
  rowHeight,
  columnItems,
  leftPad,
  rightPad,
  start,
  activeCol,
}: {
  rowIndex: number
  getCell: (row: number, col: number) => Cell
  gridTemplate: string
  rowHeight: number
  columnItems: ColumnItem[]
  leftPad: number
  rightPad: number
  /** Absolute Y offset of the virtualized row. */
  start: number
  /** Column index to highlight in this row, or null. */
  activeCol?: number | null
}) {
  // Built from primitive props so a stationary row keeps a stable identity and
  // React.memo skips it — only rows entering the window re-render.
  const style: React.CSSProperties = {
    gridTemplateColumns: gridTemplate,
    height: rowHeight,
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    transform: `translateY(${start}px)`,
  }
  return (
    <div className="group grid border-b hover:bg-muted/40" style={style}>
      <div className="sticky left-0 z-[1] flex items-center justify-end border-r bg-card px-2 text-muted-foreground tabular-nums group-hover:bg-[color-mix(in_oklab,var(--card)_97%,var(--foreground))]">
        {rowIndex + 1}
      </div>
      <Spacer width={leftPad} />
      {columnItems.map((item) => {
        const cell = getCell(rowIndex, item.index)
        const lit = activeCol === item.index
        return (
          <div
            key={item.index}
            className={cn(
              "flex items-center truncate border-r px-2 last:border-r-0",
              cell.numeric ? "justify-end tabular-nums" : "justify-start",
              lit && "bg-primary/12 ring-1 ring-primary/50 ring-inset"
            )}
            title={cell.text}
          >
            <span className="truncate">{cell.text}</span>
          </div>
        )
      })}
      <Spacer width={rightPad} />
    </div>
  )
})

function buildGridTemplate({
  gutterWidth,
  leftPad,
  columnItems,
  rightPad,
}: {
  gutterWidth: number
  leftPad: number
  columnItems: ColumnItem[]
  rightPad: number
}) {
  const cols = columnItems.map((c) => `${c.size}px`).join(" ")
  return [`${gutterWidth}px`, `${leftPad}px`, cols, `${rightPad}px`]
    .filter(Boolean)
    .join(" ")
}

function Spacer({ width }: { width: number }) {
  return <div aria-hidden style={{ width }} />
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
// the loaded viewer — a toolbar with skeletoned values plus a grid-shaped
// skeleton — so the top bar is always present and nothing jumps when the real
// spreadsheet fades in.
function XlsxViewerFallback({
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
      data-slot="xlsx-viewer"
    >
      <XlsxToolbarSkeleton />
      <div className="flex min-h-0 flex-1">
        <XlsxGridSkeleton />
      </div>
    </div>
  )
}

// A static mirror of the real toolbar: the undetermined values (sheet name, size,
// zoom %) are skeletons; the controls are present but inert.
function XlsxToolbarSkeleton() {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      <span className="truncate px-1">
        <Skeleton className="inline-block h-3 w-24 align-middle" />
      </span>
      <span className="hidden px-1 sm:inline">
        <Skeleton className="inline-block h-3 w-16 align-middle" />
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

// A grid skeleton fills the body while the workbook parses (the SSR fallback and
// the grid-load suspense): a header row, a row-number gutter, and cell bars —
// the same shape as the real sheet, so nothing changes when the grid arrives.
function XlsxGridSkeleton() {
  const cols = 6
  const rows = 18
  const widths = [70, 45, 88, 56, 62, 78]
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card"
      data-slot="xlsx-grid"
      aria-hidden
    >
      {/* Header (column letters) */}
      <div className="flex border-b bg-muted/60">
        <div
          className="shrink-0 border-r"
          style={{ width: BASE_GUTTER, height: BASE_ROW_HEIGHT }}
        />
        {Array.from({ length: cols }, (_, c) => (
          <div
            key={c}
            className="flex shrink-0 items-center justify-center border-r"
            style={{ width: BASE_COL_WIDTH, height: BASE_ROW_HEIGHT }}
          >
            <Skeleton className="h-3 w-6" />
          </div>
        ))}
      </div>
      {/* Rows */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {Array.from({ length: rows }, (_, r) => (
          <div
            key={r}
            className="flex border-b"
            style={{ height: BASE_ROW_HEIGHT }}
          >
            <div
              className="flex shrink-0 items-center justify-end border-r px-2"
              style={{ width: BASE_GUTTER }}
            >
              <Skeleton className="h-3 w-4" />
            </div>
            {Array.from({ length: cols }, (_, c) => (
              <div
                key={c}
                className="flex shrink-0 items-center border-r px-2"
                style={{ width: BASE_COL_WIDTH }}
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

class XlsxErrorBoundary extends React.Component<
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
          Couldn&apos;t load this spreadsheet.
        </div>
      )
    }
    return this.props.children
  }
}
