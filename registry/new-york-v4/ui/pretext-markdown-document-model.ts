"use client"

import { measureLineStats, prepareWithSegments } from "@chenglou/pretext"
import { marked, type Token } from "marked"

import { splitTextLines } from "./text-viewer-resource"

const MARKDOWN_CHUNK_TARGET_SOURCE_LINES = 36
const MARKDOWN_CHUNK_MAX_SOURCE_LINES = 54
const DOCUMENT_PADDING_Y = 32
const CHUNK_GAP = 0
const CHUNK_PADDING_X = 48
const CHUNK_PADDING_Y = 0
const BODY_LINE_HEIGHT = 24
const CODE_LINE_HEIGHT = 21
const MIN_CHUNK_HEIGHT = 120
const BODY_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const CODE_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'

export type PretextMarkdownChunkKind = "frontmatter" | "markdown"

export interface PretextMarkdownDocument {
  headings: PretextMarkdownHeading[]
  chunks: PretextMarkdownChunk[]
  sourceLineCount: number
  text: string
  wordCount: number
}

export interface PretextMarkdownHeading {
  id: string
  chunkIndex: number
  sourceLine: number
  text: string
}

export interface PretextMarkdownChunk {
  headingIds: string[]
  index: number
  kind: PretextMarkdownChunkKind
  markdown: string
  sourceEndLine: number
  sourceStartLine: number
}

export interface PretextMarkdownDocumentFrame {
  chunks: PretextMarkdownChunkFrame[]
  totalHeight: number
  width: number
}

export interface PretextMarkdownChunkFrame {
  bottom: number
  estimatedHeight: number
  height: number
  index: number
  kind: PretextMarkdownChunkKind
  measuredHeight: number | null
  sourceEndLine: number
  sourceStartLine: number
  top: number
}

export interface PretextMarkdownMeasuredHeights {
  get(index: number): number | undefined
}

export interface PretextMarkdownLineRange {
  end: number
  start: number
}

export function createPretextMarkdownDocument(
  markdown: string
): PretextMarkdownDocument {
  const sourceLineCount = splitTextLines(markdown).length
  const { headings, chunks } = createPretextMarkdownChunks(
    markdown,
    sourceLineCount
  )

  return {
    headings,
    chunks,
    sourceLineCount,
    text: markdown,
    wordCount: countWords(markdown),
  }
}

export function layoutPretextMarkdownDocument({
  contentWidth,
  document,
  fontScale,
  measuredHeights,
}: {
  contentWidth: number
  document: PretextMarkdownDocument
  fontScale: number
  measuredHeights?: PretextMarkdownMeasuredHeights
}): PretextMarkdownDocumentFrame {
  const width = Math.max(1, contentWidth)
  const frames: PretextMarkdownChunkFrame[] = []
  let y = DOCUMENT_PADDING_Y

  for (const chunk of document.chunks) {
    const measuredHeight = measuredHeights?.get(chunk.index)
    const estimatedHeight = estimatePretextMarkdownChunkHeight({
      fontScale,
      chunk,
      width,
    })
    const height =
      measuredHeight == null
        ? estimatedHeight
        : Math.max(MIN_CHUNK_HEIGHT, measuredHeight)
    const frame: PretextMarkdownChunkFrame = {
      bottom: y + height,
      estimatedHeight,
      height,
      index: chunk.index,
      kind: chunk.kind,
      measuredHeight: measuredHeight ?? null,
      sourceEndLine: chunk.sourceEndLine,
      sourceStartLine: chunk.sourceStartLine,
      top: y,
    }
    frames.push(frame)
    y = frame.bottom + CHUNK_GAP
  }

  return {
    chunks: frames,
    totalHeight: frames.length ? y - CHUNK_GAP + DOCUMENT_PADDING_Y : 0,
    width,
  }
}

export function getPretextMarkdownVisibleChunkFrames({
  frames,
  overscanPx,
  scrollTop,
  viewportHeight,
}: {
  frames: readonly PretextMarkdownChunkFrame[]
  overscanPx: number
  scrollTop: number
  viewportHeight: number
}) {
  if (!frames.length) return []

  const minY = Math.max(0, scrollTop - overscanPx)
  const maxY = scrollTop + viewportHeight + overscanPx
  const start = firstChunkWithBottomAfter(frames, minY)
  const end = firstChunkWithTopAtOrAfter(frames, maxY)
  return frames.slice(start, Math.max(start, end))
}

