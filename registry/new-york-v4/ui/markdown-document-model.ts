import { marked, type Token, type Tokens } from "marked"

import {
  clampMarkdownChunkHeight,
  createEstimatedMarkdownBlock,
  MARKDOWN_DOCUMENT_TARGET_CHUNK_HEIGHT,
  chunkChromeHeight,
} from "./markdown-document-layout"
import { splitTextLines } from "./text-viewer-resource"

export type MarkdownDocumentBlockKind =
  | "blockquote"
  | "callout"
  | "code"
  | "heading"
  | "html"
  | "image"
  | "list"
  | "math"
  | "paragraph"
  | "rule"
  | "table"

export interface MarkdownDocumentBlock {
  blockEndLine: number
  blockStartLine: number
  estimatedHeight: number
  headingId: string | null
  id: string
  isHostile: boolean
  kind: MarkdownDocumentBlockKind
  markdown: string
}

export interface MarkdownDocumentChunk {
  blocks: MarkdownDocumentBlock[]
  estimatedHeight: number
  id: string
  markdown: string
  chunkEndLine: number
  chunkIndex: number
  chunkStartLine: number
  sourceText: string
  sourceLineByRenderedLine: ReadonlyMap<number, number>
}

export interface MarkdownDocument {
  blocks: MarkdownDocumentBlock[]
  headingIdsByLine: Map<number, string>
  lineCount: number
  chunks: MarkdownDocumentChunk[]
  text: string
  wordCount: number
}

export type MarkdownLineRange = {
  end: number
  start: number
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
  const chunks = createMarkdownChunks(blocks, normalizedText)
  const headingIdsByLine = new Map<number, string>()

  for (const block of blocks) {
    if (block.headingId) {
      headingIdsByLine.set(block.blockStartLine, block.headingId)
    }
  }

  return {
    blocks,
    headingIdsByLine,
    lineCount: splitTextLines(normalizedText).length,
    chunks,
    text: normalizedText,
    wordCount: countWords(normalizedText),
  }
}

export function findMarkdownChunkForLine(
  chunks: readonly MarkdownDocumentChunk[],
  sourceLine: number
) {
  return chunks.find(
    (chunk) => sourceLine >= chunk.chunkStartLine && sourceLine <= chunk.chunkEndLine
  )
}

export function markdownChunkIntersectsLineRange({
  chunk,
  range,
}: {
  chunk: MarkdownDocumentChunk
  range: MarkdownLineRange | null
}) {
  if (!range) return false
  return chunk.chunkStartLine <= range.end && chunk.chunkEndLine >= range.start
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
    const estimatedBlock = createEstimatedMarkdownBlock({
      kind: "code",
      markdown: frontmatter.renderMarkdown,
    })
    blocks.push({
      blockEndLine: frontmatter.endLine,
      blockStartLine: 1,
      estimatedHeight: estimatedBlock.estimatedHeight,
      headingId: null,
      id: "block-1-frontmatter",
      isHostile: estimatedBlock.isHostile,
      kind: "code",
      markdown: frontmatter.renderMarkdown,
    })
  }

  const markdownText = frontmatter
    ? text.slice(frontmatter.markdown.length)
    : text
  const baseLine = frontmatter ? frontmatter.endLine + 1 : 1
  const tokens = marked.lexer(markdownText, { gfm: true })
  let cursorLine = baseLine
  let previousTokenWasBlock = false

  for (const token of tokens as SourceToken[]) {
    if (token.type === "space") {
      const rawLineCount = countRawLines(token.raw ?? "\n")
      cursorLine += previousTokenWasBlock
        ? Math.max(0, rawLineCount - 1)
        : rawLineCount
      continue
    }

    const raw = token.raw ?? tokenText(token)
    const blockStartLine = cursorLine
    const blockEndLine = Math.max(
      blockStartLine,
      blockStartLine + countRawLines(raw) - 1
    )
    const kind = markdownBlockKind(token, raw)
    const headingId =
      token.type === "heading"
        ? createHeadingId((token as Tokens.Heading).text, headingRegistry)
        : null
    const markdown = raw.trimEnd() || " "
    const estimatedBlock = createEstimatedMarkdownBlock({ kind, markdown })

    blocks.push({
      blockEndLine,
      blockStartLine,
      estimatedHeight: estimatedBlock.estimatedHeight,
      headingId,
      id: `block-${blocks.length + 1}-${blockStartLine}`,
      isHostile: estimatedBlock.isHostile,
      kind,
      markdown,
    })

    cursorLine = blockEndLine + 1
    previousTokenWasBlock = true
  }

  if (blocks.length === 0) {
    blocks.push({
      blockEndLine: 1,
      blockStartLine: 1,
      estimatedHeight: 120,
      headingId: null,
      id: "block-1-empty",
      isHostile: false,
      kind: "paragraph",
      markdown: " ",
    })
  }

  return blocks
}

