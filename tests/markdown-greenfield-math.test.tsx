// @vitest-environment jsdom

import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MarkdownViewer } from "@/components/ui/markdown-viewer"

function markdownSource(text: string) {
  return {
    kind: "text" as const,
    fileName: "math.md",
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

describe("pretext markdown greenfield math", () => {
  it("renders inline and display math through bounded KaTeX surfaces", () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            "Inline math $a^2 + b^2 = c^2$ stays in prose.",
            "",
            "$$",
            "\\int_0^1 x^2\\,dx = \\frac{1}{3}",
            "$$",
          ].join("\n")
        )}
      />
    )

    expect(container.querySelector("[data-pretext-math-inline]")).toBeTruthy()

    const mathBlock = screen.getByRole("region", { name: "Math block" })
    expect(mathBlock.getAttribute("data-pretext-math-block")).toBe("")
    expect(mathBlock.className).toContain("overflow-x-auto")
    expect(container.querySelector("script")).toBeNull()
    expect(container.querySelector("[onclick]")).toBeNull()
  })
})
