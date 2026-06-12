// Property/fuzz coverage for the CSV layer. Three invariants that example-based
// tests can't exhaustively cover:
//   1. The incremental parser is chunk-invariant — feeding the same bytes in any
//      split must yield identical records (catches stateful boundary bugs).
//   2. parse ∘ serialize round-trips an arbitrary table (catches quoting bugs).
//   3. compareCsvCells is a strict total order (catches intransitive sorts).
import { describe, expect, it } from "vitest"

import { createCsvParser, parseCsv } from "@/registry/new-york-v4/lib/csv"
import {
  escapeDelimitedField,
  serializeCsvTable,
} from "@/registry/new-york-v4/ui/csv-viewer-download"
import {
  compareCsvCells,
  isNumericCell,
  sortedRowOrder,
} from "@/registry/new-york-v4/ui/csv-viewer-sort"

// Deterministic PRNG so failures are reproducible from the seed alone.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]
}

function parseWhole(input: string, delimiter: string): string[][] {
  const parser = createCsvParser({ delimiter })
  return parser.push(input).concat(parser.flush())
}

function parseChunked(
  input: string,
  cutCount: number,
  rand: () => number,
  delimiter: string
): string[][] {
  const cuts = new Set<number>()
  for (let i = 0; i < cutCount; i++) {
    cuts.add(Math.floor(rand() * (input.length + 1)))
  }
  const points = [...cuts].sort((a, b) => a - b)

  const parser = createCsvParser({ delimiter })
  let out: string[][] = []
  let prev = 0
  for (const point of points) {
    out = out.concat(parser.push(input.slice(prev, point)))
    prev = point
  }
  out = out.concat(parser.push(input.slice(prev)))
  return out.concat(parser.flush())
}

describe("CSV parser is chunk-invariant", () => {
  // Alphabet packed with the characters that drive parser state: delimiters,
  // quotes, CR, LF, tab, BOM, and a leading-BOM edge.
  const ALPHABET = [
    "a",
    "b",
    ",",
    '"',
    "\r",
    "\n",
    "\t",
    " ",
    "﻿",
  ] as const

  it("produces identical records regardless of chunk boundaries", () => {
    const rand = mulberry32(0xc0ffee)
    for (let iteration = 0; iteration < 3000; iteration++) {
      const length = Math.floor(rand() * 40)
      let input = ""
      for (let i = 0; i < length; i++) input += pick(rand, ALPHABET)

      const whole = parseWhole(input, ",")
      const chunked = parseChunked(input, 1 + Math.floor(rand() * 5), rand, ",")

      expect(chunked, `seed iter ${iteration}, input ${JSON.stringify(input)}`).toEqual(
        whole
      )
    }
  })

  it("is chunk-invariant for tab-delimited input too", () => {
    const rand = mulberry32(0x1234)
    const tabAlphabet = ["a", "\t", '"', "\r", "\n", ","] as const
    for (let iteration = 0; iteration < 1500; iteration++) {
      const length = Math.floor(rand() * 30)
      let input = ""
      for (let i = 0; i < length; i++) input += pick(rand, tabAlphabet)

      const whole = parseWhole(input, "\t")
      const chunked = parseChunked(input, 1 + Math.floor(rand() * 4), rand, "\t")

      expect(chunked, `input ${JSON.stringify(input)}`).toEqual(whole)
    }
  })
})

