import { describe, expect, it, vi } from "vitest"

import {
  createCsvParser,
  parseCsv,
  resolveCsvDialect,
  streamCsv,
  type CsvStreamHandlers,
  type ParsedCsv,
} from "@/registry/new-york-v4/lib/csv"
import { serializeCsvTable } from "@/registry/new-york-v4/ui/csv-viewer-download"
import {
  isCsvDocumentSource,
  resolveCsvResource,
  type CsvViewerSource,
} from "@/registry/new-york-v4/ui/csv-viewer-resource"
import { readyCsvState } from "@/registry/new-york-v4/ui/csv-viewer-state"
import { sortedRowOrder } from "@/registry/new-york-v4/ui/csv-viewer-sort"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Consumer that mirrors the real grid contract: re-pad already-accumulated rows
 * whenever the column set grows. `csv-viewer-state` and the worker both do this.
 */
function collectStreamRepadding(): {
  handlers: CsvStreamHandlers
  result: () => ParsedCsv
  batchSizes: number[]
} {
  let columns: string[] = []
  const rows: string[][] = []
  const batchSizes: number[] = []
  return {
    batchSizes,
    result: () => ({ columns, rows }),
    handlers: {
      onColumns: (next) => {
        columns = next
        for (const row of rows) while (row.length < next.length) row.push("")
      },
      onRows: (batch) => {
        batchSizes.push(batch.length)
        rows.push(...batch)
      },
    },
  }
}

async function* fromChunks(parts: string[]) {
  for (const part of parts) yield part
}

function parseAll(chunks: string[], delimiter?: string): string[][] {
  const parser = createCsvParser(delimiter ? { delimiter } : undefined)
  const out: string[][] = []
  for (const chunk of chunks) out.push(...parser.push(chunk))
  out.push(...parser.flush())
  return out
}

// ---------------------------------------------------------------------------
// createCsvParser: exhaustive chunk-boundary invariant
//
// The incremental parser carries state across push() calls (pendingCR,
// pendingQuote, inQuotes, the first-char BOM check). The result must not depend
// on WHERE the input is chopped. Rather than hand-pick split points, split each
// tricky document at every index (and a sampling of three-way splits) and
// require byte-for-byte agreement with a single-shot parse.
// ---------------------------------------------------------------------------

describe("createCsvParser chunk-boundary invariance", () => {
  const TRICKY: Array<{ name: string; input: string; delimiter?: string }> = [
    { name: "plain grid", input: "a,b,c\n1,2,3\n4,5,6" },
    { name: "quoted commas and newlines", input: '"a,b","c\nd"\n"e""f",g' },
    { name: "leading BOM", input: "﻿name,age\nAlice,30" },
    { name: "mixed line endings", input: "a\r\nb\rc\nd" },
    { name: "unterminated quote", input: '"unterminated,quote\nmore' },
    { name: "empty quoted fields", input: 'x,"",y\n"",z,""' },
    { name: "trailing LF", input: "a,b\n1,2\n" },
    { name: "trailing CRLF", input: "a,b\n1,2\r\n" },
    { name: "final quoted empty", input: 'col\n""' },
    { name: "CR endings with trailing CR", input: "a\rb\rc\r" },
    { name: "run of escaped quotes", input: '"a""""b","c"' },
    { name: "blank line between records", input: "a\n\nb" },
    { name: "ragged widening", input: "a\n1\n2,3,4\n5,6" },
    { name: "BOM then immediate newline", input: "﻿\nx" },
    { name: "quote then CR then LF", input: '"a"\r\n"b"' },
    { name: "tabs", input: "a\tb\n1\t2\t3", delimiter: "\t" },
    { name: "non-ascii cells", input: "name\ncafé\nrésumé" },
  ]

  it.each(TRICKY)(
    "splits $name at every index identically to a single parse",
    ({ input, delimiter }) => {
      const whole = parseAll([input], delimiter)
      for (let i = 0; i <= input.length; i++) {
        const twoWay = parseAll([input.slice(0, i), input.slice(i)], delimiter)
        expect(twoWay, `split at ${i}`).toEqual(whole)
      }
    }
  )

  it.each(TRICKY)(
    "splits $name into three chunks identically to a single parse",
    ({ input, delimiter }) => {
      const whole = parseAll([input], delimiter)
      for (let i = 0; i <= input.length; i++) {
        for (let j = i; j <= input.length; j++) {
          const threeWay = parseAll(
            [input.slice(0, i), input.slice(i, j), input.slice(j)],
            delimiter
          )
          expect(threeWay, `split at ${i},${j}`).toEqual(whole)
        }
      }
    }
  )

  it("feeds one character at a time identically to a single parse", () => {
    for (const { input, delimiter } of TRICKY) {
      const whole = parseAll([input], delimiter)
      const perChar = parseAll(Array.from(input), delimiter)
      expect(perChar, input).toEqual(whole)
    }
  })

  it("treats interspersed empty chunks as no-ops", () => {
    for (const { input, delimiter } of TRICKY) {
      const whole = parseAll([input], delimiter)
      const padded: string[] = []
      for (const ch of Array.from(input)) padded.push("", ch)
      padded.push("")
      expect(parseAll(padded, delimiter), input).toEqual(whole)
    }
  })
})

