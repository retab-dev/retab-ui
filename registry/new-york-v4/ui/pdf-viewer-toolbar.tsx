import * as React from "react"
import { Maximize, Minus, Plus, RotateCw } from "lucide-react"

import { cn } from "@/lib/utils"
import { type ViewerDownloadAction } from "@/lib/viewer-download"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ViewerDownloadControl } from "@/components/ui/viewer-download"

export function PdfViewerToolbar({
  currentPage,
  pageCount,
  scale,
  downloadAction,
  onZoomOut,
  onZoomIn,
  onFitWidth,
  onRotate,
}: PdfViewerControlsProps) {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      <PdfViewerControls
        currentPage={currentPage}
        pageCount={pageCount}
        scale={scale}
        downloadAction={downloadAction}
        onZoomOut={onZoomOut}
        onZoomIn={onZoomIn}
        onFitWidth={onFitWidth}
        onRotate={onRotate}
      />
    </div>
  )
}

export function PdfViewerControls({
  currentPage,
  pageCount,
  scale,
  downloadAction,
  onZoomOut,
  onZoomIn,
  onFitWidth,
  onRotate,
  className,
}: PdfViewerControlsProps & { className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-1", className)}>
      <span className="px-1 text-xs text-muted-foreground tabular-nums">
        Page {Math.min(currentPage, pageCount)} of {pageCount}
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
        <IconButton label="Fit width" onClick={onFitWidth}>
          <Maximize />
        </IconButton>
        <IconButton label="Rotate" onClick={onRotate}>
          <RotateCw />
        </IconButton>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <ViewerDownloadControl actions={[downloadAction]} />
      </div>
    </div>
  )
}

type PdfViewerControlsProps = {
  currentPage: number
  pageCount: number
  scale: number
  downloadAction: ViewerDownloadAction
  onZoomOut: () => void
  onZoomIn: () => void
  onFitWidth: () => void
  onRotate: () => void
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
