// @vitest-environment jsdom

import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PretextMarkdownViewer } from "@/components/ui/pretext-markdown-viewer"

function markdownSource(text: string) {
  return {
    kind: "text" as const,
    fileName: "footnotes.md",
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

describe("pretext markdown greenfield footnotes", () => {
  it("labels each footnote reference from the rendered reference number", () => {
    render(
      <PretextMarkdownViewer
        controls={false}
        source={markdownSource(
          [
            "First reference.[^alpha]",
            "",
            "Second reference.[^beta]",
            "",
            "[^alpha]: Alpha note.",
            "[^beta]: Beta note.",
          ].join("\n")
        )}
      />
    )

    expect(screen.getByRole("link", { name: "Footnote 1" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Footnote 2" })).toBeTruthy()
  })
})