export function markdownChunkIntersectsLineRange({
  chunk,
  range,
}: {
  chunk: Pick<PretextMarkdownChunk, "sourceEndLine" | "sourceStartLine">
  range: PretextMarkdownLineRange | null
}) {
  if (!range) return false
  return chunk.sourceStartLine <= range.end && chunk.sourceEndLine >= range.start
}

export function findPretextMarkdownChunkForLine(
  chunks: readonly PretextMarkdownChunk[],
  sourceLine: number
) {
  return chunks.find(
    (chunk) =>
      chunk.sourceStartLine <= sourceLine && chunk.sourceEndLine >= sourceLine
  )
}

export function findPretextMarkdownHeadingById(
  document: PretextMarkdownDocument,
  headingId: string
) {
  return document.headings.find((heading) => heading.id === headingId)
}

function createPretextMarkdownChunks(
  markdown: string,
  sourceLineCount: number
): Pick<PretextMarkdownDocument, "headings" | "chunks"> {
  const chunks: PretextMarkdownChunk[] = []
  const headings: PretextMarkdownHeading[] = []
  const headingIds: HeadingIdRegistry = new Map()
  const frontmatter = extractYamlFrontmatter(markdown)
  const body = frontmatter ? frontmatter.body : markdown
  const bodyStartLine = frontmatter ? frontmatter.endLine + 1 : 1

  if (frontmatter) {
    chunks.push({
      headingIds: [],
      index: chunks.length,
      kind: "frontmatter",
      markdown: frontmatter.text,
      sourceEndLine: frontmatter.endLine,
      sourceStartLine: 1,
    })
  }

  const bodyChunks = createMarkdownBodyChunks({
    headingIds,
    headings,
    markdown: body,
    sourceEndLine: sourceLineCount,
    sourceStartLine: bodyStartLine,
    startIndex: chunks.length,
  })
  chunks.push(...bodyChunks)

  if (!chunks.length) {
    chunks.push({
      headingIds: [],
      index: 0,
      kind: "markdown",
      markdown,
      sourceEndLine: sourceLineCount,
      sourceStartLine: 1,
    })
  }

  return { headings, chunks }
}

function createMarkdownBodyChunks({
  headingIds,
  headings,
  markdown,
  sourceEndLine,
  sourceStartLine,
  startIndex,
}: {
  headingIds: HeadingIdRegistry
  headings: PretextMarkdownHeading[]
  markdown: string
  sourceEndLine: number
  sourceStartLine: number
  startIndex: number
}) {
  const chunks: PretextMarkdownChunk[] = []
  if (!markdown.trim()) return chunks

  try {
    const tokens = marked.lexer(markdown, { gfm: true })
    let cursorLine = sourceStartLine
    let chunkStartLine = sourceStartLine
    let chunkHeadingIds: string[] = []
    let chunkRaw = ""
    let chunkLineCount = 0

    const flushChunk = (endLine: number) => {
      if (!chunkRaw.trim()) {
        chunkRaw = ""
        chunkLineCount = 0
        chunkStartLine = endLine + 1
        return
      }
      const chunkIndex = startIndex + chunks.length
      chunks.push({
        headingIds: chunkHeadingIds,
        index: chunkIndex,
        kind: "markdown",
        markdown: chunkRaw.replace(/\n+$/g, ""),
        sourceEndLine: Math.max(chunkStartLine, endLine),
        sourceStartLine: chunkStartLine,
      })
      chunkRaw = ""
      chunkLineCount = 0
      chunkHeadingIds = []
      chunkStartLine = endLine + 1
    }

    for (const token of tokens) {
      const raw = token.raw ?? ""
      const tokenBreaks = countLineBreaks(raw)
      const tokenStartLine = cursorLine
      const tokenEndLine = Math.min(
        sourceEndLine,
        Math.max(
          tokenStartLine,
          cursorLine + tokenBreaks - (raw.endsWith("\n") ? 1 : 0)
        )
      )
      cursorLine += tokenBreaks

      if (token.type === "space") {
        chunkRaw += raw
        chunkLineCount += tokenBreaks
        continue
      }

      const shouldStartNewChunk =
        chunkRaw.trim().length > 0 &&
        isChunkLeadToken(token) &&
        chunkLineCount >= MARKDOWN_CHUNK_TARGET_SOURCE_LINES
      const wouldExceedMax =
        chunkRaw.trim().length > 0 &&
        chunkLineCount + Math.max(1, tokenBreaks) >
          MARKDOWN_CHUNK_MAX_SOURCE_LINES

      if (shouldStartNewChunk || wouldExceedMax) {
        flushChunk(Math.max(chunkStartLine, tokenStartLine - 1))
        chunkStartLine = tokenStartLine
      }

      if (token.type === "heading") {
        const text = normalizeHeadingText(token.text)
        const id = createMarkdownHeadingId(text, headingIds)
        const chunkIndex = startIndex + chunks.length
        chunkHeadingIds.push(id)
        headings.push({
          id,
          chunkIndex,
          sourceLine: tokenStartLine,
          text,
        })
      }

      chunkRaw += raw
      chunkLineCount += Math.max(1, tokenBreaks)
      if (chunkLineCount >= MARKDOWN_CHUNK_MAX_SOURCE_LINES) {
        flushChunk(tokenEndLine)
      }
    }

    if (chunkRaw.trim()) {
      flushChunk(sourceEndLine)
    }
  } catch {
    chunks.push({
      headingIds: [],
      index: startIndex,
      kind: "markdown",
      markdown,
      sourceEndLine,
      sourceStartLine,
    })
  }

  return chunks
}

