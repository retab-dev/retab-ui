// @vitest-environment jsdom

import * as React from "react"
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  createPageMarkdownLayout,
  getPageMarkdownPageLayout,
} from "@/components/viewers/page-markdown/page-markdown-layout"
import {
  usePageMarkdownMeasurements,
  usePageMarkdownScrollAnchor,
} from "@/components/viewers/page-markdown/page-markdown-measurements"
import { type PageMarkdownViewMode } from "@/components/viewers/page-markdown/page-markdown-types"

const pages = ["# One\n\nAlpha", "# Two\n\nBeta", "# Three\n\nGamma"]

describe("page markdown measurements", () => {
  afterEach(() => {
    cleanup()
  })

  it("isolates measurements by mode, scale, and markdown content", () => {
    const harnessState = {
      setPageHeight: null as ((pageNumber: number, height: number) => void) | null,
    }

    function Harness({
      mode,
      pages,
      scale,
    }: {
      mode: PageMarkdownViewMode
      pages: readonly string[]
      scale: number
    }) {
      const result = usePageMarkdownMeasurements({ mode, pages, scale })
      harnessState.setPageHeight = result.setPageHeight
      return (
        <output data-testid="measurements">
          {Array.from(result.measuredHeightByPageNumber.entries())
            .map(([pageNumber, height]) => `${pageNumber}:${height}`)
            .join(",")}
        </output>
      )
    }

    const view = render(<Harness mode="rendered" pages={pages} scale={1} />)

    act(() => {
      harnessState.setPageHeight!(2, 420)
    })
    expect(screen.getByTestId("measurements").textContent).toBe("2:420")

    view.rerender(<Harness mode="text" pages={pages} scale={1} />)
    expect(screen.getByTestId("measurements").textContent).toBe("")

    view.rerender(<Harness mode="rendered" pages={pages} scale={1.2} />)
    expect(screen.getByTestId("measurements").textContent).toBe("")

    view.rerender(
      <Harness
        mode="rendered"
        pages={[pages[0]!, "# Replacement\n\nBeta", pages[2]!]}
        scale={1}
      />
    )
    expect(screen.getByTestId("measurements").textContent).toBe("")

    view.rerender(<Harness mode="rendered" pages={pages} scale={1} />)
    expect(screen.getByTestId("measurements").textContent).toBe("2:420")
  })

  it("preserves scroll offset within the anchor page when measurements change", () => {
    const viewport = document.createElement("div") as HTMLDivElement
    viewport.scrollTop = 260
    const restoreCalls: number[] = []

    function Harness() {
      const measurement = usePageMarkdownMeasurements({
        mode: "rendered",
        pages,
        scale: 1,
      })
      const layout = React.useMemo(
        () =>
          createPageMarkdownLayout({
            measuredHeightByPageNumber: measurement.measuredHeightByPageNumber,
            mode: "rendered",
            pages,
            scale: 1,
          }),
        [measurement.measuredHeightByPageNumber]
      )
      const { captureScrollAnchor } = usePageMarkdownScrollAnchor({
        layout,
        onRestore: () => restoreCalls.push(viewport.scrollTop),
        viewportElement: viewport,
      })

      return (
        <button
          type="button"
          onClick={() => measurement.setPageHeight(1, 360, captureScrollAnchor)}
        >
          measure
        </button>
      )
    }

    render(<Harness />)
    const initialLayout = createPageMarkdownLayout({
      measuredHeightByPageNumber: new Map(),
      mode: "rendered",
      pages,
      scale: 1,
    })
    const initialAnchorPage = getPageMarkdownPageLayout(initialLayout, 2)!
    expect(viewport.scrollTop).toBeGreaterThan(initialAnchorPage.offsetTop)
    const offsetWithinAnchorPage =
      viewport.scrollTop - initialAnchorPage.offsetTop

    act(() => {
      screen.getByRole("button", { name: "measure" }).click()
    })

    const expectedLayout = createPageMarkdownLayout({
      measuredHeightByPageNumber: new Map([[1, 360]]),
      mode: "rendered",
      pages,
      scale: 1,
    })
    const expectedAnchorPage = getPageMarkdownPageLayout(expectedLayout, 2)!
    expect(viewport.scrollTop).toBe(
      expectedAnchorPage.offsetTop + offsetWithinAnchorPage
    )
    expect(restoreCalls.at(-1)).toBe(viewport.scrollTop)
  })
})
