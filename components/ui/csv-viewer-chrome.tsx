"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { ViewerDownloadAction } from "@/lib/viewer-download"
import type { ViewerResource } from "@/lib/viewer-resource"

import type { CsvResourceState } from "./csv-viewer-state"
import { ViewerErrorState } from "./viewer-error"
import { ViewerControls } from "./viewer-controls"

export const CSV_VIEWER_BASE_FONT_SIZE = 13

export function CsvViewerFrame({
  className,
  fillHeight,
  zoom,
  children,
}: {
  className?: string
  fillHeight: boolean
  zoom: number
  children: React.ReactNode
}) {
  return (
    <div
      data-slot="csv-viewer"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card",
        fillHeight && "h-full min-h-0 flex-1",
        className
      )}
      style={{ fontSize: CSV_VIEWER_BASE_FONT_SIZE * zoom }}
    >
      {children}
    </div>
  )
}

export function CsvViewerHeader({
  controls,
  rowCount,
  columnCount,
  isLoading,
  zoom,
  downloadActions,
  onZoomChange,
}: {
  controls: boolean
  rowCount: number
  columnCount: number
  isLoading: boolean
  zoom: number
  downloadActions: ViewerDownloadAction[]
  onZoomChange: (zoom: number) => void
}) {
  const rowLabel = `${rowCount.toLocaleString()} row${rowCount === 1 ? "" : "s"}`
  const columnLabel = `${columnCount} column${columnCount === 1 ? "" : "s"}`

  return controls ? (
    <ViewerControls
      title={isLoading ? `${rowLabel} loading` : rowLabel}
      subtitle={isLoading ? null : columnLabel}
      loading={isLoading}
      zoom={{
        scale: zoom,
        onZoomOut: () => onZoomChange(clampCsvZoom(zoom / 1.2)),
        onZoomIn: () => onZoomChange(clampCsvZoom(zoom * 1.2)),
        onFit: () => onZoomChange(1),
        fitLabel: "Reset zoom",
      }}
      downloads={downloadActions}
    />
  ) : null
}

function clampCsvZoom(zoom: number) {
  return Math.max(0.25, Math.min(5, zoom))
}

export function csvViewerStatusNode({
  resourceState,
  resource,
  rowCount,
  onRetry,
}: {
  resourceState: CsvResourceState
  resource: ViewerResource | null
  rowCount: number
  onRetry: () => void
}): React.ReactNode {
  if (resourceState.status === "error") {
    return (
      <ViewerErrorState
        error={resourceState.error}
        format="csv"
        sourceKind={resource?.sourceKind}
        download={resource?.originalDownload}
        variant="inline"
        onRetry={onRetry}
      />
    )
  }

  if (rowCount === 0 && resourceState.status !== "loading") {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        No rows
      </div>
    )
  }

  return null
}
