// Web Worker that owns the SheetJS parse so it never blocks the UI thread.
// @e965/xlsx is a patched, zero-dependency republish of SheetJS. The main thread
// transfers the file bytes in; the worker parses the workbook and flattens it
// into sparse compact sheets before transferring typed-array buffers back.
import * as XLSX from "@e965/xlsx"

import {
  compactWorkbookTransferBuffers,
  flattenSheetJsWorkbook,
} from "@/lib/xlsx-sheetjs-flattener"
import {
  XlsxWorkerError,
  type XlsxWorkerRequest,
  type XlsxWorkerResponse,
} from "@/lib/xlsx-worker-protocol"

// Cast the worker global to `Worker` so `onmessage`/`postMessage` type-check
// under the DOM lib without pulling in the conflicting "webworker" lib.
const ctx = self as unknown as Worker

ctx.onmessage = (event: MessageEvent<XlsxWorkerRequest>) => {
  try {
    if (event.data.type !== "parse_workbook") {
      throw new XlsxWorkerError(
        "parse_failed",
        "Unsupported spreadsheet request"
      )
    }

    // cellDates formats dates as text in `.w`; we never need styles or formulae.
    const workbook = XLSX.read(event.data.buffer, {
      type: "array",
      cellDates: true,
    })
    const sheets = flattenSheetJsWorkbook(workbook)
    const response: XlsxWorkerResponse = { type: "workbook", sheets }
    ctx.postMessage(response, compactWorkbookTransferBuffers(sheets))
  } catch (error) {
    const response: XlsxWorkerResponse = {
      type: "error",
      code: error instanceof XlsxWorkerError ? error.code : "parse_failed",
      message:
        error instanceof Error ? error.message : "Failed to parse spreadsheet",
    }
    ctx.postMessage(response)
  }
}
