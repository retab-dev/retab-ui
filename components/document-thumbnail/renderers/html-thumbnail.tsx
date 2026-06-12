"use client"

import * as React from "react"

import type { ViewerResource } from "@/lib/viewer-resource"
import {
  getThumbnailText,
  thumbnailFileMeta,
  useThumbnailResource,
} from "@/components/document-thumbnail/cache"
import { IframeDoc } from "@/components/document-thumbnail/renderers/layout"

export function HtmlFirstPage({
  resource,
  thumbnailKey,
}: {
  resource: ViewerResource
  thumbnailKey: string
}) {
  const html = useThumbnailResource(
    getThumbnailText(
      thumbnailFileMeta(resource),
      resource.content,
      thumbnailKey
    )
  )
  return <IframeDoc html={html} />
}
