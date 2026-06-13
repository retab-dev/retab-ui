"use client"

import * as React from "react"

import type { ViewerSource } from "@/lib/viewer-source"
import { DocumentThumbnail } from "@/components/document-thumbnail"

import {
  FileThumbnailFrame,
  FileThumbnailShimmer,
  hasRenderablePreviewContent,
  resolveFileThumbnailState,
} from "./file-thumbnail-frame"
import type {
  FileThumbnailFrameProps,
  FileThumbnailProps,
  FileThumbnailSource,
  FileThumbnailState,
  ThumbnailFile,
} from "./file-thumbnail-types"

export {
  FileThumbnailFrame,
  FileThumbnailShimmer,
  hasRenderablePreviewContent,
  resolveFileThumbnailState,
}
export type {
  FileThumbnailFrameProps,
  FileThumbnailProps,
  FileThumbnailSource,
  FileThumbnailState,
  ThumbnailFile,
}

/**
 * Render a complete file thumbnail from a browser File, a viewer source, an
 * externally generated image, custom preview content, or plain file metadata.
 */
export function FileThumbnail({
  source,
  file,
  as,
  anchor,
  retryKey,
  onError,
  ...frameProps
}: FileThumbnailProps) {
  const resolvedSource = resolveFileThumbnailSource(source, file)
  const {
    previewClassName: _previewClassName,
    previewContent: _previewContent,
    previewImageUrl: _previewImageUrl,
    onPreviewError: _onPreviewError,
    state: _state,
    ...thumbnailProps
  } = frameProps

  if (shouldUseFrame(frameProps) || !resolvedSource) {
    return (
      <FileThumbnailFrame
        {...frameProps}
        file={file ?? fileFromSource(resolvedSource)}
      />
    )
  }

  return (
    <DocumentThumbnail
      source={resolvedSource}
      as={as}
      anchor={anchor}
      retryKey={retryKey}
      onError={onError}
      {...thumbnailProps}
    />
  )
}

function shouldUseFrame({
  previewContent,
  previewImageUrl,
  state,
}: Pick<
  FileThumbnailProps,
  "previewContent" | "previewImageUrl" | "state"
>): boolean {
  return (
    hasRenderablePreviewContent(previewContent) ||
    Boolean(previewImageUrl) ||
    state !== undefined
  )
}

function resolveFileThumbnailSource(
  source: FileThumbnailProps["source"],
  file: FileThumbnailProps["file"]
): ViewerSource | null {
  if (isFile(source)) return fileSource(source)
  if (source) return source
  if (isFile(file)) return fileSource(file)
  return null
}

function isFile(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File
}

function fileSource(file: File): ViewerSource {
  return {
    kind: "blob",
    blob: file,
    identityKey: `${file.name}-${file.size}-${file.lastModified}`,
    fileName: file.name,
    mimeType: file.type,
  }
}

function fileFromSource(source: ViewerSource | null): ThumbnailFile {
  if (!source) return { name: "file", type: "" }
  if (isFile(source)) return source
  return {
    name: source.fileName ?? "file",
    type: source.mimeType ?? "",
  }
}
