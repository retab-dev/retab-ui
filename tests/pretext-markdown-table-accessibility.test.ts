// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import {
  patchPretextMarkdownChunkTables,
  pretextMarkdownChunkId,
  pretextMarkdownTableHeaderId,
} from "@/registry/new-york-v4/ui/pretext-markdown-table-accessibility"

describe("pretext markdown table accessibility", () => {
  it("patches table headers and body cells deterministically", () => {
    const root = document.createElement("div")
    const chunkId = pretextMarkdownChunkId({ index: 2, sourceStartLine: 12 })
    root.innerHTML = `
      <table data-pretext-markdown-table>
        <thead><tr><th>Name</th><th>Amount</th></tr></thead>
        <tbody><tr><td>Alpha</td><td>1</td></tr></tbody>
      </table>
      <table data-pretext-markdown-table>
        <thead><tr><th>City</th></tr></thead>
        <tbody><tr><td>Paris</td></tr></tbody>
      </table>
    `

    patchPretextMarkdownChunkTables({ chunkId, root })
    patchPretextMarkdownChunkTables({ chunkId, root })

    expect(chunkId).toBe("pretext-markdown-chunk-3-12")
    expect(pretextMarkdownTableHeaderId(chunkId, 1, 0)).toBe(
      "pretext-markdown-chunk-3-12-table-1-column-0"
    )

    const headers = root.querySelectorAll<HTMLTableCellElement>("th")
    expect(headers[0]?.id).toBe(
      "pretext-markdown-chunk-3-12-table-0-column-0"
    )
    expect(headers[0]?.scope).toBe("col")
    expect(headers[1]?.id).toBe(
      "pretext-markdown-chunk-3-12-table-0-column-1"
    )
    expect(headers[2]?.id).toBe(
      "pretext-markdown-chunk-3-12-table-1-column-0"
    )

    const cells = root.querySelectorAll<HTMLTableCellElement>("td")
    expect(cells[0]?.headers).toBe(
      "pretext-markdown-chunk-3-12-table-0-column-0"
    )
    expect(cells[1]?.headers).toBe(
      "pretext-markdown-chunk-3-12-table-0-column-1"
    )
    expect(cells[2]?.headers).toBe(
      "pretext-markdown-chunk-3-12-table-1-column-0"
    )
  })
})