describe("parse ∘ serialize round-trips arbitrary tables", () => {
  // BOM is deliberately excluded: a leading U+FEFF is a file-level marker the
  // parser strips by design, so it is not expected to survive a round-trip.
  const CELL_PARTS = ["x", "y", ",", '"', "\r", "\n", "\t", " ", ""] as const

  function randomCell(rand: () => number): string {
    const length = Math.floor(rand() * 4)
    let value = ""
    for (let i = 0; i < length; i++) value += pick(rand, CELL_PARTS)
    return value
  }

  it("reconstructs columns and rows for nasty comma-delimited tables", () => {
    const rand = mulberry32(0xabcdef)
    for (let iteration = 0; iteration < 1500; iteration++) {
      const width = 1 + Math.floor(rand() * 4)
      const columns = Array.from({ length: width }, () => randomCell(rand))
      const rowCount = Math.floor(rand() * 4)
      const sourceRows = Array.from({ length: rowCount }, () =>
        Array.from({ length: width }, () => randomCell(rand))
      )

      const text = serializeCsvTable({
        columns,
        sourceRows,
        dialect: { delimiter: ",", hasHeader: true },
      })

      // An empty terminal line is inherently ambiguous in CSV (it cannot be
      // told apart from a trailing newline), so those tables are exercised by
      // the dedicated characterization tests below rather than here.
      if (text.split("\r\n").pop() === "") continue

      const parsed = parseCsv(text, { delimiter: ",", hasHeader: true })

      const label = `iter ${iteration} text ${JSON.stringify(text)}`
      expect(parsed.columns, label).toEqual(columns)
      expect(parsed.rows, label).toEqual(sourceRows)
    }
  })

  // The serializer joins lines with CRLF and adds no trailing terminator, so a
  // final all-empty single-column row (or an empty single header with no rows)
  // produces an empty terminal line that re-parses to nothing. This is the
  // standard CSV trailing-newline ambiguity, not a parser defect — pinned so the
  // data-loss boundary is explicit if the serializer ever changes.
  it("drops a final single-empty-cell row on re-parse (CSV trailing-newline ambiguity)", () => {
    const text = serializeCsvTable({
      columns: ["h"],
      sourceRows: [[""]],
      dialect: { delimiter: ",", hasHeader: true },
    })
    expect(text).toBe("h\r\n")

    const parsed = parseCsv(text, { delimiter: ",", hasHeader: true })
    expect(parsed.columns).toEqual(["h"])
    expect(parsed.rows).toEqual([]) // the empty row is not recoverable
  })

  it("preserves an all-empty final row when the table has >= 2 columns", () => {
    const text = serializeCsvTable({
      columns: ["a", "b"],
      sourceRows: [["", ""]],
      dialect: { delimiter: ",", hasHeader: true },
    })
    expect(text).toBe("a,b\r\n,")

    const parsed = parseCsv(text, { delimiter: ",", hasHeader: true })
    expect(parsed.columns).toEqual(["a", "b"])
    expect(parsed.rows).toEqual([["", ""]]) // the delimiter keeps the line non-empty
  })

  it("preserves a mid-table empty single-column row (only the trailing one is lost)", () => {
    const text = serializeCsvTable({
      columns: ["h"],
      sourceRows: [[""], ["y"]],
      dialect: { delimiter: ",", hasHeader: true },
    })
    const parsed = parseCsv(text, { delimiter: ",", hasHeader: true })
    expect(parsed.rows).toEqual([[""], ["y"]])
  })

  it("only quotes fields that require it", () => {
    expect(escapeDelimitedField("plain", ",")).toBe("plain")
    expect(escapeDelimitedField("a,b", ",")).toBe('"a,b"')
    expect(escapeDelimitedField('a"b', ",")).toBe('"a""b"')
    expect(escapeDelimitedField("a\nb", ",")).toBe('"a\nb"')
    expect(escapeDelimitedField("a\rb", ",")).toBe('"a\rb"')
    // A tab is not special for comma-delimited output.
    expect(escapeDelimitedField("a\tb", ",")).toBe("a\tb")
    // ...but it is for tab-delimited output.
    expect(escapeDelimitedField("a\tb", "\t")).toBe('"a\tb"')
  })
})

describe("compareCsvCells is a strict total order", () => {
  const VALUES = [
    "",
    " ",
    "0",
    "00",
    "1",
    "1.0",
    "-1",
    "10",
    "2",
    "abc",
    "Abc",
    "abd",
    "1e3",
    "Infinity",
    "-Infinity",
    "NaN",
    "  5 ",
    "0x10",
  ] as const

  // Normalize to {-1,0,1} without producing -0 (which trips Object.is in toBe).
  const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)

  it("is antisymmetric across every pair", () => {
    for (const a of VALUES) {
      for (const b of VALUES) {
        expect(sign(compareCsvCells(a, b))).toBe(sign(-compareCsvCells(b, a)))
      }
    }
  })

  it("is transitive across every triple", () => {
    for (const a of VALUES) {
      for (const b of VALUES) {
        for (const c of VALUES) {
          if (compareCsvCells(a, b) <= 0 && compareCsvCells(b, c) <= 0) {
            expect(
              compareCsvCells(a, c),
              `${a} <= ${b} <= ${c}`
            ).toBeLessThanOrEqual(0)
          }
        }
      }
    }
  })

  it("sorts a shuffled multiset into non-decreasing comparator order", () => {
    const rand = mulberry32(0x5eed)
    for (let iteration = 0; iteration < 500; iteration++) {
      const size = Math.floor(rand() * 12)
      const column = Array.from({ length: size }, () => pick(rand, VALUES))
      const rows = column.map((value) => [value])
      const order = sortedRowOrder(rows, 0, false)
      for (let i = 1; i < order.length; i++) {
        const prev = rows[order[i - 1]][0]
        const curr = rows[order[i]][0]
        expect(
          compareCsvCells(prev, curr),
          `${JSON.stringify(column)} order ${order}`
        ).toBeLessThanOrEqual(0)
      }
    }
  })

  it("keeps ties in source order in both directions (stable)", () => {
    const rows = [["1"], ["1"], ["1"], ["1"]]
    expect(sortedRowOrder(rows, 0, false)).toEqual([0, 1, 2, 3])
    expect(sortedRowOrder(rows, 0, true)).toEqual([0, 1, 2, 3])
  })
})

// Characterization of two surprising-but-currently-intentional numeric rules.
// Flagged so a future change to the predicate is a deliberate one.
describe("isNumericCell edge characterization", () => {
  it("treats whitespace-only cells as the number zero (unlike empty string)", () => {
    expect(isNumericCell("")).toBe(false)
    expect(isNumericCell(" ")).toBe(true)
    expect(isNumericCell("\t")).toBe(true)
    // Consequence: a whitespace cell sorts as 0, ahead of larger numbers.
    expect(compareCsvCells(" ", "5")).toBe(-1)
    expect(compareCsvCells(" ", "0")).toBe(0)
  })

  it("treats Infinity and exotic numeric literals as numeric", () => {
    expect(isNumericCell("Infinity")).toBe(true)
    expect(isNumericCell("-Infinity")).toBe(true)
    expect(isNumericCell("0x10")).toBe(true)
    expect(isNumericCell("1e3")).toBe(true)
    expect(isNumericCell("NaN")).toBe(false)
  })
})
