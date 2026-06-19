"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"
import { Skeleton } from "@/components/ui/skeleton"
import { ViewerDownloadButton } from "@/components/ui/viewer-download"
import { ViewerErrorState } from "@/components/ui/viewer-error"

import { CodeViewerFallback } from "./code-viewer-chrome"
import { DocxViewerFallback } from "./docx-viewer-chrome"
import {
  isProseTextDescriptor,
  type FileDescriptor,
  type FileViewerFallbackSize,
} from "./file-viewer-core"
import { ImageViewerFallback } from "./image-viewer-chrome"
import { PdfViewerFallback } from "./pdf-viewer-states"
import { PptxViewerFallback } from "./pptx-viewer-fallback"
import { TextViewerFallback } from "./text-viewer-chrome"
import { ViewerControlsSkeleton } from "./viewer-controls"
import { XlsxViewerFallback } from "./xlsx-viewer-chrome"

export function UnsupportedCard({
  resource,
  className,
  bare,
  message = "No preview for",
  showDownload = true,
}: {
  resource: ViewerResource
  className?: string
  bare?: boolean
  message?: string
  showDownload?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-8 text-center",
        bare ? "h-full bg-muted/20" : "min-h-64 rounded-xl border bg-muted/30",
        className
      )}
      data-slot="file-viewer"
    >
      <p className="text-sm text-muted-foreground">
        {message}{" "}
        <span className="font-medium text-foreground">
          {resource.fileName}.
        </span>
      </p>
      {showDownload ? (
        <ViewerDownloadButton
          action={resource.originalDownload}
          variant="outline"
          size="sm"
          className=""
          showLabel
        />
      ) : null}
    </div>
  )
}

export function ViewerFallback({
  resource,
  className,
  bare = false,
  controls = true,
  fallbackFrameSize,
  fallbackSlideSize,
}: {
  resource: ViewerResource
  className?: string
  bare?: boolean
  controls?: boolean
  fallbackFrameSize?: FileViewerFallbackSize
  fallbackSlideSize?: FileViewerFallbackSize
}) {
  const descriptor = resource.descriptor
  const category = descriptor.category

  // Render the exact per-type skeleton each viewer shows while it parses, so the
  // SSR + chunk-loading paint is identical to the in-viewer loading state (same
  // toolbar, same body) — no toolbar popping in and no geometry shift as one
  // skeleton hands off to the next.
  switch (category) {
    case "pdf":
      return (
        <PdfViewerFallback bare={bare} className={className} controls={controls} />
      )
    case "docx":
      return (
        <DocxViewerFallback bare={bare} className={className} controls={controls} />
      )
    case "pptx":
      return (
        <PptxViewerFallback
          bare={bare}
          className={className}
          controls={controls}
          fallbackSlideSize={fallbackSlideSize}
        />
      )
    case "image":
      return (
        <ImageViewerFallback
          bare={bare}
          className={className}
          controls={controls}
          fallbackFrameSize={fallbackFrameSize}
        />
      )
    case "xlsx":
      return (
        <XlsxViewerFallback bare={bare} className={className} controls={controls} />
      )
    case "markdown":
      return (
        <TextViewerFallback bare={bare} className={className} controls={controls} />
      )
    case "text":
      // The "text" category fans out to a prose viewer or a code viewer; match
      // whichever the route will pick so the body skeleton (gutter vs none) lines up.
      return isProseTextDescriptor(descriptor) ? (
        <TextViewerFallback bare={bare} className={className} controls={controls} />
      ) : (
        <CodeViewerFallback bare={bare} className={className} controls={controls} />
      )
    case "csv":
      return (
        <TextFamilyFallbackFrame bare={bare} className={className}>
          {controls ? (
            <ViewerControlsSkeleton title subtitle zoom download />
          ) : null}
          <TableBodySkeleton />
        </TextFamilyFallbackFrame>
      )
    case "html":
      return (
        <TextFamilyFallbackFrame bare={bare} className={className}>
          {controls ? <ViewerControlsSkeleton zoom /> : null}
          <div className="min-h-0 flex-1 bg-card p-4">
            <Skeleton className="size-full rounded-md" />
          </div>
        </TextFamilyFallbackFrame>
      )
  }

  // Unsupported / unknown categories: a neutral page-sheet placeholder.
  return (
    <div
      data-slot="file-viewer-document-fallback"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "min-h-64 bg-muted/20",
        className
      )}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="flex flex-col items-center p-4">
          <Skeleton
            aria-hidden
            className="w-full rounded-none shadow-sm ring-1 ring-border"
            style={{ aspectRatio: "8.5 / 11" }}
          />
        </div>
      </div>
    </div>
  )
}

function TextFamilyFallbackFrame({
  bare,
  className,
  children,
}: {
  bare?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      data-slot="file-viewer-document-fallback"
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden bg-card",
        bare ? "h-full" : "min-h-64",
        className
      )}
    >
      {children}
    </div>
  )
}

function TableBodySkeleton() {
  const gutter = 52
  const colWidth = 150
  const cols = 6
  const rows = 14
  const widths = [70, 45, 88, 56, 62, 78]
  return (
    <div
      aria-hidden
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card text-sm"
    >
      <div className="flex border-b bg-muted/60">
        <div
          className="shrink-0 border-r"
          style={{ width: gutter, height: 33 }}
        />
        {Array.from({ length: cols }, (_, c) => (
          <div
            key={c}
            className="flex shrink-0 items-center border-r px-3"
            style={{ width: colWidth, height: 33 }}
          >
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex border-b" style={{ height: 33 }}>
            <div
              className="flex shrink-0 items-center justify-end border-r px-2"
              style={{ width: gutter }}
            >
              <Skeleton className="h-3 w-4" />
            </div>
            {Array.from({ length: cols }, (_, c) => (
              <div
                key={c}
                className="flex shrink-0 items-center border-r px-3"
                style={{ width: colWidth }}
              >
                <Skeleton
                  className="h-3"
                  style={{ width: `${widths[(r + c) % widths.length]}%` }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export class FileErrorBoundary extends React.Component<
  {
    children: React.ReactNode
    descriptor: FileDescriptor
    resource: ViewerResource
    className?: string
    resetKey?: unknown
    showDownload?: boolean
  },
  { error: unknown | null }
> {
  state: Readonly<{ error: unknown | null }> = { error: null }

  componentDidUpdate(prev: { resetKey?: unknown }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  render() {
    if (this.state.error != null) {
      return (
        <ViewerErrorState
          error={this.state.error}
          format="file"
          sourceKind={this.props.resource.sourceKind}
          download={
            this.props.showDownload === false
              ? null
              : this.props.resource.originalDownload
          }
          className={this.props.className}
        />
      )
    }
    return this.props.children
  }
}
