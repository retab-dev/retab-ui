"use client"

import { splitTextLines } from "./text-viewer-resource"

export type SuperfastTextpretextChunkKind =
  | "blank-run"
  | "paragraph"
  | "preformatted"

export interface SuperfastTextpretextDocument {
  chunks: SuperfastTextpretextChunk[]
  sourceLineCount: number
  text: string
  wordCount: number
}

export interface SuperfastTextpretextChunk {
  id: string
  index: number
  isHostile: boolean
  kind: SuperfastTextpretextChunkKind
  sourceEndLine: number
  sourceStartLine: number
  text: string
}

const MAX_PARAGRAPH_LINES = 24
const MAX_PARAGRAPH_CHARS = 8_000
const HOSTILE_CHARS = 12_000
const HOSTILE_TOKEN_CHARS = 2_000
const HOSTILE_LINE_CHARS = 3_000

export function createSuperfastTextpretextDocument(
  text: string
): SuperfastTextpretextDocument {
  const lines = splitTextLines(text)
  const chunks: SuperfastTextpretextChunk[] = []
  let lineIndex = 0

  while (lineIndex < lines.length) {
    const line = lines[lineIndex] ?? ""
    if (isBlankLine(line)) {
      lineIndex = pushBlankRunChunk({ chunks, lines, startIndex: lineIndex })
      continue
    }

    if (isPreformattedLine(line)) {
      lineIndex = pushPreformattedChunk({
        chunks,
        lines,
        startIndex: lineIndex,
      })
      continue
    }

    lineIndex = pushParagraphChunks({ chunks, lines, startIndex: lineIndex })
  }

  return {
    chunks,
    sourceLineCount: lines.length,
    text,
    wordCount: countWords(text),
  }
}

function pushBlankRunChunk({
  chunks,
  lines,
  startIndex,
}: {
  chunks: SuperfastTextpretextChunk[]
  lines: readonly string[]
  startIndex: number
}) {
  let endIndex = startIndex
  while (
    endIndex + 1 < lines.length &&
    isBlankLine(lines[endIndex + 1] ?? "")
  ) {
    endIndex += 1
  }
  chunks.push(
    createChunk({
      chunks,
      kind: "blank-run",
      lines,
      startIndex,
      endIndex,
    })
  )
  return endIndex + 1
}

function pushPreformattedChunk({
  chunks,
  lines,
  startIndex,
}: {
  chunks: SuperfastTextpretextChunk[]
  lines: readonly string[]
  startIndex: number
}) {
  let endIndex = startIndex
  while (endIndex + 1 < lines.length) {
    const nextLine = lines[endIndex + 1] ?? ""
    if (isBlankLine(nextLine) || !isPreformattedLine(nextLine)) break
    endIndex += 1
  }
  chunks.push(
    createChunk({
      chunks,
      kind: "preformatted",
      lines,
      startIndex,
      endIndex,
    })
  )
  return endIndex + 1
}

function pushParagraphChunks({
  chunks,
  lines,
  startIndex,
}: {
  chunks: SuperfastTextpretextChunk[]
  lines: readonly string[]
  startIndex: number
}) {
  let endIndex = startIndex
  let charCount = 0

  while (endIndex < lines.length) {
    const line = lines[endIndex] ?? ""
    if (isBlankLine(line) || isPreformattedLine(line)) break

    const nextCharCount =
      charCount + line.length + (endIndex > startIndex ? 1 : 0)
    const lineCount = endIndex - startIndex + 1
    if (
      endIndex > startIndex &&
      (lineCount > MAX_PARAGRAPH_LINES || nextCharCount > MAX_PARAGRAPH_CHARS)
    ) {
      chunks.push(
        createChunk({
          chunks,
          kind: "paragraph",
          lines,
          startIndex,
          endIndex: endIndex - 1,
        })
      )
      return endIndex
    }

    charCount = nextCharCount
    endIndex += 1
  }

  chunks.push(
    createChunk({
      chunks,
      kind: "paragraph",
      lines,
      startIndex,
      endIndex: endIndex - 1,
    })
  )
  return endIndex
}

function createChunk({
  chunks,
  kind,
  lines,
  startIndex,
  endIndex,
}: {
  chunks: readonly SuperfastTextpretextChunk[]
  kind: SuperfastTextpretextChunkKind
  lines: readonly string[]
  startIndex: number
  endIndex: number
}): SuperfastTextpretextChunk {
  const text = lines.slice(startIndex, endIndex + 1).join("\n")
  return {
    id: `textpretext-${startIndex + 1}-${endIndex + 1}`,
    index: chunks.length,
    isHostile: isHostileChunkText(text),
    kind,
    sourceStartLine: startIndex + 1,
    sourceEndLine: endIndex + 1,
    text,
  }
}

function isBlankLine(line: string) {
  return line.trim() === ""
}

function isPreformattedLine(line: string) {
  return /^\s/.test(line) || line.includes("\t") || isTabularLookingLine(line)
}

function isTabularLookingLine(line: string) {
  const trimmed = line.trim()
  if (!trimmed) return false

  const pipeCount = (trimmed.match(/\|/g) ?? []).length
  if (pipeCount >= 2) return true

  return /\S+\s{2,}\S+\s{2,}\S+/.test(trimmed)
}

function isHostileChunkText(text: string) {
  if (text.length > HOSTILE_CHARS) return true
  if (new RegExp(`\\S{${HOSTILE_TOKEN_CHARS},}`).test(text)) return true
  return splitTextLines(text).some((line) => line.length > HOSTILE_LINE_CHARS)
}

function countWords(text: string) {
  const words = text.match(/\S+/g)
  return words?.length ?? 0
}
