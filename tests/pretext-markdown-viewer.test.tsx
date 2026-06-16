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
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  PretextMarkdownViewer,
  type TextViewerHandle,
} from "@/components/ui/pretext-markdown-viewer"

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (_id: string, source: string) => {
      if (source.includes("not-a-diagram")) {
        throw new Error("Mermaid parse error")
      }

      if (source.includes("force-basic-fallback")) {
        throw new Error("getBBox is not a function")
      }

      if (source.includes("unsafe-svg")) {
        return {
          svg: [
            '<svg id="location" role="img" aria-label="Mermaid diagram" data-testid="mock-mermaid-svg" data-source="unsafe-svg" xmlns="http://www.w3.org/2000/svg" onload="alert(1)" style="background:url(javascript:alert(1))">',
            "<style>.unsafe{fill:url(javascript:alert(1))}</style>",
            "<script>alert(1)</script>",
            '<foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject>',
            '<a href="javascript:alert(1)"><text onclick="alert(1)">Unsafe</text></a>',
            '<image href="https://example.com/tracker.png" />',
            '<use href="https://example.com/sprite.svg#icon" />',
            '<animate attributeName="x" from="0" to="1" />',
            '<g id="forms"><text id="constructor" name="images">Safe label</text></g>',
            "</svg>",
          ].join(""),
        }
      }

      return {
        svg: `<svg role="img" aria-label="Mermaid diagram" data-testid="mock-mermaid-svg" data-source="${encodeURIComponent(source)}" xmlns="http://www.w3.org/2000/svg"></svg>`,
      }
    }),
  },
}))

function markdownSource(text: string, fileName = "notes.md") {
  return {
    kind: "text" as const,
    fileName,
    mimeType: "text/markdown",
    text,
  }
}

function markdownUrlSource({
  downloadUrl,
  fileName = "remote.md",
  url,
}: {
  downloadUrl?: string
  fileName?: string
  url: string
}) {
  return {
    kind: "url" as const,
    url,
    fileName,
    mimeType: "text/markdown",
    downloadUrl,
  }
}

function markdownBlobSource({
  blob,
  downloadUrl,
  fileName = "blob.md",
  identityKey = "blob:markdown",
}: {
  blob: Blob
  downloadUrl?: string
  fileName?: string
  identityKey?: string
}) {
  return {
    kind: "blob" as const,
    blob,
    identityKey,
    fileName,
    mimeType: blob.type || "text/markdown",
    downloadUrl,
  }
}

function mockObjectUrls(url = "blob:pretext-markdown-download") {
  const createObjectURL = vi.fn((_blob: Blob) => url)
  const revokeObjectURL = vi.fn()
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  })
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  })
  return { createObjectURL, revokeObjectURL }
}

function captureAnchorClicks() {
  const clicks: Array<{ href: string | null; download: string }> = []
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    clicks.push({
      href: this.getAttribute("href"),
      download: this.download,
    })
  })
  return clicks
}

function createDeferred<T>() {
  let reject!: (reason?: unknown) => void
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(function scrollTo(
      this: HTMLElement,
      options?: ScrollToOptions | number
    ) {
      if (typeof options === "object" && typeof options.top === "number") {
        this.scrollTop = options.top
      }
    }),
  })
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 8 }),
  } as CanvasRenderingContext2D)
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(() => Promise.resolve()) },
  })
  mockObjectUrls()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: undefined,
  })
  window.history.replaceState(null, "", "/")
})

