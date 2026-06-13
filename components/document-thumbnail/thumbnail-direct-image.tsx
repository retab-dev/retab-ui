"use client"

import type { ViewerResource } from "@/lib/viewer-resource"
import type { ViewerDescriptor } from "@/lib/viewer-source"
import { FileThumbnail } from "@/components/ui/file-thumbnail"

import { isTiffDescriptor } from "./descriptor"
import {
  createThumbnailErrorState,
  type ThumbnailErrorState,
} from "./thumbnail-error-state"
import { createThumbnailImageLoadError } from "./thumbnail-errors"
import { ANCHOR_OBJECT_POSITION, type ThumbnailAnchor } from "./types"

export function isDirectImageThumbnail({
  descriptor,
  directUrl,
}: {
  descriptor: ViewerDescriptor
  directUrl?: string | null
}): boolean {
  return (
    descriptor.category === "image" &&
    !isTiffDescriptor(descriptor) &&
    Boolean(directUrl)
  )
}

export function DirectImageThumbnail({
  descriptor,
  resource,
  directUrl,
  previewAspectRatio,
  className,
  anchor,
  renderKey,
  errorState,
  onError,
}: {
  descriptor: ViewerDescriptor
  resource: ViewerResource
  directUrl: string
  previewAspectRatio: number
  className?: string
  anchor: ThumbnailAnchor
  renderKey: string
  errorState: ThumbnailErrorState | null
  onError?: (error: unknown, errorState: ThumbnailErrorState) => void
}) {
  const failedDirectImage =
    errorState?.info.format === "image" ? errorState : null

  return (
    <FileThumbnail
      file={{ name: descriptor.displayName, type: descriptor.mimeType ?? "" }}
      previewImageUrl={directUrl}
      previewAspectRatio={previewAspectRatio}
      className={className}
      previewClassName={ANCHOR_OBJECT_POSITION[anchor]}
      state={failedDirectImage ? "error" : "loaded"}
      aria-label={failedDirectImage?.info.userMessage}
      title={failedDirectImage?.info.userMessage}
      data-error-domain={failedDirectImage?.info.domain}
      data-error-format={failedDirectImage?.info.format}
      data-error-kind={failedDirectImage?.info.kind}
      data-error-message={failedDirectImage?.info.message}
      onPreviewError={() => {
        const error = createThumbnailImageLoadError()
        const nextErrorState = createThumbnailErrorState({
          renderKey,
          error,
          resource,
          descriptor,
        })
        onError?.(error, nextErrorState)
      }}
    />
  )
}
