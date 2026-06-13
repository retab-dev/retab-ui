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

  it("keeps unsafe component markdown inert", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            '<Danger onClick="steal()" value="x" />',
            "",
            '<Metric label={getLabel()} value="98%" />',
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
    const diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )

    expect(diagram).toBeTruthy()
    await waitFor(() => expect(diagram?.dataset.diagramState).toBe("ready"))
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
    expect(container.querySelector("[data-footnote-ref]")).toBeTruthy()
    expect(container.querySelector("[data-footnote-backref]")).toBeTruthy()
    expect(container.querySelector("[data-footnotes]")).toBeTruthy()
  })

  it("renders code block language headers and copy controls", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource("```ts\nconst answer = 42\n```")}
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

  it("copies rendered table cells as TSV", async () => {
    render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "| Name | Link |",
            "| --- | --- |",
            "| **Bold** `code` | [Site](https://example.com) |",
          ].join("\n")
        )}
        toolbar={false}
      />
    )

    expect(await screen.findByRole("table")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Copy table"))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        ["Name\tLink", "Bold code\tSite"].join("\n")
      )
    })
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
