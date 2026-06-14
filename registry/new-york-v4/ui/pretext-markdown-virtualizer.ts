"use client"

import type {
  PretextMarkdownChunk,
  PretextMarkdownLineRange,
} from "./pretext-markdown-document-model"
import type { PretextMarkdownChunkFrame } from "./pretext-markdown-layout"

export interface PretextMarkdownScrollAnchor {
  chunkIndex: number
  offsetWithinChunk: number
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

export function getPretextMarkdownFrameScrollAnchor({
  frames,
  scrollTop,
}: {
  frames: readonly PretextMarkdownChunkFrame[]
  scrollTop: number
}): PretextMarkdownScrollAnchor | null {
  if (!frames.length) return null

  const chunkIndex = Math.min(
    firstChunkWithBottomAfter(frames, scrollTop),
    frames.length - 1
  )
  const chunk = frames[chunkIndex]
  if (!chunk) return null

  return {
    chunkIndex: chunk.index,
    offsetWithinChunk: Math.max(0, scrollTop - chunk.top),
  }
}

export function resolvePretextMarkdownScrollAnchor({
  anchor,
  frames,
}: {
  anchor: PretextMarkdownScrollAnchor
  frames: readonly PretextMarkdownChunkFrame[]
}) {
  const frame = frames.find((item) => item.index === anchor.chunkIndex)
  if (!frame) return null

  return Math.max(
    0,
    frame.top +
      Math.min(anchor.offsetWithinChunk, Math.max(0, frame.height - 1))
  )
}

export function getPretextMarkdownScrollTopForLineRange({
  chunks,
  frames,
  range,
  viewportHeight,
}: {
  chunks: readonly Pick<
    PretextMarkdownChunk,
    "index" | "sourceEndLine" | "sourceStartLine"
  >[]
  frames: readonly PretextMarkdownChunkFrame[]
  range: PretextMarkdownLineRange | null
  viewportHeight: number
}) {
  if (!range) return null

  const chunk =
    chunks.find(
      (item) =>
        item.sourceStartLine <= range.start && item.sourceEndLine >= range.start
    ) ?? chunks[0]
  const targetFrame = chunk
    ? frames.find((frame) => frame.index === chunk.index)
    : null
  if (!targetFrame) return null

  if (targetFrame.height > viewportHeight) {
    const lineOffset = estimatePretextMarkdownLineOffsetWithinFrame({
      frame: targetFrame,
      sourceLine: range.start,
    })
    const viewportLead = Math.min(viewportHeight * 0.25, targetFrame.height / 2)
    const maxScrollTop = Math.max(
      targetFrame.top,
      targetFrame.bottom - Math.min(viewportHeight, targetFrame.height)
    )
    return Math.max(
      0,
      Math.min(maxScrollTop, targetFrame.top + lineOffset - viewportLead)
    )
  }

  return Math.max(
    0,
    targetFrame.top - (viewportHeight - targetFrame.height) / 2
  )
}

export function markdownChunkIntersectsLineRange({
  chunk,
  range,
}: {
  chunk: Pick<PretextMarkdownChunk, "sourceEndLine" | "sourceStartLine">
  range: PretextMarkdownLineRange | null
}) {
  if (!range) return false
  return (
    chunk.sourceStartLine <= range.end && chunk.sourceEndLine >= range.start
  )
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

function estimatePretextMarkdownLineOffsetWithinFrame({
  frame,
  sourceLine,
}: {
  frame: Pick<
    PretextMarkdownChunkFrame,
    "height" | "sourceEndLine" | "sourceStartLine"
  >
  sourceLine: number
}) {
  const lineCount = Math.max(1, frame.sourceEndLine - frame.sourceStartLine + 1)
  const lineIndex = Math.min(
    lineCount - 1,
    Math.max(0, sourceLine - frame.sourceStartLine)
  )
  return (lineIndex / lineCount) * frame.height
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
