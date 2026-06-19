// Property/fuzz coverage for the compact-sheet store. createCompactSheet packs
// sparse cells into parallel typed arrays (sorted indexes, prefix-sum text
// offsets, numeric flags) and getCompactSheetCell reads them back via binary
// search. The round-trip — build a random sparse grid, then read every cell —
// exercises packing, search, dedup, bounds, and offset slicing together, which
// example-based tests can't cover exhaustively.
import { describe, expect, it } from "vitest";

import {
  createCompactSheet,
  getCompactSheetCell,
  xlsxColumnLabel,
} from "@/registry/new-york-v4/lib/xlsx-workbook";

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("compact sheet round-trips an arbitrary sparse grid", () => {
  it("reads every cell back to match a last-write-wins reference", () => {
    const rand = mulberry32(0xb00c);
    const TEXTS = ["a", "bb", "ccc", "x😀y", "0", "", "  ", "1.5"];

    for (let iteration = 0; iteration < 400; iteration++) {
      const rowCount = 1 + Math.floor(rand() * 6);
      const columnCount = 1 + Math.floor(rand() * 6);
      const capacity = rowCount * columnCount;

      const entryCount = Math.floor(rand() * (capacity + 4));
      const entries = Array.from({ length: entryCount }, () => {
        // Deliberately allow out-of-range indexes (>= capacity) and empties so
        // the filter paths are exercised.
        const cellIndex = Math.floor(rand() * (capacity + 3));
        return {
          cellIndex,
          text: TEXTS[Math.floor(rand() * TEXTS.length)],
          numeric: rand() < 0.5,
        };
      });

      // Reference: in-range, non-empty, last write wins per cellIndex.
      const expected = new Map<number, { text: string; numeric: boolean }>();
      for (const entry of entries) {
        if (entry.text === "" || entry.cellIndex >= capacity) continue;
        expected.set(entry.cellIndex, {
          text: entry.text,
          numeric: entry.numeric,
        });
      }

      const sheet = createCompactSheet({
        name: "S",
        rowCount,
        columnCount,
        entries,
      });

      // The packed index list must be sorted, unique, and match the reference.
      expect(sheet.cellIndexes.length).toBe(expected.size);
      for (let i = 1; i < sheet.cellIndexes.length; i++) {
        expect(sheet.cellIndexes[i]).toBeGreaterThan(sheet.cellIndexes[i - 1]);
      }

      const label = `iter ${iteration} dims ${rowCount}x${columnCount}`;
      for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < columnCount; c++) {
          const cell = getCompactSheetCell(sheet, r, c);
          const ref = expected.get(r * columnCount + c);
          if (!ref) {
            expect(cell, `${label} empty @ ${r},${c}`).toEqual({
              text: "",
              numeric: false,
            });
          } else {
            expect(cell.text, `${label} @ ${r},${c}`).toBe(ref.text);
            expect(cell.numeric, `${label} @ ${r},${c}`).toBe(ref.numeric);
          }
        }
      }
    }
  });

  it("keeps the last entry when duplicate cell indexes are supplied", () => {
    const sheet = createCompactSheet({
      name: "S",
      rowCount: 1,
      columnCount: 3,
      entries: [
        { cellIndex: 1, text: "first", numeric: true },
        { cellIndex: 0, text: "zero" },
        { cellIndex: 1, text: "second", numeric: false },
      ],
    });

    expect(getCompactSheetCell(sheet, 0, 1).text).toBe("second");
    expect(getCompactSheetCell(sheet, 0, 1).numeric).toBe(false);
    expect(getCompactSheetCell(sheet, 0, 0).text).toBe("zero");
  });

  it("drops entries whose index falls outside the grid capacity", () => {
    const sheet = createCompactSheet({
      name: "S",
      rowCount: 2,
      columnCount: 2, // capacity 4 -> valid indexes 0..3
      entries: [
        { cellIndex: 3, text: "ok" },
        { cellIndex: 4, text: "overflow" },
        { cellIndex: -1, text: "negative" },
      ],
    });

    expect(sheet.cellIndexes.length).toBe(1);
    expect(getCompactSheetCell(sheet, 1, 1).text).toBe("ok");
  });

  it("returns an empty cell for out-of-bounds and non-integer coordinates", () => {
    const sheet = createCompactSheet({
      name: "S",
      rowCount: 2,
      columnCount: 2,
      entries: [{ cellIndex: 0, text: "a" }],
    });

    for (const [r, c] of [
      [-1, 0],
      [0, -1],
      [2, 0],
      [0, 2],
      [0.5, 0],
      [0, 1.5],
    ] as const) {
      expect(getCompactSheetCell(sheet, r, c)).toEqual({
        text: "",
        numeric: false,
      });
    }
  });
});

describe("xlsxColumnLabel base-26 bijection", () => {
  // An independent reference implementation of the bijective base-26 encoding.
  function reference(index: number): string {
    let n = index + 1;
    let label = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      label = String.fromCharCode(65 + rem) + label;
      n = (n - (rem + 1)) / 26;
    }
    return label;
  }

  it("matches an independent encoder across carry boundaries", () => {
    const samples = [
      0, 1, 25, 26, 27, 51, 52, 701, 702, 703, 16383, 18277, 18278,
    ];
    for (const index of samples) {
      expect(xlsxColumnLabel(index), `index ${index}`).toBe(reference(index));
    }
  });

  it("returns an empty label for invalid indexes", () => {
    expect(xlsxColumnLabel(-1)).toBe("");
    expect(xlsxColumnLabel(1.5)).toBe("");
    expect(xlsxColumnLabel(Number.NaN)).toBe("");
  });
});
