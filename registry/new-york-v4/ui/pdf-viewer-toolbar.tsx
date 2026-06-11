import * as React from "react"
import {
  Download,
  Maximize,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export function PdfViewerToolbar({
  currentPage,
  pageCount,
  scale,
  src,
  downloadFileName,
  showRailToggle,
  railsOpen,
  onToggleRails,
  onZoomOut,
  onZoomIn,
  onFitWidth,
  onRotate,
}: {
  currentPage: number
  pageCount: number
  scale: number
  src: string
  downloadFileName?: string
  showRailToggle: boolean
  railsOpen: boolean
  onToggleRails: () => void
  onZoomOut: () => void
  onZoomIn: () => void
  onFitWidth: () => void
  onRotate: () => void
}) {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      {showRailToggle ? (
        <IconButton
          label={railsOpen ? "Hide sidebar" : "Show sidebar"}
          aria-pressed={railsOpen}
          onClick={onToggleRails}
        >
          {railsOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
        </IconButton>
      ) : null}
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
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          aria-label="Download"
          title="Download"
          render={
            <a
              href={src}
              download={downloadFileName}
              target="_blank"
              rel="noreferrer"
            />
          }
        >
          <Download />
        </Button>
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
