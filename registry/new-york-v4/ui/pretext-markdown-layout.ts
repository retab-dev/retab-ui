"use client"

import {
  measureLineStats,
  prepareWithSegments,
  type PreparedTextWithSegments,
} from "@chenglou/pretext"

import type {
  PretextMarkdownBlock,
  PretextMarkdownChunk,
  PretextMarkdownChunkKind,
  PretextMarkdownDocument,
} from "./pretext-markdown-document-model"
import { splitTextLines } from "./text-viewer-resource"

const DOCUMENT_PADDING_Y = 32
const CHUNK_GAP = 0
const CHUNK_PADDING_X = 48
const CHUNK_PADDING_Y = 0
const BODY_LINE_HEIGHT = 24
const CODE_LINE_HEIGHT = 21
const BLOCK_GAP = 8
const MIN_CHUNK_HEIGHT = 120
const COMPONENT_FALLBACK_MIN_HEIGHT = 112
const BODY_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const CODE_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'

export interface PretextMarkdownDocumentFrame {
  chunks: PretextMarkdownChunkFrame[]
  totalHeight: number
  width: number
}

export interface PretextMarkdownChunkFrame {
  blockIds: string[]
  bottom: number
  estimatedHeight: number
  height: number
  index: number
  isHostile: boolean
  kind: PretextMarkdownChunkKind
  measuredHeight: number | null
  sourceEndLine: number
  sourceStartLine: number
  top: number
}

export interface PretextMarkdownMeasuredHeights {
  get(index: number): number | undefined
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
  const blocksById = new Map(
    document.blocks.map((block) => [block.id, block] as const)
  )
  const frames: PretextMarkdownChunkFrame[] = []
  let y = DOCUMENT_PADDING_Y

