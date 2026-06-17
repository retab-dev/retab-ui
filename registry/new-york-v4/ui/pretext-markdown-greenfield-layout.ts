"use client"

import type {
  PretextMarkdownGreenfieldBlock,
  PretextMarkdownGreenfieldChunk,
  PretextMarkdownGreenfieldDocument,
} from "./pretext-markdown-greenfield-document"

const DOCUMENT_PADDING_Y = 32
const CHUNK_PADDING_X = 32
const MIN_CHUNK_HEIGHT = 64
// Tuned to the rendered typography (15.5px body at leading-relaxed ≈ 25px,
// 14px mono code at leading-5 = 20px) so estimates track measured heights and
// scroll correction stays minimal.
const BODY_LINE_HEIGHT = 25
const MONO_LINE_HEIGHT = 20
const APPROX_BODY_CHAR_WIDTH = 7.9
const APPROX_MONO_CHAR_WIDTH = 7.8
export const PRETEXT_MARKDOWN_GREENFIELD_LAYOUT_POLICY_VERSION =
  "greenfield-layout-rich-blocks-v3"
const LAYOUT_CACHE_LIMIT = 64

const pretextMarkdownGreenfieldLayoutDocumentIds = new WeakMap<
  PretextMarkdownGreenfieldDocument,
  number
>()
const pretextMarkdownGreenfieldLayoutCache = new Map<
  string,
  {
    document: PretextMarkdownGreenfieldDocument
    frame: PretextMarkdownGreenfieldFrame
  }
>()
let nextPretextMarkdownGreenfieldLayoutDocumentId = 1

export type PretextMarkdownGreenfieldFrame = {
  chunks: PretextMarkdownGreenfieldChunkFrame[]
  totalHeight: number
  width: number
}

export type PretextMarkdownGreenfieldChunkFrame = {
  bottom: number
  height: number
  id: string
  index: number
  measuredHeight: number | null
  sourceEndLine: number
  sourceStartLine: number
  top: number
}

export type PretextMarkdownGreenfieldMeasuredHeights = {
  get(
    chunk: PretextMarkdownGreenfieldChunk,
    context: PretextMarkdownGreenfieldMeasurementContext
  ): number | undefined
}

export type PretextMarkdownGreenfieldMeasurementContext = {
  fontScale: number
  policyVersion: string
  width: number
}

export function layoutPretextMarkdownGreenfieldDocument({
  contentWidth,
  document,
  fontScale,
  measuredHeights,
}: {
  contentWidth: number
  document: PretextMarkdownGreenfieldDocument
  fontScale: number
  measuredHeights?: PretextMarkdownGreenfieldMeasuredHeights
}): PretextMarkdownGreenfieldFrame {
  const width = Math.max(1, contentWidth)
  const context = {
    fontScale,
    policyVersion: PRETEXT_MARKDOWN_GREENFIELD_LAYOUT_POLICY_VERSION,
    width,
  }
  const measuredHeightByChunkId = readPretextMarkdownGreenfieldMeasuredHeights({
    context,
    document,
    measuredHeights,
  })
  const cacheKey = pretextMarkdownGreenfieldLayoutCacheKey({
    context,
    document,
    measuredHeightByChunkId,
  })
  const cached = pretextMarkdownGreenfieldLayoutCache.get(cacheKey)
  if (cached?.document === document) {
    pretextMarkdownGreenfieldLayoutCache.delete(cacheKey)
    pretextMarkdownGreenfieldLayoutCache.set(cacheKey, cached)
    return cached.frame
  }

  const blocksById = new Map(document.blocks.map((block) => [block.id, block]))
  const chunks: PretextMarkdownGreenfieldChunkFrame[] = []
  let y = DOCUMENT_PADDING_Y

  for (const chunk of document.chunks) {
    const estimatedHeight = estimatePretextMarkdownGreenfieldChunkHeight({
      blocks: chunk.blockIds
        .map((blockId) => blocksById.get(blockId))
        .filter((block): block is PretextMarkdownGreenfieldBlock =>
          Boolean(block)
        ),
      fontScale,
      width,
    })
    const measuredHeight = measuredHeightByChunkId.get(chunk.id) ?? null
    const height = Math.max(
      MIN_CHUNK_HEIGHT,
      measuredHeight == null ? estimatedHeight : measuredHeight
    )
    chunks.push({
      bottom: y + height,
      height,
      id: chunk.id,
      index: chunk.index,
      measuredHeight,
      sourceEndLine: chunk.sourceEndLine,
      sourceStartLine: chunk.sourceStartLine,
      top: y,
    })
    y += height
  }

  const frame = freezePretextMarkdownGreenfieldFrame({
    chunks,
    totalHeight: chunks.length ? y + DOCUMENT_PADDING_Y : 0,
    width,
  })
  pretextMarkdownGreenfieldLayoutCache.set(cacheKey, { document, frame })
  while (pretextMarkdownGreenfieldLayoutCache.size > LAYOUT_CACHE_LIMIT) {
    const oldestKey = pretextMarkdownGreenfieldLayoutCache.keys().next().value
    if (!oldestKey) break
    pretextMarkdownGreenfieldLayoutCache.delete(oldestKey)
  }
  return frame
}

