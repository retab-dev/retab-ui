import type { CsvDialect } from "@/lib/csv"

export interface CsvWorkerRequest {
  parseRequestId: string
  source: Blob
  dialect: CsvDialect
  batchSize: number
}

export type CsvWorkerResponse =
  | { type: "columns"; parseRequestId: string; columns: string[] }
  | { type: "sourceRows"; parseRequestId: string; sourceRows: string[][] }
  | { type: "done"; parseRequestId: string }
  | { type: "error"; parseRequestId: string; message: string }

export function createCsvWorker(): Worker {
  return new Worker(new URL("./csv-viewer.worker.ts", import.meta.url), {
    type: "module",
  })
}

export function parseCsvInWorker({
  source,
  dialect,
  batchSize,
  onColumns,
  onSourceRows,
  signal,
}: {
  source: Blob
  dialect: CsvDialect
  batchSize: number
  onColumns: (columns: string[]) => void
  onSourceRows: (sourceRows: string[][]) => void
  signal: AbortSignal
}): Promise<void> {
  return new Promise((resolve, reject) => {
    let worker: Worker
    try {
      worker = createCsvWorker()
    } catch {
      reject(new Error("worker-unavailable"))
      return
    }

    const parseRequestId = crypto.randomUUID()
    const cleanup = () => {
      signal.removeEventListener("abort", abort)
      worker.terminate()
    }
    const abort = () => {
      cleanup()
      reject(new DOMException("Aborted", "AbortError"))
    }

    signal.addEventListener("abort", abort, { once: true })
    worker.onerror = () => {
      cleanup()
      reject(new Error("worker-error"))
    }
    worker.onmessage = (event: MessageEvent<CsvWorkerResponse>) => {
      const message = event.data
      if (message.parseRequestId !== parseRequestId) return
      if (message.type === "columns") onColumns(message.columns)
      else if (message.type === "sourceRows") onSourceRows(message.sourceRows)
      else if (message.type === "done") {
        cleanup()
        resolve()
      } else {
        cleanup()
        reject(new Error(message.message || "worker-error"))
      }
    }

    const request: CsvWorkerRequest = {
      parseRequestId,
      source,
      dialect,
      batchSize,
    }
    worker.postMessage(request)
  })
}
