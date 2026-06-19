import { describe, expect, it, vi } from "vitest";

import {
  buildXlsxSourceFromCompact,
  compactSheetByteSize,
  createCompactSheet,
  estimateXlsxSourceBytes,
  getCompactSheetCell,
  resolveXlsxSheetChange,
  xlsxColumnLabel,
  XlsxSourceCache,
  type XlsxSource,
} from "@/registry/new-york-v4/lib/xlsx-workbook";
import {
  sourceToXlsxCell,
  spreadsheetColumnToIndex,
  xlsxAnchorToTarget,
} from "@/registry/new-york-v4/ui/xlsx-source";

function source(name = "Sheet1"): XlsxSource {
  return buildXlsxSourceFromCompact([
    createCompactSheet({
      name,
      rowCount: 1,
      columnCount: 1,
      entries: [{ cellIndex: 0, text: "ok" }],
    }),
  ]);
}

describe("xlsx workbook helpers", () => {
  it("creates spreadsheet column labels", () => {
    expect(xlsxColumnLabel(0)).toBe("A");
    expect(xlsxColumnLabel(25)).toBe("Z");
    expect(xlsxColumnLabel(26)).toBe("AA");
    expect(xlsxColumnLabel(701)).toBe("ZZ");
    expect(xlsxColumnLabel(-1)).toBe("");
    expect(xlsxColumnLabel(Number.MAX_SAFE_INTEGER + 1)).toBe("");
  });

  it("reads sparse compact sheet cells without dense allocation", () => {
    const sheet = createCompactSheet({
      name: "Sparse",
      rowCount: 100_000,
      columnCount: 100,
      entries: [
        { cellIndex: 0, text: "A1" },
        { cellIndex: 99_999 * 100 + 50, text: "far", numeric: true },
      ],
    });

    expect(sheet.cellIndexes.length).toBe(2);
    expect(getCompactSheetCell(sheet, 0, 0)).toEqual({
      text: "A1",
      numeric: false,
    });
    expect(getCompactSheetCell(sheet, 99_999, 50)).toEqual({
      text: "far",
      numeric: true,
    });
    expect(getCompactSheetCell(sheet, 50, 50)).toEqual({
      text: "",
      numeric: false,
    });
    expect(getCompactSheetCell(sheet, -1, 0)).toEqual({
      text: "",
      numeric: false,
    });
  });

  it("drops compact entries that cannot be represented in uint32 storage", () => {
    const sheet = createCompactSheet({
      name: "Overflow",
      rowCount: Number.POSITIVE_INFINITY,
      columnCount: 1,
      entries: [{ cellIndex: 0x1_0000_0000, text: "wrapped" }],
    });

    expect(sheet.cellIndexes.length).toBe(0);
    expect(getCompactSheetCell(sheet, 0, 0).text).toBe("");
  });

  it("deduplicates compact entries by cell index", () => {
    const sheet = createCompactSheet({
      name: "Duplicates",
      rowCount: 1,
      columnCount: 1,
      entries: [
        { cellIndex: 0, text: "first" },
        { cellIndex: 0, text: "last", numeric: true },
      ],
    });

    expect(sheet.cellIndexes.length).toBe(1);
    expect(getCompactSheetCell(sheet, 0, 0)).toEqual({
      text: "last",
      numeric: true,
    });
  });

  it("treats malformed compact text offsets as empty cells", () => {
    expect(
      getCompactSheetCell(
        {
          name: "Malformed",
          rowCount: 1,
          columnCount: 1,
          cellIndexes: new Uint32Array([0]),
          textOffsets: new Uint32Array([0]),
          numericFlags: new Uint8Array([0]),
          text: "leaked",
        },
        0,
        0,
      ),
    ).toEqual({ text: "", numeric: false });

    expect(
      getCompactSheetCell(
        {
          name: "Malformed",
          rowCount: 1,
          columnCount: 1,
          cellIndexes: new Uint32Array([0]),
          textOffsets: new Uint32Array([0, 99]),
          numericFlags: new Uint8Array([0]),
          text: "short",
        },
        0,
        0,
      ),
    ).toEqual({ text: "", numeric: false });
  });

  it("builds source metadata and clamps out-of-range reads to an empty cell", () => {
    const workbook = source("Data");

    expect(workbook.sheets).toEqual([
      {
        name: "Data",
        rowCount: 1,
        columnCount: 1,
        nonEmptyCellCount: 1,
      },
    ]);
    expect(workbook.getCell(0, 0, 0).text).toBe("ok");
    expect(workbook.getCell(0, 1, 0).text).toBe("");
    expect(workbook.getCell(5, 0, 0).text).toBe("");
  });

  it("accepts only valid sheet changes and reports whether they changed", () => {
    expect(
      resolveXlsxSheetChange({
        activeSheet: 0,
        requestedSheet: 1,
        sheetCount: 2,
      }),
    ).toEqual({ accepted: true, changed: true, sheetIndex: 1 });

    expect(
      resolveXlsxSheetChange({
        activeSheet: 1,
        requestedSheet: 1,
        sheetCount: 2,
      }),
    ).toEqual({ accepted: true, changed: false, sheetIndex: 1 });

    expect(
      resolveXlsxSheetChange({
        activeSheet: 0,
        requestedSheet: 4,
        sheetCount: 2,
      }),
    ).toEqual({ accepted: false, changed: false, sheetIndex: 0 });

    expect(
      resolveXlsxSheetChange({
        activeSheet: 0,
        requestedSheet: Number.MAX_SAFE_INTEGER + 1,
        sheetCount: Number.MAX_SAFE_INTEGER + 2,
      }),
    ).toEqual({ accepted: false, changed: false, sheetIndex: 0 });

    expect(
      resolveXlsxSheetChange({
        activeSheet: 0,
        requestedSheet: 1,
        sheetCount: Number.NaN,
      }),
    ).toEqual({ accepted: false, changed: false, sheetIndex: 0 });
  });

  it("estimates compact-sheet byte size monotonically", () => {
    const small = createCompactSheet({
      name: "Small",
      rowCount: 1,
      columnCount: 1,
      entries: [{ cellIndex: 0, text: "x" }],
    });
    const large = createCompactSheet({
      name: "Large",
      rowCount: 1,
      columnCount: 2,
      entries: [
        { cellIndex: 0, text: "x" },
        { cellIndex: 1, text: "longer", numeric: true },
      ],
    });

    expect(compactSheetByteSize(large)).toBeGreaterThan(
      compactSheetByteSize(small),
    );
  });

  it("ignores invalid source byte-size estimates", () => {
    const workbook = {
      ...source("Estimate"),
      estimatedByteSize: Number.NaN,
    };

    expect(estimateXlsxSourceBytes(workbook)).toBeGreaterThan(0);
    expect(
      estimateXlsxSourceBytes({ ...workbook, estimatedByteSize: -1 }),
    ).toBeGreaterThan(0);
  });
});

