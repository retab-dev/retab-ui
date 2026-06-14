import type {
  ProjectedCell,
  ProjectedRow,
} from "@/components/json-table/lib/document-projection"

export function shareProjectedRows(
  previousRows: ProjectedRow[],
  nextRows: ProjectedRow[]
): ProjectedRow[] {
  let didReuseAny = false
  const sharedRows = nextRows.map((nextRow, index) => {
    const previousRow = previousRows[index]
    if (!previousRow) return nextRow

    let rowChanged =
      previousRow.rowIndex !== nextRow.rowIndex ||
      previousRow.cells.length !== nextRow.cells.length

    const nextCells = nextRow.cells.map((nextCell, cellIndex) => {
      const previousCell = previousRow.cells[cellIndex]
      if (canReuseProjectedCell(previousCell, nextCell)) {
        didReuseAny = true
        return previousCell
      }
      rowChanged = true
      return nextCell
    })

    if (!rowChanged) {
      didReuseAny = true
      return previousRow
    }

    return { ...nextRow, cells: nextCells }
  })

  return didReuseAny ? sharedRows : nextRows
}

function canReuseProjectedCell(
  previousCell: ProjectedCell | undefined,
  nextCell: ProjectedCell | undefined
) {
  if (previousCell === nextCell) return true
  if (!previousCell || !nextCell) return false

  return (
    previousCell.key === nextCell.key &&
    Object.is(previousCell.value, nextCell.value) &&
    Object.is(previousCell.displayValue, nextCell.displayValue) &&
    previousCell.templateFieldPath === nextCell.templateFieldPath &&
    previousCell.materializedFieldPath === nextCell.materializedFieldPath &&
    previousCell.addArrayItemAtIndex === nextCell.addArrayItemAtIndex &&
    sameArrayIndexes(previousCell.arrayIndexes, nextCell.arrayIndexes)
  )
}

function sameArrayIndexes(previous: number[], next: number[]) {
  if (previous.length !== next.length) return false
  return previous.every((value, index) => value === next[index])
}
