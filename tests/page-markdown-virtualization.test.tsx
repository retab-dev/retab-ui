// @vitest-environment jsdom

import * as React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createPageMarkdownLayout,
  getPageMarkdownPageLayout,
} from "@/components/viewers/page-markdown/page-markdown-layout"
import { usePageMarkdownPageVirtualization } from "@/components/viewers/page-markdown/page-markdown-virtualization"

function createLayout(pageCount: number) {
  return createPageMarkdownLayout({
    measuredHeightByPageNumber: new Map(),
    mode: "rendered",
    pages: Array.from({ length: pageCount }, (_, index) => `# Page ${index}`),
    scale: 1,
  })
}

describe("usePageMarkdownPageVirtualization", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("does not expose an invalid initial page for an empty layout", () => {
    const layout = createLayout(0)

    function Harness() {
      const result = usePageMarkdownPageVirtualization({
        layout,
        viewportElement: null,
      })

      return (
        <output data-testid="pages">
          {result.visiblePageNumbers.join(",")}
        </output>
      )
    }

    render(<Harness />)

    expect(screen.getByTestId("pages").textContent).toBe("")
  })

  it("coalesces scroll measurements into one animation frame", async () => {
    const layout = createLayout(20)
    const frameCallbacks: FrameRequestCallback[] = []
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frameCallbacks.push(callback)
        return frameCallbacks.length
      })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})

    const harnessState = {
      measureVisiblePages: null as (() => void) | null,
      viewportElement: null as HTMLDivElement | null,
    }

    function Harness() {
      const [viewport] = React.useState(
        () =>
          ({
            scrollTop: 0,
            clientHeight: 200,
          }) as HTMLDivElement
      )
      const result = usePageMarkdownPageVirtualization({
        layout,
        viewportElement: viewport,
      })

      React.useLayoutEffect(() => {
        harnessState.measureVisiblePages = result.measureVisiblePages
        harnessState.viewportElement = viewport
      }, [result.measureVisiblePages, viewport])

      return (
        <output data-testid="pages">
          {result.visiblePageNumbers.join(",")}
        </output>
      )
    }

    render(<Harness />)

    await waitFor(() =>
      expect(screen.getByTestId("pages").textContent).toBe("1,2,3,4")
    )

    harnessState.viewportElement!.scrollTop = getPageMarkdownPageLayout(
      layout,
      10
    )!.offsetTop

    act(() => {
      harnessState.measureVisiblePages!()
      harnessState.measureVisiblePages!()
      harnessState.measureVisiblePages!()
    })

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("pages").textContent).toBe("1,2,3,4")

    act(() => {
      frameCallbacks[0]?.(0)
    })

    await waitFor(() =>
      expect(screen.getByTestId("pages").textContent).toBe(
        "6,7,8,9,10,11,12,13,14"
      )
    )
  })

  it("does not compute the reset-key render from the previous scroll offset", async () => {
    const layout = createLayout(20)
    const snapshots: string[] = []

    function Harness({ resetKey }: { resetKey: string }) {
      const [viewport] = React.useState(
        () =>
          ({
            scrollTop: getPageMarkdownPageLayout(layout, 10)!.offsetTop,
            clientHeight: 200,
          }) as HTMLDivElement
      )
      const result = usePageMarkdownPageVirtualization({
        layout,
        resetKey,
        viewportElement: viewport,
      })
      const pageList = result.visiblePageNumbers.join(",")
      snapshots.push(pageList)

      return <output data-testid="pages">{pageList}</output>
    }

    const view = render(<Harness resetKey="doc-a" />)

    await waitFor(() =>
      expect(screen.getByTestId("pages").textContent).toBe(
        "6,7,8,9,10,11,12,13,14"
      )
    )

    view.rerender(<Harness resetKey="doc-b" />)

    expect(screen.getByTestId("pages").textContent).toBe("1,2,3,4")
    expect(snapshots.at(-1)).toBe("1,2,3,4")
  })
})
