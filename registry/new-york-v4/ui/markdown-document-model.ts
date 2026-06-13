import { marked, type Token, type Tokens } from "marked"

import { splitTextLines } from "./text-viewer-resource"

export const MARKDOWN_DOCUMENT_PAGE_WIDTH = 768
export const MARKDOWN_DOCUMENT_PAGE_PADDING_X = 36
export const MARKDOWN_DOCUMENT_PAGE_PADDING_Y = 28
export const MARKDOWN_DOCUMENT_TARGET_PAGE_HEIGHT = 980
export const MARKDOWN_DOCUMENT_MIN_PAGE_HEIGHT = 220
export const MARKDOWN_DOCUMENT_MAX_ESTIMATED_PAGE_HEIGHT = 2200

export type MarkdownDocumentBlockKind =
  | "blockquote"
  | "code"
  | "heading"
  | "html"
  | "image"
  | "list"
  | "paragraph"
  | "rule"
  | "table"

export interface MarkdownDocumentBlock {
  estimatedHeight: number
  headingId: string | null
  id: string
  kind: MarkdownDocumentBlockKind
  markdown: string
  sourceEndLine: number
  sourceStartLine: number
}

export interface MarkdownDocumentPage {
  blocks: MarkdownDocumentBlock[]
  estimatedHeight: number
  id: string
  markdown: string
  pageNumber: number
  sourceEndLine: number
  sourceStartLine: number
}

export interface MarkdownDocument {
  blocks: MarkdownDocumentBlock[]
  headingIdsByLine: Map<number, string>
  lineCount: number
  pages: MarkdownDocumentPage[]
  text: string
  wordCount: number
}

type SourceToken = Token & {
  raw?: string
  text?: string
  tokens?: Token[]
}

type HeadingRegistry = Map<string, number>

export function createMarkdownDocument(text: string): MarkdownDocument {
  const normalizedText = text.length === 0 ? " " : text
  const headingRegistry: HeadingRegistry = new Map()
  const blocks = createMarkdownBlocks(normalizedText, headingRegistry)
  const pages = createMarkdownPages(blocks)
  const headingIdsByLine = new Map<number, string>()

  for (const block of blocks) {
    if (block.headingId) {
      headingIdsByLine.set(block.sourceStartLine, block.headingId)
    }
  }

  return {
    blocks,
    headingIdsByLine,
    lineCount: splitTextLines(normalizedText).length,
    pages,
    text: normalizedText,
    wordCount: countWords(normalizedText),
  }
}

export function findMarkdownPageForLine(
  pages: readonly MarkdownDocumentPage[],
  sourceLine: number
) {
  return pages.find((page) =>
    sourceLine >= page.sourceStartLine && sourceLine <= page.sourceEndLine
  )
}

export function markdownPageIntersectsLineRange({
  page,
  range,
}: {
  page: MarkdownDocumentPage
  range: { end: number; start: number } | null
}) {
  if (!range) return false
  return page.sourceStartLine <= range.end && page.sourceEndLine >= range.start
}

export function serializeMarkdownTableForClipboard(markdown: string) {
  const tableToken = marked
    .lexer(markdown, { gfm: true })
    .find((token): token is Tokens.Table => token.type === "table")
  if (!tableToken) return markdown.trim()

  const header = tableToken.header.map((cell) => cell.text.trim())
  const rows = tableToken.rows.map((row) => row.map((cell) => cell.text.trim()))
  return [header, ...rows].map((row) => row.join("\t")).join("\n")
}

function createMarkdownBlocks(
  text: string,
  headingRegistry: HeadingRegistry
): MarkdownDocumentBlock[] {
  const frontmatter = extractYamlFrontmatter(text)
  const blocks: MarkdownDocumentBlock[] = []

  if (frontmatter) {
    blocks.push({
      estimatedHeight: estimateCodeHeight(frontmatter.markdown),
      headingId: null,
      id: "block-1-frontmatter",
      kind: "code",
      markdown: frontmatter.renderMarkdown,
      sourceEndLine: frontmatter.endLine,
      sourceStartLine: 1,
    })
  }

  const markdownText = frontmatter
    ? text.slice(frontmatter.markdown.length).replace(/^\r?\n/, "")
    : text
  const baseLine = frontmatter ? frontmatter.endLine + 1 : 1
  const tokens = marked.lexer(markdownText, { gfm: true })
  let cursorLine = baseLine

  for (const token of tokens as SourceToken[]) {
    if (token.type === "space") {
      cursorLine += countRawLines(token.raw ?? "\n")
      continue
    }

    const raw = token.raw ?? tokenText(token)
    const sourceStartLine = cursorLine
    const sourceEndLine = Math.max(
      sourceStartLine,
      sourceStartLine + countRawLines(raw) - 1
    )
    const kind = markdownBlockKind(token)
    const headingId =
      token.type === "heading"
        ? createHeadingId((token as Tokens.Heading).text, headingRegistry)
        : null

    blocks.push({
      estimatedHeight: estimateBlockHeight({ kind, raw, token }),
      headingId,
      id: `block-${blocks.length + 1}-${sourceStartLine}`,
      kind,
      markdown: raw.trimEnd() || " ",
      sourceEndLine,
      sourceStartLine,
    })

    cursorLine = sourceEndLine + 1
  }

  if (blocks.length === 0) {
    blocks.push({
      estimatedHeight: 120,
      headingId: null,
      id: "block-1-empty",
      kind: "paragraph",
      markdown: " ",
      sourceEndLine: 1,
      sourceStartLine: 1,
    })
  }

  return blocks
}

