// @vitest-environment jsdom

import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { type ParseResponse } from "@/components/viewers/lib/parse-types"
import {
  createPageMarkdownLayout,
  estimateMarkdownPageHeight,
  findPageMarkdownPageByOffset,
  getPageMarkdownPageLayout,
  getPageMarkdownVisiblePageNumbers,
} from "@/components/viewers/page-markdown/page-markdown-layout"
import {
  initialPageMarkdownSyncState,
  resolvePageMarkdownSyncReport,
  usePageMarkdownSync,
} from "@/components/viewers/page-markdown/page-markdown-sync"
import {
  ParseViewer,
  ParseViewerMarkdown,
  ParseViewerProvider,
  useParseViewerDocument,
} from "@/components/viewers/parse/parse-viewer"

const PAGES = [
  "# Invoice\n\nTotal: **$42.00**",
  "## Line items\n\n| Item | Price |\n| --- | ---: |\n| Widget | $42.00 |",
]
const PAGE_WIDTH = 768
const FIT_PADDING = 32

function parseResult(
  overrides: Partial<ParseResponse["output"]> = {},
  document?: ParseResponse["document"]
): ParseResponse {
  return {
    ...(document ? { document } : {}),
    output: {
      pages: PAGES,
      text: PAGES.join("\n\n"),
      ...overrides,
    },
  } satisfies ParseResponse
}

function ParseViewerSyncHarness({
  children,
  onVisiblePageChange,
  result = parseResult(),
}: {
  children: React.ReactNode
  onVisiblePageChange?: (pageNumber: number) => void
  result?: ParseResponse | null
}) {
  return (
    <ParseViewerProvider
      result={result}
      onVisiblePageChange={onVisiblePageChange}
    >
      {children}
      <ParseViewerMarkdown />
    </ParseViewerProvider>
  )
}

function ReportParseDocumentPageButton({
  label,
  pageNumber,
}: {
  label: string
  pageNumber: number
}) {
  const document = useParseViewerDocument()

  return (
    <button
      type="button"
      onClick={() => document.onCurrentPageChange(pageNumber)}
    >
      {label}
    </button>
  )
}

function ParseDocumentScrollSpy({
  children,
  onScroll,
}: {
  children?: React.ReactNode
  onScroll: (pageNumber: number, options?: ScrollToOptions) => void
}) {
  const document = useParseViewerDocument()

  React.useLayoutEffect(() => {
    document.setDocumentHandle({ scrollToPage: onScroll })
    return () => document.setDocumentHandle(null)
  }, [document, onScroll])

  return <>{children}</>
}

function rect(top: number, height = 100): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    width: 100,
    height,
    right: 100,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect
}

function markdownPageOffset(pages: readonly string[], pageNumber: number) {
  const layout = createPageMarkdownLayout({
    measuredHeightByPageNumber: new Map(),
    mode: "rendered",
    pages,
    scale: 1,
  })
  return getPageMarkdownPageLayout(layout, pageNumber)!.offsetTop
}

function scrollMarkdownViewportToPage(
  viewport: HTMLElement,
  pages: readonly string[],
  pageNumber: number
) {
  vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(rect(0, 400))
  viewport.scrollTop = markdownPageOffset(pages, pageNumber)
  fireEvent.scroll(viewport)
}

function markdownViewport(container: HTMLElement) {
  return container.querySelector<HTMLElement>(
    '[data-slot="scroll-area-viewport"]'
  )!
}

function pageSlots(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll('[data-slot="page-markdown-page-slot"]')
  )
}

function zoomPercent() {
  const match = screen
    .getAllByText(/^\d+%$/)
    .map((node) => node.textContent)
    .find(Boolean)
  return match
}

function renderedPageWidth(container: ParentNode = document) {
  const page = container.querySelector<HTMLElement>(
    '[data-slot="page-markdown-page"]'
  )
  return page ? Number.parseFloat(page.style.width) : null
}

