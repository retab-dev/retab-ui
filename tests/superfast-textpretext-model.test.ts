import { describe, expect, it } from "vitest"

import {
  estimateSuperfastTextpretextChunkHeight,
  layoutSuperfastTextpretextDocument,
  type SuperfastTextpretextChunkFrame,
} from "@/registry/new-york-v4/ui/superfast-textpretext-layout"
import { createSuperfastTextpretextDocument } from "@/registry/new-york-v4/ui/superfast-textpretext-model"
import {
  getSuperfastTextpretextFrameScrollAnchor,
  getSuperfastTextpretextScrollTopForLineRange,
  getSuperfastTextpretextVisibleChunkFrames,
  resolveSuperfastTextpretextScrollAnchor,
  superfastTextpretextChunkIntersectsLineRange,
} from "@/registry/new-york-v4/ui/superfast-textpretext-virtualizer"

describe("SuperfastTextpretext model", () => {
  it("groups prose, blank runs, and preformatted runs into native chunks", () => {
    const document = createSuperfastTextpretextDocument(
      [
        "First paragraph line one",
        "First paragraph line two",
        "",
        "",
        "  indented code",
        "\tmore code",
        "Second paragraph",
      ].join("\n")
    )

    expect(document.chunks.map((chunk) => chunk.kind)).toEqual([
      "paragraph",
      "blank-run",
      "preformatted",
      "paragraph",
    ])
    expect(document.chunks[0]).toMatchObject({
      sourceStartLine: 1,
      sourceEndLine: 2,
    })
    expect(document.chunks[1]).toMatchObject({
      sourceStartLine: 3,
      sourceEndLine: 4,
    })
    expect(document.chunks[2]).toMatchObject({
      sourceStartLine: 5,
      sourceEndLine: 6,
    })
  })

  it("treats simple tabular-looking text as preformatted", () => {
    const document = createSuperfastTextpretextDocument(
      [
        "Name      Status      Owner",
        "Alpha     Ready       Team",
        "",
        "normal prose",
      ].join("\n")
    )

    expect(document.chunks.map((chunk) => chunk.kind)).toEqual([
      "preformatted",
      "blank-run",
      "paragraph",
    ])
    expect(document.chunks[0]).toMatchObject({
      sourceStartLine: 1,
      sourceEndLine: 2,
    })
  })

  it("splits very large prose runs into bounded chunks", () => {
    const document = createSuperfastTextpretextDocument(
      Array.from({ length: 75 }, (_, index) => `line ${index + 1}`).join("\n")
    )

    expect(document.chunks.length).toBeGreaterThan(1)
    expect(
      document.chunks.every(
        (chunk) => chunk.sourceEndLine - chunk.sourceStartLine + 1 <= 24
      )
    ).toBe(true)
  })

  it("uses measured heights over estimates while preserving source ranges", () => {
    const document = createSuperfastTextpretextDocument("alpha\nbeta\n\ngamma")
    const measured = new Map([[0, 240]])
    const frame = layoutSuperfastTextpretextDocument({
      contentWidth: 480,
      document,
      fontScale: 1,
      measuredHeights: measured,
    })

    expect(frame.chunks[0]).toMatchObject({
      height: 240,
      measuredHeight: 240,
      sourceStartLine: 1,
      sourceEndLine: 2,
    })
    expect(frame.chunks[1]?.top).toBe(frame.chunks[0]?.bottom)
  })

  it("estimates hostile chunks without depending on Pretext measurement", () => {
    const document = createSuperfastTextpretextDocument("x".repeat(2_100))
    const chunk = document.chunks[0]

    expect(chunk?.isHostile).toBe(true)
    expect(
      chunk
        ? estimateSuperfastTextpretextChunkHeight({
            chunk,
            fontScale: 1,
            width: 320,
          })
        : 0
    ).toBeGreaterThan(32)
  })
})

describe("SuperfastTextpretext virtualizer", () => {
  it("projects a pixel-overscanned visible chunk window", () => {
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
    ]

    expect(
      getSuperfastTextpretextVisibleChunkFrames({
        frames,
        overscanPx: 0,
        scrollTop: 210,
        viewportHeight: 50,
      }).map((item) => item.index)
    ).toEqual([1, 2])
  })

  it("captures and restores scroll anchors across measured height changes", () => {
    const anchor = getSuperfastTextpretextFrameScrollAnchor({
      frames: [
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
      ],
      scrollTop: 145,
    })

    expect(anchor).toEqual({ chunkIndex: 1, offsetWithinChunk: 25 })
    expect(
      anchor
        ? resolveSuperfastTextpretextScrollAnchor({
            anchor,
            frames: [
              frame({
                height: 200,
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
                top: 200,
              }),
            ],
          })
        : null
    ).toBe(225)
  })

  it("maps source line ranges into chunk scroll offsets", () => {
    const chunks = [
      { index: 0, sourceEndLine: 10, sourceStartLine: 1 },
      { index: 1, sourceEndLine: 30, sourceStartLine: 11 },
    ]
    const frames = [
      frame({
        height: 200,
        index: 0,
        sourceEndLine: 10,
        sourceStartLine: 1,
        top: 0,
      }),
      frame({
        height: 500,
        index: 1,
        sourceEndLine: 30,
        sourceStartLine: 11,
        top: 200,
      }),
    ]

    expect(
      getSuperfastTextpretextScrollTopForLineRange({
        chunks,
        frames,
        range: { start: 21, end: 21, normalized: true },
        viewportHeight: 300,
      })
    ).toBe(375)
    expect(
      superfastTextpretextChunkIntersectsLineRange({
        chunk: chunks[1]!,
        range: { start: 5, end: 12, normalized: true },
      })
    ).toBe(true)
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
}): SuperfastTextpretextChunkFrame {
  return {
    bottom: top + height,
    estimatedHeight: height,
    height,
    index,
    isHostile: false,
    kind: "paragraph",
    measuredHeight: null,
    sourceEndLine,
    sourceStartLine,
    top,
  }
}
