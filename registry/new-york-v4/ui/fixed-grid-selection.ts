export interface GridCellCoordinate {
  rowIndex: number
  columnIndex: number
}

export function isSameGridCell(
  left: GridCellCoordinate | null | undefined,
  right: GridCellCoordinate | null | undefined
) {
  return (
    !!left &&
    !!right &&
    left.rowIndex === right.rowIndex &&
    left.columnIndex === right.columnIndex
  )
}

export function gridCellKey({ rowIndex, columnIndex }: GridCellCoordinate) {
  return `${rowIndex}:${columnIndex}`
}

export function parseGridCellKey(key: string): GridCellCoordinate | null {
  const [rowIndexText, columnIndexText, extra] = key.split(":")
  if (extra !== undefined) return null

  const rowIndex = Number(rowIndexText)
  const columnIndex = Number(columnIndexText)
  if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex)) {
    return null
  }

  return { rowIndex, columnIndex }
}
