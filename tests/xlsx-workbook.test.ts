import { describe, expect, it, vi } from "vitest"

import {
  buildXlsxSourceFromCompact,
  compactSheetByteSize,
  createCompactSheet,
  getCompactSheetCell,
  resolveXlsxSheetChange,
  xlsxColumnLabel,
  XlsxSourceCache,
  type XlsxSource,
} from "@/registry/new-york-v4/lib/xlsx-workbook"
import {
  sourceToXlsxCell,
  spreadsheetAnchorToCell,
  spreadsheetColumnToIndex,
} from "@/registry/new-york-v4/ui/xlsx-source"

function source(name = "Sheet1"): XlsxSource {
  return buildXlsxSourceFromCompact([
    createCompactSheet({
      name,
      rowCount: 1,
      columnCount: 1,
      entries: [{ cellIndex: 0, text: "ok" }],
    }),
  ])
}

describe("xlsx workbook helpers", () => {
  it("creates spreadsheet column labels", () => {
    expect(xlsxColumnLabel(0)).toBe("A")
    expect(xlsxColumnLabel(25)).toBe("Z")
    expect(xlsxColumnLabel(26)).toBe("AA")
    expect(xlsxColumnLabel(701)).toBe("ZZ")
    expect(xlsxColumnLabel(-1)).toBe("")
  })

  it("reads sparse compact sheet cells without dense allocation", () => {
    const sheet = createCompactSheet({
      name: "Sparse",
      rowCount: 100_000,
      columnCount: 100,
      entries: [
        { cellIndex: 0, text: "A1" },
        { cellIndex: 99_999 * 100 + 50, text: "far", numeric: true },
      ],
    })

    expect(sheet.cellIndexes.length).toBe(2)
    expect(getCompactSheetCell(sheet, 0, 0)).toEqual({
      text: "A1",
      numeric: false,
    })
    expect(getCompactSheetCell(sheet, 99_999, 50)).toEqual({
      text: "far",
      numeric: true,
    })
    expect(getCompactSheetCell(sheet, 50, 50)).toEqual({
      text: "",
      numeric: false,
    })
    expect(getCompactSheetCell(sheet, -1, 0)).toEqual({
      text: "",
      numeric: false,
    })
  })

  it("builds source metadata and clamps out-of-range reads to an empty cell", () => {
    const workbook = source("Data")

    expect(workbook.sheets).toEqual([
      {
        name: "Data",
        rowCount: 1,
        columnCount: 1,
        nonEmptyCellCount: 1,
      },
    ])
    expect(workbook.getCell(0, 0, 0).text).toBe("ok")
    expect(workbook.getCell(0, 1, 0).text).toBe("")
    expect(workbook.getCell(5, 0, 0).text).toBe("")
  })

  it("accepts only valid sheet changes and reports whether they changed", () => {
    expect(
      resolveXlsxSheetChange({
        activeSheet: 0,
        requestedSheet: 1,
        sheetCount: 2,
      })
    ).toEqual({ accepted: true, changed: true, sheetIndex: 1 })

    expect(
      resolveXlsxSheetChange({
        activeSheet: 1,
        requestedSheet: 1,
        sheetCount: 2,
      })
    ).toEqual({ accepted: true, changed: false, sheetIndex: 1 })

    expect(
      resolveXlsxSheetChange({
        activeSheet: 0,
        requestedSheet: 4,
        sheetCount: 2,
      })
    ).toEqual({ accepted: false, changed: false, sheetIndex: 0 })
  })

  it("estimates compact-sheet byte size monotonically", () => {
    const small = createCompactSheet({
      name: "Small",
      rowCount: 1,
      columnCount: 1,
      entries: [{ cellIndex: 0, text: "x" }],
    })
    const large = createCompactSheet({
      name: "Large",
      rowCount: 1,
      columnCount: 2,
      entries: [
        { cellIndex: 0, text: "x" },
        { cellIndex: 1, text: "longer", numeric: true },
      ],
    })

    expect(compactSheetByteSize(large)).toBeGreaterThan(
      compactSheetByteSize(small)
    )
  })
})

