import * as XLSX from "@e965/xlsx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCompactSheetCell,
  type CompactSheet,
} from "@/registry/new-york-v4/lib/xlsx-workbook";
import {
  isSpreadsheetContainer,
  type XlsxWorkerResponse,
} from "@/registry/new-york-v4/lib/xlsx-worker-protocol";

// ---------------------------------------------------------------------------
// The Web Worker is the one production parse path that every other xlsx test
// mocks away (FakeXlsxWorker). These tests drive the *real* onmessage handler
// with real .xlsx bytes so the SheetJS read -> flatten -> transfer round-trip
// is actually exercised.
// ---------------------------------------------------------------------------

interface WorkerCtx {
  onmessage: ((event: MessageEvent) => void) | null;
  posts: Array<{ response: XlsxWorkerResponse; transfer?: unknown[] }>;
  postMessage: (response: unknown, transfer?: unknown[]) => void;
}

/** Stub `self`, (re)import the worker module, and capture its postMessage calls. */
async function loadWorker(): Promise<WorkerCtx> {
  const ctx: WorkerCtx = {
    onmessage: null,
    posts: [],
    postMessage(response, transfer) {
      this.posts.push({ response: response as XlsxWorkerResponse, transfer });
    },
  };
  vi.stubGlobal("self", ctx);
  vi.resetModules();
  await import("@/registry/new-york-v4/ui/xlsx-viewer.worker");
  return ctx;
}

/** Build a real .xlsx ArrayBuffer the way the browser would hand it to the worker. */
function xlsxBuffer(
  sheets: Array<{ name: string; rows: unknown[][] }>,
): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
  // Copy into a standalone ArrayBuffer (a transferable, as the main thread sends).
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function parse(buffer: ArrayBuffer): Promise<WorkerCtx> {
  const ctx = await loadWorker();
  expect(ctx.onmessage).not.toBeNull();
  ctx.onmessage?.({
    data: { type: "parse_workbook", buffer },
  } as MessageEvent);
  return ctx;
}

