export function markdownTableHeaderId(
  pageId: string,
  tableIndex: number,
  columnIndex: number
) {
  return `${pageId}-table-${tableIndex}-column-${columnIndex}`
}

export function patchMarkdownPageTables({
  pageId,
  root,
}: {
  pageId: string
  root: HTMLElement | null
}) {
  if (!root) return

  root
    .querySelectorAll<HTMLTableElement>("table[data-markdown-table]")
    .forEach((table, tableIndex) => {
      const headers = Array.from(table.querySelectorAll("thead th"))

      headers.forEach((header, columnIndex) => {
        header.id = markdownTableHeaderId(pageId, tableIndex, columnIndex)
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