function fitScaleForWidth(width: number) {
  return (width - FIT_PADDING) / PAGE_WIDTH
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal(
    "IntersectionObserver",
    class MockIntersectionObserver {
      private callback: IntersectionObserverCallback

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
      }

      observe(target: Element) {
        this.callback(
          [
            {
              target,
              isIntersecting: true,
              intersectionRatio: 1,
              boundingClientRect: target.getBoundingClientRect(),
              intersectionRect: target.getBoundingClientRect(),
              rootBounds: null,
              time: 0,
            } as IntersectionObserverEntry,
          ],
          this as unknown as IntersectionObserver
        )
      }

      disconnect() {}
      takeRecords() {
        return []
      }
      unobserve() {}
    }
  )
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 800,
  })
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => 0,
  })
  HTMLElement.prototype.getAnimations = vi.fn(() => [])
  HTMLElement.prototype.scrollIntoView = vi.fn()
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(function (
      this: HTMLElement,
      options?: ScrollToOptions | number,
      y?: number
    ) {
      this.scrollTop =
        typeof options === "number" ? (y ?? options) : Number(options?.top ?? 0)
    }),
  })
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("ParseViewer view mode", () => {
  it("renders markdown as HTML in the default rendered mode", async () => {
    render(<ParseViewer result={parseResult()} />)

    const heading = await screen.findByText("Invoice")
    expect(heading.tagName).toBe("H1")
  })

  it("shows the literal markdown source in text mode", async () => {
    const { container } = render(<ParseViewer result={parseResult()} />)

    fireEvent.click(screen.getByRole("tab", { name: "Text" }))

    await waitFor(() => {
      expect(
        Array.from(container.querySelectorAll("pre")).some(
          (pre) => pre.textContent === PAGES[0]
        )
      ).toBe(true)
    })
    expect(screen.queryByText("Invoice")).toBeNull()
  })

  it("preserves text mode when re-rendered with the same document", async () => {
    const result = parseResult({}, { id: "doc-stable" })
    const { container, rerender } = render(<ParseViewer result={result} />)

    fireEvent.click(screen.getByRole("tab", { name: "Text" }))
    await waitFor(() => {
      expect(
        Array.from(container.querySelectorAll("pre")).some(
          (pre) => pre.textContent === PAGES[0]
        )
      ).toBe(true)
    })

    rerender(<ParseViewer result={parseResult({}, { id: "doc-stable" })} />)

    expect(
      Array.from(container.querySelectorAll("pre")).some(
        (pre) => pre.textContent === PAGES[0]
      )
    ).toBe(true)
    expect(screen.queryByText("Invoice")).toBeNull()
  })

  it("resets text mode back to rendered when the parsed document changes", async () => {
    const { container, rerender } = render(
      <ParseViewer result={parseResult({}, { id: "doc-one" })} />
    )

    fireEvent.click(screen.getByRole("tab", { name: "Text" }))
    await waitFor(() => {
      expect(
        Array.from(container.querySelectorAll("pre")).some(
          (pre) => pre.textContent === PAGES[0]
        )
      ).toBe(true)
    })

    rerender(
      <ParseViewer
        result={parseResult(
          {
            pages: ["# Receipt\n\nPaid in full"],
            text: "# Receipt\n\nPaid in full",
          },
          { id: "doc-two" }
        )}
      />
    )

    const heading = await screen.findByText("Receipt")
    expect(heading.tagName).toBe("H1")
    expect(
      Array.from(container.querySelectorAll("pre")).some((pre) =>
        pre.textContent?.includes("# Receipt")
      )
    ).toBe(false)
  })
})

describe("ParseViewer zoom controls", () => {
  it("starts at fit-width scale for a typical container", () => {
    render(<ParseViewer result={parseResult()} />)

    expect(zoomPercent()).toBe("100%")
  })

  it("increases and decreases the zoom percentage", () => {
    render(<ParseViewer result={parseResult()} />)

    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(zoomPercent()).toBe("120%")

    fireEvent.click(screen.getByLabelText("Zoom out"))
    expect(zoomPercent()).toBe("100%")

    fireEvent.click(screen.getByLabelText("Zoom out"))
    expect(zoomPercent()).toBe("83%")
  })

  it("clamps zoom-in at the maximum scale", () => {
    render(<ParseViewer result={parseResult()} />)

    for (let click = 0; click < 12; click += 1) {
      fireEvent.click(screen.getByLabelText("Zoom in"))
    }

    expect(zoomPercent()).toBe("300%")
  })

  it("clamps zoom-out at the minimum scale", () => {
    render(<ParseViewer result={parseResult()} />)

    for (let click = 0; click < 14; click += 1) {
      fireEvent.click(screen.getByLabelText("Zoom out"))
    }

    expect(zoomPercent()).toBe("35%")
  })

  it("returns to fit width after zooming", () => {
    render(<ParseViewer result={parseResult()} />)

    fireEvent.click(screen.getByLabelText("Zoom in"))
    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(zoomPercent()).not.toBe("100%")

    fireEvent.click(screen.getByLabelText("Fit width"))
    expect(zoomPercent()).toBe("100%")
  })

  it("resets the manual zoom when the parsed document changes", () => {
    const { rerender } = render(
      <ParseViewer result={parseResult({}, { id: "doc-one" })} />
    )

    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(zoomPercent()).toBe("120%")

    rerender(<ParseViewer result={parseResult({}, { id: "doc-two" })} />)

    expect(zoomPercent()).toBe("100%")
  })

  it("keeps the manual zoom when re-rendered with the same document", () => {
    const { rerender } = render(
      <ParseViewer result={parseResult({}, { id: "doc-stable" })} />
    )

    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(zoomPercent()).toBe("120%")

    rerender(<ParseViewer result={parseResult({}, { id: "doc-stable" })} />)

    expect(zoomPercent()).toBe("120%")
  })
})

