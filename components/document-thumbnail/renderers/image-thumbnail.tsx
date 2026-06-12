"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"
import { FileThumbnailShimmer } from "@/components/ui/file-thumbnail"
import { useThumbnailResource } from "@/components/document-thumbnail/cache"
import { useObjectUrl } from "@/components/document-thumbnail/renderers/use-object-url"
import type { ThumbnailAnchor } from "@/components/document-thumbnail/types"
import { ANCHOR_CORNER } from "@/components/document-thumbnail/types"

export function ImageFirstFrame({
  resource,
  anchor,
}: {
  resource: ViewerResource
  anchor: ThumbnailAnchor
}) {
  const directLoad = resource.getDirectLoad()
  if (directLoad.kind === "url") {
    return <ImageUrlPreview url={directLoad.url} anchor={anchor} />
  }

  return <ImageBlobPreview resource={resource} anchor={anchor} />
}

function ImageUrlPreview({
  url,
  anchor,
}: {
  url: string
  anchor: ThumbnailAnchor
}) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("absolute block w-full", ANCHOR_CORNER[anchor])}
      />
    </div>
  )
}

function ImageBlobPreview({
  resource,
  anchor,
}: {
  resource: ViewerResource
  anchor: ThumbnailAnchor
}) {
  const blobResource = React.useMemo(() => resource.readBlob(), [resource])
  const blob = useThumbnailResource(blobResource)
  const url = useObjectUrl(blob)

  if (!url) return <FileThumbnailShimmer />

  return <ImageUrlPreview url={url} anchor={anchor} />
}
