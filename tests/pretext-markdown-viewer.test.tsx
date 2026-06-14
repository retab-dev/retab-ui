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

import {
  PretextMarkdownViewer,
  type TextViewerHandle,
} from "@/components/ui/pretext-markdown-viewer"

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
  window.history.replaceState(null, "", "/")
})

describe("PretextMarkdownViewer", () => {
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
        toolbar={false}
      />
    )

    expect(
      await screen.findByRole("heading", { name: "Parsed Heading" })
    ).toBeTruthy()
  })

  it("copies the full Markdown source from the toolbar", async () => {
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
    expect(
      document.querySelector('[data-slot="pretext-markdown-virtual-canvas"]')
    ).toBeNull()
    expect(screen.queryByRole("heading", { name: "Release Notes" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Rendered" }))

    expect(
      await screen.findByRole("heading", { name: "Release Notes" })
    ).toBeTruthy()
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

  it("downloads the full Markdown source from the toolbar", async () => {
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
        toolbar={false}
      />
    )

    expect(await screen.findByText(/Important:/)).toBeTruthy()
    expect(screen.getByText("carefully")).toBeTruthy()
    expect(screen.getByRole("note", { name: "Important" })).toBeTruthy()
    expect(container.textContent).not.toContain("[!IMPORTANT]")
    expect(
      container.querySelector('[data-pretext-alert-kind="important"]')
    ).toBeTruthy()
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
        toolbar={false}
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
          'Use "quotes" -> arrows :sparkles: and `literal -> :sparkles:`.'
        )}
        toolbar={false}
      />
    )

    expect(await screen.findByText(/“quotes”/)).toBeTruthy()
    expect(screen.getByText(/→ arrows ✨/)).toBeTruthy()
    expect(screen.getByText("literal -> :sparkles:")).toBeTruthy()
  })

  it("renders GFM inline semantics for breaks, strike, and autolinks", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "First line",
            "Second line with ~~removed~~ text and www.retab.com.",
          ].join("\n")
        )}
        toolbar={false}
      />
    )

    expect(await screen.findByText(/First line/)).toBeTruthy()
    expect(container.querySelector("p br")).toBeTruthy()
    expect(container.querySelector("del")?.textContent).toBe("removed")
    expect(
      screen.getByRole("link", { name: "www.retab.com" }).getAttribute("href")
    ).toBe("http://www.retab.com")
  })

  it("applies link target and rel invariants", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "[Fragment](#release-notes)",
            "[Root](/docs/viewers)",
            "[Relative](docs/viewers)",
            "[Email](mailto:hello@retab.com)",
            "[External](https://example.com)",
          ].join("\n\n")
        )}
        toolbar={false}
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
    }
    expect(external.getAttribute("target")).toBe("_blank")
    expect(external.getAttribute("rel")).toBe("noopener noreferrer")
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
        toolbar={false}
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
        toolbar={false}
      />
    )

    const image = await screen.findByRole("img", { name: "Logo" })
    expect(image.getAttribute("src")).toBe("/logo.png")
    expect(image.getAttribute("title")).toBe("Logo title")
    expect(screen.getByText("Logo title")).toBeTruthy()
    expect(screen.queryByText(/\[logo\]:/)).toBeNull()
  })

  it("renders GFM task list checkboxes as read-only controls", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource(["- [x] Done", "- [ ] Pending"].join("\n"))}
        toolbar={false}
      />
    )

    const completed = await screen.findByRole("checkbox", {
      name: "Completed task",
    })
    const pending = screen.getByRole("checkbox", { name: "Incomplete task" })

    expect((completed as HTMLInputElement).checked).toBe(true)
    expect(completed.hasAttribute("readonly")).toBe(true)
    expect((pending as HTMLInputElement).checked).toBe(false)
    expect(pending.hasAttribute("readonly")).toBe(true)
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
        toolbar={false}
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
        toolbar={false}
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
            '::metric{label="Unsafe" onClick="steal"}',
            "",
            ':badge[Invalid directive]{tone="purple"}',
          ].join("\n")
        )}
        toolbar={false}
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
    expect(container.textContent).toContain("::metric")
    expect(container.textContent).toContain("Invalid directive")
    expect(container.querySelector("[data-pretext-component]")).toBeNull()
  })

  it("renders mermaid fences as diagram surfaces", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource("```mermaid\ngraph TD\n  A-->B\n```")}
        toolbar={false}
      />
    )

    await screen.findByText("mermaid")
    expect(screen.getByRole("group", { name: "Mermaid diagram" })).toBeTruthy()
    const diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )

    expect(diagram).toBeTruthy()
    await waitFor(() => expect(diagram?.dataset.diagramState).toBe("ready"))
    expect(screen.getByRole("img", { name: "Mermaid diagram" })).toBeTruthy()
    expect(diagram?.querySelector("svg")).toBeTruthy()
  })

  it("renders unsupported mermaid fences as non-crashing errors", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource("```mermaid\nsequenceDiagram\nA->>B: hi\n```")}
        toolbar={false}
      />
    )

    await screen.findByText("mermaid")
    expect(screen.getByRole("group", { name: "Mermaid diagram" })).toBeTruthy()
    expect(screen.getByLabelText("Mermaid diagram source")).toBeTruthy()
    const diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )

    await waitFor(() => expect(diagram?.dataset.diagramState).toBe("failed"))
    expect(diagram?.textContent).toContain("Unsupported Mermaid diagram")
  })

  it("renders inline and block math through KaTeX", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          ["Inline math $E = mc^2$.", "", "$$", "x^2 + y^2 = z^2", "$$"].join(
            "\n"
          )
        )}
        toolbar={false}
      />
    )

    expect(await screen.findByText(/Inline math/)).toBeTruthy()
    expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(
      2
    )
    expect(container.querySelector(".katex-display")).toBeTruthy()
  })

  it("renders GFM footnotes with reachable references and backrefs", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource("A note.[^a]\n\n[^a]: Footnote body.")}
        toolbar={false}
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

  it("renders code block language headers and copy controls", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource("```ts\nconst answer = 42\n```")}
        toolbar={false}
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

  it("shows code block copy failures without losing the source", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(() => Promise.reject(new Error("denied"))) },
    })

    render(
      <PretextMarkdownViewer
        source={markdownSource("```ts\nconst answer = 42\n```")}
        toolbar={false}
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
        toolbar={false}
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

  it("renders table cell inline Markdown and copies rendered cells as TSV", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "| Name | Link | Count |",
            "| :--- | :---: | ---: |",
            "| **Bold** `code` ~~old~~ | [Site](https://example.com) :check: | 42 |",
          ].join("\n")
        )}
        toolbar={false}
      />
    )

    const table = await screen.findByRole("table")
    const tableRegion = screen.getByRole("region", { name: "Markdown table" })
    expect(table).toBeTruthy()
    expect(tableRegion).toBeTruthy()
    expect(tableRegion.getAttribute("tabindex")).toBe("0")
    expect(tableRegion.contains(table)).toBe(true)
    const headers = container.querySelectorAll<HTMLTableCellElement>("th")
    const cells = container.querySelectorAll<HTMLTableCellElement>("td")
    expect(headers[0]?.id).toMatch(
      /^pretext-markdown-chunk-\d+-\d+-table-0-column-0$/
    )
    expect(headers[0]?.scope).toBe("col")
    expect(headers[1]?.id).toMatch(
      /^pretext-markdown-chunk-\d+-\d+-table-0-column-1$/
    )
    expect(headers[0]?.className).toContain("text-left")
    expect(headers[1]?.align).toBe("center")
    expect(headers[2]?.align).toBe("right")
    expect(headers[1]?.className).toContain("text-center")
    expect(headers[2]?.className).toContain("tabular-nums")
    expect(cells[0]?.headers).toBe(headers[0]?.id)
    expect(cells[1]?.headers).toBe(headers[1]?.id)
    expect(cells[2]?.headers).toBe(headers[2]?.id)
    expect(cells[1]?.className).toContain("text-center")
    expect(cells[2]?.align).toBe("right")
    expect(cells[2]?.className).toContain("tabular-nums")
    expect(container.querySelector("td strong")?.textContent).toBe("Bold")
    expect(container.querySelector("td code")?.textContent).toBe("code")
    expect(container.querySelector("td del")?.textContent).toBe("old")
    expect(screen.getByRole("link", { name: /Site/ })).toBeTruthy()
    expect(screen.getByText(/✓/)).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Copy table"))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        ["Name\tLink\tCount", "Bold code old\tSite ✓\t42"].join("\n")
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
        toolbar={false}
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

  it("preserves Markdown comments as source-only content", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          ["# Public", "", "<!-- internal note -->", "", "Visible text."].join(
            "\n"
          )
        )}
        toolbar={false}
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
        toolbar={false}
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
      "button",
      "style",
      "link",
      "svg",
      "script",
      "meta",
    ]) {
      expect(container.querySelector(selector)).toBeNull()
    }
  })

  it("sanitizes links and images without mounting unsafe DOM", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "# Safe",
            "",
            "[Good](https://retab.com) [Unsafe](javascript:alert(1))",
            "",
            "![Blocked](javascript:alert(1))",
            "",
            '<script data-testid="xss">alert("xss")</script>',
          ].join("\n")
        )}
        toolbar={false}
      />
    )

    expect(await screen.findByRole("heading", { name: "Safe" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Good" })).toBeTruthy()
    expect(screen.getByText("Unsafe").closest("a")).toBeNull()
    expect(screen.getByRole("img", { name: "Blocked" })).toBeTruthy()
    expect(container.querySelector("script")).toBeNull()
    expect(container.querySelector("[src='javascript:alert(1)']")).toBeNull()
  })

  it("renders images with stable loading, ready, caption, and failed states", async () => {
    const { container, rerender } = render(
      <PretextMarkdownViewer
        source={markdownSource('![Diagram](/diagram.png "System diagram")')}
        toolbar={false}
      />
    )

    const image = await screen.findByRole("img", { name: "Diagram" })
    const imageSurface = image.closest("[data-pretext-image-state]")
    expect(imageSurface?.getAttribute("data-pretext-image-state")).toBe(
      "loading"
    )
    expect(screen.getByText("System diagram")).toBeTruthy()

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
        toolbar={false}
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
          ["---", "title: Release Notes", "---", "", "# Body"].join("\n")
        )}
        toolbar={false}
      />
    )

    expect(await screen.findByText("title: Release Notes")).toBeTruthy()
    expect(await screen.findByRole("heading", { name: "Body" })).toBeTruthy()
    expect(
      container.querySelector("[data-pretext-markdown-frontmatter]")
    ).toBeTruthy()
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
            "+++",
            "",
            "# Body",
          ].join("\n")
        )}
        toolbar={false}
      />
    )

    await screen.findByRole("heading", { name: "Body" })
    const frontmatter = container.querySelector(
      '[data-pretext-markdown-frontmatter="toml"]'
    )
    expect(frontmatter?.textContent).toContain('title = "Release Notes"')
    expect(frontmatter?.textContent).toContain("draft = false")
    expect(await screen.findByRole("heading", { name: "Body" })).toBeTruthy()
    expect(frontmatter).toBeTruthy()
    expect(container.textContent).not.toContain("```toml")
  })

  it("uses the same stable ids for rendered and modeled headings", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource(
          ["# API_v2 & SDK", "", "# API_v2 & SDK"].join("\n")
        )}
        toolbar={false}
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
        toolbar={false}
      />
    )

    const tom = await screen.findByRole("heading", { name: "Tom & Jerry" })
    const att = screen.getByRole("heading", { name: "AT&T ©" })
    expect(tom.id).toBe("tom-jerry")
    expect(att.id).toBe("att")
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
        toolbar={false}
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
        toolbar={false}
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
        toolbar={false}
      />
    )

    fireEvent.click(await screen.findByRole("link", { name: "Jump" }))

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
        toolbar={false}
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
        toolbar={false}
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
})

function isPositiveScrollTop(options: ScrollToOptions | number | undefined) {
  return (
    typeof options === "object" && options !== null && Number(options.top) > 0
  )
}
