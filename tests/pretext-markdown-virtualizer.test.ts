import { describe, expect, it } from "vitest"

import type { PretextMarkdownChunk } from "@/registry/new-york-v4/ui/pretext-markdown-document-model"
import type { PretextMarkdownChunkFrame } from "@/registry/new-york-v4/ui/pretext-markdown-layout"
import {
  getPretextMarkdownFrameScrollAnchor,
  getPretextMarkdownScrollTopForLineRange,
  getPretextMarkdownSourceLineForScrollTop,
  getPretextMarkdownVisibleChunkFrames,
  markdownChunkIntersectsLineRange,
  resolvePretextMarkdownScrollAnchor,
} from "@/registry/new-york-v4/ui/pretext-markdown-virtualizer"

describe("Pretext Markdown virtualizer", () => {
  it("projects visible chunks with pixel overscan", () => {
    const frames = [
      frame({
        height: 100,
        index: 0,
        sourceEndLine: 10,
        sourceStartLine: 1,
        top: 0,
      }),
      frame({
        height: 120,
        index: 1,
        sourceEndLine: 20,
        sourceStartLine: 11,
        top: 100,
      }),
      frame({
        height: 180,
        index: 2,
        sourceEndLine: 30,
        sourceStartLine: 21,
        top: 220,
      }),
      frame({
        height: 100,
        index: 3,
        sourceEndLine: 40,
        sourceStartLine: 31,
        top: 400,
      }),
    ]

    expect(
      getPretextMarkdownVisibleChunkFrames({
        frames,
        overscanPx: 0,
        scrollTop: 210,
        viewportHeight: 50,
      }).map((item) => item.index)
    ).toEqual([1, 2])

    expect(
      getPretextMarkdownVisibleChunkFrames({
        frames,
        overscanPx: 150,
        scrollTop: 210,
        viewportHeight: 50,
      }).map((item) => item.index)
    ).toEqual([0, 1, 2, 3])
  })

  it("captures and restores scroll anchors across measured height changes", () => {
    const originalFrames = [
      frame({
        height: 120,
        index: 0,
        sourceEndLine: 10,
        sourceStartLine: 1,
        top: 0,
      }),
      frame({
        height: 120,
        index: 1,
        sourceEndLine: 20,
        sourceStartLine: 11,
        top: 120,
      }),
      frame({
        height: 120,
        index: 2,
        sourceEndLine: 30,
        sourceStartLine: 21,
        top: 240,
      }),
    ]
    const anchor = getPretextMarkdownFrameScrollAnchor({
      frames: originalFrames,
      scrollTop: 265,
    })

    expect(anchor).toEqual({ chunkIndex: 2, offsetWithinChunk: 25 })

    const measuredFrames = [
      frame({
        height: 180,
        index: 0,
        sourceEndLine: 10,
        sourceStartLine: 1,
        top: 0,
      }),
      frame({
        height: 200,
        index: 1,
        sourceEndLine: 20,
        sourceStartLine: 11,
        top: 180,
      }),
      frame({
        height: 80,
        index: 2,
        sourceEndLine: 30,
        sourceStartLine: 21,
        top: 380,
      }),
    ]

    expect(
      anchor
        ? resolvePretextMarkdownScrollAnchor({
            anchor,
            frames: measuredFrames,
          })
        : null
    ).toBe(405)
  })

  it("clamps restored anchors that exceed a measured chunk height", () => {
    const anchor = { chunkIndex: 1, offsetWithinChunk: 500 }
    const frames = [
      frame({
        height: 120,
        index: 0,
        sourceEndLine: 10,
        sourceStartLine: 1,
        top: 0,
      }),
      frame({
        height: 80,
        index: 1,
        sourceEndLine: 20,
        sourceStartLine: 11,
        top: 120,
      }),
    ]

    expect(resolvePretextMarkdownScrollAnchor({ anchor, frames })).toBe(199)
  })

  it("looks up scroll offsets from source-line ranges", () => {
    const chunks = [
      chunk({ index: 0, sourceEndLine: 10, sourceStartLine: 1 }),
      chunk({ index: 1, sourceEndLine: 20, sourceStartLine: 11 }),
      chunk({ index: 2, sourceEndLine: 30, sourceStartLine: 21 }),
    ]
    const frames = [
      frame({
        height: 300,
        index: 0,
        sourceEndLine: 10,
        sourceStartLine: 1,
        top: 0,
      }),
      frame({
        height: 100,
        index: 1,
        sourceEndLine: 20,
        sourceStartLine: 11,
        top: 300,
      }),
      frame({
        height: 500,
        index: 2,
        sourceEndLine: 30,
        sourceStartLine: 21,
        top: 400,
      }),
    ]

    expect(
      getPretextMarkdownScrollTopForLineRange({
        chunks,
        frames,
        range: { end: 12, start: 12 },
        viewportHeight: 300,
      })
    ).toBe(200)

    expect(
      getPretextMarkdownScrollTopForLineRange({
        chunks,
        frames,
        range: { end: 25, start: 25 },
        viewportHeight: 300,
      })
    ).toBe(525)

    expect(
      getPretextMarkdownScrollTopForLineRange({
        chunks,
        frames,
        range: { end: 30, start: 30 },
        viewportHeight: 300,
      })
    ).toBe(600)
  })

  it("looks up source lines from rendered scroll offsets", () => {
    const chunks = [
      chunk({ index: 0, sourceEndLine: 10, sourceStartLine: 1 }),
      chunk({ index: 1, sourceEndLine: 30, sourceStartLine: 11 }),
    ]
    const frames = [
      frame({
        height: 100,
        index: 0,
        sourceEndLine: 10,
        sourceStartLine: 1,
        top: 0,
      }),
      frame({
        height: 400,
        index: 1,
        sourceEndLine: 30,
        sourceStartLine: 11,
        top: 100,
      }),
    ]

    expect(
      getPretextMarkdownSourceLineForScrollTop({
        chunks,
        frames,
        scrollTop: 0,
      })
    ).toBe(1)
    expect(
      getPretextMarkdownSourceLineForScrollTop({
        chunks,
        frames,
        scrollTop: 300,
      })
    ).toBe(21)
    expect(
      getPretextMarkdownSourceLineForScrollTop({
        chunks,
        frames,
        scrollTop: 900,
      })
    ).toBe(30)
  })

  it("detects line-range intersections without React state", () => {
    expect(
      markdownChunkIntersectsLineRange({
        chunk: chunk({ index: 0, sourceEndLine: 20, sourceStartLine: 10 }),
        range: { end: 12, start: 8 },
      })
    ).toBe(true)
    expect(
      markdownChunkIntersectsLineRange({
        chunk: chunk({ index: 0, sourceEndLine: 20, sourceStartLine: 10 }),
        range: { end: 9, start: 1 },
      })
    ).toBe(false)
  })
})

function frame({
  height,
  index,
  sourceEndLine,
  sourceStartLine,
  top,
}: {
  height: number
  index: number
  sourceEndLine: number
  sourceStartLine: number
  top: number
}): PretextMarkdownChunkFrame {
  return {
    blockIds: [],
    bottom: top + height,
    estimatedHeight: height,
    height,
    index,
    isHostile: false,
    kind: "markdown",
    measuredHeight: null,
    sourceEndLine,
    sourceStartLine,
    top,
  }
}

function chunk({
  index,
  sourceEndLine,
  sourceStartLine,
}: {
  index: number
  sourceEndLine: number
  sourceStartLine: number
}): PretextMarkdownChunk {
  return {
    blockIds: [],
    headingIds: [],
    index,
    isHostile: false,
    kind: "markdown",
    markdown: "",
    sourceEndOffset: sourceEndLine,
    sourceEndLine,
    sourceStartOffset: sourceStartLine,
    sourceStartLine,
  }
}
