// @vitest-environment jsdom

import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createPageMarkdownLayout,
  getPageMarkdownPageLayout,
} from "@/components/viewers/page-markdown/page-markdown-layout"
import { PageMarkdownViewer } from "@/components/viewers/page-markdown/page-markdown-viewer"

const PAGES = ["# First page\n\nAlpha", "## Second page\n\nBeta"]

function rect(top: number, height = 500): DOMRect {
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
  vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(rect(0, 500))
  viewport.scrollTop = markdownPageOffset(pages, pageNumber)
  fireEvent.scroll(viewport)
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
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("PageMarkdownViewer", () => {
  it("renders the standard page toolbar and markdown actions", async () => {
    render(<PageMarkdownViewer pages={PAGES} />)

    expect(screen.getByText("Page 1 of 2")).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Rendered" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Text" })).toBeTruthy()
    expect(screen.getByLabelText("Zoom out")).toBeTruthy()
    expect(screen.getByText("100%")).toBeTruthy()
    expect(screen.getByLabelText("Zoom in")).toBeTruthy()
    expect(screen.getByLabelText("Fit width")).toBeTruthy()
    expect(screen.getByLabelText("Copy markdown")).toBeTruthy()
    expect(screen.getByLabelText("Download markdown")).toBeTruthy()
    expect(await screen.findByText("First page")).toBeTruthy()
  })

  it("renders markdown pages when IntersectionObserver is unavailable", async () => {
    vi.stubGlobal("IntersectionObserver", undefined)

    render(<PageMarkdownViewer pages={PAGES} />)

    expect(screen.getByText("Page 1 of 2")).toBeTruthy()
    expect(await screen.findByText("First page")).toBeTruthy()
    expect(await screen.findByText("Second page")).toBeTruthy()
  })

  it("renders markdown pages when ResizeObserver is unavailable", async () => {
    vi.stubGlobal("ResizeObserver", undefined)

    render(<PageMarkdownViewer pages={PAGES} />)

    expect(screen.getByText("Page 1 of 2")).toBeTruthy()
    expect(await screen.findByText("First page")).toBeTruthy()
    expect(await screen.findByText("Second page")).toBeTruthy()
  })

  it("handles ResizeObserver callbacks when requestAnimationFrame is unavailable", async () => {
    const resizeCallbacks: ResizeObserverCallback[] = []
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          resizeCallbacks.push(callback)
        }
        observe() {}
        disconnect() {}
      }
    )
    vi.stubGlobal("requestAnimationFrame", undefined)
    vi.stubGlobal("cancelAnimationFrame", undefined)

    render(<PageMarkdownViewer pages={PAGES} />)
    await screen.findByText("First page")

    const target = document.createElement("div")
    Object.defineProperty(target, "clientWidth", {
      configurable: true,
      value: 640,
    })

    expect(() => {
      act(() => {
        for (const callback of resizeCallbacks) {
          callback(
            [{ target } as unknown as ResizeObserverEntry],
            {} as ResizeObserver
          )
        }
      })
    }).not.toThrow()
  })

  it("moves secondary actions into a menu when the toolbar is narrow", () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 400,
    })

    render(<PageMarkdownViewer pages={PAGES} />)

    expect(screen.getByText("Page 1 of 2")).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Rendered" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Text" })).toBeTruthy()
    expect(screen.getByLabelText("More markdown actions")).toBeTruthy()
    expect(screen.queryByLabelText("Copy markdown")).toBeNull()
    expect(screen.queryByLabelText("Download markdown")).toBeNull()
  })

  it("copies markdown from the compact actions menu", async () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 400,
    })
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(<PageMarkdownViewer pages={PAGES} text="compact markdown" />)

    fireEvent.click(screen.getByLabelText("More markdown actions"))
    fireEvent.click(await screen.findByText("Copy markdown"))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("compact markdown")
    })
  })

  it("downloads markdown from the compact actions menu", async () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 400,
    })
    const createObjectURL = vi.fn(() => "blob:compact-markdown-download")
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
      <PageMarkdownViewer
        pages={PAGES}
        text="compact download"
        fileName="compact.md"
      />
    )

    fireEvent.click(screen.getByLabelText("More markdown actions"))
    fireEvent.click(await screen.findByText("Download markdown"))

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      expect(click).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledWith(
        "blob:compact-markdown-download"
      )
    })
  })

  it("switches from rendered markdown to page text", async () => {
    const { container } = render(<PageMarkdownViewer pages={PAGES} />)

    fireEvent.click(screen.getByRole("tab", { name: "Text" }))

    await waitFor(() => {
      expect(
        Array.from(container.querySelectorAll("pre")).some(
          (pre) => pre.textContent === "# First page\n\nAlpha"
        )
      ).toBe(true)
    })
  })

  it("renders common GFM document structures", async () => {
    const { container } = render(
      <PageMarkdownViewer
        pages={[
          [
            "# Statement",
            "",
            "> Verified balance",
            "",
            "- [x] Reviewed",
            "- [ ] Needs approval",
            "",
            "| Item | Amount |",
            "| --- | ---: |",
            "| Cash | $10.00 |",
            "",
            "```ts",
            "const total = 10",
            "```",
          ].join("\n"),
        ]}
      />
    )

    expect(
      await screen.findByRole("heading", { name: "Statement" })
    ).toBeTruthy()
    expect(screen.getByText("Verified balance")).toBeTruthy()
    expect(screen.getByText("Reviewed")).toBeTruthy()
    expect(screen.getByText("Needs approval")).toBeTruthy()
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2)
    expect(screen.getByRole("table")).toBeTruthy()
    expect(screen.getByRole("columnheader", { name: "Amount" })).toBeTruthy()
    expect(screen.getByText("$10.00")).toBeTruthy()
    expect(screen.getByText("const total = 10")).toBeTruthy()
  })

  it("does not leak react-markdown AST node props into the DOM", async () => {
    const { container } = render(
      <PageMarkdownViewer
        pages={[
          [
            "# Heading",
            "",
            "Paragraph with [a link](https://retab.com).",
            "",
            "| A | B |",
            "| --- | --- |",
            "| 1 | 2 |",
          ].join("\n"),
        ]}
      />
    )

    expect(await screen.findByRole("heading", { name: "Heading" })).toBeTruthy()
    expect(container.querySelector("[node]")).toBeNull()
  })

  it("does not turn raw HTML in markdown into live DOM", async () => {
    const { container } = render(
      <PageMarkdownViewer
        pages={[
          [
            "# Unsafe",
            "",
            '<script data-testid="script-tag">window.__xss = true</script>',
            '<img src="x" onerror="window.__xss = true" data-testid="raw-image" />',
            '<div data-testid="raw-html">raw html</div>',
          ].join("\n"),
        ]}
      />
    )

    expect(await screen.findByRole("heading", { name: "Unsafe" })).toBeTruthy()
    expect(container.querySelector("script")).toBeNull()
    expect(container.querySelector("[onerror]")).toBeNull()
    expect(screen.queryByTestId("raw-html")).toBeNull()
    expect(container.textContent).toContain('<div data-testid="raw-html">')
  })

  it("hardens markdown links while leaving unsafe URL protocols inert", async () => {
    render(
      <PageMarkdownViewer
        pages={[
          [
            "[Retab](https://retab.com)",
            "[Relative](/docs)",
            "[Unsafe](javascript:alert('xss'))",
            "[Uppercase](JaVaScRiPt:alert('xss'))",
            "[Data](data:text/html,<script>alert('xss')</script>)",
          ].join(" "),
        ]}
      />
    )

    const link = await screen.findByRole("link", { name: "Retab" })
    expect(link.getAttribute("href")).toBe("https://retab.com")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toBe("noopener noreferrer")

    const relative = screen.getByRole("link", { name: "Relative" })
    expect(relative.getAttribute("href")).toBe("/docs")
    expect(relative.getAttribute("target")).toBe("_blank")
    expect(relative.getAttribute("rel")).toBe("noopener noreferrer")

    expect(screen.getByText("Unsafe").closest("a")).toBeNull()
    expect(screen.getByText("Uppercase").closest("a")).toBeNull()
    expect(screen.getByText("Data").closest("a")).toBeNull()
  })

  it("renders safe markdown images without activating unsafe image protocols", async () => {
    const { container } = render(
      <PageMarkdownViewer
        pages={[
          [
            "![Safe](https://example.com/logo.png)",
            "![Unsafe](javascript:alert('xss'))",
          ].join("\n\n"),
        ]}
      />
    )

    const safeImage = (await screen.findByAltText("Safe")) as HTMLImageElement
    expect(safeImage.getAttribute("src")).toBe("https://example.com/logo.png")

    expect(container.querySelector('img[alt="Unsafe"]')).toBeNull()
    expect(screen.getByText("Unsafe")).toBeTruthy()
  })

  it("uses explicit download text instead of deriving it from visible pages", async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(
      <PageMarkdownViewer
        pages={PAGES}
        text="joined markdown from api"
        fileName="parsed.md"
      />
    )

    fireEvent.click(screen.getByLabelText("Copy markdown"))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("joined markdown from api")
    })
  })

  it("shows copy failure when clipboard writing is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {},
    })

    render(<PageMarkdownViewer pages={PAGES} />)

    fireEvent.click(screen.getByLabelText("Copy markdown"))

    await waitFor(() => {
      expect(screen.getByLabelText("Copy failed")).toBeTruthy()
    })
  })

  it("shows copy failure when clipboard writing throws synchronously", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(() => {
          throw new Error("clipboard blocked")
        }),
      },
    })

    render(<PageMarkdownViewer pages={PAGES} />)

    fireEvent.click(screen.getByLabelText("Copy markdown"))

    await waitFor(() => {
      expect(screen.getByLabelText("Copy failed")).toBeTruthy()
    })
  })

  it("shows copy failure when clipboard access throws", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      get() {
        throw new Error("clipboard getter blocked")
      },
    })

    render(<PageMarkdownViewer pages={PAGES} />)

    expect(() =>
      fireEvent.click(screen.getByLabelText("Copy markdown"))
    ).not.toThrow()

    await waitFor(() => {
      expect(screen.getByLabelText("Copy failed")).toBeTruthy()
    })
  })

  it("does not schedule copy status work after unmount", async () => {
    vi.useFakeTimers()
    let resolveCopy!: () => void
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCopy = resolve
        })
    )
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })
    const { unmount } = render(<PageMarkdownViewer pages={PAGES} />)

    fireEvent.click(screen.getByLabelText("Copy markdown"))
    unmount()

    await act(async () => {
      resolveCopy()
    })

    expect(vi.getTimerCount()).toBe(0)
  })

  it("ignores stale clipboard results from earlier copy attempts", async () => {
    let rejectFirst!: () => void
    let resolveSecond!: () => void
    const writeText = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectFirst = () => reject(new Error("first copy failed late"))
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveSecond = resolve
          })
      )
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(<PageMarkdownViewer pages={PAGES} />)

    fireEvent.click(screen.getByLabelText("Copy markdown"))
    fireEvent.click(screen.getByLabelText("Copy markdown"))

    await act(async () => {
      resolveSecond()
    })
    await act(async () => {
      rejectFirst()
    })

    expect(screen.queryByLabelText("Copy failed")).toBeNull()
  })

  it("downloads markdown with the provided file name and revokes the object URL", async () => {
    const createObjectURL = vi.fn(() => "blob:markdown-download")
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
      <PageMarkdownViewer
        pages={PAGES}
        text="download markdown"
        fileName="parsed.md"
      />
    )

    fireEvent.click(screen.getByLabelText("Download markdown"))

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      expect(click).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:markdown-download")
    })
    expect(document.querySelector('a[download="parsed.md"]')).toBeNull()
  })

  it("normalizes non-markdown file names when downloading from the viewer", async () => {
    let downloadedName: string | undefined
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:renamed-markdown-download"),
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloadedName = this.download
    })

    render(
      <PageMarkdownViewer
        pages={PAGES}
        text="download markdown"
        fileName="report.pdf"
      />
    )

    fireEvent.click(screen.getByLabelText("Download markdown"))

    await waitFor(() => {
      expect(downloadedName).toBe("report.md")
    })
  })

  it("zooms manually and returns to fit-width scale", () => {
    render(<PageMarkdownViewer pages={PAGES} />)

    expect(screen.getByText("100%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(screen.getByText("120%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Zoom out"))
    expect(screen.getByText("100%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(screen.getByText("120%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Fit width"))
    expect(screen.getByText("100%")).toBeTruthy()
  })

  it("scrolls the markdown pane when the document pane reports a new page", async () => {
    const scrollIntoView = vi.fn()

    render(
      <PageMarkdownViewer
        pages={PAGES}
        renderDocument={({ onCurrentPageChange }) => (
          <button type="button" onClick={() => onCurrentPageChange(2)}>
            Show document page 2
          </button>
        )}
      />
    )

    const markdownPage = await screen.findByText("Second page")
    const markdownFrame = markdownPage.closest("[data-page-number]")
    expect(markdownFrame).toBeTruthy()
    ;(markdownFrame as HTMLElement).scrollIntoView = scrollIntoView

    fireEvent.click(
      screen.getByRole("button", { name: "Show document page 2" })
    )

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      })
    })
    expect(screen.getByText("Page 2 of 2")).toBeTruthy()
  })

  it("does not publish stale markdown page reports while document sync is pending", async () => {
    const onVisiblePageChange = vi.fn()
    const pages = [...PAGES, "## Third page\n\nGamma"]

    render(
      <PageMarkdownViewer
        pages={pages}
        onVisiblePageChange={onVisiblePageChange}
        renderDocument={({ onCurrentPageChange }) => (
          <button type="button" onClick={() => onCurrentPageChange(2)}>
            Show document page 2
          </button>
        )}
      />
    )

    await screen.findByText("Second page")
    fireEvent.click(
      screen.getByRole("button", { name: "Show document page 2" })
    )

    const markdownViewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(markdownViewport).toBeTruthy()
    markdownViewport!.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 500,
        left: 0,
        right: 100,
        width: 100,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect

    const markdownPages = Array.from(
      markdownViewport!.querySelectorAll<HTMLElement>("[data-page-number]")
    )
    expect(markdownPages).toHaveLength(3)
    markdownPages[0]!.getBoundingClientRect = () =>
      ({
        top: -500,
        bottom: -300,
        left: 0,
        right: 100,
        width: 100,
        height: 200,
        x: 0,
        y: -500,
        toJSON: () => ({}),
      }) as DOMRect
    markdownPages[1]!.getBoundingClientRect = () =>
      ({
        top: -200,
        bottom: 0,
        left: 0,
        right: 100,
        width: 100,
        height: 200,
        x: 0,
        y: -200,
        toJSON: () => ({}),
      }) as DOMRect
    markdownPages[2]!.getBoundingClientRect = () =>
      ({
        top: 40,
        bottom: 240,
        left: 0,
        right: 100,
        width: 100,
        height: 200,
        x: 0,
        y: 40,
        toJSON: () => ({}),
      }) as DOMRect

    fireEvent.scroll(markdownViewport!)

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 3")).toBeTruthy()
    })
    expect(onVisiblePageChange).not.toHaveBeenCalled()
  })

  it("scrolls the document pane when the visible markdown page changes", async () => {
    const scrollIntoView = vi.fn()
    const onVisiblePageChange = vi.fn()

    render(
      <PageMarkdownViewer
        pages={PAGES}
        onVisiblePageChange={onVisiblePageChange}
        renderDocument={() => (
          <div>
            <section data-page-number="1">Document page 1</section>
            <section
              data-page-number="2"
              ref={(node) => {
                if (node) node.scrollIntoView = scrollIntoView
              }}
            >
              Document page 2
            </section>
          </div>
        )}
      />
    )

    await screen.findByText("Second page")

    const markdownViewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(markdownViewport).toBeTruthy()
    markdownViewport!.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 500,
        left: 0,
        right: 100,
        width: 100,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect

    const markdownPages = Array.from(
      markdownViewport!.querySelectorAll<HTMLElement>("[data-page-number]")
    )
    expect(markdownPages).toHaveLength(2)
    markdownPages[0]!.getBoundingClientRect = () =>
      ({
        top: -300,
        bottom: -100,
        left: 0,
        right: 100,
        width: 100,
        height: 200,
        x: 0,
        y: -300,
        toJSON: () => ({}),
      }) as DOMRect
    markdownPages[1]!.getBoundingClientRect = () =>
      ({
        top: 40,
        bottom: 240,
        left: 0,
        right: 100,
        width: 100,
        height: 200,
        x: 0,
        y: 40,
        toJSON: () => ({}),
      }) as DOMRect

    fireEvent.scroll(markdownViewport!)

    await waitFor(() => {
      expect(onVisiblePageChange).toHaveBeenCalledWith(2)
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      })
    })
    expect(screen.getByText("Page 2 of 2")).toBeTruthy()
  })

  it("reports visible markdown page changes when requestAnimationFrame is unavailable", async () => {
    vi.stubGlobal("requestAnimationFrame", undefined)
    vi.stubGlobal("cancelAnimationFrame", undefined)
    const onVisiblePageChange = vi.fn()

    render(
      <PageMarkdownViewer
        pages={PAGES}
        onVisiblePageChange={onVisiblePageChange}
      />
    )

    await screen.findByText("Second page")

    const markdownViewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(markdownViewport).toBeTruthy()
    markdownViewport!.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 500,
        left: 0,
        right: 100,
        width: 100,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect

    const markdownPages = Array.from(
      markdownViewport!.querySelectorAll<HTMLElement>("[data-page-number]")
    )
    expect(markdownPages).toHaveLength(2)
    markdownPages[0]!.getBoundingClientRect = () =>
      ({
        top: -300,
        bottom: -100,
        left: 0,
        right: 100,
        width: 100,
        height: 200,
        x: 0,
        y: -300,
        toJSON: () => ({}),
      }) as DOMRect
    markdownPages[1]!.getBoundingClientRect = () =>
      ({
        top: 40,
        bottom: 240,
        left: 0,
        right: 100,
        width: 100,
        height: 200,
        x: 0,
        y: 40,
        toJSON: () => ({}),
      }) as DOMRect

    expect(() => fireEvent.scroll(markdownViewport!)).not.toThrow()
    expect(onVisiblePageChange).toHaveBeenCalledWith(2)
  })

  it("clamps the current page when the page list shrinks", async () => {
    const pages = [...PAGES, "## Third page\n\nGamma"]
    const { rerender } = render(
      <PageMarkdownViewer
        pages={pages}
        renderDocument={({ onCurrentPageChange }) => (
          <button type="button" onClick={() => onCurrentPageChange(3)}>
            Show document page 3
          </button>
        )}
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Show document page 3" })
    )

    await waitFor(() => {
      expect(screen.getByText("Page 3 of 3")).toBeTruthy()
    })

    rerender(
      <PageMarkdownViewer
        pages={PAGES}
        renderDocument={({ onCurrentPageChange }) => (
          <button type="button" onClick={() => onCurrentPageChange(2)}>
            Show document page 2
          </button>
        )}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeTruthy()
    })
    expect(screen.queryByText("Page 3 of 2")).toBeNull()
  })

  it("resets view mode and manual zoom when the reset key changes", async () => {
    const { rerender } = render(
      <PageMarkdownViewer pages={PAGES} resetKey="document-one" />
    )

    fireEvent.click(screen.getByRole("tab", { name: "Text" }))
    fireEvent.click(screen.getByLabelText("Zoom in"))

    await waitFor(() => {
      expect(
        Array.from(document.querySelectorAll("pre")).some((pre) =>
          pre.textContent?.includes("# First page")
        )
      ).toBe(true)
      expect(screen.getByText("120%")).toBeTruthy()
    })

    rerender(
      <PageMarkdownViewer
        pages={["# Replacement page\n\nGamma"]}
        resetKey="document-two"
      />
    )

    await waitFor(() => {
      expect(
        screen
          .getByRole("tab", { name: "Rendered" })
          .getAttribute("aria-selected")
      ).toBe("true")
      expect(screen.getByText("100%")).toBeTruthy()
    })
    expect(await screen.findByText("Replacement page")).toBeTruthy()
  })

  it("shows a generic page-by-page empty state", () => {
    render(<PageMarkdownViewer pages={[]} />)

    expect(screen.getByText("No markdown pages yet")).toBeTruthy()
    expect(
      screen.getByText(
        "Provide page-by-page markdown to see the rendered document here."
      )
    ).toBeTruthy()
  })

  it("uses generic processing copy by default", () => {
    render(<PageMarkdownViewer pages={[]} isProcessing />)

    expect(screen.getByText("Preparing document...")).toBeTruthy()
  })
})
