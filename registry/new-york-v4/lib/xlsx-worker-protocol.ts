import type { CompactSheet } from "@/lib/xlsx-workbook"

export interface XlsxParseLimits {
  maxRowMajorIndex: number
  maxNonEmptyCells: number
  maxTextChars: number
}

export const XLSX_PARSE_LIMITS: XlsxParseLimits = {
  maxRowMajorIndex: 0xffffffff,
  maxNonEmptyCells: 1_000_000,
  maxTextChars: 50_000_000,
}

export type XlsxWorkerErrorCode =
  | "parse_failed"
  | "range_too_large"
  | "too_many_cells"
  | "text_too_large"

export type XlsxWorkerRequest = {
  type: "parse_workbook"
  buffer: ArrayBuffer
}

export type XlsxWorkerResponse =
  | { type: "workbook"; sheets: CompactSheet[] }
  | { type: "error"; message: string; code: XlsxWorkerErrorCode }

export class XlsxWorkerError extends Error {
  constructor(
    readonly code: XlsxWorkerErrorCode,
    message: string
  ) {
    super(message)
    this.name = "XlsxWorkerError"
  }
}
