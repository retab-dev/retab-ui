"use client"

import * as React from "react"

import type { ViewerResource } from "@/lib/viewer-resource"
import {
  cachedThumbnailResource,
  createThumbnailArtifactCache,
  shortName,
  timed,
  useThumbnailResource,
  withThumbnailDecodeSlot,
  withThumbnailFormatError,
  XLSX_THUMBNAIL_MAX_COLUMNS,
  XLSX_THUMBNAIL_MAX_ROWS,
  type ThumbnailCacheEntry,
} from "@/components/document-thumbnail/cache"
import { GridTable } from "@/components/document-thumbnail/renderers/layout"

interface XlsxPreview {
  rows: string[][]
}

interface XlsxWorkerReply {
  id: number
  ok: boolean
  rows?: string[][]
  error?: string
}

let xlsxWorker: Worker | null = null
let xlsxReqId = 0
const xlsxPending = new Map<
  number,
  { resolve: (r: string[][]) => void; reject: (e: Error) => void }
>()

function getXlsxWorker(): Worker {
  if (!xlsxWorker) {
    xlsxWorker = new Worker(
      new URL("../../document-thumbnail-xlsx.worker", import.meta.url)
    )
    xlsxWorker.onmessage = (e: MessageEvent<XlsxWorkerReply>) => {
      const { id, ok, rows, error } = e.data
      const entry = xlsxPending.get(id)
      if (!entry) return
      xlsxPending.delete(id)
      if (ok && rows) entry.resolve(rows)
      else entry.reject(new Error(error ?? "XLSX parse failed"))
    }
  }
  return xlsxWorker
}

function parseXlsxInWorker(buffer: ArrayBuffer): Promise<string[][]> {
  const worker = getXlsxWorker()
  const id = ++xlsxReqId
  return new Promise<string[][]>((resolve, reject) => {
    xlsxPending.set(id, { resolve, reject })
    worker.postMessage(
      {
        id,
        buffer,
        maxRows: XLSX_THUMBNAIL_MAX_ROWS,
        maxCols: XLSX_THUMBNAIL_MAX_COLUMNS,
      },
      [buffer]
    )
  })
}

const xlsxCache = createThumbnailArtifactCache<XlsxPreview>({
  maxEntries: 64,
})

function getXlsxPreview(
  resource: ViewerResource,
  cacheKey: string
): Promise<XlsxPreview> {
  return cachedThumbnailResource(xlsxCache, cacheKey, () =>
    withThumbnailDecodeSlot(() =>
      timed(`xlsx:total ${shortName(resource)}`, async () => {
        const rows = await withThumbnailFormatError(
          "xlsx",
          "parse_failed",
          resource.fileName,
          "Failed to parse spreadsheet thumbnail",
          async () => {
            const buf = await resource.readArrayBuffer()
            return timed("xlsx:worker-parse", () => parseXlsxInWorker(buf))
          }
        )
        return { rows }
      })
    )
  )
}

export function XlsxFirstSheet({
  resource,
  cacheKey,
}: {
  resource: ViewerResource
  cacheKey: string
}) {
  const { rows } = useThumbnailResource(getXlsxPreview(resource, cacheKey))
  return <GridTable rows={rows} />
}
