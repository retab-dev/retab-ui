"use client"

import type * as React from "react"

import { cn } from "@/lib/utils"

import { getFileThumbnailExtension } from "./file-thumbnail-extension"
import { FileThumbnailFallback } from "./file-thumbnail-fallback"
import type {
  FileThumbnailFrameProps,
  FileThumbnailState,
} from "./file-thumbnail-frame-types"
import { FileThumbnailImage } from "./file-thumbnail-image"
import { FileThumbnailShimmer } from "./file-thumbnail-shimmer"

export { FileThumbnailShimmer }
export type { FileThumbnailFrameProps, FileThumbnailState }

/**
 * The dependency-free thumbnail frame: loading shimmer, image fade-in,
 * custom-rendered preview slot, and extension fallback.
 */
export function FileThumbnailFrame({
  file,
  className,
  previewAspectRatio,
  previewClassName,
  previewContent,
  previewImageUrl,
  onPreviewError,
  state,
  style,
  ...props
}: FileThumbnailFrameProps) {
  const extension = getFileThumbnailExtension(file)
  const hasRenderableContent = hasRenderablePreviewContent(previewContent)
  const resolvedState = resolveFileThumbnailState({
    explicitState: state,
    hasPreview: hasRenderableContent || Boolean(previewImageUrl),
  })

  return (
    <div
      {...props}
      data-slot="file-thumbnail"
      className={cn(
        "relative overflow-hidden rounded-md border bg-muted text-muted-foreground",
        className
      )}
      style={{
        ...style,
        aspectRatio: style?.aspectRatio ?? String(previewAspectRatio ?? 3 / 4),
      }}
    >
      {resolvedState === "loading" ? (
        <FileThumbnailShimmer />
      ) : resolvedState === "error" ? (
        <FileThumbnailFallback extension={extension} />
      ) : hasRenderableContent ? (
        <div className={cn("absolute inset-0", previewClassName)}>
          {previewContent}
        </div>
      ) : previewImageUrl ? (
        <FileThumbnailImage
          key={previewImageUrl}
          url={previewImageUrl}
          alt={file.name}
          className={previewClassName}
          fallback={<FileThumbnailFallback extension={extension} />}
          onError={onPreviewError}
        />
      ) : (
        <FileThumbnailFallback extension={extension} />
      )}
    </div>
  )
}

export function resolveFileThumbnailState({
  explicitState,
  hasPreview,
}: {
  explicitState?: FileThumbnailState
  hasPreview: boolean
}): FileThumbnailState {
  if (explicitState) return explicitState
  return hasPreview ? "loaded" : "error"
}

export function hasRenderablePreviewContent(value: React.ReactNode): boolean {
  return value !== null && value !== undefined && value !== false
}