describe("ParseViewer text fallback", () => {
  it("copies the joined pages when the parse output omits text", () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    const resultWithoutText = {
      output: { pages: ["# Alpha", "# Beta"] },
    } as unknown as ParseResponse

    render(<ParseViewer result={resultWithoutText} />)

    fireEvent.click(screen.getByLabelText("Copy markdown"))

    expect(writeText).toHaveBeenCalledWith("# Alpha\n\n# Beta")
  })

  it("downloads the joined pages when the parse output omits text", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:fallback")
    const revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    })

    const resultWithoutText = {
      output: { pages: ["# Alpha", "# Beta"] },
    } as unknown as ParseResponse

    render(<ParseViewer result={resultWithoutText} />)

    fireEvent.click(screen.getByLabelText("Download markdown"))

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    })
    const blob = createObjectURL.mock.calls[0][0]
    expect(await blob.text()).toBe("# Alpha\n\n# Beta")
  })
})

describe("ParseViewer empty + degenerate inputs", () => {
  it("shows the empty state when output is present but has no pages", () => {
    render(
      <ParseViewer result={{ output: { pages: [], text: "leftover text" } }} />
    )

    expect(screen.getByText("No markdown pages yet")).toBeTruthy()
    expect(screen.queryByText("Page 1 of 1")).toBeNull()
  })

  it("shows the empty state when the output is null", () => {
    render(<ParseViewer result={{ output: null }} />)

    expect(screen.getByText("No markdown pages yet")).toBeTruthy()
  })

  it("renders a single empty-string page without crashing", () => {
    render(<ParseViewer result={{ output: { pages: [""], text: "" } }} />)

    expect(screen.getByText("Page 1 of 1")).toBeTruthy()
  })

  it("renders a single page as Page 1 of 1", async () => {
    render(
      <ParseViewer
        result={{ output: { pages: ["# Only page"], text: "# Only page" } }}
      />
    )

    expect(screen.getByText("Page 1 of 1")).toBeTruthy()
    expect((await screen.findByText("Only page")).tagName).toBe("H1")
  })
})

describe("ParseViewer virtualization", () => {
  it("mounts the public parse viewer at the fitted scale without an initial full-width page", async () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 638,
    })

    const { container } = render(<ParseViewer result={parseResult()} />)

    expect(await screen.findByText("Page 1 of 2")).toBeTruthy()
    expect(screen.getByText("79%")).toBeTruthy()
    expect(screen.queryByText("100%")).toBeNull()
    expect(renderedPageWidth(container)).toBeCloseTo(
      PAGE_WIDTH * fitScaleForWidth(638),
      1
    )
  })

  it("only mounts a windowed subset of many pages", () => {
    const manyPages = Array.from(
      { length: 50 },
      (_, index) => `# Page ${index + 1}`
    )
    const { container } = render(
      <ParseViewer
        result={{ output: { pages: manyPages, text: manyPages.join("\n\n") } }}
      />
    )

    expect(screen.getByText("Page 1 of 50")).toBeTruthy()

    const slots = pageSlots(container)
    expect(slots.length).toBeGreaterThan(0)
    expect(slots.length).toBeLessThan(50)
    expect(
      container.querySelector(
        '[data-slot="page-markdown-page-slot"][data-page-number="1"]'
      )
    ).toBeTruthy()
    expect(
      container.querySelector(
        '[data-slot="page-markdown-page-slot"][data-page-number="50"]'
      )
    ).toBeNull()
  })
})

describe("ParseViewer document sync", () => {
  it("does not echo document-initiated page changes back through onVisiblePageChange", async () => {
    const onVisiblePageChange = vi.fn()
    render(
      <ParseViewerSyncHarness onVisiblePageChange={onVisiblePageChange}>
        <ReportParseDocumentPageButton
          label="Source document page 2"
          pageNumber={2}
        />
      </ParseViewerSyncHarness>
    )

    onVisiblePageChange.mockClear()

    fireEvent.click(
      screen.getByRole("button", { name: "Source document page 2" })
    )

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeTruthy()
    })
    expect(onVisiblePageChange).not.toHaveBeenCalled()
  })

  it("scrolls the source document to the markdown page the reader scrolls to", () => {
    const onDocumentScroll = vi.fn()
    const { container } = render(
      <ParseViewerSyncHarness>
        <ParseDocumentScrollSpy onScroll={onDocumentScroll}>
          <div>
            <div data-page-number="1">Document page 1</div>
            <div data-page-number="2">Document page 2</div>
          </div>
        </ParseDocumentScrollSpy>
      </ParseViewerSyncHarness>
    )

    scrollMarkdownViewportToPage(markdownViewport(container), PAGES, 2)

    expect(onDocumentScroll).toHaveBeenCalledWith(2)
  })

  it("floors fractional document page reports", async () => {
    render(
      <ParseViewerSyncHarness>
        <ReportParseDocumentPageButton
          label="Source fractional page"
          pageNumber={2.9}
        />
      </ParseViewerSyncHarness>
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Source fractional page" })
    )

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeTruthy()
    })
  })

  it("clamps non-positive document page reports to the first page", async () => {
    render(
      <ParseViewerSyncHarness>
        <ReportParseDocumentPageButton label="go forward" pageNumber={2} />
        <ReportParseDocumentPageButton
          label="go before start"
          pageNumber={-3}
        />
      </ParseViewerSyncHarness>
    )

    fireEvent.click(screen.getByRole("button", { name: "go forward" }))
    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeTruthy()
    })

    fireEvent.click(screen.getByRole("button", { name: "go before start" }))
    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeTruthy()
    })
  })

  it("clamps the page indicator when a shorter document replaces a longer one", async () => {
    const { rerender } = render(
      <ParseViewerSyncHarness result={parseResult({}, { id: "long" })}>
        <ReportParseDocumentPageButton
          label="Source document page 2"
          pageNumber={2}
        />
      </ParseViewerSyncHarness>
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Source document page 2" })
    )
    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeTruthy()
    })

    rerender(
      <ParseViewerSyncHarness
        result={parseResult(
          { pages: ["# Solo"], text: "# Solo" },
          { id: "long" }
        )}
      >
        <ReportParseDocumentPageButton
          label="Source document page 1"
          pageNumber={1}
        />
      </ParseViewerSyncHarness>
    )

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 1")).toBeTruthy()
    })
  })
})

