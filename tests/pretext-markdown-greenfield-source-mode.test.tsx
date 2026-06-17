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

function markdownSource(text: string) {
  return {
    kind: "text" as const,
    fileName: "source-mode.md",
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

describe("pretext markdown greenfield source mode", () => {
  it("uses a real-height scroll canvas while rendering only visible source lines", () => {
    const markdown = Array.from(
      { length: 120 },
      (_, index) => `line ${index + 1}`
    ).join("\n")
    const { container } = render(
      <PretextMarkdownViewer source={markdownSource(markdown)} />
    )

    fireEvent.click(screen.getByRole("button", { name: "Text" }))

    const scrollCanvas = container.querySelector<HTMLElement>(
      '[data-slot="pretext-markdown-source-scroll-canvas"]'
    )
    const sourceCanvas = screen.getByRole("region", { name: "Markdown source" })
    const mountedLines = container.querySelectorAll("[data-source-line]")

    expect(scrollCanvas?.style.height).toBe(`${120 * 22}px`)
    expect(sourceCanvas).toBeTruthy()
    expect(mountedLines.length).toBeLessThan(120)
    expect(mountedLines.length).toBeGreaterThan(0)
  })

  it("preserves the current rendered scroll anchor when switching to source mode", async () => {
    const scrollTo = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    })
    const markdown = Array.from({ length: 140 }, (_, index) =>
      [`## Section ${index + 1}`, "", `Paragraph ${index + 1}.`].join("\n")
    ).join("\n\n")
    const { container } = render(
      <PretextMarkdownViewer source={markdownSource(markdown)} />
    )
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )

    expect(viewport).toBeTruthy()
    scrollTo.mockClear()
    viewport!.scrollTop = 1200
    fireEvent.scroll(viewport!)
    fireEvent.click(screen.getByRole("button", { name: "Text" }))

    await waitFor(() => {
      const sourceScroll = scrollTo.mock.calls.find((call) => {
        const options = call[0]
        return (
          options &&
          typeof options === "object" &&
          "top" in options &&
          typeof options.top === "number" &&
          options.top > 0
        )
      })

      expect(sourceScroll).toBeTruthy()
    })
  })
})
