import { describe, expect, it } from "vitest"

import {
  createPretextMarkdownDocument,
  isHostilePretextMarkdownChunk,
} from "@/registry/new-york-v4/ui/pretext-markdown-document-model"
import { parsePretextMarkdownTokens } from "@/registry/new-york-v4/ui/pretext-markdown-parser"

describe("Pretext Markdown parser adapter", () => {
  it("normalizes marked tokens into the private parser shape", () => {
    const tokens = parsePretextMarkdownTokens(
      [
        "# Title",
        "",
        "Paragraph text.",
        "",
        "- item",
        "",
        "| Area | Status |",
        "| --- | --- |",
        "| Markdown | Supported |",
        "",
        "```ts",
        "export const viewer = 'markdown'",
        "```",
      ].join("\n")
    )

    expect(
      tokens
        .filter((token) => token.kind !== "space")
        .map((token) => ({
          kind: token.kind,
          text: token.text,
        }))
    ).toEqual([
      { kind: "heading", text: "Title" },
      { kind: "paragraph", text: "Paragraph text." },
      { kind: "list", text: "" },
      { kind: "table", text: "" },
      { kind: "code", text: "export const viewer = 'markdown'" },
    ])
  })

  it("recovers from unterminated code fences as code blocks", () => {
    const tokens = parsePretextMarkdownTokens("```ts\nconst x = 1")

    expect(tokens).toHaveLength(1)
    expect(tokens[0]).toMatchObject({
      kind: "code",
      raw: "```ts\nconst x = 1",
      text: "const x = 1",
    })
    expect(isHostilePretextMarkdownChunk(tokens[0]!.raw)).toBe(false)
  })

  it("keeps malformed tables as paragraph input instead of inventing table blocks", () => {
    const tokens = parsePretextMarkdownTokens(
      ["| Area | Status |", "| --- |", "| Tables | Supported |"].join("\n")
    )

    expect(tokens).toHaveLength(1)
    expect(tokens[0]).toMatchObject({
      kind: "paragraph",
      text: "| Area | Status |\n| --- |\n| Tables | Supported |",
    })
  })

  it("normalizes ordered list start metadata", () => {
    const tokens = parsePretextMarkdownTokens(
      ["3. Third", "4. Fourth"].join("\n")
    )

    expect(tokens[0]).toMatchObject({
      isOrderedList: true,
      kind: "list",
      listStart: 3,
    })
  })

  it("keeps malformed HTML and links inert at the model boundary", () => {
    expect(parsePretextMarkdownTokens("<div><span>open")[0]).toMatchObject({
      kind: "html",
      text: "<div><span>open",
    })
    expect(
      parsePretextMarkdownTokens("[broken](javascript:alert(1)")[0]
    ).toMatchObject({
      kind: "paragraph",
      text: "[broken](javascript:alert(1)",
    })
  })

  it("normalizes HTML comments separately from raw HTML blocks", () => {
    const tokens = parsePretextMarkdownTokens(
      ["<!-- internal note -->", "", "<div>Visible</div>"].join("\n")
    )

    expect(
      tokens
        .filter((token) => token.kind !== "space")
        .map((token) => ({ kind: token.kind, raw: token.raw }))
    ).toEqual([
      { kind: "comment", raw: "<!-- internal note -->" },
      { kind: "html", raw: "<div>Visible</div>" },
    ])
  })

  it("normalizes reference definitions as explicit parser tokens", () => {
    const tokens = parsePretextMarkdownTokens(
      [
        '[docs]: https://example.com/docs "Docs"',
        "",
        "A [reference][docs].",
      ].join("\n")
    )

    expect(
      tokens
        .filter((token) => token.kind !== "space")
        .map((token) => ({ kind: token.kind, raw: token.raw }))
    ).toEqual([
      {
        kind: "definition",
        raw: '[docs]: https://example.com/docs "Docs"',
      },
      { kind: "paragraph", raw: "A [reference][docs]." },
    ])
  })

  it("does not treat unterminated frontmatter as metadata", () => {
    const document = createPretextMarkdownDocument(
      ["---", "title: Draft", "# Body"].join("\n")
    )

    expect(document.chunks).toHaveLength(1)
    expect(document.chunks[0]).toMatchObject({
      kind: "markdown",
      markdown: "---\ntitle: Draft\n# Body",
      sourceEndLine: 3,
      sourceStartLine: 1,
    })
    expect(document.blocks.map((block) => block.kind)).toEqual([
      "thematicBreak",
      "paragraph",
      "heading",
    ])
    expect(document.headings[0]).toMatchObject({
      id: "body",
      sourceLine: 3,
      text: "Body",
    })
  })
})
