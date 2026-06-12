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
  ParseViewer,
  type ParseDocumentHandlers,
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
    vi.useFakeTimers()
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

    const blob = createObjectURL.mock.calls[0][0]
    expect(await blob.text()).toBe("canonical download text")
    expect(click).toHaveBeenCalledTimes(1)
    expect(document.querySelector('a[download="parse-output.md"]')).toBeNull()

    vi.runOnlyPendingTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:parse-download")
    vi.useRealTimers()
  })

  it("renders the source document pane and reacts to document page reports", async () => {
    render(
      <ParseViewer
        result={parseResult()}
        renderDocument={(handlers: ParseDocumentHandlers) => (
          <button type="button" onClick={() => handlers.onCurrentPageChange(2)}>
            Source document page 2
          </button>
        )}
      />
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
    render(
      <ParseViewer
        result={parseResult()}
        renderDocument={(handlers: ParseDocumentHandlers) => (
          <button
            type="button"
            onClick={() => handlers.onCurrentPageChange(99)}
          >
            Source document page 99
          </button>
        )}
      />
    )

    const pageElements =
      document.querySelectorAll<HTMLElement>("[data-page-number]")
    const secondMarkdownPage = pageElements[1]
    const scrollIntoView = vi.fn()
    secondMarkdownPage.scrollIntoView = scrollIntoView

    fireEvent.click(
      screen.getByRole("button", { name: "Source document page 99" })
    )

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeTruthy()
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      })
    })
  })

  it("does not bounce the source document back during pending markdown sync", async () => {
    const { container } = render(
      <ParseViewer
        result={parseResult()}
        renderDocument={(handlers: ParseDocumentHandlers) => (
          <div data-testid="source-document">
            <button
              type="button"
              onClick={() => handlers.onCurrentPageChange(2)}
            >
              Source document page 2
            </button>
            <div data-page-number="1">Document page 1</div>
            <div data-page-number="2">Document page 2</div>
          </div>
        )}
      />
    )
    const markdownViewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    const markdownPages =
      markdownViewport!.querySelectorAll<HTMLElement>("[data-page-number]")
    const documentPageOne = screen
      .getByText("Document page 1")
      .closest<HTMLElement>("[data-page-number]")
    const documentPageOneScrollIntoView = vi.fn()
    documentPageOne!.scrollIntoView = documentPageOneScrollIntoView

    vi.spyOn(markdownViewport!, "getBoundingClientRect").mockReturnValue(
      rect(0, 400)
    )
    vi.spyOn(markdownPages[0], "getBoundingClientRect").mockReturnValue(rect(0))
    vi.spyOn(markdownPages[1], "getBoundingClientRect").mockReturnValue(
      rect(500)
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Source document page 2" })
    )
    fireEvent.scroll(markdownViewport!)

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeTruthy()
    })
    expect(documentPageOneScrollIntoView).not.toHaveBeenCalled()
  })

  it("provides source document scroll progress handlers", () => {
    const receivedHandlers: ParseDocumentHandlers[] = []

    render(
      <ParseViewer
        result={parseResult()}
        renderDocument={(handlers: ParseDocumentHandlers) => {
          receivedHandlers.push(handlers)

          return <div>Source document</div>
        }}
      />
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

  it("reports visible markdown page changes to consumers", () => {
    const onVisiblePageChange = vi.fn()
    const { container } = render(
      <ParseViewer
        result={parseResult()}
        onVisiblePageChange={onVisiblePageChange}
      />
    )
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    const pageElements =
      container.querySelectorAll<HTMLElement>("[data-page-number]")

    expect(viewport).toBeTruthy()
    expect(pageElements).toHaveLength(2)

    vi.spyOn(viewport!, "getBoundingClientRect").mockReturnValue(rect(0, 400))
    vi.spyOn(pageElements[0], "getBoundingClientRect").mockReturnValue(
      rect(-300)
    )
    vi.spyOn(pageElements[1], "getBoundingClientRect").mockReturnValue(rect(0))

    fireEvent.scroll(viewport!)

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
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    let pageElements =
      container.querySelectorAll<HTMLElement>("[data-page-number]")

    vi.spyOn(viewport!, "getBoundingClientRect").mockReturnValue(rect(0, 400))
    vi.spyOn(pageElements[0], "getBoundingClientRect").mockReturnValue(
      rect(-300)
    )
    vi.spyOn(pageElements[1], "getBoundingClientRect").mockReturnValue(rect(0))

    fireEvent.scroll(viewport!)
    await waitFor(() => {
      expect(onVisiblePageChange).toHaveBeenCalledWith(2)
    })
    onVisiblePageChange.mockClear()

    rerender(
      <ParseViewer
        result={parseResult({
          pages: ["# Replacement first", "# Replacement second"],
          text: "# Replacement first\n\n# Replacement second",
        })}
        onVisiblePageChange={onVisiblePageChange}
      />
    )
    expect(await screen.findByText("Replacement second")).toBeTruthy()
    pageElements = container.querySelectorAll<HTMLElement>("[data-page-number]")
    vi.spyOn(pageElements[0], "getBoundingClientRect").mockReturnValue(
      rect(-300)
    )
    vi.spyOn(pageElements[1], "getBoundingClientRect").mockReturnValue(rect(0))

    fireEvent.scroll(viewport!)

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
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    const pageElements =
      container.querySelectorAll<HTMLElement>("[data-page-number]")

    vi.spyOn(viewport!, "getBoundingClientRect").mockReturnValue(rect(0, 400))
    vi.spyOn(pageElements[0], "getBoundingClientRect").mockReturnValue(
      rect(-300)
    )
    vi.spyOn(pageElements[1], "getBoundingClientRect").mockReturnValue(rect(0))

    fireEvent.scroll(viewport!)
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

    fireEvent.scroll(viewport!)

    await waitFor(() => {
      expect(onVisiblePageChange).toHaveBeenCalledWith(2)
    })
  })
})
