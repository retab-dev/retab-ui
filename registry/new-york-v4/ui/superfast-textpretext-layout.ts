"use client"

import {
  measureLineStats,
  prepareWithSegments,
  type PreparedTextWithSegments,
} from "@chenglou/pretext"

import type {
  SuperfastTextpretextChunk,
  SuperfastTextpretextChunkKind,
  SuperfastTextpretextDocument,
} from "./superfast-textpretext-model"
import { splitTextLines } from "./text-viewer-resource"

const DOCUMENT_PADDING_Y = 28
const CHUNK_PADDING_X = 48
const PARAGRAPH_LINE_HEIGHT = 24
const PREFORMATTED_LINE_HEIGHT = 21
const BLANK_LINE_HEIGHT = 16
const MIN_TEXT_CHUNK_HEIGHT = 32
const BODY_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const CODE_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'

export interface SuperfastTextpretextDocumentFrame {
  chunks: SuperfastTextpretextChunkFrame[]
  totalHeight: number
  width: number
}

export interface SuperfastTextpretextChunkFrame {
  bottom: number
  estimatedHeight: number
  height: number
  index: number
  isHostile: boolean
  kind: SuperfastTextpretextChunkKind
  measuredHeight: number | null
  sourceEndLine: number
  sourceStartLine: number
  top: number
}

export interface SuperfastTextpretextMeasuredHeights {
  get(index: number): number | undefined
}

export function layoutSuperfastTextpretextDocument({
  contentWidth,
  document,
  fontScale,
  measuredHeights,
}: {
  contentWidth: number
  document: SuperfastTextpretextDocument
  fontScale: number
  measuredHeights?: SuperfastTextpretextMeasuredHeights
}): SuperfastTextpretextDocumentFrame {
  const width = Math.max(1, contentWidth)
  const chunks: SuperfastTextpretextChunkFrame[] = []
  let y = DOCUMENT_PADDING_Y

  for (const chunk of document.chunks) {
    const measuredHeight = measuredHeights?.get(chunk.index)
    const estimatedHeight = estimateSuperfastTextpretextChunkHeight({
      chunk,
      fontScale,
      width,
    })
    const height =
      measuredHeight == null
        ? estimatedHeight
        : Math.max(MIN_TEXT_CHUNK_HEIGHT, measuredHeight)

    const frame: SuperfastTextpretextChunkFrame = {
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
    chunks.push(frame)
    y = frame.bottom
  }

  return {
    chunks,
    totalHeight: chunks.length
      ? y + DOCUMENT_PADDING_Y
      : DOCUMENT_PADDING_Y * 2,
    width,
  }
}

export function estimateSuperfastTextpretextChunkHeight({
  chunk,
  fontScale,
  width,
}: {
  chunk: SuperfastTextpretextChunk
  fontScale: number
  width: number
}) {
  if (chunk.kind === "blank-run") {
    return Math.max(
      BLANK_LINE_HEIGHT,
      splitTextLines(chunk.text).length * BLANK_LINE_HEIGHT * fontScale
    )
  }

  const textWidth = Math.max(1, width - CHUNK_PADDING_X * 2)
  const lineHeight =
    chunk.kind === "preformatted"
      ? PREFORMATTED_LINE_HEIGHT
      : PARAGRAPH_LINE_HEIGHT
  const fontFamily =
    chunk.kind === "preformatted" ? CODE_FONT_FAMILY : BODY_FONT_FAMILY
  const fontSize = chunk.kind === "preformatted" ? 13 : 15
  const font = `${Math.round(fontSize * fontScale)}px ${fontFamily}`
  const text = chunk.text || " "

  if (chunk.isHostile) {
    const lines = splitTextLines(text)
    const longestLineLength = lines.reduce(
      (maxLength, line) => Math.max(maxLength, line.length),
      1
    )
    const wrappedLines = Math.max(
      lines.length,
      Math.ceil((longestLineLength * fontSize * 0.55 * fontScale) / textWidth)
    )
    return Math.max(
      MIN_TEXT_CHUNK_HEIGHT,
      wrappedLines * lineHeight * fontScale
    )
  }

  const prepared = prepareTextSafe(text, font)
  const stats = prepared
    ? measureLineStatsSafe(prepared, textWidth / fontScale, text)
    : estimateLineStats(text, textWidth / fontScale)
  return Math.max(
    MIN_TEXT_CHUNK_HEIGHT,
    Math.max(1, stats.lineCount) * lineHeight * fontScale
  )
}

function prepareTextSafe(text: string, font: string) {
  try {
    return prepareWithSegments(text, font, { whiteSpace: "pre-wrap" })
  } catch {
    return null
  }
}

function measureLineStatsSafe(
  prepared: PreparedTextWithSegments,
  width: number,
  text: string
) {
  try {
    return measureLineStats(prepared, width)
  } catch {
    return estimateLineStats(text, width)
  }
}

function estimateLineStats(text: string, width: number) {
  const averageCharacterWidth = 7.5
  const maxCharactersPerLine = Math.max(
    1,
    Math.floor(width / averageCharacterWidth)
  )
  const lineCount = splitTextLines(text).reduce(
    (count, line) =>
      count + Math.max(1, Math.ceil(line.length / maxCharactersPerLine)),
    0
  )
  return { lineCount }
}
