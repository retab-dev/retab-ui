"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export type ViewerRootProps = React.ComponentProps<"div"> & {
  bare?: boolean
}

export function ViewerRoot({
  bare = false,
  className,
  style,
  ...props
}: ViewerRootProps) {
  return (
    <div
      data-slot="viewer-root"
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      style={
        {
          "--viewer-sidebar-width": "16rem",
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export function ViewerHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="viewer-header"
      className={cn("flex-shrink-0 border-b bg-card", className)}
      {...props}
    />
  )
}

export function ViewerToolbar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="viewer-toolbar"
      className={cn("flex-shrink-0 border-b bg-background", className)}
      {...props}
    />
  )
}

export function ViewerBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="viewer-body"
      className={cn("relative flex min-h-0 flex-1", className)}
      {...props}
    />
  )
}

export function ViewerSidebar({
  className,
  ...props
}: React.ComponentProps<"aside">) {
  return (
    <aside
      data-slot="viewer-sidebar"
      className={cn(
        "min-h-0 w-full flex-shrink-0 md:w-(--viewer-sidebar-width)",
        className
      )}
      {...props}
    />
  )
}

export function ViewerRail({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="viewer-rail"
      className={cn("min-h-0 flex-shrink-0", className)}
      {...props}
    />
  )
}

export function ViewerSurface({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="viewer-surface"
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}
      {...props}
    />
  )
}

export function ViewerAside({
  className,
  ...props
}: React.ComponentProps<"aside">) {
  return (
    <aside
      data-slot="viewer-aside"
      className={cn("min-h-0 flex-shrink-0", className)}
      {...props}
    />
  )
}

export function ViewerFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="viewer-footer"
      className={cn("flex-shrink-0 border-t bg-background", className)}
      {...props}
    />
  )
}

export function ViewerOverlay({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="viewer-overlay"
      className={cn("pointer-events-none absolute inset-0 z-20", className)}
      {...props}
    />
  )
}
