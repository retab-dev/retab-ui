"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"
import { FileThumbnailShimmer } from "@/components/ui/file-thumbnail"
import {
  cachedThumbnailResource,
  createThumbnailArtifactCache,
  createThumbnailImageLoadError,
  shortName,
  thumbnailFileMeta,
  TIFF_THUMBNAIL_TARGET_WIDTH,
  timed,
  useThumbnailResource,
  withThumbnailDecodeSlot,
  withThumbnailFormatError,
  type ThumbnailBytesContent,
  type ThumbnailFileMeta,
} from "@/components/document-thumbnail/cache"
import { useObjectUrl } from "@/components/document-thumbnail/renderers/use-object-url"
import type { ThumbnailAnchor } from "@/components/document-thumbnail/types"
import { ANCHOR_CORNER } from "@/components/document-thumbnail/types"

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
    worker.postMessage(
      { id, buffer, targetWidth: TIFF_THUMBNAIL_TARGET_WIDTH },
      [buffer]
    )
  })
}

const tiffCache = createThumbnailArtifactCache<Blob>({ maxEntries: 48 })

function getTiffFirstPageBlob(
  meta: ThumbnailFileMeta,
  content: ThumbnailBytesContent,
  thumbnailKey: string
): Promise<Blob> {
  return cachedThumbnailResource(tiffCache, thumbnailKey, () =>
    withThumbnailDecodeSlot(() =>
      withThumbnailFormatError(
        "image",
        "decode_failed",
        meta.fileName,
        "Failed to decode TIFF thumbnail",
        () =>
          timed(`tiff:total ${shortName(meta)}`, async () => {
            const buf = await timed("tiff:fetch", () => content.readBytes())
            return timed("tiff:worker-decode", () => decodeTiffInWorker(buf))
          })
      )
    )
  )
}

export function TiffFirstPage({
  resource,
  thumbnailKey,
  anchor,
  onError,
}: {
  resource: ViewerResource
  thumbnailKey: string
  anchor: ThumbnailAnchor
  onError: (error: unknown) => void
}) {
  const blob = useThumbnailResource(
    getTiffFirstPageBlob(
      thumbnailFileMeta(resource),
      resource.content,
      thumbnailKey
    )
  )
  return <TiffBlobImage blob={blob} anchor={anchor} onError={onError} />
}

function TiffBlobImage({
  blob,
  anchor,
  onError,
}: {
  blob: Blob
  anchor: ThumbnailAnchor
  onError: (error: unknown) => void
}) {
  const url = useObjectUrl(blob)

  if (!url) return <FileThumbnailShimmer />

  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <img
        src={url}
        alt=""
        className={cn("absolute block w-full", ANCHOR_CORNER[anchor])}
        onError={() => onError(createThumbnailImageLoadError())}
      />
    </div>
  )
}
