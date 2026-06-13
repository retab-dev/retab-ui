// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MarkdownDocumentViewer } from "@/components/ui/markdown-document-viewer"

function markdownSource(text: string) {
  return {
    kind: "text" as const,
    fileName: "notes.md",
    mimeType: "text/markdown",
    text,
  }
}

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

describe("markdown prose transforms", () => {
  it("applies typography and emoji transforms in rendered prose", async () => {
    render(
      <MarkdownDocumentViewer
        toolbar={false}
        source={markdownSource('"Ship" -- now... :sparkles: 1/2 -> done')}
      />
    )

    await screen.findByText("“Ship” – now… ✨ ½ → done")
  })

  it("does not transform inline code or text mode source", async () => {
    render(
      <MarkdownDocumentViewer
        source={markdownSource('Use `"Ship" -- now... :sparkles:`.')}
      />
    )

    await screen.findByText('"Ship" -- now... :sparkles:')
    fireEvent.click(screen.getByRole("tab", { name: "Text" }))

    expect(
      document.querySelector('[data-slot="markdown-document-text-content"]')
        ?.textContent
    ).toBe('Use `"Ship" -- now... :sparkles:`.')
  })
})

