"use client"

import * as React from "react"

import type { CsvDialect, CsvTable } from "@/lib/csv"
import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource"

import {
  CsvViewerFrame,
  CsvViewerHeader,
  csvViewerStatusNode,
} from "./csv-viewer-chrome"
import {
  csvViewerDownloadActions,
  defaultCsvDownloadName,
} from "./csv-viewer-download"
import { CsvGrid, type CsvGridHandle } from "./csv-viewer-grid"
import {
  csvViewerExportFileName,
  csvViewerSortResetKey,
  isCsvDocumentSource,
  resolveCsvViewerDialect,
  type CsvDocumentSource,
  type CsvTableSource,
  type CsvViewerSource,
} from "./csv-viewer-resource"
import { useCsvResourceState, type CsvCellAddress } from "./csv-viewer-state"
import type { CsvViewerHandle, CsvViewerProps } from "./csv-viewer-types"

export type {
  CsvScrollOptions,
  CsvViewerHandle,
  CsvViewerProps,
} from "./csv-viewer-types"

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
    const dialect = React.useMemo(
      () =>
        resolveCsvViewerDialect({
          dialect: dialectProp,
          source,
          resource,
        }),
      [dialectProp, source, resource]
    )
    const resourceState = useCsvResourceState({
      source,
      resource,
      dialect,
      retryVersion,
    })
    const gridRef = React.useRef<CsvGridHandle>(null)
    const [zoom, setZoom] = React.useState(1)
    const columns = resourceState.columns
    const sourceRows = resourceState.sourceRows
    const canExportTable =
      resourceState.status === "ready" || resourceState.status === "empty"
    const sortResetKey = csvViewerSortResetKey({
      dialect,
      source,
      resource,
    })
    const exportFileName = csvViewerExportFileName({
      dialect,
      source,
      resource,
      fallback: defaultCsvDownloadName,
    })
    const downloadActions = React.useMemo(() => {
      return csvViewerDownloadActions({
        resource,
        columns,
        sourceRows,
        dialect,
        fileName: exportFileName,
        canExportTable,
      })
    }, [canExportTable, columns, dialect, exportFileName, resource, sourceRows])

    React.useImperativeHandle(
      ref ?? null,
      () => ({
        scrollToCell: (cellAddress, options) => {
          gridRef.current?.scrollToCell(cellAddress, options)
        },
        getViewportElement: () => gridRef.current?.getViewportElement() ?? null,
      }),
      []
    )

    const statusNode = React.useMemo(
      () =>
        csvViewerStatusNode({
          resourceState,
          resource,
          rowCount: sourceRows.length,
          onRetry: () => setRetryVersion((version) => version + 1),
        }),
      [resource, resourceState, sourceRows.length]
    )

    return (
      <CsvViewerFrame className={className} fillHeight={fillHeight} zoom={zoom}>
        <CsvViewerHeader
          toolbar={toolbar}
          rowCount={sourceRows.length}
          columnCount={columns.length}
          isLoading={resourceState.status === "loading"}
          zoom={zoom}
          onZoomChange={setZoom}
          downloadActions={downloadActions}
        />
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
      </CsvViewerFrame>
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
