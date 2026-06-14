import type { Source, SourceAnchor } from "@/lib/document-source"

import type { DocumentAnchor } from "./document-anchor"

export function sourceToDocumentAnchor(source: Source): DocumentAnchor | null {
  switch (source.anchor.kind) {
    case "pdf_bbox":
      return pdfBboxAnchorToDocumentAnchor(source.anchor)
    case "image_bbox":
      return imageBboxAnchorToDocumentAnchor(source.anchor)
    case "csv_cell":
      return csvCellAnchorToDocumentAnchor(source.anchor)
    case "spreadsheet_cell":
      return spreadsheetCellAnchorToDocumentAnchor(source.anchor)
    case "docx_text_span":
      return docxTextSpanAnchorToDocumentAnchor(source.content, source.anchor)
    case "docx_table_cell":
      return docxTableCellAnchorToDocumentAnchor(source.anchor)
    case "text_span":
      return textSpanAnchorToDocumentAnchor(source.anchor)
  }
}

function pdfBboxAnchorToDocumentAnchor(
  anchor: Extract<SourceAnchor, { kind: "pdf_bbox" }>
): DocumentAnchor | null {
  if (!isPositiveInteger(anchor.page) || !isValidNormalizedBox(anchor)) {
    return null
  }
  return {
    kind: "pdf-area",
    pageNumber: anchor.page,
    left: toPercent(anchor.left),
    top: toPercent(anchor.top),
    width: toPercent(anchor.width),
    height: toPercent(anchor.height),
  }
}

function imageBboxAnchorToDocumentAnchor(
  anchor: Extract<SourceAnchor, { kind: "image_bbox" }>
): DocumentAnchor | null {
  const frameNumber = anchor.page ?? 1
  if (!isPositiveInteger(frameNumber) || !isValidNormalizedBox(anchor)) {
    return null
  }
  return {
    kind: "image-area",
    frameNumber,
    left: toPercent(anchor.left),
    top: toPercent(anchor.top),
    width: toPercent(anchor.width),
    height: toPercent(anchor.height),
  }
}

function csvCellAnchorToDocumentAnchor(
  anchor: Extract<SourceAnchor, { kind: "csv_cell" }>
): DocumentAnchor | null {
  const columnIndex = columnLetterToIndex(anchor.column)
  if (columnIndex == null || !Number.isInteger(anchor.row) || anchor.row < 1) {
    return null
  }
  return {
    kind: "csv-cell",
    rowIndex: anchor.row - 1,
    columnIndex,
  }
}

function spreadsheetCellAnchorToDocumentAnchor(
  anchor: Extract<SourceAnchor, { kind: "spreadsheet_cell" }>
): DocumentAnchor | null {
  const columnIndex = columnLetterToIndex(anchor.column)
  if (
    columnIndex == null ||
    !Number.isSafeInteger(anchor.sheet_index) ||
    anchor.sheet_index < 0 ||
    !Number.isSafeInteger(anchor.row) ||
    anchor.row < 1
  ) {
    return null
  }
  return {
    kind: "xlsx-cell",
    sheetIndex: anchor.sheet_index,
    rowIndex: anchor.row - 1,
    columnIndex,
  }
}

function docxTextSpanAnchorToDocumentAnchor(
  content: string,
  anchor: Extract<SourceAnchor, { kind: "docx_text_span" }>
): DocumentAnchor | null {
  if (
    !isNonNegativeInteger(anchor.paragraph) ||
    !isValidOptionalRange(anchor.char_start, anchor.char_end)
  ) {
    return null
  }
  const text = content.trim()
  return text
    ? {
        kind: "docx-target",
        target: { kind: "text", text },
      }
    : null
}

function docxTableCellAnchorToDocumentAnchor(
  anchor: Extract<SourceAnchor, { kind: "docx_table_cell" }>
): DocumentAnchor | null {
  if (
    !isNonNegativeInteger(anchor.table) ||
    !isNonNegativeInteger(anchor.row) ||
    !isNonNegativeInteger(anchor.column) ||
    !isValidOptionalRange(anchor.char_start, anchor.char_end)
  ) {
    return null
  }
  return {
    kind: "docx-target",
    target: {
      kind: "cell",
      table: anchor.table,
      row: anchor.row,
      column: anchor.column,
    },
  }
}

function textSpanAnchorToDocumentAnchor(
  anchor: Extract<SourceAnchor, { kind: "text_span" }>
): DocumentAnchor | null {
  if (
    !Number.isInteger(anchor.line_start) ||
    !Number.isInteger(anchor.line_end) ||
    anchor.line_start < 1 ||
    anchor.line_end < anchor.line_start ||
    !isValidOptionalRange(anchor.char_start, anchor.char_end)
  ) {
    return null
  }
  return {
    kind: "text-range",
    startLine: anchor.line_start,
    endLine: anchor.line_end,
  }
}

function columnLetterToIndex(letter: string): number | null {
  if (!/^[A-Za-z]+$/.test(letter)) return null
  let index = 0
  for (const character of letter.toUpperCase()) {
    index = index * 26 + (character.charCodeAt(0) - 64)
    if (!Number.isSafeInteger(index)) return null
  }
  return index - 1
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1
}

function isNonNegativeInteger(value: number) {
  return Number.isInteger(value) && value >= 0
}

function isValidOptionalRange(start?: number, end?: number) {
  if (start == null && end == null) return true
  if (start == null || end == null) return false
  return (
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    end >= start
  )
}

function isValidNormalizedBox({
  left,
  top,
  width,
  height,
}: {
  left: number
  top: number
  width: number
  height: number
}) {
  return (
    Number.isFinite(left) &&
    Number.isFinite(top) &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    left >= 0 &&
    top >= 0 &&
    width > 0 &&
    height > 0 &&
    left + width <= 1 &&
    top + height <= 1
  )
}

function toPercent(value: number): number {
  return value * 100
}
