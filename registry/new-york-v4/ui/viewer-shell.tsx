"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  ViewerBody,
  ViewerOverlay,
  ViewerRail,
  ViewerRoot,
  ViewerSurface,
} from "./viewer"
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
    <ViewerRoot data-slot="viewer-shell" bare={bare} className={className}>
      {slots?.header ? (
        <div data-slot="viewer-shell-header">{slots.header}</div>
      ) : null}
      {slots?.toolbar ? (
        <div data-slot="viewer-shell-toolbar">{slots.toolbar}</div>
      ) : null}
      <ViewerBody data-slot="viewer-shell-body" className={bodyClassName}>
        {slots?.left ? (
          <ViewerRail data-slot="viewer-shell-left">{slots.left}</ViewerRail>
        ) : null}
        <ViewerSurface data-slot="viewer-shell-main" className={mainClassName}>
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
        </ViewerSurface>
        {slots?.right ? (
          <ViewerRail data-slot="viewer-shell-right">{slots.right}</ViewerRail>
        ) : null}
        {slots?.overlay ? (
          <ViewerOverlay data-slot="viewer-shell-overlay">
            {slots.overlay}
          </ViewerOverlay>
        ) : null}
      </ViewerBody>
    </ViewerRoot>
  )
}
