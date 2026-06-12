"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"
import { FileThumbnailShimmer } from "@/components/ui/file-thumbnail"
import {
  cachedThumbnailResource,
  shortName,
  timed,
  useThumbnailResource,
  withThumbnailDecodeSlot,
  type ThumbnailCacheEntry,
} from "@/components/document-thumbnail/cache"
import { useObjectUrl } from "@/components/document-thumbnail/renderers/use-object-url"
import type { ThumbnailAnchor } from "@/components/document-thumbnail/types"
import { ANCHOR_CORNER } from "@/components/document-thumbnail/types"

const TIFF_TARGET_W = 320

interface TiffWorkerReply {
  id: number
  ok: boolean
  blob?: Blob
  error?: string
}

let tiffWorker: Worker | null = null
let tiffReqId = 0
const tiffPending = new Map<
  number,
  { resolve: (b: Blob) => void; reject: (e: Error) => void }
>()

function getTiffWorker(): Worker {
  if (!tiffWorker) {
    tiffWorker = new Worker(
      new URL("../../document-thumbnail-tiff.worker", import.meta.url)
    )
    tiffWorker.onmessage = (e: MessageEvent<TiffWorkerReply>) => {
      const { id, ok, blob, error } = e.data
      const entry = tiffPending.get(id)
      if (!entry) return
      tiffPending.delete(id)
      if (ok && blob) entry.resolve(blob)
      else entry.reject(new Error(error ?? "TIFF decode failed"))
    }
  }
  return tiffWorker
}

function decodeTiffInWorker(buffer: ArrayBuffer): Promise<Blob> {
  const worker = getTiffWorker()
  const id = ++tiffReqId
  return new Promise<Blob>((resolve, reject) => {
    tiffPending.set(id, { resolve, reject })
    worker.postMessage({ id, buffer, targetWidth: TIFF_TARGET_W }, [buffer])
  })
}

const tiffCache = new Map<string, ThumbnailCacheEntry<Blob>>()

function getTiffFirstPageBlob(
  resource: ViewerResource,
  cacheKey: string
): Promise<Blob> {
  return cachedThumbnailResource(tiffCache, cacheKey, () =>
    withThumbnailDecodeSlot(() =>
      timed(`tiff:total ${shortName(resource)}`, async () => {
        const buf = await timed("tiff:fetch", () => resource.readArrayBuffer())
        return timed("tiff:worker-decode", () => decodeTiffInWorker(buf))
      })
    )
  )
}

export function TiffFirstPage({
  resource,
  cacheKey,
  anchor,
}: {
  resource: ViewerResource
  cacheKey: string
  anchor: ThumbnailAnchor
}) {
  const blob = useThumbnailResource(getTiffFirstPageBlob(resource, cacheKey))
  return <TiffBlobImage blob={blob} anchor={anchor} />
}

function TiffBlobImage({
  blob,
  anchor,
}: {
  blob: Blob
  anchor: ThumbnailAnchor
}) {
  const url = useObjectUrl(blob)

  if (!url) return <FileThumbnailShimmer />

  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <img
        src={url}
        alt=""
        className={cn("absolute block w-full", ANCHOR_CORNER[anchor])}
      />
    </div>
  )
}