describe("xlsx source adapter", () => {
  it("converts spreadsheet columns and anchors to zero-based cells", () => {
    expect(spreadsheetColumnToIndex("A")).toBe(0);
    expect(spreadsheetColumnToIndex("AA")).toBe(26);
    expect(spreadsheetColumnToIndex("ZZZZZZZZZZZZ")).toBeNull();

    expect(
      xlsxAnchorToTarget({
        kind: "spreadsheet_cell",
        sheet_index: 2,
        row: 7,
        column: "C",
      }),
    ).toEqual({ sheet: 2, row: 6, col: 2 });

    expect(
      sourceToXlsxCell({
        content: "value",
        anchor: {
          kind: "spreadsheet_cell",
          sheet_index: 0,
          row: 1,
          column: "B",
        },
      }),
    ).toEqual({ sheet: 0, row: 0, col: 1 });
  });

  it("rejects spreadsheet anchors with unsafe integer coordinates", () => {
    expect(
      xlsxAnchorToTarget({
        kind: "spreadsheet_cell",
        sheet_index: Number.MAX_SAFE_INTEGER + 1,
        row: 1,
        column: "A",
      }),
    ).toBeUndefined();

    expect(
      xlsxAnchorToTarget({
        kind: "spreadsheet_cell",
        sheet_index: 0,
        row: Number.MAX_SAFE_INTEGER + 1,
        column: "A",
      }),
    ).toBeUndefined();
  });
});

