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

describe("markdown raw HTML policy", () => {
  it("keeps safe static HTML", async () => {
    const { container } = render(
      <MarkdownDocumentViewer
        controls={false}
        source={markdownSource(
          "<details><summary>More</summary><kbd>⌘K</kbd></details>"
        )}
      />
    )

    await screen.findByText("More")

    expect(container.querySelector("details")).toBeTruthy()
    expect(container.querySelector("kbd")?.textContent).toBe("⌘K")
  })

  it("removes active HTML and unsafe links", async () => {
    const { container } = render(
      <MarkdownDocumentViewer
        controls={false}
        source={markdownSource(
          '<script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(1)">bad</a>'
        )}
      />
    )

    await screen.findByText("bad")

    expect(container.querySelector("script")).toBeNull()
    expect(container.querySelector("a")).toBeNull()
    expect(container.querySelector("[onclick]")).toBeNull()
  })
})
