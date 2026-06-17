import { describe, expect, it } from "vitest"

import type { MarkdownGreenfieldChunkFrame } from "@/registry/new-york-v4/ui/markdown-greenfield-layout"
import {
  getMarkdownGreenfieldScrollAnchor,
  getMarkdownGreenfieldScrollTopForLineRange,
  resolveMarkdownGreenfieldScrollAnchor,
} from "@/registry/new-york-v4/ui/markdown-greenfield-virtualizer"

function frame(
  id: string,
  index: number,
  top: number,
  height: number,
  sourceStartLine: number,
  sourceEndLine: number
): MarkdownGreenfieldChunkFrame {
  return {
    bottom: top + height,
    height,
    id,
    index,
    measuredHeight: null,
    sourceEndLine,
    sourceStartLine,
    top,
  }
}

describe("pretext markdown greenfield virtualizer", () => {
  it("anchors scroll by chunk identity instead of numeric index", () => {
    const anchor = getMarkdownGreenfieldScrollAnchor({
      frames: [
        frame("chunk-a", 0, 0, 100, 1, 10),
        frame("chunk-b", 1, 100, 150, 11, 20),
      ],
      scrollTop: 125,
    })

    expect(anchor).toEqual({
      chunkId: "chunk-b",
      chunkHeightPx: 150,
      offsetWithinChunkPx: 25,
    })
    expect(
      resolveMarkdownGreenfieldScrollAnchor({
        anchor: anchor!,
        frames: [
          frame("chunk-a", 0, 0, 200, 1, 10),
          frame("chunk-b", 99, 300, 90, 11, 20),
        ],
      })
      // 25/150 of the way into a chunk that shrank 150 -> 90 = 15px below its top.
    ).toBe(315)
  })

  it("keeps the anchored chunk pinned when chunks above it collapse after measurement", () => {
    // The reader is 40px into chunk-b, which sits below an over-estimated
    // chunk-a. After measurement chunk-a collapses 1000 -> 200, so chunk-b's
    // top drops by 800. The viewport must follow chunk-b down, not stay put.
    const anchor = getMarkdownGreenfieldScrollAnchor({
      frames: [
        frame("chunk-a", 0, 0, 1000, 1, 40),
        frame("chunk-b", 1, 1000, 300, 41, 60),
      ],
      scrollTop: 1040,
    })

    expect(anchor).toEqual({
      chunkId: "chunk-b",
      chunkHeightPx: 300,
      offsetWithinChunkPx: 40,
    })
    expect(
      resolveMarkdownGreenfieldScrollAnchor({
        anchor: anchor!,
        frames: [
          frame("chunk-a", 0, 0, 200, 1, 40),
          frame("chunk-b", 1, 200, 300, 41, 60),
        ],
      })
      // chunk-b now starts at 200; same 40px offset (height unchanged) -> 240.
    ).toBe(240)
  })

  it("does not snap toward a shrunk anchored chunk's top when the offset exceeds the new height", () => {
    // The reader scrolled deep into an over-estimated chunk (1500px into a
    // 2000px estimate). After measurement the chunk is only 400px tall.
    const anchor = getMarkdownGreenfieldScrollAnchor({
      frames: [frame("chunk-a", 0, 0, 2000, 1, 80)],
      scrollTop: 1500,
    })
    const restored = resolveMarkdownGreenfieldScrollAnchor({
      anchor: anchor!,
      frames: [frame("chunk-a", 0, 0, 400, 1, 80)],
    })

    // Proportional restore keeps the reader ~75% into the chunk (300px), rather
    // than clamping to height - 1 (399px) which reads as a jump.
    expect(restored).toBe(300)
  })

  it("uses preferred chunk identity for ambiguous source-line targeting", () => {
    const frames = [
      frame("chunk-a", 0, 0, 100, 1, 20),
      frame("chunk-b", 1, 100, 100, 1, 20),
    ]
    const chunks = frames.map(
      ({ id, index, sourceEndLine, sourceStartLine }) => ({
        id,
        index,
        sourceEndLine,
        sourceStartLine,
      })
    )

    expect(
      getMarkdownGreenfieldScrollTopForLineRange({
        chunks,
        frames,
        preferredChunkId: "chunk-b",
        range: { end: 5, start: 5 },
        viewportHeight: 40,
      })
    ).toBe(110)
  })

  it("uses line-ratio fallback for source lines inside large chunks", () => {
    const frames = [frame("chunk-large", 0, 100, 1000, 101, 200)]
    const chunks = frames.map(
      ({ id, index, sourceEndLine, sourceStartLine }) => ({
        id,
        index,
        sourceEndLine,
        sourceStartLine,
      })
    )

    expect(
      getMarkdownGreenfieldScrollTopForLineRange({
        chunks,
        frames,
        range: { end: 101, start: 101 },
        viewportHeight: 100,
      })
    ).toBe(75)
    expect(
      getMarkdownGreenfieldScrollTopForLineRange({
        chunks,
        frames,
        range: { end: 151, start: 151 },
        viewportHeight: 100,
      })
    ).toBe(575)
    expect(
      getMarkdownGreenfieldScrollTopForLineRange({
        chunks,
        frames,
        range: { end: 199, start: 199 },
        viewportHeight: 100,
      })
    ).toBeGreaterThan(900)
  })
})
