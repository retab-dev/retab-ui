import type * as React from "react"

import type { ViewerResource } from "@/lib/viewer-resource"
import type { ViewerDescriptor } from "@/lib/viewer-source"

import type { ThumbnailAnchor } from "./types"

export interface ThumbnailCacheKeyInput {
  resource: ViewerResource
  descriptor: ViewerDescriptor
  unit?: string
  options?: readonly string[]
}

export interface ThumbnailRenderKeyInput {
  cacheKey: string
  anchor: ThumbnailAnchor
  retryKey: React.Key | null
}

export function getThumbnailCacheKey({
  resource,
  descriptor,
  unit = "first",
  options = [],
}: ThumbnailCacheKeyInput): string {
  return [
    encodePart(`resource:${resource.cacheKey}`),
    encodePart(`category:${descriptor.category}`),
    encodePart(`unit:${unit}`),
    ...options.map((option) => encodePart(`option:${option}`)),
  ].join("")
}

export function getThumbnailRenderKey({
  cacheKey,
  anchor,
  retryKey,
}: ThumbnailRenderKeyInput): string {
  return [
    encodePart(`cache:${cacheKey}`),
    encodePart(`anchor:${anchor}`),
    encodeRetryKey(retryKey),
  ].join("")
}

function encodePart(value: string): string {
  return `${value.length}:${value}`
}

function encodeRetryKey(retryKey: React.Key | null): string {
  if (retryKey === null) return encodePart("retry:null:")
  return encodePart(`retry:${typeof retryKey}:${String(retryKey)}`)
}
