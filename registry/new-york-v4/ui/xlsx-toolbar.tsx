"use client"

import * as React from "react"
import { Download, Maximize, Minus, Plus } from "lucide-react"

import { type ViewerDownloadAction } from "@/lib/viewer-download"
import type { XlsxSheetMeta } from "@/lib/xlsx-workbook"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ViewerDownloadControl } from "@/components/ui/viewer-download"

export function XlsxToolbar({
  downloadActions,
  sheet,
  isReady,
  scale,
  onZoomOut,
  onZoomIn,
  onResetZoom,
}: {
  downloadActions: ViewerDownloadAction[]
  sheet?: XlsxSheetMeta
  isReady: boolean
  scale: number
  onZoomOut: () => void
  onZoomIn: () => void
  onResetZoom: () => void
}) {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      <span className="truncate px-1 text-xs font-medium">
        {isReady ? (
          (sheet?.name ?? "-")
        ) : (
          <Skeleton className="inline-block h-3 w-24 align-middle" />
        )}
      </span>
      <span className="hidden px-1 text-xs text-muted-foreground tabular-nums sm:inline">
        {isReady ? (
          sheet ? (
            `${sheet.rowCount.toLocaleString()} x ${sheet.columnCount}`
          ) : (
            ""
          )
        ) : (
          <Skeleton className="inline-block h-3 w-16 align-middle" />
        )}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <IconButton label="Zoom out" onClick={onZoomOut}>
          <Minus />
        </IconButton>
        <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <IconButton label="Zoom in" onClick={onZoomIn}>
          <Plus />
        </IconButton>
        <IconButton label="Actual size" onClick={onResetZoom}>
          <Maximize />
        </IconButton>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <ViewerDownloadControl actions={downloadActions} />
      </div>
    </div>
  )
}

export function XlsxToolbarSkeleton() {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      <span className="truncate px-1">
        <Skeleton className="inline-block h-3 w-24 align-middle" />
      </span>
      <span className="hidden px-1 sm:inline">
        <Skeleton className="inline-block h-3 w-16 align-middle" />
      </span>
      <div className="ml-auto flex items-center gap-1">
        <ToolbarIconPlaceholder>
          <Minus />
        </ToolbarIconPlaceholder>
        <span className="w-12 text-center">
          <Skeleton className="inline-block h-3 w-8 align-middle" />
        </span>
        <ToolbarIconPlaceholder>
          <Plus />
        </ToolbarIconPlaceholder>
        <ToolbarIconPlaceholder>
          <Maximize />
        </ToolbarIconPlaceholder>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <ToolbarIconPlaceholder>
          <Download />
        </ToolbarIconPlaceholder>
      </div>
    </div>
  )
}

function IconButton({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-7"
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </Button>
  )
}

function ToolbarIconPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-7"
      disabled
      tabIndex={-1}
      aria-hidden
    >
      {children}
    </Button>
  )
}
