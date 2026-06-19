import * as XLSX from "@e965/xlsx";
import { describe, expect, it } from "vitest";

import {
  compactWorkbookTransferBuffers,
  flattenSheetJsWorkbook,
  flattenSheetJsWorksheet,
} from "@/registry/new-york-v4/lib/xlsx-sheetjs-flattener";
import { getCompactSheetCell } from "@/registry/new-york-v4/lib/xlsx-workbook";
import { XlsxWorkerError } from "@/registry/new-york-v4/lib/xlsx-worker-protocol";

describe("SheetJS XLSX flattener", () => {
  it("flattens an empty sheet", () => {
    const sheet = flattenSheetJsWorksheet("Empty", {});

    expect(sheet).toMatchObject({
      name: "Empty",
      rowCount: 0,
      columnCount: 0,
      text: "",
    });
    expect(sheet.cellIndexes.length).toBe(0);
  });

  it("flattens multiple sheets with formatted values", () => {
    const workbook = XLSX.utils.book_new();
    const summary = XLSX.utils.aoa_to_sheet([["Amount"], [1234.5]]);
    summary.A2.w = "$1,234.50";
    const detail = XLSX.utils.aoa_to_sheet([["When"]]);
    detail.A2 = {
      t: "d",
      v: new Date("2024-01-02T00:00:00.000Z"),
      w: "Jan 2, 2024",
    };
    detail["!ref"] = "A1:A2";

    XLSX.utils.book_append_sheet(workbook, summary, "Summary");
    XLSX.utils.book_append_sheet(workbook, detail, "Detail");

    const sheets = flattenSheetJsWorkbook(workbook);

    expect(sheets.map((sheet) => sheet.name)).toEqual(["Summary", "Detail"]);
    expect(getCompactSheetCell(sheets[0], 1, 0)).toEqual({
      text: "$1,234.50",
      numeric: true,
    });
    expect(getCompactSheetCell(sheets[1], 1, 0)).toEqual({
      text: "Jan 2, 2024",
      numeric: true,
    });
  });

  it("stores sparse far-away cells without dense allocation", () => {
    const worksheet = {
      "!ref": "A1:CV100000",
      A1: { t: "s", v: "start" },
      CV100000: { t: "s", v: "far" },
    };

    const sheet = flattenSheetJsWorksheet("Sparse", worksheet);

    expect(sheet.rowCount).toBe(100_000);
    expect(sheet.columnCount).toBe(100);
    expect(sheet.cellIndexes.length).toBe(2);
    expect(getCompactSheetCell(sheet, 99_999, 99).text).toBe("far");
  });

  it("ignores non-cell worksheet properties and cells outside the declared range", () => {
    const worksheet = {
      "!ref": "B2:C3",
      "!merges": [],
      A1: { t: "s", v: "outside" },
      B2: { t: "s", v: "inside" },
      D4: { t: "s", v: "outside" },
      _xlnm_Print_Area: { t: "s", v: "metadata" },
      SheetName: { t: "s", v: "metadata" },
    } as unknown as Parameters<typeof flattenSheetJsWorksheet>[1];

    const sheet = flattenSheetJsWorksheet("Offset", worksheet);

    expect(sheet.rowCount).toBe(3);
    expect(sheet.columnCount).toBe(3);
    expect(sheet.cellIndexes.length).toBe(1);
    expect(getCompactSheetCell(sheet, 1, 1).text).toBe("inside");
    expect(getCompactSheetCell(sheet, 0, 0).text).toBe("");
    expect(getCompactSheetCell(sheet, 3, 3).text).toBe("");
  });

  it("treats malformed decoded ranges as empty sheets", () => {
    const reversed = flattenSheetJsWorksheet("Reversed", {
      "!ref": "C3:B2",
      B2: { t: "s", v: "outside" },
    });
    const negativeStart = flattenSheetJsWorksheet("Negative", {
      "!ref": ":B2",
      A1: { t: "s", v: "outside" },
    });

    expect(reversed).toMatchObject({
      rowCount: 0,
      columnCount: 0,
      text: "",
    });
    expect(reversed.cellIndexes.length).toBe(0);
    expect(negativeStart).toMatchObject({
      rowCount: 0,
      columnCount: 0,
      text: "",
    });
    expect(negativeStart.cellIndexes.length).toBe(0);
  });

  it("uses raw values when formatted values are absent and skips blank formatted cells", () => {
    const worksheet = {
      "!ref": "A1:C1",
      A1: { t: "b", v: true },
      B1: { t: "n", v: 12 },
      C1: { t: "s", v: "fallback", w: "" },
    };

    const sheet = flattenSheetJsWorksheet("Formats", worksheet);

    expect(getCompactSheetCell(sheet, 0, 0)).toEqual({
      text: "true",
      numeric: false,
    });
    expect(getCompactSheetCell(sheet, 0, 1)).toEqual({
      text: "12",
      numeric: true,
    });
    expect(getCompactSheetCell(sheet, 0, 2)).toEqual({
      text: "",
      numeric: false,
    });
  });

  it("returns the compact typed-array buffers for worker transfer", () => {
    const sheet = flattenSheetJsWorksheet("Transfer", {
      "!ref": "A1:B1",
      A1: { t: "s", v: "a" },
      B1: { t: "n", v: 1 },
    });

    expect(compactWorkbookTransferBuffers([sheet])).toEqual([
      sheet.cellIndexes.buffer,
      sheet.textOffsets.buffer,
      sheet.numericFlags.buffer,
    ]);
  });

  it("throws typed errors for over-limit ranges, cells, and text", () => {
    expect(() =>
      flattenSheetJsWorksheet(
        "Range",
        { "!ref": "A1:B2", A1: { t: "s", v: "x" } },
        { maxRowMajorIndex: 1, maxNonEmptyCells: 10, maxTextChars: 10 },
      ),
    ).toThrowError(XlsxWorkerError);

    expect(() =>
      flattenSheetJsWorksheet(
        "Cells",
        {
          "!ref": "A1:A2",
          A1: { t: "s", v: "a" },
          A2: { t: "s", v: "b" },
        },
        { maxRowMajorIndex: 10, maxNonEmptyCells: 1, maxTextChars: 10 },
      ),
    ).toThrowError(/too many non-empty cells/i);

    expect(() =>
      flattenSheetJsWorksheet(
        "Text",
        { "!ref": "A1:A1", A1: { t: "s", v: "abc" } },
        { maxRowMajorIndex: 10, maxNonEmptyCells: 10, maxTextChars: 2 },
      ),
    ).toThrowError(/text is too large/i);
  });
});
