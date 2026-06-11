"use client"

import * as React from "react"
import { Download, Maximize, Minus, Plus, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

export interface PptxToolbarProps {
  currentSlide: number
  slideCount: number
  zoomScale: number
  scaleControlsDisabled: boolean
  src: string
  downloadFileName?: string
  onZoom: (factor: number) => void
  onFitWidth: () => void
  onRotate: () => void
}

export function PptxToolbar({
  currentSlide,
  slideCount,
  zoomScale,
  scaleControlsDisabled,
  src,
  downloadFileName,
  onZoom,
  onFitWidth,
  onRotate,
}: PptxToolbarProps) {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      <span className="px-1 text-xs text-muted-foreground tabular-nums">
        Slide {Math.min(currentSlide, slideCount)} of {slideCount}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <PptxIconButton
          label="Zoom out"
          onClick={() => onZoom(1 / 1.2)}
          disabled={scaleControlsDisabled}
        >
          <Minus />
        </PptxIconButton>
        <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
          {Math.round(zoomScale * 100)}%
        </span>
        <PptxIconButton
          label="Zoom in"
          onClick={() => onZoom(1.2)}
          disabled={scaleControlsDisabled}
        >
          <Plus />
        </PptxIconButton>
        <PptxIconButton
          label="Fit width"
          onClick={onFitWidth}
          disabled={scaleControlsDisabled}
        >
          <Maximize />
        </PptxIconButton>
        <PptxIconButton label="Rotate" onClick={onRotate}>
          <RotateCw />
        </PptxIconButton>
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

export function PptxToolbarSkeleton() {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      <span className="px-1">
        <Skeleton className="inline-block h-3 w-12 align-middle" />
      </span>
      <div className="ml-auto flex items-center gap-1">
        <PptxToolbarIconPlaceholder>
          <Minus />
        </PptxToolbarIconPlaceholder>
        <span className="w-12 text-center">
          <Skeleton className="inline-block h-3 w-8 align-middle" />
        </span>
        <PptxToolbarIconPlaceholder>
          <Plus />
        </PptxToolbarIconPlaceholder>
        <PptxToolbarIconPlaceholder>
          <Maximize />
        </PptxToolbarIconPlaceholder>
        <PptxToolbarIconPlaceholder>
          <RotateCw />
        </PptxToolbarIconPlaceholder>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <PptxToolbarIconPlaceholder>
          <Download />
        </PptxToolbarIconPlaceholder>
      </div>
    </div>
  )
}

function PptxIconButton({
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

function PptxToolbarIconPlaceholder({
  children,
}: {
  children: React.ReactNode
}) {
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
