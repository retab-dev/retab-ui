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
