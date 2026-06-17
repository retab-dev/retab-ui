import { describe, expect, it } from "vitest"

import {
  createMarkdownGreenfieldDocument,
  findMarkdownGreenfieldBlockBySourceLine,
  findMarkdownGreenfieldBlockBySourceOffset,
  findMarkdownGreenfieldChunkByBlockId,
  findMarkdownGreenfieldChunkBySourceLine,
  findMarkdownGreenfieldChunkBySourceOffset,
  findMarkdownGreenfieldFragmentTargetById,
} from "@/registry/new-york-v4/ui/markdown-greenfield-document"
import type {
  MarkdownHastElement,
  MarkdownHastNode,
} from "@/registry/new-york-v4/ui/markdown-hast-types"

describe("pretext markdown greenfield document", () => {
  it("resolves reference links before virtual chunking", () => {
    const markdown = [
      "# Start",
      "",
      "This [reference][later-ref] resolves from the full document.",
      "",
      ...Array.from({ length: 70 }, (_, index) => `## Spacer ${index}`),
      "",
      "[later-ref]: https://example.com/full-document",
    ].join("\n")
    const document = createMarkdownGreenfieldDocument(markdown)
    const firstLinkChunk = document.chunks.find((chunk) =>
      chunk.hastChildren.some((child) =>
        Boolean(
          findElement(child, "a", "href", "https://example.com/full-document")
        )
      )
    )

    expect(document.chunks.length).toBeGreaterThan(1)
    expect(firstLinkChunk?.index).toBe(0)
  })

  it("resolves reference images before virtual chunking", () => {
    const markdown = [
      "# Start",
      "",
      "![Remote diagram][later-image]",
      "",
      ...Array.from({ length: 70 }, (_, index) => `## Spacer ${index}`),
      "",
      "[later-image]: https://example.com/full-document.png",
    ].join("\n")
    const document = createMarkdownGreenfieldDocument(markdown)
    const firstImageChunk = document.chunks.find((chunk) =>
      chunk.hastChildren.some((child) =>
        Boolean(
          findElement(
            child,
            "img",
            "src",
            "https://example.com/full-document.png"
          )
        )
      )
    )

    expect(document.chunks.length).toBeGreaterThan(1)
    expect(firstImageChunk?.index).toBe(0)
  })

  it("keeps upstream reference definition precedence across chunks", () => {
    const markdown = [
      "[first definition wins][duplicate-ref]",
      "",
      "[duplicate-ref]: https://example.com/first",
      "",
      ...Array.from({ length: 70 }, (_, index) => `## Spacer ${index}`),
      "",
      "[duplicate-ref]: https://example.com/second",
    ].join("\n")
    const document = createMarkdownGreenfieldDocument(markdown)
    const link = document.chunks
      .flatMap((chunk) => chunk.hastChildren)
      .map((child) => findElement(child, "a"))
      .find(Boolean)

    expect(document.chunks.length).toBeGreaterThan(1)
    expect(link?.properties?.href).toBe("https://example.com/first")
  })

  it("resolves prototype-polluting reference identifiers without object pollution", () => {
    const markdown = [
      "[prototype link][__proto__]",
      "",
      "[constructor link][constructor]",
      "",
      "[__proto__]: https://example.com/proto",
      "[constructor]: https://example.com/constructor",
    ].join("\n")
    const document = createMarkdownGreenfieldDocument(markdown)
    const links = document.blocks
      .flatMap((block) => block.hastChildren)
      .flatMap((child) => collectElements(child, "a"))

    expect(links.map((link) => link.properties?.href)).toEqual([
      "https://example.com/proto",
      "https://example.com/constructor",
    ])
    expect(Object.prototype).not.toHaveProperty("href")
    expect(Object.prototype).not.toHaveProperty("url")
    expect(Object.prototype).not.toHaveProperty("identifier")
  })

  it("keeps GFM footnotes as a generated document-level block", () => {
    const markdown = [
      "# Footnotes",
      "",
      "A reference.[^one]",
      "",
      ...Array.from({ length: 70 }, (_, index) => `## Spacer ${index}`),
      "",
      "[^one]: Resolved from outside the visible source chunk.",
    ].join("\n")
    const document = createMarkdownGreenfieldDocument(markdown)
    const footnoteBlock = document.blocks.find(
      (block) => block.kind === "footnotes"
    )
    const referenceLink = document.blocks.find((block) =>
      block.hastChildren.some((child) =>
        Boolean(findElement(child, "a", "dataFootnoteRef"))
      )
    )

    expect(document.chunks.length).toBeGreaterThan(1)
    expect(referenceLink?.sourceRange?.startLine).toBe(3)
    expect(footnoteBlock).toBeTruthy()
    expect(footnoteBlock?.isGenerated).toBe(true)
    expect(
      footnoteBlock?.hastChildren.some((child) =>
        Boolean(findElement(child, "a", "dataFootnoteBackref"))
      )
    ).toBe(true)
  })

  it("indexes footnote refs and backrefs as virtual fragment targets", () => {
    const markdown = [
      "# Footnotes",
      "",
      "A reference.[^one]",
      "",
      ...Array.from({ length: 70 }, (_, index) => `## Spacer ${index}`),
      "",
      "[^one]: Resolved from outside the visible source chunk.",
    ].join("\n")
    const document = createMarkdownGreenfieldDocument(markdown)

    expect(document.chunks.length).toBeGreaterThan(1)
    expect(
      findMarkdownGreenfieldFragmentTargetById(
        document,
        "#user-content-fn-one"
      )?.sourceLine
    ).toBe(76)
    expect(
      findMarkdownGreenfieldFragmentTargetById(
        document,
        "#user-content-fnref-one"
      )?.sourceLine
    ).toBe(3)
  })

  it("uses upstream GFM semantics for tables, tasks, autolinks, and delete nodes", () => {
    const document = createMarkdownGreenfieldDocument(
      [
        "| Left | Center | Right |",
        "| :--- | :----: | ----: |",
        "| a | b | c |",
        "",
        "- [x] done",
        "- [ ] todo",
        "",
        "Visit www.example.com and ~~remove this~~.",
      ].join("\n")
    )

    expect(document.blocks.map((block) => block.kind)).toEqual([
      "table",
      "list",
      "paragraph",
    ])
    expect(
      document.blocks[0]?.hastChildren.some((child) =>
        Boolean(findElement(child, "table"))
      )
    ).toBe(true)
    expect(countElements(document.blocks[1]!.hastChildren, "input")).toBe(2)
    expect(
      document.blocks[2]?.hastChildren.some((child) =>
        Boolean(findElement(child, "a", "href", "http://www.example.com"))
      )
    ).toBe(true)
    expect(
      document.blocks[2]?.hastChildren.some((child) =>
        Boolean(findElement(child, "del"))
      )
    ).toBe(true)
  })

  it("keeps escaped table pipes and upstream alignment metadata", () => {
    const document = createMarkdownGreenfieldDocument(
      [
        "| Left | Right |",
        "| :--- | ---: |",
        "| escaped \\| pipe | `code \\| pipe` |",
      ].join("\n")
    )
    const headerCells = document.blocks[0]!.hastChildren.flatMap((child) =>
      collectElements(child, "th")
    )
    const bodyCells = document.blocks[0]!.hastChildren.flatMap((child) =>
      collectElements(child, "td")
    )

    expect(document.blocks[0]?.kind).toBe("table")
    expect(headerCells.map((cell) => cell.properties?.align)).toEqual([
      "left",
      "right",
    ])
    expect(bodyCells.map((cell) => extractText(cell))).toEqual([
      "escaped | pipe",
      "code | pipe",
    ])
    expect(bodyCells.map((cell) => cell.properties?.align)).toEqual([
      "left",
      "right",
    ])
  })

  it("classifies rich AST-derived blocks before layout", () => {
    const document = createMarkdownGreenfieldDocument(
      [
        "---",
        "title: Rich Blocks",
        "---",
        "",
        "$$",
        "a^2 + b^2 = c^2",
        "$$",
        "",
        "```mermaid",
        "graph TD",
        "  A-->B",
        "```",
        "",
        '<Metric label="Accuracy" value="99%" />',
      ].join("\n")
    )

    expect(document.blocks.map((block) => block.kind)).toEqual([
      "frontmatter",
      "math",
      "diagram",
      "component",
    ])
    expect(document.blocks[0]?.sourceRange).toMatchObject({
      endLine: 3,
      startLine: 1,
    })
    expect(document.blocks[0]?.sourceText).toContain("title: Rich Blocks")
  })

  it("maps source lines, source offsets, and fragment blocks to virtual chunks", () => {
    const markdown = [
      "# Start",
      "",
      "First paragraph.",
      "",
      "## Later",
      "",
      "A reference.[^one]",
      "",
      ...Array.from({ length: 70 }, (_, index) => `Spacer ${index}`),
      "",
      "[^one]: Footnote definition.",
    ].join("\n")
    const document = createMarkdownGreenfieldDocument(markdown)
    const laterBlock = findMarkdownGreenfieldBlockBySourceLine(
      document,
      5
    )
    const laterOffset = markdown.indexOf("## Later")
    const laterOffsetBlock = findMarkdownGreenfieldBlockBySourceOffset(
      document,
      laterOffset
    )
    const laterChunk = findMarkdownGreenfieldChunkBySourceLine(
      document,
      5
    )
    const laterOffsetChunk = findMarkdownGreenfieldChunkBySourceOffset(
      document,
      laterOffset
    )
    const footnoteTarget = findMarkdownGreenfieldFragmentTargetById(
      document,
      "#user-content-fn-one"
    )
    const footnoteChunk = footnoteTarget
      ? findMarkdownGreenfieldChunkByBlockId(
          document,
          footnoteTarget.blockId
        )
      : null

    expect(laterBlock?.kind).toBe("heading")
    expect(laterOffsetBlock?.id).toBe(laterBlock?.id)
    expect(laterChunk?.blockIds).toContain(laterBlock?.id)
    expect(laterOffsetChunk?.id).toBe(laterChunk?.id)
    expect(footnoteTarget?.blockId).toBeTruthy()
    expect(footnoteChunk?.blockIds).toContain(footnoteTarget?.blockId)
    expect(footnoteChunk?.sourceEndLine).toBe(document.lineCount)
  })

  it("freezes canonical HAST nodes shared by virtual chunks", () => {
    const document = createMarkdownGreenfieldDocument(
      ["# Frozen", "", "[Link](https://example.com)"].join("\n")
    )
    const chunkNode = document.chunks[0]?.hastChildren[0]
    const chunkElement = readElement(chunkNode)

    expect(Object.isFrozen(document.unified.hast)).toBe(true)
    expect(Object.isFrozen(document.unified.hast.children)).toBe(true)
    expect(Object.isFrozen(chunkNode)).toBe(true)
    expect(Object.isFrozen(chunkElement?.children)).toBe(true)
    expect(Object.isFrozen(chunkElement?.properties)).toBe(true)
  })

  it("caches immutable document models by stable Markdown content", () => {
    const markdown = ["# Cached", "", "Repeated content."].join("\n")
    const first = createMarkdownGreenfieldDocument(markdown)
    const second = createMarkdownGreenfieldDocument(markdown)
    const different = createMarkdownGreenfieldDocument(
      `${markdown}\n\nChanged.`
    )

    expect(second).toBe(first)
    expect(different).not.toBe(first)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.blocks)).toBe(true)
    expect(Object.isFrozen(first.blocks[0])).toBe(true)
    expect(Object.isFrozen(first.chunks)).toBe(true)
    expect(() => {
      ;(first.blocks as unknown[]).push(first.blocks[0])
    }).toThrow()
  })

  it("treats pathological AST nesting as hostile before rendering", () => {
    const markdown = [
      ...Array.from(
        { length: 90 },
        (_, index) => `<details><summary>Level ${index + 1}</summary>`
      ),
      "Nested content",
      ...Array.from({ length: 90 }, () => "</details>"),
    ].join("\n")
    const document = createMarkdownGreenfieldDocument(markdown)

    expect(document.blocks[0]?.kind).toBe("html")
    expect(document.blocks[0]?.isHostile).toBe(true)
    expect(document.chunks[0]?.isHostile).toBe(true)
  })
})

