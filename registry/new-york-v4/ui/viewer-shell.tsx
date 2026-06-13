"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import type { ViewerSlots } from "./viewer-slots"

export interface ViewerShellSlots extends ViewerSlots {
  header?: React.ReactNode
  toolbar?: React.ReactNode
}

export interface ViewerShellProps {
  children: React.ReactNode
  slots?: ViewerShellSlots
  bare?: boolean
  className?: string
  bodyClassName?: string
  mainClassName?: string
  contentClassName?: string
}

/**
 * Format-neutral frame for compound viewer composition. Concrete renderers own
 * file-specific behavior; this shell owns quiet, consistent viewer chrome.
 */
export function ViewerShell({
  children,
  slots,
  bare = false,
  className,
  bodyClassName,
  mainClassName,
  contentClassName,
}: ViewerShellProps) {
  return (
    <div
      data-slot="viewer-shell"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
    >
      {slots?.header ? (
        <div data-slot="viewer-shell-header">{slots.header}</div>
      ) : null}
      {slots?.toolbar ? (
        <div data-slot="viewer-shell-toolbar">{slots.toolbar}</div>
      ) : null}
      <div
        data-slot="viewer-shell-body"
        className={cn("relative flex min-h-0 flex-1", bodyClassName)}
      >
        {slots?.left ? (
          <div data-slot="viewer-shell-left" className="flex-shrink-0">
            {slots.left}
          </div>
        ) : null}
        <div
          data-slot="viewer-shell-main"
          className={cn("flex min-h-0 min-w-0 flex-1 flex-col", mainClassName)}
        >
          {slots?.top ? (
            <div data-slot="viewer-shell-top">{slots.top}</div>
          ) : null}
          <div
            data-slot="viewer-shell-content"
            className={cn("min-h-0 flex-1", contentClassName)}
          >
            {children}
          </div>
          {slots?.bottom ? (
            <div data-slot="viewer-shell-bottom">{slots.bottom}</div>
          ) : null}
        </div>
        {slots?.right ? (
          <div data-slot="viewer-shell-right" className="flex-shrink-0">
            {slots.right}
          </div>
        ) : null}
        {slots?.overlay ? (
          <div
            data-slot="viewer-shell-overlay"
            className="pointer-events-none absolute inset-0 z-20"
          >
            {slots.overlay}
          </div>
        ) : null}
      </div>
    </div>
  )
}