// ---------------------------------------------------------------------------
// streamCsv: batching contract
// ---------------------------------------------------------------------------

describe("streamCsv batching", () => {
  it("never hands onRows a batch larger than batchSize", async () => {
    const input =
      "h\n" + Array.from({ length: 23 }, (_, i) => String(i)).join("\n")
    const sink = collectStreamRepadding()
    await streamCsv(input, sink.handlers, { batchSize: 5 })

    expect(Math.max(...sink.batchSizes)).toBeLessThanOrEqual(5)
    // 23 rows / 5 per batch -> 4 full batches + a final batch of 3.
    expect(sink.batchSizes).toEqual([5, 5, 5, 5, 3])
    expect(sink.result()).toEqual(parseCsv(input))
  })

  it("delivers exactly batchSize rows then resets (boundary is exact)", async () => {
    const input =
      "h\n" + Array.from({ length: 10 }, (_, i) => String(i)).join("\n")
    const sink = collectStreamRepadding()
    await streamCsv(input, sink.handlers, { batchSize: 5 })

    expect(sink.batchSizes).toEqual([5, 5])
    expect(sink.result().rows).toHaveLength(10)
  })

  it("loses no rows when column widening crosses a batch boundary", async () => {
    // Row 1 is emitted in its own batch BEFORE the table widens at row 2.
    // The only signal the consumer gets to fix up row 1 is a second onColumns
    // event, so a correct consumer must re-pad. This is the contract that the
    // default batchSize (2000) hides because everything lands in one batch.
    const input = "a\n1\n2,3,4"
    const sink = collectStreamRepadding()
    await streamCsv(input, sink.handlers, { batchSize: 1 })

    expect(sink.result()).toEqual(parseCsv(input))
    expect(sink.result()).toEqual({
      columns: ["a", "", ""],
      rows: [
        ["1", "", ""],
        ["2", "3", "4"],
      ],
    })
  })

  it("matches parseCsv across many chunk splits with batchSize 1", async () => {
    const input = "id,name\n1,Alice\n2,Bob\n3,Carol\n4,Dave"
    const sink = collectStreamRepadding()
    await streamCsv(fromChunks(["id,na", "me\n1,Al", "ice\n2,Bob\n3,", "Carol\n4,Dave"]), sink.handlers, {
      batchSize: 1,
    })
    expect(sink.result()).toEqual(parseCsv(input))
  })
})

// ---------------------------------------------------------------------------
// streamCsv: lifecycle (onDone / onError / abort)
// ---------------------------------------------------------------------------