function createMarkdownPages(
  blocks: readonly MarkdownDocumentBlock[]
): MarkdownDocumentPage[] {
  const pages: MarkdownDocumentPage[] = []
  let currentBlocks: MarkdownDocumentBlock[] = []
  let currentHeight = pageChromeHeight()

  const flush = () => {
    if (currentBlocks.length === 0) return
    const markdown = currentBlocks.map((block) => block.markdown).join("\n\n")
    const sourceStartLine = currentBlocks[0]!.sourceStartLine
    const sourceEndLine = currentBlocks[currentBlocks.length - 1]!.sourceEndLine
    pages.push({
      blocks: currentBlocks,
      estimatedHeight: clampPageHeight(currentHeight),
      id: `page-${pages.length + 1}-${sourceStartLine}`,
      markdown,
      pageNumber: pages.length + 1,
      sourceEndLine,
      sourceStartLine,
    })
    currentBlocks = []
    currentHeight = pageChromeHeight()
  }

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]!
    const nextBlock = blocks[index + 1]
    const blockHeight = block.estimatedHeight
    const shouldKeepHeadingWithNext =
      block.kind === "heading" &&
      nextBlock &&
      currentHeight + blockHeight + nextBlock.estimatedHeight <=
        MARKDOWN_DOCUMENT_TARGET_PAGE_HEIGHT

    if (
      currentBlocks.length > 0 &&
      !shouldKeepHeadingWithNext &&
      currentHeight + blockHeight > MARKDOWN_DOCUMENT_TARGET_PAGE_HEIGHT
    ) {
      flush()
    }

    currentBlocks.push(block)
    currentHeight += blockHeight

    if (
      currentHeight > MARKDOWN_DOCUMENT_TARGET_PAGE_HEIGHT &&
      isOversizedBlock(block)
    ) {
      flush()
    }
  }

  flush()
  return pages
}

function extractYamlFrontmatter(text: string) {
  const match = text.match(/^---(?:\r?\n)([\s\S]*?)(?:\r?\n)---(?:\r?\n|$)/)
  if (!match) return null

  const markdown = match[0]
  const inner = match[1] ?? ""
  return {
    endLine: countRawLines(markdown),
    markdown,
    renderMarkdown: ["```yaml", inner.trimEnd(), "```"].join("\n"),
  }
}

function markdownBlockKind(token: Token): MarkdownDocumentBlockKind {
  switch (token.type) {
    case "blockquote":
      return "blockquote"
    case "code":
      return "code"
    case "heading":
      return "heading"
    case "html":
      return "html"
    case "list":
      return "list"
    case "hr":
      return "rule"
    case "table":
      return "table"
    case "paragraph": {
      const paragraph = token as Tokens.Paragraph
      return paragraph.tokens?.length === 1 &&
        paragraph.tokens[0]?.type === "image"
        ? "image"
        : "paragraph"
    }
    default:
      return "paragraph"
  }
}

function estimateBlockHeight({
  kind,
  raw,
  token,
}: {
  kind: MarkdownDocumentBlockKind
  raw: string
  token: SourceToken
}) {
  switch (kind) {
    case "heading":
      return 58
    case "rule":
      return 34
    case "code":
      return estimateCodeHeight(raw)
    case "table":
      return estimateTableHeight(token)
    case "image":
      return 260
    case "list":
      return Math.max(72, countRawLines(raw) * 26 + 24)
    case "blockquote":
      return Math.max(72, countRawLines(raw) * 28 + 24)
    case "html":
      return Math.max(56, countRawLines(raw) * 24 + 20)
    case "paragraph":
      return estimateParagraphHeight(raw)
  }
}

function estimateCodeHeight(raw: string) {
  return Math.max(86, countRawLines(raw) * 22 + 58)
}

function estimateTableHeight(token: SourceToken) {
  if (token.type !== "table") return 120
  const table = token as Tokens.Table
  return Math.max(96, 48 + table.rows.length * 36)
}

function estimateParagraphHeight(raw: string) {
  const text = raw.replace(/\s+/g, " ").trim()
  const estimatedLines = Math.max(1, Math.ceil(text.length / 78))
  return estimatedLines * 26 + 28
}

function pageChromeHeight() {
  return MARKDOWN_DOCUMENT_PAGE_PADDING_Y * 2
}

function clampPageHeight(height: number) {
  return Math.min(
    MARKDOWN_DOCUMENT_MAX_ESTIMATED_PAGE_HEIGHT,
    Math.max(MARKDOWN_DOCUMENT_MIN_PAGE_HEIGHT, height)
  )
}

function isOversizedBlock(block: MarkdownDocumentBlock) {
  return block.estimatedHeight > MARKDOWN_DOCUMENT_TARGET_PAGE_HEIGHT * 0.8
}

function createHeadingId(text: string, registry: HeadingRegistry) {
  const base = slugifyHeading(text) || "section"
  const count = registry.get(base) ?? 0
  registry.set(base, count + 1)
  return count === 0 ? base : `${base}-${count}`
}

function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
}

function countRawLines(raw: string) {
  return splitTextLines(raw.replace(/\r?\n$/, "")).length
}

function tokenText(token: SourceToken) {
  return typeof token.text === "string" ? token.text : token.raw ?? ""
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}
