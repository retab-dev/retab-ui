"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  isResourceError,
  isViewerFormatError,
  ViewerFormatError,
  type ViewerFormatErrorMapperOptions,
} from "@/lib/viewer-errors"
import {
  createViewerResource,
  type ViewerContentBytes,
  type ViewerResource,
} from "@/lib/viewer-resource"
import type { BlobViewerSource, UrlViewerSource } from "@/lib/viewer-source"
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
import { Skeleton } from "@/components/ui/skeleton"
import { ViewerErrorBoundary } from "@/components/ui/viewer-error"
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

import {
  createXlsxSheetCsvExportAction,
  xlsxSheetCsvFileName,
} from "./xlsx-viewer-download"

const sourceCache = new XlsxSourceCache({ maxEntries: 4 })

async function buildXlsxSource(
  content: ViewerContentBytes
): Promise<XlsxSource> {
  try {
    const buffer = await content.readBytes()
    return buildXlsxSourceFromCompact(await parseWorkbookInWorker(buffer))
  } catch (error) {
    if (isResourceError(error)) throw error
    throw toXlsxFormatError(error, {
      kind: "parse_failed",
      message: "Failed to parse spreadsheet.",
    })
  }
}

function toXlsxFormatError(
  error: unknown,
  options: ViewerFormatErrorMapperOptions
): ViewerFormatError {
  if (isViewerFormatError(error)) return error
  return new ViewerFormatError({
    format: "xlsx",
    kind: options.kind,
    message: options.message,
    cause: error,
  })
}

function parseWorkbookInWorker(buffer: ArrayBuffer): Promise<CompactSheet[]> {
  return new Promise((resolve, reject) => {
    if (typeof Worker === "undefined") {
      reject(
        toXlsxFormatError(undefined, {
          kind: "worker_failed",
          message: "Web Workers are unavailable in this environment.",
        })
      )
      return
    }

    const worker = new Worker(
      new URL("./xlsx-viewer.worker", import.meta.url),
      { type: "module" }
    )
    worker.onmessage = (event: MessageEvent<unknown>) => {
      worker.terminate()
      const response = parseXlsxWorkerResponse(event.data)
      if (!response) {
        reject(
          toXlsxFormatError(undefined, {
            kind: "parse_failed",
            message: "Spreadsheet worker returned an invalid response.",
          })
        )
        return
      }
      if (response.type === "workbook") {
        resolve(response.sheets)
      } else {
        reject(
          toXlsxFormatError(undefined, {
            kind: "parse_failed",
            message: response.message || "Failed to parse spreadsheet.",
          })
        )
      }
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(
        toXlsxFormatError(event, {
          kind: "worker_failed",
          message: event.message || "Spreadsheet worker failed.",
        })
      )
    }
    const request: XlsxWorkerRequest = { type: "parse_workbook", buffer }
    worker.postMessage(request, [buffer])
  })
}

function parseXlsxWorkerResponse(value: unknown): XlsxWorkerResponse | null {
  if (value == null || typeof value !== "object") return null
  const response = value as Partial<XlsxWorkerResponse>
  if (response.type === "workbook") {
    return Array.isArray(response.sheets)
      ? ({
          type: "workbook",
          sheets: response.sheets,
        } satisfies XlsxWorkerResponse)
      : null
  }
  if (response.type === "error") {
    return {
      type: "error",
      code: "parse_failed",
      message:
        typeof response.message === "string"
          ? response.message
          : "Failed to parse spreadsheet.",
    }
  }
  return null
}

function getXlsxSource(content: ViewerContentBytes): Promise<XlsxSource> {
  return sourceCache.get(content.key, () => buildXlsxSource(content))
}

/** Client gate without an effect: false during SSR, true after hydration. */
function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

export type XlsxDocumentSource = UrlViewerSource | BlobViewerSource

export interface XlsxViewerProps {
  /** Canonical spreadsheet source. */
  source: XlsxDocumentSource
  className?: string
  toolbar?: boolean
  /** Sheet shown first. Defaults to 0. */
  defaultSheetIndex?: number
  /** Fired with the active sheet index on tab switch and imperative sheet changes. */
  onSheetChange?: (index: number) => void
  /** Reserve the workbook tab bar while metadata loads. Use for known multi-sheet files. */
  fallbackSheetTabs?: boolean
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

export type XlsxResourceViewerProps = Omit<XlsxViewerProps, "source"> & {
  resource: ViewerResource
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
    const { source, ...resourceProps } = props
    const resource = React.useMemo(() => createViewerResource(source), [source])
    return (
      <XlsxResourceViewer {...resourceProps} ref={ref} resource={resource} />
    )
  }
)

export const XlsxResourceViewer = React.forwardRef<
  XlsxViewerHandle,
  XlsxResourceViewerProps
>(function XlsxResourceViewer(props, ref) {
  const isClient = useIsClient()
  const resource = props.resource
  if (!isClient) {
    return (
      <XlsxViewerFallback
        className={props.className}
        fallbackSheetTabs={props.fallbackSheetTabs}
        toolbar={props.toolbar}
        bare={props.bare}
      />
    )
  }
  return (
    <ViewerErrorBoundary
      className={props.className}
      download={resource.originalDownload}
      format="xlsx"
      resetKey={resource.keys.resource}
      sourceKind={resource.sourceKind}
    >
      <React.Suspense
        fallback={
          <XlsxViewerFallback
            className={props.className}
            fallbackSheetTabs={props.fallbackSheetTabs}
            toolbar={props.toolbar}
            bare={props.bare}
          />
        }
      >
        <XlsxViewerSession
          key={resource.keys.resource}
          {...props}
          forwardedRef={ref}
          resource={resource}
        />
      </React.Suspense>
    </ViewerErrorBoundary>
  )
})

