import { describe, expect, it } from "vitest"

import {
  createPretextMarkdownDocument,
  createPretextMarkdownHeadingSlug,
  isHostilePretextMarkdownChunk,
} from "@/registry/new-york-v4/ui/pretext-markdown-document-model"
import {
  estimatePretextMarkdownBlockHeight,
  layoutPretextMarkdownDocument,
} from "@/registry/new-york-v4/ui/pretext-markdown-layout"

describe("pretext markdown document model", () => {
  it("flags only oversized Markdown payloads as hostile", () => {
    const lines = (count: number) =>
      Array.from({ length: count }, (_, index) => `line ${index}`).join("\n")

    expect(
      isHostilePretextMarkdownChunk(["```txt", lines(398), "```"].join("\n"))
    ).toBe(false)
    expect(
      isHostilePretextMarkdownChunk(["```txt", lines(399), "```"].join("\n"))
    ).toBe(true)
    expect(isHostilePretextMarkdownChunk("a".repeat(20_000))).toBe(false)
    expect(isHostilePretextMarkdownChunk("a".repeat(20_001))).toBe(true)
    expect(isHostilePretextMarkdownChunk("# Heading")).toBe(false)
  })

  it("isolates hostile blocks into their own virtual chunk", () => {
    const document = createPretextMarkdownDocument(
      [
        "Before",
        "",
        "```txt",
        ...Array.from({ length: 401 }, (_, index) => `line ${index}`),
        "```",
        "",
        "After",
      ].join("\n")
    )
    const hostileChunk = document.chunks.find((chunk) => chunk.isHostile)

    expect(hostileChunk).toBeTruthy()
    expect(hostileChunk?.markdown.trimStart().startsWith("```txt")).toBe(true)
    expect(hostileChunk?.markdown.trimEnd().endsWith("```")).toBe(true)
    expect(document.chunks.filter((chunk) => chunk.isHostile)).toHaveLength(1)
    expect(document.chunks[hostileChunk!.index - 1]?.markdown).toContain(
      "Before"
    )
    expect(document.chunks[hostileChunk!.index + 1]?.markdown).toContain(
      "After"
    )
  })

  it("keeps TOML frontmatter as a first-class chunk with body line offsets", () => {
    const document = createPretextMarkdownDocument(
      [
        "+++",
        'title = "Release Notes"',
        "draft = false",
        "priority = 2",
        "+++",
        "",
        "# Body",
      ].join("\n")
    )

    expect(document.chunks[0]).toMatchObject({
      blockIds: ["block-1-frontmatter"],
      frontmatterEntries: [
        { key: "title", value: "Release Notes", valueKind: "string" },
        { key: "draft", value: "false", valueKind: "boolean" },
        { key: "priority", value: "2", valueKind: "number" },
      ],
      frontmatterLanguage: "toml",
      kind: "frontmatter",
      markdown: 'title = "Release Notes"\ndraft = false\npriority = 2',
      sourceEndLine: 5,
      sourceStartLine: 1,
    })
    expect(document.frontmatter).toMatchObject({
      entries: [
        { key: "title", value: "Release Notes", valueKind: "string" },
        { key: "draft", value: "false", valueKind: "boolean" },
        { key: "priority", value: "2", valueKind: "number" },
      ],
      language: "toml",
      sourceEndLine: 5,
      sourceStartLine: 1,
    })
    expect(document.headings[0]).toMatchObject({
      blockId: "block-7-heading",
      sourceLine: 7,
      text: "Body",
    })
    expect(document.chunks[1]).toMatchObject({
      kind: "markdown",
      sourceStartLine: 6,
    })
    expect(document.blocks[0]).toMatchObject({
      chunkIndex: 0,
      id: "block-1-frontmatter",
      kind: "frontmatter",
      sourceEndLine: 5,
      sourceStartLine: 1,
    })
    expect(document.blocks[1]).toMatchObject({
      chunkIndex: 1,
      headingId: "body",
      id: "block-7-heading",
      kind: "heading",
      sourceStartLine: 7,
    })
  })

  it("keeps semantic Markdown blocks with source ranges inside virtual chunks", () => {
    const document = createPretextMarkdownDocument(
      [
        "# Title",
        "",
        "Paragraph text.",
        "",
        "- item",
        "",
        "---",
        "",
        "```ts",
        "const x = 1",
        "```",
      ].join("\n")
    )

    expect(
      document.blocks.map((block) => ({
        chunkIndex: block.chunkIndex,
        id: block.id,
        kind: block.kind,
        sourceEndLine: block.sourceEndLine,
        sourceStartLine: block.sourceStartLine,
      }))
    ).toEqual([
      {
        chunkIndex: 0,
        id: "block-1-heading",
        kind: "heading",
        sourceEndLine: 1,
        sourceStartLine: 1,
      },
      {
        chunkIndex: 0,
        id: "block-3-paragraph",
        kind: "paragraph",
        sourceEndLine: 3,
        sourceStartLine: 3,
      },
      {
        chunkIndex: 0,
        id: "block-5-list",
        kind: "list",
        sourceEndLine: 5,
        sourceStartLine: 5,
      },
      {
        chunkIndex: 0,
        id: "block-7-thematicBreak",
        kind: "thematicBreak",
        sourceEndLine: 7,
        sourceStartLine: 7,
      },
      {
        chunkIndex: 0,
        id: "block-9-code",
        kind: "code",
        sourceEndLine: 11,
        sourceStartLine: 9,
      },
    ])
    expect(document.chunks).toHaveLength(1)
    expect(document.chunks[0]?.blockIds).toEqual(
      document.blocks.map((block) => block.id)
    )
  })

  it("keeps character offsets for blocks, chunks, headings, and frontmatter", () => {
    const source = [
      "---",
      "title: Offsets",
      "---",
      "",
      "# Title",
      "",
      "Paragraph text.",
    ].join("\n")
    const document = createPretextMarkdownDocument(source)
    const heading = document.blocks.find((block) => block.kind === "heading")
    const paragraph = document.blocks.find(
      (block) => block.kind === "paragraph"
    )
    const bodyChunk = document.chunks.find((chunk) =>
      chunk.blockIds.includes(heading?.id ?? "")
    )

    expect(document.frontmatter).toMatchObject({
      sourceStartOffset: 0,
      sourceEndOffset: source.indexOf("\n\n"),
    })
    expect(heading).toMatchObject({
      sourceStartOffset: source.indexOf("# Title"),
      sourceEndOffset: source.indexOf("# Title") + "# Title".length,
    })
    expect(document.headings[0]).toMatchObject({
      sourceOffset: heading?.sourceStartOffset,
    })
    expect(paragraph).toMatchObject({
      sourceStartOffset: source.indexOf("Paragraph text."),
      sourceEndOffset: source.length,
    })
    expect(bodyChunk).toMatchObject({
      sourceStartOffset: source.indexOf("\n\n# Title") + 1,
      sourceEndOffset: source.length,
    })
  })

  it("keeps document-wide reference definitions for virtual chunk rendering", () => {
    const document = createPretextMarkdownDocument(
      [
        "# Links",
        "",
        "Use [Docs][docs].",
        "",
        ...Array.from({ length: 40 }, (_, index) => `Paragraph ${index + 1}.`),
        "",
        '[docs]: https://example.com/docs "Docs"',
      ].join("\n\n")
    )

    expect(document.chunks.length).toBeGreaterThan(1)
    expect(document.referenceDefinitionsMarkdown).toBe(
      '[docs]: https://example.com/docs "Docs"'
    )
    expect(document.blocks.some((block) => block.kind === "definition")).toBe(
      true
    )
  })

  it("keeps ordered-list numbering metadata in the block model", () => {
    const document = createPretextMarkdownDocument(
      ["3. Third", "4. Fourth"].join("\n")
    )
    const listBlock = document.blocks.find((block) => block.kind === "list")

    expect(listBlock).toMatchObject({
      id: "block-1-list",
      isOrderedList: true,
      listStart: 3,
      sourceEndLine: 2,
      sourceStartLine: 1,
    })
  })

  it("keeps Markdown comments in the source model without visible layout height", () => {
    const document = createPretextMarkdownDocument(
      ["# Public", "", "<!-- internal note -->", "", "Visible text."].join("\n")
    )
    const commentBlock = document.blocks.find(
      (block) => block.kind === "comment"
    )

    expect(commentBlock).toMatchObject({
      id: "block-3-comment",
      markdown: "<!-- internal note -->",
      sourceEndLine: 3,
      sourceStartLine: 3,
    })
    expect(
      estimatePretextMarkdownBlockHeight({
        block: commentBlock!,
        fontScale: 1,
        textWidth: 360,
      })
    ).toBe(0)
  })

  it("uses one explicit heading slug algorithm for model-owned ids", () => {
    expect(createPretextMarkdownHeadingSlug("Résumé déjà vu")).toBe(
      "resume-deja-vu"
    )
    expect(createPretextMarkdownHeadingSlug("Hello,   Markdown!!!")).toBe(
      "hello-markdown"
    )
    expect(createPretextMarkdownHeadingSlug("")).toBe("section")
    expect(createPretextMarkdownHeadingSlug("window")).toBe("section-window")

    const document = createPretextMarkdownDocument(
      ["# Window", "", "## Résumé déjà vu", "", "## Résumé déjà vu"].join("\n")
    )

    expect(document.headings.map((heading) => heading.id)).toEqual([
      "section-window",
      "resume-deja-vu",
      "resume-deja-vu-1",
    ])
  })

  it("decodes heading entities before creating model-owned ids", () => {
    const document = createPretextMarkdownDocument(
      [
        "# Tom &amp; Jerry",
        "",
        "## 5 &lt; 6",
        "",
        "## AT&amp;T &copy; &#169; &#x1f680;",
      ].join("\n")
    )

    expect(document.headings.map((heading) => heading.text)).toEqual([
      "Tom & Jerry",
      "5 < 6",
      "AT&T © © 🚀",
    ])
    expect(document.headings.map((heading) => heading.id)).toEqual([
      "tom-jerry",
      "5-6",
      "att",
    ])
  })

  it("uses semantic blocks as stable layout inputs", () => {
    const document = createPretextMarkdownDocument(
      [
        "```ts",
        ...Array.from({ length: 401 }, () => "const x = 1"),
        "```",
      ].join("\n")
    )
    const frame = layoutPretextMarkdownDocument({
      contentWidth: 640,
      document,
      fontScale: 1,
    })
    const codeBlock = document.blocks.find((block) => block.kind === "code")
    const paragraphLikeCode = codeBlock
      ? { ...codeBlock, kind: "paragraph" as const, isHostile: true }
      : null
    const hostileCodeBlock = codeBlock
      ? { ...codeBlock, isHostile: true }
      : null

    expect(frame.chunks[0]?.blockIds).toEqual(
      document.blocks.map((block) => block.id)
    )
    expect(codeBlock).toBeTruthy()
    expect(paragraphLikeCode).toBeTruthy()
    expect(hostileCodeBlock).toBeTruthy()
    const codeEstimate = estimatePretextMarkdownBlockHeight({
      block: hostileCodeBlock!,
      fontScale: 1,
      textWidth: 360,
    })
    const paragraphEstimate = estimatePretextMarkdownBlockHeight({
      block: paragraphLikeCode!,
      fontScale: 1,
      textWidth: 360,
    })
    expect(codeEstimate).toBeLessThan(paragraphEstimate)
  })

  it("uses hostile chunk metadata in stable layout frames", () => {
    const document = createPretextMarkdownDocument(
      ["```txt", ...Array.from({ length: 401 }, () => "x"), "```"].join("\n")
    )
    const frame = layoutPretextMarkdownDocument({
      contentWidth: 640,
      document,
      fontScale: 1,
    })

    expect(frame.chunks).toHaveLength(1)
    expect(frame.chunks[0]).toMatchObject({
      isHostile: true,
      measuredHeight: null,
    })
    expect(Number.isFinite(frame.chunks[0]!.estimatedHeight)).toBe(true)
    expect(frame.chunks[0]!.estimatedHeight).toBeGreaterThan(8000)
  })
})