describe("ParseViewer action freshness", () => {
  it("copies the text of the current result after it changes", async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    const { rerender } = render(
      <ParseViewer result={parseResult({ text: "first text" }, { id: "a" })} />
    )

    fireEvent.click(screen.getByLabelText("Copy markdown"))
    expect(writeText).toHaveBeenLastCalledWith("first text")

    rerender(
      <ParseViewer result={parseResult({ text: "second text" }, { id: "b" })} />
    )

    fireEvent.click(screen.getByLabelText("Copy markdown"))
    expect(writeText).toHaveBeenLastCalledWith("second text")
  })

  it("downloads the text of the current result after it changes", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:fresh")
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    })

    const { rerender } = render(
      <ParseViewer result={parseResult({ text: "alpha" }, { id: "a" })} />
    )

    rerender(
      <ParseViewer result={parseResult({ text: "omega" }, { id: "b" })} />
    )

    fireEvent.click(screen.getByLabelText("Download markdown"))

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalled()
    })
    const blob = createObjectURL.mock.calls.at(-1)![0]
    expect(await blob.text()).toBe("omega")
  })
})

describe("ParseViewer compact controls", () => {
  function withNarrowContainer() {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 320,
    })
  }

  it("collapses the markdown actions into an overflow menu when narrow", () => {
    withNarrowContainer()
    render(<ParseViewer result={parseResult()} />)

    expect(screen.getByLabelText("More markdown actions")).toBeTruthy()
    expect(screen.queryByLabelText("Copy markdown")).toBeNull()
    expect(screen.queryByLabelText("Download markdown")).toBeNull()
  })

  it("copies the explicit text from the overflow menu", async () => {
    withNarrowContainer()
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(<ParseViewer result={parseResult({ text: "menu copy text" })} />)

    fireEvent.click(screen.getByLabelText("More markdown actions"))

    const copyItem = await screen.findByText("Copy markdown")
    fireEvent.click(copyItem)

    expect(writeText).toHaveBeenCalledWith("menu copy text")
  })
})

describe("ParseViewer reset contract (keyed on document.id)", () => {
  // The viewer derives its reset key solely from `result.document.id`. These
  // tests characterize the consequence: when a caller does NOT supply document
  // ids, swapping to an entirely different parse result does NOT reset the view
  // mode or zoom, even though scroll position (keyed on page content) does
  // reset. This is an internally inconsistent reset surface for id-less
  // callers; see the test notes / PR discussion. If reset behavior is changed
  // to key on something that varies per parse, update these expectations.
  it("does NOT reset text mode across documents that lack ids", async () => {
    const { container, rerender } = render(
      <ParseViewer
        result={{ output: { pages: ["# Inv\n\nx"], text: "# Inv\n\nx" } }}
      />
    )

    fireEvent.click(screen.getByRole("tab", { name: "Text" }))
    await waitFor(() => {
      expect(container.querySelectorAll("pre").length).toBeGreaterThan(0)
    })

    rerender(
      <ParseViewer
        result={{
          output: { pages: ["# Receipt\n\ny"], text: "# Receipt\n\ny" },
        }}
      />
    )

    // Still in text mode: the new heading shows as literal source, not an <h1>.
    await waitFor(() => {
      expect(
        Array.from(container.querySelectorAll("pre")).some((pre) =>
          pre.textContent?.includes("# Receipt")
        )
      ).toBe(true)
    })
    expect(screen.queryByText("Receipt")).toBeNull()
  })

  it("does NOT reset zoom across documents that lack ids", () => {
    const { rerender } = render(
      <ParseViewer result={{ output: { pages: ["# A"], text: "# A" } }} />
    )

    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(zoomPercent()).toBe("120%")

    rerender(
      <ParseViewer result={{ output: { pages: ["# B"], text: "# B" } }} />
    )

    expect(zoomPercent()).toBe("120%")
  })
})

