import { describe, expect, it } from "vitest"

import { parseCsv } from "@/registry/new-york-v4/lib/csv"

describe("parseCsv", () => {
  it("parses a simple CSV with a header", () => {
    const { columns, rows } = parseCsv("a,b,c\n1,2,3\n4,5,6")
    expect(columns).toEqual(["a", "b", "c"])
    expect(rows).toEqual([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ])
  })

  it("handles quoted fields with embedded commas and newlines", () => {
    const { rows } = parseCsv('h1,h2\n"a, b","line1\nline2"')
    expect(rows).toEqual([["a, b", "line1\nline2"]])
  })

  it("handles escaped quotes", () => {
    const { rows } = parseCsv('h\n"she said ""hi"""')
    expect(rows).toEqual([['she said "hi"']])
  })

  it("normalizes CRLF line endings", () => {
    const { columns, rows } = parseCsv("a,b\r\n1,2\r\n3,4")
    expect(columns).toEqual(["a", "b"])
    expect(rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ])
  })

  it("pads ragged rows to the widest record", () => {
    const { columns, rows } = parseCsv("a,b,c\n1,2\n4,5,6,7")
    expect(columns).toEqual(["a", "b", "c", ""])
    expect(rows).toEqual([
      ["1", "2", "", ""],
      ["4", "5", "6", "7"],
    ])
  })

  it("supports a custom delimiter (TSV)", () => {
    const { columns, rows } = parseCsv("a\tb\n1\t2", { delimiter: "\t" })
    expect(columns).toEqual(["a", "b"])
    expect(rows).toEqual([["1", "2"]])
  })

  it("synthesizes column names when hasHeader is false", () => {
    const { columns, rows } = parseCsv("1,2,3", { hasHeader: false })
    expect(columns).toEqual(["Column 1", "Column 2", "Column 3"])
    expect(rows).toEqual([["1", "2", "3"]])
  })

  it("returns empty for empty input", () => {
    expect(parseCsv("")).toEqual({ columns: [], rows: [] })
  })

  it("ignores a trailing newline", () => {
    const { rows } = parseCsv("a,b\n1,2\n")
    expect(rows).toEqual([["1", "2"]])
  })
})
