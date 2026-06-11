"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { FileThumbnailShimmer } from "@/components/ui/file-thumbnail"
import type { ThumbnailAnchor } from "@/components/document-thumbnail/types"
import { ANCHOR_CORNER } from "@/components/document-thumbnail/types"
import {
  shortName,
  timed,
  withDecodeSlot,
} from "@/components/document-thumbnail/cache"
import { useObjectUrl } from "@/components/document-thumbnail/renderers/use-object-url"

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

const tiffCache = new Map<string, Promise<Blob>>()

function getTiffFirstPageBlob(src: string, resourceKey = src): Promise<Blob> {
  let promise = tiffCache.get(resourceKey)
  if (!promise) {
    promise = withDecodeSlot(() =>
      timed(`tiff:total ${shortName(src)}`, async () => {
        const buf = await timed("tiff:fetch", () =>
          fetch(src).then((r) => {
            if (!r.ok) throw new Error(`Failed to load TIFF: ${r.status}`)
            return r.arrayBuffer()
          })
        )
        return timed("tiff:worker-decode", () =>
          decodeTiffInWorker(buf)
        )
      })
    )
    tiffCache.set(resourceKey, promise)
  }
  return promise
}

export function TiffFirstPage({
  src,
  resourceKey,
  anchor,
}: {
  src: string
  resourceKey: string
  anchor: ThumbnailAnchor
}) {
  const blob = React.use(getTiffFirstPageBlob(src, resourceKey))
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className={cn("absolute block w-full", ANCHOR_CORNER[anchor])}
      />
    </div>
  )
}
