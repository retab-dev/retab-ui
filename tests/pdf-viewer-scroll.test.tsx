// @vitest-environment jsdom
import * as React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createPdfPageLayout,
  getPdfPageLayout,
} from "@/registry/new-york-v4/ui/pdf-viewer-layout"
import { usePdfScroll } from "@/registry/new-york-v4/ui/pdf-viewer-scroll"

describe("usePdfScroll", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("does not expose a stale current page during the reset-key render", async () => {
    const layout = createPdfPageLayout({
      pageCount: 20,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    })

    function Harness({ resetKey }: { resetKey: string }) {
      const viewport = React.useMemo(
        () =>
          ({
            scrollTop: getPdfPageLayout(layout, 10)!.offsetTop,
            clientHeight: 200,
            scrollHeight: 5000,
            getBoundingClientRect: () => ({ top: 0, height: 200 }) as DOMRect,
          }) as HTMLDivElement,
        []
      )
      const result = usePdfScroll({
        pageCount: 20,
        layout,
        resetKey,
      })

      React.useEffect(() => {
        result.setViewportElement(viewport)
        result.measureScroll()
        return () => result.setViewportElement(null)
      }, [result, viewport])

      return <output data-testid="page">{result.currentPage}</output>
    }

    const view = render(<Harness resetKey="doc-a" />)

    await waitFor(() =>
      expect(screen.getByTestId("page").textContent).toBe("10")
    )

    view.rerender(<Harness resetKey="doc-b" />)

    expect(screen.getByTestId("page").textContent).toBe("1")
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
    const harnessState = {
      handleScroll: null as (() => void) | null,
    }

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

      React.useEffect(() => {
        harnessState.handleScroll = result.handleScroll
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
      harnessState.handleScroll!()
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
      expect(screen.getByTestId("page").textContent).toBe("10")
    )
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1)

    act(() => {
      frameCallbacks[0]?.(0)
    })

    expect(initialVisiblePageChange).not.toHaveBeenCalled()
    expect(initialProgressChange).not.toHaveBeenCalled()
    expect(nextProgressChange).toHaveBeenCalled()
    expect(screen.getByTestId("page").textContent).toBe("10")
  })

  it("preserves the semantic page anchor when the layout changes", async () => {
    const initialLayout = createPdfPageLayout({
      pageCount: 20,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    })
    const nextLayout = createPdfPageLayout({
      pageCount: 20,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 2,
      rotation: 0,
    })
    const initialPage = getPdfPageLayout(initialLayout, 10)!
    const nextPage = getPdfPageLayout(nextLayout, 10)!
    const viewport = {
      scrollTop: initialPage.offsetTop + 50,
      clientHeight: 200,
      scrollHeight: 10_000,
      getBoundingClientRect: () => ({ top: 0, height: 200 }) as DOMRect,
    } as HTMLDivElement
    const expectedScrollTop =
      nextPage.offsetTop +
      nextPage.height * ((50 + 200 * 0.2) / initialPage.height) -
      200 * 0.2

    function Harness({ layout }: { layout: typeof initialLayout }) {
      const result = usePdfScroll({
        pageCount: 20,
        layout,
        resetKey: "same-document",
      })

      React.useEffect(() => {
        result.setViewportElement(viewport)
        return () => result.setViewportElement(null)
      }, [result])

      return <output data-testid="page">{result.currentPage}</output>
    }

    const view = render(<Harness layout={initialLayout} />)

    await waitFor(() => expect(screen.getByTestId("page")).toBeTruthy())

    view.rerender(<Harness layout={nextLayout} />)

    await waitFor(() => expect(viewport.scrollTop).toBe(expectedScrollTop))
  })

  it("keeps the viewport at the document top across layout changes", async () => {
    const initialLayout = createPdfPageLayout({
      pageCount: 20,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    })
    const nextLayout = createPdfPageLayout({
      pageCount: 20,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 2,
      rotation: 0,
    })
    const viewport = {
      scrollTop: 0,
      clientHeight: 200,
      scrollHeight: 10_000,
      getBoundingClientRect: () => ({ top: 0, height: 200 }) as DOMRect,
    } as HTMLDivElement

    function Harness({ layout }: { layout: typeof initialLayout }) {
      const result = usePdfScroll({
        pageCount: 20,
        layout,
        resetKey: "same-document",
      })

      React.useEffect(() => {
        result.setViewportElement(viewport)
        return () => result.setViewportElement(null)
      }, [result])

      return <output data-testid="page">{result.currentPage}</output>
    }

    const view = render(<Harness layout={initialLayout} />)

    await waitFor(() => expect(screen.getByTestId("page")).toBeTruthy())

    view.rerender(<Harness layout={nextLayout} />)

    await waitFor(() => expect(viewport.scrollTop).toBe(0))
  })
})
