import { describe, expect, it } from "vitest"

import {
  createPdfPageLayout,
  findPdfPageByOffset,
  getPdfPageLayout,
  getPdfVisiblePageNumbers,
  PDF_PAGE_GAP,
  PDF_PAGE_PADDING,
  type PdfPageLayoutModel,
} from "@/registry/new-york-v4/ui/pdf-viewer-layout"

const A4 = { width: 100, height: 200 }

function layoutOf(
  overrides: Partial<Parameters<typeof createPdfPageLayout>[0]> = {}
) {
  return createPdfPageLayout({
    pageCount: 3,
    defaultPageSize: A4,
    pageSizeByNumber: new Map(),
    scale: 1,
    rotation: 0,
    ...overrides,
  })
}

/** The bottom edge of the last page (+ bottom padding) must equal totalHeight. */
function assertBottomInvariant(layout: PdfPageLayoutModel) {
  if (layout.pageCount === 0) {
    expect(layout.totalHeight).toBe(0)
    return
  }
  const last = getPdfPageLayout(layout, layout.pageCount)!
  expect(last.offsetTop + last.height + PDF_PAGE_PADDING).toBe(
    layout.totalHeight
  )
}

describe("pdf layout — rotation handling", () => {
  it("treats 180° as upright (no dimension swap)", () => {
    const layout = layoutOf({ pageCount: 1, rotation: 180 })
    expect(getPdfPageLayout(layout, 1)).toMatchObject({ width: 100, height: 200 })
  })

  it("swaps dimensions for 270°", () => {
    const layout = layoutOf({ pageCount: 1, rotation: 270 })
    expect(getPdfPageLayout(layout, 1)).toMatchObject({ width: 200, height: 100 })
  })

  it("swaps dimensions for negative rotation (-90°)", () => {
    const layout = layoutOf({ pageCount: 1, rotation: -90 })
    expect(getPdfPageLayout(layout, 1)).toMatchObject({ width: 200, height: 100 })
  })

  it("treats 360° as upright", () => {
    const layout = layoutOf({ pageCount: 1, rotation: 360 })
    expect(getPdfPageLayout(layout, 1)).toMatchObject({ width: 100, height: 200 })
  })
})

describe("pdf layout — measured pages shorter than the estimate", () => {
  it("keeps offsets monotonic and preserves the bottom invariant with negative deltas", () => {
    const layout = layoutOf({
      pageCount: 4,
      pageSizeByNumber: new Map([
        [2, { width: 100, height: 50 }], // much shorter than estimate (200)
        [3, { width: 100, height: 500 }], // much taller
      ]),
    })

    const offsets = [1, 2, 3, 4].map((n) => getPdfPageLayout(layout, n)!.offsetTop)
    for (let i = 1; i < offsets.length; i++) {
      expect(offsets[i]).toBeGreaterThan(offsets[i - 1])
    }
    assertBottomInvariant(layout)
  })
})

describe("pdf layout — bottom invariant across many shapes", () => {
  const scenarios: Array<Parameters<typeof createPdfPageLayout>[0]> = [
    {
      pageCount: 1,
      defaultPageSize: A4,
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    },
    {
      pageCount: 5,
      defaultPageSize: A4,
      pageSizeByNumber: new Map([
        [1, { width: 120, height: 333 }],
        [5, { width: 80, height: 90 }],
      ]),
      scale: 1.37,
      rotation: 0,
    },
    {
      pageCount: 5,
      defaultPageSize: A4,
      pageSizeByNumber: new Map([[3, { width: 300, height: 100 }]]),
      scale: 0.5,
      rotation: 90,
    },
    {
      pageCount: 50,
      defaultPageSize: { width: 612, height: 792 },
      pageSizeByNumber: new Map([
        [10, { width: 792, height: 612 }],
        [25, { width: 1000, height: 1400 }],
      ]),
      scale: 1.25,
      rotation: 0,
    },
  ]

  scenarios.forEach((scenario, index) => {
    it(`holds for scenario #${index + 1}`, () => {
      assertBottomInvariant(createPdfPageLayout(scenario))
    })
  })
})

describe("pdf layout — degenerate scales", () => {
  it("collapses pages to zero rendered size at scale 0 without NaN", () => {
    const layout = layoutOf({ pageCount: 3, scale: 0 })
    const page = getPdfPageLayout(layout, 2)!
    expect(page.width).toBe(0)
    expect(page.height).toBe(0)
    expect(Number.isFinite(page.offsetTop)).toBe(true)
    // Only padding + the two gaps remain.
    expect(layout.totalHeight).toBe(PDF_PAGE_PADDING * 2 + 2 * PDF_PAGE_GAP)
  })
})

describe("pdf layout — visible page window edges", () => {
  it("returns a single page with overscan 0 at the top", () => {
    const layout = layoutOf({ pageCount: 10 })
    expect(
      getPdfVisiblePageNumbers({
        layout,
        scrollTop: 0,
        viewportHeight: 10,
        overscanPages: 0,
      })
    ).toEqual([1])
  })

  it("never exceeds document bounds with a large overscan", () => {
    const layout = layoutOf({ pageCount: 3 })
    const pages = getPdfVisiblePageNumbers({
      layout,
      scrollTop: 0,
      viewportHeight: 200,
      overscanPages: 999,
    })
    expect(pages).toEqual([1, 2, 3])
  })

  it("returns no pages for an empty document regardless of scroll", () => {
    const layout = layoutOf({ pageCount: 0 })
    expect(
      getPdfVisiblePageNumbers({ layout, scrollTop: 5000, viewportHeight: 200 })
    ).toEqual([])
  })
})

describe("pdf layout — findPdfPageByOffset boundaries", () => {
  it("returns the first page for offsets above the top padding but inside page 1", () => {
    const layout = layoutOf({ pageCount: 3 })
    expect(findPdfPageByOffset(layout, 0)).toBe(1)
    expect(findPdfPageByOffset(layout, PDF_PAGE_PADDING - 1)).toBe(1)
  })

  it("snaps exactly to a page boundary offset", () => {
    const layout = layoutOf({ pageCount: 3 })
    const page2Top = getPdfPageLayout(layout, 2)!.offsetTop
    expect(findPdfPageByOffset(layout, page2Top)).toBe(2)
    expect(findPdfPageByOffset(layout, page2Top - 1)).toBe(1)
  })
})

describe("pdf layout — measured pages outside the page range are ignored", () => {
  it("drops measured entries for pages beyond pageCount or below 1", () => {
    const layout = layoutOf({
      pageCount: 2,
      pageSizeByNumber: new Map([
        [0, { width: 999, height: 999 }],
        [3, { width: 999, height: 999 }],
        [2, { width: 100, height: 400 }],
      ]),
    })
    expect(layout.measuredPages.map((p) => p.pageNumber)).toEqual([2])
    assertBottomInvariant(layout)
  })
})
