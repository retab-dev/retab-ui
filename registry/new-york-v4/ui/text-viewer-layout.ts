"use client"

import { layout, prepare } from "@chenglou/pretext"

export interface TextLineLayout {
  height: number
}

export interface TextLayoutOptions {
  contentWidth: number
  fontName: string
  fontSize: number
  lineHeight: number
  textLines: readonly string[]
}

const TEXT_LAYOUT_CACHE_LIMIT = 50_000
const textLayoutHeightCache = new Map<string, number>()

export function layoutTextLines({
  contentWidth,
  fontName,
  fontSize,
  lineHeight,
  textLines,
}: TextLayoutOptions): TextLineLayout[] {
  return textLines.map((line) => ({
    height: measureTextLineHeight({
      contentWidth,
      fontName,
      fontSize,
      lineHeight,
      text: line,
    }),
  }))
}

export function measureTextLineHeight({
  contentWidth,
  fontName,
  fontSize,
  lineHeight,
  text,
}: {
  contentWidth: number
  fontName: string
  fontSize: number
  lineHeight: number
  text: string
}) {
  const cacheKey = [
    Math.round(contentWidth),
    Math.round(fontSize * 100) / 100,
    Math.round(lineHeight * 100) / 100,
    fontName,
    text,
  ].join("\u0000")
  const cachedHeight = textLayoutHeightCache.get(cacheKey)
  if (cachedHeight != null) return cachedHeight

  const height = measureTextLineHeightUncached({
    contentWidth,
    fontName,
    fontSize,
    lineHeight,
    text,
  })
  textLayoutHeightCache.set(cacheKey, height)
  trimTextLayoutHeightCache()
  return height
}

function measureTextLineHeightUncached({
  contentWidth,
  fontName,
  fontSize,
  lineHeight,
  text,
}: {
  contentWidth: number
  fontName: string
  fontSize: number
  lineHeight: number
  text: string
}) {
  try {
    const font = `400 ${fontSize}px ${fontName}`
    const prepared = prepare(text || " ", font, { whiteSpace: "pre-wrap" })
    return Math.max(
      lineHeight,
      layout(prepared, contentWidth, lineHeight).height
    )
  } catch {
    return estimateWrappedHeight({ contentWidth, lineHeight, text })
  }
}

export function estimateWrappedHeight({
  contentWidth,
  lineHeight,
  text,
}: {
  contentWidth: number
  lineHeight: number
  text: string
}) {
  const averageGlyphWidth = lineHeight * 0.45
  const columns = Math.max(1, Math.floor(contentWidth / averageGlyphWidth))
  const visualLineCount = Math.max(
    1,
    text.split("\n").reduce((count, line) => {
      return count + Math.max(1, Math.ceil((line || " ").length / columns))
    }, 0)
  )
  return visualLineCount * lineHeight
}

function trimTextLayoutHeightCache() {
  while (textLayoutHeightCache.size > TEXT_LAYOUT_CACHE_LIMIT) {
    const firstKey = textLayoutHeightCache.keys().next().value
    if (firstKey == null) return
    textLayoutHeightCache.delete(firstKey)
  }
}
