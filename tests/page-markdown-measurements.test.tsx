// @vitest-environment jsdom

import * as React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createPageMarkdownLayout,
  getPageMarkdownPageLayout,
} from "@/components/viewers/page-markdown/page-markdown-layout"
import {
  usePageMarkdownMeasurements,
  usePageMarkdownScrollAnchor,
} from "@/components/viewers/page-markdown/page-markdown-measurements"
import { PageMarkdownPageFrame } from "@/components/viewers/page-markdown/page-markdown-page-frame"

const pages = ["# One", "# Two"]

describe("page markdown measurements", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("isolates measured heights by mode, scale, and markdown signature", async () => {
    const harnessState = {
      setPageHeight: null as
        | ((pageNumber: number, height: number) => void)
        | null,
    }

    function Harness({
      mode,
      pages,
      scale,
    }: {
      mode: "rendered" | "text"
      pages: readonly string[]
      scale: number
    }) {
      const measurements = usePageMarkdownMeasurements({ mode, pages, scale })
      React.useEffect(() => {
        harnessState.setPageHeight = measurements.setPageHeight
      }, [measurements.setPageHeight])

      return (
        <output data-testid="height">
          {measurements.measuredHeightByPageNumber.get(1) ?? "none"}
        </output>
      )
    }

    const view = render(<Harness mode="rendered" pages={pages} scale={1} />)
    await waitFor(() =>
      expect(harnessState.setPageHeight).toEqual(expect.any(Function))
    )

    act(() => {
      harnessState.setPageHeight!(1, 321)
    })
    expect(screen.getByTestId("height").textContent).toBe("321")

    view.rerender(<Harness mode="text" pages={pages} scale={1} />)
    expect(screen.getByTestId("height").textContent).toBe("none")

    view.rerender(<Harness mode="rendered" pages={pages} scale={1.2} />)
    expect(screen.getByTestId("height").textContent).toBe("none")

    view.rerender(
      <Harness mode="rendered" pages={["# Changed", "# Two"]} scale={1} />
    )
    expect(screen.getByTestId("height").textContent).toBe("none")

    view.rerender(<Harness mode="rendered" pages={pages} scale={1} />)
    expect(screen.getByTestId("height").textContent).toBe("321")
  })

  it("preserves the scroll anchor when upstream measurements change", async () => {
    const viewport = {
      scrollTop: 0,
    } as HTMLDivElement
    const restore = vi.fn()
    const harnessState = {
      captureScrollAnchor: null as (() => void) | null,
    }

    function Harness({ measuredHeight }: { measuredHeight: number }) {
      const layout = createPageMarkdownLayout({
        measuredHeightByPageNumber: new Map([[1, measuredHeight]]),
        mode: "rendered",
        pages,
        scale: 1,
      })
      const anchor = usePageMarkdownScrollAnchor({
        layout,
        onRestore: restore,
        viewportElement: viewport,
      })
      React.useEffect(() => {
        harnessState.captureScrollAnchor = anchor.captureScrollAnchor
      }, [anchor.captureScrollAnchor])

      return (
        <output data-testid="page-two">
          {getPageMarkdownPageLayout(layout, 2)!.offsetTop}
        </output>
      )
    }

    const view = render(<Harness measuredHeight={200} />)
    await waitFor(() =>
      expect(harnessState.captureScrollAnchor).toEqual(expect.any(Function))
    )
    const firstPageTwoOffset = Number(
      screen.getByTestId("page-two").textContent
    )
    viewport.scrollTop = firstPageTwoOffset + 17

    act(() => {
      harnessState.captureScrollAnchor!()
    })
    view.rerender(<Harness measuredHeight={500} />)

    const nextPageTwoOffset = Number(screen.getByTestId("page-two").textContent)
    expect(viewport.scrollTop).toBe(nextPageTwoOffset + 17)
    expect(restore).toHaveBeenCalled()
  })
})

describe("PageMarkdownPageFrame measurement", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("reports measured height through ResizeObserver", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        disconnect() {}
      }
    )
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get: () => 244,
    })
    const onSize = vi.fn()

    render(
      <PageMarkdownPageFrame
        estimatedHeight={180}
        markdown="# Measured"
        mode="rendered"
        onSize={onSize}
        pageNumber={4}
        scale={1}
      />
    )

    expect(onSize).toHaveBeenCalledWith(4, 244)
  })

  it("reports a best-effort height without ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined)
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get: () => 188,
    })
    const onSize = vi.fn()

    render(
      <PageMarkdownPageFrame
        estimatedHeight={180}
        markdown="# Fallback"
        mode="text"
        onSize={onSize}
        pageNumber={2}
        scale={1}
      />
    )

    expect(onSize).toHaveBeenCalledWith(2, 188)
  })
})
