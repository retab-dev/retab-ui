import { getValueAtPath } from "@/components/json-table/lib/document-paths"
import type { MaterializedFieldPath } from "@/components/json-table/lib/document-paths"
import type { ProjectedRow } from "@/components/json-table/lib/document-projection"

export type PendingPrimitivePatch = {
  data: Record<string, unknown>
  fieldPaths: ReadonlySet<MaterializedFieldPath>
}

export type ProjectedCellIndexEntry = {
  rowIndex: number
  cellIndex: number
}

export type ProjectedCellIndex = Map<
  MaterializedFieldPath,
  ProjectedCellIndexEntry
>

export function indexProjectedCells(
  projectedRows: ProjectedRow[]
): ProjectedCellIndex {
  const index: ProjectedCellIndex = new Map()

  for (let rowIndex = 0; rowIndex < projectedRows.length; rowIndex += 1) {
    const projectedRow = projectedRows[rowIndex]
    if (!projectedRow) continue

    for (
      let cellIndex = 0;
      cellIndex < projectedRow.cells.length;
      cellIndex += 1
    ) {
      const cell = projectedRow.cells[cellIndex]
      if (!cell?.materializedFieldPath) continue

      index.set(cell.materializedFieldPath, { rowIndex, cellIndex })
    }
  }

  return index
}

export function projectedRowWithPendingPrimitivePatch({
  projectedRow,
  patch,
  indexEntries,
}: {
  projectedRow: ProjectedRow
  patch: PendingPrimitivePatch
  indexEntries: ProjectedCellIndexEntry[]
}): ProjectedRow {
  if (indexEntries.length === 0) {
    return projectedRow
  }

  let cells: ProjectedRow["cells"] | null = null

  for (const indexEntry of indexEntries) {
    if (projectedRow.rowIndex !== indexEntry.rowIndex) continue

    const cell = projectedRow.cells[indexEntry.cellIndex]
    if (!cell || !patch.fieldPaths.has(cell.materializedFieldPath)) continue

    const nextValue = getValueAtPath(patch.data, cell.materializedFieldPath)
    if (Object.is(cell.value, nextValue)) continue

    cells ??= projectedRow.cells.slice()
    cells[indexEntry.cellIndex] = {
      ...cell,
      value: nextValue,
    }
  }

  if (!cells) return projectedRow

  return {
    ...projectedRow,
    cells,
  }
}