function estimatePretextMarkdownChunkHeight({
  fontScale,
  chunk,
  width,
}: {
  fontScale: number
  chunk: PretextMarkdownChunk
  width: number
}) {
  const textWidth = Math.max(1, width - CHUNK_PADDING_X * 2)
  const fontSize = chunk.kind === "frontmatter" ? 13 : 16
  const lineHeight =
    chunk.kind === "frontmatter" ? CODE_LINE_HEIGHT : BODY_LINE_HEIGHT
  const fontFamily =
    chunk.kind === "frontmatter" ? CODE_FONT_FAMILY : BODY_FONT_FAMILY
  const font = `${Math.round(fontSize * fontScale)}px ${fontFamily}`
  const prepared = prepareWithSegments(chunk.markdown || " ", font, {
    whiteSpace: "pre-wrap",
  })
  const stats = measureLineStats(prepared, textWidth / fontScale)
  const lineCount = Math.max(1, stats.lineCount)
  const syntaxAllowance = estimateMarkdownSyntaxAllowance(chunk)
  return Math.max(
    MIN_CHUNK_HEIGHT,
    CHUNK_PADDING_Y * 2 + lineCount * lineHeight * fontScale + syntaxAllowance
  )
}

function estimateMarkdownSyntaxAllowance(chunk: PretextMarkdownChunk) {
  if (chunk.kind === "frontmatter") return 0
  let allowance = 0
  for (const line of splitTextLines(chunk.markdown)) {
    if (/^#{1,6}\s+/.test(line)) allowance += 18
    if (/^\s*[-*+]\s+/.test(line)) allowance += 3
    if (/^\s*>/.test(line)) allowance += 4
    if (/^\s*\|.*\|\s*$/.test(line)) allowance += 8
    if (/^\s*```/.test(line)) allowance += 16
  }
  return allowance
}

function extractYamlFrontmatter(markdown: string) {
  const lines = splitTextLines(markdown)
  if (lines[0]?.trim() !== "---") return null

  for (let index = 1; index < lines.length; index++) {
    if (lines[index]!.trim() !== "---") continue
    if (index === 1) return null
    return {
      body: lines.slice(index + 1).join("\n"),
      endLine: index + 1,
      text: lines.slice(1, index).join("\n"),
    }
  }

  return null
}

function countLineBreaks(text: string) {
  if (!text) return 1
  return text.split(/\r\n|[\n\r\u2028\u2029]/).length
}

type HeadingIdRegistry = Map<string, number>

function createMarkdownHeadingId(text: string, headingIds: HeadingIdRegistry) {
  const base = slugifyMarkdownHeading(text) || "section"
  const count = headingIds.get(base) ?? 0
  headingIds.set(base, count + 1)
  return count === 0 ? base : `${base}-${count}`
}

function slugifyMarkdownHeading(text: string) {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}\s_-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function normalizeHeadingText(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

function isChunkLeadToken(token: Token) {
  return token.type === "heading" || token.type === "hr"
}

function firstChunkWithBottomAfter(
  frames: readonly PretextMarkdownChunkFrame[],
  y: number
) {
  let low = 0
  let high = frames.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (frames[mid]!.bottom > y) high = mid
    else low = mid + 1
  }
  return low
}

function firstChunkWithTopAtOrAfter(
  frames: readonly PretextMarkdownChunkFrame[],
  y: number
) {
  let low = 0
  let high = frames.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (frames[mid]!.top >= y) high = mid
    else low = mid + 1
  }
  return low
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}
