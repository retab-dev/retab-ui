"use client"

import * as React from "react"
import { Download, Maximize, Minus, Plus } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"

// The heavy SheetJS parse runs in a Web Worker (see ./xlsx-viewer.worker), so a
// large workbook never freezes the UI thread. The worker owns @e965/xlsx and
// ships back the parsed worksheet objects; the main thread keeps a synchronous,
// O(1) lazy read off those objects, so the parser never enters the main bundle.

/** The fields of a SheetJS cell we actually read. */
interface RawCell {
  t?: string
  v?: unknown
  w?: string
}
type Worksheet = Record<string, RawCell | undefined>

type XlsxWorkerResponse =
  | { ok: true; sheets: SheetMeta[]; worksheets: Worksheet[] }
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
   * Read one cell on demand straight from the parsed worksheet. O(1), with no
   * per-sheet materialization — so opening a sheet and scrolling only ever touch
   * the cells in the visible window, and memory stays flat regardless of size.
   */
  getCell(sheetIndex: number, row: number, col: number): Cell
}

async function buildXlsxSource(src: string): Promise<XlsxSource> {
  // Fetching is async I/O (no CPU on the UI thread); the bytes are then handed
  // off to the worker for the expensive parse.
  const res = await fetch(src)
  if (!res.ok) throw new Error(`Failed to load spreadsheet: ${res.status}`)
  const buf = await res.arrayBuffer()

  const { sheets, worksheets } = await parseInWorker(buf)

  const getCell = (sheetIndex: number, row: number, col: number): Cell => {
    const ws = worksheets[sheetIndex]
    if (!ws) return EMPTY_CELL
    const cell = ws[`${colLabel(col)}${row + 1}`]
    if (!cell) return EMPTY_CELL
    const text = cell.w ?? (cell.v != null ? String(cell.v) : "")
    // Excel right-aligns numbers and dates.
    return { text, numeric: cell.t === "n" || cell.t === "d" }
  }

  return { sheets, getCell }
}

/**
 * Parse the workbook off the main thread. The ArrayBuffer is transferred (not
 * copied) into the worker; once the parsed worksheets come back the worker is
 * terminated, leaving only the data on the main thread.
 */
function parseInWorker(
  buffer: ArrayBuffer
): Promise<{ sheets: SheetMeta[]; worksheets: Worksheet[] }> {
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
      if (data.ok) resolve({ sheets: data.sheets, worksheets: data.worksheets })
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
}

