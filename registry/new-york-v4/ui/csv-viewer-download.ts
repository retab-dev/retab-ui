import { isTabDelimited, type CsvDialect } from "@/lib/csv"

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

export async function downloadCsvTable({
  src,
  columns,
  sourceRows,
  dialect,
  downloadName,
}: {
  src?: string
  columns: string[]
  sourceRows: string[][]
  dialect: CsvDialect
  downloadName: string
}): Promise<void> {
  const blob = src
    ? await fetch(src).then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load file: ${response.status}`)
        }
        return response.blob()
      })
    : new Blob([serializeCsvTable({ columns, sourceRows, dialect })], {
        type: isTabDelimited(dialect)
          ? "text/tab-separated-values;charset=utf-8"
          : "text/csv;charset=utf-8",
      })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = downloadName
  anchor.rel = "noreferrer"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
