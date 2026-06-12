import { describe, expect, it } from "vitest"

import {
  createCsvNormalizer,
  createCsvParser,
  parseCsv,
  resolveCsvDialect,
  streamCsv,
  type ParsedCsv,
} from "@/registry/new-york-v4/lib/csv"

async function collectStream(
  source: Parameters<typeof streamCsv>[0],
  options?: Parameters<typeof streamCsv>[2]
): Promise<ParsedCsv> {
  let columns: string[] = []
  const rows: string[][] = []
  await streamCsv(
    source,
    {
      onColumns: (next) => {
        columns = next
        for (const row of rows) {
          while (row.length < next.length) row.push("")
        }
      },
      onRows: (batch) => rows.push(...batch),
    },
    options
  )
  return { columns, rows }
}

async function* chunks(parts: string[]) {
  for (const part of parts) yield part
}

function byteStreamFromText(text: string, splitAt: number) {
  const bytes = new TextEncoder().encode(text)
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, splitAt))
      controller.enqueue(bytes.slice(splitAt))
      controller.close()
    },
  })
}

describe("createCsvParser (incremental, across chunk boundaries)", () => {
  function feed(chunks: string[]) {
    const parser = createCsvParser()
    const out: string[][] = []
    for (const c of chunks) out.push(...parser.push(c))
    out.push(...parser.flush())
    return out
  }

  it("reassembles records split mid-field", () => {
    expect(feed(["a,", "b\n1,", "2"])).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("handles a quoted field split across chunks", () => {
    expect(feed(['"a,', 'b"'])).toEqual([["a,b"]])
  })

  it("handles an escaped quote split across chunks", () => {
    expect(feed(['"x""', 'y"'])).toEqual([['x"y']])
  })

  it("keeps quotes inside unquoted fields as literal characters", () => {
    expect(feed(['ab"cd,ef\n', "1,2"])).toEqual([
      ['ab"cd', "ef"],
      ["1", "2"],
    ])
  })

  it("does not let a mid-field quote consume delimiters or line breaks", () => {
    expect(feed(['ab"cd,ef\nnext,row'])).toEqual([
      ['ab"cd', "ef"],
      ["next", "row"],
    ])
  })

  it("strips only the leading UTF-8 BOM", () => {
    expect(feed(["", "\uFEFFa,b\nc,\uFEFFd"])).toEqual([
      ["a", "b"],
      ["c", "\uFEFFd"],
    ])
  })

  it("emits a final quoted empty field at EOF", () => {
    expect(feed(['""'])).toEqual([[""]])
    expect(feed(["a\n", '""'])).toEqual([["a"], [""]])
  })

  it("keeps quoted empty fields around delimiters", () => {
    expect(feed(['"",x\n', 'y,""'])).toEqual([
      ["", "x"],
      ["y", ""],
    ])
  })

  it("handles a CRLF split across chunks", () => {
    expect(feed(["a\r", "\nb"])).toEqual([["a"], ["b"]])
  })

  it("handles quoted empty fields before a split CRLF", () => {
    expect(feed(['""\r', '\n"x"'])).toEqual([[""], ["x"]])
  })

  it("handles CR-only line endings consistently at EOF", () => {
    expect(feed(["\r"])).toEqual([[""]])
    expect(feed(['""\r'])).toEqual([[""]])
    expect(feed(["a\r", '""\r'])).toEqual([["a"], [""]])
  })

  it("is self-contained when serialized (worker-safe)", () => {
    // Mirrors what the inline worker does: eval the stringified factory in a
    // fresh scope with no closure access. Throws if the bundler injected any
    // helper references.
    const factory = new Function(
      `return (${createCsvParser.toString()})`
    )() as typeof createCsvParser
    const parser = factory({ delimiter: "," })
    const records = parser.push('a,b\n"x,y",2').concat(parser.flush())
    expect(records).toEqual([
      ["a", "b"],
      ["x,y", "2"],
    ])
  })

  it("keeps the normalizer self-contained when serialized (worker-safe)", () => {
    const factory = new Function(
      `return (${createCsvNormalizer.toString()})`
    )() as typeof createCsvNormalizer
    const normalizer = factory({ hasHeader: true })
    expect(normalizer.accept(["a", "b"])).toEqual([
      { type: "columns", columns: ["a", "b"] },
    ])
    expect(normalizer.accept(["1", "2", "3"])).toEqual([
      { type: "columns", columns: ["a", "b", ""] },
      { type: "row", row: ["1", "2", "3"] },
    ])
  })
})

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

  it("keeps quotes inside unquoted cells literal", () => {
    const { columns, rows } = parseCsv('note,other\nab"cd,ef\nnext,row')
    expect(columns).toEqual(["note", "other"])
    expect(rows).toEqual([
      ['ab"cd', "ef"],
      ["next", "row"],
    ])
  })

  it("strips a leading UTF-8 BOM from the first header", () => {
    const { columns, rows } = parseCsv("\uFEFFname,age\nAlice,30")
    expect(columns).toEqual(["name", "age"])
    expect(rows).toEqual([["Alice", "30"]])
  })

  it("keeps final quoted empty rows", () => {
    const { columns, rows } = parseCsv('value\n""')
    expect(columns).toEqual(["value"])
    expect(rows).toEqual([[""]])
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

describe("resolveCsvDialect", () => {
  it("normalizes escaped tab delimiters from dialect objects", () => {
    expect(
      resolveCsvDialect({
        dialect: { delimiter: "\\t", hasHeader: true },
        descriptor: {},
      })
    ).toEqual({ delimiter: "\t", hasHeader: true })
  })
})

describe("streamCsv", () => {
  it("matches parseCsv when later rows widen the table", async () => {
    const input = "a,b\n1,2\n3,4,5"
    await expect(
      collectStream(chunks(["a,b\n1", ",2\n3,4", ",5"]))
    ).resolves.toEqual(parseCsv(input))
  })

  it("matches parseCsv for TSV without a header", async () => {
    const input = "1\t2\n3\t4\t5"
    await expect(
      collectStream(input, { delimiter: "\t", hasHeader: false })
    ).resolves.toEqual(parseCsv(input, { delimiter: "\t", hasHeader: false }))
  })

  it("matches parseCsv for final quoted empty rows", async () => {
    const input = 'value\n""'
    await expect(collectStream(chunks(["value\n", '""']))).resolves.toEqual(
      parseCsv(input)
    )
  })

  it("matches parseCsv when quoted cells cross chunk boundaries", async () => {
    const input = 'name,note\nAlice,"line 1\nline 2"\nBob,"said ""hi"""'
    await expect(
      collectStream(
        chunks(['name,note\nAlice,"line', ' 1\nline 2"\nBob,"said "', '"hi"""'])
      )
    ).resolves.toEqual(parseCsv(input))
  })

  it("finishes empty byte streams as empty CSV input", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close()
      },
    })

    await expect(collectStream(stream)).resolves.toEqual({
      columns: [],
      rows: [],
    })
  })

  it("preserves UTF-8 characters split across byte chunks", async () => {
    const input = "name\ncaf\u00e9"
    const splitAt = new TextEncoder().encode(input).length - 1

    await expect(
      collectStream(byteStreamFromText(input, splitAt))
    ).resolves.toEqual(parseCsv(input))
  })
})
