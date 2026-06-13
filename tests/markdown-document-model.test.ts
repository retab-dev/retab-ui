import { describe, expect, it } from "vitest"

import {
  createMarkdownDocument,
  findMarkdownChunkForLine,
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

  it("classifies callout and math blocks for chunk-height estimates", () => {
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

  it("groups blocks into chunks with explicit chunk line bounds", () => {
    const markdown = Array.from(
      { length: 80 },
      (_, index) => `## Section ${index + 1}\n\nParagraph ${index + 1}`
    ).join("\n\n")
    const document = createMarkdownDocument(markdown)
    const firstPage = document.chunks[0]!

    expect(document.chunks.length).toBeGreaterThan(1)
    expect(firstPage.chunkStartLine).toBe(1)
    expect(firstPage.chunkEndLine).toBeGreaterThan(firstPage.chunkStartLine)
    expect(findMarkdownChunkForLine(document.chunks, 1)).toBe(firstPage)
  })

  it("isolates hostile blocks into their own chunks", () => {
    const hostileCode = [
      "Before",
      "",
      "```txt",
      ...Array.from({ length: 401 }, (_, index) => `line ${index}`),
      "```",
      "",
      "After",
    ].join("\n")
    const document = createMarkdownDocument(hostileCode)
    const hostilePage = document.chunks.find((chunk) =>
      chunk.blocks.some((block) => block.isHostile)
    )

    expect(hostilePage).toBeTruthy()
    expect(hostilePage?.blocks).toHaveLength(1)
    expect(hostilePage?.blocks[0]).toMatchObject({
      isHostile: true,
      kind: "code",
    })
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