function XlsxViewerSession({
  resource,
  className,
  toolbar = true,
  defaultSheetIndex = 0,
  onSheetChange,
  fallbackSheetTabs = false,
  bare = false,
  header,
  aside,
  activeCell,
  isolateStyles = false,
  forwardedRef,
}: Omit<XlsxViewerProps, "source"> & {
  resource: ViewerResource
  forwardedRef?: React.ForwardedRef<XlsxViewerHandle>
}) {
  const [activeSheetIndex, setActiveSheetIndex] = React.useState(
    normalizeInitialSheetIndex(defaultSheetIndex)
  )
  const [scale, setScale] = React.useState(1)
  const [scrollRequest, setScrollRequest] =
    React.useState<XlsxScrollRequest | null>(null)
  const [pendingScrollTarget, setPendingScrollTarget] =
    React.useState<PendingXlsxScrollTarget | null>(null)
  const scrollNonce = React.useRef(0)
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null)
  const [sheets, setSheets] = React.useState<XlsxSheetMeta[] | null>(null)
  const content = resource.content
  const sourcePromise = React.useMemo(() => getXlsxSource(content), [content])

  const reportSource = React.useCallback((source: XlsxSource) => {
    setSheets(source.sheets)
    setActiveSheetIndex((sheetIndex) =>
      clampSheetIndex(sheetIndex, source.sheets.length)
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
  const isReservingFallbackSheetTabs = fallbackSheetTabs && !sheets
  const activeSheet = sheets?.[activeSheetIndex]
  const activeCellTarget = toInternalCellRef(activeCell)
  const downloadActions = React.useMemo(() => {
    const originalDownloadAction = {
      ...resource.originalDownload,
      label: activeSheet ? "Download original" : "Download",
    }
    if (!activeSheet || !sheets) return [originalDownloadAction]
    return [
      originalDownloadAction,
      createXlsxSheetCsvExportAction({
        fileName: xlsxSheetCsvFileName({
          fileName: resource.fileName,
          sheetName: activeSheet.name,
          sheetCount: sheets.length,
        }),
        sheetIndex: activeSheetIndex,
        getSource: () => getXlsxSource(content),
      }),
    ]
  }, [
    activeSheet,
    activeSheetIndex,
    content,
    resource.fileName,
    resource.originalDownload,
    sheets,
  ])
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
          downloadActions={downloadActions}
          sheet={activeSheet}
          isReady={isReady}
          scale={scale}
          onZoomOut={() => zoom(1 / 1.2)}
          onZoomIn={() => zoom(1.2)}
          onResetZoom={() => setScale(1)}
        />
      ) : null}

      <div
        className={cn(
          "flex min-h-0",
          isReservingFallbackSheetTabs ? "flex-none" : "flex-1"
        )}
        style={
          isReservingFallbackSheetTabs
            ? { height: `calc(100% - ${toolbar ? 73 : 33}px)` }
            : undefined
        }
      >
        {aside ? (
          <div data-slot="xlsx-viewer-aside" className="flex-shrink-0">
            {aside}
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {header ? <div data-slot="xlsx-viewer-header">{header}</div> : null}
          <React.Suspense fallback={<XlsxGridSkeleton />}>
            <XlsxSheet
              sourcePromise={sourcePromise}
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
      ) : fallbackSheetTabs ? (
        <XlsxSheetTabsSkeleton />
      ) : null}
    </div>
  )
}

function XlsxSheet({
  sourcePromise,
  activeSheetIndex,
  scale,
  onReportSource,
  activeCell,
  scrollRequest,
  isolateStyles,
  viewportRef,
}: {
  sourcePromise: Promise<XlsxSource>
  activeSheetIndex: number
  scale: number
  onReportSource: (source: XlsxSource) => void
  activeCell?: InternalXlsxCellRef | null
  scrollRequest?: XlsxScrollRequest | null
  isolateStyles: boolean
  viewportRef?: React.RefObject<HTMLDivElement | null>
}) {
  const source = React.use(sourcePromise)

  React.useEffect(() => {
    onReportSource(source)
  }, [source, onReportSource])

  const sheetIndex = clampSheetIndex(activeSheetIndex, source.sheets.length)
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
  fallbackSheetTabs = false,
  toolbar = true,
  bare = false,
}: {
  className?: string
  fallbackSheetTabs?: boolean
  toolbar?: boolean
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
      {toolbar ? <XlsxToolbarSkeleton /> : null}
      <div
        className={cn(
          "flex min-h-0",
          fallbackSheetTabs ? "flex-none" : "flex-1"
        )}
        style={
          fallbackSheetTabs
            ? { height: `calc(100% - ${toolbar ? 73 : 33}px)` }
            : undefined
        }
      >
        <XlsxGridSkeleton />
      </div>
      {fallbackSheetTabs ? <XlsxSheetTabsSkeleton /> : null}
    </div>
  )
}

function XlsxSheetTabsSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-shrink-0 items-stretch gap-0.5 overflow-hidden border-t bg-card px-1.5 py-1"
      data-slot="xlsx-viewer-tabs-skeleton"
    >
      {[96, 144, 136, 128].map((width, index) => (
        <div
          key={index}
          className="flex h-[24px] flex-shrink-0 items-center rounded-md px-2.5"
          style={{ width }}
        >
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeInitialSheetIndex(value: number) {
  return Number.isSafeInteger(value) && value > 0 ? value : 0
}

function clampSheetIndex(value: number, sheetCount: number) {
  if (!Number.isSafeInteger(value) || value < 0) return 0
  return Math.min(value, Math.max(0, sheetCount - 1))
}
