// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PretextMarkdownViewer } from "@/components/ui/pretext-markdown-viewer"

function markdownSource(text: string, fileName = "notes.md") {
  return {
    kind: "text" as const,
    fileName,
    mimeType: "text/markdown",
    text,
  }
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
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
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

  it("renders GitHub alerts as React Markdown alert surfaces", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource("> [!IMPORTANT]\n> Ship **carefully**.")}
        toolbar={false}
      />
    )

    expect(await screen.findByText(/Important:/)).toBeTruthy()
    expect(screen.getByText("carefully")).toBeTruthy()
    expect(container.textContent).not.toContain("[!IMPORTANT]")
    expect(
      container.querySelector('[data-pretext-alert-kind="important"]')
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

  it("keeps YAML frontmatter as a first-class page", async () => {
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
})

function isPositiveScrollTop(options: ScrollToOptions | number | undefined) {
  return (
    typeof options === "object" && options !== null && Number(options.top) > 0
  )
}