describe("ParseViewer initial visibility callback", () => {
  it("does not fire a spurious visible-page callback on mount", async () => {
    const onVisiblePageChange = vi.fn()
    const { container } = render(
      <ParseViewer
        result={parseResult()}
        onVisiblePageChange={onVisiblePageChange}
      />
    )

    // Let any mount effects flush.
    await screen.findByText("Invoice")
    expect(onVisiblePageChange).not.toHaveBeenCalled()

    // The callback only fires once the reader actually scrolls.
    scrollMarkdownViewportToPage(markdownViewport(container), PAGES, 2)
    expect(onVisiblePageChange).toHaveBeenCalledWith(2)
  })
})

describe("ParseViewer keyboard navigation", () => {
  const NAV_PAGES = [
    "# One\n\nAlpha",
    "# Two\n\nBeta",
    "# Three\n\nGamma",
    "# Four\n\nDelta",
  ]

  function renderNavViewer() {
    const result = {
      output: { pages: NAV_PAGES, text: NAV_PAGES.join("\n\n") },
    }
    const view = render(<ParseViewer result={result} />)
    const viewport = markdownViewport(view.container)
    const layout = createPageMarkdownLayout({
      measuredHeightByPageNumber: new Map(),
      mode: "rendered",
      pages: NAV_PAGES,
      scale: 1,
    })
    Object.defineProperty(viewport, "scrollHeight", {
      configurable: true,
      get: () => layout.totalHeight,
    })
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(rect(0, 300))
    return { viewport }
  }

  it("jumps to the last page on End and back to the first on Home", async () => {
    const { viewport } = renderNavViewer()
    await screen.findByText("One")

    fireEvent.keyDown(viewport, { key: "End" })
    await waitFor(() => {
      expect(screen.getByText("Page 4 of 4")).toBeTruthy()
    })
    expect(viewport.scrollTop).toBeGreaterThan(0)

    fireEvent.keyDown(viewport, { key: "Home" })
    await waitFor(() => {
      expect(screen.getByText("Page 1 of 4")).toBeTruthy()
    })
    expect(viewport.scrollTop).toBe(0)
  })

  it("does not navigate when a modifier key is held", async () => {
    const { viewport } = renderNavViewer()
    await screen.findByText("One")

    fireEvent.keyDown(viewport, { key: "End", ctrlKey: true })
    fireEvent.keyDown(viewport, { key: "End", metaKey: true })

    expect(viewport.scrollTop).toBe(0)
    expect(screen.getByText("Page 1 of 4")).toBeTruthy()
  })
})

describe("ParseViewer measured-height reflow", () => {
  const REFLOW_PAGES = [
    "# One\n\nAlpha",
    "# Two\n\nBeta",
    "# Three\n\nGamma",
    "# Four\n\nDelta",
  ]

  it("grows the scroll container when pages measure taller than estimated", async () => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.getAttribute?.("data-slot") === "page-markdown-page"
          ? 600
          : 0
      },
    })

    const { container } = render(
      <ParseViewer
        result={{
          output: { pages: REFLOW_PAGES, text: REFLOW_PAGES.join("\n\n") },
        }}
      />
    )
    await screen.findByText("One")

    const inner = container.querySelector<HTMLElement>(".relative.mx-auto")!
    const estimatedTotalHeight = createPageMarkdownLayout({
      measuredHeightByPageNumber: new Map(),
      mode: "rendered",
      pages: REFLOW_PAGES,
      scale: 1,
    }).totalHeight

    await waitFor(() => {
      expect(parseFloat(inner.style.height)).toBeGreaterThan(
        estimatedTotalHeight
      )
    })
  })
})

describe("adversarial markdown height estimation", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["unterminated code fence", "```ts\nconst a = 1\nmore code\nstill open"],
    ["lone fence at end of input", "paragraph\n```"],
    ["tilde fence", "~~~\ncode block\n~~~"],
    ["table without a separator row", "| a | b |\n| c | d |"],
    ["separator row only", "| --- | --- |"],
    ["seven hash marks", "####### not really a heading"],
    ["only blank lines", "\n\n\n\n\n"],
    ["windows line endings", "line one\r\nline two\r\n"],
    ["stacked fence markers", "```\n```\n```\n```"],
    ["pipe-heavy line", "|".repeat(500)],
    ["very deep list", Array.from({ length: 300 }, () => "- item").join("\n")],
    ["empty string", ""],
  ]

  for (const [name, markdown] of cases) {
    it(`stays finite and within bounds: ${name}`, () => {
      for (const mode of ["rendered", "text"] as const) {
        const height = estimateMarkdownPageHeight(markdown, 1, mode)
        expect(Number.isFinite(height)).toBe(true)
        expect(height).toBeGreaterThanOrEqual(180)
        expect(height).toBeLessThanOrEqual(1800)
      }
    })
  }

  it("keeps page offsets strictly increasing with mixed tiny and large measured heights", () => {
    const pages = Array.from(
      { length: 8 },
      (_, index) => `# Page ${index + 1}\n\nbody ${index}`
    )
    const layout = createPageMarkdownLayout({
      measuredHeightByPageNumber: new Map([
        [2, 5],
        [4, 1],
        [6, 2000],
      ]),
      mode: "rendered",
      pages,
      scale: 1,
    })

    let previousOffset = -Infinity
    for (let pageNumber = 1; pageNumber <= pages.length; pageNumber += 1) {
      const offset = getPageMarkdownPageLayout(layout, pageNumber)!.offsetTop
      expect(offset).toBeGreaterThan(previousOffset)
      previousOffset = offset
      expect(findPageMarkdownPageByOffset(layout, offset)).toBe(pageNumber)
    }
  })
})

