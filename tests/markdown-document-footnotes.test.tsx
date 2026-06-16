// @vitest-environment jsdom

import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
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
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("markdown footnotes", () => {
  it("renders accessible footnote references and backrefs", async () => {
    const { container } = render(
      <MarkdownDocumentViewer
        controls={false}
        source={markdownSource("A note.[^a]\n\n[^a]: Footnote body.")}
      />
    )

    await screen.findByText("Footnote body.")

    expect(container.querySelector("[data-footnote-ref]")).toBeTruthy()
    expect(container.querySelector("[data-footnote-backref]")).toBeTruthy()
    expect(container.querySelector("section")).toBeTruthy()
  })
})

