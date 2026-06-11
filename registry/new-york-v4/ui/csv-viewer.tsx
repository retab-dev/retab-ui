"use client"

import * as React from "react"

import {
  resolveCsvDialect,
  type CsvDialect,
  type CsvTable,
  type ParsedCsv,
} from "@/lib/csv"
import { cn } from "@/lib/utils"

import {
  downloadCsvTable,
  downloadNameFromCsvSource,
} from "./csv-viewer-download"
import { CsvGrid, type CsvGridHandle } from "./csv-viewer-grid"
import {
  getCsvErrorMessage,
  normalizeCellAddress,
  useCsvResourceState,
  type CsvCellAddress,
  type LegacyCsvCellAddress,
} from "./csv-viewer-state"
import { CsvViewerToolbar } from "./csv-viewer-toolbar"

const BASE_FONT_SIZE = 13

export interface CsvScrollOptions {
  behavior?: ScrollBehavior
}

export interface CsvViewerHandle {
  scrollToCell: {
    (rowIndex: number, columnIndex: number, options?: CsvScrollOptions): void
    (cellAddress: CsvCellAddress, options?: CsvScrollOptions): void
  }
  scrollToCellAddress: (
    cellAddress: CsvCellAddress,
    options?: CsvScrollOptions
  ) => void
  getViewportElement: () => HTMLDivElement | null
}

export interface CsvViewerProps {
  src?: string
  value?: string
  data?: ParsedCsv | CsvTable
  source?: Blob | string
  dialect?: CsvDialect
  worker?: boolean
  batchSize?: number
  delimiter?: string
  hasHeader?: boolean
  showRowNumbers?: boolean
  virtualized?: boolean
  overscan?: number
  columnOverscan?: number
  rowHeight?: number
  columnWidth?: number
  scale?: number
  toolbar?: boolean
  showZoom?: boolean
  showDownload?: boolean
  downloadName?: string
  height?: number
  fillHeight?: boolean
  label?: string
  activeCell?: CsvCellAddress | LegacyCsvCellAddress | null
  isolateStyles?: boolean
  className?: string
}

export const CsvViewer = React.forwardRef<CsvViewerHandle, CsvViewerProps>(
  function CsvViewer(
    {
      src,
      value,
      data,
      source,
      dialect: dialectProp,
      worker = true,
      batchSize = 5000,
      delimiter,
      hasHeader,
      showRowNumbers = true,
      virtualized = true,
      overscan = 30,
      columnOverscan,
      rowHeight = 33,
      columnWidth = 180,
      scale = 1,
      toolbar = true,
      showZoom = true,
      showDownload = true,
      downloadName,
      height = 480,
      fillHeight = false,
      label = "CSV data",
      activeCell,
      isolateStyles = false,
      className,
    },
    ref
  ) {
    const dialect = React.useMemo(
      () =>
        resolveCsvDialect({
          dialect: dialectProp,
          delimiter,
          hasHeader,
          descriptor: { src, fileName: downloadName },
        }),
      [delimiter, dialectProp, downloadName, hasHeader, src]
    )
    const resourceState = useCsvResourceState({
      src,
      value,
      source,
      data,
      dialect,
      worker,
      batchSize,
    })
    const gridRef = React.useRef<CsvGridHandle>(null)
    const [zoom, setZoom] = React.useState(1)
    const effectiveScale = scale * zoom
    const columns = resourceState.columns
    const rows = resourceState.rows
    const normalizedActiveCell = normalizeCellAddress(activeCell)

    React.useImperativeHandle(
      ref,
      () => ({
        scrollToCell: (
          rowIndexOrAddress: number | CsvCellAddress,
          columnIndexOrOptions?: number | CsvScrollOptions,
          options?: CsvScrollOptions
        ) => {
          const cellAddress =
            typeof rowIndexOrAddress === "number"
              ? {
                  rowIndex: rowIndexOrAddress,
                  columnIndex:
                    typeof columnIndexOrOptions === "number"
                      ? columnIndexOrOptions
                      : 0,
                }
              : rowIndexOrAddress
          const scrollOptions =
            typeof rowIndexOrAddress === "number"
              ? options
              : (columnIndexOrOptions as CsvScrollOptions | undefined)
          gridRef.current?.scrollToCell(cellAddress, scrollOptions)
        },
        scrollToCellAddress: (cellAddress, options) => {
          gridRef.current?.scrollToCell(cellAddress, options)
        },
        getViewportElement: () => gridRef.current?.getViewportElement() ?? null,
      }),
      []
    )

    const handleDownload = React.useCallback(() => {
      void downloadCsvTable({
        src,
        columns,
        rows,
        dialect,
        downloadName: downloadNameFromCsvSource({
          src,
          downloadName,
          dialect,
        }),
      })
    }, [columns, dialect, downloadName, rows, src])

    const statusNode = React.useMemo(() => {
      if (resourceState.status === "error") {
        return (
          <div
            role="status"
            aria-live="polite"
            className="flex h-24 items-center justify-center px-3 text-center text-xs text-muted-foreground"
          >
            {getCsvErrorMessage(resourceState.error)}
          </div>
        )
      }
      if (rows.length === 0 && resourceState.status !== "loading") {
        return (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            No rows
          </div>
        )
      }
      return null
    }, [resourceState, rows.length])

    return (
      <div
        data-slot="csv-viewer"
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border bg-card",
          fillHeight && "min-h-0 flex-1",
          className
        )}
        style={{ fontSize: BASE_FONT_SIZE * effectiveScale }}
      >
        {toolbar ? (
          <CsvViewerToolbar
            rowCount={rows.length}
            columnCount={columns.length}
            isLoading={resourceState.status === "loading"}
            showZoom={showZoom}
            showDownload={showDownload}
            zoom={zoom}
            onZoomChange={setZoom}
            onDownload={handleDownload}
          />
        ) : null}
        <CsvGrid
          ref={gridRef}
          columns={columns}
          rows={rows}
          activeCell={normalizedActiveCell}
          label={label}
          height={height}
          fillHeight={fillHeight}
          isolateStyles={isolateStyles}
          showRowNumbers={showRowNumbers}
          virtualized={virtualized}
          overscan={overscan}
          columnOverscan={columnOverscan}
          rowHeight={rowHeight}
          columnWidth={columnWidth}
          scale={effectiveScale}
          statusNode={statusNode}
        />
      </div>
    )
  }
)

export { type CsvCellAddress, type CsvDialect, type CsvTable, type ParsedCsv }