describe("page markdown sync edge cases", () => {
  it("clamps zero and negative reported pages to the first page", () => {
    expect(
      resolvePageMarkdownSyncReport({
        state: { pageNumber: 2, pane: "document" },
        pending: null,
        pane: "markdown",
        pageNumber: 0,
      }).state
    ).toMatchObject({ pageNumber: 1, pane: "markdown" })

    expect(
      resolvePageMarkdownSyncReport({
        state: { pageNumber: 2, pane: "document" },
        pending: null,
        pane: "markdown",
        pageNumber: -10,
      }).state
    ).toMatchObject({ pageNumber: 1, pane: "markdown" })
  })

  it("round-trips a markdown-initiated change confirmed by the document pane", () => {
    const requested = resolvePageMarkdownSyncReport({
      state: initialPageMarkdownSyncState(),
      pending: null,
      pane: "markdown",
      pageNumber: 4,
    })
    expect(requested.scrollTarget).toMatchObject({
      pane: "document",
      pageNumber: 4,
    })

    const confirmed = resolvePageMarkdownSyncReport({
      state: requested.state,
      pending: requested.pending,
      pane: "document",
      pageNumber: 4,
    })

    expect(confirmed.confirmed).toBe(true)
    expect(confirmed.pending).toBeNull()
    expect(confirmed.scrollTarget).toBeNull()
    expect(confirmed.state).toMatchObject({ pageNumber: 4, pane: "document" })
  })

  it("keeps sync identity structural instead of exposing replay versions", () => {
    let transition = resolvePageMarkdownSyncReport({
      state: initialPageMarkdownSyncState(),
      pending: null,
      pane: "markdown",
      pageNumber: 2,
    })

    expect(transition.state).toEqual({ pageNumber: 2, pane: "markdown" })
    expect(transition.pending).toEqual({ pageNumber: 2, pane: "document" })

    transition = resolvePageMarkdownSyncReport({
      state: transition.state,
      pending: transition.pending,
      pane: "document",
      pageNumber: 2,
    })

    expect(transition.state).toEqual({ pageNumber: 2, pane: "document" })
    expect(transition.pending).toBeNull()
    expect(transition.state).not.toHaveProperty("version")
  })
})

describe("page markdown layout edge cases", () => {
  it("returns the first page when locating an offset in an empty layout", () => {
    const layout = createPageMarkdownLayout({
      measuredHeightByPageNumber: new Map(),
      mode: "rendered",
      pages: [],
      scale: 1,
    })

    expect(findPageMarkdownPageByOffset(layout, 500)).toBe(1)
  })

  it("includes the first page for negative scroll offsets", () => {
    const layout = createPageMarkdownLayout({
      measuredHeightByPageNumber: new Map(),
      mode: "rendered",
      pages: ["# A", "# B", "# C"],
      scale: 1,
    })

    expect(
      getPageMarkdownVisiblePageNumbers({
        layout,
        scrollTop: -200,
        viewportHeight: 300,
      })
    ).toContain(1)
  })

  it("ignores measured heights for out-of-range page numbers", () => {
    const layout = createPageMarkdownLayout({
      measuredHeightByPageNumber: new Map([
        [0, 500],
        [99, 999],
      ]),
      mode: "rendered",
      pages: ["# A", "# B"],
      scale: 1,
    })

    expect(layout.measuredPages).toEqual([])
    expect(getPageMarkdownPageLayout(layout, 1)!.height).toBe(180)
    expect(getPageMarkdownPageLayout(layout, 2)!.height).toBe(180)
  })

  it("ignores non-finite and non-positive measured heights", () => {
    const layout = createPageMarkdownLayout({
      measuredHeightByPageNumber: new Map([
        [1, Number.NaN],
        [2, 0],
      ]),
      mode: "rendered",
      pages: ["# A", "# B"],
      scale: 1,
    })

    expect(layout.measuredPages).toEqual([])
  })
})

