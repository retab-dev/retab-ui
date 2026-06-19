import * as XLSX from "@e965/xlsx";
import { describe, expect, it } from "vitest";

import {
  flattenSheetJsWorkbook,
  flattenSheetJsWorksheet,
} from "@/registry/new-york-v4/lib/xlsx-sheetjs-flattener";
import {
  buildXlsxSourceFromCompact,
  createCompactSheet,
  getCompactSheetCell,
  resolveXlsxSheetChange,
  xlsxColumnLabel,
  type XlsxSource,
} from "@/registry/new-york-v4/lib/xlsx-workbook";
import { XlsxWorkerError } from "@/registry/new-york-v4/lib/xlsx-worker-protocol";
import {
  createXlsxSheetCsvExportAction,
  xlsxSheetCsvFileName,
} from "@/registry/new-york-v4/ui/xlsx-viewer-download";
import { spreadsheetColumnToIndex } from "@/registry/new-york-v4/ui/xlsx-source";

// ---------------------------------------------------------------------------
// Column labels <-> indexes are a closed bijection over the spreadsheet range.
// ---------------------------------------------------------------------------

describe("xlsx column label <-> index bijection", () => {
  it("round-trips label -> index -> label across base-26 carry boundaries", () => {
    const samples = [
      0, 1, 25, 26, 27, 51, 52, 77, 701, 702, 703, 16383, 16384, 18277,
    ];
    for (const index of samples) {
      const label = xlsxColumnLabel(index);
      expect(spreadsheetColumnToIndex(label)).toBe(index);
    }
  });

  it("agrees with Excel's documented column boundaries", () => {
    // Excel's last column is XFD (1-based 16384 -> 0-based 16383).
    expect(xlsxColumnLabel(16383)).toBe("XFD");
    expect(spreadsheetColumnToIndex("XFD")).toBe(16383);
    expect(xlsxColumnLabel(26)).toBe("AA");
    expect(xlsxColumnLabel(701)).toBe("ZZ");
    expect(xlsxColumnLabel(702)).toBe("AAA");
  });

  it("round-trips index -> label -> index for the SheetJS decoder", () => {
    for (let index = 0; index < 800; index++) {
      expect(spreadsheetColumnToIndex(xlsxColumnLabel(index))).toBe(index);
    }
  });

  it("decodes lowercase and mixed-case column letters", () => {
    expect(spreadsheetColumnToIndex("aa")).toBe(26);
    expect(spreadsheetColumnToIndex("Ab")).toBe(27);
  });

  it("rejects non-letter and empty column tokens", () => {
    expect(spreadsheetColumnToIndex("")).toBeNull();
    expect(spreadsheetColumnToIndex("A1")).toBeNull();
    expect(spreadsheetColumnToIndex(" A")).toBeNull();
    expect(spreadsheetColumnToIndex("-")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createCompactSheet packs sparse cells, de-dupes by index, and tolerates junk.
// ---------------------------------------------------------------------------

describe("createCompactSheet packing", () => {
  it("sorts unordered entries so reads land on the right cell", () => {
    const sheet = createCompactSheet({
      name: "Unordered",
      rowCount: 2,
      columnCount: 2,
      entries: [
        { cellIndex: 3, text: "d" },
        { cellIndex: 0, text: "a" },
        { cellIndex: 2, text: "c" },
        { cellIndex: 1, text: "b" },
      ],
    });

    expect(getCompactSheetCell(sheet, 0, 0).text).toBe("a");
    expect(getCompactSheetCell(sheet, 0, 1).text).toBe("b");
    expect(getCompactSheetCell(sheet, 1, 0).text).toBe("c");
    expect(getCompactSheetCell(sheet, 1, 1).text).toBe("d");
  });

  it("keeps the last entry (text and numeric flag) when indexes collide", () => {
    const sheet = createCompactSheet({
      name: "Collide",
      rowCount: 1,
      columnCount: 2,
      entries: [
        { cellIndex: 0, text: "stale", numeric: false },
        { cellIndex: 0, text: "fresh", numeric: true },
        { cellIndex: 1, text: "tail" },
      ],
    });

    expect(sheet.cellIndexes.length).toBe(2);
    expect(getCompactSheetCell(sheet, 0, 0)).toEqual({
      text: "fresh",
      numeric: true,
    });
    expect(getCompactSheetCell(sheet, 0, 1).text).toBe("tail");
  });

  it("preserves surrogate-pair text across the offset-sliced store", () => {
    const sheet = createCompactSheet({
      name: "Unicode",
      rowCount: 1,
      columnCount: 3,
      entries: [
        { cellIndex: 0, text: "a😀b" },
        { cellIndex: 1, text: "🇫🇷" },
        { cellIndex: 2, text: "tail" },
      ],
    });

    expect(getCompactSheetCell(sheet, 0, 0).text).toBe("a😀b");
    expect(getCompactSheetCell(sheet, 0, 1).text).toBe("🇫🇷");
    expect(getCompactSheetCell(sheet, 0, 2).text).toBe("tail");
  });

  it("keeps whitespace-only text but drops empty strings", () => {
    const sheet = createCompactSheet({
      name: "Whitespace",
      rowCount: 1,
      columnCount: 2,
      entries: [
        { cellIndex: 0, text: "   " },
        { cellIndex: 1, text: "" },
      ],
    });

    expect(getCompactSheetCell(sheet, 0, 0).text).toBe("   ");
    expect(getCompactSheetCell(sheet, 0, 1).text).toBe("");
    expect(sheet.cellIndexes.length).toBe(1);
  });

  it("drops negative, fractional, and out-of-capacity indexes", () => {
    const sheet = createCompactSheet({
      name: "Junk",
      rowCount: 2,
      columnCount: 2,
      entries: [
        { cellIndex: -1, text: "neg" },
        { cellIndex: 1.5, text: "frac" },
        { cellIndex: 4, text: "at-capacity" },
        { cellIndex: 3, text: "last-valid" },
      ],
    });

    expect(sheet.cellIndexes.length).toBe(1);
    expect(getCompactSheetCell(sheet, 1, 1).text).toBe("last-valid");
  });
});

// ---------------------------------------------------------------------------
// getCompactSheetCell clamps every out-of-bounds and malformed coordinate.
// ---------------------------------------------------------------------------

describe("getCompactSheetCell bounds", () => {
  const sheet = createCompactSheet({
    name: "Bounds",
    rowCount: 3,
    columnCount: 4,
    entries: [
      { cellIndex: 0, text: "tl" },
      { cellIndex: 3, text: "tr" },
      { cellIndex: 11, text: "br" },
    ],
  });

  it("returns an empty cell exactly at the column count boundary", () => {
    expect(getCompactSheetCell(sheet, 0, 4).text).toBe("");
    expect(getCompactSheetCell(sheet, 3, 0).text).toBe("");
  });

  it("reads the last in-range corner cell", () => {
    expect(getCompactSheetCell(sheet, 2, 3).text).toBe("br");
  });

  it("rejects fractional coordinates without aliasing onto a real cell", () => {
    expect(getCompactSheetCell(sheet, 0.5, 0).text).toBe("");
    expect(getCompactSheetCell(sheet, 0, 0.5).text).toBe("");
  });

  it("returns empty for an undefined sheet", () => {
    expect(getCompactSheetCell(undefined, 0, 0)).toEqual({
      text: "",
      numeric: false,
    });
  });
});

// ---------------------------------------------------------------------------
// The SheetJS flattener: value coercion, range offsets, and protective limits.
// ---------------------------------------------------------------------------

describe("flattener value coercion", () => {
  it("renders a numeric zero rather than dropping it as blank", () => {
    const sheet = flattenSheetJsWorksheet("Zero", {
      "!ref": "A1:A1",
      A1: { t: "n", v: 0 },
    });
    expect(getCompactSheetCell(sheet, 0, 0)).toEqual({
      text: "0",
      numeric: true,
    });
  });

  it("renders boolean and error cells as left-aligned text", () => {
    const sheet = flattenSheetJsWorksheet("Mixed", {
      "!ref": "A1:C1",
      A1: { t: "b", v: false },
      B1: { t: "b", v: true },
      C1: { t: "e", v: 7, w: "#DIV/0!" },
    });
    expect(getCompactSheetCell(sheet, 0, 0)).toEqual({
      text: "false",
      numeric: false,
    });
    expect(getCompactSheetCell(sheet, 0, 1).text).toBe("true");
    expect(getCompactSheetCell(sheet, 0, 2)).toEqual({
      text: "#DIV/0!",
      numeric: false,
    });
  });

  it("prefers the formatted string over the raw value", () => {
    const sheet = flattenSheetJsWorksheet("Formatted", {
      "!ref": "A1:A1",
      A1: { t: "n", v: 1234.5, w: "$1,234.50" },
    });
    expect(getCompactSheetCell(sheet, 0, 0)).toEqual({
      text: "$1,234.50",
      numeric: true,
    });
  });

  it("keeps absolute coordinates for ranges that do not start at A1", () => {
    const sheet = flattenSheetJsWorksheet("Offset", {
      "!ref": "C3:D4",
      C3: { t: "s", v: "first" },
      D4: { t: "n", v: 9 },
    });
    expect(sheet.rowCount).toBe(4);
    expect(sheet.columnCount).toBe(4);
    expect(getCompactSheetCell(sheet, 2, 2).text).toBe("first");
    expect(getCompactSheetCell(sheet, 3, 3)).toEqual({
      text: "9",
      numeric: true,
    });
    expect(getCompactSheetCell(sheet, 0, 0).text).toBe("");
  });

  it("treats a whitespace-only !ref as an empty sheet", () => {
    const sheet = flattenSheetJsWorksheet("Blank", {
      "!ref": "   ",
      A1: { t: "s", v: "ignored" },
    });
    expect(sheet.rowCount).toBe(0);
    expect(sheet.columnCount).toBe(0);
    expect(sheet.cellIndexes.length).toBe(0);
  });

  it("allows text exactly at the character limit but rejects one over", () => {
    const atLimit = flattenSheetJsWorksheet(
      "AtLimit",
      { "!ref": "A1:A1", A1: { t: "s", v: "abc" } },
      { maxRowMajorIndex: 10, maxNonEmptyCells: 10, maxTextChars: 3 },
    );
    expect(getCompactSheetCell(atLimit, 0, 0).text).toBe("abc");

    expect(() =>
      flattenSheetJsWorksheet(
        "OverLimit",
        { "!ref": "A1:A1", A1: { t: "s", v: "abcd" } },
        { maxRowMajorIndex: 10, maxNonEmptyCells: 10, maxTextChars: 3 },
      ),
    ).toThrowError(XlsxWorkerError);
  });

  it("surfaces a typed range_too_large error code", () => {
    let captured: unknown;
    try {
      flattenSheetJsWorksheet(
        "TooBig",
        { "!ref": "A1:B2", A1: { t: "s", v: "x" } },
        { maxRowMajorIndex: 1, maxNonEmptyCells: 10, maxTextChars: 10 },
      );
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(XlsxWorkerError);
    expect((captured as XlsxWorkerError).code).toBe("range_too_large");
  });

  it("flattens a single-cell !ref that has no range colon", () => {
    const sheet = flattenSheetJsWorksheet("Single", {
      "!ref": "A1",
      A1: { t: "s", v: "solo" },
    });
    expect(sheet.rowCount).toBe(1);
    expect(sheet.columnCount).toBe(1);
    expect(getCompactSheetCell(sheet, 0, 0).text).toBe("solo");
  });

  it("yields an empty sheet for a name listed but missing from Sheets", () => {
    const sheets = flattenSheetJsWorkbook({
      SheetNames: ["Ghost"],
      Sheets: {},
    });
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe("Ghost");
    expect(sheets[0].rowCount).toBe(0);
    expect(sheets[0].columnCount).toBe(0);
    expect(sheets[0].cellIndexes.length).toBe(0);
  });

  it("flattens a real multi-sheet workbook end to end", () => {
    const workbook = XLSX.utils.book_new();
    const grid = XLSX.utils.aoa_to_sheet([
      ["Name", "Qty"],
      ["Widget", 3],
      ["Gadget", 12],
    ]);
    XLSX.utils.book_append_sheet(workbook, grid, "Items");
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["solo"]]),
      "Notes",
    );

    const sheets = flattenSheetJsWorkbook(workbook);
    expect(sheets.map((sheet) => sheet.name)).toEqual(["Items", "Notes"]);
    expect(getCompactSheetCell(sheets[0], 0, 0).text).toBe("Name");
    expect(getCompactSheetCell(sheets[0], 2, 1)).toEqual({
      text: "12",
      numeric: true,
    });
    expect(getCompactSheetCell(sheets[1], 0, 0).text).toBe("solo");
  });
});

// ---------------------------------------------------------------------------
// CSV export serialization across sparse, offset, and quoted layouts.
// ---------------------------------------------------------------------------

function sourceFromSheet(
  input: Parameters<typeof createCompactSheet>[0],
): XlsxSource {
  return buildXlsxSourceFromCompact([createCompactSheet(input)]);
}

describe("xlsx CSV export serialization", () => {
  it("emits letter headers then a dense grid over sparse cells", async () => {
    const action = createXlsxSheetCsvExportAction({
      fileName: "out.csv",
      sheetIndex: 0,
      getSource: async () =>
        sourceFromSheet({
          name: "Sparse",
          rowCount: 2,
          columnCount: 3,
          entries: [
            { cellIndex: 0, text: "a" },
            { cellIndex: 2, text: "c,d" },
            { cellIndex: 4, text: "5", numeric: true },
          ],
        }),
    });

    const payload = await action.getPayload();
    expect(payload).toEqual({
      kind: "text",
      mimeType: "text/csv;charset=utf-8",
      text: 'A,B,C\r\na,,"c,d"\r\n,5,',
    });
  });

  it("exports cells from a range that does not start at A1", async () => {
    const action = createXlsxSheetCsvExportAction({
      fileName: "offset.csv",
      sheetIndex: 0,
      getSource: async () =>
        sourceFromSheet({
          name: "Offset",
          rowCount: 2,
          columnCount: 2,
          entries: [{ cellIndex: 3, text: "corner" }],
        }),
    });

    const payload = await action.getPayload();
    expect(payload.kind).toBe("text");
    expect((payload as { text: string }).text).toBe("A,B\r\n,\r\n,corner");
  });

  it("quotes fields containing quotes, commas, and newlines", async () => {
    const action = createXlsxSheetCsvExportAction({
      fileName: "quoting.csv",
      sheetIndex: 0,
      getSource: async () =>
        sourceFromSheet({
          name: "Quoting",
          rowCount: 1,
          columnCount: 3,
          entries: [
            { cellIndex: 0, text: 'say "hi"' },
            { cellIndex: 1, text: "a,b" },
            { cellIndex: 2, text: "line1\nline2" },
          ],
        }),
    });

    const payload = (await action.getPayload()) as { text: string };
    expect(payload.text).toBe('A,B,C\r\n"say ""hi""","a,b","line1\nline2"');
  });
});

describe("xlsx CSV export file names", () => {
  it("keeps the multi-sheet name and strips a leading-dot extension", () => {
    expect(
      xlsxSheetCsvFileName({
        fileName: "report.final.xlsx",
        sheetName: "Q1",
        sheetCount: 3,
      }),
    ).toBe("report.final.Q1.csv");
  });

  it("omits the sheet name for a single-sheet workbook", () => {
    expect(
      xlsxSheetCsvFileName({
        fileName: "book.xlsx",
        sheetName: "Only",
        sheetCount: 1,
      }),
    ).toBe("book.csv");
  });

  it("falls back when the workbook name has no safe characters", () => {
    expect(
      xlsxSheetCsvFileName({
        fileName: '/\\?%*:|"<>.xlsx',
        sheetName: "Sheet",
        sheetCount: 2,
      }),
    ).toBe("spreadsheet.Sheet.csv");
  });
});

// ---------------------------------------------------------------------------
// Sheet-change resolution guards against degenerate workbook shapes.
// ---------------------------------------------------------------------------

describe("resolveXlsxSheetChange guards", () => {
  it("rejects any request against a zero-sheet workbook", () => {
    expect(
      resolveXlsxSheetChange({
        activeSheet: 0,
        requestedSheet: 0,
        sheetCount: 0,
      }),
    ).toEqual({ accepted: false, changed: false, sheetIndex: 0 });
  });

  it("rejects negative sheet counts", () => {
    expect(
      resolveXlsxSheetChange({
        activeSheet: 0,
        requestedSheet: 0,
        sheetCount: -1,
      }),
    ).toEqual({ accepted: false, changed: false, sheetIndex: 0 });
  });

  it("accepts requests when the sheet count is unknown", () => {
    expect(
      resolveXlsxSheetChange({
        activeSheet: 0,
        requestedSheet: 5,
        sheetCount: null,
      }),
    ).toEqual({ accepted: true, changed: true, sheetIndex: 5 });
  });

  it("treats the last valid index as in-range", () => {
    expect(
      resolveXlsxSheetChange({
        activeSheet: 0,
        requestedSheet: 2,
        sheetCount: 3,
      }),
    ).toEqual({ accepted: true, changed: true, sheetIndex: 2 });
  });
});
