import { describe, expect, it, vi } from "vitest";

import {
  buildXlsxSourceFromCompact,
  createCompactSheet,
  type XlsxSource,
} from "@/registry/new-york-v4/lib/xlsx-workbook";
import {
  createXlsxSheetCsvExportAction,
  xlsxSheetCsvFileName,
} from "@/registry/new-york-v4/ui/xlsx-viewer-download";

function source() {
  return buildXlsxSourceFromCompact([
    createCompactSheet({
      name: "Summary",
      rowCount: 1,
      columnCount: 1,
      entries: [{ cellIndex: 0, text: "ignored" }],
    }),
    createCompactSheet({
      name: "Detail",
      rowCount: 3,
      columnCount: 3,
      entries: [
        { cellIndex: 0, text: "plain" },
        { cellIndex: 1, text: "needs,quote" },
        { cellIndex: 2, text: 'she said "hi"' },
        { cellIndex: 3, text: "line 1\nline 2" },
        { cellIndex: 8, text: "42", numeric: true },
      ],
    }),
  ]);
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe("xlsx CSV export action", () => {
  it("serializes active-sheet cells with headers and CSV escaping", async () => {
    const getSource = vi.fn(async () => source());
    const action = createXlsxSheetCsvExportAction({
      fileName: "book.Detail.csv",
      sheetIndex: 1,
      getSource,
    });

    await expect(action.getPayload()).resolves.toEqual({
      kind: "text",
      mimeType: "text/csv;charset=utf-8",
      text:
        'A,B,C\r\nplain,"needs,quote","she said ""hi"""\r\n' +
        '"line 1\nline 2",,\r\n,,42',
    });
    expect(getSource).toHaveBeenCalledTimes(1);
  });

  it("returns an empty CSV for an invalid sheet index", async () => {
    const action = createXlsxSheetCsvExportAction({
      fileName: "missing.csv",
      sheetIndex: 99,
      getSource: async () => source(),
    });

    await expect(action.getPayload()).resolves.toMatchObject({
      kind: "text",
      text: "",
    });
  });

  it("returns an empty CSV for sheets with invalid dimensions", async () => {
    const malformedSource: XlsxSource = {
      sheets: [
        {
          name: "Bad",
          rowCount: Number.POSITIVE_INFINITY,
          columnCount: 1,
          nonEmptyCellCount: 0,
        },
      ],
      getCell: () => ({ text: "unreachable", numeric: false }),
    };
    const action = createXlsxSheetCsvExportAction({
      fileName: "bad.csv",
      sheetIndex: 0,
      getSource: async () => malformedSource,
    });

    await expect(action.getPayload()).resolves.toMatchObject({
      kind: "text",
      text: "",
    });
  });

  it("returns an empty CSV for sheets too large to export densely", async () => {
    const hugeSource: XlsxSource = {
      sheets: [
        {
          name: "Huge",
          rowCount: 1_000_001,
          columnCount: 1,
          nonEmptyCellCount: 1,
        },
      ],
      getCell: () => ({ text: "unreachable", numeric: false }),
    };
    const action = createXlsxSheetCsvExportAction({
      fileName: "huge.csv",
      sheetIndex: 0,
      getSource: async () => hugeSource,
    });

    await expect(action.getPayload()).resolves.toMatchObject({
      kind: "text",
      text: "",
    });
  });

  it("does not load the workbook when cancelled before payload creation", async () => {
    const abortController = new AbortController();
    abortController.abort();
    const getSource = vi.fn(async () => source());
    const action = createXlsxSheetCsvExportAction({
      fileName: "book.csv",
      sheetIndex: 0,
      getSource,
    });

    await expect(
      action.getPayload({ signal: abortController.signal }),
    ).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(getSource).not.toHaveBeenCalled();
  });

  it("checks cancellation again after the workbook load resolves", async () => {
    const loadedSource = deferred<ReturnType<typeof source>>();
    const abortController = new AbortController();
    const action = createXlsxSheetCsvExportAction({
      fileName: "book.csv",
      sheetIndex: 0,
      getSource: () => loadedSource.promise,
    });

    const payload = action.getPayload({ signal: abortController.signal });
    abortController.abort();
    loadedSource.resolve(source());

    await expect(payload).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("checks cancellation while serializing cells in a row", async () => {
    const abortController = new AbortController();
    const getCell = vi.fn(
      (_sheetIndex: number, _row: number, column: number) => {
        if (column === 0) abortController.abort();
        return { text: `cell ${column}`, numeric: false };
      },
    );
    const action = createXlsxSheetCsvExportAction({
      fileName: "book.csv",
      sheetIndex: 0,
      getSource: async () => ({
        sheets: [
          {
            name: "Wide",
            rowCount: 1,
            columnCount: 3,
            nonEmptyCellCount: 3,
          },
        ],
        getCell,
      }),
    });

    await expect(
      action.getPayload({ signal: abortController.signal }),
    ).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(getCell).toHaveBeenCalledTimes(1);
  });
});

describe("xlsx CSV export file names", () => {
  it("uses the workbook base name for single-sheet exports", () => {
    expect(
      xlsxSheetCsvFileName({
        fileName: "book.xlsx",
        sheetName: "Only",
        sheetCount: 1,
      }),
    ).toBe("book.csv");
  });

  it("includes a sanitized sheet name for multi-sheet exports", () => {
    expect(
      xlsxSheetCsvFileName({
        fileName: "quarterly.report.xlsx",
        sheetName: 'FY/2024: Q1 "Actuals"',
        sheetCount: 2,
      }),
    ).toBe("quarterly.report.FY-2024- Q1 -Actuals-.csv");
  });

  it("falls back when a sheet name has no filename-safe characters", () => {
    expect(
      xlsxSheetCsvFileName({
        fileName: "book.xlsx",
        sheetName: '  /\\?%*:|"<>  ',
        sheetCount: 2,
      }),
    ).toBe("book.sheet.csv");
  });

  it("sanitizes the workbook base name for derived CSV exports", () => {
    expect(
      xlsxSheetCsvFileName({
        fileName: 'reports/fy:2024 "actuals".xlsx',
        sheetName: "Summary",
        sheetCount: 2,
      }),
    ).toBe("reports-fy-2024 -actuals-.Summary.csv");
  });

  it("sanitizes control characters in derived CSV export names", () => {
    expect(
      xlsxSheetCsvFileName({
        fileName: "book\nname.xlsx",
        sheetName: "Jan\tActuals",
        sheetCount: 2,
      }),
    ).toBe("book-name.Jan-Actuals.csv");
  });
});
