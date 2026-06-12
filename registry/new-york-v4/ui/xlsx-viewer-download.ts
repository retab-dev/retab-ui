import type { ViewerDownloadAction } from "@/lib/viewer-download"
import type { XlsxSource } from "@/lib/xlsx-workbook"
import { xlsxColumnLabel } from "@/lib/xlsx-workbook"

import { serializeCsvTable } from "./csv-viewer-download"

const CSV_DIALECT = { delimiter: ",", hasHeader: true } as const

export function createXlsxSheetCsvExportAction({
  fileName,
  sheetIndex,
  getSource,
}: {
  fileName: string
  sheetIndex: number
  getSource: () => Promise<XlsxSource>
}): ViewerDownloadAction {
  return {
    id: "xlsx-export-sheet",
    label: "Export sheet",
    fileName,
    origin: "derived",
    getPayload: async ({ signal } = {}) => {
      throwIfAborted(signal)
      const source = await getSource()
      throwIfAborted(signal)
      return {
        kind: "text",
        text: serializeXlsxSheetAsCsv({ source, sheetIndex, signal }),
        mimeType: "text/csv;charset=utf-8",
      }
    },
  }
}

export function xlsxSheetCsvFileName({
  fileName,
  sheetName,
  sheetCount,
}: {
  fileName: string
  sheetName?: string
  sheetCount?: number
}) {
  const baseName = fileName.replace(/\.[^.\\/]+$/, "") || "spreadsheet"
  if (!sheetName || sheetCount == null || sheetCount <= 1) {
    return `${baseName}.csv`
  }
  return `${baseName}.${sanitizeFileNamePart(sheetName)}.csv`
}

function serializeXlsxSheetAsCsv({
  source,
  sheetIndex,
  signal,
}: {
  source: XlsxSource
  sheetIndex: number
  signal?: AbortSignal
}) {
  const sheet = source.sheets[sheetIndex]
  if (!sheet) return ""

  const columns = Array.from({ length: sheet.columnCount }, (_, columnIndex) =>
    xlsxColumnLabel(columnIndex)
  )
  const sourceRows = Array.from({ length: sheet.rowCount }, (_, rowIndex) => {
    throwIfAborted(signal)
    return Array.from({ length: sheet.columnCount }, (_, columnIndex) =>
      source.getCell(sheetIndex, rowIndex, columnIndex).text
    )
  })

  return serializeCsvTable({ columns, sourceRows, dialect: CSV_DIALECT })
}

function sanitizeFileNamePart(value: string) {
  return value.trim().replace(/[/\\?%*:|"<>]+/g, "-") || "sheet"
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new DOMException("Download was cancelled.", "AbortError")
  }
}
