import { isTabDelimited, type CsvDialect } from "@/lib/csv"

export function escapeDelimitedField(value: string, delimiter: string): string {
  const text = value ?? ""
  return text.includes(delimiter) || /["\r\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text
}

export function serializeCsvTable({
  columns,
  rows,
  dialect,
}: {
  columns: string[]
  rows: string[][]
  dialect: CsvDialect
}): string {
  const lines = [
    columns
      .map((value) => escapeDelimitedField(value, dialect.delimiter))
      .join(dialect.delimiter),
  ]
  for (const row of rows) {
    lines.push(
      row
        .map((value) => escapeDelimitedField(value, dialect.delimiter))
        .join(dialect.delimiter)
    )
  }
  return lines.join("\r\n")
}

export function downloadNameFromCsvSource({
  src,
  downloadName,
  dialect,
}: {
  src?: string
  downloadName?: string
  dialect: CsvDialect
}): string {
  if (downloadName) return downloadName
  if (!src) return isTabDelimited(dialect) ? "data.tsv" : "data.csv"
  try {
    const name = new URL(src, "http://_").pathname.split("/").pop()
    if (name) return decodeURIComponent(name)
  } catch {
    // Fall through to generated default.
  }
  return isTabDelimited(dialect) ? "data.tsv" : "data.csv"
}

export async function downloadCsvTable({
  src,
  columns,
  rows,
  dialect,
  downloadName,
}: {
  src?: string
  columns: string[]
  rows: string[][]
  dialect: CsvDialect
  downloadName?: string
}): Promise<void> {
  const blob = src
    ? await fetch(src).then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load file: ${response.status}`)
        }
        return response.blob()
      })
    : new Blob([serializeCsvTable({ columns, rows, dialect })], {
        type: isTabDelimited(dialect)
          ? "text/tab-separated-values;charset=utf-8"
          : "text/csv;charset=utf-8",
      })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = downloadNameFromCsvSource({ src, downloadName, dialect })
  anchor.rel = "noreferrer"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
