"use client"

import * as React from "react"
import { Maximize, Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"

import { Button } from "./button"

export function TextCodeViewerFrame({
  bare,
  bareClassName,
  children,
  className,
  dataSlot,
  framedClassName,
}: {
  bare?: boolean
  bareClassName: string
  children: React.ReactNode
  className?: string
  dataSlot: string
  framedClassName: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? bareClassName : framedClassName,
        className
      )}
      data-slot={dataSlot}
    >
      {children}
    </div>
  )
}

export function TextCodeViewerToolbarFrame({
  leading,
  trailing,
}: {
  leading: React.ReactNode
  trailing: React.ReactNode
}) {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      <span className="px-1 text-xs text-muted-foreground tabular-nums">
        {leading}
      </span>
      <div className="ml-auto flex items-center gap-1">{trailing}</div>
    </div>
  )
}

export function TextCodeViewerZoomControls({
  fontScale,
  disabled = false,
  onZoomOut,
  onZoomIn,
  onResetZoom,
}: {
  fontScale: number
  disabled?: boolean
  onZoomOut?: () => void
  onZoomIn?: () => void
  onResetZoom?: () => void
}) {
  const disabledProps = disabled
    ? ({ disabled: true, tabIndex: -1, "aria-hidden": true } as const)
    : {}

  return (
    <>
      <TextCodeViewerIconButton
        label="Zoom out"
        onClick={disabled ? undefined : onZoomOut}
        {...disabledProps}
      >
        <Minus />
      </TextCodeViewerIconButton>
      <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
        {Math.round(fontScale * 100)}%
      </span>
      <TextCodeViewerIconButton
        label="Zoom in"
        onClick={disabled ? undefined : onZoomIn}
        {...disabledProps}
      >
        <Plus />
      </TextCodeViewerIconButton>
      <TextCodeViewerIconButton
        label="Reset zoom"
        onClick={disabled ? undefined : onResetZoom}
        {...disabledProps}
      >
        <Maximize />
      </TextCodeViewerIconButton>
    </>
  )
}

export function TextCodeViewerIconButton({
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