describe("xlsx source adapter", () => {
  it("converts spreadsheet columns and anchors to zero-based cells", () => {
    expect(spreadsheetColumnToIndex("A")).toBe(0)
    expect(spreadsheetColumnToIndex("AA")).toBe(26)

    expect(
      spreadsheetAnchorToCell({
        kind: "spreadsheet_cell",
        sheet_index: 2,
        row: 7,
        column: "C",
      })
    ).toEqual({ sheet: 2, row: 6, col: 2 })

    expect(
      sourceToXlsxCell({
        content: "value",
        anchor: {
          kind: "spreadsheet_cell",
          sheet_index: 0,
          row: 1,
          column: "B",
        },
      })
    ).toEqual({ sheet: 0, row: 0, col: 1 })
  })
})

describe("XlsxSourceCache", () => {
  it("does not pin rejected loads", async () => {
    const cache = new XlsxSourceCache({ maxEntries: 2 })
    const load = vi
      .fn<() => Promise<XlsxSource>>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(source("Retry"))

    await expect(cache.get("/retry.xlsx", load)).rejects.toThrow("temporary")
    await expect(cache.get("/retry.xlsx", load)).resolves.toMatchObject({
      sheets: [{ name: "Retry" }],
    })
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("evicts old resolved entries and disposes them", () => {
    const cache = new XlsxSourceCache({ maxEntries: 1 })
    const disposeA = vi.fn()
    const disposeB = vi.fn()

    cache.setResolvedForTest("/a.xlsx", { ...source("A"), dispose: disposeA })
    cache.setResolvedForTest("/b.xlsx", { ...source("B"), dispose: disposeB })

    expect(cache.has("/a.xlsx")).toBe(false)
    expect(cache.has("/b.xlsx")).toBe(true)
    expect(disposeA).toHaveBeenCalledTimes(1)
    expect(disposeB).not.toHaveBeenCalled()
  })

  it("prefers resolved entries over pending entries for byte-pressure eviction", () => {
    const cache = new XlsxSourceCache({ maxEntries: 3, maxBytes: 1 })
    const pending = deferred<XlsxSource>()
    const disposeA = vi.fn()

    void cache.get("/pending.xlsx", () => pending.promise)
    cache.setResolvedForTest(
      "/a.xlsx",
      { ...source("A"), dispose: disposeA },
      8
    )

    expect(cache.has("/pending.xlsx")).toBe(true)
    expect(cache.has("/a.xlsx")).toBe(false)
    expect(disposeA).toHaveBeenCalledTimes(1)
  })

  it("evicts pending entries for entry-count pressure and disposes if they later resolve", async () => {
    const cache = new XlsxSourceCache({ maxEntries: 1 })
    const pending = deferred<XlsxSource>()
    const disposePending = vi.fn()

    const promise = cache.get("/pending.xlsx", () => pending.promise)
    cache.setResolvedForTest("/b.xlsx", source("B"))

    expect(cache.has("/pending.xlsx")).toBe(false)
    expect(cache.has("/b.xlsx")).toBe(true)

    pending.resolve({ ...source("Pending"), dispose: disposePending })
    await expect(promise).resolves.toMatchObject({
      sheets: [{ name: "Pending" }],
    })

    expect(cache.has("/pending.xlsx")).toBe(false)
    expect(disposePending).toHaveBeenCalledTimes(1)
  })

  it("clear disposes resolved entries", () => {
    const cache = new XlsxSourceCache({ maxEntries: 2 })
    const disposeA = vi.fn()
    const disposeB = vi.fn()

    cache.setResolvedForTest("/a.xlsx", { ...source("A"), dispose: disposeA })
    cache.setResolvedForTest("/b.xlsx", { ...source("B"), dispose: disposeB })
    cache.clear()

    expect(cache.size()).toBe(0)
    expect(disposeA).toHaveBeenCalledTimes(1)
    expect(disposeB).toHaveBeenCalledTimes(1)
  })
})

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}