describe("usePageMarkdownSync live clamping", () => {
  it("clamps the current page when the page count shrinks", () => {
    const onMarkdownPageChange = vi.fn()
    const { result, rerender } = renderHook(
      ({ pageCount }) =>
        usePageMarkdownSync({
          onMarkdownPageChange,
          pageCount,
          resetKey: "stable",
        }),
      { initialProps: { pageCount: 5 } }
    )

    let scrollTarget: unknown
    act(() => {
      scrollTarget = result.current.reportDocumentPage(5)
    })
    expect(result.current.currentPage).toBe(5)
    expect(scrollTarget).toMatchObject({ pane: "markdown", pageNumber: 5 })

    act(() => {
      rerender({ pageCount: 2 })
    })
    expect(result.current.currentPage).toBe(2)
  })

  it("resets to the first page when the reset key changes", () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => usePageMarkdownSync({ pageCount: 5, resetKey }),
      { initialProps: { resetKey: "a" } }
    )

    act(() => {
      result.current.reportDocumentPage(4)
    })
    expect(result.current.currentPage).toBe(4)

    act(() => {
      rerender({ resetKey: "b" })
    })
    expect(result.current.currentPage).toBe(1)
  })

  it("does not emit a markdown callback for document-pane reports", () => {
    const onMarkdownPageChange = vi.fn()
    const { result } = renderHook(() =>
      usePageMarkdownSync({ onMarkdownPageChange, pageCount: 5, resetKey: "k" })
    )

    act(() => {
      result.current.reportDocumentPage(3)
    })

    expect(onMarkdownPageChange).not.toHaveBeenCalled()
    expect(result.current.currentPage).toBe(3)
  })

  it("emits a markdown callback for markdown-pane reports", () => {
    const onMarkdownPageChange = vi.fn()
    const { result } = renderHook(() =>
      usePageMarkdownSync({ onMarkdownPageChange, pageCount: 5, resetKey: "k" })
    )

    act(() => {
      result.current.reportMarkdownPage(3)
    })

    expect(onMarkdownPageChange).toHaveBeenCalledWith(3)
  })
})

describe("ParseViewer text mode rendering", () => {
  it("renders each visible page as its own preformatted block", async () => {
    const { container } = render(<ParseViewer result={parseResult()} />)

    fireEvent.click(screen.getByRole("tab", { name: "Text" }))

    await waitFor(() => {
      const blocks = Array.from(container.querySelectorAll("pre")).map(
        (pre) => pre.textContent
      )
      expect(blocks).toContain(PAGES[0])
      expect(blocks).toContain(PAGES[1])
    })
  })

  it("survives rapid mode toggling and lands back in rendered mode", async () => {
    render(<ParseViewer result={parseResult()} />)

    for (let toggle = 0; toggle < 6; toggle += 1) {
      fireEvent.click(screen.getByRole("tab", { name: "Text" }))
      fireEvent.click(screen.getByRole("tab", { name: "Rendered" }))
    }

    expect((await screen.findByText("Invoice")).tagName).toBe("H1")
  })
})

describe("ParseViewer two-pane layout", () => {
  it("renders both the source document pane and the markdown controls", () => {
    render(
      <ParseViewerSyncHarness>
        <div data-testid="source-doc">Document body</div>
      </ParseViewerSyncHarness>
    )

    expect(screen.getByTestId("source-doc")).toBeTruthy()
    expect(screen.getByText("Page 1 of 2")).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Rendered" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Text" })).toBeTruthy()
  })
})

