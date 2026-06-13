"use client"

import { measureLineStats, prepareWithSegments } from "@chenglou/pretext"
import { marked, type Token } from "marked"

import { splitTextLines } from "./text-viewer-resource"

const MARKDOWN_PAGE_TARGET_SOURCE_LINES = 36
const MARKDOWN_PAGE_MAX_SOURCE_LINES = 54
const DOCUMENT_PADDING_Y = 48
const PAGE_GAP = 28
const PAGE_PADDING_X = 48
const PAGE_PADDING_Y = 40
const BODY_LINE_HEIGHT = 24
const CODE_LINE_HEIGHT = 21
const MIN_PAGE_HEIGHT = 120
const BODY_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const CODE_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'

export type PretextMarkdownPageKind = "frontmatter" | "markdown"

export interface PretextMarkdownDocument {
  headings: PretextMarkdownHeading[]
  pages: PretextMarkdownPage[]
  sourceLineCount: number
  text: string
  wordCount: number
}

export interface PretextMarkdownHeading {
  id: string
  pageIndex: number
  sourceLine: number
  text: string
}

export interface PretextMarkdownPage {
  headingIds: string[]
  index: number
  kind: PretextMarkdownPageKind
  markdown: string
  sourceEndLine: number
  sourceStartLine: number
}

export interface PretextMarkdownDocumentFrame {
  pages: PretextMarkdownPageFrame[]
  totalHeight: number
  width: number
}

export interface PretextMarkdownPageFrame {
  bottom: number
  estimatedHeight: number
  height: number
  index: number
  kind: PretextMarkdownPageKind
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
  const { headings, pages } = createPretextMarkdownPages(
    markdown,
    sourceLineCount
  )