describe("XlsxSourceCache", () => {
  it("coalesces concurrent loads for the same key", async () => {
    const cache = new XlsxSourceCache({ maxEntries: 2 });
    const pending = deferred<XlsxSource>();
    const load = vi.fn(() => pending.promise);

    const first = cache.get("/same.xlsx", load);
    const second = cache.get("/same.xlsx", load);

    expect(first).toBe(second);
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);

    pending.resolve(source("Same"));
    await expect(first).resolves.toMatchObject({
      sheets: [{ name: "Same" }],
    });
    await expect(second).resolves.toMatchObject({
      sheets: [{ name: "Same" }],
    });
  });

  it("refreshes resolved entries on cache hits before entry-count eviction", async () => {
    const cache = new XlsxSourceCache({ maxEntries: 2 });
    const disposeA = vi.fn();
    const disposeB = vi.fn();
    const disposeC = vi.fn();

    cache.setResolvedForTest("/a.xlsx", { ...source("A"), dispose: disposeA });
    cache.setResolvedForTest("/b.xlsx", { ...source("B"), dispose: disposeB });
    await cache.get("/a.xlsx", () => Promise.resolve(source("Reloaded A")));
    cache.setResolvedForTest("/c.xlsx", { ...source("C"), dispose: disposeC });

    expect(cache.has("/a.xlsx")).toBe(true);
    expect(cache.has("/b.xlsx")).toBe(false);
    expect(cache.has("/c.xlsx")).toBe(true);
    expect(disposeA).not.toHaveBeenCalled();
    expect(disposeB).toHaveBeenCalledTimes(1);
    expect(disposeC).not.toHaveBeenCalled();
  });

  it("does not pin rejected loads", async () => {
    const cache = new XlsxSourceCache({ maxEntries: 2 });
    const load = vi
      .fn<() => Promise<XlsxSource>>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(source("Retry"));

    await expect(cache.get("/retry.xlsx", load)).rejects.toThrow("temporary");
    await expect(cache.get("/retry.xlsx", load)).resolves.toMatchObject({
      sheets: [{ name: "Retry" }],
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("evicts old resolved entries and disposes them", () => {
    const cache = new XlsxSourceCache({ maxEntries: 1 });
    const disposeA = vi.fn();
    const disposeB = vi.fn();

    cache.setResolvedForTest("/a.xlsx", { ...source("A"), dispose: disposeA });
    cache.setResolvedForTest("/b.xlsx", { ...source("B"), dispose: disposeB });

    expect(cache.has("/a.xlsx")).toBe(false);
    expect(cache.has("/b.xlsx")).toBe(true);
    expect(disposeA).toHaveBeenCalledTimes(1);
    expect(disposeB).not.toHaveBeenCalled();
  });

  it("prefers resolved entries over pending entries for byte-pressure eviction", () => {
    const cache = new XlsxSourceCache({ maxEntries: 3, maxBytes: 1 });
    const pending = deferred<XlsxSource>();
    const disposeA = vi.fn();

    void cache.get("/pending.xlsx", () => pending.promise);
    cache.setResolvedForTest(
      "/a.xlsx",
      { ...source("A"), dispose: disposeA },
      8,
    );

    expect(cache.has("/pending.xlsx")).toBe(true);
    expect(cache.has("/a.xlsx")).toBe(false);
    expect(disposeA).toHaveBeenCalledTimes(1);
  });

  it("evicts pending entries for entry-count pressure and disposes if they later resolve", async () => {
    const cache = new XlsxSourceCache({ maxEntries: 1 });
    const pending = deferred<XlsxSource>();
    const disposePending = vi.fn();

    const promise = cache.get("/pending.xlsx", () => pending.promise);
    cache.setResolvedForTest("/b.xlsx", source("B"));

    expect(cache.has("/pending.xlsx")).toBe(false);
    expect(cache.has("/b.xlsx")).toBe(true);

    pending.resolve({ ...source("Pending"), dispose: disposePending });
    await expect(promise).resolves.toMatchObject({
      sheets: [{ name: "Pending" }],
    });

    expect(cache.has("/pending.xlsx")).toBe(false);
    expect(disposePending).toHaveBeenCalledTimes(1);
  });

  it("clear disposes resolved entries", () => {
    const cache = new XlsxSourceCache({ maxEntries: 2 });
    const disposeA = vi.fn();
    const disposeB = vi.fn();

    cache.setResolvedForTest("/a.xlsx", { ...source("A"), dispose: disposeA });
    cache.setResolvedForTest("/b.xlsx", { ...source("B"), dispose: disposeB });
    cache.clear();

    expect(cache.size()).toBe(0);
    expect(disposeA).toHaveBeenCalledTimes(1);
    expect(disposeB).toHaveBeenCalledTimes(1);
  });

  it("clear drops pending entries and disposes them if they later resolve", async () => {
    const cache = new XlsxSourceCache({ maxEntries: 2 });
    const pending = deferred<XlsxSource>();
    const disposePending = vi.fn();

    const promise = cache.get("/pending.xlsx", () => pending.promise);
    cache.clear();

    expect(cache.size()).toBe(0);

    pending.resolve({ ...source("Pending"), dispose: disposePending });
    await expect(promise).resolves.toMatchObject({
      sheets: [{ name: "Pending" }],
    });

    expect(cache.size()).toBe(0);
    expect(disposePending).toHaveBeenCalledTimes(1);
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}