function createMarkdownChunks(
  blocks: readonly MarkdownDocumentBlock[],
  text: string
): MarkdownDocumentChunk[] {
  const chunks: MarkdownDocumentChunk[] = []
  const sourceLineOffsets = createSourceLineOffsets(text)
  let currentBlocks: MarkdownDocumentBlock[] = []
  let currentHeight = chunkChromeHeight()

  const flush = () => {
    if (currentBlocks.length === 0) return
    const { markdown, sourceLineByRenderedLine } =
      createMarkdownChunkContent(currentBlocks)
    const chunkStartLine = currentBlocks[0]!.blockStartLine
    const chunkEndLine = currentBlocks[currentBlocks.length - 1]!.blockEndLine
    chunks.push({
      blocks: currentBlocks,
      estimatedHeight: clampMarkdownChunkHeight(currentHeight),
      id: `chunk-${chunks.length + 1}-${chunkStartLine}`,
      markdown,
      chunkEndLine,
      chunkIndex: chunks.length,
      chunkStartLine,
      sourceText: sourceTextForLineRange({
        endLine: chunkEndLine,
        lineOffsets: sourceLineOffsets,
        startLine: chunkStartLine,
        text,
      }),
      sourceLineByRenderedLine,
    })
    currentBlocks = []
    currentHeight = chunkChromeHeight()
  }

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]!
    const nextBlock = blocks[index + 1]
    const blockHeight = block.estimatedHeight

    if (block.isHostile) {
      flush()
      currentBlocks.push(block)
      currentHeight += blockHeight
      flush()
      continue
    }

    const shouldKeepHeadingWithNext =
      block.kind === "heading" &&
      nextBlock &&
      currentHeight + blockHeight + nextBlock.estimatedHeight <=
        MARKDOWN_DOCUMENT_TARGET_CHUNK_HEIGHT

    if (
      currentBlocks.length > 0 &&
      !shouldKeepHeadingWithNext &&
      currentHeight + blockHeight > MARKDOWN_DOCUMENT_TARGET_CHUNK_HEIGHT
    ) {
      flush()
    }

    currentBlocks.push(block)
    currentHeight += blockHeight

    if (
      currentHeight > MARKDOWN_DOCUMENT_TARGET_CHUNK_HEIGHT &&
      isOversizedBlock(block)
    ) {
      flush()
    }
  }

  flush()
  return chunks
}

function createMarkdownChunkContent(blocks: readonly MarkdownDocumentBlock[]): {
  markdown: string
  sourceLineByRenderedLine: ReadonlyMap<number, number>
} {
  const sourceLineByRenderedLine = new Map<number, number>()
  const parts: string[] = []
  let renderedLine = 1

  for (const block of blocks) {
    if (parts.length > 0) {
      parts.push("")
      renderedLine += 1
    }

    parts.push(block.markdown)
    const blockLines = splitTextLines(block.markdown)
    for (let index = 0; index < blockLines.length; index++) {
      sourceLineByRenderedLine.set(
        renderedLine + index,
        Math.min(block.blockEndLine, block.blockStartLine + index)
      )
    }
    renderedLine += blockLines.length
  }

  return {
    markdown: parts.join("\n"),
    sourceLineByRenderedLine,
  }
}

function createSourceLineOffsets(text: string) {
  const offsets = [0]
  for (const match of text.matchAll(/\r\n|[\n\r\u2028\u2029]/g)) {
    offsets.push(match.index + match[0].length)
  }
  offsets.push(text.length)
  return offsets
}

function sourceTextForLineRange({
  endLine,
  lineOffsets,
  startLine,
  text,
}: {
  endLine: number
  lineOffsets: readonly number[]
  startLine: number
  text: string
}) {
  const safeStartLine = Math.max(1, startLine)
  const safeEndLine = Math.max(safeStartLine, endLine)
  const startOffset = lineOffsets[safeStartLine - 1] ?? 0
  let endOffset = lineOffsets[safeEndLine] ?? text.length

  while (endOffset > startOffset && /[\n\r\u2028\u2029]/.test(text[endOffset - 1]!)) {
    endOffset -= 1
  }

  return text.slice(startOffset, endOffset)
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

function markdownBlockKind(
  token: Token,
  raw: string
): MarkdownDocumentBlockKind {
  if (isDirectiveBlock(raw)) return "callout"
  if (isMathBlock(raw)) return "math"

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

function isDirectiveBlock(raw: string) {
  return /^:::(?:note|info|tip|success|warning|caution|danger|error|failure)\b/im.test(
    raw.trimStart()
  )
}

function isMathBlock(raw: string) {
  return /^\$\$[\s\S]*\$\$\s*$/.test(raw.trim())
}

function isOversizedBlock(block: MarkdownDocumentBlock) {
  return block.estimatedHeight > MARKDOWN_DOCUMENT_TARGET_CHUNK_HEIGHT * 0.8
}

function createHeadingId(text: string, registry: HeadingRegistry) {
  const base = slugifyHeading(text) || "section"
  let count = registry.get(base) ?? 0
  let candidate = count === 0 ? base : `${base}-${count}`

  while (registry.has(candidate)) {
    count += 1
    candidate = `${base}-${count}`
  }

  registry.set(base, count + 1)
  if (candidate !== base) {
    registry.set(candidate, 1)
  }
  return candidate
}

function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{Letter}\p{Number}_\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
}

function countRawLines(raw: string) {
  return splitTextLines(raw.replace(/\r?\n$/, "")).length
}

function tokenText(token: SourceToken) {
  return typeof token.text === "string" ? token.text : (token.raw ?? "")
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}
