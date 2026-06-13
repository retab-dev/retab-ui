import { measureLineStats, prepareWithSegments } from "@chenglou/pretext"

import type {
  MarkdownDocument,
  MarkdownDocumentBlock,
  MarkdownDocumentBlockKind,
  MarkdownDocumentChunk,
} from "./markdown-document-model"
import { splitTextLines } from "./text-viewer-resource"

export const MARKDOWN_DOCUMENT_COLUMN_WIDTH = 768
export const MARKDOWN_DOCUMENT_CHUNK_PADDING_X = 36
export const MARKDOWN_DOCUMENT_CHUNK_PADDING_Y = 28
export const MARKDOWN_DOCUMENT_TARGET_CHUNK_HEIGHT = 980
export const MARKDOWN_DOCUMENT_MIN_CHUNK_HEIGHT = 220
export const MARKDOWN_DOCUMENT_MAX_ESTIMATED_CHUNK_HEIGHT = 2200

const MARKDOWN_DOCUMENT_BODY_FONT =
  '14px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const MARKDOWN_DOCUMENT_CODE_FONT =
  '13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'
const MARKDOWN_DOCUMENT_STYLE_VERSION = "markdown-document-layout-v1"

export type MarkdownDocumentLayoutStyle = {
  blockSpacing: number
  bodyFont: string
  bodyLineHeight: number
  codeFont: string
  codeLineHeight: number
  contentWidth: number
  pagePaddingX: number
  pagePaddingY: number
  styleVersion: string
  zoom: number
}

export function createMarkdownLayoutStyle({
  contentWidth = MARKDOWN_DOCUMENT_COLUMN_WIDTH,
  zoom = 1,
}: {
  contentWidth?: number
  zoom?: number
} = {}): MarkdownDocumentLayoutStyle {
  return {
    blockSpacing: 14 * zoom,
    bodyFont: MARKDOWN_DOCUMENT_BODY_FONT,
    bodyLineHeight: 26 * zoom,
    codeFont: MARKDOWN_DOCUMENT_CODE_FONT,
    codeLineHeight: 22 * zoom,
    contentWidth: Math.max(1, contentWidth),
    pagePaddingX: MARKDOWN_DOCUMENT_CHUNK_PADDING_X * zoom,
    pagePaddingY: MARKDOWN_DOCUMENT_CHUNK_PADDING_Y * zoom,
    styleVersion: MARKDOWN_DOCUMENT_STYLE_VERSION,
    zoom,
  }
}

export function estimateMarkdownBlockHeight(
  block: Pick<MarkdownDocumentBlock, "kind" | "markdown">,
  style: MarkdownDocumentLayoutStyle
) {
  switch (block.kind) {
    case "heading":
      return (
        estimateFlowTextHeight(block.markdown, style, 1.25) + 18 * style.zoom
      )
    case "rule":
      return 34 * style.zoom
    case "code":
      return estimateCodeHeight(block.markdown, style)
    case "callout":
      return Math.max(
        96 * style.zoom,
        estimateFlowTextHeight(stripMarkdownSyntax(block.markdown), style, 1) +
          44 * style.zoom
      )
    case "math":
      return Math.max(
        86 * style.zoom,
        countRawLines(block.markdown) * 28 * style.zoom + 42 * style.zoom
      )
    case "table":
      return estimateTableHeight(block.markdown, style)
    case "image":
      return 260 * style.zoom
    case "list":
      return Math.max(
        72 * style.zoom,
        estimateFlowTextHeight(stripMarkdownSyntax(block.markdown), style, 1) +
          24 * style.zoom
      )
    case "blockquote":
      return Math.max(
        72 * style.zoom,
        estimateFlowTextHeight(stripMarkdownSyntax(block.markdown), style, 1) +
          24 * style.zoom
      )
    case "html":
      return Math.max(
        56 * style.zoom,
        countRawLines(block.markdown) * 24 * style.zoom + 20 * style.zoom
      )
    case "paragraph":
      return (
        estimateFlowTextHeight(stripMarkdownSyntax(block.markdown), style, 1) +
        24 * style.zoom
      )
  }
}

export function estimateMarkdownChunkHeight(
  chunk: MarkdownDocumentChunk,
  style: MarkdownDocumentLayoutStyle
) {
  return clampMarkdownChunkHeight(
    style.pagePaddingY * 2 +
      chunk.blocks.reduce(
        (height, block) =>
          height +
          estimateMarkdownBlockHeight(block, style) +
          style.blockSpacing,
        0
      )
  )
}