describe("streamCsv lifecycle", () => {
  it("calls onDone exactly once for a normal stream", async () => {
    const onDone = vi.fn()
    await streamCsv("a,b\n1,2", { onColumns: () => {}, onRows: () => {}, onDone })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("reports source errors through onError and never calls onDone", async () => {
    const boom = (async function* () {
      yield "a,b\n1,2"
      throw new Error("stream exploded")
    })()
    const onError = vi.fn()
    const onDone = vi.fn()

    await streamCsv(boom, { onColumns: () => {}, onRows: () => {}, onError, onDone })

    expect(onDone).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledTimes(1)
    expect((onError.mock.calls[0][0] as Error).message).toBe("stream exploded")
  })

  it("does not throw when a source errors and no onError is provided", async () => {
    const boom = (async function* () {
      yield "a,b\n1,2"
      throw new Error("ignored")
    })()
    await expect(
      streamCsv(boom, { onColumns: () => {}, onRows: () => {} })
    ).resolves.toBeUndefined()
  })

  it("stops without onDone when the signal is already aborted", async () => {
    const controller = new AbortController()
    controller.abort()
    const onDone = vi.fn()
    const onRows = vi.fn()

    await streamCsv(
      "a,b\n1,2\n3,4",
      { onColumns: () => {}, onRows, onDone },
      { signal: controller.signal }
    )

    expect(onDone).not.toHaveBeenCalled()
    expect(onRows).not.toHaveBeenCalled()
  })

  it("stops without onDone when aborted mid-stream", async () => {
    const controller = new AbortController()
    const source = (async function* () {
      yield "h\n1\n2"
      controller.abort()
      yield "3\n4"
    })()
    const onDone = vi.fn()

    await streamCsv(
      source,
      { onColumns: () => {}, onRows: () => {}, onDone },
      { signal: controller.signal, batchSize: 10 }
    )

    expect(onDone).not.toHaveBeenCalled()
  })

  it("treats an empty string source as an empty, completed stream", async () => {
    const onColumns = vi.fn()
    const onRows = vi.fn()
    const onDone = vi.fn()
    await streamCsv("", { onColumns, onRows, onDone })

    expect(onColumns).not.toHaveBeenCalled()
    expect(onRows).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// sortedRowOrder: stability of ties under BOTH directions
// ---------------------------------------------------------------------------

describe("sortedRowOrder tie stability", () => {
  const tied = [
    ["1", "first"],
    ["1.0", "second"],
    ["1", "third"],
  ]

  it("keeps tied rows in source order when ascending", () => {
    expect(sortedRowOrder(tied, 0, false)).toEqual([0, 1, 2])
  })

  // A data grid should not reorder rows that compare equal just because the
  // user flipped the sort direction. Descending should keep equal rows in their
  // original relative order, exactly like ascending does.
  it("keeps tied rows in source order when descending", () => {
    expect(sortedRowOrder(tied, 0, true)).toEqual([0, 1, 2])
  })

  it("keeps the stable tie order while still ordering distinct keys descending", () => {
    const rows = [
      ["5", "a"],
      ["1", "b"],
      ["5", "c"],
      ["1", "d"],
      ["3", "e"],
    ]
    // Distinct keys: 5,5 then 3 then 1,1. Ties keep source order (a before c,
    // b before d).
    expect(sortedRowOrder(rows, 0, true)).toEqual([0, 2, 4, 1, 3])
  })

  it("keeps tied text rows stable when descending", () => {
    const rows = [
      ["x", "1"],
      ["x", "2"],
      ["y", "3"],
    ]
    expect(sortedRowOrder(rows, 0, true)).toEqual([2, 0, 1])
  })
})

// ---------------------------------------------------------------------------
// resolveCsvResource / isCsvDocumentSource / readyCsvState
// ---------------------------------------------------------------------------

describe("resolveCsvResource", () => {
  it("returns a table resource for a table source (ignoring any resource)", () => {
    const table = { columns: ["a"], rows: [["1"]] }
    expect(
      resolveCsvResource({
        source: { kind: "table", table, fileName: "x.csv" },
      })
    ).toEqual({ kind: "table", table, fileName: "x.csv" })
  })

  it("unwraps a text payload from a resource", () => {
    const resource = {
      content: { payload: { kind: "text", text: "a,b\n1,2" } },
    } as never
    expect(resolveCsvResource({ resource })).toEqual({
      kind: "text",
      text: "a,b\n1,2",
    })
  })

  it("keeps a blob payload as a streaming resource", () => {
    const content = { payload: { kind: "blob", blob: new Blob(["a,b"]) } }
    const resource = { content } as never
    expect(resolveCsvResource({ resource })).toEqual({
      kind: "resource",
      content,
    })
  })

  it("is empty when neither a source nor a resource is provided", () => {
    expect(resolveCsvResource({})).toEqual({ kind: "empty" })
  })

  it("prefers a table source over a provided resource", () => {
    const table = { columns: ["a"], rows: [] }
    const resource = {
      content: { payload: { kind: "text", text: "z" } },
    } as never
    expect(
      resolveCsvResource({ source: { kind: "table", table }, resource })
    ).toEqual({ kind: "table", table, fileName: undefined })
  })
})

describe("isCsvDocumentSource", () => {
  it.each([
    [{ kind: "url", src: "x.csv" }, true],
    [{ kind: "blob", blob: new Blob([]) }, true],
    [{ kind: "text", text: "a,b" }, true],
    [{ kind: "table", table: { columns: [], rows: [] } }, false],
  ])("classifies %o as document=%s", (source, expected) => {
    expect(isCsvDocumentSource(source as CsvViewerSource)).toBe(expected)
  })
})

// ---------------------------------------------------------------------------
// resolveCsvDialect: only single-character delimiters are usable
// ---------------------------------------------------------------------------

describe("resolveCsvDialect delimiter validity", () => {
  // The incremental parser compares one character at a time, so a multi-char
  // delimiter never matches and silently collapses every row into one field
  // while the exporter still joins with it -- corrupt, unreadable output. A
  // multi-char delimiter is as unusable as an empty one and must fall back.
  it("falls back to the inferred delimiter for a multi-character override", () => {
    expect(resolveCsvDialect({ delimiter: "::", descriptor: {} }).delimiter).toBe(
      ","
    )
    expect(
      resolveCsvDialect({ delimiter: "||", descriptor: { fileName: "a.tsv" } })
        .delimiter
    ).toBe("\t")
  })

  it("falls back when a dialect object carries a multi-character delimiter", () => {
    expect(
      resolveCsvDialect({
        dialect: { delimiter: "::", hasHeader: true },
        descriptor: {},
      })
    ).toEqual({ delimiter: ",", hasHeader: true })
  })

  it("still accepts single-character and escaped-tab delimiters", () => {
    expect(resolveCsvDialect({ delimiter: ";", descriptor: {} }).delimiter).toBe(
      ";"
    )
    expect(
      resolveCsvDialect({ delimiter: "\\t", descriptor: {} }).delimiter
    ).toBe("\t")
  })

  it("round-trips cleanly after rejecting a multi-character delimiter", () => {
    // Before the guard, this resolved to "::", and serialize+parse produced a
    // single mangled column. After the guard it falls back to a comma and the
    // table survives a round trip.
    const dialect = resolveCsvDialect({ delimiter: "::", descriptor: {} })
    const columns = ["a", "b"]
    const sourceRows = [["1", "2"]]
    const text = serializeCsvTable({ columns, sourceRows, dialect })
    expect(parseCsv(text, dialect)).toEqual({ columns, rows: sourceRows })
  })
})

describe("readyCsvState", () => {
  it("is empty when there are no rows", () => {
    const state = readyCsvState(["a", "b"], [])
    expect(state).toMatchObject({
      status: "empty",
      columns: ["a", "b"],
      sourceRows: [],
    })
    expect(state.rowStore.rowCount).toBe(0)
  })

  it("is ready when there is at least one row", () => {
    const state = readyCsvState(["a"], [["1"]])
    expect(state).toMatchObject({
      status: "ready",
      columns: ["a"],
      sourceRows: [["1"]],
    })
    expect(state.rowStore.rowCount).toBe(1)
    expect(state.rowStore.getRow(0)).toEqual(["1"])
  })
})
