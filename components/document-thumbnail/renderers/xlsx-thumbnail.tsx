"use client"

import * as React from "react"

import {
  shortName,
  timed,
  withDecodeSlot,
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

const xlsxCache = new Map<string, Promise<XlsxPreview>>()

function getXlsxPreview(src: string, resourceKey = src): Promise<XlsxPreview> {
  let promise = xlsxCache.get(resourceKey)
  if (!promise) {
    promise = withDecodeSlot(() =>
      timed(`xlsx:total ${shortName(src)}`, async () => {
        const res = await fetch(src)
        if (!res.ok) throw new Error(`Failed to load spreadsheet: ${res.status}`)
        const buf = await res.arrayBuffer()
        const rows = await timed("xlsx:worker-parse", () =>
          parseXlsxInWorker(buf)
        )
        return { rows }
      })
    )
    xlsxCache.set(resourceKey, promise)
  }
  return promise
}

export function XlsxFirstSheet({
  src,
  resourceKey,
}: {
  src: string
  resourceKey: string
}) {
  const { rows } = React.use(getXlsxPreview(src, resourceKey))
  return <GridTable rows={rows} />
}
