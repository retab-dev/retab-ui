// Web Worker that owns the SheetJS parse so it never blocks the UI thread.
// @e965/xlsx is a patched, zero-dependency republish of SheetJS. The main thread
// transfers the file bytes in; we parse, compute each sheet's dimensions, and
// post the parsed worksheet objects back for synchronous lazy reads there.
import * as XLSX from "@e965/xlsx"

interface SheetMeta {
  name: string
  rowCount: number
  colCount: number
}

type XlsxWorkerRequest = { buffer: ArrayBuffer }

// Cast the worker global to `Worker` so `onmessage`/`postMessage` type-check
// under the DOM lib without pulling in the conflicting "webworker" lib.
const ctx = self as unknown as Worker

ctx.onmessage = (event: MessageEvent<XlsxWorkerRequest>) => {
  try {
    // cellDates formats dates as text in `.w`; we never need styles or formulae.
    const wb = XLSX.read(event.data.buffer, { type: "array", cellDates: true })

    const worksheets = wb.SheetNames.map((name) => wb.Sheets[name])
    // Dimensions cover A1 → the range end, so column letters / row numbers stay
    // the real spreadsheet references (leading blank cells just read back empty).
    const sheets: SheetMeta[] = wb.SheetNames.map((name, i) => {
      const ref = worksheets[i]?.["!ref"]
      if (!ref) return { name, rowCount: 0, colCount: 0 }
      const r = XLSX.utils.decode_range(ref)
      return { name, rowCount: r.e.r + 1, colCount: r.e.c + 1 }
    })

    ctx.postMessage({ ok: true, sheets, worksheets })
  } catch (err) {
    ctx.postMessage({
      ok: false,
      error: err instanceof Error ? err.message : "Failed to parse spreadsheet",
    })
  }
}