  for (const chunk of document.chunks) {
    const measuredHeight = measuredHeights?.get(chunk.index)
    const estimatedHeight = estimatePretextMarkdownChunkHeight({
      blocksById,
      fontScale,
      chunk,
      width,
    })
    const height =
      measuredHeight == null
        ? estimatedHeight
        : Math.max(MIN_CHUNK_HEIGHT, measuredHeight)
    const frame: PretextMarkdownChunkFrame = {
      blockIds: chunk.blockIds,
      bottom: y + height,
      estimatedHeight,
      height,
      index: chunk.index,
      isHostile: chunk.isHostile,
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

export function estimatePretextMarkdownChunkHeight({
  blocksById,
  fontScale,
  chunk,
  width,
}: {
  blocksById?: ReadonlyMap<string, PretextMarkdownBlock>
  fontScale: number
  chunk: PretextMarkdownChunk
  width: number
}) {
  const textWidth = Math.max(1, width - CHUNK_PADDING_X * 2)
  const blocks = chunk.blockIds
    .map((blockId) => blocksById?.get(blockId))
    .filter((block): block is PretextMarkdownBlock => Boolean(block))

  if (blocks.length > 0) {
    return estimatePretextMarkdownBlocksHeight({
      blocks,
      fontScale,
      textWidth,
    })
  }

  if (chunk.isHostile) {
    return estimateHostilePretextMarkdownChunkHeight({
      chunk,
      fontScale,
      textWidth,
    })
  }

  const fontSize = chunk.kind === "frontmatter" ? 13 : 16
  const lineHeight =
    chunk.kind === "frontmatter" ? CODE_LINE_HEIGHT : BODY_LINE_HEIGHT
  const fontFamily =
    chunk.kind === "frontmatter" ? CODE_FONT_FAMILY : BODY_FONT_FAMILY
  const font = `${Math.round(fontSize * fontScale)}px ${fontFamily}`
  const fallbackText = chunk.markdown || " "
  const prepared = prepareWithSegmentsSafe(fallbackText, font, {
    whiteSpace: "pre-wrap",
  })
  const stats = prepared
    ? measureLineStatsSafe(prepared, textWidth / fontScale, fallbackText)
    : estimatePretextMarkdownLineStats(fallbackText, textWidth / fontScale)
  const lineCount = Math.max(1, stats.lineCount)
  const syntaxAllowance = estimateMarkdownSyntaxAllowance(chunk)
  return Math.max(
    MIN_CHUNK_HEIGHT,
    CHUNK_PADDING_Y * 2 + lineCount * lineHeight * fontScale + syntaxAllowance
  )
}

function estimatePretextMarkdownBlocksHeight({
  blocks,
  fontScale,
  textWidth,
}: {
  blocks: readonly PretextMarkdownBlock[]
  fontScale: number
  textWidth: number
}) {
  const visibleBlocks = blocks.filter(isVisiblePretextMarkdownBlock)
  if (!visibleBlocks.length) return 0

  const height = visibleBlocks.reduce(
    (sum, block, index) =>
      sum +
      estimatePretextMarkdownBlockHeight({
        block,
        fontScale,
        textWidth,
      }) +
      (index === visibleBlocks.length - 1 ? 0 : BLOCK_GAP * fontScale),
    CHUNK_PADDING_Y * 2
  )
  return Math.max(MIN_CHUNK_HEIGHT, height)
}

export function estimatePretextMarkdownBlockHeight({
  block,
  fontScale,
  textWidth,
}: {
  block: PretextMarkdownBlock
  fontScale: number
  textWidth: number
}) {
  if (block.kind === "comment" || block.kind === "definition") return 0

  if (block.isHostile) {
    return estimateHostilePretextMarkdownBlockHeight({
      block,
      fontScale,
      textWidth,
    })
  }

  if (isPretextMarkdownComponentLikeBlock(block)) {
    return estimatePretextMarkdownComponentFallbackBlockHeight({
      block,
      fontScale,
      textWidth,
    })
  }

  if (isPretextMarkdownMermaidCodeBlock(block)) {
    return (
      (36 +
        estimatePretextMarkdownDiagramBodyHeight(
          extractPretextMarkdownFenceBody(block.markdown)
        ) +
        40) *
      fontScale
    )
  }

  const fontSize = pretextMarkdownBlockFontSize(block)
  const lineHeight = pretextMarkdownBlockLineHeight(block)
  const fontFamily = pretextMarkdownBlockFontFamily(block)
  const font = `${Math.round(fontSize * fontScale)}px ${fontFamily}`
  const fallbackText = block.markdown || " "
  const prepared = prepareWithSegmentsSafe(fallbackText, font, {
    whiteSpace: "pre-wrap",
  })
  const stats = prepared
    ? measureLineStatsSafe(prepared, textWidth / fontScale, fallbackText)
    : estimatePretextMarkdownLineStats(fallbackText, textWidth / fontScale)
  const lineCount = Math.max(1, stats.lineCount)
  return (
    lineCount * lineHeight * fontScale +
    estimatePretextMarkdownBlockSyntaxAllowance(block, fontScale)
  )
}

function estimateHostilePretextMarkdownChunkHeight({
  chunk,
  fontScale,
  textWidth,
}: {
  chunk: PretextMarkdownChunk
  fontScale: number
  textWidth: number
}) {
  const lines = splitTextLines(chunk.markdown || " ")
  const longestLineLength = lines.reduce(
    (maxLength, line) => Math.max(maxLength, line.length),
    1
  )
  const estimatedWrappedLines = Math.max(
    lines.length,
    Math.ceil((longestLineLength * 8 * fontScale) / Math.max(1, textWidth))
  )
  const syntaxAllowance = estimateMarkdownSyntaxAllowance(chunk)

  return Math.max(
    MIN_CHUNK_HEIGHT,
    CHUNK_PADDING_Y * 2 +
      estimatedWrappedLines * BODY_LINE_HEIGHT * fontScale +
      syntaxAllowance
  )
}

function estimateHostilePretextMarkdownBlockHeight({
  block,
  fontScale,
  textWidth,
}: {
  block: PretextMarkdownBlock
  fontScale: number
  textWidth: number
}) {
  const lines = splitTextLines(block.markdown || " ")
  const longestLineLength = lines.reduce(
    (maxLength, line) => Math.max(maxLength, line.length),
    1
  )
  const estimatedWrappedLines = Math.max(
    lines.length,
    Math.ceil((longestLineLength * 8 * fontScale) / Math.max(1, textWidth))
  )

  return (
    estimatedWrappedLines * pretextMarkdownBlockLineHeight(block) * fontScale +
    estimatePretextMarkdownBlockSyntaxAllowance(block, fontScale)
  )
}

function isPretextMarkdownMermaidCodeBlock(block: PretextMarkdownBlock) {
  if (block.kind !== "code") return false
  const openingFence = splitTextLines(block.markdown)[0] ?? ""
  const language = openingFence
    .replace(/^`{3,}|^~{3,}/, "")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
  return (
    language === "mermaid" || language === "mmd" || language === "mermaid-js"
  )
}

function extractPretextMarkdownFenceBody(markdown: string) {
  const lines = splitTextLines(markdown)
  if (lines.length <= 2) return ""
  return lines.slice(1, -1).join("\n")
}

function estimatePretextMarkdownDiagramBodyHeight(source: string) {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%%"))
  const header = lines[0]?.match(/^(?:graph|flowchart)\s+(TD|TB|BT|LR|RL)$/i)

  if (header) {
    const nodeIds = new Set<string>()
    for (const line of lines.slice(1)) {
      const edge = line.match(/^(.+?)\s*(?:-->|---|==>|-.->)\s*(.+?)$/)
      if (!edge) continue
      nodeIds.add(parsePretextMarkdownMermaidNodeId(edge[1]!))
      nodeIds.add(parsePretextMarkdownMermaidNodeId(edge[2]!))
    }

    const direction = header[1]!.toUpperCase()
    if (direction === "LR" || direction === "RL") return 160

    const nodeCount = Math.max(2, nodeIds.size)
    return clampPretextMarkdownDiagramBodyHeight(
      nodeCount * 42 + Math.max(0, nodeCount - 1) * 56 + 48
    )
  }

  return clampPretextMarkdownDiagramBodyHeight(lines.length * 28 + 96)
}

function parsePretextMarkdownMermaidNodeId(value: string) {
  const trimmed = value.trim()
  const match =
    trimmed.match(/^([A-Za-z0-9_-]+)\s*\[".+"]$/) ??
    trimmed.match(/^([A-Za-z0-9_-]+)\s*\[.+]$/) ??
    trimmed.match(/^([A-Za-z0-9_-]+)\s*\(.+\)$/)
  if (match) return match[1]!

  return trimmed.replace(/[^A-Za-z0-9_-].*$/, "") || trimmed
}

function clampPretextMarkdownDiagramBodyHeight(height: number) {
  return Math.min(520, Math.max(160, Math.ceil(height)))
}

function estimatePretextMarkdownComponentFallbackBlockHeight({
  block,
  fontScale,
  textWidth,
}: {
  block: PretextMarkdownBlock
  fontScale: number
  textWidth: number
}) {
  const font = `${Math.round(13 * fontScale)}px ${CODE_FONT_FAMILY}`
  const prepared = prepareWithSegmentsSafe(block.markdown || " ", font, {
    whiteSpace: "pre-wrap",
  })
  const stats = prepared
    ? measureLineStatsSafe(prepared, textWidth / fontScale, block.markdown)
    : estimatePretextMarkdownLineStats(block.markdown, textWidth / fontScale)
  const sourceLineCount = Math.max(1, stats.lineCount)

  return Math.max(
    COMPONENT_FALLBACK_MIN_HEIGHT * fontScale,
    64 * fontScale + sourceLineCount * CODE_LINE_HEIGHT * fontScale
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

function pretextMarkdownBlockFontSize(block: PretextMarkdownBlock) {
  return isPretextMarkdownCodeLikeBlock(block) ? 13 : 16
}

function pretextMarkdownBlockLineHeight(block: PretextMarkdownBlock) {
  return isPretextMarkdownCodeLikeBlock(block)
    ? CODE_LINE_HEIGHT
    : BODY_LINE_HEIGHT
}

function pretextMarkdownBlockFontFamily(block: PretextMarkdownBlock) {
  return isPretextMarkdownCodeLikeBlock(block)
    ? CODE_FONT_FAMILY
    : BODY_FONT_FAMILY
}

function isPretextMarkdownCodeLikeBlock(block: PretextMarkdownBlock) {
  return (
    block.kind === "code" ||
    block.kind === "frontmatter" ||
    block.kind === "html"
  )
}

function isPretextMarkdownComponentLikeBlock(block: PretextMarkdownBlock) {
  return (
    block.kind === "html" &&
    /^<\/?[A-Z][A-Za-z0-9.]*(?:\s|\/?>)/.test(block.markdown.trim())
  )
}

function isVisiblePretextMarkdownBlock(block: PretextMarkdownBlock) {
  return block.kind !== "comment" && block.kind !== "definition"
}

function estimatePretextMarkdownBlockSyntaxAllowance(
  block: PretextMarkdownBlock,
  fontScale: number
) {
  switch (block.kind) {
    case "code":
    case "html":
      return 32 * fontScale
    case "frontmatter":
      return 24 * fontScale
    case "heading":
      return 36 * fontScale
    case "list":
      return 12 * fontScale
    case "table":
      return splitTextLines(block.markdown).length * 8 * fontScale
    case "thematicBreak":
      return 28 * fontScale
    default:
      return 0
  }
}

function prepareWithSegmentsSafe(
  text: string,
  font: string,
  options?: Parameters<typeof prepareWithSegments>[2]
) {
  try {
    return prepareWithSegments(text, font, options)
  } catch {
    return null
  }
}

function measureLineStatsSafe(
  prepared: PreparedTextWithSegments,
  width: number,
  fallbackText: string
) {
  try {
    return measureLineStats(prepared, width)
  } catch {
    return estimatePretextMarkdownLineStats(fallbackText, width)
  }
}

function estimatePretextMarkdownLineStats(text: string, width: number) {
  const columns = Math.max(1, Math.floor(width / 8))
  const lines = splitTextLines(text || " ")
  const lineCount = lines.reduce(
    (sum, line) => sum + Math.max(1, Math.ceil((line || " ").length / columns)),
    0
  )
  const maxLineWidth = Math.min(
    width,
    Math.max(...lines.map((line) => (line || " ").length * 8), 1)
  )
  return { lineCount, maxLineWidth }
}
