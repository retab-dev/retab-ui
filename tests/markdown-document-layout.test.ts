import { describe, expect, it } from "vitest"

import {
  createEstimatedMarkdownBlock,
  createMarkdownLayoutStyle,
  createMarkdownPageEstimates,
  estimateMarkdownBlockHeight,
} from "@/registry/new-york-v4/ui/markdown-document-layout"
import { createMarkdownDocument } from "@/registry/new-york-v4/ui/markdown-document-model"

describe("markdown document layout", () => {
  it("uses width-sensitive Pretext estimates for prose", () => {
    const block = {
      kind: "paragraph" as const,
      markdown: "This is a long paragraph. ".repeat(80),
    }

    const narrow = estimateMarkdownBlockHeight(
      block,
      createMarkdownLayoutStyle({ contentWidth: 320 })
    )
    const wide = estimateMarkdownBlockHeight(
      block,
      createMarkdownLayoutStyle({ contentWidth: 960 })
    )

    expect(narrow).toBeGreaterThan(wide)
  })

  it("uses width-sensitive Pretext estimates for pre-wrap code", () => {
    const block = {
      kind: "code" as const,
      markdown: ["```txt", "const value = ".repeat(80), "```"].join("\n"),
    }

    const narrow = estimateMarkdownBlockHeight(
      block,
      createMarkdownLayoutStyle({ contentWidth: 320 })
    )
    const wide = estimateMarkdownBlockHeight(
      block,
      createMarkdownLayoutStyle({ contentWidth: 960 })
    )

    expect(narrow).toBeGreaterThan(wide)
  })

  it("clamps layout width and produces stable page estimates", () => {
    const document = createMarkdownDocument("# Title\n\nBody")
    const style = createMarkdownLayoutStyle({ contentWidth: 0, zoom: 1 })

    expect(style.contentWidth).toBe(1)
    expect(createMarkdownPageEstimates(document, style)).toEqual(
      createMarkdownPageEstimates(document, style)
    )
  })

  it("identifies hostile blocks for page isolation", () => {
    expect(
      createEstimatedMarkdownBlock({
        kind: "code",
        markdown: ["```txt", ...Array.from({ length: 401 }, () => "x"), "```"].join(
          "\n"
        ),
      }).isHostile
    ).toBe(true)
    expect(
      createEstimatedMarkdownBlock({
        kind: "paragraph",
        markdown: "a".repeat(20_001),
      }).isHostile
    ).toBe(true)
  })
})
