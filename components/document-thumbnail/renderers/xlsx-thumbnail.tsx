"use client"

import * as React from "react"

import type { ViewerResource } from "@/lib/viewer-resource"
import {
  cachedThumbnailResource,
  shortName,
  timed,
  useThumbnailResource,
  withThumbnailDecodeSlot,
  type ThumbnailCacheEntry,
} from "@/components/document-thumbnail/cache"
import { GridTable } from "@/components/document-thumbnail/renderers/layout"

interface XlsxPreview {
  rows: string[][]
}

const XLSX_MAX_ROWS = 16
const XLSX_MAX_COLS = 6

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
      { id, buffer, maxRows: XLSX_MAX_ROWS, maxCols: XLSX_MAX_COLS },
      [buffer]
    )
  })
}

const xlsxCache = new Map<string, ThumbnailCacheEntry<XlsxPreview>>()

function getXlsxPreview(
  resource: ViewerResource,
  cacheKey: string
): Promise<XlsxPreview> {
  return cachedThumbnailResource(xlsxCache, cacheKey, () =>
    withThumbnailDecodeSlot(() =>
      timed(`xlsx:total ${shortName(resource)}`, async () => {
        const buf = await resource.readArrayBuffer()
        const rows = await timed("xlsx:worker-parse", () =>
          parseXlsxInWorker(buf)
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
