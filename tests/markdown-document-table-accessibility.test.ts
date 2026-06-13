// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import {
  markdownTableHeaderId,
  patchMarkdownPageTables,
} from "@/registry/new-york-v4/ui/markdown-document-table-accessibility"

describe("markdown document table accessibility", () => {
  it("patches table headers and cells deterministically", () => {
    const root = document.createElement("div")
    root.innerHTML = `
      <table data-markdown-table>
        <thead><tr><th>Name</th><th>Amount</th></tr></thead>
        <tbody><tr><td>Alpha</td><td>1</td></tr></tbody>
      </table>
      <table data-markdown-table>
        <thead><tr><th>City</th></tr></thead>
        <tbody><tr><td>Paris</td></tr></tbody>
      </table>
    `

    patchMarkdownPageTables({ pageId: "page-3-12", root })
    patchMarkdownPageTables({ pageId: "page-3-12", root })

    expect(markdownTableHeaderId("page-3-12", 1, 0)).toBe(
      "page-3-12-table-1-column-0"
    )

    const headers = root.querySelectorAll<HTMLTableCellElement>("th")
    expect(headers[0]?.id).toBe("page-3-12-table-0-column-0")
    expect(headers[0]?.scope).toBe("col")
    expect(headers[1]?.id).toBe("page-3-12-table-0-column-1")
    expect(headers[2]?.id).toBe("page-3-12-table-1-column-0")

    const cells = root.querySelectorAll<HTMLTableCellElement>("td")
    expect(cells[0]?.headers).toBe("page-3-12-table-0-column-0")
    expect(cells[1]?.headers).toBe("page-3-12-table-0-column-1")
    expect(cells[2]?.headers).toBe("page-3-12-table-1-column-0")
  })
})