export function createMarkdownChunkEstimates(
  document: MarkdownDocument,
  style: MarkdownDocumentLayoutStyle
) {
  return document.chunks.map((chunk) => estimateMarkdownChunkHeight(chunk, style))
}

export function createEstimatedMarkdownBlock({
  kind,
  markdown,
}: {
  kind: MarkdownDocumentBlockKind
  markdown: string
}) {
  return {
    estimatedHeight: estimateMarkdownBlockHeight(
      { kind, markdown },
      createMarkdownLayoutStyle()
    ),
    isHostile: isHostileMarkdownBlock({ kind, markdown }),
  }
}

export function chunkChromeHeight() {
  return MARKDOWN_DOCUMENT_CHUNK_PADDING_Y * 2
}

export function clampMarkdownChunkHeight(height: number) {
  return Math.min(
    MARKDOWN_DOCUMENT_MAX_ESTIMATED_CHUNK_HEIGHT,
    Math.max(MARKDOWN_DOCUMENT_MIN_CHUNK_HEIGHT, height)
  )
}

export function isHostileMarkdownBlock({
  kind,
  markdown,
}: Pick<MarkdownDocumentBlock, "kind" | "markdown">) {
  const lineCount = countRawLines(markdown)

  switch (kind) {
    case "code":
      return lineCount > 400
    case "table":
      return Math.max(0, lineCount - 2) > 200
    case "paragraph":
      return markdown.length > 20_000
    case "list":
      return lineCount > 500
    case "html":
      return markdown.length > 20_000
    default:
      return false
  }
}

function estimateFlowTextHeight(
  markdown: string,
  style: MarkdownDocumentLayoutStyle,
  lineHeightMultiplier: number
) {
  const text = markdown.replace(/\s+/g, " ").trim() || " "
  const width = Math.max(1, style.contentWidth - style.pagePaddingX * 2)
  const lineHeight = style.bodyLineHeight * lineHeightMultiplier
  return (
    measurePretextLineCount({
      fallbackText: text,
      font: style.bodyFont,
      text,
      width,
    }) * lineHeight
  )
}

function estimateCodeHeight(
  markdown: string,
  style: MarkdownDocumentLayoutStyle
) {
  const code = fencedCodeBody(markdown)
  const width = Math.max(1, style.contentWidth - style.pagePaddingX * 2 - 32)
  return (
    Math.max(
      1,
      measurePretextLineCount({
        fallbackText: code,
        font: style.codeFont,
        text: code || " ",
        whiteSpace: "pre-wrap",
        width,
      })
    ) *
      style.codeLineHeight +
    58 * style.zoom
  )
}

function estimateTableHeight(
  markdown: string,
  style: MarkdownDocumentLayoutStyle
) {
  const rowCount = Math.max(1, countRawLines(markdown) - 2)
  return Math.max(96 * style.zoom, 48 * style.zoom + rowCount * 36 * style.zoom)
}

function measurePretextLineCount({
  fallbackText,
  font,
  text,
  whiteSpace,
  width,
}: {
  fallbackText: string
  font: string
  text: string
  whiteSpace?: "pre-wrap"
  width: number
}) {
  if (isJsdomRuntime()) return estimateLineCount(fallbackText, width)

  try {
    const prepared = prepareWithSegments(text, font, { whiteSpace })
    return Math.max(1, measureLineStats(prepared, Math.max(1, width)).lineCount)
  } catch {
    return estimateLineCount(fallbackText, width)
  }
}

function isJsdomRuntime() {
  return (
    globalThis.navigator?.userAgent.toLowerCase().includes("jsdom") ?? false
  )
}

function estimateLineCount(text: string, width: number) {
  const columns = Math.max(1, Math.floor(width / 8))
  return splitTextLines(text || " ").reduce(
    (sum, line) => sum + Math.max(1, Math.ceil((line || " ").length / columns)),
    0
  )
}

function stripMarkdownSyntax(markdown: string) {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^:::\w+(?:\{[^}]*\})?/gm, "")
    .replace(/^:::\s*$/gm, "")
    .replace(/[`*_~[\]()!>#|-]/g, " ")
}

function fencedCodeBody(markdown: string) {
  const lines = splitTextLines(markdown)
  if (lines.length >= 2 && /^```/.test(lines[0] ?? "")) {
    return lines.slice(1, -1).join("\n").replace(/\n$/, "")
  }
  return markdown.replace(/\n$/, "")
}

function countRawLines(raw: string) {
  return splitTextLines(raw.replace(/\r?\n$/, "")).length
}
