"use client"

import type * as React from "react"

import { cn } from "@/lib/utils"

import { getFileThumbnailExtension } from "./file-thumbnail-extension"
import { FileThumbnailFallback } from "./file-thumbnail-fallback"
import { FileThumbnailImage } from "./file-thumbnail-image"
import { FileThumbnailShimmer } from "./file-thumbnail-shimmer"
import type {
  FileThumbnailProps,
  FileThumbnailState,
} from "./file-thumbnail-types"

export { FileThumbnailShimmer }
export type {
  FileThumbnailProps,
  FileThumbnailState,
  ThumbnailFile,
} from "./file-thumbnail-types"

/**
 * A compact preview shell for a file: a fixed-ratio frame with a loading
 * shimmer, a fade-in once the preview loads, and a muted fallback surface when
 * there is no preview or it fails to load.
 *
 * It does not parse documents or pull in any renderer packages — generate the
 * thumbnail with whatever viewer stack you already use and pass it in through
 * `previewImageUrl` or `previewContent`.
 */
export function FileThumbnail({
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
}: FileThumbnailProps) {
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