function expectWorkbook(ctx: WorkerCtx): CompactSheet[] {
  expect(ctx.posts).toHaveLength(1);
  const { response } = ctx.posts[0];
  if (response.type !== "workbook") {
    throw new Error(`expected a workbook response, got ${response.type}`);
  }
  return response.sheets;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("xlsx worker parse round-trip", () => {
  beforeEach(() => {
    // The worker registers `self.onmessage` once on import; ensure a clean slate.
    vi.resetModules();
  });

  it("parses a real single-sheet workbook into compact cells", async () => {
    const ctx = await parse(
      xlsxBuffer([
        {
          name: "Items",
          rows: [
            ["Name", "Qty"],
            ["Widget", 3],
            ["Gadget", 12],
          ],
        },
      ]),
    );

    const sheets = expectWorkbook(ctx);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe("Items");
    expect(getCompactSheetCell(sheets[0], 0, 0).text).toBe("Name");
    expect(getCompactSheetCell(sheets[0], 1, 0).text).toBe("Widget");
    expect(getCompactSheetCell(sheets[0], 2, 1)).toEqual({
      text: "12",
      numeric: true,
    });
    // A blank gap in the grid stays empty.
    expect(getCompactSheetCell(sheets[0], 0, 1).text).toBe("Qty");
  });

  it("preserves sheet order and per-sheet dimensions across a multi-sheet workbook", async () => {
    const ctx = await parse(
      xlsxBuffer([
        { name: "First", rows: [["a", "b", "c"]] },
        { name: "Second", rows: [["only"]] },
        { name: "Third", rows: [["x"], ["y"], ["z"]] },
      ]),
    );

    const sheets = expectWorkbook(ctx);
    expect(sheets.map((sheet) => sheet.name)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
    expect(sheets[0].columnCount).toBe(3);
    expect(sheets[2].rowCount).toBe(3);
    expect(getCompactSheetCell(sheets[2], 2, 0).text).toBe("z");
  });

  it("transfers three typed-array buffers per sheet back to the main thread", async () => {
    const ctx = await parse(
      xlsxBuffer([
        { name: "A", rows: [["1"]] },
        { name: "B", rows: [["2"]] },
      ]),
    );

    const sheets = expectWorkbook(ctx);
    const { transfer } = ctx.posts[0];
    expect(transfer).toHaveLength(sheets.length * 3);
    // Each transferred buffer must be the backing store of a real compact array.
    for (const sheet of sheets) {
      expect(transfer).toContain(sheet.cellIndexes.buffer);
      expect(transfer).toContain(sheet.textOffsets.buffer);
      expect(transfer).toContain(sheet.numericFlags.buffer);
    }
  });

  it("formats date cells through their display string, flagged numeric", async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([["When"]]);
    worksheet.A2 = {
      t: "d",
      v: new Date("2024-01-02T00:00:00.000Z"),
      w: "1/2/24",
    };
    worksheet["!ref"] = "A1:A2";
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dates");
    const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;

    const ctx = await parse(buffer);
    const sheets = expectWorkbook(ctx);
    const cell = getCompactSheetCell(sheets[0], 1, 0);
    expect(cell.numeric).toBe(true);
    expect(cell.text.length).toBeGreaterThan(0);
  });

  it("reports a parse_failed error for a corrupt ZIP container", async () => {
    // A truncated ZIP (the .xlsx container format) is one of the few inputs
    // SheetJS actually rejects rather than format-sniffing into a stub sheet.
    const corruptZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    const ctx = await parse(corruptZip.buffer as ArrayBuffer);

    expect(ctx.posts).toHaveLength(1);
    const { response, transfer } = ctx.posts[0];
    expect(response.type).toBe("error");
    if (response.type === "error") {
      expect(response.code).toBe("parse_failed");
      expect(typeof response.message).toBe("string");
    }
    // Errors must not claim to transfer buffers.
    expect(transfer).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // The container guard stops SheetJS's lenient sniffer from coercing arbitrary
  // bytes (a mislabeled PDF, image, or text file) into a degenerate stub sheet.
  // Without it these inputs "succeed" with a meaningless 1-cell grid.
  // ---------------------------------------------------------------------------
  it.each([
    [
      "plain text",
      new TextEncoder().encode("this is plainly not a spreadsheet"),
    ],
    ["a PDF header", new TextEncoder().encode("%PDF-1.7\n...")],
    ["PNG magic bytes", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])],
    ["an empty buffer", new Uint8Array([])],
    ["high bytes", new Uint8Array([0xff, 0xfe, 0xfd, 0xfc])],
  ])("rejects %s as a non-spreadsheet parse_failed", async (_label, bytes) => {
    const ctx = await parse(bytes.buffer as ArrayBuffer);

    expect(ctx.posts).toHaveLength(1);
    const { response, transfer } = ctx.posts[0];
    expect(response.type).toBe("error");
    if (response.type === "error") {
      expect(response.code).toBe("parse_failed");
    }
    expect(transfer).toBeUndefined();
  });

  it("rejects an unsupported request type without throwing out of the handler", async () => {
    const ctx = await loadWorker();
    ctx.onmessage?.({
      data: { type: "not_a_real_request" },
    } as MessageEvent);

    expect(ctx.posts).toHaveLength(1);
    const { response } = ctx.posts[0];
    expect(response.type).toBe("error");
    if (response.type === "error") {
      expect(response.code).toBe("parse_failed");
    }
  }, 15_000);

  it("survives a malformed message whose data has no type", async () => {
    const ctx = await loadWorker();
    // Accessing `.type` on a null payload would throw if unguarded.
    ctx.onmessage?.({ data: null } as MessageEvent);

    expect(ctx.posts).toHaveLength(1);
    expect(ctx.posts[0].response.type).toBe("error");
  }, 15_000);

  // ---------------------------------------------------------------------------
  // Value coercion, end to end through the real SheetJS serializer + parser.
  // Every other test builds CompactSheets by hand or mocks the flattener with
  // String(v); these go through XLSX.write -> XLSX.read so they pin what the
  // product actually displays — which differs from the hand-mocked expectations.
  // ---------------------------------------------------------------------------
  async function parseSingleCell(
    cell: Record<string, unknown>,
  ): Promise<{ text: string; numeric: boolean }> {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([["seed"]]);
    worksheet.A1 = cell;
    worksheet["!ref"] = "A1";
    XLSX.utils.book_append_sheet(workbook, worksheet, "S");
    const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const ctx = await parse(buffer);
    return getCompactSheetCell(expectWorkbook(ctx)[0], 0, 0);
  }

  it("renders booleans as Excel's uppercase TRUE/FALSE, not String(value)", async () => {
    // NOTE: the flattener unit tests assert lowercase "true"/"false" because
    // their mock cells have no `.w`. The real workbook carries `.w = "TRUE"`,
    // so the shipped viewer shows uppercase. Left-aligned (not numeric).
    expect(await parseSingleCell({ t: "b", v: true })).toEqual({
      text: "TRUE",
      numeric: false,
    });
    expect(await parseSingleCell({ t: "b", v: false })).toEqual({
      text: "FALSE",
      numeric: false,
    });
  });

  it("formats large numbers with Excel's General scientific notation", async () => {
    const cell = await parseSingleCell({ t: "n", v: 12345678901234.5 });
    expect(cell.numeric).toBe(true);
    // The full decimal string is NOT shown; Excel's General format wins.
    expect(cell.text).not.toBe("12345678901234.5");
    expect(cell.text.toUpperCase()).toContain("E");
  });

  it("preserves leading-zero text without numeric coercion", async () => {
    expect(await parseSingleCell({ t: "s", v: "007" })).toEqual({
      text: "007",
      numeric: false,
    });
  });

  it("renders a formula's cached result as a numeric cell", async () => {
    expect(await parseSingleCell({ t: "n", f: "1+2", v: 3 })).toEqual({
      text: "3",
      numeric: true,
    });
  });

  it("renders error cells as their error text, left-aligned", async () => {
    const cell = await parseSingleCell({ t: "e", v: 0x07, w: "#DIV/0!" });
    expect(cell).toEqual({ text: "#DIV/0!", numeric: false });
  });

  it("emits a synthetic empty sheet for a workbook with a blank worksheet", async () => {
    const workbook = XLSX.utils.book_new();
    // A sheet with no cells and no !ref.
    XLSX.utils.book_append_sheet(workbook, {}, "Blank");
    const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;

    const ctx = await parse(buffer);
    const sheets = expectWorkbook(ctx);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe("Blank");
    expect(sheets[0].rowCount).toBe(0);
    expect(sheets[0].columnCount).toBe(0);
    expect(sheets[0].cellIndexes.length).toBe(0);
  }, 15_000);
});

describe("isSpreadsheetContainer signature guard", () => {
  function buffer(bytes: number[]): ArrayBuffer {
    return new Uint8Array(bytes).buffer;
  }

  it("accepts ZIP-based containers (.xlsx/.xlsm/.xlsb/.ods)", () => {
    expect(isSpreadsheetContainer(buffer([0x50, 0x4b, 0x03, 0x04, 1, 2]))).toBe(
      true,
    );
    // Empty and spanned ZIP variants.
    expect(isSpreadsheetContainer(buffer([0x50, 0x4b, 0x05, 0x06]))).toBe(true);
    expect(isSpreadsheetContainer(buffer([0x50, 0x4b, 0x07, 0x08]))).toBe(true);
  });

  it("accepts the OLE2 compound-file header for legacy .xls", () => {
    expect(
      isSpreadsheetContainer(
        buffer([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]),
      ),
    ).toBe(true);
  });

  it("rejects a truncated OLE2 header that only partially matches", () => {
    // Right first bytes, but too short to be the full 8-byte signature.
    expect(isSpreadsheetContainer(buffer([0xd0, 0xcf, 0x11, 0xe0]))).toBe(
      false,
    );
  });

  it("rejects unrelated formats and junk", () => {
    expect(isSpreadsheetContainer(buffer([0x25, 0x50, 0x44, 0x46]))).toBe(
      false,
    ); // %PDF
    expect(
      isSpreadsheetContainer(buffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])),
    ).toBe(false); // PNG
    expect(isSpreadsheetContainer(buffer([0x50, 0x4b]))).toBe(false); // bare "PK"
    expect(isSpreadsheetContainer(buffer([]))).toBe(false); // empty
    expect(isSpreadsheetContainer(buffer([0xff, 0xfe, 0xfd]))).toBe(false);
  });

  it("matches real bytes from a SheetJS-written workbook", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["a"]]),
      "S",
    );
    const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
    expect(
      isSpreadsheetContainer(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
      ),
    ).toBe(true);
  });
});
