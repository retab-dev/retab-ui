// Parses the first rows of a spreadsheet's first sheet off the main thread.
// XLSX.read is fully synchronous CPU and was the largest UI-thread block of the
// thumbnail grid; running it here keeps the page responsive. `sheetRows` stops
// the parser early so a 100k-row workbook costs the same as a 16-row one.
import * as XLSX from "@e965/xlsx"

import { isSpreadsheetContainer } from "@/registry/new-york-v4/lib/xlsx-worker-protocol"

interface Req {
  id: number
  buffer: ArrayBuffer
  maxRows: number
  maxCols: number
}

const ctx = self as unknown as Worker

ctx.onmessage = (event: MessageEvent<Req>) => {
  const { id, buffer, maxRows, maxCols } = event.data
  try {
    // SheetJS sniffs arbitrary bytes into a stub sheet; reject non-spreadsheet
    // input so a mislabeled file yields no thumbnail rather than junk cells.
    if (!isSpreadsheetContainer(buffer)) {
      throw new Error("File is not a recognized spreadsheet (.xlsx or .xls).")
    }
    const wb = XLSX.read(new Uint8Array(buffer), {
      type: "array",
      sheetRows: maxRows,
    })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const grid = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      blankrows: false,
      defval: "",
      raw: false,
    })
    const rows = grid
      .slice(0, maxRows)
      .map((r) => (Array.isArray(r) ? r.slice(0, maxCols).map((c) => `${c ?? ""}`) : []))
    ctx.postMessage({ id, ok: true, rows })
  } catch (err) {
    ctx.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
