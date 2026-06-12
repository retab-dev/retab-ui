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
import {
  resolveLoadedScrollTarget,
  toInternalCellRef,
  type InternalXlsxCellRef,
  type PendingXlsxScrollTarget,
  type PublicXlsxCellRef,
  type XlsxScrollRequest,
} from "@/components/ui/xlsx-viewer-scroll"

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
  /** Public compatibility coordinates: 0-based row + column on `sheet`. */
  activeCell?: XlsxCellRef | null
  /**
   * Render the scrolling grid inside a shadow root, isolating it from host page
   * style invalidation while preserving inherited theme variables.
   */
  isolateStyles?: boolean
}

export type XlsxCellRef = PublicXlsxCellRef

export interface XlsxViewerHandle {
  scrollToCell: (
    sheet: number,
    row: number,
    col: number,
    options?: { behavior?: ScrollBehavior }
  ) => void
  getViewportElement: () => HTMLDivElement | null
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
          <XlsxViewerSession key={props.src} {...props} forwardedRef={ref} />
        </React.Suspense>
      </XlsxErrorBoundary>
    )
  }
)

function XlsxViewerSession({
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
  const [pendingScrollTarget, setPendingScrollTarget] =
    React.useState<PendingXlsxScrollTarget | null>(null)
  const scrollNonce = React.useRef(0)
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null)
  const [sheets, setSheets] = React.useState<XlsxSheetMeta[] | null>(null)

  const reportSource = React.useCallback((source: XlsxSource) => {
    setSheets(source.sheets)
    setActiveSheetIndex((sheetIndex) =>
      clamp(sheetIndex, 0, Math.max(0, source.sheets.length - 1))
    )
  }, [])

  const setLoadedSheetIndex = React.useCallback(
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

  const issueLoadedScrollTarget = React.useCallback(
    (target: PendingXlsxScrollTarget) => {
      if (!sheets) return false

      const resolved = resolveLoadedScrollTarget({
        activeSheetIndex,
        target,
        sheets,
      })
      if (!resolved) return false

      if (resolved.changed) {
        setActiveSheetIndex(resolved.sheetIndex)
        onSheetChange?.(resolved.sheetIndex)
      }

      scrollNonce.current += 1
      setScrollRequest({
        ...resolved.request,
        nonce: scrollNonce.current,
      })
      return true
    },
    [activeSheetIndex, onSheetChange, sheets]
  )

  React.useEffect(() => {
    if (!pendingScrollTarget || !sheets) return
    setPendingScrollTarget(null)
    issueLoadedScrollTarget(pendingScrollTarget)
  }, [issueLoadedScrollTarget, pendingScrollTarget, sheets])

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      scrollToCell: (sheet, row, col, options) => {
        const target = toInternalCellRef({ sheet, row, col })
        if (!target) return

        const pendingTarget = {
          ...target,
          behavior: options?.behavior ?? "smooth",
        }
        if (!sheets) {
          setPendingScrollTarget(pendingTarget)
          return
        }

        issueLoadedScrollTarget(pendingTarget)
      },
      getViewportElement: () => viewportElementRef.current,
    }),
    [issueLoadedScrollTarget, sheets]
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
          onSelectSheet={setLoadedSheetIndex}
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
  activeCell?: InternalXlsxCellRef | null
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