  return {
    headings,
    pages,
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
  const frames: PretextMarkdownPageFrame[] = []
  let y = DOCUMENT_PADDING_Y

  for (const page of document.pages) {
    const measuredHeight = measuredHeights?.get(page.index)
    const estimatedHeight = estimatePretextMarkdownPageHeight({
      fontScale,
      page,
      width,
    })
    const height =
      measuredHeight == null
        ? estimatedHeight
        : Math.max(MIN_PAGE_HEIGHT, measuredHeight)
    const frame: PretextMarkdownPageFrame = {
      bottom: y + height,
      estimatedHeight,
      height,
      index: page.index,
      kind: page.kind,
      measuredHeight: measuredHeight ?? null,
      sourceEndLine: page.sourceEndLine,
      sourceStartLine: page.sourceStartLine,
      top: y,
    }
    frames.push(frame)
    y = frame.bottom + PAGE_GAP
  }

  return {
    pages: frames,
    totalHeight: frames.length ? y - PAGE_GAP + DOCUMENT_PADDING_Y : 0,
    width,
  }
}

export function getPretextMarkdownVisiblePageFrames({
  frames,
  overscanPx,
  scrollTop,
  viewportHeight,
}: {
  frames: readonly PretextMarkdownPageFrame[]
  overscanPx: number
  scrollTop: number
  viewportHeight: number
}) {
  if (!frames.length) return []

  const minY = Math.max(0, scrollTop - overscanPx)
  const maxY = scrollTop + viewportHeight + overscanPx
  const start = firstPageWithBottomAfter(frames, minY)
  const end = firstPageWithTopAtOrAfter(frames, maxY)
  return frames.slice(start, Math.max(start, end))
}

export function markdownPageIntersectsLineRange({
  page,
  range,
}: {
  page: Pick<PretextMarkdownPage, "sourceEndLine" | "sourceStartLine">
  range: PretextMarkdownLineRange | null
}) {
  if (!range) return false
  return page.sourceStartLine <= range.end && page.sourceEndLine >= range.start
}

export function findPretextMarkdownPageForLine(
  pages: readonly PretextMarkdownPage[],
  sourceLine: number
) {
  return pages.find(
    (page) =>
      page.sourceStartLine <= sourceLine && page.sourceEndLine >= sourceLine
  )
}

export function findPretextMarkdownHeadingById(
  document: PretextMarkdownDocument,
  headingId: string
) {
  return document.headings.find((heading) => heading.id === headingId)
}

function createPretextMarkdownPages(
  markdown: string,
  sourceLineCount: number
): Pick<PretextMarkdownDocument, "headings" | "pages"> {
  const pages: PretextMarkdownPage[] = []
  const headings: PretextMarkdownHeading[] = []
  const headingIds: HeadingIdRegistry = new Map()
  const frontmatter = extractYamlFrontmatter(markdown)
  const body = frontmatter ? frontmatter.body : markdown
  const bodyStartLine = frontmatter ? frontmatter.endLine + 1 : 1

  if (frontmatter) {
    pages.push({
      headingIds: [],
      index: pages.length,
      kind: "frontmatter",
      markdown: frontmatter.text,
      sourceEndLine: frontmatter.endLine,
      sourceStartLine: 1,
    })
  }

  const bodyPages = createMarkdownBodyPages({
    headingIds,
    headings,
    markdown: body,
    sourceEndLine: sourceLineCount,
    sourceStartLine: bodyStartLine,
    startIndex: pages.length,
  })
  pages.push(...bodyPages)

  if (!pages.length) {
    pages.push({
      headingIds: [],
      index: 0,
      kind: "markdown",
      markdown,
      sourceEndLine: sourceLineCount,
      sourceStartLine: 1,
    })
  }

  return { headings, pages }
}

function createMarkdownBodyPages({
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
  const pages: PretextMarkdownPage[] = []
  if (!markdown.trim()) return pages

  try {
    const tokens = marked.lexer(markdown, { gfm: true })
    let cursorLine = sourceStartLine
    let pageStartLine = sourceStartLine
    let pageHeadingIds: string[] = []
    let pageRaw = ""
    let pageLineCount = 0

    const flushPage = (endLine: number) => {
      if (!pageRaw.trim()) {
        pageRaw = ""
        pageLineCount = 0
        pageStartLine = endLine + 1
        return
      }
      const pageIndex = startIndex + pages.length
      pages.push({
        headingIds: pageHeadingIds,
        index: pageIndex,
        kind: "markdown",
        markdown: pageRaw.replace(/\n+$/g, ""),
        sourceEndLine: Math.max(pageStartLine, endLine),
        sourceStartLine: pageStartLine,
      })
      pageRaw = ""
      pageLineCount = 0
      pageHeadingIds = []
      pageStartLine = endLine + 1
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
        pageRaw += raw
        pageLineCount += tokenBreaks
        continue
      }

      const shouldStartNewPage =
        pageRaw.trim().length > 0 &&
        isPageLeadToken(token) &&
        pageLineCount >= MARKDOWN_PAGE_TARGET_SOURCE_LINES
      const wouldExceedMax =
        pageRaw.trim().length > 0 &&
        pageLineCount + Math.max(1, tokenBreaks) >
          MARKDOWN_PAGE_MAX_SOURCE_LINES

      if (shouldStartNewPage || wouldExceedMax) {
        flushPage(Math.max(pageStartLine, tokenStartLine - 1))
        pageStartLine = tokenStartLine
      }

      if (token.type === "heading") {
        const text = normalizeHeadingText(token.text)
        const id = createMarkdownHeadingId(text, headingIds)
        const pageIndex = startIndex + pages.length
        pageHeadingIds.push(id)
        headings.push({
          id,
          pageIndex,
          sourceLine: tokenStartLine,
          text,
        })
      }

      pageRaw += raw
      pageLineCount += Math.max(1, tokenBreaks)
      if (pageLineCount >= MARKDOWN_PAGE_MAX_SOURCE_LINES) {
        flushPage(tokenEndLine)
      }
    }

    if (pageRaw.trim()) {
      flushPage(sourceEndLine)
    }
  } catch {
    pages.push({
      headingIds: [],
      index: startIndex,
      kind: "markdown",
      markdown,
      sourceEndLine,
      sourceStartLine,
    })
  }

  return pages
}

function estimatePretextMarkdownPageHeight({
  fontScale,
  page,
  width,
}: {
  fontScale: number
  page: PretextMarkdownPage
  width: number
}) {
  const textWidth = Math.max(1, width - PAGE_PADDING_X * 2)
  const fontSize = page.kind === "frontmatter" ? 13 : 16
  const lineHeight =
    page.kind === "frontmatter" ? CODE_LINE_HEIGHT : BODY_LINE_HEIGHT
  const fontFamily =
    page.kind === "frontmatter" ? CODE_FONT_FAMILY : BODY_FONT_FAMILY
  const font = `${Math.round(fontSize * fontScale)}px ${fontFamily}`
  const prepared = prepareWithSegments(page.markdown || " ", font, {
    whiteSpace: "pre-wrap",
  })
  const stats = measureLineStats(prepared, textWidth / fontScale)
  const lineCount = Math.max(1, stats.lineCount)
  const syntaxAllowance = estimateMarkdownSyntaxAllowance(page)
  return Math.max(
    MIN_PAGE_HEIGHT,
    PAGE_PADDING_Y * 2 + lineCount * lineHeight * fontScale + syntaxAllowance
  )
}

function estimateMarkdownSyntaxAllowance(page: PretextMarkdownPage) {
  if (page.kind === "frontmatter") return 0
  let allowance = 0
  for (const line of splitTextLines(page.markdown)) {
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

function isPageLeadToken(token: Token) {
  return token.type === "heading" || token.type === "hr"
}

function firstPageWithBottomAfter(
  frames: readonly PretextMarkdownPageFrame[],
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

function firstPageWithTopAtOrAfter(
  frames: readonly PretextMarkdownPageFrame[],
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