describe("PretextMarkdownViewer", () => {
  it("hydrates inline server markup into rendered Markdown content", async () => {
    const source = markdownSource("# Hydrated\n\n> [!NOTE]\n> Ready.")
    const serverHtml = renderToString(
      <PretextMarkdownViewer source={source} controls={false} />
    )
    expect(serverHtml).toContain('data-slot="pretext-markdown-virtual-canvas"')
    expect(serverHtml).not.toContain('data-slot="text-body-skeleton"')

    const container = document.createElement("div")
    container.innerHTML = serverHtml
    document.body.appendChild(container)

    const root = hydrateRoot(
      container,
      <PretextMarkdownViewer source={source} controls={false} />
    )

    try {
      expect(
        await screen.findByRole("heading", { name: "Hydrated" })
      ).toBeTruthy()
      expect(screen.getByRole("note", { name: "Note" })).toBeTruthy()
      expect(
        container.querySelector('[data-slot="text-body-skeleton"]')
      ).toBeNull()
    } finally {
      await act(async () => {
        root.unmount()
      })
      container.remove()
    }
  })

  it("renders markdown as a continuous Pretext virtual document", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        className="h-80 w-[420px]"
        source={markdownSource(
          [
            "# Release Notes",
            "",
            "Continuous prose with **strong text**.",
            "",
            "| Area | Status |",
            "| --- | --- |",
            "| Markdown | Continuous |",
          ].join("\n")
        )}
      />
    )

    expect(
      await screen.findByRole("heading", { name: "Release Notes" })
    ).toBeTruthy()
    expect(screen.getByRole("table")).toBeTruthy()
    expect(screen.getByText("Continuous")).toBeTruthy()
    expect(
      container.querySelector('[data-slot="pretext-markdown-virtual-canvas"]')
    ).toBeTruthy()
    expect(
      container.querySelector('[data-slot="markdown-document-page"]')
    ).toBeNull()
    expect(container.querySelector("[data-pretext-markdown-page]")).toBeNull()
    expect(
      container.querySelector("[data-pretext-markdown-chunk]")
    ).toBeTruthy()
    expect(container.textContent).not.toContain("Page 1 of")
  })

  it("forces markdown parsing even for plain file names", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource("# Parsed Heading", "notes.txt")}
        controls={false}
      />
    )

    expect(
      await screen.findByRole("heading", { name: "Parsed Heading" })
    ).toBeTruthy()
  })

  it("renders thematic breaks as stable document separators", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(["Before", "", "---", "", "After"].join("\n"))}
        controls={false}
      />
    )

    expect(await screen.findByText("Before")).toBeTruthy()
    expect(screen.getByText("After")).toBeTruthy()

    const separator = screen.getByRole("separator")
    expect(separator.tagName).toBe("HR")
    expect(separator.getAttribute("data-pretext-thematic-break")).toBe("")
    expect(separator.className).toContain("my-10")
    expect(separator.className).toContain("border-t")
    expect(container.querySelector("[data-pretext-markdown-page]")).toBeNull()
  })

  it("renders an explicit empty state for blank Markdown", async () => {
    const { container } = render(
      <PretextMarkdownViewer source={markdownSource(" \n\t\n")} />
    )

    expect(
      await screen.findByRole("status", { name: "Empty Markdown document" })
    ).toBeTruthy()
    expect(
      container.querySelector('[data-slot="pretext-markdown-virtual-canvas"]')
    ).toBeTruthy()
    expect(
      container.querySelector('[data-slot="pretext-markdown-empty-state"]')
    ).toBeTruthy()
    expect(container.querySelector("[data-pretext-markdown-chunk]")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Text" }))

    expect(
      container.querySelector('[data-slot="pretext-markdown-source-canvas"]')
    ).toBeTruthy()
    expect(
      container.querySelector('[data-slot="pretext-markdown-empty-state"]')
    ).toBeNull()
  })

  it("copies the full Markdown source from the controls", async () => {
    const source = [
      "# Release Notes",
      "",
      "Copy **source**, not rendering.",
    ].join("\n")
    render(<PretextMarkdownViewer source={markdownSource(source)} />)

    expect(
      await screen.findByRole("heading", { name: "Release Notes" })
    ).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Copy Markdown"))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(source)
    })
  })

  it("shows full Markdown source copy failures from the controls", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {},
    })

    render(<PretextMarkdownViewer source={markdownSource("# Release Notes")} />)

    expect(
      await screen.findByRole("heading", { name: "Release Notes" })
    ).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Copy Markdown"))

    expect(await screen.findByLabelText("Copy failed")).toBeTruthy()
  })

  it("ignores stale full Markdown source copy failures", async () => {
    const writes: Array<ReturnType<typeof createDeferred<void>>> = []
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(() => {
          const write = createDeferred<void>()
          writes.push(write)
          return write.promise
        }),
      },
    })

    render(<PretextMarkdownViewer source={markdownSource("# Release Notes")} />)

    expect(
      await screen.findByRole("heading", { name: "Release Notes" })
    ).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Copy Markdown"))
    fireEvent.click(screen.getByLabelText("Copy Markdown"))

    await act(async () => {
      writes[1]?.resolve()
    })
    expect(await screen.findByLabelText("Copied")).toBeTruthy()

    await act(async () => {
      writes[0]?.reject(new Error("late denied"))
    })
    expect(screen.getByLabelText("Copied")).toBeTruthy()
    expect(screen.queryByLabelText("Copy failed")).toBeNull()
  })

  it("toggles between rendered Markdown and source-faithful text", async () => {
    const source = [
      "# Release Notes",
      "",
      "Copy **source**, not rendering.",
    ].join("\n")
    render(<PretextMarkdownViewer source={markdownSource(source)} />)

    expect(
      await screen.findByRole("heading", { name: "Release Notes" })
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Text" }))

    expect(screen.getByText("# Release Notes")).toBeTruthy()
    expect(screen.getByText("Copy **source**, not rendering.")).toBeTruthy()
    expect(
      document.querySelector('[data-slot="pretext-markdown-source-canvas"]')
    ).toBeTruthy()
    expect(screen.getByRole("region", { name: "Markdown source" })).toBe(
      document.querySelector('[data-slot="pretext-markdown-source-canvas"]')
    )
    expect(
      document
        .querySelector('[data-slot="pretext-markdown-source-canvas"]')
        ?.getAttribute("tabindex")
    ).toBe("0")
    expect(
      Array.from(
        document.querySelectorAll(
          '[data-slot="pretext-markdown-source-canvas"] [data-source-line] span[aria-hidden="true"]'
        )
      ).map((lineNumber) => lineNumber.textContent)
    ).toEqual(["1", "2", "3"])
    expect(
      Array.from(document.querySelectorAll("[data-source-line-content]")).map(
        (line) => line.textContent
      )
    ).toEqual(["# Release Notes", " ", "Copy **source**, not rendering."])
    expect(
      document.querySelector('[data-slot="pretext-markdown-virtual-canvas"]')
    ).toBeNull()
    expect(screen.queryByRole("heading", { name: "Release Notes" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Rendered" }))

    expect(
      await screen.findByRole("heading", { name: "Release Notes" })
    ).toBeTruthy()
  })

  it("preserves the source-line position when toggling rendered and text modes", async () => {
    const viewerRef = React.createRef<TextViewerHandle>()
    const source = Array.from({ length: 70 }, (_, index) =>
      [`## Section ${index + 1}`, "", `Paragraph ${index + 1}.`].join("\n")
    ).join("\n\n")
    render(
      <PretextMarkdownViewer ref={viewerRef} source={markdownSource(source)} />
    )

    await screen.findByRole("heading", { name: "Section 1" })
    viewerRef.current?.scrollToLineRange(
      { start: 160, end: 160 },
      { behavior: "auto" }
    )
    const viewport = viewerRef.current?.getViewportElement()
    expect(viewport?.scrollTop).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole("button", { name: "Text" }))

    await waitFor(() => {
      expect(
        document.querySelector('[data-slot="pretext-markdown-source-canvas"]')
      ).toBeTruthy()
      expect(viewport?.scrollTop).toBeGreaterThan(0)
    })
    const sourceModeScrollTop = viewport?.scrollTop ?? 0

    fireEvent.click(screen.getByRole("button", { name: "Rendered" }))

    await waitFor(() => {
      expect(
        document.querySelector('[data-slot="pretext-markdown-virtual-canvas"]')
      ).toBeTruthy()
      expect(viewport?.scrollTop).toBeGreaterThan(0)
    })
    expect(viewport?.scrollTop).not.toBe(sourceModeScrollTop)
  })

  it("scrolls source text mode by source line range", async () => {
    const viewerRef = React.createRef<TextViewerHandle>()
    const source = Array.from(
      { length: 80 },
      (_, index) => `line ${index + 1}`
    ).join("\n")
    render(
      <PretextMarkdownViewer ref={viewerRef} source={markdownSource(source)} />
    )

    fireEvent.click(await screen.findByRole("button", { name: "Text" }))

    const viewport = viewerRef.current?.getViewportElement()
    expect(viewport).toBeTruthy()
    viewerRef.current?.scrollToLineRange(
      { start: 40, end: 40 },
      { behavior: "auto" }
    )

    expect(viewport?.scrollTop).toBeGreaterThan(0)
  })

  it("scrolls rendered mode by source line range through the virtual document", async () => {
    const viewerRef = React.createRef<TextViewerHandle>()
    const source = Array.from({ length: 50 }, (_, index) =>
      [`## Section ${index + 1}`, "", `Paragraph ${index + 1}.`].join("\n")
    ).join("\n\n")
    const { container } = render(
      <PretextMarkdownViewer
        ref={viewerRef}
        className="h-80 w-[420px]"
        source={markdownSource(source)}
      />
    )

    await screen.findByRole("heading", { name: "Section 1" })
    viewerRef.current?.scrollToLineRange(
      { start: 120, end: 120 },
      { behavior: "auto" }
    )

    expect(
      container.querySelector('[data-slot="pretext-markdown-virtual-canvas"]')
    ).toBeTruthy()
    expect(viewerRef.current?.getViewportElement()?.scrollTop).toBeGreaterThan(
      0
    )
  })

  it("exposes rendered source-line highlights on intersecting chunks", async () => {
    const source = ["# Intro", "", "Intro paragraph.", "", "## Target"].join(
      "\n"
    )
    const { container } = render(
      <PretextMarkdownViewer
        className="h-80 w-[420px]"
        highlight={{ start: 5, end: 5 }}
        source={markdownSource(source)}
      />
    )

    expect(await screen.findByRole("heading", { name: "Target" })).toBeTruthy()
    const highlightedChunk = container.querySelector<HTMLElement>(
      "[data-pretext-markdown-highlighted]"
    )

    expect(highlightedChunk).toBeTruthy()
    expect(highlightedChunk?.getAttribute("data-source-highlight-start")).toBe(
      "5"
    )
    expect(highlightedChunk?.getAttribute("data-source-highlight-end")).toBe(
      "5"
    )
    expect(
      screen.getByRole("region", { name: "Highlighted source lines 5-5" })
    ).toBe(highlightedChunk)
  })

  it("does not repeat highlight autoscroll when measured chunks settle", async () => {
    const originalResizeObserver = globalThis.ResizeObserver
    const resizeObservers: Array<{
      callback: ResizeObserverCallback
      target: Element
    }> = []

    try {
      Object.defineProperty(globalThis, "ResizeObserver", {
        configurable: true,
        value: class TestResizeObserver {
          private callback: ResizeObserverCallback

          constructor(callback: ResizeObserverCallback) {
            this.callback = callback
          }

          observe(target: Element) {
            if (!target.isConnected) {
              throw new Error("Use native scroll area fallback in jsdom")
            }
            resizeObservers.push({ callback: this.callback, target })
          }

          disconnect() {}
        },
      })

      const source = Array.from({ length: 30 }, (_, index) =>
        [`## Section ${index + 1}`, "", `Paragraph ${index + 1}.`].join("\n")
      ).join("\n\n")
      const viewerRef = React.createRef<TextViewerHandle>()
      render(
        <PretextMarkdownViewer
          ref={viewerRef}
          className="h-80 w-[420px]"
          highlight={{ start: 5, end: 5 }}
          source={markdownSource(source)}
        />
      )

      await screen.findByRole("heading", { name: "Section 1" })
      const viewport = viewerRef.current?.getViewportElement()
      expect(viewport).toBeInstanceOf(HTMLElement)
      if (!viewport) return

      const scrollTo = vi.fn(function scrollTo(
        this: HTMLElement,
        options?: ScrollToOptions | number
      ) {
        if (typeof options === "object" && typeof options.top === "number") {
          this.scrollTop = options.top
        }
      })
      Object.defineProperty(viewport, "scrollTo", {
        configurable: true,
        value: scrollTo,
      })

      const chunkObservers = resizeObservers.filter(
        ({ target }) =>
          target instanceof HTMLElement &&
          target.hasAttribute("data-pretext-markdown-chunk")
      )
      expect(chunkObservers.length).toBeGreaterThan(0)

      await act(async () => {
        for (const { callback, target } of chunkObservers) {
          callback(
            [
              {
                contentRect: { height: 720 },
                target,
              } as ResizeObserverEntry,
            ],
            {} as ResizeObserver
          )
        }
      })

      expect(scrollTo).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(globalThis, "ResizeObserver", {
        configurable: true,
        value: originalResizeObserver,
      })
    }
  })

  it("honors reduced motion for automatic rendered-mode scrolling", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    const viewerRef = React.createRef<TextViewerHandle>()
    const source = Array.from({ length: 50 }, (_, index) =>
      [`## Section ${index + 1}`, "", `Paragraph ${index + 1}.`].join("\n")
    ).join("\n\n")
    render(
      <PretextMarkdownViewer
        ref={viewerRef}
        className="h-80 w-[420px]"
        source={markdownSource(source)}
      />
    )

    await screen.findByRole("heading", { name: "Section 1" })
    viewerRef.current?.scrollToLineRange({ start: 120, end: 120 })

    expect(HTMLElement.prototype.scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({
        behavior: "auto",
      })
    )
  })

  it("downloads the full Markdown source from the controls", async () => {
    const source = [
      "# Release Notes",
      "",
      "Download **source**, not rendering.",
    ].join("\n")
    const clicks = captureAnchorClicks()
    const { createObjectURL, revokeObjectURL } = mockObjectUrls()
    render(
      <PretextMarkdownViewer source={markdownSource(source, "release.md")} />
    )

    expect(
      await screen.findByRole("heading", { name: "Release Notes" })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Download" }))

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
    const blob = createObjectURL.mock.calls[0]?.[0]
    expect(blob).toBeInstanceOf(Blob)
    await expect((blob as Blob).text()).resolves.toBe(source)
    expect((blob as Blob).type).toBe("text/markdown")
    expect(clicks).toEqual([
      { href: "blob:pretext-markdown-download", download: "release.md" },
    ])
    expect(revokeObjectURL).toHaveBeenCalledWith(
      "blob:pretext-markdown-download"
    )
  })

  it("shows and resets generated Markdown download failures", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => {
        throw new Error("object URLs blocked")
      }),
    })
    const { rerender } = render(
      <PretextMarkdownViewer
        source={markdownSource("# Release Notes", "release.md")}
      />
    )

    expect(
      await screen.findByRole("heading", { name: "Release Notes" })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Download" }))

    expect(
      await screen.findByText("Could not start this download.")
    ).toBeTruthy()
    expect(
      document.querySelector('[data-slot="pretext-markdown-download-error"]')
    ).toBeTruthy()

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("# Remote")))
    )
    rerender(
      <PretextMarkdownViewer
        source={markdownUrlSource({
          url: "/docs/reset-download-error.md",
          fileName: "remote.md",
          downloadUrl: "/download/reset-download-error.md",
        })}
      />
    )

    expect(await screen.findByRole("heading", { name: "Remote" })).toBeTruthy()
    expect(
      document.querySelector('[data-slot="pretext-markdown-download-error"]')
    ).toBeNull()
    expect(screen.getByRole("link", { name: "Download" })).toBeTruthy()
  })

  it("updates URL download metadata without reloading the same Markdown", async () => {
    const createObjectURL = vi.mocked(URL.createObjectURL)
    const fetchMock = vi.fn(() => Promise.resolve(new Response("# Remote")))
    vi.stubGlobal("fetch", fetchMock)

    const { rerender } = render(
      <PretextMarkdownViewer
        source={markdownUrlSource({
          url: "/docs/remote.md",
          fileName: "first.md",
          downloadUrl: "/download/first.md",
        })}
      />
    )

    expect(await screen.findByRole("heading", { name: "Remote" })).toBeTruthy()
    let download = screen.getByRole("link", { name: "Download" })
    expect(download.getAttribute("href")).toBe("/download/first.md")
    expect(download.getAttribute("download")).toBe("first.md")

    rerender(
      <PretextMarkdownViewer
        source={markdownUrlSource({
          url: "/docs/remote.md",
          fileName: "second.md",
          downloadUrl: "/download/second.md",
        })}
      />
    )

    await waitFor(() => {
      download = screen.getByRole("link", { name: "Download" })
      expect(download.getAttribute("href")).toBe("/download/second.md")
      expect(download.getAttribute("download")).toBe("second.md")
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it("downloads URL sources from the source URL when no download URL is provided", async () => {
    const createObjectURL = vi.mocked(URL.createObjectURL)
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("# Remote URL")))
    )

    render(
      <PretextMarkdownViewer
        source={markdownUrlSource({
          url: "/docs/source-only.md",
          fileName: "source-only.md",
        })}
      />
    )

    expect(
      await screen.findByRole("heading", { name: "Remote URL" })
    ).toBeTruthy()
    const download = screen.getByRole("link", { name: "Download" })
    expect(download.getAttribute("href")).toBe("/docs/source-only.md")
    expect(download.getAttribute("download")).toBe("source-only.md")
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it("updates Blob download metadata without materializing object URLs", async () => {
    const createObjectURL = vi.mocked(URL.createObjectURL)
    const blob = new Blob(["# Blob Source"], { type: "text/markdown" })

    const { rerender } = render(
      <PretextMarkdownViewer
        source={markdownBlobSource({
          blob,
          fileName: "first-blob.md",
          downloadUrl: "/download/first-blob.md",
        })}
      />
    )

    expect(
      await screen.findByRole("heading", { name: "Blob Source" })
    ).toBeTruthy()
    let download = screen.getByRole("link", { name: "Download" })
    expect(download.getAttribute("href")).toBe("/download/first-blob.md")
    expect(download.getAttribute("download")).toBe("first-blob.md")

    rerender(
      <PretextMarkdownViewer
        source={markdownBlobSource({
          blob,
          fileName: "second-blob.md",
          downloadUrl: "/download/second-blob.md",
        })}
      />
    )

    await waitFor(() => {
      download = screen.getByRole("link", { name: "Download" })
      expect(download.getAttribute("href")).toBe("/download/second-blob.md")
      expect(download.getAttribute("download")).toBe("second-blob.md")
    })
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it("downloads local Blob sources through a revoked object URL", async () => {
    const clicks = captureAnchorClicks()
    const { createObjectURL, revokeObjectURL } = mockObjectUrls(
      "blob:local-pretext-markdown"
    )
    const blob = new Blob(["# Local Blob"], { type: "text/markdown" })
    render(
      <PretextMarkdownViewer
        source={markdownBlobSource({
          blob,
          fileName: "local-blob.md",
        })}
      />
    )

    expect(
      await screen.findByRole("heading", { name: "Local Blob" })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Download" }))

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(clicks).toEqual([
      { href: "blob:local-pretext-markdown", download: "local-blob.md" },
    ])
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-pretext-markdown")
  })

  it("renders GitHub alerts as React Markdown alert surfaces", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource("> [!IMPORTANT]\n> Ship **carefully**.")}
        controls={false}
      />
    )

    expect(await screen.findByText("Important")).toBeTruthy()
    expect(screen.getByText("carefully")).toBeTruthy()
    expect(screen.getByRole("note", { name: "Important" })).toBeTruthy()
    expect(container.textContent).not.toContain("[!IMPORTANT]")
    expect(container.textContent).not.toContain("Important:")
    expect(
      container.querySelector('[data-pretext-alert-kind="important"]')
    ).toBeTruthy()
    expect(container.querySelector("[data-pretext-alert-title]")).toBeTruthy()
    expect(container.querySelector("[data-pretext-alert-body]")).toBeTruthy()
    expect(container.querySelector(".lucide-badge-alert")).toBeTruthy()
  })

  it("renders every GitHub alert variant with separated titles and bodies", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "> [!NOTE]",
            "> Read this.",
            "",
            "> [!TIP]",
            "> Try this.",
            "",
            "> [!IMPORTANT]",
            "> Remember this.",
            "",
            "> [!WARNING]",
            "> Watch this.",
            "",
            "> [!CAUTION]",
            "> Stop here.",
          ].join("\n")
        )}
        controls={false}
      />
    )

    for (const name of ["Note", "Tip", "Important", "Warning", "Caution"]) {
      expect(await screen.findByRole("note", { name })).toBeTruthy()
    }

    expect(
      Array.from(container.querySelectorAll("[data-pretext-alert-kind]")).map(
        (node) => node.getAttribute("data-pretext-alert-kind")
      )
    ).toEqual(["note", "tip", "important", "warning", "caution"])
    expect(
      container.querySelectorAll("[data-pretext-alert-title]")
    ).toHaveLength(5)
    expect(
      container.querySelectorAll("[data-pretext-alert-body]")
    ).toHaveLength(5)
    expect(
      Array.from(container.querySelectorAll("[data-pretext-alert-body]")).map(
        (node) => node.textContent?.trim()
      )
    ).toEqual([
      "Read this.",
      "Try this.",
      "Remember this.",
      "Watch this.",
      "Stop here.",
    ])
    expect(container.textContent).not.toContain("[!NOTE]")
    expect(container.textContent).not.toContain("[!TIP]")
    expect(container.querySelector(".lucide-info")).toBeTruthy()
    expect(container.querySelector(".lucide-lightbulb")).toBeTruthy()
    expect(container.querySelector(".lucide-badge-alert")).toBeTruthy()
    expect(container.querySelector(".lucide-triangle-alert")).toBeTruthy()
    expect(container.querySelector(".lucide-circle-alert")).toBeTruthy()
  })

  it("renders nested blockquotes with contained list rhythm", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "> Outer quote.",
            ">",
            "> > Inner quote.",
            "> > - Nested item",
            ">",
            "> Back outside.",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("Outer quote.")).toBeTruthy()
    expect(screen.getByText("Inner quote.")).toBeTruthy()
    expect(screen.getByText("Nested item")).toBeTruthy()
    expect(screen.getByText("Back outside.")).toBeTruthy()

    const blockquotes = Array.from(container.querySelectorAll("blockquote"))
    const outer = blockquotes[0]
    const inner = blockquotes[1]

    expect(blockquotes).toHaveLength(2)
    expect(outer?.contains(inner ?? null)).toBe(true)
    expect(inner?.querySelector("ul li")?.textContent).toContain("Nested item")
    expect(outer?.className).toContain("[&_blockquote]:my-3")
    expect(outer?.className).toContain("[&>ul]:my-2")
    expect(inner?.className).toContain("border-l-4")
    expect(screen.queryByRole("note", { name: "Outer quote." })).toBeNull()
  })

  it("renders directive callouts with normalized titles and aliases", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            ':::warning{title="Careful"}',
            "Review **before** shipping.",
            ":::",
            "",
            ":::success",
            "Looks good.",
            ":::",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("Careful")).toBeTruthy()
    expect(screen.getByText("before")).toBeTruthy()
    expect(screen.getByText("Tip")).toBeTruthy()
    expect(screen.getByRole("note", { name: "Careful" })).toBeTruthy()
    expect(screen.getByRole("note", { name: "Tip" })).toBeTruthy()
    expect(container.textContent).not.toContain(":::")
    expect(
      container.querySelector('[data-pretext-callout-kind="warning"]')
    ).toBeTruthy()
    expect(
      container.querySelector('[data-pretext-callout-kind="tip"]')
    ).toBeTruthy()
  })

  it("applies prose transforms without rewriting inline code", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource(
          'Use "quotes" -- dash ... -> arrows 1/2 :sparkles: and `literal "quotes" -- ... -> 1/2 :sparkles:`.'
        )}
        controls={false}
      />
    )

    expect(await screen.findByText(/“quotes”/)).toBeTruthy()
    expect(screen.getByText(/— dash … → arrows ½ ✨/)).toBeTruthy()
    expect(
      screen.getByText('literal "quotes" -- ... -> 1/2 :sparkles:')
    ).toBeTruthy()
  })

  it("renders common GitHub emoji shortcodes while keeping code literal", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource(
          "Ship :rocket: fixes :bug: docs :memo: atom :atom_symbol: and `literal :rocket: :bug: :atom_symbol:`."
        )}
        controls={false}
      />
    )

    expect(
      await screen.findByText(/Ship 🚀 fixes 🐛 docs 📝 atom ⚛️/)
    ).toBeTruthy()
    expect(
      screen.getByText("literal :rocket: :bug: :atom_symbol:")
    ).toBeTruthy()
  })

  it("preserves escaped Markdown control characters as literal prose", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          String.raw`Escaped \*stars\*, \[label\]\(/docs/example\), \# heading, \`code\`, and \\ slash.`
        )}
        controls={false}
      />
    )

    const paragraph = await screen.findByText(
      "Escaped *stars*, [label](/docs/example), # heading, `code`, and \\ slash."
    )
    expect(paragraph).toBeTruthy()
    expect(container.querySelector("p em")).toBeNull()
    expect(container.querySelector("p strong")).toBeNull()
    expect(container.querySelector("p a")).toBeNull()
    expect(container.querySelector("p code")).toBeNull()
    expect(container.querySelector("h1")).toBeNull()
  })

  it("renders GFM inline semantics for breaks, strike, and autolinks", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "First line",
            "Second line with ~~removed~~ text and www.retab.com plus hello@retab.com.",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText(/First line/)).toBeTruthy()
    const lineBreak = container.querySelector("p br")
    expect(lineBreak).toBeTruthy()
    expect(lineBreak?.getAttribute("data-pretext-line-break")).toBe("soft")
    const strikethrough = container.querySelector("del")
    expect(strikethrough?.textContent).toBe("removed")
    expect(strikethrough?.getAttribute("data-pretext-strikethrough")).toBe("")
    expect(strikethrough?.className).toContain("decoration-muted-foreground/70")
    expect(strikethrough?.className).toContain("decoration-2")
    const webAutolink = screen.getByRole("link", { name: "www.retab.com" })
    const emailAutolink = screen.getByRole("link", {
      name: "hello@retab.com",
    })

    expect(webAutolink.getAttribute("href")).toBe("http://www.retab.com")
    expect(webAutolink.getAttribute("data-pretext-link-kind")).toBe("external")
    expect(webAutolink.getAttribute("data-pretext-link-form")).toBe("autolink")
    expect(webAutolink.className).toContain("font-mono")
    expect(emailAutolink.getAttribute("href")).toBe("mailto:hello@retab.com")
    expect(emailAutolink.getAttribute("data-pretext-link-kind")).toBe("email")
    expect(emailAutolink.getAttribute("data-pretext-link-form")).toBe(
      "email-autolink"
    )
    expect(emailAutolink.className).toContain("font-mono")
  })

  it("applies link target and rel invariants", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "[Fragment](#release-notes)",
            "[Root](/docs/components/file-viewer)",
            "[Relative](docs/viewers)",
            "[Email](mailto:hello@retab.com)",
            '[External](https://example.com "External docs")',
          ].join("\n\n")
        )}
        controls={false}
      />
    )

    const fragment = await screen.findByRole("link", { name: "Fragment" })
    const root = screen.getByRole("link", { name: "Root" })
    const relative = screen.getByRole("link", { name: "Relative" })
    const email = screen.getByRole("link", { name: "Email" })
    const external = screen.getByRole("link", { name: "External" })

    for (const link of [fragment, root, relative, email]) {
      expect(link.getAttribute("target")).toBeNull()
      expect(link.getAttribute("rel")).toBeNull()
      expect(link.className).toContain("visited:text-muted-foreground")
    }
    expect(fragment.getAttribute("data-pretext-link-kind")).toBe("fragment")
    expect(fragment.className).toContain("decoration-dotted")
    expect(root.getAttribute("data-pretext-link-kind")).toBe("root")
    expect(relative.getAttribute("data-pretext-link-kind")).toBe("relative")
    expect(email.getAttribute("data-pretext-link-kind")).toBe("email")
    expect(external.getAttribute("data-pretext-link-kind")).toBe("external")
    expect(fragment.getAttribute("data-pretext-link-form")).toBe("inline")
    expect(email.getAttribute("data-pretext-link-form")).toBe("inline")
    expect(external.getAttribute("data-pretext-link-form")).toBe("inline")
    expect(external.getAttribute("target")).toBe("_blank")
    expect(external.getAttribute("rel")).toBe("noopener noreferrer")
    expect(external.getAttribute("title")).toBe("External docs")
    expect(external.className).toContain("visited:text-muted-foreground")
    expect(external.textContent).toBe("External")
    expect(external.querySelector(".lucide-external-link")).toBeTruthy()
    expect(
      external
        .querySelector(".lucide-external-link")
        ?.getAttribute("aria-hidden")
    ).toBe("true")
  })

  it("keeps long prose, links, tables, and component labels inside the viewer width", async () => {
    const longToken =
      "superlongidentifierwithoutnaturalbreakpoints0123456789abcdefghijklmnopqrstuvwxyz"
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            `${longToken} [${longToken}](https://example.com/${longToken}).`,
            "",
            "| Key | Value |",
            "| --- | --- |",
            `| ${longToken} | ${longToken} |`,
            "",
            `<Metric label="${longToken}" value="${longToken}" />`,
            "",
            `<Badge label="${longToken}" />`,
          ].join("\n")
        )}
        controls={false}
      />
    )

    const paragraph = await screen.findByText((_, element) => {
      return element?.tagName === "P" &&
        element.textContent?.includes(longToken)
        ? true
        : false
    })
    const link = screen.getByRole("link", { name: longToken })
    const tableCells = Array.from(container.querySelectorAll("td"))
    const metric = container.querySelector('[data-pretext-component="Metric"]')
    const badge = container.querySelector('[data-pretext-component="Badge"]')

    expect(paragraph.className).toContain("[overflow-wrap:anywhere]")
    expect(link.className).toContain("[overflow-wrap:anywhere]")
    expect(tableCells).toHaveLength(2)
    expect(tableCells[0]?.className).toContain("[overflow-wrap:anywhere]")
    expect(tableCells[1]?.className).toContain("[overflow-wrap:anywhere]")
    expect(metric?.className).toContain("min-w-0")
    expect(metric?.textContent).toContain(longToken)
    expect(badge?.className).toContain("[overflow-wrap:anywhere]")
  })

  it("resolves reference links from definitions outside the visible chunk", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "Use [Docs][docs].",
            "",
            ...Array.from(
              { length: 40 },
              (_, index) => `Paragraph ${index + 1}.`
            ),
            "",
            '[docs]: https://example.com/docs "Docs"',
          ].join("\n\n")
        )}
        controls={false}
      />
    )

    const link = await screen.findByRole("link", { name: "Docs" })
    expect(link.getAttribute("href")).toBe("https://example.com/docs")
    expect(link.getAttribute("title")).toBe("Docs")
    expect(screen.queryByText(/\[docs\]:/)).toBeNull()
  })

  it("resolves reference images from definitions outside the visible chunk", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "![Logo][logo]",
            "",
            ...Array.from(
              { length: 40 },
              (_, index) => `Paragraph ${index + 1}.`
            ),
            "",
            '[logo]: /logo.png "Logo title"',
          ].join("\n\n")
        )}
        controls={false}
      />
    )

    const image = await screen.findByRole("img", { name: "Logo" })
    expect(image.getAttribute("src")).toBe("/logo.png")
    expect(image.getAttribute("title")).toBe("Logo title")
    expect(screen.getByText("Logo title")).toBeTruthy()
    expect(screen.queryByText(/\[logo\]:/)).toBeNull()
  })

  it("renders GFM task list checkboxes as read-only controls", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(["- [x] Done", "- [ ] Pending"].join("\n"))}
        controls={false}
      />
    )

    const completed = await screen.findByRole("checkbox", {
      name: "Completed task",
    })
    const pending = screen.getByRole("checkbox", { name: "Incomplete task" })

    expect((completed as HTMLInputElement).checked).toBe(true)
    expect(completed.hasAttribute("readonly")).toBe(true)
    expect(completed.getAttribute("aria-readonly")).toBe("true")
    expect((completed as HTMLInputElement).disabled).toBe(true)
    expect(completed.getAttribute("data-pretext-task-checkbox")).toBe("checked")
    expect(completed.className).toContain("accent-primary")
    expect((pending as HTMLInputElement).checked).toBe(false)
    expect(pending.hasAttribute("readonly")).toBe(true)
    expect(pending.getAttribute("aria-readonly")).toBe("true")
    expect((pending as HTMLInputElement).disabled).toBe(true)
    expect(pending.getAttribute("data-pretext-task-checkbox")).toBe("unchecked")
    expect(pending.className).toContain("accent-primary")

    const items = Array.from(
      container.querySelectorAll("[data-pretext-task-list-item]")
    )
    expect(items).toHaveLength(2)
    expect(items[0]?.className).toContain("list-none")
    expect(items[0]?.className).toContain("pl-0")
    expect(items[0]?.textContent).toContain("Done")
    expect(items[1]?.textContent).toContain("Pending")
  })

  it("preserves ordered list start values", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "3. Third",
            "4. Fourth",
            "",
            "Paragraph",
            "",
            "7. Seventh",
            "8. Eighth",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await screen.findByText("Third")
    const lists = Array.from(container.querySelectorAll("ol"))
    expect(lists).toHaveLength(2)
    expect(lists[0]?.getAttribute("start")).toBe("3")
    expect(lists[1]?.getAttribute("start")).toBe("7")
    expect(screen.getByText("Eighth")).toBeTruthy()
  })

  it("keeps loose and nested lists in one readable list rhythm", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "1. Parent item",
            "",
            "   Continuation paragraph.",
            "",
            "   - Child bullet",
            "   - Another child",
            "",
            "2. Next item",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("Parent item")).toBeTruthy()
    expect(screen.getByText("Continuation paragraph.")).toBeTruthy()
    expect(screen.getByText("Child bullet")).toBeTruthy()
    expect(screen.getByText("Next item")).toBeTruthy()

    const orderedList = container.querySelector("ol")
    const nestedList = orderedList?.querySelector("ul")
    const parentItem = orderedList?.querySelector("li")

    expect(orderedList?.className).toContain("list-decimal")
    expect(orderedList?.className).toContain("[&_ol]:list-[lower-alpha]")
    expect(nestedList?.className).toContain("list-disc")
    expect(nestedList?.className).toContain("[&_ul]:list-[circle]")
    expect(parentItem?.className).toContain("[&>p]:my-1")
    expect(parentItem?.querySelectorAll("p")).toHaveLength(2)
    expect(parentItem?.querySelectorAll("ul li")).toHaveLength(2)
  })

  it("renders whitelisted component markdown through safe React components", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '<Metric label="Accuracy" value="98%" />',
            "",
            '<Badge label="Stable" tone="success" />',
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("Accuracy")).toBeTruthy()
    expect(screen.getByText("98%")).toBeTruthy()
    expect(screen.getByText("Stable")).toBeTruthy()
    expect(
      container.querySelector('[data-pretext-component="Metric"]')
    ).toBeTruthy()
    expect(
      container.querySelector('[data-pretext-component="Badge"]')
    ).toBeTruthy()
  })

  it("renders safe typed component literal props without executing expressions", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '<Metric label="Score" value={98} />',
            "",
            '<Video src="/demo.mp4" label="Clip" controls={false} muted loop />',
            "",
            '::video{src="/directive.mp4" label="Directive clip" controls=false muted=true loop=true}',
            "",
            '<Metric label="Unsafe" value={score} />',
            "",
            '<Video src="/unsafe.mp4" label="Unsafe video" muted={shouldMute()} />',
            "",
            '<Video src="/spread.mp4" label="Spread video" {...props} />',
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("Score")).toBeTruthy()
    expect(screen.getByText("98")).toBeTruthy()

    const videos = Array.from(container.querySelectorAll("video"))
    expect(videos).toHaveLength(2)
    expect(videos[0]?.getAttribute("src")).toBe("/demo.mp4")
    expect(videos[0]?.hasAttribute("controls")).toBe(false)
    expect(videos[0]?.muted).toBe(true)
    expect(videos[0]?.loop).toBe(true)
    expect(videos[1]?.getAttribute("src")).toBe("/directive.mp4")
    expect(videos[1]?.hasAttribute("controls")).toBe(false)
    expect(videos[1]?.muted).toBe(true)
    expect(videos[1]?.loop).toBe(true)

    expect(
      screen.getByText('<Metric label="Unsafe" value={score} />')
    ).toBeTruthy()
    expect(
      screen.getByText(
        '<Video src="/unsafe.mp4" label="Unsafe video" muted={shouldMute()} />'
      )
    ).toBeTruthy()
    expect(container.textContent).toContain("Spread video")
    expect(container.textContent).toContain("props")
  })

  it("renders whitelisted component markdown with safe Markdown children", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '<Callout kind="warning" title="Review">',
            "",
            "Check **nested** Markdown before shipping.",
            "",
            "</Callout>",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByRole("note", { name: "Review" })).toBeTruthy()
    expect(screen.getByText("nested").tagName).toBe("STRONG")
    expect(container.textContent).not.toContain("<Callout")
    expect(container.textContent).not.toContain("</Callout>")
    expect(
      container.querySelector('[data-pretext-component="Callout"]')
    ).toBeTruthy()
    expect(
      container.querySelector('[data-pretext-callout-kind="warning"]')
    ).toBeTruthy()
  })

  it("renders Accordion component markdown with safe Markdown children", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '<Accordion title="More details">',
            "",
            "- **Nested** item",
            "- Second item",
            "",
            "</Accordion>",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("More details")).toBeTruthy()
    expect(screen.getByText("Nested").tagName).toBe("STRONG")
    expect(screen.getByRole("list")).toBeTruthy()
    expect(container.textContent).not.toContain("<Accordion")
    expect(container.textContent).not.toContain("</Accordion>")
    expect(
      container.querySelector('[data-pretext-component="Accordion"]')
    ).toBeTruthy()
    expect(container.querySelector("details summary")?.textContent).toBe(
      "More details"
    )
  })

  it("renders whitelisted component directives through safe React components", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '::metric{label="Accuracy" value="98%"}',
            "",
            ':badge[Stable]{tone="success"}',
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("Accuracy")).toBeTruthy()
    expect(screen.getByText("98%")).toBeTruthy()
    expect(screen.getByText("Stable")).toBeTruthy()
    expect(
      container.querySelector('[data-pretext-component="Metric"]')
    ).toBeTruthy()
    expect(
      container.querySelector('[data-pretext-component="Badge"]')
    ).toBeTruthy()
    expect(container.textContent).not.toContain("::metric")
    expect(container.textContent).not.toContain(":badge")
  })

  it("renders container component directives with safe Markdown children", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            ':::accordion{title="Directive details"}',
            "Directive **body**.",
            ":::",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("Directive details")).toBeTruthy()
    expect(screen.getByText("body").tagName).toBe("STRONG")
    expect(container.textContent).not.toContain(":::accordion")
    expect(
      container.querySelector('[data-pretext-component="Accordion"]')
    ).toBeTruthy()
  })

  it("renders Tabs container directives with selectable safe Markdown panels", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '::::tabs{label="Directive modes"}',
            ':::tab{title="Preview"}',
            "Preview **body**.",
            ":::",
            ':::tab{title="Raw"}',
            "`raw` body.",
            ":::",
            "::::",
          ].join("\n")
        )}
        controls={false}
      />
    )

    const previewTab = await screen.findByRole("tab", { name: "Preview" })
    const rawTab = screen.getByRole("tab", { name: "Raw" })
    const rawPanel = document.getElementById(
      rawTab.getAttribute("aria-controls") ?? ""
    )

    expect(
      screen.getByRole("tablist", { name: "Directive modes" })
    ).toBeTruthy()
    expect(previewTab.getAttribute("aria-selected")).toBe("true")
    expect(rawPanel?.hidden).toBe(true)

    fireEvent.click(rawTab)

    expect(rawTab.getAttribute("aria-selected")).toBe("true")
    expect(rawPanel?.hidden).toBe(false)
    expect(rawPanel?.querySelector("code")?.textContent).toBe("raw")
    expect(container.textContent).not.toContain(":::tabs")
    expect(container.textContent).not.toContain(":::tab")
  })

  it("supports keyboard navigation for restricted Tabs controls", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '::::tabs{label="Directive modes"}',
            ':::tab{title="Preview"}',
            "Preview body.",
            ":::",
            ':::tab{title="Raw"}',
            "Raw body.",
            ":::",
            ':::tab{title="Diff"}',
            "Diff body.",
            ":::",
            "::::",
          ].join("\n")
        )}
        controls={false}
      />
    )

    const previewTab = await screen.findByRole("tab", { name: "Preview" })
    const rawTab = screen.getByRole("tab", { name: "Raw" })
    const diffTab = screen.getByRole("tab", { name: "Diff" })

    previewTab.focus()
    fireEvent.keyDown(previewTab, { key: "ArrowRight" })

    expect(rawTab.getAttribute("aria-selected")).toBe("true")
    expect(rawTab.getAttribute("tabindex")).toBe("0")
    expect(previewTab.getAttribute("tabindex")).toBe("-1")
    expect(document.activeElement).toBe(rawTab)

    fireEvent.keyDown(rawTab, { key: "End" })

    expect(diffTab.getAttribute("aria-selected")).toBe("true")
    expect(document.activeElement).toBe(diffTab)

    fireEvent.keyDown(diffTab, { key: "ArrowRight" })

    expect(previewTab.getAttribute("aria-selected")).toBe("true")
    expect(document.activeElement).toBe(previewTab)

    fireEvent.keyDown(previewTab, { key: "Home" })

    expect(previewTab.getAttribute("aria-selected")).toBe("true")
    expect(document.activeElement).toBe(previewTab)
  })

  it("renders restricted Image components through the safe image surface", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '<Image src="/chart.png" alt="Chart" title="Quarterly chart" />',
            "",
            '::image{src="/directive-chart.png" alt="Directive chart" title="Directive title"}',
            "",
            '<Image src="javascript:alert(1)" alt="Blocked chart" />',
            "",
            '<Image src="/icons/chart.svg" alt="SVG chart" />',
            "",
            '<Image src="data:image/png;base64,AAAA" alt="Data chart" />',
          ].join("\n")
        )}
        controls={false}
      />
    )

    const chart = await screen.findByRole("img", { name: "Chart" })
    const directiveChart = screen.getByRole("img", {
      name: "Directive chart",
    })
    const blocked = screen.getByRole("img", { name: "Blocked chart" })
    const blockedSvg = screen.getByRole("img", { name: "SVG chart" })
    const blockedData = screen.getByRole("img", { name: "Data chart" })

    expect(chart.getAttribute("src")).toBe("/chart.png")
    expect(chart.getAttribute("title")).toBe("Quarterly chart")
    expect(screen.getByText("Quarterly chart")).toBeTruthy()
    expect(directiveChart.getAttribute("src")).toBe("/directive-chart.png")
    expect(screen.getByText("Directive title")).toBeTruthy()
    expect(chart.closest('[data-pretext-component="Image"]')).toBeTruthy()
    expect(
      directiveChart.closest('[data-pretext-component="Image"]')
    ).toBeTruthy()
    expect(
      blocked
        .closest("[data-pretext-image-state]")
        ?.getAttribute("data-pretext-image-state")
    ).toBe("blocked")
    expect(
      blockedSvg
        .closest("[data-pretext-image-state]")
        ?.getAttribute("data-pretext-image-state")
    ).toBe("blocked")
    expect(
      blockedData
        .closest("[data-pretext-image-state]")
        ?.getAttribute("data-pretext-image-state")
    ).toBe("blocked")
    expect(container.querySelector('img[src$=".svg"]')).toBeNull()
    expect(container.querySelector('img[src^="data:"]')).toBeNull()
    expect(container.textContent).not.toContain("<Image")
    expect(container.textContent).not.toContain("::image")
  })

  it("renders restricted Video components through the safe media surface", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '<Video src="/demo.mp4" label="Demo video" title="Product demo" />',
            "",
            '::video{src="/directive-demo.webm" label="Directive video" title="Directive demo"}',
            "",
            '<Video src="javascript:alert(1)" label="Blocked video" />',
            "",
            '<Video src="/demo.svg" label="Blocked SVG video" />',
            "",
            '<Video src="blob:https://retab.com/video" label="Blocked Blob video" />',
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(
      await screen.findByRole("group", { name: "Demo video" })
    ).toBeTruthy()
    const videos = Array.from(container.querySelectorAll("video"))
    expect(videos).toHaveLength(2)
    expect(videos[0]?.getAttribute("src")).toBe("/demo.mp4")
    expect(videos[0]?.hasAttribute("controls")).toBe(true)
    expect(videos[0]?.getAttribute("preload")).toBe("metadata")
    expect(videos[0]?.getAttribute("title")).toBe("Product demo")
    expect(screen.getByText("Product demo")).toBeTruthy()
    expect(videos[1]?.getAttribute("src")).toBe("/directive-demo.webm")
    expect(screen.getByText("Directive demo")).toBeTruthy()
    expect(videos[0]?.closest('[data-pretext-component="Video"]')).toBeTruthy()
    expect(
      screen
        .getByRole("group", { name: "Video blocked: Blocked video" })
        .getAttribute("data-pretext-video-state")
    ).toBe("blocked")
    expect(
      screen
        .getByRole("group", { name: "Video blocked: Blocked SVG video" })
        .getAttribute("data-pretext-video-state")
    ).toBe("blocked")
    expect(
      screen
        .getByRole("group", { name: "Video blocked: Blocked Blob video" })
        .getAttribute("data-pretext-video-state")
    ).toBe("blocked")
    expect(container.querySelector('video[src$=".svg"]')).toBeNull()
    expect(container.querySelector('video[src^="blob:"]')).toBeNull()
    expect(container.textContent).not.toContain("<Video")
    expect(container.textContent).not.toContain("::video")

    fireEvent.error(videos[0]!)

    expect(
      await screen.findByRole("group", {
        name: "Video failed to load: Demo video",
      })
    ).toBeTruthy()
  })

  it("renders restricted Diagram components through the Mermaid surface", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '<Diagram type="mermaid" title="Component flow" caption="Component caption" source="graph TD; A-->B" />',
            "",
            '::diagram{type="mermaid" title="Directive flow" caption="Directive caption" source="graph LR; Start-->Done"}',
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(
      await screen.findByRole("group", { name: "Component flow" })
    ).toBeTruthy()
    expect(screen.getByRole("group", { name: "Directive flow" })).toBeTruthy()
    const diagrams = Array.from(
      container.querySelectorAll<HTMLElement>(
        '[data-diagram-language="mermaid"]'
      )
    )
    expect(diagrams).toHaveLength(2)
    expect(diagrams[0]?.getAttribute("data-pretext-component")).toBe("Diagram")
    await waitFor(() => {
      expect(diagrams[0]?.dataset.diagramState).toBe("ready")
      expect(diagrams[1]?.dataset.diagramState).toBe("ready")
    })
    expect(screen.getByText("Component flow")).toBeTruthy()
    expect(screen.getByText("Directive flow")).toBeTruthy()
    expect(screen.getByText("Component caption")).toBeTruthy()
    expect(screen.getByText("Directive caption")).toBeTruthy()
    const captions = Array.from(
      container.querySelectorAll<HTMLElement>("[data-pretext-diagram-caption]")
    )
    expect(captions.map((caption) => caption.textContent)).toEqual([
      "Component caption",
      "Directive caption",
    ])
    expect(diagrams[0]?.getAttribute("aria-describedby")).toContain(
      captions[0]?.id
    )
    expect(diagrams[1]?.getAttribute("aria-describedby")).toContain(
      captions[1]?.id
    )
    expect(container.textContent).not.toContain("<Diagram")
    expect(container.textContent).not.toContain("::diagram")

    fireEvent.click(screen.getAllByLabelText("Copy diagram source")[0]!)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        ["graph TD", "A-->B"].join("\n")
      )
    })
  })

  it("keeps unsafe component markdown inert", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '<Danger onClick="steal()" value="x" />',
            "",
            '<Metric label={getLabel()} value="98%" />',
            "",
            '<Metric label="Accuracy" tone="success" value="98%" />',
            "",
            '<Badge label="Invalid" tone="purple" />',
            "",
            '<Image src="/chart.png" alt="Unsafe chart" onClick="steal" />',
            "",
            '<Video src="/demo.mp4" label="Unsafe video" onClick="steal" />',
            "",
            '<Diagram type="mermaid" source="graph TD; A-->B" onClick="steal" />',
            "",
            '<Diagram type="plantuml" source="@startuml" />',
            "",
            '<Callout kind="warning" onClick="steal">',
            "",
            "Unsafe body.",
            "",
            "</Callout>",
            "",
            '<Accordion title="Unsafe" onClick="steal">',
            "",
            "Unsafe details.",
            "",
            "</Accordion>",
            "",
            '<Tabs label="Unsafe" onClick="steal">',
            '<Tab title="Unsafe">',
            "Unsafe tab.",
            "</Tab>",
            "</Tabs>",
            "",
            '::metric{label="Unsafe" onClick="steal"}',
            "",
            ':::accordion{title="Unsafe" onClick="steal"}',
            "Unsafe directive.",
            ":::",
            "",
            ':::tabs{label="Unsafe" onClick="steal"}',
            ':::tab{title="Unsafe"}',
            "Unsafe tab directive.",
            ":::",
            ":::",
            "",
            ':badge[Invalid directive]{tone="purple"}',
            "",
            '::image{src="/chart.png" alt="Unsafe directive chart" onClick="steal"}',
            "",
            '::video{src="/demo.mp4" label="Unsafe directive video" onClick="steal"}',
            "",
            '::diagram{type="mermaid" source="graph TD; A-->B" onClick="steal"}',
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(
      await screen.findByText('<Danger onClick="steal()" value="x" />')
    ).toBeTruthy()
    expect(
      screen.getByText('<Metric label={getLabel()} value="98%" />')
    ).toBeTruthy()
    expect(
      screen.getByText('<Metric label="Accuracy" tone="success" value="98%" />')
    ).toBeTruthy()
    expect(
      screen.getByText('<Badge label="Invalid" tone="purple" />')
    ).toBeTruthy()
    expect(
      screen.getByText(
        '<Image src="/chart.png" alt="Unsafe chart" onClick="steal" />'
      )
    ).toBeTruthy()
    expect(
      screen.getByText(
        '<Video src="/demo.mp4" label="Unsafe video" onClick="steal" />'
      )
    ).toBeTruthy()
    expect(
      screen.getByText(
        '<Diagram type="mermaid" source="graph TD; A-->B" onClick="steal" />'
      )
    ).toBeTruthy()
    expect(container.textContent).toContain(
      '<Diagram type="plantuml" source="@startuml" />'
    )
    expect(
      screen.getByText('<Callout kind="warning" onClick="steal">')
    ).toBeTruthy()
    expect(
      screen.getByText('<Accordion title="Unsafe" onClick="steal">')
    ).toBeTruthy()
    expect(container.textContent).toContain("::metric")
    const fallbacks = Array.from(
      container.querySelectorAll<HTMLElement>(
        "[data-pretext-component-fallback]"
      )
    )
    expect(fallbacks.length).toBeGreaterThanOrEqual(10)
    expect(
      fallbacks.some(
        (fallback) =>
          fallback.getAttribute("data-pretext-component-fallback-name") ===
            "Danger" &&
          fallback.getAttribute("data-pretext-component-fallback-reason") ===
            "Unsupported component"
      )
    ).toBe(true)
    expect(
      fallbacks.some(
        (fallback) =>
          fallback.getAttribute("data-pretext-component-fallback-name") ===
            "Metric" &&
          fallback.getAttribute("data-pretext-component-fallback-reason") ===
            "Component props must be literal values"
      )
    ).toBe(true)
    expect(
      fallbacks.some(
        (fallback) =>
          fallback.getAttribute("data-pretext-component-fallback-name") ===
            "Image" &&
          fallback.getAttribute("data-pretext-component-fallback-reason") ===
            "Event handler props are not supported"
      )
    ).toBe(true)
    expect(
      fallbacks.some(
        (fallback) =>
          fallback.getAttribute("data-pretext-component-fallback-name") ===
            "Tabs" &&
          fallback.getAttribute("data-pretext-component-fallback-reason") ===
            "Event handler props are not supported" &&
          fallback.textContent?.includes(
            '<Tabs label="Unsafe" onClick="steal">'
          )
      )
    ).toBe(true)
    expect(container.querySelector("[data-pretext-component]")).toBeNull()
  })

  it("keeps unsafe component directives inert", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '::metric{label="Unsafe" onClick="steal"}',
            "",
            ':::accordion{title="Unsafe" onClick="steal"}',
            "Unsafe directive.",
            ":::",
            "",
            ':::tabs{label="Unsafe" onClick="steal"}',
            ':::tab{title="Unsafe"}',
            "Unsafe tab directive.",
            ":::",
            ":::",
            "",
            ':badge[Invalid directive]{tone="purple"}',
            "",
            '::image{src="/chart.png" alt="Unsafe directive chart" onClick="steal"}',
            "",
            '::video{src="/demo.mp4" label="Unsafe directive video" onClick="steal"}',
            "",
            '::diagram{type="mermaid" source="graph TD; A-->B" onClick="steal"}',
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(
      await screen.findByText('::metric{label="Unsafe" onClick="steal"}')
    ).toBeTruthy()
    const fallbacks = Array.from(
      container.querySelectorAll<HTMLElement>(
        "[data-pretext-component-fallback]"
      )
    )
    expect(fallbacks.length).toBeGreaterThanOrEqual(6)
    expect(container.textContent).toContain(
      '::accordion{title="Unsafe" onClick="steal"}'
    )
    expect(container.textContent).toContain(
      '::tabs{label="Unsafe" onClick="steal"}'
    )
    expect(container.textContent).toContain("Invalid directive")
    expect(container.textContent).toContain(
      '::image{src="/chart.png" alt="Unsafe directive chart" onClick="steal"}'
    )
    expect(container.textContent).toContain(
      '::video{src="/demo.mp4" label="Unsafe directive video" onClick="steal"}'
    )
    expect(container.textContent).toContain(
      '::diagram{type="mermaid" source="graph TD; A-->B" onClick="steal"}'
    )
    expect(
      fallbacks.every(
        (fallback) =>
          fallback.getAttribute("data-pretext-component-fallback-reason") ===
          "Unsupported component directive props"
      )
    ).toBe(true)
    expect(container.querySelector("[data-pretext-component]")).toBeNull()
  })

  it("keeps MDX imports, exports, and remote components inert", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            'import Chart from "./Chart"',
            "",
            'export const metadata = { title: "Unsafe" }',
            "",
            '<Remote.Widget label="Unsafe" />',
            "",
            '<Metric.Remote label="Unsafe" value={98} />',
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText(/import Chart from/)).toBeTruthy()
    expect(screen.getByText(/export const metadata/)).toBeTruthy()
    expect(container.textContent).toContain("<Remote.Widget")
    expect(container.textContent).toContain("<Metric.Remote")
    expect(
      Array.from(
        container.querySelectorAll<HTMLElement>(
          "[data-pretext-component-fallback]"
        )
      ).every(
        (fallback) =>
          fallback.getAttribute("data-pretext-component-fallback-reason") ===
          "Remote or namespaced components are not supported"
      )
    ).toBe(true)
    expect(container.querySelector("[data-pretext-component]")).toBeNull()
  })

  it("renders mermaid fences as diagram surfaces", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource("```mermaid\ngraph TD\n  A-->B\n```")}
        controls={false}
      />
    )

    await screen.findByText("mermaid")
    expect(screen.getByRole("group", { name: "Mermaid diagram" })).toBeTruthy()
    const diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )

    expect(diagram).toBeTruthy()
    await waitFor(() => expect(diagram?.dataset.diagramState).toBe("ready"))
    expect(await screen.findByTestId("mock-mermaid-svg")).toBeTruthy()
    expect(screen.getByRole("img", { name: "Mermaid diagram" })).toBeTruthy()
    expect(diagram?.querySelector("svg")).toBeTruthy()
  })

  it("renders Mermaid fence title and caption metadata", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '```mermaid title="System flow" caption="Rendered architecture diagram"',
            "graph LR",
            "  Start-->Done",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("System flow")).toBeTruthy()
    expect(screen.getByRole("group", { name: "System flow" })).toBeTruthy()
    const diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const description = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )
    const caption = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-caption]"
    )

    expect(caption?.tagName).toBe("FIGCAPTION")
    expect(caption?.textContent).toBe("Rendered architecture diagram")
    expect(diagram?.getAttribute("aria-describedby")).toBe(
      `${description?.id} ${caption?.id}`
    )
  })

  it("copies Mermaid diagram source from rendered diagram surfaces", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource("```mermaid\ngraph TD\n  A-->B\n```")}
        controls={false}
      />
    )

    await screen.findByRole("group", { name: "Mermaid diagram" })
    fireEvent.click(screen.getByLabelText("Copy diagram source"))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "graph TD\n  A-->B"
      )
    })
    expect(screen.getByLabelText("Copied")).toBeTruthy()
  })

  it("renders sequence diagrams through the built-in fallback when Mermaid layout fails", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "%% force-basic-fallback",
            "sequenceDiagram",
            "participant U as User",
            "participant A as App",
            "U->>A: Request",
            "A-->>U: Response",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    const diagram = await screen.findByRole("group", {
      name: "Mermaid diagram",
    })
    await waitFor(() => {
      expect(diagram.getAttribute("data-diagram-state")).toBe("ready")
    })

    const svg = container.querySelector<SVGSVGElement>(
      'svg[data-pretext-basic-mermaid="sequence"]'
    )
    expect(svg).toBeTruthy()
    expect(screen.queryByTestId("mock-mermaid-svg")).toBeNull()
    expect(svg?.textContent).toContain("User")
    expect(svg?.textContent).toContain("App")
    expect(svg?.textContent).toContain("Request")
    expect(svg?.textContent).toContain("Response")
    expect(screen.getByRole("img", { name: "Mermaid diagram" })).toBeTruthy()
  })

  it("renders state diagrams through the built-in fallback when Mermaid layout fails", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "%% force-basic-fallback",
            "stateDiagram-v2",
            'state "In Review" as Review',
            "Draft --> Review: Submit",
            "Review --> Done",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    const diagram = await screen.findByRole("group", {
      name: "Mermaid diagram",
    })
    await waitFor(() => {
      expect(diagram.getAttribute("data-diagram-state")).toBe("ready")
    })

    const svg = container.querySelector<SVGSVGElement>(
      'svg[data-pretext-basic-mermaid="state"]'
    )
    expect(svg).toBeTruthy()
    expect(screen.queryByTestId("mock-mermaid-svg")).toBeNull()
    expect(svg?.textContent).toContain("Draft")
    expect(svg?.textContent).toContain("In Review")
    expect(svg?.textContent).toContain("Done")
    expect(svg?.textContent).toContain("Submit")
    expect(screen.getByRole("img", { name: "Mermaid diagram" })).toBeTruthy()
  })

  it("renders class diagrams through the built-in fallback when Mermaid layout fails", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "%% force-basic-fallback",
            "classDiagram",
            "Animal <|-- Duck: inherits",
            "class Animal",
            "Duck : +quack()",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    const diagram = await screen.findByRole("group", {
      name: "Mermaid diagram",
    })
    await waitFor(() => {
      expect(diagram.getAttribute("data-diagram-state")).toBe("ready")
    })

    const svg = container.querySelector<SVGSVGElement>(
      'svg[data-pretext-basic-mermaid="class"]'
    )
    expect(svg).toBeTruthy()
    expect(screen.queryByTestId("mock-mermaid-svg")).toBeNull()
    expect(svg?.textContent).toContain("Animal")
    expect(svg?.textContent).toContain("Duck")
    expect(svg?.textContent).toContain("inherits")
    expect(screen.getByRole("img", { name: "Mermaid diagram" })).toBeTruthy()
  })

  it("renders ER diagrams through the built-in fallback when Mermaid layout fails", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "%% force-basic-fallback",
            "erDiagram",
            "CUSTOMER ||--o{ ORDER : places",
            "ORDER ||--|{ LINE_ITEM : contains",
            "CUSTOMER {",
            "  string name",
            "}",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    const diagram = await screen.findByRole("group", {
      name: "Mermaid diagram",
    })
    await waitFor(() => {
      expect(diagram.getAttribute("data-diagram-state")).toBe("ready")
    })

    const svg = container.querySelector<SVGSVGElement>(
      'svg[data-pretext-basic-mermaid="er"]'
    )
    expect(svg).toBeTruthy()
    expect(screen.queryByTestId("mock-mermaid-svg")).toBeNull()
    expect(svg?.textContent).toContain("CUSTOMER")
    expect(svg?.textContent).toContain("ORDER")
    expect(svg?.textContent).toContain("LINE_ITEM")
    expect(svg?.textContent).toContain("places")
    expect(svg?.textContent).toContain("contains")
    expect(screen.getByRole("img", { name: "Mermaid diagram" })).toBeTruthy()
  })

  it("renders pie diagrams through the built-in fallback when Mermaid layout fails", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "%% force-basic-fallback",
            "pie showData",
            '  "Search" : 45',
            '  "Direct" : 35',
            '  "Referral" : 20',
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    const diagram = await screen.findByRole("group", {
      name: "Mermaid diagram",
    })
    await waitFor(() => {
      expect(diagram.getAttribute("data-diagram-state")).toBe("ready")
    })

    const svg = container.querySelector<SVGSVGElement>(
      'svg[data-pretext-basic-mermaid="pie"]'
    )
    expect(svg).toBeTruthy()
    expect(screen.queryByTestId("mock-mermaid-svg")).toBeNull()
    expect(svg?.querySelectorAll("path")).toHaveLength(3)
    expect(svg?.textContent).toContain("Search")
    expect(svg?.textContent).toContain("Direct")
    expect(svg?.textContent).toContain("Referral")
    expect(svg?.textContent).toContain("45 (45%)")
    expect(screen.getByRole("img", { name: "Mermaid diagram" })).toBeTruthy()
  })

  it.each([
    {
      expectedText: ["Build", "Compile", "QA"],
      kind: "journey",
      source: [
        "journey",
        "title Release",
        "section Build",
        "Compile: 5: CI",
        "Test: 4: QA",
      ],
    },
    {
      expectedText: ["Design", "Spec", "Build"],
      kind: "gantt",
      source: [
        "gantt",
        "dateFormat  YYYY-MM-DD",
        "section Design",
        "Spec :done, spec, 2026-01-01, 3d",
        "Build :active, build, after spec, 5d",
      ],
    },
    {
      expectedText: ["main", "feature", "merge feature"],
      kind: "gitGraph",
      source: [
        "gitGraph",
        "commit",
        "branch feature",
        "checkout feature",
        "commit",
        "checkout main",
        "merge feature",
      ],
    },
    {
      expectedText: ["Alpha", "2024 : Parser", "2025 : Renderer"],
      kind: "timeline",
      source: ["timeline", "section Alpha", "2024 : Parser", "2025 : Renderer"],
    },
    {
      expectedText: ["Viewer", "Diagrams", "Math"],
      kind: "mindmap",
      source: ["mindmap", "root((Viewer))", "Diagrams", "Math"],
    },
    {
      expectedText: ["Reach", "Retention", "Enterprise", "Self-serve"],
      kind: "quadrantChart",
      source: [
        "quadrantChart",
        "x-axis Low Reach --> High Reach",
        "y-axis Low Retention --> High Retention",
        "quadrant-1 Expand",
        "quadrant-3 Rework",
        "Enterprise: [0.78, 0.82]",
        "Self-serve: [0.34, 0.48]",
      ],
    },
    {
      expectedText: ["simulation", "The system shall export data", "satisfies"],
      kind: "requirementDiagram",
      source: [
        "requirementDiagram",
        "requirement export_req {",
        "text: The system shall export data",
        "}",
        "element exporter {",
        "type: simulation",
        "}",
        "exporter - satisfies -> export_req",
      ],
    },
    {
      expectedText: ["Jan", "Feb", "Mar", "30", "0"],
      kind: "xychart",
      source: [
        "xychart-beta",
        "x-axis [Jan, Feb, Mar]",
        "y-axis Value 0 --> 30",
        "bar [10, 20, 30]",
        "line [8, 18, 24]",
      ],
    },
    {
      expectedText: ["Marketing", "Sales", "Revenue"],
      kind: "sankey",
      source: [
        "sankey-beta",
        "Marketing,Sales,12",
        "Sales,Revenue,8",
        "Support,Revenue,4",
      ],
    },
    {
      expectedText: ["Customer", "Analytics platform", "Uses"],
      kind: "c4",
      source: [
        "C4Context",
        'Person(customer, "Customer", "Reviews metrics")',
        'System(platform, "Analytics platform", "Serves dashboards")',
        'Rel(customer, platform, "Uses")',
      ],
    },
  ])(
    "renders $kind diagrams through the built-in fallback when Mermaid layout fails",
    async ({ expectedText, kind, source }) => {
      const { container } = render(
        <PretextMarkdownViewer
          source={markdownSource(
            ["```mermaid", "%% force-basic-fallback", ...source, "```"].join(
              "\n"
            )
          )}
          controls={false}
        />
      )

      const diagram = await screen.findByRole("group", {
        name: "Mermaid diagram",
      })
      await waitFor(() => {
        expect(diagram.getAttribute("data-diagram-state")).toBe("ready")
      })

      const svg = container.querySelector<SVGSVGElement>(
        `svg[data-pretext-basic-mermaid="${kind}"]`
      )
      expect(svg).toBeTruthy()
      expect(screen.queryByTestId("mock-mermaid-svg")).toBeNull()
      for (const text of expectedText) {
        expect(svg?.textContent).toContain(text)
      }
      expect(screen.getByRole("img", { name: "Mermaid diagram" })).toBeTruthy()
    }
  )

  it("copies sanitized Mermaid SVG only from ready diagram surfaces", async () => {
    const { rerender } = render(
      <PretextMarkdownViewer
        source={markdownSource("```mermaid\ngraph TD\n  unsafe-svg-->B\n```")}
        controls={false}
      />
    )

    await screen.findByTestId("mock-mermaid-svg")
    fireEvent.click(await screen.findByLabelText("Copy diagram SVG"))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('<svg role="img"')
      )
    })
    const copiedSvg = vi
      .mocked(navigator.clipboard.writeText)
      .mock.calls.at(-1)?.[0]
    expect(copiedSvg).toContain("Safe label")
    expect(copiedSvg).not.toContain("onload")
    expect(copiedSvg).not.toContain("script")
    expect(copiedSvg).not.toContain("style")
    expect(copiedSvg).not.toContain("foreignObject")
    expect(copiedSvg).not.toContain("<image")
    expect(copiedSvg).not.toContain("<use")
    expect(copiedSvg).not.toContain("<animate")
    expect(copiedSvg).not.toContain("javascript:")

    rerender(
      <PretextMarkdownViewer
        source={markdownSource("```mermaid\nnot-a-diagram\n```")}
        controls={false}
      />
    )

    await screen.findByText("Mermaid parse error")
    expect(screen.queryByLabelText("Copy diagram SVG")).toBeNull()
  })

  it("describes Mermaid diagrams with source-derived accessible summaries", async () => {
    const { container, rerender } = render(
      <PretextMarkdownViewer
        source={markdownSource("```mermaid\ngraph LR\n  Start-->Done\n```")}
        controls={false}
      />
    )

    await screen.findByText("mermaid")
    const graph = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const graphDescription = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )

    expect(graphDescription?.textContent).toBe(
      "Mermaid graph diagram flowing left to right, with 2 nodes and 1 edge."
    )
    expect(graph?.getAttribute("aria-describedby")).toBe(graphDescription?.id)

    rerender(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "---",
            "title: Release graph",
            "---",
            "graph TD",
            "  A-->B",
            "  B-->C",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>(
          "[data-pretext-diagram-description]"
        )?.textContent
      ).toBe(
        "Mermaid graph diagram flowing top down, with 3 nodes and 2 edges."
      )
    })
    const graphWithFrontmatter = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    expect(
      graphWithFrontmatter?.getAttribute("data-diagram-reserved-height")
    ).toBe("286")

    rerender(
      <PretextMarkdownViewer
        source={markdownSource("```mermaid\nsequenceDiagram\nA->>B: hi\n```")}
        controls={false}
      />
    )

    await screen.findByText("mermaid")
    const sequence = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const sequenceDescription = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )

    expect(sequenceDescription?.textContent).toBe(
      "Mermaid sequence diagram with 2 participants and 1 message."
    )
    expect(sequence?.getAttribute("aria-describedby")).toBe(
      sequenceDescription?.id
    )

    rerender(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "stateDiagram-v2",
            "  [*] --> Idle",
            "  Idle --> Running: start",
            "  Running --> Idle: stop",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>(
          "[data-pretext-diagram-description]"
        )?.textContent
      ).toBe("Mermaid state diagram with 2 states and 3 transitions.")
    })
    const state = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const stateDescription = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )
    expect(state?.getAttribute("aria-describedby")).toBe(stateDescription?.id)
    expect(state?.getAttribute("data-diagram-reserved-height")).toBe("238")

    rerender(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "classDiagram",
            "  Animal <|-- Duck",
            "  class Animal",
            "  Duck : +swim()",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>(
          "[data-pretext-diagram-description]"
        )?.textContent
      ).toBe("Mermaid class diagram with 2 classes and 1 relationship.")
    })
    const classDiagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const classDescription = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )
    expect(classDiagram?.getAttribute("aria-describedby")).toBe(
      classDescription?.id
    )
    expect(classDiagram?.getAttribute("data-diagram-reserved-height")).toBe(
      "220"
    )

    rerender(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "erDiagram",
            "  CUSTOMER ||--o{ ORDER : places",
            "  ORDER ||--|{ LINE_ITEM : contains",
            "  CUSTOMER {",
            "    string id",
            "  }",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>(
          "[data-pretext-diagram-description]"
        )?.textContent
      ).toBe(
        "Mermaid entity relationship diagram with 3 entities and 2 relationships."
      )
    })
    const erDiagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const erDescription = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )
    expect(erDiagram?.getAttribute("aria-describedby")).toBe(erDescription?.id)
    expect(erDiagram?.getAttribute("data-diagram-reserved-height")).toBe("292")

    rerender(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "journey",
            "  title Release",
            "  section Build",
            "    Compile: 5: CI",
            "    Test: 4: QA",
            "  section Operate",
            "    Observe: 3: SRE",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>(
          "[data-pretext-diagram-description]"
        )?.textContent
      ).toBe("Mermaid journey diagram with 2 sections and 3 tasks.")
    })
    const journeyDiagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const journeyDescription = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )
    expect(journeyDiagram?.getAttribute("aria-describedby")).toBe(
      journeyDescription?.id
    )
    expect(journeyDiagram?.getAttribute("data-diagram-reserved-height")).toBe(
      "270"
    )

    rerender(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "gantt",
            "  title Release plan",
            "  dateFormat  YYYY-MM-DD",
            "  section Design",
            "  Spec :done, spec, 2026-01-01, 3d",
            "  Build :active, build, after spec, 5d",
            "  section Launch",
            "  Release :milestone, rel, 2026-01-12, 1d",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>(
          "[data-pretext-diagram-description]"
        )?.textContent
      ).toBe("Mermaid Gantt chart with 2 sections and 3 tasks.")
    })
    const ganttDiagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const ganttDescription = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )
    expect(ganttDiagram?.getAttribute("aria-describedby")).toBe(
      ganttDescription?.id
    )
    expect(ganttDiagram?.getAttribute("data-diagram-reserved-height")).toBe(
      "300"
    )

    rerender(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "gitGraph",
            "  commit",
            "  branch feature",
            "  checkout feature",
            "  commit",
            "  checkout main",
            "  merge feature",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>(
          "[data-pretext-diagram-description]"
        )?.textContent
      ).toBe("Mermaid Git graph with 1 branch, 2 commits, and 1 merge.")
    })
    const gitGraphDiagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const gitGraphDescription = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )
    expect(gitGraphDiagram?.getAttribute("aria-describedby")).toBe(
      gitGraphDescription?.id
    )
    expect(gitGraphDiagram?.getAttribute("data-diagram-reserved-height")).toBe(
      "212"
    )

    rerender(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "timeline",
            "  title Markdown viewer",
            "  section Alpha",
            "    2024 : Parser",
            "    2025 : Renderer : Registry",
            "  section Beta",
            "    2026 : Rollout",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>(
          "[data-pretext-diagram-description]"
        )?.textContent
      ).toBe("Mermaid timeline with 2 sections and 3 events.")
    })
    const timelineDiagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const timelineDescription = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )
    expect(timelineDiagram?.getAttribute("aria-describedby")).toBe(
      timelineDescription?.id
    )
    expect(timelineDiagram?.getAttribute("data-diagram-reserved-height")).toBe(
      "270"
    )

    rerender(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "mindmap",
            "  root((Viewer))",
            "    Diagrams",
            "      Mermaid",
            "    Math",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>(
          "[data-pretext-diagram-description]"
        )?.textContent
      ).toBe("Mermaid mind map with 4 nodes.")
    })
    const mindMapDiagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const mindMapDescription = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )
    expect(mindMapDiagram?.getAttribute("aria-describedby")).toBe(
      mindMapDescription?.id
    )
    expect(mindMapDiagram?.getAttribute("data-diagram-reserved-height")).toBe(
      "232"
    )

    rerender(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "quadrantChart",
            "x-axis Low Reach --> High Reach",
            "y-axis Low Retention --> High Retention",
            "quadrant-1 Expand",
            "quadrant-3 Rework",
            "Enterprise: [0.78, 0.82]",
            "Self-serve: [0.34, 0.48]",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>(
          "[data-pretext-diagram-description]"
        )?.textContent
      ).toBe("Mermaid quadrant chart with 2 points.")
    })
    const quadrantDiagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const quadrantDescription = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )
    expect(quadrantDiagram?.getAttribute("aria-describedby")).toBe(
      quadrantDescription?.id
    )
    expect(quadrantDiagram?.getAttribute("data-diagram-reserved-height")).toBe(
      "296"
    )

    rerender(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "requirementDiagram",
            "requirement export_req {",
            "text: The system shall export data",
            "}",
            "element exporter {",
            "type: simulation",
            "}",
            "exporter - satisfies -> export_req",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>(
          "[data-pretext-diagram-description]"
        )?.textContent
      ).toBe(
        "Mermaid requirement diagram with 1 requirement, 1 element, and 1 relationship."
      )
    })
    const requirementDiagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const requirementDescription = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )
    expect(requirementDiagram?.getAttribute("aria-describedby")).toBe(
      requirementDescription?.id
    )
    expect(
      requirementDiagram?.getAttribute("data-diagram-reserved-height")
    ).toBe("230")

    rerender(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "xychart-beta",
            "x-axis [Jan, Feb, Mar]",
            "y-axis Value 0 --> 30",
            "bar [10, 20, 30]",
            "line [8, 18, 24]",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>(
          "[data-pretext-diagram-description]"
        )?.textContent
      ).toBe("Mermaid XY chart with 2 series and 6 values.")
    })
    const xyChartDiagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const xyChartDescription = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )
    expect(xyChartDiagram?.getAttribute("aria-describedby")).toBe(
      xyChartDescription?.id
    )
    expect(xyChartDiagram?.getAttribute("data-diagram-reserved-height")).toBe(
      "334"
    )

    rerender(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "sankey-beta",
            "Marketing,Sales,12",
            "Sales,Revenue,8",
            "Support,Revenue,4",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>(
          "[data-pretext-diagram-description]"
        )?.textContent
      ).toBe("Mermaid Sankey diagram with 4 nodes and 3 flows.")
    })
    const sankeyDiagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const sankeyDescription = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )
    expect(sankeyDiagram?.getAttribute("aria-describedby")).toBe(
      sankeyDescription?.id
    )
    expect(sankeyDiagram?.getAttribute("data-diagram-reserved-height")).toBe(
      "310"
    )

    rerender(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "C4Context",
            'Person(customer, "Customer", "Reviews metrics")',
            'System(platform, "Analytics platform", "Serves dashboards")',
            'Rel(customer, platform, "Uses")',
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>(
          "[data-pretext-diagram-description]"
        )?.textContent
      ).toBe("Mermaid C4 diagram with 2 nodes and 1 relationship.")
    })
    const c4Diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const c4Description = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )
    expect(c4Diagram?.getAttribute("aria-describedby")).toBe(c4Description?.id)
    expect(c4Diagram?.getAttribute("data-diagram-reserved-height")).toBe("236")

    rerender(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```mermaid",
            "pie showData",
            '  "Adopted" : 70',
            '  "Trial" : 20',
            '  "Churned" : 10',
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await waitFor(() => {
      expect(
        container.querySelector<HTMLElement>(
          "[data-pretext-diagram-description]"
        )?.textContent
      ).toBe("Mermaid pie chart with 3 slices and total value 100.")
    })
    const pieDiagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    const pieDescription = container.querySelector<HTMLElement>(
      "[data-pretext-diagram-description]"
    )
    expect(pieDiagram?.getAttribute("aria-describedby")).toBe(
      pieDescription?.id
    )
    expect(pieDiagram?.getAttribute("data-diagram-reserved-height")).toBe("224")
  })

  it("normalizes Mermaid fence aliases before choosing the render surface", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource("```MMD\ngraph TD\n  A-->B\n```")}
        controls={false}
      />
    )

    await screen.findByText("mermaid")
    expect(screen.queryByText("MMD")).toBeNull()
    const diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )

    expect(diagram).toBeTruthy()
    await waitFor(() => expect(diagram?.dataset.diagramState).toBe("ready"))
  })

  it("renders sequence diagrams through Mermaid instead of the graph-only fallback", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource("```mermaid\nsequenceDiagram\nA->>B: hi\n```")}
        controls={false}
      />
    )

    await screen.findByText("mermaid")
    expect(screen.getByRole("group", { name: "Mermaid diagram" })).toBeTruthy()
    const diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )

    await waitFor(() => expect(diagram?.dataset.diagramState).toBe("ready"))
    expect(
      (await screen.findByTestId("mock-mermaid-svg")).getAttribute(
        "data-source"
      )
    ).toBe(encodeURIComponent("sequenceDiagram\nA->>B: hi"))
  })

  it("keeps Mermaid-only diagrams in loading state before async render settles", async () => {
    const mermaid = (await import("mermaid")).default
    const renderResult = createDeferred<{ diagramType: string; svg: string }>()
    vi.mocked(mermaid.render).mockReturnValueOnce(renderResult.promise)
    const source = "stateDiagram-v2\n[*] --> Draft"

    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(`\`\`\`mermaid\n${source}\n\`\`\``)}
        controls={false}
      />
    )

    await screen.findByText("mermaid")
    const diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )

    expect(diagram?.dataset.diagramState).toBe("loading")
    expect(screen.getByLabelText("Mermaid diagram source").textContent).toBe(
      source
    )
    expect(container.textContent).not.toContain("Unsupported Mermaid diagram")

    renderResult.resolve({
      diagramType: "state",
      svg: '<svg role="img" aria-label="Mermaid diagram" data-testid="mock-mermaid-svg" xmlns="http://www.w3.org/2000/svg"></svg>',
    })

    await waitFor(() => expect(diagram?.dataset.diagramState).toBe("ready"))
  })

  it("initializes Mermaid with the strict viewer security policy", async () => {
    const mermaid = (await import("mermaid")).default

    render(
      <PretextMarkdownViewer
        source={markdownSource("```mermaid\ngraph TD\n  A-->B\n```")}
        controls={false}
      />
    )

    await screen.findByTestId("mock-mermaid-svg")
    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        flowchart: expect.objectContaining({
          htmlLabels: false,
          useMaxWidth: true,
        }),
        securityLevel: "strict",
        sequence: expect.objectContaining({
          useMaxWidth: true,
        }),
        startOnLoad: false,
        suppressErrorRendering: true,
      })
    )
  })

  it("keeps oversized Mermaid diagrams bounded without calling Mermaid", async () => {
    const mermaid = (await import("mermaid")).default
    vi.mocked(mermaid.initialize).mockClear()
    vi.mocked(mermaid.render).mockClear()
    const oversizedSource = [
      "graph TD",
      ...Array.from(
        { length: 170 },
        (_, index) => `  A${index}-->A${index + 1}`
      ),
    ].join("\n")

    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(`\`\`\`mermaid\n${oversizedSource}\n\`\`\``)}
        controls={false}
      />
    )

    expect(
      await screen.findByText(/too many lines to render safely/)
    ).toBeTruthy()
    const diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    expect(diagram?.dataset.diagramState).toBe("failed")
    expect(screen.getByRole("alert").textContent).toContain(
      "too many lines to render safely"
    )
    expect(screen.getByLabelText("Mermaid diagram source").textContent).toBe(
      oversizedSource
    )
    expect(screen.queryByLabelText("Copy diagram SVG")).toBeNull()
    expect(mermaid.initialize).not.toHaveBeenCalled()
    expect(mermaid.render).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText("Copy diagram source"))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        oversizedSource
      )
    })
  })

  it("keeps diagram loading and ready states inside stable reserved height", async () => {
    const { container, rerender } = render(
      <PretextMarkdownViewer
        source={markdownSource("```mermaid\ngraph TD\n  A-->B\n  B-->C\n```")}
        controls={false}
      />
    )

    await screen.findByText("mermaid")
    const graphDiagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )

    expect(graphDiagram?.getAttribute("data-diagram-reserved-height")).toBe(
      "286"
    )
    expect(
      graphDiagram
        ?.querySelector("[data-pretext-diagram-body]")
        ?.className.includes("h-(--pretext-diagram-body-height)")
    ).toBe(true)

    rerender(
      <PretextMarkdownViewer
        source={markdownSource("```mermaid\nsequenceDiagram\nA->>B: hi\n```")}
        controls={false}
      />
    )

    await waitFor(() =>
      expect(
        container.querySelector('[data-diagram-language="mermaid"]')
      ).toBeTruthy()
    )
    const sequenceDiagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )
    expect(sequenceDiagram?.getAttribute("data-diagram-reserved-height")).toBe(
      "160"
    )
    const pendingBody = sequenceDiagram?.querySelector<HTMLElement>(
      "[data-pretext-diagram-body]"
    )
    expect(pendingBody?.className).toContain(
      "h-(--pretext-diagram-body-height)"
    )
    expect(pendingBody?.getAttribute("aria-label")).toBe("Mermaid diagram body")
    expect(pendingBody?.getAttribute("role")).toBe("region")
    expect(pendingBody?.getAttribute("tabindex")).toBe("0")

    await waitFor(() =>
      expect(sequenceDiagram?.dataset.diagramState).toBe("ready")
    )
    const readyBody = sequenceDiagram?.querySelector<HTMLElement>(
      "[data-pretext-diagram-body]"
    )
    expect(sequenceDiagram?.getAttribute("data-diagram-reserved-height")).toBe(
      "160"
    )
    expect(readyBody?.className).toContain("h-(--pretext-diagram-body-height)")
    expect(readyBody?.getAttribute("aria-label")).toBe("Mermaid diagram body")
    expect(readyBody?.getAttribute("role")).toBe("region")
    expect(readyBody?.getAttribute("tabindex")).toBe("0")

    Object.defineProperty(readyBody, "clientWidth", {
      configurable: true,
      value: 200,
    })
    Object.defineProperty(readyBody, "scrollWidth", {
      configurable: true,
      value: 900,
    })

    fireEvent.keyDown(readyBody!, { key: "ArrowRight" })
    expect(readyBody?.scrollLeft).toBe(50)

    fireEvent.keyDown(readyBody!, { key: "End" })
    expect(readyBody?.scrollLeft).toBe(700)

    fireEvent.keyDown(readyBody!, { key: "Home" })
    expect(readyBody?.scrollLeft).toBe(0)
  })

  it("sanitizes rendered Mermaid SVG before mounting it", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource("```mermaid\ngraph TD\n  unsafe-svg-->B\n```")}
        controls={false}
      />
    )

    await screen.findByText("mermaid")
    const svg = await screen.findByTestId("mock-mermaid-svg")
    await waitFor(() =>
      expect(
        container.querySelector<HTMLElement>(
          '[data-diagram-language="mermaid"]'
        )?.dataset.diagramState
      ).toBe("ready")
    )

    expect(svg.getAttribute("onload")).toBeNull()
    expect(svg.getAttribute("style")).toBeNull()
    expect(svg.querySelector("style")).toBeNull()
    expect(svg.querySelector("script")).toBeNull()
    expect(svg.querySelector("foreignObject")).toBeNull()
    expect(svg.querySelector("iframe")).toBeNull()
    expect(svg.querySelector("[onclick]")).toBeNull()
    expect(svg.querySelector("a")).toBeNull()
    expect(svg.querySelector("image")).toBeNull()
    expect(svg.querySelector("use")).toBeNull()
    expect(svg.querySelector("animate")).toBeNull()
    expect(svg.id).toBe("user-content-location")
    expect(svg.querySelector("#forms")).toBeNull()
    expect(svg.querySelector("#constructor")).toBeNull()
    expect(svg.querySelector("[name='images']")).toBeNull()
    expect(svg.querySelector("#user-content-forms")).toBeTruthy()
    expect(svg.querySelector("#user-content-constructor")).toBeTruthy()
    expect(svg.textContent).toContain("Safe label")
  })

  it("renders invalid mermaid fences as non-crashing errors", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource("```mermaid\nnot-a-diagram\n```")}
        controls={false}
      />
    )

    await screen.findByText("mermaid")
    expect(screen.getByRole("group", { name: "Mermaid diagram" })).toBeTruthy()
    expect(screen.getByLabelText("Mermaid diagram source")).toBeTruthy()
    const diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )

    await waitFor(() => expect(diagram?.dataset.diagramState).toBe("failed"))
    expect(diagram?.textContent).toContain("Mermaid parse error")
    expect(screen.getByRole("alert").textContent).toContain(
      "Mermaid parse error"
    )
    expect(screen.getByLabelText("Mermaid diagram source").textContent).toBe(
      "not-a-diagram"
    )
    expect(screen.queryByLabelText("Copy diagram SVG")).toBeNull()
  })

  it("renders inline and block math through KaTeX", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          ["Inline math $E = mc^2$.", "", "$$", "x^2 + y^2 = z^2", "$$"].join(
            "\n"
          )
        )}
        controls={false}
      />
    )

    expect(await screen.findByText(/Inline math/)).toBeTruthy()
    expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(
      2
    )
    expect(container.querySelector("[data-pretext-math-inline]")).toBeTruthy()
    const mathBlock = screen.getByRole("region", { name: "Math block" })
    expect(mathBlock).toBeTruthy()
    expect(mathBlock.getAttribute("data-pretext-math-block")).toBe("")
    expect(mathBlock.className).toContain("overflow-x-auto")

    Object.defineProperty(mathBlock, "clientWidth", {
      configurable: true,
      value: 200,
    })
    Object.defineProperty(mathBlock, "scrollWidth", {
      configurable: true,
      value: 900,
    })

    fireEvent.keyDown(mathBlock, { key: "ArrowRight" })
    expect(mathBlock.scrollLeft).toBe(50)

    fireEvent.keyDown(mathBlock, { key: "End" })
    expect(mathBlock.scrollLeft).toBe(700)

    fireEvent.keyDown(mathBlock, { key: "Home" })
    expect(mathBlock.scrollLeft).toBe(0)
  })

  it("keeps unsafe KaTeX trust commands inert", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            String.raw`Unsafe $\href{javascript:alert(1)}{bad}$.`,
            "",
            "$$",
            String.raw`\htmlClass{raw}{x} + \includegraphics{javascript:alert(1)}`,
            "$$",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText(/Unsafe/)).toBeTruthy()
    expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(
      2
    )
    expect(container.querySelector(".raw")).toBeNull()
    expect(container.querySelector("a[href]")).toBeNull()
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("[href^='javascript']")).toBeNull()
    expect(container.querySelector("[src^='javascript']")).toBeNull()
  })

  it("renders GFM footnotes with reachable references and backrefs", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource("A note.[^a]\n\n[^a]: Footnote body.")}
        controls={false}
      />
    )

    expect(await screen.findByText("Footnote body.")).toBeTruthy()
    const reference = container.querySelector<HTMLAnchorElement>(
      'a[href^="#user-content-fn-"], a[href^="#fn-"]'
    )
    const backref = container.querySelector<HTMLAnchorElement>(
      'a[href^="#user-content-fnref-"], a[href^="#fnref-"]'
    )
    const footnoteSection =
      container.querySelector<HTMLElement>("[data-footnotes]")

    expect(reference).toBeTruthy()
    expect(reference?.getAttribute("aria-label")).toBe("Footnote 1")
    expect(reference?.getAttribute("href")).toMatch(/^#(?:user-content-)?fn-a$/)
    expect(backref).toBeTruthy()
    expect(backref?.getAttribute("aria-label")).toBe(
      "Back to footnote reference ↩"
    )
    expect(backref?.getAttribute("href")).toMatch(
      /^#(?:user-content-)?fnref-a$/
    )
    expect(footnoteSection).toBeTruthy()
    expect(footnoteSection?.getAttribute("aria-label")).toBe("Footnotes")
  })

  it("resolves GFM footnotes from definitions outside the visible chunk", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "A distant note.[^far]",
            "",
            ...Array.from(
              { length: 40 },
              (_, index) => `Paragraph ${index + 1}.`
            ),
            "",
            "[^far]: Footnote body from the end of the document.",
          ].join("\n\n")
        )}
        controls={false}
      />
    )

    expect(
      await screen.findByText("Footnote body from the end of the document.")
    ).toBeTruthy()
    expect(container.textContent).not.toContain("[^far]:")
    expect(
      container
        .querySelector<HTMLElement>("[data-footnotes]")
        ?.getAttribute("aria-label")
    ).toBe("Footnotes")
    expect(
      container
        .querySelector<HTMLAnchorElement>('a[href^="#user-content-fn-far"]')
        ?.getAttribute("aria-label")
    ).toBe("Footnote 1")
  })

  it("renders code block language headers and copy controls", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource("```ts\nconst answer = 42\n```")}
        controls={false}
      />
    )

    expect(await screen.findByText("ts")).toBeTruthy()
    expect(screen.getByRole("group", { name: "ts code block" })).toBeTruthy()
    expect(screen.getByLabelText("ts code source")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Copy code block"))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "const answer = 42"
      )
    })
  })

  it("renders hostile chunks as bounded source previews with full source copy", async () => {
    const hostileLines = Array.from(
      { length: 401 },
      (_, index) => `hostile-line-${index}`
    )
    const hostileSource = ["```txt", ...hostileLines, "```"].join("\n")
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(hostileSource)}
        controls={false}
      />
    )

    expect(await screen.findByText("Large Markdown block")).toBeTruthy()

    const fallback = container.querySelector<HTMLElement>(
      "[data-pretext-markdown-hostile-fallback]"
    )
    const preview = container.querySelector<HTMLElement>(
      "[data-pretext-markdown-hostile-preview]"
    )

    expect(fallback).toBeTruthy()
    expect(
      fallback?.getAttribute("data-pretext-markdown-hostile-line-count")
    ).toBe("403")
    expect(
      Number(
        fallback?.getAttribute("data-pretext-markdown-hostile-omitted-lines")
      )
    ).toBeGreaterThan(300)
    expect(preview?.textContent).toContain("hostile-line-0")
    expect(preview?.textContent).toContain("hostile-line-400")
    expect(preview?.textContent).toContain("source lines omitted")
    expect(preview?.textContent).not.toContain("hostile-line-200")

    fireEvent.click(screen.getByLabelText("Copy large Markdown block source"))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(hostileSource)
    })
  })

  it("keeps code block source as a keyboard-focusable horizontal scroll region", async () => {
    const longCode = `const token = "${"x".repeat(180)}"`
    const { container } = render(
      <PretextMarkdownViewer
        className="h-80 w-[360px]"
        source={markdownSource(["```ts", longCode, "```"].join("\n"))}
        controls={false}
      />
    )

    await screen.findByText("ts")
    const sourceRegion = screen.getByRole("region", {
      name: "ts code source",
    })
    const sourceCode = sourceRegion.querySelector("code")

    expect(sourceRegion).toBeTruthy()
    expect(sourceRegion.getAttribute("tabindex")).toBe("0")
    expect(sourceRegion.getAttribute("data-pretext-code-source")).toBe("")
    expect(sourceRegion.className).toContain("overflow-x-auto")
    expect(sourceRegion.className).toContain("[overflow-wrap:normal]")
    expect(sourceRegion.className).toContain("[&_code]:min-w-max")
    expect(sourceCode?.textContent).toBe(longCode)
    expect(container.querySelector("[data-pretext-code-source]")).toBe(
      sourceRegion
    )
  })

  it("normalizes code block language labels without changing copied source", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource("```TSX\n<Component />\n```")}
        controls={false}
      />
    )

    expect(await screen.findByText("tsx")).toBeTruthy()
    expect(screen.queryByText("TSX")).toBeNull()
    expect(screen.getByRole("group", { name: "tsx code block" })).toBeTruthy()
    expect(screen.getByLabelText("tsx code source")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Copy code block"))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "<Component />"
      )
    })
  })

  it("normalizes common code fence language aliases", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```TypeScript",
            "const typed = true",
            "```",
            "",
            "```javascript",
            "const dynamic = true",
            "```",
            "",
            "```shell-session",
            "$ pnpm test",
            "```",
            "",
            "```jsonc",
            '{ "comments": false }',
            "```",
            "",
            "```bash",
            "pnpm test",
            "```",
            "",
            "```terminal",
            "$ pnpm lint",
            "```",
            "",
            "```yml",
            "name: ci",
            "```",
            "",
            "```md",
            "# Heading",
            "```",
            "",
            "```patch",
            "+added",
            "```",
            "",
            "```docker",
            "FROM node:22",
            "```",
            "",
            "```rb",
            "puts :ok",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(
      await screen.findByRole("group", { name: "ts code block" })
    ).toBeTruthy()
    expect(screen.getByRole("group", { name: "js code block" })).toBeTruthy()
    expect(screen.getByRole("group", { name: "json code block" })).toBeTruthy()
    expect(
      screen.getAllByRole("group", { name: "shell code block" })
    ).toHaveLength(3)
    expect(screen.getByRole("group", { name: "yaml code block" })).toBeTruthy()
    expect(
      screen.getByRole("group", { name: "markdown code block" })
    ).toBeTruthy()
    expect(screen.getByRole("group", { name: "diff code block" })).toBeTruthy()
    expect(
      screen.getByRole("group", { name: "dockerfile code block" })
    ).toBeTruthy()
    expect(screen.getByRole("group", { name: "ruby code block" })).toBeTruthy()
    expect(
      Array.from(
        container.querySelectorAll("[data-pretext-code-language]")
      ).map((node) => node.getAttribute("data-pretext-code-language"))
    ).toEqual([
      "ts",
      "js",
      "shell",
      "json",
      "shell",
      "shell",
      "yaml",
      "markdown",
      "diff",
      "dockerfile",
      "ruby",
    ])

    fireEvent.click(screen.getAllByLabelText("Copy code block")[0]!)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "const typed = true"
      )
    })
  })

  it("shows code block copy failures without losing the source", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(() => Promise.reject(new Error("denied"))) },
    })

    render(
      <PretextMarkdownViewer
        source={markdownSource("```ts\nconst answer = 42\n```")}
        controls={false}
      />
    )

    expect(await screen.findByText("ts")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Copy code block"))

    expect(await screen.findByLabelText("Copy failed")).toBeTruthy()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "const answer = 42"
    )
  })

  it("syntax-highlights fenced code without changing copied source", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource("```ts\nexport const viewer = 'markdown'\n```")}
        controls={false}
      />
    )

    expect(await screen.findByText("ts")).toBeTruthy()
    expect(
      container.querySelector("[data-rehype-pretty-code-figure]")
    ).toBeTruthy()
    expect(container.querySelector("[data-line]")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Copy code block"))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "export const viewer = 'markdown'"
      )
    })
  })

  it("renders code block title and caption metadata without changing copied source", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '```ts title="src/viewer.ts" caption="Viewer entry point"',
            "export const viewer = 'markdown'",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("src/viewer.ts")).toBeTruthy()
    expect(screen.getByText("Viewer entry point")).toBeTruthy()
    expect(
      screen.getByRole("group", { name: "src/viewer.ts code block" })
    ).toBeTruthy()
    expect(
      container.querySelector('[data-pretext-code-title="src/viewer.ts"]')
    ).toBeTruthy()
    expect(container.querySelector("[data-pretext-code-caption]")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Copy code block"))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "export const viewer = 'markdown'"
      )
    })
  })

  it("renders Pretty Code line numbers from showLineNumbers metadata", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```ts showLineNumbers{5}",
            "const first = 1",
            "const second = 2",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("ts")).toBeTruthy()
    const code = container.querySelector<HTMLElement>("code[data-line-numbers]")
    const lines = Array.from(container.querySelectorAll("[data-line]"))

    expect(code).toBeTruthy()
    expect(code?.getAttribute("data-line-numbers-max-digits")).toBe("1")
    expect(code?.getAttribute("style")).toContain("counter-set: line 4")
    expect(code?.className).toContain("[counter-reset:line]")
    expect(code?.className).toContain("content-[counter(line)]")
    expect(lines).toHaveLength(2)
    await waitFor(() => {
      expect(code?.getAttribute("role")).toBe("list")
      expect(code?.getAttribute("aria-label")).toBe("ts numbered code lines")
      expect(lines[0]?.getAttribute("role")).toBe("listitem")
      expect(lines[0]?.getAttribute("aria-label")).toBe("Line 5")
      expect(lines[0]?.getAttribute("data-pretext-code-line-number")).toBe("5")
      expect(lines[1]?.getAttribute("aria-label")).toBe("Line 6")
      expect(lines[1]?.getAttribute("data-pretext-code-line-number")).toBe("6")
    })

    fireEvent.click(screen.getByLabelText("Copy code block"))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        ["const first = 1", "const second = 2"].join("\n")
      )
    })
  })

  it("copies the selected rendered code text when the selection belongs to a code block", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```ts showLineNumbers",
            "const first = 1",
            "const second = 2",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("ts")).toBeTruthy()
    const lines = Array.from(
      container.querySelectorAll<HTMLElement>("[data-line]")
    )
    const selection = window.getSelection()
    const range = document.createRange()

    expect(lines).toHaveLength(2)
    range.selectNodeContents(lines[1]!)
    selection?.removeAllRanges()
    selection?.addRange(range)

    fireEvent.click(screen.getByLabelText("Copy selected code or block"))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "const second = 2"
      )
    })

    selection?.removeAllRanges()
  })

  it("renders Pretty Code highlighted lines and characters from metadata", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "```ts {2} /answer/",
            "const value = 41",
            "const answer = value + 1",
            "```",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("ts")).toBeTruthy()
    const code = container.querySelector<HTMLElement>(
      "code[data-language='ts']"
    )
    const highlightedLine = container.querySelector("[data-highlighted-line]")
    const highlightedChars = container.querySelector("[data-highlighted-chars]")

    expect(code).toBeTruthy()
    expect(highlightedLine?.textContent).toContain("answer")
    expect(highlightedChars?.textContent).toBe("answer")
    expect(code?.className).toContain("[&>[data-highlighted-line]]")
    expect(code?.className).toContain("[&_[data-highlighted-chars]]")

    fireEvent.click(screen.getByLabelText("Copy code block"))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        ["const value = 41", "const answer = value + 1"].join("\n")
      )
    })
  })

  it("renders diff code fences with added and removed line styling", async () => {
    const source = [
      "```diff",
      "--- a/viewer.ts",
      "+++ b/viewer.ts",
      "-const mode = 'old'",
      "+const mode = 'new'",
      " const unchanged = true",
      "```",
    ].join("\n")
    const { container } = render(
      <PretextMarkdownViewer source={markdownSource(source)} controls={false} />
    )

    expect(await screen.findByText("diff")).toBeTruthy()
    const added = container.querySelector('[data-pretext-code-diff-line="add"]')
    const removed = container.querySelector(
      '[data-pretext-code-diff-line="remove"]'
    )
    const neutralHeaders = Array.from(
      container.querySelectorAll("[data-line]")
    ).filter((line) => line.textContent?.startsWith("+++"))

    expect(added?.textContent).toContain("+const mode = 'new'")
    expect(removed?.textContent).toContain("-const mode = 'old'")
    expect(added?.className).toContain("bg-emerald-500/10")
    expect(removed?.className).toContain("bg-red-500/10")
    expect(neutralHeaders[0]?.getAttribute("data-pretext-code-diff-line")).toBe(
      null
    )

    fireEvent.click(screen.getByLabelText("Copy code block"))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        [
          "--- a/viewer.ts",
          "+++ b/viewer.ts",
          "-const mode = 'old'",
          "+const mode = 'new'",
          " const unchanged = true",
        ].join("\n")
      )
    })
  })

  it("renders table cell inline Markdown and copies rendered cells as TSV", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "| Name | Link | Count |",
            "| :--- | :---: | ---: |",
            "| **Bold** `code` ~~old~~ | [Site](https://example.com) :white_check_mark: | 42 |",
          ].join("\n")
        )}
        controls={false}
      />
    )

    const table = await screen.findByRole("table")
    const tableRegion = screen.getByRole("region", { name: "Markdown table" })
    expect(table).toBeTruthy()
    expect(tableRegion).toBeTruthy()
    expect(tableRegion.getAttribute("tabindex")).toBe("0")
    expect(tableRegion.contains(table)).toBe(true)
    expect(table.getAttribute("aria-rowcount")).toBe("2")
    expect(table.getAttribute("aria-colcount")).toBe("3")
    const rows = container.querySelectorAll<HTMLTableRowElement>("tr")
    expect(rows[0]?.getAttribute("aria-rowindex")).toBe("1")
    expect(rows[0]?.getAttribute("data-pretext-table-row-index")).toBe("1")
    expect(rows[1]?.getAttribute("aria-rowindex")).toBe("2")
    expect(rows[1]?.getAttribute("data-pretext-table-row-index")).toBe("2")
    const headers = container.querySelectorAll<HTMLTableCellElement>("th")
    const cells = container.querySelectorAll<HTMLTableCellElement>("td")
    expect(headers[0]?.id).toMatch(
      /^pretext-markdown-chunk-\d+-\d+-table-0-column-0$/
    )
    expect(headers[0]?.scope).toBe("col")
    expect(headers[0]?.getAttribute("aria-colindex")).toBe("1")
    expect(headers[0]?.getAttribute("data-pretext-table-column-index")).toBe(
      "1"
    )
    expect(headers[1]?.id).toMatch(
      /^pretext-markdown-chunk-\d+-\d+-table-0-column-1$/
    )
    expect(headers[1]?.getAttribute("aria-colindex")).toBe("2")
    expect(headers[0]?.className).toContain("text-left")
    expect(headers[1]?.align).toBe("center")
    expect(headers[2]?.align).toBe("right")
    expect(headers[1]?.className).toContain("text-center")
    expect(headers[2]?.className).toContain("tabular-nums")
    expect(cells[0]?.headers).toBe(headers[0]?.id)
    expect(cells[1]?.headers).toBe(headers[1]?.id)
    expect(cells[2]?.headers).toBe(headers[2]?.id)
    expect(cells[0]?.getAttribute("aria-colindex")).toBe("1")
    expect(cells[0]?.getAttribute("data-pretext-table-column-index")).toBe("1")
    expect(cells[1]?.getAttribute("aria-colindex")).toBe("2")
    expect(cells[2]?.getAttribute("aria-colindex")).toBe("3")
    expect(cells[1]?.className).toContain("text-center")
    expect(cells[2]?.align).toBe("right")
    expect(cells[2]?.className).toContain("tabular-nums")
    expect(container.querySelector("td strong")?.textContent).toBe("Bold")
    expect(container.querySelector("td code")?.textContent).toBe("code")
    const tableStrikethrough = container.querySelector("td del")
    expect(tableStrikethrough?.textContent).toBe("old")
    expect(tableStrikethrough?.getAttribute("data-pretext-strikethrough")).toBe(
      ""
    )
    expect(screen.getByRole("link", { name: /Site/ })).toBeTruthy()
    expect(screen.getByText(/✅/)).toBeTruthy()

    const copyTableButton = screen.getByLabelText("Copy table")
    fireEvent.click(copyTableButton)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        ["Name\tLink\tCount", "Bold code old\tSite ✅\t42"].join("\n")
      )
    })

    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(cells[0]!)
    selection?.removeAllRanges()
    selection?.addRange(range)

    fireEvent.click(copyTableButton)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(
        "Bold code old"
      )
    })
    selection?.removeAllRanges()
  })

  it("supports keyboard horizontal scrolling in table regions", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "| First | Second | Third |",
            "| --- | --- | --- |",
            "| Alpha | Beta | Gamma |",
          ].join("\n")
        )}
        controls={false}
      />
    )

    const tableRegion = await screen.findByRole("region", {
      name: "Markdown table",
    })
    Object.defineProperty(tableRegion, "clientWidth", {
      configurable: true,
      value: 200,
    })
    Object.defineProperty(tableRegion, "scrollWidth", {
      configurable: true,
      value: 900,
    })

    fireEvent.keyDown(tableRegion, { key: "ArrowRight" })

    expect(tableRegion.scrollLeft).toBe(50)

    fireEvent.keyDown(tableRegion, { key: "End" })

    expect(tableRegion.scrollLeft).toBe(700)

    fireEvent.keyDown(tableRegion, { key: "ArrowLeft" })

    expect(tableRegion.scrollLeft).toBe(650)

    fireEvent.keyDown(tableRegion, { key: "Home" })

    expect(tableRegion.scrollLeft).toBe(0)
  })

  it("renders safe table captions without changing table copy output", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "<table>",
            '<caption onclick="bad()">Release status</caption>',
            "<thead><tr><th>Area</th><th>Status</th></tr></thead>",
            "<tbody><tr><td>Markdown</td><td>Ready</td></tr></tbody>",
            "</table>",
          ].join("\n")
        )}
        controls={false}
      />
    )

    const table = await screen.findByRole("table", {
      name: "Release status",
    })
    const caption = container.querySelector("caption")
    expect(table).toBeTruthy()
    expect(caption?.textContent).toBe("Release status")
    expect(caption?.getAttribute("onclick")).toBeNull()
    expect(caption?.className).toContain("caption-top")

    fireEvent.click(screen.getByLabelText("Copy table"))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        ["Area\tStatus", "Markdown\tReady"].join("\n")
      )
    })
  })

  it("renders safe raw HTML through the Pretext sanitizer", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '<details open class="raw" onclick="bad()">',
            "<summary>More</summary>",
            '<mark style="color:red">Safe</mark><script>alert(1)</script>',
            "</details>",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("More")).toBeTruthy()
    expect(screen.getByText("Safe").tagName).toBe("MARK")
    expect(container.querySelector("details")).toBeTruthy()
    expect(container.querySelector("script")).toBeNull()
    expect(
      container.querySelector("details")?.getAttribute("onclick")
    ).toBeNull()
    expect(container.querySelector("details")?.className).not.toContain("raw")
    expect(container.querySelector("mark")?.getAttribute("style")).toBeNull()
  })

  it("prefixes raw HTML id and name attributes without changing model-owned heading ids", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '<a id="location" name="constructor" href="#section-location">Raw anchor</a>',
            '<p id="forms">Raw paragraph</p>',
            "",
            "# location",
          ].join("\n")
        )}
        controls={false}
      />
    )

    const anchor = await screen.findByRole("link", { name: "Raw anchor" })
    const paragraph = screen.getByText("Raw paragraph")
    const heading = screen.getByRole("heading", { name: "location" })

    expect(anchor.id).toBe("user-content-location")
    expect(anchor.getAttribute("name")).toBe("user-content-constructor")
    expect(paragraph.id).toBe("user-content-forms")
    expect(heading.id).toBe("section-location")
    expect(container.querySelector("#location")).toBeNull()
    expect(container.querySelector("[name='constructor']")).toBeNull()
    expect(container.querySelector("#forms")).toBeNull()
  })

  it("renders safe raw HTML definition lists", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "<dl>",
            '<dt onclick="bad()">API</dt>',
            '<dd class="raw">Application programming interface.</dd>',
            "</dl>",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("API")).toBeTruthy()
    expect(screen.getByText("Application programming interface.")).toBeTruthy()
    expect(container.querySelector("dl")?.className).toContain("space-y-2")
    expect(container.querySelector("dt")?.getAttribute("onclick")).toBeNull()
    expect(container.querySelector("dt")?.className).toContain("font-semibold")
    expect(container.querySelector("dd")?.className).not.toContain("raw")
    expect(container.querySelector("dd")?.className).toContain(
      "text-muted-foreground"
    )
  })

  it("renders conservative Markdown definition-list shorthand", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "API",
            ": Application **programming** interface.",
            "",
            "CLI",
            ": Command line.",
            ": Tooling surface.",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("API")).toBeTruthy()
    expect(screen.getByText("CLI")).toBeTruthy()
    expect(screen.getByText("programming")).toBeTruthy()
    expect(screen.getByText("programming").tagName).toBe("STRONG")
    expect(screen.getByText("Command line.")).toBeTruthy()
    expect(screen.getByText("Tooling surface.")).toBeTruthy()

    const definitionLists = container.querySelectorAll(
      "[data-pretext-definition-list]"
    )
    expect(definitionLists).toHaveLength(2)
    expect(
      container.querySelectorAll("[data-pretext-definition-term]")
    ).toHaveLength(2)
    expect(
      container.querySelectorAll("[data-pretext-definition-description]")
    ).toHaveLength(3)
    expect(container.querySelector("dl")?.className).toContain("space-y-2")
    expect(container.querySelector("dt")?.className).toContain("font-semibold")
    expect(container.querySelector("dd")?.className).toContain(
      "text-muted-foreground"
    )
  })

  it("renders safe inline raw HTML elements with styled components", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            'Press <kbd onclick="bad()">⌘K</kbd> for H<sub>2</sub>O and x<sup>2</sup>.',
            '<q cite="javascript:alert(1)" class="raw">quoted</q> <ins cite="https://example.com/change">added</ins> <mark>marked</mark> <var>value</var> <samp>output</samp>',
            '<abbr title="Application programming interface" onclick="bad()">API</abbr> <time datetime="2026-06-16" style="color:red">June 16</time> <cite class="raw">RFC 9110</cite> <dfn title="Hypertext Transfer Protocol">HTTP</dfn> <small onclick="bad()">fine print</small>',
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("⌘K")).toBeTruthy()
    expect(container.querySelector("kbd")?.textContent).toBe("⌘K")
    expect(container.querySelector("kbd")?.getAttribute("onclick")).toBeNull()
    expect(container.querySelector("kbd")?.className).toContain("font-mono")
    expect(
      container.querySelector("kbd")?.getAttribute("data-pretext-raw-inline")
    ).toBe("")
    expect(container.querySelector("sub")?.textContent).toBe("2")
    expect(container.querySelector("sub")?.className).toContain("align-sub")
    expect(
      container.querySelector("sub")?.getAttribute("data-pretext-raw-inline")
    ).toBe("")
    expect(container.querySelector("sup")?.textContent).toBe("2")
    expect(container.querySelector("sup")?.className).toContain("align-super")
    expect(
      container.querySelector("sup")?.getAttribute("data-pretext-raw-inline")
    ).toBe("")
    expect(container.querySelector("q")?.textContent).toBe("quoted")
    expect(container.querySelector("q")?.className).toContain("italic")
    expect(container.querySelector("q")?.className).not.toContain("raw")
    expect(container.querySelector("q")?.getAttribute("cite")).toBeNull()
    expect(
      container.querySelector("q")?.getAttribute("data-pretext-raw-inline")
    ).toBe("")
    expect(container.querySelector("ins")?.textContent).toBe("added")
    expect(container.querySelector("ins")?.getAttribute("cite")).toBe(
      "https://example.com/change"
    )
    expect(container.querySelector("ins")?.className).toContain("underline")
    expect(
      container.querySelector("ins")?.getAttribute("data-pretext-raw-inline")
    ).toBe("")
    expect(container.querySelector("mark")?.textContent).toBe("marked")
    expect(
      container.querySelector("mark")?.getAttribute("data-pretext-raw-inline")
    ).toBe("")
    expect(container.querySelector("var")?.textContent).toBe("value")
    expect(container.querySelector("var")?.className).toContain("italic")
    expect(
      container.querySelector("var")?.getAttribute("data-pretext-raw-inline")
    ).toBe("")
    expect(container.querySelector("samp")?.textContent).toBe("output")
    expect(container.querySelector("samp")?.className).toContain("font-mono")
    expect(
      container.querySelector("samp")?.getAttribute("data-pretext-raw-inline")
    ).toBe("")
    expect(container.querySelector("abbr")?.textContent).toBe("API")
    expect(container.querySelector("abbr")?.getAttribute("title")).toBe(
      "Application programming interface"
    )
    expect(container.querySelector("abbr")?.getAttribute("onclick")).toBeNull()
    expect(container.querySelector("abbr")?.className).toContain("cursor-help")
    expect(
      container.querySelector("abbr")?.getAttribute("data-pretext-raw-inline")
    ).toBe("")
    expect(container.querySelector("time")?.textContent).toBe("June 16")
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe(
      "2026-06-16"
    )
    expect(container.querySelector("time")?.getAttribute("style")).toBeNull()
    expect(
      container.querySelector("time")?.getAttribute("data-pretext-raw-inline")
    ).toBe("")
    expect(container.querySelector("cite")?.textContent).toBe("RFC 9110")
    expect(container.querySelector("cite")?.className).toContain("italic")
    expect(container.querySelector("cite")?.className).not.toContain("raw")
    expect(
      container.querySelector("cite")?.getAttribute("data-pretext-raw-inline")
    ).toBe("")
    expect(container.querySelector("dfn")?.textContent).toBe("HTTP")
    expect(container.querySelector("dfn")?.getAttribute("title")).toBe(
      "Hypertext Transfer Protocol"
    )
    expect(container.querySelector("dfn")?.className).toContain("italic")
    expect(
      container.querySelector("dfn")?.getAttribute("data-pretext-raw-inline")
    ).toBe("")
    expect(container.querySelector("small")?.textContent).toBe("fine print")
    expect(container.querySelector("small")?.getAttribute("onclick")).toBeNull()
    expect(container.querySelector("small")?.className).toContain(
      "text-muted-foreground"
    )
    expect(
      container.querySelector("small")?.getAttribute("data-pretext-raw-inline")
    ).toBe("")
  })

  it("preserves Markdown comments as source-only content", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          ["# Public", "", "<!-- internal note -->", "", "Visible text."].join(
            "\n"
          )
        )}
        controls={false}
      />
    )

    expect(await screen.findByRole("heading", { name: "Public" })).toBeTruthy()
    expect(screen.getByText("Visible text.")).toBeTruthy()
    expect(container.textContent).not.toContain("internal note")
    expect(container.textContent).not.toContain("<!--")
  })

  it("removes active raw HTML and SVG surfaces", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "# Raw safety",
            "",
            '<iframe src="https://example.com"></iframe>',
            '<object data="https://example.com"></object>',
            '<embed src="https://example.com" />',
            '<form action="/submit"><input name="token" /><button>Send</button></form>',
            '<style>.x{color:red}</style><link rel="stylesheet" href="/x.css" />',
            "<svg><style>.x{fill:red}</style><script>alert(1)</script><circle /></svg>",
            '<meta http-equiv="refresh" content="0;url=https://example.com" />',
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(
      await screen.findByRole("heading", { name: "Raw safety" })
    ).toBeTruthy()
    for (const selector of [
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "style",
      "link",
      "script",
      "meta",
    ]) {
      expect(container.querySelector(selector)).toBeNull()
    }
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull()
    expect(container.querySelector("svg circle")).toBeNull()
  })

  it("does not trust user-authored internal Pretext metadata attributes", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "# Trusted heading",
            "",
            '<h2 data-pretext-heading-id="constructor">Spoofed heading</h2>',
            '<div data-pretext-component-name="Metric" data-pretext-component-props="{&quot;label&quot;:&quot;Pwned&quot;,&quot;value&quot;:&quot;100&quot;}">Pwned</div>',
            '<div data-pretext-component-fallback-name="Danger" data-pretext-component-fallback-reason="Unsupported component" data-pretext-component-fallback-source="<Danger />">Pwned fallback</div>',
            '<div data-pretext-callout-kind="warning" data-pretext-callout-title="Pwned">Pwned callout</div>',
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(
      await screen.findByRole("heading", { name: "Trusted heading" })
    ).toBeTruthy()
    expect(
      screen.getByRole("heading", { name: "Spoofed heading" })
    ).toBeTruthy()
    expect(container.querySelector("#constructor")).toBeNull()
    expect(
      container.querySelector('[data-pretext-component="Metric"]')
    ).toBeNull()
    expect(
      container.querySelector('[data-pretext-callout-kind="warning"]')
    ).toBeNull()
    expect(
      container.querySelector("[data-pretext-component-fallback]")
    ).toBeNull()
    expect(container.querySelector("[data-pretext-heading-id]")).toBeNull()
    expect(container.querySelector("[data-pretext-component-name]")).toBeNull()
    expect(
      container.querySelector("[data-pretext-component-fallback-name]")
    ).toBeNull()
    expect(container.querySelector("[data-pretext-callout-kind]")).toBeNull()
  })

  it("sanitizes links and images without mounting unsafe DOM", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "# Safe",
            "",
            '[Good](https://retab.com "Retab") [Unsafe](javascript:alert(1) "Bad")',
            "",
            "![Blocked](javascript:alert(1))",
            "",
            "![SVG](/icons/logo.svg)",
            "",
            "![Data](data:image/png;base64,AAAA)",
            "",
            "![Blob](blob:https://retab.com/id)",
            "",
            '<script data-testid="xss">alert("xss")</script>',
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByRole("heading", { name: "Safe" })).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Good" }).getAttribute("title")
    ).toBe("Retab")
    expect(screen.getByText("Unsafe").closest("a")).toBeNull()
    expect(screen.getByText("Unsafe").closest("[title]")).toBeNull()
    expect(screen.getByRole("img", { name: "Blocked" })).toBeTruthy()
    expect(screen.getByRole("img", { name: "SVG" })).toBeTruthy()
    expect(screen.getByRole("img", { name: "Data" })).toBeTruthy()
    expect(screen.getByRole("img", { name: "Blob" })).toBeTruthy()
    expect(container.querySelector("script")).toBeNull()
    expect(container.querySelector("[src='javascript:alert(1)']")).toBeNull()
    expect(container.querySelector('img[src$=".svg"]')).toBeNull()
    expect(container.querySelector('img[src^="data:"]')).toBeNull()
    expect(container.querySelector('img[src^="blob:"]')).toBeNull()
  })

  it("applies link target and rel policy after raw HTML sanitization", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '<a href="https://example.com" target="_self" rel="opener" title="External docs">External</a>',
            '<a href="/docs" target="_blank" rel="noopener">Internal</a>',
            '<a href="javascript:alert(1)" target="_blank">Unsafe</a>',
          ].join("\n")
        )}
        controls={false}
      />
    )

    const external = await screen.findByRole("link", { name: "External" })
    const internal = screen.getByRole("link", { name: "Internal" })

    expect(external.getAttribute("href")).toBe("https://example.com")
    expect(external.getAttribute("target")).toBe("_blank")
    expect(external.getAttribute("rel")).toBe("noopener noreferrer")
    expect(external.getAttribute("title")).toBe("External docs")
    expect(external.getAttribute("data-pretext-link-kind")).toBe("external")
    expect(internal.getAttribute("href")).toBe("/docs")
    expect(internal.getAttribute("target")).toBeNull()
    expect(internal.getAttribute("rel")).toBeNull()
    expect(internal.getAttribute("data-pretext-link-kind")).toBe("root")
    expect(screen.getByText("Unsafe").closest("a")).toBeNull()
  })

  it("renders images with stable loading, ready, caption, and failed states", async () => {
    const { container, rerender } = render(
      <PretextMarkdownViewer
        source={markdownSource('![Diagram](/diagram.png "System diagram")')}
        controls={false}
      />
    )

    const image = await screen.findByRole("img", { name: "Diagram" })
    const imageSurface = image.closest("[data-pretext-image-state]")
    const caption = screen.getByText("System diagram")
    expect(imageSurface?.getAttribute("data-pretext-image-state")).toBe(
      "loading"
    )
    expect(caption).toBeTruthy()
    expect(caption.getAttribute("data-pretext-image-caption")).toBe("")
    expect(image.getAttribute("aria-describedby")).toBe(caption.id)
    expect(image.getAttribute("loading")).toBe("lazy")
    expect(image.className).toContain("max-w-full")
    expect(image.className).toContain("max-h-[70vh]")
    expect(imageSurface?.className).toContain("max-w-full")
    expect(imageSurface?.className).toContain("w-fit")

    Object.defineProperty(image, "naturalWidth", {
      configurable: true,
      value: 640,
    })
    Object.defineProperty(image, "naturalHeight", {
      configurable: true,
      value: 320,
    })
    fireEvent.load(image)

    await waitFor(() => {
      const readySurface = screen
        .getByRole("img", { name: "Diagram" })
        .closest("[data-pretext-image-state]")
      expect(readySurface?.getAttribute("data-pretext-image-state")).toBe(
        "ready"
      )
      expect((readySurface as HTMLElement).style.aspectRatio).toBe("640 / 320")
    })

    fireEvent.error(image)

    expect(
      screen
        .getByRole("img", {
          name: "Diagram",
        })
        .getAttribute("data-pretext-image-state")
    ).toBe("failed")
    expect(
      screen.getByRole("group", { name: "Image failed: Diagram" })
    ).toBeTruthy()
    expect(screen.getByText("Image failed to load: Diagram")).toBeTruthy()
    expect(screen.getByRole("img", { name: "Diagram" }).textContent).toContain(
      "Image failed to load: Diagram"
    )
    expect(container.querySelector("img")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Retry image" }))

    const retriedImage = await screen.findByRole("img", { name: "Diagram" })
    expect(retriedImage.tagName).toBe("IMG")
    expect(retriedImage.getAttribute("src")).toBe("/diagram.png")
    expect(
      retriedImage
        .closest("[data-pretext-image-state]")
        ?.getAttribute("data-pretext-image-state")
    ).toBe("loading")

    rerender(
      <PretextMarkdownViewer
        source={markdownSource("![Updated](/updated.png)")}
        controls={false}
      />
    )

    const updated = await screen.findByRole("img", { name: "Updated" })
    expect(
      updated
        .closest("[data-pretext-image-state]")
        ?.getAttribute("data-pretext-image-state")
    ).toBe("loading")
    expect(updated.getAttribute("src")).toBe("/updated.png")
  })

  it("keeps YAML frontmatter as a first-class chunk", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "---",
            "title: Release Notes",
            "draft: false",
            "priority: 2",
            "aliases: [stable, public]",
            "tags:",
            "  - ignored",
            "---",
            "",
            "# Body",
          ].join("\n")
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("Release Notes")).toBeTruthy()
    expect(screen.getByText("draft")).toBeTruthy()
    expect(screen.getByText("false")).toBeTruthy()
    expect(screen.getByText("priority")).toBeTruthy()
    expect(screen.getByText("2")).toBeTruthy()
    expect(await screen.findByRole("heading", { name: "Body" })).toBeTruthy()
    const frontmatter = container.querySelector(
      "[data-pretext-markdown-frontmatter]"
    )
    expect(frontmatter).toBeTruthy()
    const metadata = frontmatter?.querySelector(
      "[data-pretext-markdown-frontmatter-metadata]"
    )
    expect(metadata).toBeTruthy()
    expect(metadata?.textContent).toContain("tags")
    expect(metadata?.textContent).toContain("ignored")
    const yamlLists = Array.from(
      metadata?.querySelectorAll("dd[data-frontmatter-value-kind='list']") ?? []
    ).map((node) => node.textContent)
    expect(yamlLists).toContain("stable, public")
    expect(yamlLists).toContain("ignored")
    expect(frontmatter?.textContent).toContain("title: Release Notes")
    expect(frontmatter?.textContent).toContain("aliases: [stable, public]")
    expect(frontmatter?.textContent).toContain("tags:")
    expect(container.textContent).not.toContain("```yaml")
  })

  it("keeps TOML frontmatter as a first-class chunk", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "+++",
            'title = "Release Notes"',
            "draft = false",
            "priority = 2",
            'tags = ["docs", "launch"]',
            "[nested]",
            'ignored = "yes"',
            "+++",
            "",
            "# Body",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await screen.findByRole("heading", { name: "Body" })
    const frontmatter = container.querySelector(
      '[data-pretext-markdown-frontmatter="toml"]'
    )
    expect(frontmatter?.textContent).toContain('title = "Release Notes"')
    expect(frontmatter?.textContent).toContain("draft = false")
    expect(frontmatter?.textContent).toContain("priority = 2")
    expect(frontmatter?.textContent).toContain('tags = ["docs", "launch"]')
    expect(frontmatter?.textContent).toContain("[nested]")
    const metadata = frontmatter?.querySelector(
      "[data-pretext-markdown-frontmatter-metadata]"
    )
    expect(metadata).toBeTruthy()
    expect(metadata?.textContent).toContain("nested.ignored")
    expect(metadata?.textContent).toContain("yes")
    expect(
      metadata?.querySelector("dd[data-frontmatter-value-kind='list']")
        ?.textContent
    ).toBe("docs, launch")
    expect(frontmatter?.textContent).toContain("Release Notes")
    expect(frontmatter?.textContent).toContain("false")
    expect(frontmatter?.textContent).toContain("2")
    expect(frontmatter).toBeTruthy()
    expect(container.textContent).not.toContain("```toml")
  })

  it("keeps complex frontmatter values in raw source without summarizing them", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "---",
            "title: Release Notes",
            "owner: { name: Ada }",
            "matrix: [{ os: linux }]",
            "---",
            "",
            "# Body",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await screen.findByRole("heading", { name: "Body" })
    const frontmatter = container.querySelector(
      "[data-pretext-markdown-frontmatter]"
    )
    const metadata = frontmatter?.querySelector(
      "[data-pretext-markdown-frontmatter-metadata]"
    )
    expect(metadata?.textContent).toContain("title")
    expect(metadata?.textContent).not.toContain("owner")
    expect(metadata?.textContent).not.toContain("matrix")
    expect(frontmatter?.textContent).toContain("owner: { name: Ada }")
    expect(frontmatter?.textContent).toContain("matrix: [{ os: linux }]")
  })

  it("keeps malformed frontmatter fences as ordinary Markdown", async () => {
    const { container, rerender } = render(
      <PretextMarkdownViewer
        source={markdownSource(["---", "title: Draft", "# Body"].join("\n"))}
        controls={false}
      />
    )

    expect(await screen.findByRole("heading", { name: "Body" })).toBeTruthy()
    expect(
      container.querySelector("[data-pretext-thematic-break]")
    ).toBeTruthy()
    expect(screen.getByText("title: Draft")).toBeTruthy()
    expect(
      container.querySelector("[data-pretext-markdown-frontmatter]")
    ).toBeNull()

    rerender(
      <PretextMarkdownViewer
        source={markdownSource(["---", "---", "# Body"].join("\n"))}
        controls={false}
      />
    )

    expect(await screen.findByRole("heading", { name: "Body" })).toBeTruthy()
    expect(
      container.querySelectorAll("[data-pretext-thematic-break]")
    ).toHaveLength(2)
    expect(
      container.querySelector("[data-pretext-markdown-frontmatter]")
    ).toBeNull()
  })

  it("uses the same stable ids for rendered and modeled headings", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource(
          ["# API_v2 & SDK", "", "# API_v2 & SDK"].join("\n")
        )}
        controls={false}
      />
    )

    const headings = await screen.findAllByRole("heading", {
      name: "API_v2 & SDK",
    })
    expect(headings.map((heading) => heading.id)).toEqual([
      "api_v2-sdk",
      "api_v2-sdk-1",
    ])
  })

  it("uses visible decoded heading text for rendered heading ids", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource(
          ["# Tom &amp; Jerry", "", "## AT&amp;T &copy;"].join("\n")
        )}
        controls={false}
      />
    )

    const tom = await screen.findByRole("heading", { name: "Tom & Jerry" })
    const att = screen.getByRole("heading", { name: "AT&T ©" })
    expect(tom.id).toBe("tom-jerry")
    expect(att.id).toBe("att")
  })

  it("copies a stable heading link without changing the heading name", async () => {
    window.history.replaceState(null, "", "/docs/components/file-viewer/pretext?tab=rendered")

    render(
      <PretextMarkdownViewer
        source={markdownSource("# Release Notes")}
        controls={false}
      />
    )

    const heading = await screen.findByRole("heading", {
      name: "Release Notes",
    })
    const copyLink = screen.getByRole("button", {
      name: "Copy link to Release Notes",
    })

    expect(heading.id).toBe("release-notes")
    fireEvent.click(copyLink)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "http://localhost:3000/docs/components/file-viewer/pretext?tab=rendered#release-notes"
      )
    })
  })

  it("prefixes DOM-clobbering heading ids without losing collision suffixes", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "# constructor",
            "",
            "# constructor",
            "",
            "# __proto__",
            "",
            "# location",
          ].join("\n")
        )}
        controls={false}
      />
    )

    const headings = await screen.findAllByRole("heading")
    expect(headings.map((heading) => heading.id)).toEqual([
      "section-constructor",
      "section-constructor-1",
      "section-__proto__",
      "section-location",
    ])
  })

  it("renders lower heading levels with stable ids", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource(["##### Deep", "", "###### Small"].join("\n"))}
        controls={false}
      />
    )

    const deep = await screen.findByRole("heading", { name: "Deep" })
    const small = await screen.findByRole("heading", { name: "Small" })

    expect(deep.tagName).toBe("H5")
    expect(deep.id).toBe("deep")
    expect(small.tagName).toBe("H6")
    expect(small.id).toBe("small")
  })

  it("resolves local heading fragments through the virtual document model", async () => {
    const pushState = vi.spyOn(window.history, "pushState")
    const sections = Array.from(
      { length: 40 },
      (_, index) => `## Filler ${index + 1}\n\nParagraph ${index + 1}.`
    ).join("\n\n")
    render(
      <PretextMarkdownViewer
        className="h-80 w-[420px]"
        source={markdownSource(
          [
            "# Links",
            "",
            "[Jump](#snake_case_thing)",
            "",
            sections,
            "",
            "## snake_case_thing",
            "",
            "Target section.",
          ].join("\n")
        )}
        controls={false}
      />
    )

    fireEvent.click(await screen.findByRole("link", { name: "Jump" }))

    expect(pushState).toHaveBeenCalledWith(null, "", "#snake_case_thing")
    expect(window.location.hash).toBe("#snake_case_thing")
    expect(HTMLElement.prototype.scrollTo).toHaveBeenCalled()
    expect(
      vi
        .mocked(HTMLElement.prototype.scrollTo)
        .mock.calls.some(([options]) =>
          isPositiveScrollTop(options as ScrollToOptions | number)
        )
    ).toBe(true)
  })

  it("resolves the current hash after the virtual document mounts", async () => {
    window.history.replaceState(null, "", "#target-section")
    const sections = Array.from(
      { length: 40 },
      (_, index) => `## Filler ${index + 1}\n\nParagraph ${index + 1}.`
    ).join("\n\n")

    render(
      <PretextMarkdownViewer
        className="h-80 w-[420px]"
        source={markdownSource(
          [
            "# Links",
            "",
            sections,
            "",
            "## Target Section",
            "",
            "Target section.",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await waitFor(() => {
      expect(
        vi
          .mocked(HTMLElement.prototype.scrollTo)
          .mock.calls.some(([options]) =>
            isPositiveScrollTop(options as ScrollToOptions | number)
          )
      ).toBe(true)
    })
  })

  it("resolves hash changes through the virtual document model", async () => {
    const sections = Array.from(
      { length: 40 },
      (_, index) => `## Filler ${index + 1}\n\nParagraph ${index + 1}.`
    ).join("\n\n")

    render(
      <PretextMarkdownViewer
        className="h-80 w-[420px]"
        source={markdownSource(
          [
            "# Links",
            "",
            sections,
            "",
            "## Target Section",
            "",
            "Target section.",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await screen.findByRole("heading", { name: "Links" })
    vi.mocked(HTMLElement.prototype.scrollTo).mockClear()
    window.history.pushState(null, "", "#target-section")
    window.dispatchEvent(new Event("hashchange"))

    await waitFor(() => {
      expect(
        vi
          .mocked(HTMLElement.prototype.scrollTo)
          .mock.calls.some(([options]) =>
            isPositiveScrollTop(options as ScrollToOptions | number)
          )
      ).toBe(true)
    })
  })

  it("resolves back and forward fragment navigation through popstate", async () => {
    window.history.replaceState(null, "", "/docs/components/file-viewer/pretext")
    const sections = Array.from(
      { length: 40 },
      (_, index) => `## Filler ${index + 1}\n\nParagraph ${index + 1}.`
    ).join("\n\n")

    render(
      <PretextMarkdownViewer
        className="h-80 w-[420px]"
        source={markdownSource(
          [
            "# Links",
            "",
            sections,
            "",
            "## First Target",
            "",
            "First target.",
            "",
            "## Second Target",
            "",
            "Second target.",
          ].join("\n")
        )}
        controls={false}
      />
    )

    await screen.findByRole("heading", { name: "Links" })
    vi.mocked(HTMLElement.prototype.scrollTo).mockClear()

    window.history.pushState(null, "", "#first-target")
    window.dispatchEvent(new PopStateEvent("popstate"))

    await waitFor(() => {
      expect(
        vi
          .mocked(HTMLElement.prototype.scrollTo)
          .mock.calls.some(([options]) =>
            isPositiveScrollTop(options as ScrollToOptions | number)
          )
      ).toBe(true)
    })

    vi.mocked(HTMLElement.prototype.scrollTo).mockClear()
    window.history.pushState(null, "", "#second-target")
    window.dispatchEvent(new PopStateEvent("popstate"))

    await waitFor(() => {
      expect(
        vi
          .mocked(HTMLElement.prototype.scrollTo)
          .mock.calls.some(([options]) =>
            isPositiveScrollTop(options as ScrollToOptions | number)
          )
      ).toBe(true)
    })
  })
})

function isPositiveScrollTop(options: ScrollToOptions | number | undefined) {
  return (
    typeof options === "object" && options !== null && Number(options.top) > 0
  )
}
