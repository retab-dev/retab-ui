import { describe, expect, it } from "vitest"

import {
  createPageMeasurementKey,
  estimateMarkdownPageHeight,
} from "@/components/viewers/page-markdown/page-markdown-layout"
import { joinMarkdownPages } from "@/components/viewers/page-markdown/page-markdown-model"
import {
  fitPageScale,
  zoomPageScale,
} from "@/components/viewers/page-markdown/page-markdown-scale"
import {
  initialPageMarkdownSyncState,
  resolvePageMarkdownSyncReport,
} from "@/components/viewers/page-markdown/page-markdown-sync"

describe("page markdown model", () => {
  it("joins page markdown without inventing structure", () => {
    expect(joinMarkdownPages(["# Page 1", "# Page 2"])).toBe(
      "# Page 1\n\n# Page 2"
    )
  })

  it("clamps fit and manual zoom scales", () => {
    expect(fitPageScale(null)).toBe(1)
    expect(fitPageScale(40)).toBe(0.35)
    expect(fitPageScale(5000)).toBe(1.5)
    expect(zoomPageScale(1, 1.2)).toBe(1.2)
    expect(zoomPageScale(10, 1.2)).toBe(3)
  })

  it("keeps non-finite scale inputs from leaking into layout", () => {
    expect(fitPageScale(Number.NaN)).toBe(1)
    expect(fitPageScale(Number.POSITIVE_INFINITY)).toBe(1)
    expect(zoomPageScale(Number.NaN, 1.2)).toBe(1)
    expect(zoomPageScale(1, Number.POSITIVE_INFINITY)).toBe(1)
    expect(
      Number.isFinite(estimateMarkdownPageHeight("one line", Number.NaN))
    ).toBe(true)
    expect(
      Number.isFinite(
        estimateMarkdownPageHeight("one line", Number.POSITIVE_INFINITY)
      )
    ).toBe(true)
  })

  it("estimates page height within stable bounds", () => {
    expect(estimateMarkdownPageHeight("one line", 1)).toBe(180)
    expect(
      estimateMarkdownPageHeight(
        Array.from({ length: 200 }, (_, index) => `line ${index}`).join("\n"),
        1,
        "text"
      )
    ).toBe(1800)
    expect(estimateMarkdownPageHeight("word ".repeat(2000), 1)).toBe(1800)
  })

  it("keys page measurements by mode, scale, and markdown signature", () => {
    const base = createPageMeasurementKey({
      markdown: "# Page\n\nAlpha",
      mode: "rendered",
      scale: 1,
    })

    expect(
      createPageMeasurementKey({
        markdown: "# Page\n\nAlpha",
        mode: "text",
        scale: 1,
      })
    ).not.toBe(base)
    expect(
      createPageMeasurementKey({
        markdown: "# Page\n\nAlpha",
        mode: "rendered",
        scale: 1.2,
      })
    ).not.toBe(base)
    expect(
      createPageMeasurementKey({
        markdown: "# Page\n\nBeta",
        mode: "rendered",
        scale: 1,
      })
    ).not.toBe(base)
  })

  it("does not collide when only the middle of same-length markdown changes", () => {
    const first = createPageMeasurementKey({
      markdown: `# Invoice\n\n${"alpha ".repeat(12)}\n\nTotal due`,
      mode: "rendered",
      scale: 1,
    })
    const second = createPageMeasurementKey({
      markdown: `# Invoice\n\n${"bravo ".repeat(12)}\n\nTotal due`,
      mode: "rendered",
      scale: 1,
    })

    expect(first).not.toBe(second)
  })

  it("requests the opposite pane when a new pane reports a page", () => {
    const transition = resolvePageMarkdownSyncReport({
      state: initialPageMarkdownSyncState(),
      pending: null,
      pane: "markdown",
      pageNumber: 3,
    })

    expect(transition.state).toMatchObject({
      pageNumber: 3,
      pane: "markdown",
    })
    expect(transition.scrollTarget).toMatchObject({
      pane: "document",
      pageNumber: 3,
    })
    expect(transition.pending).toEqual(transition.scrollTarget)
  })

  it("clears pending sync when the target pane confirms the requested page", () => {
    const requested = resolvePageMarkdownSyncReport({
      state: initialPageMarkdownSyncState(),
      pending: null,
      pane: "document",
      pageNumber: 2,
    })

    const confirmed = resolvePageMarkdownSyncReport({
      state: requested.state,
      pending: requested.pending,
      pane: "markdown",
      pageNumber: 2,
    })

    expect(confirmed.confirmed).toBe(true)
    expect(confirmed.pending).toBeNull()
    expect(confirmed.scrollTarget).toBeNull()
    expect(confirmed.state).toMatchObject({
      pageNumber: 2,
      pane: "markdown",
    })
  })

  it("ignores stale reports from the pending target pane", () => {
    const requested = resolvePageMarkdownSyncReport({
      state: initialPageMarkdownSyncState(),
      pending: null,
      pane: "document",
      pageNumber: 2,
    })

    const stale = resolvePageMarkdownSyncReport({
      state: requested.state,
      pending: requested.pending,
      pane: "markdown",
      pageNumber: 1,
    })

    expect(stale).toMatchObject({
      state: requested.state,
      pending: requested.pending,
      scrollTarget: null,
      confirmed: false,
    })
  })

  it("does not schedule work for an unchanged page without pending sync", () => {
    expect(
      resolvePageMarkdownSyncReport({
        state: initialPageMarkdownSyncState(),
        pending: null,
        pane: "markdown",
        pageNumber: 1,
      })
    ).toMatchObject({
      pending: null,
      scrollTarget: null,
      confirmed: false,
    })
  })

  it("records same-page reports from a different pane without scheduling scroll work", () => {
    const transition = resolvePageMarkdownSyncReport({
      state: { pageNumber: 1, pane: "document", version: 0 },
      pending: null,
      pane: "markdown",
      pageNumber: 1,
    })

    expect(transition).toMatchObject({
      state: { pageNumber: 1, pane: "markdown", version: 1 },
      pending: null,
      scrollTarget: null,
      confirmed: false,
    })
  })

  it("normalizes non-finite reported pages to the first page", () => {
    const transition = resolvePageMarkdownSyncReport({
      state: { pageNumber: 2, pane: "document", version: 0 },
      pending: null,
      pane: "markdown",
      pageNumber: Number.NaN,
    })

    expect(transition.state).toMatchObject({
      pageNumber: 1,
      pane: "markdown",
    })
    expect(transition.scrollTarget).toMatchObject({
      pane: "document",
      pageNumber: 1,
    })
  })
})
