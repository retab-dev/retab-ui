"use client"

import type { SuperfastTextpretextChunkFrame } from "./superfast-textpretext-layout"
import type { SuperfastTextpretextChunk } from "./superfast-textpretext-model"
import type { NormalizedTextLineRange } from "./text-viewer-ranges"

export interface SuperfastTextpretextScrollAnchor {
  chunkIndex: number
  offsetWithinChunk: number
}

export function getSuperfastTextpretextVisibleChunkFrames({
  frames,
  overscanPx,
  scrollTop,
  viewportHeight,
}: {
  frames: readonly SuperfastTextpretextChunkFrame[]
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

export function getSuperfastTextpretextFrameScrollAnchor({
  frames,
  scrollTop,
}: {
  frames: readonly SuperfastTextpretextChunkFrame[]
  scrollTop: number
}): SuperfastTextpretextScrollAnchor | null {
  if (!frames.length) return null

  const frameIndex = Math.min(
    firstChunkWithBottomAfter(frames, scrollTop),
    frames.length - 1
  )
  const frame = frames[frameIndex]
  if (!frame) return null

  return {
    chunkIndex: frame.index,
    offsetWithinChunk: Math.max(0, scrollTop - frame.top),
  }
}

export function resolveSuperfastTextpretextScrollAnchor({
  anchor,
  frames,
}: {
  anchor: SuperfastTextpretextScrollAnchor
  frames: readonly SuperfastTextpretextChunkFrame[]
}) {
  const frame = frames.find((item) => item.index === anchor.chunkIndex)
  if (!frame) return null

  return Math.max(
    0,
    frame.top +
      Math.min(anchor.offsetWithinChunk, Math.max(0, frame.height - 1))
  )
}

export function getSuperfastTextpretextScrollTopForLineRange({
  chunks,
  frames,
  range,
  viewportHeight,
}: {
  chunks: readonly Pick<
    SuperfastTextpretextChunk,
    "index" | "sourceEndLine" | "sourceStartLine"
  >[]
  frames: readonly SuperfastTextpretextChunkFrame[]
  range: NormalizedTextLineRange | null
  viewportHeight: number
}) {
  if (!range) return null

  const chunk =
    chunks.find(
      (item) =>
        item.sourceStartLine <= range.start && item.sourceEndLine >= range.start
    ) ?? chunks[0]
  const frame = chunk ? frames.find((item) => item.index === chunk.index) : null
  if (!frame) return null

  if (frame.height > viewportHeight) {
    const lineOffset = estimateLineOffsetWithinFrame({
      frame,
      sourceLine: range.start,
    })
    const viewportLead = Math.min(viewportHeight * 0.25, frame.height / 2)
    const maxScrollTop = Math.max(
      frame.top,
      frame.bottom - Math.min(viewportHeight, frame.height)
    )
    return Math.max(
      0,
      Math.min(maxScrollTop, frame.top + lineOffset - viewportLead)
    )
  }

  return Math.max(0, frame.top - (viewportHeight - frame.height) / 2)
}

export function superfastTextpretextChunkIntersectsLineRange({
  chunk,
  range,
}: {
  chunk: Pick<SuperfastTextpretextChunk, "sourceEndLine" | "sourceStartLine">
  range: NormalizedTextLineRange | null
}) {
  if (!range) return false
  return (
    chunk.sourceStartLine <= range.end && chunk.sourceEndLine >= range.start
  )
}

function estimateLineOffsetWithinFrame({
  frame,
  sourceLine,
}: {
  frame: Pick<
    SuperfastTextpretextChunkFrame,
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

function firstChunkWithBottomAfter(
  frames: readonly SuperfastTextpretextChunkFrame[],
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

function firstChunkWithTopAtOrAfter(
  frames: readonly SuperfastTextpretextChunkFrame[],
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