function findElement(
  node: MarkdownHastNode,
  tagName: string,
  property?: string,
  value?: unknown
): MarkdownHastElement | null {
  const element = readElement(node)
  if (element?.tagName === tagName) {
    if (!property) return element
    if (
      value === undefined
        ? Object.hasOwn(element.properties ?? {}, property)
        : element.properties?.[property] === value
    )
      return element
  }

  for (const child of element?.children ?? []) {
    const result = findElement(child, tagName, property, value)
    if (result) return result
  }

  return null
}

function countElements(
  nodes: readonly MarkdownHastNode[],
  tagName: string
): number {
  return nodes.reduce((sum, node) => {
    const element = readElement(node)
    if (!element) return sum
    return (
      sum +
      (element.tagName === tagName ? 1 : 0) +
      countElements(element.children, tagName)
    )
  }, 0)
}

function collectElements(
  node: MarkdownHastNode,
  tagName: string
): MarkdownHastElement[] {
  const element = readElement(node)
  if (!element) return []
  return [
    ...(element.tagName === tagName ? [element] : []),
    ...element.children.flatMap((child) => collectElements(child, tagName)),
  ]
}

function readElement(node: unknown): MarkdownHastElement | null {
  return node &&
    typeof node === "object" &&
    (node as MarkdownHastElement).type === "element"
    ? (node as MarkdownHastElement)
    : null
}

function extractText(node: MarkdownHastNode): string {
  if (node.type === "text" && typeof node.value === "string") return node.value
  const element = readElement(node)
  return element?.children.map(extractText).join("") ?? ""
}