export function XlsxViewer(props: XlsxViewerProps) {
  const isClient = useIsClient()
  if (!isClient) {
    return <XlsxViewerFallback className={props.className} bare={props.bare} />
  }
  return (
    <XlsxErrorBoundary className={props.className}>
      <React.Suspense
        fallback={<XlsxViewerFallback className={props.className} bare={props.bare} />}
      >
        <XlsxViewerInner {...props} />
      </React.Suspense>
    </XlsxErrorBoundary>
  )
}

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
}: XlsxViewerProps) {
  const source = React.use(getXlsxSource(src))
  const sheetCount = source.sheets.length

  const [activeSheet, setActiveSheet] = React.useState(() =>
    clamp(defaultSheetIndex, 0, Math.max(0, sheetCount - 1))
  )
  const [scale, setScale] = React.useState(1)

  const selectSheet = (index: number) => {
    setActiveSheet(index)
    onSheetChange?.(index)
  }
  const zoom = (factor: number) => setScale((s) => clamp(s * factor, 0.5, 4))

  const sheet = source.sheets[activeSheet]
  const getCell = React.useCallback(
    (row: number, col: number) => source.getCell(activeSheet, row, col),
    [source, activeSheet]
  )

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
        <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b bg-card px-2">
          <span className="truncate px-1 text-xs font-medium">
            {sheet?.name ?? "—"}
          </span>
          <span className="hidden px-1 text-xs text-muted-foreground tabular-nums sm:inline">
            {sheet ? `${sheet.rowCount.toLocaleString()} × ${sheet.colCount}` : ""}
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
          {/* key on the sheet so the virtualizer resets cleanly per sheet. */}
          <SheetGrid
            key={activeSheet}
            rowCount={sheet?.rowCount ?? 0}
            colCount={sheet?.colCount ?? 0}
            getCell={getCell}
            scale={scale}
          />
        </div>
      </div>

      {sheetCount > 1 ? (
        <div
          data-slot="xlsx-viewer-tabs"
          className="flex flex-shrink-0 items-stretch gap-0.5 overflow-x-auto border-t bg-card px-1.5 py-1"
        >
          {source.sheets.map((s, i) => (
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

function SheetGrid({
  rowCount,
  colCount,
  getCell,
  scale,
}: {
  rowCount: number
  colCount: number
  getCell: (row: number, col: number) => Cell
  scale: number
}) {
  const rowHeight = Math.round(BASE_ROW_HEIGHT * scale)
  const colWidth = Math.round(BASE_COL_WIDTH * scale)
  const gutterWidth = Math.round(BASE_GUTTER * scale)
  const fontSize = BASE_FONT * scale

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const headerScrollRef = React.useRef<HTMLDivElement>(null)

  // Mirror the body's horizontal scroll into the header (scroll, not transform,
  // so the sticky corner pins exactly like the body's gutter).
  const handleBodyScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = event.currentTarget.scrollLeft
    }
  }

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

  const { columnItems, leftPad, rightPad } = React.useMemo(() => {
    const items = columnVirtualizer.getVirtualItems()
    const total = columnVirtualizer.getTotalSize()
    const left = items.length ? items[0].start : 0
    const right = items.length ? total - items[items.length - 1].end : 0
    return {
      columnItems: items.map((it) => ({ index: it.index, size: it.size })) as ColumnItem[],
      leftPad: left,
      rightPad: right,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colWidth, columnVirtualizer.getVirtualItems(), columnVirtualizer.getTotalSize()])

  const gridTemplate = buildGridTemplate({ gutterWidth, leftPad, columnItems, rightPad })
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
      {/* Header — column letters; synced to the body's horizontal scroll. */}
      <div
        ref={headerScrollRef}
        className="overflow-hidden border-b bg-muted/60"
        aria-hidden
      >
        <div
          className="grid"
          style={{ gridTemplateColumns: gridTemplate, width: totalWidth, minWidth: "100%", height: rowHeight }}
        >
          <div
            className="sticky left-0 z-20 border-r bg-[color-mix(in_oklab,var(--card)_94%,var(--foreground))]"
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
      </div>

      {/* Body — owns both scrollbars. */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-auto"
        onScroll={handleBodyScroll}
      >
        <div
          style={{
            width: totalWidth,
            minWidth: "100%",
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
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            />
          ))}
        </div>
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
  style,
}: {
  rowIndex: number
  getCell: (row: number, col: number) => Cell
  gridTemplate: string
  rowHeight: number
  columnItems: ColumnItem[]
  leftPad: number
  rightPad: number
  style?: React.CSSProperties
}) {
  return (
    <div
      className="group grid border-b hover:bg-muted/40"
      style={{ gridTemplateColumns: gridTemplate, height: rowHeight, ...style }}
    >
      <div className="sticky left-0 z-[1] flex items-center justify-end border-r bg-card px-2 tabular-nums text-muted-foreground group-hover:bg-[color-mix(in_oklab,var(--card)_97%,var(--foreground))]">
        {rowIndex + 1}
      </div>
      <Spacer width={leftPad} />
      {columnItems.map((item) => {
        const cell = getCell(rowIndex, item.index)
        return (
          <div
            key={item.index}
            className={cn(
              "flex items-center truncate border-r px-2 last:border-r-0",
              cell.numeric ? "justify-end tabular-nums" : "justify-start"
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
