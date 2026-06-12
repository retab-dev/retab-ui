"use client"

import * as React from "react"

import { resolveCsvDialect, type CsvDialect, type CsvTable } from "@/lib/csv"
import { cn } from "@/lib/utils"
import type { ViewerDownloadAction } from "@/lib/viewer-download"
import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource"

import {
  createCsvExportAction,
  defaultCsvDownloadName,
} from "./csv-viewer-download"
import { CsvGrid, type CsvGridHandle } from "./csv-viewer-grid"
import {
  isCsvDocumentSource,
  type CsvDocumentSource,
  type CsvTableSource,
  type CsvViewerSource,
} from "./csv-viewer-resource"
import { useCsvResourceState, type CsvCellAddress } from "./csv-viewer-state"
import { CsvViewerToolbar, useCsvViewerZoom } from "./csv-viewer-toolbar"
import { ViewerErrorState } from "./viewer-error"

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
  source?: CsvViewerSource
  dialect?: CsvDialect
  className?: string
  toolbar?: boolean
  height?: number
  fillHeight?: boolean
  activeCell?: CsvCellAddress | null
  isolateStyles?: boolean
}

export const CsvViewer = React.forwardRef<CsvViewerHandle, CsvViewerProps>(
  function CsvViewer(
    {
      source,
      dialect: dialectProp,
      className,
      toolbar = true,
      height = 480,
      fillHeight = false,
      activeCell,
      isolateStyles = false,
    },
    ref
  ) {
    const [retryVersion, setRetryVersion] = React.useState(0)
    const resource = React.useMemo<ViewerResource | null>(
      () =>
        source && isCsvDocumentSource(source)
          ? createViewerResource(source)
          : null,
      [source]
    )
    const tableDialect = source?.kind === "table" ? source.dialect : undefined
    const tableFileName = source?.kind === "table" ? source.fileName : undefined
    const dialect = React.useMemo(() => {
      return resolveCsvDialect({
        dialect: dialectProp ?? tableDialect,
        descriptor: {
          src: resource?.content.directUrl ?? undefined,
          fileName: resource?.fileName ?? tableFileName,
          mimeType: resource?.mimeType,
        },
      })
    }, [dialectProp, resource, tableDialect, tableFileName])
    const resourceState = useCsvResourceState({
      source,
      resource,
      dialect,
      retryVersion,
    })
    const gridRef = React.useRef<CsvGridHandle>(null)
    const { zoom, setZoom } = useCsvViewerZoom()
    const columns = resourceState.columns
    const sourceRows = resourceState.sourceRows
    const canExportTable =
      resourceState.status === "ready" || resourceState.status === "empty"
    const parseDialectKey = `${dialect.delimiter}\u0000${dialect.hasHeader}`
    const sortResetKey =
      (resource ? `${resource.keys.load}\u0000${parseDialectKey}` : null) ??
      (source?.kind === "table"
        ? (source.identityKey ?? source.table)
        : "empty")
    const resolvedExportFileName =
      resource?.fileName ?? tableFileName ?? defaultCsvDownloadName(dialect)
    const downloadActions = React.useMemo(() => {
      const actions: ViewerDownloadAction[] = []
      if (resource) {
        actions.push({
          ...resource.originalDownload,
          label: "Download original",
        })
      }
      actions.push(
        createCsvExportAction({
          columns,
          sourceRows,
          dialect,
          fileName: resolvedExportFileName,
          isDisabled: !canExportTable,
        })
      )
      return actions
    }, [
      canExportTable,
      columns,
      dialect,
      resource,
      resolvedExportFileName,
      sourceRows,
    ])

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

    const statusNode = React.useMemo(() => {
      if (resourceState.status === "error") {
        return (
          <ViewerErrorState
            error={resourceState.error}
            format="csv"
            sourceKind={resource?.sourceKind}
            download={resource?.originalDownload}
            variant="inline"
            onRetry={() => setRetryVersion((version) => version + 1)}
          />
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
    }, [resource, resourceState, sourceRows.length])

    return (
      <div
        data-slot="csv-viewer"
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border bg-card",
          fillHeight && "h-full min-h-0 flex-1",
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
            downloadActions={downloadActions}
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
          sortResetKey={sortResetKey}
          statusNode={statusNode}
        />
      </div>
    )
  }
)

export {
  type CsvCellAddress,
  type CsvDialect,
  type CsvDocumentSource,
  type CsvTableSource,
  type CsvTable,
  type CsvViewerSource,
}
