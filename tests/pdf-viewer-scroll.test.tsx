// @vitest-environment jsdom
import * as React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createPdfPageLayout } from "@/registry/new-york-v4/ui/pdf-viewer-layout"
import { usePdfScroll } from "@/registry/new-york-v4/ui/pdf-viewer-scroll"

describe("usePdfScroll", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("uses the latest layout and callbacks for a pending scroll measurement", async () => {
    const initialLayout = createPdfPageLayout({
      pageCount: 20,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    })
    const nextLayout = createPdfPageLayout({
      pageCount: 20,
      defaultPageSize: { width: 100, height: 400 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    })
    const frameCallbacks: FrameRequestCallback[] = []
    const cancelAnimationFrame = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {})
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })

    const initialVisiblePageChange = vi.fn()
    const nextVisiblePageChange = vi.fn()
    const initialProgressChange = vi.fn()
    const nextProgressChange = vi.fn()
    let handleScroll!: () => void

    function Harness({
      layout,
      onVisiblePageChange,
      onScrollProgressChange,
    }: {
      layout: typeof initialLayout
      onVisiblePageChange: (page: number) => void
      onScrollProgressChange: (progress: number) => void
    }) {
      const viewport = React.useMemo(
        () =>
          ({
            scrollTop: 2016,
            clientHeight: 200,
            scrollHeight: 5000,
            getBoundingClientRect: () => ({ top: 0, height: 200 }) as DOMRect,
          }) as HTMLDivElement,
        []
      )
      const result = usePdfScroll({
        pageCount: 20,
        layout,
        onVisiblePageChange,
        onScrollProgressChange,
      })

      handleScroll = result.handleScroll

      React.useEffect(() => {
        result.setViewportElement(viewport)
        result.measureScroll()
        return () => result.setViewportElement(null)
      }, [result, viewport])

      return <output data-testid="page">{result.currentPage}</output>
    }

    const view = render(
      <Harness
        layout={initialLayout}
        onVisiblePageChange={initialVisiblePageChange}
        onScrollProgressChange={initialProgressChange}
      />
    )

    await waitFor(() =>
      expect(screen.getByTestId("page").textContent).toBe("10")
    )
    initialVisiblePageChange.mockClear()
    initialProgressChange.mockClear()

    act(() => {
      handleScroll()
    })
    expect(frameCallbacks).toHaveLength(1)

    view.rerender(
      <Harness
        layout={nextLayout}
        onVisiblePageChange={nextVisiblePageChange}
        onScrollProgressChange={nextProgressChange}
      />
    )

    await waitFor(() =>
      expect(screen.getByTestId("page").textContent).toBe("5")
    )
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1)

    act(() => {
      frameCallbacks[0]?.(0)
    })

    expect(initialVisiblePageChange).not.toHaveBeenCalled()
    expect(initialProgressChange).not.toHaveBeenCalled()
    expect(nextProgressChange).toHaveBeenCalled()
    expect(screen.getByTestId("page").textContent).toBe("5")
  })
})
