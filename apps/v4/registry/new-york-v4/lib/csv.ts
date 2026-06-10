/**
 * A small, dependency-free CSV/TSV parser (RFC 4180-ish).
 *
 * The core is an incremental, resumable state machine (`createCsvParser`) so the
 * same logic powers the synchronous `parseCsv`, the main-thread streaming
 * reader (`streamCsv`), and the off-thread worker. It handles quoted fields,
 * escaped quotes (`""`), and delimiters/newlines inside quotes, across chunk
 * boundaries.
 */

export interface ParsedCsv {
  columns: string[]
  rows: string[][]
}

export interface ParseCsvOptions {
  /** Field delimiter. Defaults to "," (use "\t" for TSV). */
  delimiter?: string
  /** Treat the first record as a header row. Defaults to true. */
  hasHeader?: boolean
}

export interface CsvParser {
  /** Feed a chunk of text; returns any records completed by it. */
  push(text: string): string[][]
  /** Emit the trailing record (call once at end of input). */
  flush(): string[][]
}

/**
 * Incremental CSV parser. Written in a deliberately plain, closure-free style
 * (no external references) so `createCsvParser.toString()` can be shipped into
 * a Web Worker verbatim.
 */
export function createCsvParser(options?: ParseCsvOptions): CsvParser {
  var delimiter = (options && options.delimiter) || ","
  var record: string[] = []
  var field = ""
  var inQuotes = false
  var pendingQuote = false // just saw a `"` while inside quotes
  var pendingCR = false // just saw a `\r` while outside quotes

  function push(text: string): string[][] {
    var out: string[][] = []
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i)

      if (pendingCR) {
        pendingCR = false
        record.push(field)
        field = ""
        out.push(record)
        record = []
        if (c === "\n") continue // CRLF — newline consumed
        // else: lone CR ended the record; fall through to process c
      }

      if (pendingQuote) {
        pendingQuote = false
        if (c === '"') {
          field += '"'
          continue
        }
        inQuotes = false
        // fall through to process c outside quotes
      }

      if (inQuotes) {
        if (c === '"') {
          pendingQuote = true
        } else {
          field += c
        }
        continue
      }

      if (c === '"') {
        inQuotes = true
      } else if (c === delimiter) {
        record.push(field)
        field = ""
      } else if (c === "\r") {
        pendingCR = true
      } else if (c === "\n") {
        record.push(field)
        field = ""
        out.push(record)
        record = []
      } else {
        field += c
      }
    }
    return out
  }

  function flush(): string[][] {
    var out: string[][] = []
    if (pendingQuote) {
      pendingQuote = false
      inQuotes = false
    }
    if (pendingCR) {
      pendingCR = false
      if (field.length > 0 || record.length > 0) {
        record.push(field)
        field = ""
        out.push(record)
        record = []
      }
      return out
    }
    if (field.length > 0 || record.length > 0) {
      record.push(field)
      field = ""
      out.push(record)
      record = []
    }
    return out
  }

  return { push: push, flush: flush }
}

export function parseCsv(input: string, options: ParseCsvOptions = {}): ParsedCsv {
  const hasHeader = options.hasHeader ?? true
  const parser = createCsvParser({ delimiter: options.delimiter })
  const records = parser.push(input).concat(parser.flush())

  if (records.length === 0) {
    return { columns: [], rows: [] }
  }

  const width = records.reduce((max, r) => Math.max(max, r.length), 0)
  const pad = (r: string[]) =>
    r.length === width ? r : [...r, ...Array(width - r.length).fill("")]

  if (hasHeader) {
    return { columns: pad(records[0]), rows: records.slice(1).map(pad) }
  }

  const columns = Array.from({ length: width }, (_, i) => `Column ${i + 1}`)
  return { columns, rows: records.map(pad) }
}

/** Pad or truncate a record to a fixed width (used by the streaming readers). */
export function fitRow(row: string[], width: number): string[] {
  if (row.length === width) return row
  if (row.length < width) return [...row, ...Array(width - row.length).fill("")]
  return row.slice(0, width)
}

export interface CsvStreamHandlers {
  onColumns: (columns: string[]) => void
  onRows: (rows: string[][]) => void
  onDone?: () => void
  onError?: (error: unknown) => void
}

export interface CsvStreamOptions extends ParseCsvOptions {
  /** Rows per batch handed to `onRows`. Defaults to 2000. */
  batchSize?: number
  signal?: AbortSignal
}

/**
 * Stream a Blob/File/string on the main thread, yielding to the event loop so
 * the UI stays responsive. Rows arrive progressively via `onRows`.
 */
export async function streamCsv(
  source: Blob | string,
  handlers: CsvStreamHandlers,
  options: CsvStreamOptions = {}
): Promise<void> {
  const hasHeader = options.hasHeader ?? true
  const batchSize = options.batchSize ?? 2000
  const signal = options.signal
  const parser = createCsvParser({ delimiter: options.delimiter })

  let columns: string[] | null = null
  let width = 0
  let batch: string[][] = []

  const handleRecords = (records: string[][]) => {
    for (const rec of records) {
      if (!columns) {
        if (hasHeader) {
          columns = rec
          width = rec.length
          handlers.onColumns(rec)
          continue
        }
        width = rec.length
        columns = Array.from({ length: width }, (_, i) => `Column ${i + 1}`)
        handlers.onColumns(columns)
        // fall through — this record is data
      }
      batch.push(fitRow(rec, width))
      if (batch.length >= batchSize) {
        handlers.onRows(batch)
        batch = []
      }
    }
  }

  try {
    let lastYield = performance.now()
    for await (const chunk of readTextChunks(source)) {
      if (signal?.aborted) return
      handleRecords(parser.push(chunk))
      if (performance.now() - lastYield > 12) {
        await new Promise((resolve) => setTimeout(resolve))
        lastYield = performance.now()
      }
    }
    if (signal?.aborted) return
    handleRecords(parser.flush())
    if (batch.length) handlers.onRows(batch)
    handlers.onDone?.()
  } catch (error) {
    handlers.onError?.(error)
  }
}

async function* readTextChunks(source: Blob | string): AsyncGenerator<string> {
  if (typeof source === "string") {
    const SIZE = 1 << 20 // 1 MB slices
    for (let i = 0; i < source.length; i += SIZE) {
      yield source.slice(i, i + SIZE)
    }
    return
  }
  const reader = source
    .stream()
    .pipeThrough(new TextDecoderStream())
    .getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) yield value
    }
  } finally {
    reader.releaseLock()
  }
}
