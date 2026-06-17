"use client"

import type { PretextMarkdownPosition } from "./pretext-markdown-hast-types"

export interface PretextMarkdownSourceRange {
  endLine: number
  endOffset: number
  startLine: number
  startOffset: number
}

export interface PretextMarkdownSourceMap {
  lineCount: number
  lineStarts: readonly number[]
  text: string
}

export function createPretextMarkdownSourceMap(
  text: string
): PretextMarkdownSourceMap {
  const lineStarts = [0]
  for (const match of text.matchAll(/\r\n|[\n\r\u2028\u2029]/g)) {
    lineStarts.push(match.index + match[0].length)
  }

  return {
    lineCount: Math.max(1, lineStarts.length),
    lineStarts,
    text,
  }
}

export function pretextMarkdownSourceRangeFromPosition({
  position,
  sourceMap,
}: {
  position: PretextMarkdownPosition | null | undefined
  sourceMap: PretextMarkdownSourceMap
}): PretextMarkdownSourceRange | null {
  if (!position?.start || !position.end) return null

  const startLine = clampLine(position.start.line, sourceMap)
  const endLine = clampLine(position.end.line, sourceMap)
  const startOffset =
    typeof position.start.offset === "number"
      ? clampOffset(position.start.offset, sourceMap.text.length)
      : offsetFromLineColumn({
          column: position.start.column,
          line: startLine,
          sourceMap,
        })
  const endOffset =
    typeof position.end.offset === "number"
      ? clampOffset(position.end.offset, sourceMap.text.length)
      : offsetFromLineColumn({
          column: position.end.column,
          line: endLine,
          sourceMap,
        })

  return {
    endLine: Math.max(startLine, endLine),
    endOffset: Math.max(startOffset, endOffset),
    startLine,
    startOffset,
  }
}

export function pretextMarkdownSourceTextForRange({
  range,
  sourceMap,
}: {
  range: PretextMarkdownSourceRange | null
  sourceMap: PretextMarkdownSourceMap
}) {
  if (!range) return ""
  return sourceMap.text.slice(range.startOffset, range.endOffset)
}

export function pretextMarkdownRangesIntersect({
  a,
  b,
}: {
  a: PretextMarkdownSourceRange | null
  b: PretextMarkdownSourceRange | null
}) {
  if (!a || !b) return false
  return a.startOffset < b.endOffset && a.endOffset > b.startOffset
}

export function pretextMarkdownLineRangeIntersects({
  endLine,
  range,
  startLine,
}: {
  endLine: number
  range: { end: number; start: number } | null
  startLine: number
}) {
  if (!range) return false
  return startLine <= range.end && endLine >= range.start
}

function offsetFromLineColumn({
  column,
  line,
  sourceMap,
}: {
  column: number | undefined
  line: number
  sourceMap: PretextMarkdownSourceMap
}) {
  const lineStart = sourceMap.lineStarts[line - 1] ?? 0
  return clampOffset(
    lineStart + Math.max(0, (column ?? 1) - 1),
    sourceMap.text.length
  )
}

function clampLine(
  line: number | undefined,
  sourceMap: PretextMarkdownSourceMap
) {
  if (!Number.isFinite(line)) return 1
  return Math.max(1, Math.min(sourceMap.lineCount, Math.trunc(line ?? 1)))
}

function clampOffset(offset: number, textLength: number) {
  return Math.max(0, Math.min(textLength, offset))
}
