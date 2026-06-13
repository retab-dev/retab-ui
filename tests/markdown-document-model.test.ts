import { describe, expect, it } from "vitest"

import {
  createMarkdownDocument,
  findMarkdownPageForLine,
  serializeMarkdownTableForClipboard,
} from "@/registry/new-york-v4/ui/markdown-document-model"

describe("markdown document model", () => {
  it("turns YAML frontmatter into inert code and preserves body heading ids", () => {
    const document = createMarkdownDocument(
      ["---", "title: Demo", "---", "", "# Body", "", "# Body"].join("\n")
    )

    expect(document.blocks[0]).toMatchObject({
      blockEndLine: 3,
      blockStartLine: 1,
      kind: "code",
    })
    expect(document.blocks[0]?.markdown).toContain("```yaml")
    expect(document.headingIdsByLine.get(5)).toBe("body")
    expect(document.headingIdsByLine.get(7)).toBe("body-1")
  })

  it("classifies callout and math blocks for page-height estimates", () => {
    const document = createMarkdownDocument(
      [
        ':::warning{title="Careful"}',
        "Read this first.",
        ":::",
        "",
        "$$",
        "x^2",
        "$$",
      ].join("\n")
    )

    expect(document.blocks.map((block) => block.kind)).toEqual([
      "callout",
      "math",
    ])
    expect(document.blocks[0]?.estimatedHeight).toBeGreaterThanOrEqual(96)
    expect(document.blocks[1]?.estimatedHeight).toBeGreaterThanOrEqual(86)
  })

  it("groups blocks into pages with explicit page line bounds", () => {
    const markdown = Array.from(
      { length: 80 },
      (_, index) => `## Section ${index + 1}\n\nParagraph ${index + 1}`
    ).join("\n\n")
    const document = createMarkdownDocument(markdown)
    const firstPage = document.pages[0]!

    expect(document.pages.length).toBeGreaterThan(1)
    expect(firstPage.pageStartLine).toBe(1)
    expect(firstPage.pageEndLine).toBeGreaterThan(firstPage.pageStartLine)
    expect(findMarkdownPageForLine(document.pages, 1)).toBe(firstPage)
  })

  it("serializes Markdown tables as TSV for clipboard copy", () => {
    expect(
      serializeMarkdownTableForClipboard(
        [
          "| Name | Amount |",
          "| --- | ---: |",
          "| Alpha | 1 |",
          "| Beta | 2 |",
        ].join("\n")
      )
    ).toBe(["Name\tAmount", "Alpha\t1", "Beta\t2"].join("\n"))
  })
})
