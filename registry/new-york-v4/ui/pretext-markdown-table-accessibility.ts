export function pretextMarkdownChunkId({
  index,
  sourceStartLine,
}: {
  index: number
  sourceStartLine: number
}) {
  return `pretext-markdown-chunk-${index + 1}-${sourceStartLine}`
}

export function pretextMarkdownTableHeaderId(
  chunkId: string,
  tableIndex: number,
  columnIndex: number
) {
  return `${chunkId}-table-${tableIndex}-column-${columnIndex}`
}

export function patchPretextMarkdownChunkTables({
  chunkId,
  root,
}: {
  chunkId: string
  root: HTMLElement | null
}) {
  if (!root) return

  root
    .querySelectorAll<HTMLTableElement>("table[data-pretext-markdown-table]")
    .forEach((table, tableIndex) => {
      const headers = Array.from(table.querySelectorAll("thead th"))
      const rows = Array.from(table.rows)
      const columnCount = Math.max(
        0,
        ...rows.map((row) =>
          Array.from(row.cells).reduce(
            (count, cell) => count + Math.max(1, cell.colSpan || 1),
            0
          )
        )
      )

      table.setAttribute("aria-rowcount", String(rows.length))
      table.setAttribute("aria-colcount", String(columnCount))

      rows.forEach((row, rowIndex) => {
        row.setAttribute("aria-rowindex", String(rowIndex + 1))
        row.setAttribute("data-pretext-table-row-index", String(rowIndex + 1))

        let columnIndex = 1
        Array.from(row.cells).forEach((cell) => {
          cell.setAttribute("aria-colindex", String(columnIndex))
          cell.setAttribute(
            "data-pretext-table-column-index",
            String(columnIndex)
          )
          columnIndex += Math.max(1, cell.colSpan || 1)
        })
      })

      headers.forEach((header, columnIndex) => {
        header.id = pretextMarkdownTableHeaderId(
          chunkId,
          tableIndex,
          columnIndex
        )
        header.setAttribute("scope", "col")
      })

      table.querySelectorAll("tbody tr").forEach((row) => {
        Array.from(row.querySelectorAll<HTMLTableCellElement>("td")).forEach(
          (cell, columnIndex) => {
            const header = headers[columnIndex]
            if (header) cell.headers = header.id
          }
        )
      })
    })
}
