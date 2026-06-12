/**
 * Sorting helpers for the CSV grid.
 *
 * Cells are plain strings, but a column is often numeric (or mostly numeric
 * with a few text outliers). `compareCsvCells` keeps numeric-looking values in
 * numeric order while still producing a *total order* over mixed values: all
 * numeric cells sort together (ahead of text), and text cells sort
 * lexicographically. A total order matters because `Array.prototype.sort`
 * requires a consistent comparator — a comparator that is numeric for some
 * pairs and lexicographic for others can be intransitive, which makes the
 * displayed order depend on the original row order.
 */

/** A value is treated as numeric when `Number()` yields a finite-ish number. */
export function isNumericCell(value: string): boolean {
  return value !== "" && !Number.isNaN(Number(value))
}

export function compareCsvCells(a: string, b: string): number {
  const aNumeric = isNumericCell(a)
  const bNumeric = isNumericCell(b)
  if (aNumeric && bNumeric) {
    const diff = Number(a) - Number(b)
    return diff < 0 ? -1 : diff > 0 ? 1 : 0
  }
  // Numeric cells always sort ahead of text cells so the comparator stays a
  // total order regardless of which pairs are being compared.
  if (aNumeric) return -1
  if (bNumeric) return 1
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Returns the display order (source-row indices) for a column sort. Ascending
 * order follows `compareCsvCells`; descending reverses that order.
 */
export function sortedRowOrder(
  sourceRows: string[][],
  columnIndex: number,
  descending: boolean
): number[] {
  const order = sourceRows.map((_, rowIndex) => rowIndex)
  order.sort((a, b) =>
    compareCsvCells(
      sourceRows[a][columnIndex] ?? "",
      sourceRows[b][columnIndex] ?? ""
    )
  )
  if (descending) order.reverse()
  return order
}
