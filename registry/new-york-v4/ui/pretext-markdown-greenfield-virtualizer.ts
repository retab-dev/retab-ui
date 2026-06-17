"use client"

import type { PretextMarkdownGreenfieldChunk } from "./pretext-markdown-greenfield-document"
import type { PretextMarkdownGreenfieldChunkFrame } from "./pretext-markdown-greenfield-layout"

export type PretextMarkdownGreenfieldScrollAnchor = {
  chunkId: string
  offsetWithinChunkPx: number
  chunkHeightPx: number
}

export function getPretextMarkdownGreenfieldVisibleFrames({
  frames,
  overscanPx,
  scrollTop,
  viewportHeight,
}: {
  frames: readonly PretextMarkdownGreenfieldChunkFrame[]
  overscanPx: number
  scrollTop: number
  viewportHeight: number
}) {
  if (!frames.length) return []
  const start = firstFrameWithBottomAfter(
    frames,
    Math.max(0, scrollTop - overscanPx)
  )
  const end = firstFrameWithTopAtOrAfter(
    frames,
    scrollTop + viewportHeight + overscanPx
  )
  return frames.slice(start, Math.max(start + 1, end))
}

export function getPretextMarkdownGreenfieldScrollAnchor({
  frames,
  scrollTop,
}: {
  frames: readonly PretextMarkdownGreenfieldChunkFrame[]
  scrollTop: number
}): PretextMarkdownGreenfieldScrollAnchor | null {
  if (!frames.length) return null
  const frame =
    frames[
      Math.min(firstFrameWithBottomAfter(frames, scrollTop), frames.length - 1)
    ]
  if (!frame) return null

  return {
    chunkId: frame.id,
    chunkHeightPx: frame.height,
    offsetWithinChunkPx: Math.max(0, scrollTop - frame.top),
  }
}

export function resolvePretextMarkdownGreenfieldScrollAnchor({
  anchor,
  frames,
}: {
  anchor: PretextMarkdownGreenfieldScrollAnchor
  frames: readonly PretextMarkdownGreenfieldChunkFrame[]
}) {
  const frame = frames.find((item) => item.id === anchor.chunkId)
  if (!frame) return null
  // Preserve the position *within* the anchored chunk proportionally. When the
  // chunk keeps its height this reduces to the original pixel offset; when an
  // over-estimated chunk shrinks after measurement, the viewport stays at the
  // same relative content instead of snapping toward the chunk's top (which is
  // what `min(offset, height - 1)` did, yanking the reader upward).
  const fraction =
    anchor.chunkHeightPx > 0
      ? Math.min(
          1,
          Math.max(0, anchor.offsetWithinChunkPx / anchor.chunkHeightPx)
        )
      : 0
  return frame.top + fraction * frame.height
}

export function getPretextMarkdownGreenfieldScrollTopForLineRange({
  chunks,
  frames,
  preferredChunkId,
  range,
  viewportHeight,
}: {
  chunks: readonly Pick<
    PretextMarkdownGreenfieldChunk,
    "id" | "index" | "sourceEndLine" | "sourceStartLine"
  >[]
  frames: readonly PretextMarkdownGreenfieldChunkFrame[]
  preferredChunkId?: string | null
  range: { end: number; start: number } | null
  viewportHeight: number
}) {
  if (!range) return null
  const preferredChunk =
    preferredChunkId == null
      ? null
      : chunks.find((item) => item.id === preferredChunkId)
  const chunk =
    preferredChunk ??
    chunks.find(
      (item) =>
        item.sourceStartLine <= range.start && item.sourceEndLine >= range.start
    ) ??
    chunks[0]
  const frame = chunk
    ? frames.find((candidate) => candidate.index === chunk.index)
    : null
  if (!frame) return null

  const lineCount = Math.max(1, frame.sourceEndLine - frame.sourceStartLine + 1)
  const lineOffset =
    (Math.max(0, range.start - frame.sourceStartLine) / lineCount) *
      frame.height || 0
  return Math.max(0, frame.top + lineOffset - viewportHeight * 0.25)
}

export function getPretextMarkdownGreenfieldSourceLineForScrollTop({
  chunks,
  frames,
  scrollTop,
}: {
  chunks: readonly Pick<
    PretextMarkdownGreenfieldChunk,
    "index" | "sourceEndLine" | "sourceStartLine"
  >[]
  frames: readonly PretextMarkdownGreenfieldChunkFrame[]
  scrollTop: number
}) {
  if (!frames.length) return 1
  const frame =
    frames[
      Math.min(firstFrameWithBottomAfter(frames, scrollTop), frames.length - 1)
    ]
  if (!frame) return 1
  const chunk = chunks.find((item) => item.index === frame.index)
  if (!chunk) return frame.sourceStartLine
  const lineCount = Math.max(1, chunk.sourceEndLine - chunk.sourceStartLine + 1)
  const ratio = Math.max(0, Math.min(1, (scrollTop - frame.top) / frame.height))
  return (
    chunk.sourceStartLine +
    Math.min(lineCount - 1, Math.floor(ratio * lineCount))
  )
}

function firstFrameWithBottomAfter(
  frames: readonly PretextMarkdownGreenfieldChunkFrame[],
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

function firstFrameWithTopAtOrAfter(
  frames: readonly PretextMarkdownGreenfieldChunkFrame[],
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