function estimatePretextMarkdownGreenfieldChunkHeight({
  blocks,
  fontScale,
  width,
}: {
  blocks: readonly PretextMarkdownGreenfieldBlock[]
  fontScale: number
  width: number
}) {
  const textWidth = Math.max(1, width - CHUNK_PADDING_X * 2)
  const height = blocks.reduce(
    (sum, block) =>
      sum +
      estimatePretextMarkdownGreenfieldBlockHeight({
        block,
        fontScale,
        textWidth,
      }),
    0
  )
  return Math.max(MIN_CHUNK_HEIGHT, height)
}

function estimatePretextMarkdownGreenfieldBlockHeight({
  block,
  fontScale,
  textWidth,
}: {
  block: PretextMarkdownGreenfieldBlock
  fontScale: number
  textWidth: number
}) {
  if (block.kind === "thematicBreak") return 36 * fontScale
  if (block.kind === "frontmatter") {
    const lines = Math.max(
      1,
      block.sourceText.split(/\r\n|[\n\r\u2028\u2029]/).length
    )
    return (72 + lines * MONO_LINE_HEIGHT) * fontScale
  }
  if (block.kind === "footnotes")
    return estimateTextBlock(block, textWidth, fontScale, 0.9)
  if (block.kind === "heading") {
    return estimateTextBlock(block, textWidth, fontScale, 1.3) + 18 * fontScale
  }
  if (block.kind === "diagram") return 360 * fontScale
  if (block.kind === "math") return 120 * fontScale
  if (block.kind === "component") return 160 * fontScale
  if (block.kind === "code") {
    const lines = Math.max(
      1,
      block.sourceText.split(/\r\n|[\n\r\u2028\u2029]/).length
    )
    return 48 * fontScale + lines * MONO_LINE_HEIGHT * fontScale
  }
  if (block.kind === "table") {
    const rows = Math.max(2, (block.sourceText.match(/\n/g)?.length ?? 1) + 1)
    return (48 + rows * 36) * fontScale
  }
  if (block.kind === "image") return 280 * fontScale
  if (block.isHostile) return 420 * fontScale
  return estimateTextBlock(block, textWidth, fontScale, 1)
}

function estimateTextBlock(
  block: PretextMarkdownGreenfieldBlock,
  textWidth: number,
  fontScale: number,
  multiplier: number
) {
  const text = block.sourceText || " "
  const charWidth =
    block.kind === "code" ? APPROX_MONO_CHAR_WIDTH : APPROX_BODY_CHAR_WIDTH
  const columns = Math.max(12, Math.floor(textWidth / (charWidth * fontScale)))
  const sourceLines = text.split(/\r\n|[\n\r\u2028\u2029]/)
  const visualLines = sourceLines.reduce(
    (sum, line) => sum + Math.max(1, Math.ceil(line.length / columns)),
    0
  )
  return (
    16 * fontScale + visualLines * BODY_LINE_HEIGHT * fontScale * multiplier
  )
}

function readPretextMarkdownGreenfieldMeasuredHeights({
  context,
  document,
  measuredHeights,
}: {
  context: PretextMarkdownGreenfieldMeasurementContext
  document: PretextMarkdownGreenfieldDocument
  measuredHeights?: PretextMarkdownGreenfieldMeasuredHeights
}) {
  const measuredHeightByChunkId = new Map<string, number>()
  if (!measuredHeights) return measuredHeightByChunkId

  for (const chunk of document.chunks) {
    const measuredHeight = measuredHeights.get(chunk, context)
    if (
      typeof measuredHeight === "number" &&
      Number.isFinite(measuredHeight) &&
      measuredHeight > 0
    ) {
      measuredHeightByChunkId.set(chunk.id, measuredHeight)
    }
  }
  return measuredHeightByChunkId
}

function pretextMarkdownGreenfieldLayoutCacheKey({
  context,
  document,
  measuredHeightByChunkId,
}: {
  context: PretextMarkdownGreenfieldMeasurementContext
  document: PretextMarkdownGreenfieldDocument
  measuredHeightByChunkId: ReadonlyMap<string, number>
}) {
  return [
    pretextMarkdownGreenfieldLayoutDocumentId(document),
    Math.round(context.width * 100) / 100,
    context.fontScale.toFixed(4),
    context.policyVersion,
    document.chunks
      .map((chunk) => {
        const measuredHeight = measuredHeightByChunkId.get(chunk.id)
        return `${chunk.id}:${measuredHeight == null ? "-" : measuredHeight.toFixed(2)}`
      })
      .join("|"),
  ].join(":")
}

function pretextMarkdownGreenfieldLayoutDocumentId(
  document: PretextMarkdownGreenfieldDocument
) {
  const existing = pretextMarkdownGreenfieldLayoutDocumentIds.get(document)
  if (existing) return existing
  const next = nextPretextMarkdownGreenfieldLayoutDocumentId++
  pretextMarkdownGreenfieldLayoutDocumentIds.set(document, next)
  return next
}

function freezePretextMarkdownGreenfieldFrame(
  frame: PretextMarkdownGreenfieldFrame
) {
  for (const chunk of frame.chunks) Object.freeze(chunk)
  Object.freeze(frame.chunks)
  return Object.freeze(frame)
}
