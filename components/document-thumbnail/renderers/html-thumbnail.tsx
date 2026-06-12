"use client"

import * as React from "react"

import type { ViewerResource } from "@/lib/viewer-resource"
import {
  getThumbnailText,
  useThumbnailResource,
} from "@/components/document-thumbnail/cache"
import { IframeDoc } from "@/components/document-thumbnail/renderers/layout"

export function HtmlFirstPage({
  resource,
  cacheKey,
}: {
  resource: ViewerResource
  cacheKey: string
}) {
  const html = useThumbnailResource(getThumbnailText(resource, cacheKey))
  return <IframeDoc html={html} />
}
