"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  buildXlsxSourceFromCompact,
  resolveXlsxSheetChange,
  XlsxSourceCache,
  type CompactSheet,
  type XlsxSheetMeta,
  type XlsxSource,
} from "@/lib/xlsx-workbook"
import {
  type XlsxWorkerRequest,
  type XlsxWorkerResponse,
} from "@/lib/xlsx-worker-protocol"
import { XlsxGrid, XlsxGridSkeleton } from "@/components/ui/xlsx-grid"
import { XlsxSheetTabs } from "@/components/ui/xlsx-sheet-tabs"
import { XlsxToolbar, XlsxToolbarSkeleton } from "@/components/ui/xlsx-toolbar"

const sourceCache = new XlsxSourceCache({ maxEntries: 4 })

async function buildXlsxSource(src: string): Promise<XlsxSource> {
  const response = await fetch(src)
  if (!response.ok) {
    throw new Error(`Failed to load spreadsheet: ${response.status}`)
  }
  const buffer = await response.arrayBuffer()
  return buildXlsxSourceFromCompact(await parseWorkbookInWorker(buffer))
}

function parseWorkbookInWorker(buffer: ArrayBuffer): Promise<CompactSheet[]> {
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
      worker.terminate()
      if (event.data.type === "workbook") {
        resolve(event.data.sheets)
      } else {
        reject(new Error(event.data.message))
      }
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || "Spreadsheet worker failed"))
    }
    const request: XlsxWorkerRequest = { type: "parse_workbook", buffer }
    worker.postMessage(request, [buffer])
  })
}

function getXlsxSource(src: string): Promise<XlsxSource> {
  return sourceCache.get(src, () => buildXlsxSource(src))
}

/** Client gate without an effect: false during SSR, true after hydration. */
function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

export interface XlsxViewerProps {
  /** URL of the .xlsx/.xls (same-origin or CORS-enabled). */
  src: string
  className?: string
  toolbar?: boolean
  downloadFileName?: string
  /** Sheet shown first. Defaults to 0. */
  defaultSheetIndex?: number
  /** Fired with the active sheet index on tab switch and imperative sheet changes. */
  onSheetChange?: (index: number) => void
  /** Drop the outer border/rounded/background so the viewer fills its container. */
  bare?: boolean
  /** Rendered as a full-width strip directly below the toolbar. */
  header?: React.ReactNode
  /** Rendered as a left rail alongside the grid. */
  aside?: React.ReactNode
  /** A cell to highlight (0-based row + column on `sheet`), or null. */
  activeCell?: XlsxCellRef | null
  /**
   * Render the scrolling grid inside a shadow root, isolating it from host page
   * style invalidation while preserving inherited theme variables.
   */
  isolateStyles?: boolean
}

export interface XlsxCellRef {
  sheet: number
  row: number
  col: number
}

export interface XlsxViewerHandle {
  scrollToCell: (
    sheet: number,
    row: number,
    col: number,
    options?: { behavior?: ScrollBehavior }
  ) => void
  getViewportElement: () => HTMLDivElement | null
}

type XlsxScrollRequest = {
  sheetIndex: number
  rowIndex: number
  columnIndex: number
  behavior: ScrollBehavior
  nonce: number
}

