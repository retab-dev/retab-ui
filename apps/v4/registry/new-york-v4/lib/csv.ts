/**
 * A small, dependency-free CSV/TSV parser (RFC 4180-ish).
 *
 * Handles quoted fields, escaped quotes (`""`), and delimiters/newlines inside
 * quotes. Returns a header + rectangular rows so a table can render it directly.
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

export function parseCsv(input: string, options: ParseCsvOptions = {}): ParsedCsv {
  const delimiter = options.delimiter ?? ","
  const hasHeader = options.hasHeader ?? true

  const records: string[][] = []
  let record: string[] = []
  let field = ""
  let inQuotes = false
  let sawAny = false

  // Normalize line endings; lone \r and \r\n both become \n.
  const text = input.replace(/\r\n?/g, "\n")

  const endField = () => {
    record.push(field)
    field = ""
  }
  const endRecord = () => {
    endField()
    records.push(record)
    record = []
  }

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    sawAny = true
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
    } else if (c === delimiter) {
      endField()
    } else if (c === "\n") {
      endRecord()
    } else {
      field += c
    }
  }

  // Flush the trailing field/record unless the input ended on a newline.
  if (field.length > 0 || record.length > 0) {
    endRecord()
  } else if (!sawAny) {
    // empty input -> no records
  }

  if (records.length === 0) {
    return { columns: [], rows: [] }
  }

  const width = records.reduce((max, r) => Math.max(max, r.length), 0)
  const pad = (r: string[]) =>
    r.length === width ? r : [...r, ...Array(width - r.length).fill("")]

  if (hasHeader) {
    const columns = pad(records[0])
    const rows = records.slice(1).map(pad)
    return { columns, rows }
  }

  const columns = Array.from({ length: width }, (_, i) => `Column ${i + 1}`)
  return { columns, rows: records.map(pad) }
}
