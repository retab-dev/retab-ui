"use client"

import * as React from "react"

import { createViewerResource } from "@/lib/viewer-resource"
import { FileThumbnailFrame } from "@/components/ui/file-thumbnail-frame"
import { resolveThumbnailDescriptor } from "@/components/document-thumbnail/descriptor"
import {
  getThumbnailKey,
  getThumbnailRenderKey,
} from "@/components/document-thumbnail/keys"
import { ThumbnailClientPreview } from "@/components/document-thumbnail/thumbnail-client-preview"
import {
  DirectImageThumbnail,
  isDirectImageThumbnail,
} from "@/components/document-thumbnail/thumbnail-direct-image"
import {
  createThumbnailErrorState,
  type ThumbnailErrorState,
} from "@/components/document-thumbnail/thumbnail-error-state"
import { getThumbnailOptions } from "@/components/document-thumbnail/thumbnail-options"
import {
  type DocumentThumbnailProps,
  type ThumbnailAnchor,
} from "@/components/document-thumbnail/types"

export type { DocumentThumbnailProps, ThumbnailAnchor }

/**
 * Generates a first-unit thumbnail for a document — page 1, first sheet, or
 * first slide — then drops it into the dependency-free `FileThumbnail` shell.
 */
export function DocumentThumbnail({
  source,
  as,
  className,
  previewAspectRatio = 3 / 4,
  anchor = "top-left",
  retryKey,
  onError,
  ...props
}: DocumentThumbnailProps) {
  const descriptor = resolveThumbnailDescriptor({ source, as })
  const resource = React.useMemo(() => createViewerResource(source), [source])
  const thumbnailKey = getThumbnailKey({
    resource,
    descriptor,
    options: getThumbnailOptions(descriptor),
  })
  const renderKey = getThumbnailRenderKey({
    thumbnailKey,
    anchor,
    retryKey: retryKey ?? null,
  })
  const [errorState, setErrorState] =
    React.useState<ThumbnailErrorState | null>(null)
  const currentErrorState =
    errorState?.renderKey === renderKey ? errorState : null
  const directUrl = resource.content.directUrl

  if (descriptor.category === "unsupported") {
    return (
      <FileThumbnailFrame
        {...props}
        file={{ name: descriptor.displayName, type: descriptor.mimeType ?? "" }}
        previewAspectRatio={previewAspectRatio}
        className={className}
      />
    )
  }

  if (isDirectImageThumbnail({ descriptor, directUrl })) {
    return (
      <DirectImageThumbnail
        descriptor={descriptor}
        resource={resource}
        directUrl={directUrl!}
        previewAspectRatio={previewAspectRatio}
        className={className}
        anchor={anchor}
        renderKey={renderKey}
        errorState={currentErrorState}
        thumbnailProps={props}
        onError={(error, nextErrorState) => {
          setErrorState(nextErrorState)
          onError?.(error, nextErrorState.info)
        }}
      />
    )
  }

  return (
    <FileThumbnailFrame
      {...props}
      file={{ name: descriptor.displayName, type: descriptor.mimeType ?? "" }}
      previewAspectRatio={previewAspectRatio}
      className={className}
      state={currentErrorState ? "error" : "loaded"}
      aria-label={currentErrorState?.info.userMessage}
      title={currentErrorState?.info.userMessage}
      data-error-domain={currentErrorState?.info.domain}
      data-error-format={currentErrorState?.info.format}
      data-error-kind={currentErrorState?.info.kind}
      data-error-message={currentErrorState?.info.message}
      previewContent={
        <ThumbnailClientPreview
          key={renderKey}
          resource={resource}
          descriptor={descriptor}
          thumbnailKey={thumbnailKey}
          anchor={anchor}
          onError={(error) => {
            const nextErrorState = createThumbnailErrorState({
              renderKey,
              error,
              resource,
              descriptor,
            })
            setErrorState(nextErrorState)
            onError?.(error, nextErrorState.info)
          }}
        />
      }
    />
  )
}
