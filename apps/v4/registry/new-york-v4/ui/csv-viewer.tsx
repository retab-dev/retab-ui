"use client"

import * as React from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"

import {
  type ParsedCsv,
  createCsvParser,
  parseCsv,
  streamCsv,
} from "@/lib/csv"
import { cn } from "@/lib/utils"

type Row = string[]

/** A column to render: its true index plus its track size. */
interface ColumnItem {
  index: number
  size: number
}

const ROW_NUMBER_WIDTH = 56

export interface CsvViewerProps {
  /** Raw CSV/TSV text. Provide this or `data`. */
  value?: string
  /** Pre-parsed data, if you already have columns + rows. */
  data?: ParsedCsv
  /**
   * A large CSV source to parse off the render path — a `File`/`Blob`, or a raw
   * CSV string. Rows stream in progressively, keeping the main thread
   * responsive. Prefer this over `value` for big inputs.
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
  /** Scroll viewport height in pixels. Defaults to 480. */
  height?: number
  /** Accessible label for the table. Defaults to "CSV data". */
  label?: string
  className?: string
}

export function CsvViewer({
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
  height = 480,
  label = "CSV data",
  className,
}: CsvViewerProps) {
  const {
    columns: parsedColumns,
    rows: parsedRows,
    loading,
  } = useCsvData({ data, value, source, delimiter, hasHeader, worker, batchSize })

  // Sort is a single column + direction. We render straight from the raw
  // `string[][]` and, when sorted, keep only a lightweight array of row indices —
  // never per-row view objects — so a 200k-row file stays at data size in memory
  // instead of the hundreds of MB a full table row model would cost.
  const [sort, setSort] = React.useState<{ index: number; desc: boolean } | null>(
    null
  )
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
    idx.sort((a, b) => compareCells(parsedRows[a][col] ?? "", parsedRows[b][col] ?? ""))
    if (sort.desc) idx.reverse()
    return idx
  }, [parsedRows, sort])

  const rowAt = React.useCallback(
    (display: number): Row => parsedRows[order ? order[display] : display],
    [parsedRows, order]
  )

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const headerScrollRef = React.useRef<HTMLDivElement>(null)

  // Mirror the body's horizontal scroll by *scrolling* the header (not
  // transforming it), so the header's sticky row-number cell pins exactly like
  // the body's — transforms break sticky positioning.
  const handleBodyScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = event.currentTarget.scrollLeft
    }
  }

  const colCount = parsedColumns.length
  const colOffset = showRowNumbers ? 1 : 0

  const rowVirtualizer = useVirtualizer({
    count: parsedRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan,
  })

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: colCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => columnWidth,
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
          size: columnWidth,
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
    columnWidth,
    parsedColumns,
    columnVirtualizer.getVirtualItems(),
    columnVirtualizer.getTotalSize(),
  ])

  // Memoize so its identity is stable across vertical scroll (columnItems only
  // changes on horizontal scroll/resize). A stable gridTemplate keeps CsvRow's
  // props stable, so React.memo skips the rows that stay put and only the rows
  // entering the window re-render.
  const gridTemplate = React.useMemo(
    () => buildGridTemplate({ showRowNumbers, leftPad, columnItems, rightPad }),
    [showRowNumbers, leftPad, columnItems, rightPad]
  )
  const totalWidth =
    (showRowNumbers ? ROW_NUMBER_WIDTH : 0) + colCount * columnWidth
  const virtualRows = rowVirtualizer.getVirtualItems()

  return (
    <div
      data-slot="csv-viewer"
      role="table"
      aria-label={label}
      aria-rowcount={parsedRows.length + 1}
      aria-colcount={colCount + colOffset}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card text-sm",
        className
      )}
    >
      {/* Header — a separate element above the body, synced to the body's
          horizontal scroll. The body's vertical scrollbar can't paint over it. */}
      <div
        ref={headerScrollRef}
        role="rowgroup"
        data-slot="csv-header"
        className="overflow-hidden border-b bg-muted/60"
      >
        <div
          role="row"
          aria-rowindex={1}
          className="grid"
          style={{
            gridTemplateColumns: gridTemplate,
            width: totalWidth,
            minWidth: "100%",
          }}
        >
          {showRowNumbers ? (
            <div
              role="columnheader"
              aria-colindex={1}
              aria-label="Row number"
              className="sticky left-0 z-10 flex items-center justify-end border-r bg-[color-mix(in_oklab,var(--card)_97%,var(--foreground))] px-2 text-xs font-medium text-muted-foreground"
            >
              #
            </div>
          ) : null}
          <Spacer width={leftPad} />
          {columnItems.map((item) => (
            <HeaderCell
              key={item.index}
              name={parsedColumns[item.index] || `Column ${item.index + 1}`}
              colIndex={colOffset + item.index + 1}
              sorted={
                sort?.index === item.index ? (sort.desc ? "desc" : "asc") : false
              }
              onToggle={() => toggleSort(item.index)}
            />
          ))}
          <Spacer width={rightPad} />
        </div>
      </div>

      {/* Body — owns both scrollbars; the vertical one sits below the header. */}
      <div
        ref={scrollRef}
        role="rowgroup"
        data-slot="csv-body"
        className="overflow-auto"
        style={{ height, maxHeight: "100%" }}
        onScroll={handleBodyScroll}
      >
        {parsedRows.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            No rows
          </div>
        ) : (
          <div
            style={{
              width: totalWidth,
              minWidth: "100%",
              position: "relative",
              height: virtualized ? rowVirtualizer.getTotalSize() : undefined,
            }}
          >
            {virtualized
              ? virtualRows.map((virtualRow) => (
                  <CsvRow
                    key={virtualRow.index}
                    cells={rowAt(virtualRow.index)}
                    index={virtualRow.index}
                    gridTemplate={gridTemplate}
                    rowHeight={rowHeight}
                    showRowNumbers={showRowNumbers}
                    colOffset={colOffset}
                    columnItems={columnItems}
                    leftPad={leftPad}
                    rightPad={rightPad}
                    start={virtualRow.start}
                  />
                ))
              : parsedRows.map((_, index) => (
                  <CsvRow
                    key={index}
                    cells={rowAt(index)}
                    index={index}
                    gridTemplate={gridTemplate}
                    rowHeight={rowHeight}
                    showRowNumbers={showRowNumbers}
                    colOffset={colOffset}
                    columnItems={columnItems}
                    leftPad={leftPad}
                    rightPad={rightPad}
                  />
                ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground">
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
        <span>
          {colCount} column{colCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  )
}

function buildGridTemplate({
  showRowNumbers,
  leftPad,
  columnItems,
  rightPad,
}: {
  showRowNumbers: boolean
  leftPad: number
  columnItems: ColumnItem[]
  rightPad: number
}) {
  const cols = columnItems.map((c) => `${c.size}px`).join(" ")
  return [
    showRowNumbers ? `${ROW_NUMBER_WIDTH}px` : null,
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
  sorted,
  onToggle,
}: {
  name: string
  colIndex: number
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
        className="flex h-9 w-full items-center gap-1 px-3 text-left text-xs font-semibold hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
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
          className="sticky left-0 z-[1] flex items-center justify-end border-r bg-card px-2 text-xs tabular-nums text-muted-foreground group-hover:bg-[color-mix(in_oklab,var(--card)_97%,var(--foreground))]"
        >
          {index + 1}
        </div>
      ) : null}
      <Spacer width={leftPad} />
      {columnItems.map((item) => {
        const text = cells?.[item.index] ?? ""
        return (
          <div
            key={item.index}
            role="cell"
            aria-colindex={colOffset + item.index + 1}
            data-slot="csv-cell"
            className="flex items-center truncate border-r px-3 last:border-r-0"
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
