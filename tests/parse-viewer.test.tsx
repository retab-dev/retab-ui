// @vitest-environment jsdom

import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { type ParseResponse } from "@/components/viewers/lib/parse-types"
import {
  createPageMarkdownLayout,
  getPageMarkdownPageLayout,
} from "@/components/viewers/page-markdown/page-markdown-layout"
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

function parseResult(overrides: Partial<ParseResponse["output"]> = {}) {
  return {
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

function ParseDocumentStateProbe({
  onProbe,
}: {
  onProbe: (document: ReturnType<typeof useParseViewerDocument>) => void
}) {
  const document = useParseViewerDocument()

  React.useEffect(() => {
    onProbe(document)
  }, [document, onProbe])

  return <div>Source document</div>
}

function ParseDocumentScrollSpy({
  children,
  onScroll,
}: {
  children?: React.ReactNode
  onScroll: (pageNumber: number) => void
}) {
  const document = useParseViewerDocument()

  React.useEffect(() => {
    if (!document.scrollRequest) return
    onScroll(document.scrollRequest.pageNumber)
  }, [document.scrollRequest, onScroll])

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

async function findReadyMarkdownViewport(container: HTMLElement) {
  let viewport: HTMLElement | null = null
  await waitFor(() => {
    viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"][aria-label="Markdown pages"]'
    )
    expect(viewport).toBeTruthy()
  })
  return viewport!
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

describe("ParseViewer", () => {
  it("renders the empty parse state when no result is available", () => {
    render(<ParseViewer result={null} />)

    expect(screen.getByText("No markdown pages yet")).toBeTruthy()
    expect(screen.queryByText("Page 1 of 1")).toBeNull()
  })

  it("uses parse-specific processing copy while waiting for pages", () => {
    render(<ParseViewer result={null} isProcessing />)

    expect(screen.getByText("Parsing document...")).toBeTruthy()
    expect(screen.queryByText("No markdown pages yet")).toBeNull()
  })

  it("moves from processing state to rendered parse output", async () => {
    const { rerender } = render(<ParseViewer result={null} isProcessing />)

    expect(screen.getByText("Parsing document...")).toBeTruthy()

    rerender(<ParseViewer result={parseResult()} />)

    expect(screen.queryByText("Parsing document...")).toBeNull()
    expect(screen.getByText("Page 1 of 2")).toBeTruthy()
    expect(await screen.findByText("Invoice")).toBeTruthy()
  })

  it("renders parsed pages with the markdown toolbar", async () => {
    render(<ParseViewer result={parseResult()} />)

    expect(screen.getByText("Page 1 of 2")).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Rendered" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Text" })).toBeTruthy()
    expect(screen.getByLabelText("Copy markdown")).toBeTruthy()
    expect(screen.getByLabelText("Download markdown")).toBeTruthy()
    expect(await screen.findByText("Invoice")).toBeTruthy()
    expect(await screen.findByText("Line items")).toBeTruthy()
  })

  it("switches rendered parse pages into text mode", async () => {
    const { container } = render(<ParseViewer result={parseResult()} />)

    fireEvent.click(screen.getByRole("tab", { name: "Text" }))

    await waitFor(() => {
      expect(
        Array.from(container.querySelectorAll("pre")).some(
          (pre) => pre.textContent === PAGES[0]
        )
      ).toBe(true)
    })
  })

  it("copies the explicit parse text output rather than rebuilding it from pages", () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(
      <ParseViewer
        result={parseResult({
          pages: ["# Page heading", "Second page markdown"],
          text: "canonical sdk text",
        })}
      />
    )

    fireEvent.click(screen.getByLabelText("Copy markdown"))

    expect(writeText).toHaveBeenCalledWith("canonical sdk text")
  })

  it("preserves an explicit empty parse text output for copy actions", () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(
      <ParseViewer
        result={parseResult({
          pages: ["# Page heading"],
          text: "",
        })}
      />
    )

    fireEvent.click(screen.getByLabelText("Copy markdown"))

    expect(writeText).toHaveBeenCalledWith("")
  })

  it("handles missing clipboard write support without throwing", () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {},
    })

    render(<ParseViewer result={parseResult()} />)

    expect(() =>
      fireEvent.click(screen.getByLabelText("Copy markdown"))
    ).not.toThrow()
    expect(screen.getByLabelText("Copy failed")).toBeTruthy()
  })

  it("handles synchronous clipboard write failures without throwing", () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(() => {
          throw new Error("clipboard unavailable")
        }),
      },
    })

    render(<ParseViewer result={parseResult()} />)

    expect(() =>
      fireEvent.click(screen.getByLabelText("Copy markdown"))
    ).not.toThrow()
    expect(screen.getByLabelText("Copy failed")).toBeTruthy()
  })

  it("handles clipboard writers that do not return promises", () => {
    const writeText = vi.fn(() => undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(<ParseViewer result={parseResult()} />)

    expect(() =>
      fireEvent.click(screen.getByLabelText("Copy markdown"))
    ).not.toThrow()
    expect(writeText).toHaveBeenCalledWith(PAGES.join("\n\n"))
    expect(screen.queryByLabelText("Copy failed")).toBeNull()
  })

  it("downloads parse markdown using the parse file name and explicit text", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:parse-download")
    const revokeObjectURL = vi.fn()
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    })

    render(
      <ParseViewer
        result={parseResult({
          pages: ["# Visible page markdown"],
          text: "canonical download text",
        })}
      />
    )

    fireEvent.click(screen.getByLabelText("Download markdown"))

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    })
    const blob = createObjectURL.mock.calls[0][0]
    expect(await blob.text()).toBe("canonical download text")
    expect(click).toHaveBeenCalledTimes(1)
    expect(document.querySelector('a[download="parse-output.md"]')).toBeNull()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:parse-download")
  })

  it("renders the source document pane and reacts to document page reports", async () => {
    render(
      <ParseViewerSyncHarness>
        <ReportParseDocumentPageButton
          label="Source document page 2"
          pageNumber={2}
        />
      </ParseViewerSyncHarness>
    )

    expect(screen.getByText("Source document page 2")).toBeTruthy()
    expect(screen.getByText("Page 1 of 2")).toBeTruthy()

    fireEvent.click(
      screen.getByRole("button", { name: "Source document page 2" })
    )

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeTruthy()
    })
  })

  it("clamps out-of-range source document page reports before syncing markdown", async () => {
    const { container } = render(
      <ParseViewerSyncHarness>
        <ReportParseDocumentPageButton
          label="Source document page 99"
          pageNumber={99}
        />
      </ParseViewerSyncHarness>
    )

    const markdownViewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(markdownViewport).toBeTruthy()

    fireEvent.click(
      screen.getByRole("button", { name: "Source document page 99" })
    )

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeTruthy()
      expect(markdownViewport!.scrollTop).toBe(markdownPageOffset(PAGES, 2))
    })
  })

  it("does not bounce the source document back during pending markdown sync", async () => {
    const documentPageOneScrollIntoView = vi.fn()
    const { container } = render(
      <ParseViewerSyncHarness>
        <div data-testid="source-document">
          <ReportParseDocumentPageButton
            label="Source document page 2"
            pageNumber={2}
          />
          <ParseDocumentScrollSpy onScroll={documentPageOneScrollIntoView}>
            <div data-page-number="1">Document page 1</div>
            <div data-page-number="2">Document page 2</div>
          </ParseDocumentScrollSpy>
        </div>
      </ParseViewerSyncHarness>
    )
    const markdownViewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Source document page 2" })
    )
    scrollMarkdownViewportToPage(markdownViewport!, PAGES, 2)

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeTruthy()
    })
    expect(documentPageOneScrollIntoView).not.toHaveBeenCalled()
  })

  it("provides source document scroll progress handlers", () => {
    const receivedHandlers: ReturnType<typeof useParseViewerDocument>[] = []

    render(
      <ParseViewerSyncHarness>
        <ParseDocumentStateProbe
          onProbe={(document) => receivedHandlers.push(document)}
        />
      </ParseViewerSyncHarness>
    )

    expect(receivedHandlers[0].onCurrentPageChange).toEqual(
      expect.any(Function)
    )
    expect(receivedHandlers[0].onScrollProgressChange).toEqual(
      expect.any(Function)
    )
    expect(() =>
      receivedHandlers[0].onScrollProgressChange?.(0.5)
    ).not.toThrow()
  })

  it("reports visible markdown page changes to consumers", async () => {
    const onVisiblePageChange = vi.fn()
    const { container } = render(
      <ParseViewer
        result={parseResult()}
        onVisiblePageChange={onVisiblePageChange}
      />
    )
    const viewport = await findReadyMarkdownViewport(container)

    scrollMarkdownViewportToPage(viewport, PAGES, 2)

    expect(onVisiblePageChange).toHaveBeenCalledWith(2)
  })

  it("reports the same visible page again after parse output changes", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      window.setTimeout(() => callback(0), 0)
      return 1
    })
    const onVisiblePageChange = vi.fn()
    const { container, rerender } = render(
      <ParseViewer
        result={parseResult()}
        onVisiblePageChange={onVisiblePageChange}
      />
    )
    let viewport = await findReadyMarkdownViewport(container)

    scrollMarkdownViewportToPage(viewport, PAGES, 2)
    await waitFor(() => {
      expect(onVisiblePageChange).toHaveBeenCalledWith(2)
    })
    onVisiblePageChange.mockClear()

    const replacementPages = ["# Replacement first", "# Replacement second"]
    rerender(
      <ParseViewer
        result={parseResult({
          pages: replacementPages,
          text: "# Replacement first\n\n# Replacement second",
        })}
        onVisiblePageChange={onVisiblePageChange}
      />
    )
    expect(await screen.findByText("Replacement second")).toBeTruthy()
    viewport = await findReadyMarkdownViewport(container)

    scrollMarkdownViewportToPage(viewport, replacementPages, 2)

    await waitFor(() => {
      expect(onVisiblePageChange).toHaveBeenCalledWith(2)
    })
  })

  it("reports the same visible page again for a new document with identical markdown", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      window.setTimeout(() => callback(0), 0)
      return 1
    })
    const onVisiblePageChange = vi.fn()
    const { container, rerender } = render(
      <ParseViewer
        result={{ ...parseResult(), document: { id: "doc-one" } }}
        onVisiblePageChange={onVisiblePageChange}
      />
    )
    let viewport = await findReadyMarkdownViewport(container)

    scrollMarkdownViewportToPage(viewport, PAGES, 2)
    await waitFor(() => {
      expect(onVisiblePageChange).toHaveBeenCalledWith(2)
    })
    onVisiblePageChange.mockClear()

    rerender(
      <ParseViewer
        result={{ ...parseResult(), document: { id: "doc-two" } }}
        onVisiblePageChange={onVisiblePageChange}
      />
    )
    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeTruthy()
    })
    viewport = await findReadyMarkdownViewport(container)

    scrollMarkdownViewportToPage(viewport, PAGES, 2)

    await waitFor(() => {
      expect(onVisiblePageChange).toHaveBeenCalledWith(2)
    })
  })

  it("resets the current page after returning to the empty parse state", async () => {
    const { rerender } = render(
      <ParseViewerSyncHarness>
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

    rerender(<ParseViewer result={null} isProcessing />)
    expect(screen.getByText("Parsing document...")).toBeTruthy()

    rerender(<ParseViewer result={parseResult()} />)

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeTruthy()
    })
  })

  it("accepts markdown page reports after a pending sync target disappears", async () => {
    const onVisiblePageChange = vi.fn()
    const { container, rerender } = render(
      <ParseViewerSyncHarness
        result={parseResult()}
        onVisiblePageChange={onVisiblePageChange}
      >
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
        result={parseResult({
          pages: ["# Single replacement page"],
          text: "# Single replacement page",
        })}
        onVisiblePageChange={onVisiblePageChange}
      >
        <ReportParseDocumentPageButton
          label="Source document page 1"
          pageNumber={1}
        />
      </ParseViewerSyncHarness>
    )
    await screen.findByText("Single replacement page")
    onVisiblePageChange.mockClear()

    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )

    fireEvent.scroll(viewport!)

    expect(onVisiblePageChange).toHaveBeenCalledWith(1)
  })
})
