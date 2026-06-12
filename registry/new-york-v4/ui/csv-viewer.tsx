"use client"

import * as React from "react"

import { resolveCsvDialect, type CsvDialect, type CsvTable } from "@/lib/csv"
import { cn } from "@/lib/utils"

import { defaultCsvDownloadName, downloadCsvTable } from "./csv-viewer-download"
import { CsvGrid, type CsvGridHandle } from "./csv-viewer-grid"
import {
  getCsvErrorMessage,
  useCsvResourceState,
  type CsvCellAddress,
} from "./csv-viewer-state"
import { CsvViewerToolbar, useCsvViewerZoom } from "./csv-viewer-toolbar"

const BASE_FONT_SIZE = 13

export interface CsvScrollOptions {
  behavior?: ScrollBehavior
}

export interface CsvViewerHandle {
  scrollToCell: (
    cellAddress: CsvCellAddress,
    options?: CsvScrollOptions
  ) => void
  getViewportElement: () => HTMLDivElement | null
}

export interface CsvViewerProps {
  src?: string
  value?: string
  source?: Blob
  data?: CsvTable
  dialect?: CsvDialect
  className?: string
  toolbar?: boolean
  downloadName?: string
  height?: number
  fillHeight?: boolean
  activeCell?: CsvCellAddress | null
  isolateStyles?: boolean
}

export const CsvViewer = React.forwardRef<CsvViewerHandle, CsvViewerProps>(
  function CsvViewer(
    {
      src,
      value,
      data,
      source,
      dialect: dialectProp,
      className,
      toolbar = true,
      downloadName,
      height = 480,
      fillHeight = false,
      activeCell,
      isolateStyles = false,
    },
    ref
  ) {
    const dialect = React.useMemo(
      () =>
        resolveCsvDialect({
          dialect: dialectProp,
          descriptor: { src, fileName: downloadName },
        }),
      [dialectProp, downloadName, src]
    )
    const resourceState = useCsvResourceState({
      src,
      value,
      source,
      data,
      dialect,
    })
    const gridRef = React.useRef<CsvGridHandle>(null)
    const { zoom, setZoom } = useCsvViewerZoom()
    const columns = resourceState.columns
    const sourceRows = resourceState.sourceRows
    const resolvedDownloadName = downloadName ?? defaultCsvDownloadName(dialect)

    React.useImperativeHandle(
      ref,
      () => ({
        scrollToCell: (cellAddress, options) => {
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
        sourceRows,
        dialect,
        downloadName: resolvedDownloadName,
      })
    }, [columns, dialect, resolvedDownloadName, sourceRows, src])

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
      if (sourceRows.length === 0 && resourceState.status !== "loading") {
        return (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            No rows
          </div>
        )
      }
      return null
    }, [resourceState, sourceRows.length])

    return (
      <div
        data-slot="csv-viewer"
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border bg-card",
          fillHeight && "min-h-0 flex-1",
          className
        )}
        style={{ fontSize: BASE_FONT_SIZE * zoom }}
      >
        {toolbar ? (
          <CsvViewerToolbar
            rowCount={sourceRows.length}
            columnCount={columns.length}
            isLoading={resourceState.status === "loading"}
            zoom={zoom}
            onZoomChange={setZoom}
            onDownload={handleDownload}
          />
        ) : null}
        <CsvGrid
          ref={gridRef}
          columns={columns}
          sourceRows={sourceRows}
          activeCell={activeCell ?? null}
          height={height}
          fillHeight={fillHeight}
          isolateStyles={isolateStyles}
          scale={zoom}
          statusNode={statusNode}
        />
      </div>
    )
  }
)

export { type CsvCellAddress, type CsvDialect, type CsvTable }
