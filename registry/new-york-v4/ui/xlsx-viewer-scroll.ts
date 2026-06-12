import { resolveXlsxSheetChange, type XlsxSheetMeta } from "@/lib/xlsx-workbook"

export interface PublicXlsxCellRef {
  sheet: number
  row: number
  col: number
}

export interface InternalXlsxCellRef {
  sheetIndex: number
  rowIndex: number
  columnIndex: number
}

export type PendingXlsxScrollTarget = InternalXlsxCellRef & {
  behavior: ScrollBehavior
}

export type XlsxScrollRequest = PendingXlsxScrollTarget & {
  nonce: number
}

export interface ResolvedXlsxScrollTarget {
  sheetIndex: number
  request: PendingXlsxScrollTarget
  changed: boolean
}

export function toInternalCellRef(
  cellRef: PublicXlsxCellRef | null | undefined
): InternalXlsxCellRef | null {
  if (!isValidPublicCellRef(cellRef)) return null
  return {
    sheetIndex: cellRef.sheet,
    rowIndex: cellRef.row,
    columnIndex: cellRef.col,
  }
}

export function isValidPublicCellRef(
  cellRef: PublicXlsxCellRef | null | undefined
): cellRef is PublicXlsxCellRef {
  return (
    cellRef != null &&
    Number.isInteger(cellRef.sheet) &&
    Number.isInteger(cellRef.row) &&
    Number.isInteger(cellRef.col) &&
    cellRef.sheet >= 0 &&
    cellRef.row >= 0 &&
    cellRef.col >= 0
  )
}

export function isValidLoadedScrollTarget(
  target: InternalXlsxCellRef,
  sheets: XlsxSheetMeta[]
): boolean {
  const sheet = sheets[target.sheetIndex]
  return (
    !!sheet &&
    target.rowIndex < sheet.rowCount &&
    target.columnIndex < sheet.columnCount
  )
}

export function resolveLoadedScrollTarget({
  activeSheetIndex,
  target,
  sheets,
}: {
  activeSheetIndex: number
  target: PendingXlsxScrollTarget
  sheets: XlsxSheetMeta[]
}): ResolvedXlsxScrollTarget | null {
  if (!isValidLoadedScrollTarget(target, sheets)) return null

  const change = resolveXlsxSheetChange({
    activeSheet: activeSheetIndex,
    requestedSheet: target.sheetIndex,
    sheetCount: sheets.length,
  })
  if (!change.accepted) return null

  return {
    sheetIndex: change.sheetIndex,
    request: target,
    changed: change.changed,
  }
}
