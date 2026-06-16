// @vitest-environment jsdom

import * as React from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
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
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return this.getAttribute("data-slot") ===
        "markdown-document-rendered-content"
        ? 512
        : 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(function scrollTo(this: HTMLElement, options: ScrollToOptions) {
      if (typeof options.top === "number") this.scrollTop = options.top
      if (typeof options.left === "number") this.scrollLeft = options.left
    }),
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

describe("markdown document initial scroll", () => {
  it("keeps the continuous document below the controls after chunk measurement", async () => {
    render(
      <div style={{ height: 620 }}>
        <MarkdownDocumentViewer
          className="h-full"
          source={markdownSource("# Release Notes\n\nBody")}
        />
      </div>
    )

    await screen.findByRole("heading", { name: "Release Notes" })

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="text-viewer"] [data-slot="scroll-area-viewport"]'
    )
    const chunk = document.querySelector<HTMLElement>(
      '[data-slot="markdown-document-chunk"]'
    )

    expect(viewport).toBeTruthy()
    expect(chunk).toBeTruthy()
    await waitFor(() => expect(chunk?.style.minHeight).toBe(""))

    expect(viewport?.scrollTop).toBe(0)
    expect(screen.queryByText(/Chunk \d+ of \d+/)).toBeNull()
  })
})
