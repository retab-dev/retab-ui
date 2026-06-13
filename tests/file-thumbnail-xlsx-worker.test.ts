import * as XLSX from "@e965/xlsx"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// The xlsx thumbnail worker is a second, independent XLSX.read entry point.
// Like the viewer worker it relied on SheetJS to reject bad input — which it
// does not. These tests drive the real onmessage handler with real .xlsx bytes
// and verify the shared container guard now rejects non-spreadsheet files.
// ---------------------------------------------------------------------------

interface ThumbResponse {
  id: number
  ok: boolean
  rows?: string[][]
  error?: string
}

interface WorkerCtx {
  onmessage: ((event: MessageEvent) => void) | null
  posts: ThumbResponse[]
  postMessage: (response: unknown) => void
}

async function loadWorker(): Promise<WorkerCtx> {
  const ctx: WorkerCtx = {
    onmessage: null,
    posts: [],
    postMessage(response) {
      this.posts.push(response as ThumbResponse)
    },
  }
  vi.stubGlobal("self", ctx)
  vi.resetModules()
  await import("@/components/file-thumbnail-xlsx.worker")
  return ctx
}

function xlsxBuffer(rows: unknown[][]): ArrayBuffer {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "S")
  const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" })
  const bytes = out instanceof Uint8Array ? out : new Uint8Array(out)
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
}

async function request(req: {
  buffer: ArrayBuffer
  maxRows: number
  maxCols: number
  id?: number
}): Promise<ThumbResponse> {
  const ctx = await loadWorker()
  expect(ctx.onmessage).not.toBeNull()
  ctx.onmessage?.({
    data: { id: req.id ?? 1, ...req },
  } as MessageEvent)
  expect(ctx.posts).toHaveLength(1)
  return ctx.posts[0]
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("xlsx thumbnail worker", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("returns the leading rows and columns of the first sheet", async () => {
    const response = await request({
      buffer: xlsxBuffer([
        ["Name", "Qty", "Price"],
        ["Widget", 3, 9.5],
        ["Gadget", 12, 4.25],
      ]),
      maxRows: 2,
      maxCols: 2,
      id: 42,
    })

    expect(response.ok).toBe(true)
    expect(response.id).toBe(42)
    // Sliced to maxRows x maxCols.
    expect(response.rows).toEqual([
      ["Name", "Qty"],
      ["Widget", "3"],
    ])
  })

  it("clamps to the available data when maxRows/maxCols exceed the sheet", async () => {
    const response = await request({
      buffer: xlsxBuffer([["only"]]),
      maxRows: 50,
      maxCols: 50,
    })

    expect(response.ok).toBe(true)
    expect(response.rows).toEqual([["only"]])
  })

  it("rejects non-spreadsheet bytes instead of thumbnailing junk", async () => {
    const response = await request({
      buffer: new TextEncoder().encode("not a spreadsheet at all")
        .buffer as ArrayBuffer,
      maxRows: 8,
      maxCols: 8,
    })

    expect(response.ok).toBe(false)
    expect(response.rows).toBeUndefined()
    expect(response.error).toMatch(/not a recognized spreadsheet/i)
  })

  it("rejects an empty buffer", async () => {
    const response = await request({
      buffer: new Uint8Array([]).buffer as ArrayBuffer,
      maxRows: 8,
      maxCols: 8,
    })

    expect(response.ok).toBe(false)
  })

  it("reports a failure for a corrupt ZIP container without throwing", async () => {
    const response = await request({
      buffer: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])
        .buffer as ArrayBuffer,
      maxRows: 8,
      maxCols: 8,
    })

    expect(response.ok).toBe(false)
    expect(typeof response.error).toBe("string")
  })
})
