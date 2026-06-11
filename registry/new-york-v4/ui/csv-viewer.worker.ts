import {
  createCsvNormalizer,
  createCsvParser,
  padRowsToColumnCount,
  type CsvDialect,
} from "@/lib/csv"

import type { CsvWorkerRequest, CsvWorkerResponse } from "./csv-viewer-worker"

function post(message: CsvWorkerResponse) {
  self.postMessage(message)
}

async function* readWorkerTextChunks(
  source: Blob | string
): AsyncGenerator<string> {
  if (typeof source === "string") {
    const size = 1 << 20
    for (let offset = 0; offset < source.length; offset += size) {
      yield source.slice(offset, offset + size)
    }
    return
  }

  const reader = source.stream().getReader()
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        const text = decoder.decode(value, { stream: true })
        if (text) yield text
      }
    }
    const rest = decoder.decode()
    if (rest) yield rest
  } finally {
    reader.releaseLock()
  }
}

async function parseInWorker({
  parseRequestId,
  source,
  dialect,
  batchSize,
}: CsvWorkerRequest) {
  const parser = createCsvParser({ delimiter: dialect.delimiter })
  const normalizer = createCsvNormalizer({ hasHeader: dialect.hasHeader })
  let batch: string[][] = []

  const handleRecords = (records: string[][]) => {
    for (const record of records) {
      for (const event of normalizer.accept(record)) {
        if (event.type === "columns") {
          padRowsToColumnCount(batch, event.columns.length)
          post({ type: "columns", parseRequestId, columns: event.columns })
        } else {
          batch.push(event.row)
        }
      }
      if (batch.length >= batchSize) {
        post({ type: "rows", parseRequestId, rows: batch })
        batch = []
      }
    }
  }

  for await (const chunk of readWorkerTextChunks(source)) {
    handleRecords(parser.push(chunk))
  }
  handleRecords(parser.flush())
  if (batch.length) post({ type: "rows", parseRequestId, rows: batch })
  post({ type: "done", parseRequestId })
}

self.onmessage = (event: MessageEvent<CsvWorkerRequest>) => {
  void parseInWorker(event.data).catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    post({
      type: "error",
      parseRequestId: event.data.parseRequestId,
      message,
    })
  })
}
