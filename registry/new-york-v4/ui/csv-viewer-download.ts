import { isTabDelimited, type CsvDialect } from "@/lib/csv"
import type { ViewerDownloadAction } from "@/lib/viewer-download"

export function escapeDelimitedField(value: string, delimiter: string): string {
  const text = value ?? ""
  return text.includes(delimiter) || /["\r\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text
}

export function serializeCsvTable({
  columns,
  sourceRows,
  dialect,
}: {
  columns: string[]
  sourceRows: string[][]
  dialect: CsvDialect
}): string {
  const lines = [
    columns
      .map((value) => escapeDelimitedField(value, dialect.delimiter))
      .join(dialect.delimiter),
  ]
  for (const sourceRow of sourceRows) {
    lines.push(
      sourceRow
        .map((value) => escapeDelimitedField(value, dialect.delimiter))
        .join(dialect.delimiter)
    )
  }
  return lines.join("\r\n")
}

export function defaultCsvDownloadName(dialect: CsvDialect): string {
  return isTabDelimited(dialect) ? "data.tsv" : "data.csv"
}

export function createCsvExportAction({
  columns,
  sourceRows,
  dialect,
  fileName,
}: {
  columns: string[]
  sourceRows: string[][]
  dialect: CsvDialect
  fileName: string
}): ViewerDownloadAction {
  return {
    id: "csv-export-table",
    label: "Export table",
    fileName,
    origin: "derived",
    getPayload: () => ({
      kind: "text",
      text: serializeCsvTable({ columns, sourceRows, dialect }),
      mimeType: isTabDelimited(dialect)
        ? "text/tab-separated-values;charset=utf-8"
        : "text/csv;charset=utf-8",
    }),
  }
}