describe("page markdown fuzz invariants", () => {
  type SyncPane = "markdown" | "document"
  type SyncState = ReturnType<typeof initialPageMarkdownSyncState>
  type Pending = NonNullable<
    ReturnType<typeof resolvePageMarkdownSyncReport>["pending"]
  >

  function makeRng(seed: number) {
    let state = seed >>> 0
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state / 0x100000000
    }
  }

  function pick<T>(random: () => number, options: readonly T[]): T {
    return options[Math.floor(random() * options.length)]!
  }

  it("keeps the sync reducer invariant and deadlock-free across random sequences", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = makeRng(seed)
      let state: SyncState = initialPageMarkdownSyncState()
      let pending: Pending | null = null
      const maxPage = 1 + Math.floor(random() * 8)

      for (let step = 0; step < 60; step += 1) {
        let pane: SyncPane
        let pageNumber: number
        // 60% of the time, simulate the target pane confirming our scroll.
        if (pending && random() < 0.6) {
          pane = pending.pane
          pageNumber = pending.pageNumber
        } else {
          pane = pick(random, ["markdown", "document"] as const)
          pageNumber = 1 + Math.floor(random() * maxPage)
          if (random() < 0.1) pageNumber = 0
          if (random() < 0.05) pageNumber = Number.NaN
        }

        const transition = resolvePageMarkdownSyncReport({
          state,
          pending,
          pane,
          pageNumber,
        })

        expect(transition.state.pageNumber).toBeGreaterThanOrEqual(1)
        expect(transition.state).not.toHaveProperty("version")
        if (transition.pending) {
          expect(transition.pending.pageNumber).toBeGreaterThanOrEqual(1)
          expect(transition.pending).not.toHaveProperty("version")
        }
        if (transition.confirmed) {
          expect(transition.pending).toBeNull()
          expect(transition.scrollTarget).toBeNull()
        }
        if (transition.scrollTarget) {
          expect(transition.scrollTarget).toEqual(transition.pending)
        }

        state = transition.state
        pending = transition.pending
      }

      // A cooperative target pane must let any outstanding scroll settle.
      let drains = 0
      while (pending && drains < 5) {
        const transition = resolvePageMarkdownSyncReport({
          state,
          pending,
          pane: pending.pane,
          pageNumber: pending.pageNumber,
        })
        state = transition.state
        pending = transition.pending
        drains += 1
      }
      expect(pending).toBeNull()
    }
  })

  it("keeps layout offsets monotonic, lookups round-tripping, and the window bounded", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = makeRng(seed)
      const pageCount = 1 + Math.floor(random() * 30)
      const pages = Array.from(
        { length: pageCount },
        (_, index) =>
          `# Page ${index}\n${"word ".repeat(Math.floor(random() * 40))}`
      )

      const measuredHeightByPageNumber = new Map<number, number>()
      for (let index = 0; index < pageCount; index += 1) {
        const roll = random()
        if (roll < 0.5) {
          measuredHeightByPageNumber.set(
            index + 1,
            1 + Math.floor(random() * 1500)
          )
        } else if (roll < 0.55) {
          measuredHeightByPageNumber.set(index + 1, 0)
        } else if (roll < 0.6) {
          measuredHeightByPageNumber.set(index + 1, Number.NaN)
        }
      }
      // Inject out-of-range keys that must be ignored.
      if (random() < 0.3) measuredHeightByPageNumber.set(0, 500)
      if (random() < 0.3) measuredHeightByPageNumber.set(pageCount + 5, 500)

      const mode = pick(random, ["rendered", "text"] as const)
      const scale = pick(random, [0.35, 1, 1.5, 3])
      const layout = createPageMarkdownLayout({
        measuredHeightByPageNumber,
        mode,
        pages,
        scale,
      })

      expect(Number.isFinite(layout.totalHeight)).toBe(true)
      expect(layout.totalHeight).toBeGreaterThan(0)

      let previousOffset = -Infinity
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const pageLayout = getPageMarkdownPageLayout(layout, pageNumber)!
        expect(pageLayout.offsetTop).toBeGreaterThan(previousOffset)
        previousOffset = pageLayout.offsetTop
        expect(findPageMarkdownPageByOffset(layout, pageLayout.offsetTop)).toBe(
          pageNumber
        )
        expect(
          findPageMarkdownPageByOffset(
            layout,
            pageLayout.offsetTop + pageLayout.height - 1
          )
        ).toBe(pageNumber)
      }

      for (let query = 0; query < 5; query += 1) {
        const scrollTop = (random() - 0.2) * layout.totalHeight * 1.5
        const viewportHeight = random() * 1000
        const visible = getPageMarkdownVisiblePageNumbers({
          layout,
          scrollTop,
          viewportHeight,
        })
        visible.forEach((pageNumber, index) => {
          expect(pageNumber).toBeGreaterThanOrEqual(1)
          expect(pageNumber).toBeLessThanOrEqual(pageCount)
          if (index > 0) {
            expect(pageNumber).toBe(visible[index - 1]! + 1)
          }
        })
      }
    }
  })
})

describe("ParseViewer copy status lifecycle", () => {
  it("resets the failed copy label to idle after the timeout", () => {
    vi.useFakeTimers()
    // Fake timers replace rAF too; restore the synchronous stub so the
    // controls leaves its skeleton state.
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {},
    })

    render(<ParseViewer result={parseResult()} />)
    // Flush React's scheduler so width measurement commits the real controls.
    act(() => {
      vi.runOnlyPendingTimers()
    })

    fireEvent.click(screen.getByLabelText("Copy markdown"))
    expect(screen.getByLabelText("Copy failed")).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(1300)
    })
    expect(screen.getByLabelText("Copy markdown")).toBeTruthy()
    expect(screen.queryByLabelText("Copy failed")).toBeNull()
  })

  it("ignores a stale rejection when a newer copy attempt succeeds", async () => {
    const writeText = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(new Error("stale")))
      .mockImplementationOnce(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(<ParseViewer result={parseResult()} />)

    fireEvent.click(screen.getByLabelText(/Copy/))
    fireEvent.click(screen.getByLabelText(/Copy/))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(2)
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(screen.queryByLabelText("Copy failed")).toBeNull()
  })

  it("does not throw when the copy promise settles after unmount", async () => {
    let reject: (error: unknown) => void = () => {}
    const writeText = vi.fn(
      () =>
        new Promise((_resolve, rejectPromise) => {
          reject = rejectPromise
        })
    )
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    const { unmount } = render(<ParseViewer result={parseResult()} />)
    fireEvent.click(screen.getByLabelText("Copy markdown"))
    unmount()

    expect(() => reject(new Error("late"))).not.toThrow()
    await Promise.resolve()
  })
})

describe("ParseViewer download failure without a handler", () => {
  it("does not crash when createObjectURL throws and no error handler is wired", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => {
        throw new Error("blocked")
      }),
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    })

    render(<ParseViewer result={parseResult()} />)

    expect(() =>
      fireEvent.click(screen.getByLabelText("Download markdown"))
    ).not.toThrow()

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeTruthy()
    })
  })
})