type InternalCellRef = {
  sheetIndex: number
  rowIndex: number
  columnIndex: number
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
      <XlsxErrorBoundary className={props.className} resetKey={props.src}>
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
  isolateStyles = false,
  forwardedRef,
}: XlsxViewerProps & {
  forwardedRef?: React.ForwardedRef<XlsxViewerHandle>
}) {
  const [activeSheetIndex, setActiveSheetIndex] = React.useState(
    Math.max(0, defaultSheetIndex)
  )
  const [scale, setScale] = React.useState(1)
  const [scrollRequest, setScrollRequest] =
    React.useState<XlsxScrollRequest | null>(null)
  const scrollNonce = React.useRef(0)
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null)
  const [sheets, setSheets] = React.useState<XlsxSheetMeta[] | null>(null)
  const [metaSrc, setMetaSrc] = React.useState(src)

  if (metaSrc !== src) {
    setMetaSrc(src)
    setSheets(null)
    setActiveSheetIndex(Math.max(0, defaultSheetIndex))
    setScrollRequest(null)
  }

  const reportSource = React.useCallback((source: XlsxSource) => {
    setSheets(source.sheets)
    setActiveSheetIndex((sheetIndex) =>
      clamp(sheetIndex, 0, Math.max(0, source.sheets.length - 1))
    )
  }, [])

  const requestSheetChange = React.useCallback(
    (sheetIndex: number) => {
      const change = resolveXlsxSheetChange({
        activeSheet: activeSheetIndex,
        requestedSheet: sheetIndex,
        sheetCount: sheets?.length,
      })
      if (!change.accepted) return false
      if (change.changed) {
        setActiveSheetIndex(change.sheetIndex)
        onSheetChange?.(change.sheetIndex)
      }
      return true
    },
    [activeSheetIndex, onSheetChange, sheets]
  )

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      scrollToCell: (sheet, row, col, options) => {
        const target = toInternalCellRef({ sheet, row, col })
        if (!target || !isValidScrollTarget(target, sheets)) return
        if (!requestSheetChange(target.sheetIndex)) return
        scrollNonce.current += 1
        setScrollRequest({
          sheetIndex: target.sheetIndex,
          rowIndex: target.rowIndex,
          columnIndex: target.columnIndex,
          behavior: options?.behavior ?? "smooth",
          nonce: scrollNonce.current,
        })
      },
      getViewportElement: () => viewportElementRef.current,
    }),
    [requestSheetChange, sheets]
  )

  const isReady = sheets != null
  const activeSheet = sheets?.[activeSheetIndex]
  const activeCellTarget = toInternalCellRef(activeCell)
  const zoom = (factor: number) =>
    setScale((value) => clamp(value * factor, 0.25, 5))

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
        <XlsxToolbar
          src={src}
          downloadFileName={downloadFileName}
          sheet={activeSheet}
          isReady={isReady}
          scale={scale}
          onZoomOut={() => zoom(1 / 1.2)}
          onZoomIn={() => zoom(1.2)}
          onResetZoom={() => setScale(1)}
        />
      ) : null}

      <div className="flex min-h-0 flex-1">
        {aside ? (
          <div data-slot="xlsx-viewer-aside" className="flex-shrink-0">
            {aside}
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {header ? <div data-slot="xlsx-viewer-header">{header}</div> : null}
          <React.Suspense fallback={<XlsxGridSkeleton />}>
            <XlsxSheet
              src={src}
              activeSheetIndex={activeSheetIndex}
              scale={scale}
              onReportSource={reportSource}
              activeCell={activeCellTarget}
              scrollRequest={scrollRequest}
              isolateStyles={isolateStyles}
              viewportRef={viewportElementRef}
            />
          </React.Suspense>
        </div>
      </div>

      {sheets ? (
        <XlsxSheetTabs
          sheets={sheets}
          activeSheetIndex={activeSheetIndex}
          onSelectSheet={requestSheetChange}
        />
      ) : null}
    </div>
  )
}

function XlsxSheet({
  src,
  activeSheetIndex,
  scale,
  onReportSource,
  activeCell,
  scrollRequest,
  isolateStyles,
  viewportRef,
}: {
  src: string
  activeSheetIndex: number
  scale: number
  onReportSource: (source: XlsxSource) => void
  activeCell?: InternalCellRef | null
  scrollRequest?: XlsxScrollRequest | null
  isolateStyles: boolean
  viewportRef?: React.RefObject<HTMLDivElement | null>
}) {
  const source = React.use(getXlsxSource(src))

  React.useEffect(() => {
    onReportSource(source)
  }, [source, onReportSource])

  const sheetIndex = clamp(
    activeSheetIndex,
    0,
    Math.max(0, source.sheets.length - 1)
  )
  const sheet = source.sheets[sheetIndex]
  const getCell = React.useCallback(
    (rowIndex: number, columnIndex: number) =>
      source.getCell(sheetIndex, rowIndex, columnIndex),
    [source, sheetIndex]
  )
  const activeCellInSheet =
    activeCell && activeCell.sheetIndex === sheetIndex
      ? { rowIndex: activeCell.rowIndex, columnIndex: activeCell.columnIndex }
      : null
  const scrollRequestInSheet =
    scrollRequest && scrollRequest.sheetIndex === sheetIndex
      ? scrollRequest
      : null

  return (
    <XlsxGrid
      key={sheetIndex}
      rowCount={sheet?.rowCount ?? 0}
      columnCount={sheet?.columnCount ?? 0}
      sheetName={sheet?.name ?? `Sheet ${sheetIndex + 1}`}
      getCell={getCell}
      scale={scale}
      activeCell={activeCellInSheet}
      scrollRequest={scrollRequestInSheet}
      isolateStyles={isolateStyles}
      viewportRef={viewportRef}
    />
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

function toInternalCellRef(
  cellRef: XlsxCellRef | null | undefined
): InternalCellRef | null {
  if (!isValidPublicCellRef(cellRef)) return null
  return {
    sheetIndex: cellRef.sheet,
    rowIndex: cellRef.row,
    columnIndex: cellRef.col,
  }
}

function isValidPublicCellRef(
  cellRef: XlsxCellRef | null | undefined
): cellRef is XlsxCellRef {
  return (
    cellRef != null &&
    Number.isInteger(cellRef.sheet) &&
    Number.isInteger(cellRef.row) &&
    Number.isInteger(cellRef.col) &&
    cellRef.sheet >= 0 &&
    cellRef.row >= 0 &&
    cellRef.col >= 0
  )
}

function isValidScrollTarget(
  target: InternalCellRef,
  sheets: XlsxSheetMeta[] | null
) {
  const sheet = sheets?.[target.sheetIndex]
  if (!sheet) return true
  return (
    target.rowIndex < sheet.rowCount && target.columnIndex < sheet.columnCount
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

class XlsxErrorBoundary extends React.Component<
  { children: React.ReactNode; className?: string; resetKey?: unknown },
  { error: boolean }
> {
  state = { error: false }

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
          Couldn&apos;t load this spreadsheet.
        </div>
      )
    }
    return this.props.children
  }
}
