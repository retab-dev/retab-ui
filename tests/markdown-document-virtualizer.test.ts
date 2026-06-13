import { describe, expect, it } from "vitest"

import {
  createMarkdownVirtualGeometry,
  getMarkdownScrollAnchor,
  getMarkdownVirtualItems,
  scrollTopForMarkdownAnchor,
  topForMarkdownIndex,
} from "@/registry/new-york-v4/ui/markdown-document-virtualizer"

const getKey = (index: number) => `chunk-${index + 1}`
const estimateHeight = (index: number) => [100, 200, 300, 400][index] ?? 100

describe("markdown document virtualizer", () => {
  it("returns a bounded overscanned window and total height", () => {
    const geometry = createMarkdownVirtualGeometry({
      count: 4,
      estimateHeight,
      getKey,
      measuredHeights: new Map(),
    })
    const window = getMarkdownVirtualItems({
      geometry,
      overscanPx: 25,
      scrollTop: 250,
      viewportHeight: 100,
    })

    expect(window.totalHeight).toBe(1000)
    expect(window.items.map((item) => item.index)).toEqual([1, 2])
    expect(window.items[0]).toMatchObject({
      bottom: 300,
      height: 200,
      key: "chunk-2",
      top: 100,
    })
  })

  it("uses measured heights ahead of estimates", () => {
    const measuredHeights = new Map([["chunk-2", 250]])
    const geometry = createMarkdownVirtualGeometry({
      count: 3,
      estimateHeight,
      getKey,
      measuredHeights,
    })
    const window = getMarkdownVirtualItems({
      geometry,
      overscanPx: 0,
      scrollTop: 0,
      viewportHeight: 1000,
    })

    expect(window.totalHeight).toBe(650)
    expect(
      topForMarkdownIndex({
        geometry,
        index: 2,
      })
    ).toBe(350)
  })

  it("captures and restores scroll anchors when measurements change", () => {
    const estimatedGeometry = createMarkdownVirtualGeometry({
      count: 4,
      estimateHeight,
      getKey,
      measuredHeights: new Map(),
    })
    const anchor = getMarkdownScrollAnchor({
      geometry: estimatedGeometry,
      scrollTop: 180,
    })

    expect(anchor).toEqual({ index: 1, offsetWithinItem: 80 })
    const measuredGeometry = createMarkdownVirtualGeometry({
      count: 4,
      estimateHeight,
      getKey,
      measuredHeights: new Map([["chunk-1", 120]]),
    })
    expect(
      scrollTopForMarkdownAnchor({
        anchor: anchor!,
        geometry: measuredGeometry,
      })
    ).toBe(200)
  })

  it("projects the visible range from stable geometry", () => {
    const geometry = createMarkdownVirtualGeometry({
      count: 6,
      estimateHeight: () => 100,
      getKey,
      measuredHeights: new Map(),
    })

    expect(geometry.offsets).toEqual([0, 100, 200, 300, 400, 500, 600])
    expect(
      getMarkdownVirtualItems({
        geometry,
        overscanPx: 0,
        scrollTop: 225,
        viewportHeight: 50,
      }).items.map((item) => item.index)
    ).toEqual([2])
  })
})
