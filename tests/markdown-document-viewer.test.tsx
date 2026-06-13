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

import { MarkdownDocumentViewer } from "@/components/ui/markdown-document-viewer"
import type { TextViewerHandle } from "@/registry/new-york-v4/ui/text-viewer-types"

function markdownSource(text: string, fileName = "notes.md") {
  return { kind: "text" as const, fileName, text, mimeType: "text/markdown" }
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
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: vi.fn(() => Promise.resolve()),
    },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("MarkdownDocumentViewer", () => {
  it("renders GFM Markdown as virtualized document pages", async () => {
    const rows = Array.from(
      { length: 140 },
      (_, index) => `## Section ${index + 1}\n\nParagraph ${index + 1}`
    )
    const { container } = render(
      <MarkdownDocumentViewer
        className="h-80 w-[520px]"
        source={markdownSource(rows.join("\n\n"))}
        toolbar={false}
      />
    )

    expect(
      await screen.findByRole("heading", { name: "Section 1" })
    ).toBeTruthy()
    expect(
      container.querySelector('[data-slot="markdown-document-virtual-canvas"]')
    ).toBeTruthy()
    expect(
      container.querySelectorAll('[data-slot="markdown-document-page"]').length
    ).toBeLessThan(140)
  })

  it("renders tables accessibly and copies the complete source table", async () => {
    render(
      <MarkdownDocumentViewer
        source={markdownSource(
          [
            "| Name | Amount |",
            "| --- | ---: |",
            "| Alpha | 1 |",
            "| Beta | 2 |",
          ].join("\n")
        )}
        toolbar={false}
      />
    )

    expect(await screen.findByRole("table")).toBeTruthy()
    const amountHeader = screen.getByRole("columnheader", { name: "Amount" })
    await waitFor(() => {
      expect(amountHeader.id).toBeTruthy()
      expect(
        screen.getByText("Alpha").closest("tr")?.querySelectorAll("td")[1]
          ?.headers
      ).toBe(amountHeader.id)
    })

    fireEvent.click(screen.getByLabelText("Copy table"))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        ["Name\tAmount", "Alpha\t1", "Beta\t2"].join("\n")
      )
    })
  })

  it("marks rendered pages ready after async Markdown content appears", async () => {
    const { container } = render(
      <MarkdownDocumentViewer source={markdownSource("# Ready")} toolbar={false} />
    )

    expect(await screen.findByRole("heading", { name: "Ready" })).toBeTruthy()
    expect(
      container.querySelector('[data-markdown-render-state="ready"]')
    ).toBeTruthy()
  })

  it("renders fenced code language labels and copies code", async () => {
    render(
      <MarkdownDocumentViewer
        source={markdownSource(
          ["```ts", "const answer = 42", "```"].join("\n")
        )}
        toolbar={false}
      />
    )

    expect(await screen.findByText("ts")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Copy code block"))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "const answer = 42"
      )
    })
  })

  it("renders breaks, math, callouts, footnotes, and sanitized safe HTML", async () => {
    const { container } = render(
      <MarkdownDocumentViewer
        source={markdownSource(
          [
            "First line",
            "Second line",
            "",
            "Inline math $E = mc^2$.",
            "",
            "$$",
            "x^2",
            "$$",
            "",
            ':::warning{title="Careful"}',
            "Sanitized **callout** body.",
            ":::",
            "",
            "<details><summary>More</summary><mark>Safe</mark><script>alert(1)</script></details>",
            "",
            "Footnote here.[^one]",
            "",
            "[^one]: Footnote body.",
          ].join("\n")
        )}
        toolbar={false}
      />
    )

    expect(await screen.findByText("Careful")).toBeTruthy()
    expect(
      container.querySelector('[data-callout-kind="warning"]')
    ).toBeTruthy()
    expect(container.querySelector(".katex")).toBeTruthy()
    expect(container.querySelector("details")).toBeTruthy()
    expect(container.querySelector("mark")?.textContent).toBe("Safe")
    expect(container.querySelector("script")).toBeNull()
    expect(container.querySelector("[data-footnotes]")).toBeTruthy()
    expect(container.querySelector("p br")).toBeTruthy()
  })

  it("keeps unsafe Markdown inert while preserving safe links and images", async () => {
    const { container } = render(
      <MarkdownDocumentViewer
        source={markdownSource(
          [
            "# Safe",
            "",
            "[Good](https://retab.com) [Unsafe](javascript:alert(1))",
            "",
            "![Blocked](javascript:alert(1))",
            "",
            '<script data-testid="xss">alert("xss")</script>',
            '<img src="x" onerror="alert(1)" />',
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
    expect(container.querySelector("[onerror]")).toBeNull()
  })

  it("renders YAML frontmatter as inert code", async () => {
    const { container } = render(
      <MarkdownDocumentViewer
        source={markdownSource(
          ["---", "title: Demo", "tags: [viewer]", "---", "", "# Body"].join(
            "\n"
          )
        )}
        toolbar={false}
      />
    )

    expect(await screen.findByText("yaml")).toBeTruthy()
    expect(container.querySelector("code")?.textContent).toContain(
      "title: Demo"
    )
    expect(await screen.findByRole("heading", { name: "Body" })).toBeTruthy()
    expect(container.querySelector("script")).toBeNull()
  })

  it("uses the shared text bounds error state", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <MarkdownDocumentViewer
        source={markdownSource("one\ntwo\nthree")}
        maxLines={2}
      />
    )

    expect(
      await screen.findByText("This text file has too many lines to preview.")
    ).toBeTruthy()
  })

  it("supports duplicate heading ids, local fragments, highlights, and scroll-to-line", async () => {
    const viewerRef = React.createRef<TextViewerHandle>()
    const filler = Array.from(
      { length: 80 },
      (_, index) => `Paragraph ${index + 1}`
    )
    const { container } = render(
      <MarkdownDocumentViewer
        ref={viewerRef}
        className="h-40 w-[420px]"
        source={markdownSource(
          ["# Docs", "", "[Jump](#docs-1)", "", ...filler, "", "# Docs"].join(
            "\n"
          )
        )}
        highlight={{ start: 84, end: 84 }}
        toolbar={false}
      />
    )

    const headings = await screen.findAllByRole("heading", { name: "Docs" })
    expect(headings.map((heading) => heading.id)).toEqual(["docs", "docs-1"])
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()

    fireEvent.click(screen.getByRole("link", { name: "Jump" }))
    expect(viewport!.scrollTop).toBeGreaterThan(0)

    act(() => {
      viewerRef.current?.scrollToLineRange(
        { start: 84, end: 84 },
        { behavior: "auto" }
      )
    })
    expect(viewport!.scrollTop).toBeGreaterThan(0)
    expect(container.querySelector('[aria-current="true"]')).toBeTruthy()
  })

  it("keeps a 6,000-line Markdown fixture bounded to the virtual window", async () => {
    const markdown = Array.from(
      { length: 1500 },
      (_, index) => `## Section ${index + 1}\n\nBody line ${index + 1}`
    ).join("\n\n")
    const { container } = render(
      <MarkdownDocumentViewer
        className="h-80 w-[620px]"
        source={markdownSource(markdown)}
        toolbar={false}
      />
    )

    expect(
      await screen.findByRole("heading", { name: "Section 1" })
    ).toBeTruthy()
    const mountedPages = container.querySelectorAll(
      '[data-slot="markdown-document-page"]'
    ).length
    expect(mountedPages).toBeGreaterThan(0)
    expect(mountedPages).toBeLessThan(40)
    expect(container.textContent).not.toContain("Section 1500")
  })

  it("switches between rendered and raw text modes and keeps zoom controls", async () => {
    render(
      <MarkdownDocumentViewer source={markdownSource("# Title\n\nBody")} />
    )

    expect(await screen.findByRole("heading", { name: "Title" })).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Copy markdown"))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "# Title\n\nBody"
      )
    })
    fireEvent.click(screen.getByRole("tab", { name: "Text" }))
    expect(await screen.findByText(/# Title/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(await screen.findByText("90%")).toBeTruthy()
    fireEvent.click(screen.getByTitle("Reset zoom"))
    expect(await screen.findByText("100%")).toBeTruthy()
  })
})
