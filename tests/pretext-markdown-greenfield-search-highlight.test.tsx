// @vitest-environment jsdom

import { cleanup, render, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { createPretextMarkdownGreenfieldDocument } from "@/registry/new-york-v4/ui/pretext-markdown-greenfield-document"
import { PretextMarkdownGreenfieldChunkRenderer } from "@/registry/new-york-v4/ui/pretext-markdown-greenfield-renderer"

afterEach(cleanup)

function renderFirstChunk(markdown: string, searchQuery?: string) {
  const parsed = createPretextMarkdownGreenfieldDocument(markdown)
  const chunk = parsed.chunks[0]
  expect(chunk).toBeDefined()
  return render(
    <PretextMarkdownGreenfieldChunkRenderer
      chunk={chunk}
      searchQuery={searchQuery}
    />
  )
}

describe("pretext markdown search highlighting", () => {
  it("wraps every case-insensitive occurrence of the query in a mark", () => {
    const { container } = renderFirstChunk(
      "Virtualization keeps the viewer fast, and virtualization scales.",
      "virtualization"
    )

    const marks = container.querySelectorAll("mark[data-pretext-search-match]")
    expect(marks).toHaveLength(2)
    // Original casing is preserved inside the highlight.
    expect(marks[0]?.textContent).toBe("Virtualization")
    expect(marks[1]?.textContent).toBe("virtualization")
  })

  it("renders no highlights when the query is empty or whitespace", () => {
    const { container } = renderFirstChunk(
      "Virtualization keeps the viewer fast.",
      "   "
    )
    expect(
      container.querySelectorAll("mark[data-pretext-search-match]")
    ).toHaveLength(0)
  })

  it("never highlights matches inside code spans or fenced code", () => {
    const { container } = renderFirstChunk(
      [
        "Prose mentions virtualization once.",
        "",
        "Inline `virtualization` token stays verbatim.",
        "",
        "```ts",
        "const virtualization = true",
        "```",
      ].join("\n"),
      "virtualization"
    )

    // The prose occurrence is highlighted...
    const marks = container.querySelectorAll("mark[data-pretext-search-match]")
    expect(marks.length).toBeGreaterThanOrEqual(1)

    // ...but code never contains a highlight mark.
    for (const code of container.querySelectorAll("code")) {
      expect(
        within(code as HTMLElement).queryByText("virtualization", {
          selector: "mark",
        })
      ).toBeNull()
      expect(code.textContent).toContain("virtualization")
    }
  })
})
