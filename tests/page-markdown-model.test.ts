import { describe, expect, it } from "vitest"

import {
  createPageMeasurementKey,
  estimateMarkdownPageHeight,
  fitPageScale,
  initialPagePaneState,
  joinMarkdownPages,
  resolvePagePaneReport,
  zoomPageScale,
} from "@/components/viewers/page-markdown/page-markdown-model"

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

  it("estimates page height within stable bounds", () => {
    expect(estimateMarkdownPageHeight("one line", 1)).toBe(180)
    expect(
      estimateMarkdownPageHeight(
        Array.from({ length: 200 }, (_, index) => `line ${index}`).join("\n"),
        1
      )
    ).toBe(1800)
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

  it("requests the opposite pane when a new pane reports a page", () => {
    const transition = resolvePagePaneReport({
      state: initialPagePaneState(),
      pending: null,
      pane: "markdown",
      page: 3,
    })

    expect(transition.state).toMatchObject({
      page: 3,
      pane: "markdown",
    })
    expect(transition.scrollTarget).toMatchObject({
      pane: "document",
      page: 3,
    })
    expect(transition.pending).toEqual(transition.scrollTarget)
  })

  it("clears pending sync when the target pane confirms the requested page", () => {
    const requested = resolvePagePaneReport({
      state: initialPagePaneState(),
      pending: null,
      pane: "document",
      page: 2,
    })

    const confirmed = resolvePagePaneReport({
      state: requested.state,
      pending: requested.pending,
      pane: "markdown",
      page: 2,
    })

    expect(confirmed.confirmed).toBe(true)
    expect(confirmed.pending).toBeNull()
    expect(confirmed.scrollTarget).toBeNull()
    expect(confirmed.state).toMatchObject({
      page: 2,
      pane: "markdown",
    })
  })

  it("does not schedule work for an unchanged page without pending sync", () => {
    expect(
      resolvePagePaneReport({
        state: initialPagePaneState(),
        pending: null,
        pane: "markdown",
        page: 1,
      })
    ).toMatchObject({
      pending: null,
      scrollTarget: null,
      confirmed: false,
    })
  })
})
