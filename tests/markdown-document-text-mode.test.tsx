// @vitest-environment jsdom

// Bug hunt for the "Text" view tab fidelity.
//
// The Text tab renders each page's `page.markdown`, which createMarkdownPages
// rebuilds from parsed blocks (`blocks.map(b => b.markdown).join("\n\n")`):
//   * YAML frontmatter is rewritten to a ```yaml fenced code block,
//   * runs of blank lines collapse to a single blank line,
//   * each block is trimEnd-ed.
// So the Text tab does not show the document source — yet the toolbar's
// "Copy markdown" button copies the verbatim `document.text`. A user switching to
// "Text" to read/copy the raw source sees a reformatted document instead.

import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MarkdownDocumentViewer } from "@/components/ui/markdown-document-viewer"

function markdownSource(text: string) {
  return { kind: "text" as const, fileName: "notes.md", text, mimeType: "text/markdown" }
}

const textTabContent = () =>
  document.querySelector('[data-slot="markdown-document-text-content"]')?.textContent ?? ""

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(() => Promise.resolve()) },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("markdown Text view fidelity", () => {
  it("shows a simple single-page document verbatim", async () => {
    const source = "# Title\n\nBody paragraph"
    render(<MarkdownDocumentViewer source={markdownSource(source)} />)
    await screen.findByRole("heading", { name: "Title" })
    fireEvent.click(screen.getByRole("tab", { name: "Text" }))
    expect(await screen.findByText(/# Title/)).toBeTruthy()
    expect(textTabContent()).toBe(source)
  })

  it("shows YAML frontmatter verbatim instead of a rewritten ```yaml fence", async () => {
    const source = ["---", "title: Demo", "---", "", "# Heading"].join("\n")
    render(<MarkdownDocumentViewer source={markdownSource(source)} />)
    await screen.findByRole("heading", { name: "Heading" })
    fireEvent.click(screen.getByRole("tab", { name: "Text" }))
    await screen.findByText(/Heading/)
    const shown = textTabContent()
    // The Text view should echo the file's frontmatter delimiters, not a
    // synthesized code fence.
    expect(shown).toContain("---\ntitle: Demo\n---")
    expect(shown).not.toContain("```yaml")
  })

  it("preserves blank-line spacing from the source", async () => {
    const source = ["# Heading", "", "", "", "Body after a wide gap"].join("\n")
    render(<MarkdownDocumentViewer source={markdownSource(source)} />)
    await screen.findByRole("heading", { name: "Heading" })
    fireEvent.click(screen.getByRole("tab", { name: "Text" }))
    await screen.findByText(/Body after a wide gap/)
    expect(textTabContent()).toBe(source)
  })
})
