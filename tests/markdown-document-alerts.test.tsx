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

describe("markdown GitHub alerts", () => {
  it("renders GitHub blockquote alerts as callouts", async () => {
    const { container } = render(
      <MarkdownDocumentViewer
        controls={false}
        source={markdownSource("> [!IMPORTANT]\n> Ship the fix.")}
      />
    )

    await screen.findByText("Ship the fix.")
    const callout = container.querySelector('[data-callout-kind="important"]')

    expect(callout).toBeTruthy()
    expect(callout?.textContent).toContain("Important")
    expect(callout?.textContent).toContain("Ship the fix.")
  })

  it("keeps ordinary blockquotes as blockquotes", async () => {
    const { container } = render(
      <MarkdownDocumentViewer
        controls={false}
        source={markdownSource("> Ordinary quote.")}
      />
    )

    await screen.findByText("Ordinary quote.")

    expect(container.querySelector("blockquote")).toBeTruthy()
    expect(container.querySelector("[data-callout-kind]")).toBeNull()
  })
})

