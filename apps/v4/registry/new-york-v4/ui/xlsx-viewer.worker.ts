// Web Worker that owns the SheetJS parse so it never blocks the UI thread.
// @e965/xlsx is a patched, zero-dependency republish of SheetJS. The main thread
// transfers the file bytes in; we parse and flatten each sheet into a *compact*
// shape — one concatenated text string plus transferable typed arrays — instead
// of shipping SheetJS's per-cell objects back. Structured-cloning hundreds of
// thousands of cell objects across the worker boundary was the dominant cost
// (a multi-hundred-ms freeze on the main thread); a string + two ArrayBuffers is
// a handful of ms.
import * as XLSX from "@e965/xlsx"

interface CompactSheet {
  name: string
  rows: number
  cols: number
  /** All cell display texts concatenated in row-major order. */
  text: string
  /** Length rows*cols+1; cell `i`'s text is text.slice(offsets[i], offsets[i+1]). */
  offsets: Uint32Array
  /** Length rows*cols; 1 = numeric/date (right-aligned), 0 otherwise. */
  numeric: Uint8Array
}

type XlsxWorkerRequest = { buffer: ArrayBuffer }

// Cast the worker global to `Worker` so `onmessage`/`postMessage` type-check
// under the DOM lib without pulling in the conflicting "webworker" lib.
const ctx = self as unknown as Worker

ctx.onmessage = (event: MessageEvent<XlsxWorkerRequest>) => {
  try {
    // cellDates formats dates as text in `.w`; we never need styles or formulae.
    const wb = XLSX.read(event.data.buffer, { type: "array", cellDates: true })

    const sheets: CompactSheet[] = []
    const transfer: ArrayBuffer[] = []

    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name]
      const ref = ws?.["!ref"]
      if (!ref) {
        const empty: CompactSheet = {
          name,
          rows: 0,
          cols: 0,
          text: "",
          offsets: new Uint32Array(1),
          numeric: new Uint8Array(0),
        }
        sheets.push(empty)
        transfer.push(
          empty.offsets.buffer as ArrayBuffer,
          empty.numeric.buffer as ArrayBuffer
        )
        continue
      }

      // Dimensions cover A1 → the range end, so column letters / row numbers
      // stay the real spreadsheet references (leading blanks read back empty).
      const range = XLSX.utils.decode_range(ref)
      const rows = range.e.r + 1
      const cols = range.e.c + 1
      const n = rows * cols

      const offsets = new Uint32Array(n + 1)
      const numeric = new Uint8Array(n)
      // Sparse: only non-empty cells get a string; empties stay undefined.
      const textAt = new Array<string | undefined>(n)

      // Iterate only the worksheet's actual cells (its keys are addresses), not
      // every grid position — so a sparse sheet costs O(non-empty), not O(rows*cols).
      for (const key of Object.keys(ws)) {
        if (key.charCodeAt(0) === 33) continue // skip "!ref", "!cols", "!merges", …
        const cell = ws[key]
        if (!cell) continue
        const { c, r } = XLSX.utils.decode_cell(key)
        if (r < 0 || c < 0 || r >= rows || c >= cols) continue
        const idx = r * cols + c
        textAt[idx] =
          cell.w != null
            ? String(cell.w)
            : cell.v != null
              ? String(cell.v)
              : ""
        if (cell.t === "n" || cell.t === "d") numeric[idx] = 1
      }

      const parts: string[] = []
      let pos = 0
      for (let i = 0; i < n; i++) {
        offsets[i] = pos
        const t = textAt[i]
        if (t) {
          parts.push(t)
          pos += t.length
        }
      }
      offsets[n] = pos

      sheets.push({ name, rows, cols, text: parts.join(""), offsets, numeric })
      transfer.push(offsets.buffer as ArrayBuffer, numeric.buffer as ArrayBuffer)
    }

    ctx.postMessage({ ok: true, sheets }, transfer)
  } catch (err) {
    ctx.postMessage({
      ok: false,
      error: err instanceof Error ? err.message : "Failed to parse spreadsheet",
    })
  }
}
