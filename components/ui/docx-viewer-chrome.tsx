"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

import { ViewerToolbarSkeleton } from "./viewer-toolbar"

export function DocxViewerFrame({
  bare = false,
  children,
  className,
}: {
  bare?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="docx-viewer"
    >
      {children}
    </div>
  )
}

export function DocxViewerBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

export function DocxViewerFallback({
  bare = false,
  className,
  toolbar = true,
}: {
  bare?: boolean
  className?: string
  toolbar?: boolean
}) {
  return (
    <DocxViewerFrame bare={bare} className={className}>
      {toolbar ? <ViewerToolbarSkeleton position zoom download /> : null}
      <DocxViewerBody>
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="flex flex-col items-center p-4">
            <DocxSkeleton />
          </div>
        </div>
      </DocxViewerBody>
    </DocxViewerFrame>
  )
}

export function DocxSkeleton() {
  return (
    <Skeleton
      aria-hidden
      className="w-full rounded-sm"
      data-slot="docx-page-skeleton"
      style={{ aspectRatio: "8.5 / 11" }}
    />
  )
}
