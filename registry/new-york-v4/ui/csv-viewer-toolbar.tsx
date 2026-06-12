"use client"

import * as React from "react"
import { Download, Maximize, Minus, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"

export function useCsvViewerZoom() {
  const [zoom, setZoom] = React.useState(1)
  return { zoom, setZoom }
}

export function CsvViewerToolbar({
  rowCount,
  columnCount,
  isLoading,
  zoom,
  onZoomChange,
  onDownload,
}: {
  rowCount: number
  columnCount: number
  isLoading: boolean
  zoom: number
  onZoomChange: (zoom: number) => void
  onDownload: () => void
}) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        {isLoading ? (
          <span
            aria-hidden
            className="size-2 animate-pulse rounded-full bg-primary"
          />
        ) : null}
        {rowCount.toLocaleString()} row{rowCount === 1 ? "" : "s"}
        {isLoading ? " · loading..." : ""}
      </span>
      <span className="flex items-center gap-2">
        <span>
          {columnCount} column{columnCount === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() =>
              onZoomChange(Math.max(0.25, Math.min(5, zoom / 1.2)))
            }
            className="inline-flex size-6 items-center justify-center rounded hover:bg-muted hover:text-foreground"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="w-10 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={() =>
              onZoomChange(Math.max(0.25, Math.min(5, zoom * 1.2)))
            }
            className="inline-flex size-6 items-center justify-center rounded hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Reset zoom"
            title="Reset zoom"
            onClick={() => onZoomChange(1)}
            className="inline-flex size-6 items-center justify-center rounded hover:bg-muted hover:text-foreground"
          >
            <Maximize className="size-3.5" />
          </button>
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          aria-label="Download"
          title="Download"
          onClick={onDownload}
        >
          <Download />
        </Button>
      </span>
    </div>
  )
}
