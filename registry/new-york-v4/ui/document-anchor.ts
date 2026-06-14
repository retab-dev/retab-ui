export type PdfAreaAnchor = {
  kind: "pdf-area"
  pageNumber: number
  left: number
  top: number
  width: number
  height: number
}

export type ImageAreaAnchor = {
  kind: "image-area"
  frameNumber?: number
  left: number
  top: number
  width: number
  height: number
}

export type TextRangeAnchor = {
  kind: "text-range"
  startLine: number
  endLine: number
}

export type CsvCellAnchor = {
  kind: "csv-cell"
  rowIndex: number
  columnIndex: number
}

export type XlsxCellAnchor = {
  kind: "xlsx-cell"
  sheetIndex: number
  rowIndex: number
  columnIndex: number
}

export type DocxTargetAnchor = {
  kind: "docx-target"
  target:
    | {
        kind: "text"
        text: string
      }
    | {
        kind: "cell"
        table: number
        row: number
        column: number
      }
}

export type DocumentAnchor =
  | PdfAreaAnchor
  | ImageAreaAnchor
  | TextRangeAnchor
  | CsvCellAnchor
  | XlsxCellAnchor
  | DocxTargetAnchor
