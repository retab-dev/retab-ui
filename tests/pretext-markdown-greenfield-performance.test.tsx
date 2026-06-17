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
import { createPretextMarkdownGreenfieldDocument } from "@/registry/new-york-v4/ui/pretext-markdown-greenfield-document"

function markdownSource(text: string) {
  return {
    kind: "text" as const,
    fileName: "large.md",
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

describe("pretext markdown greenfield performance boundaries", () => {
  it("keeps rendered mode mounted chunks bounded for long documents", () => {
    const markdown = Array.from({ length: 180 }, (_, index) =>
      [
        `## Section ${index + 1}`,
        "",
        `This is paragraph ${index + 1} with enough text to produce realistic source lines while staying cheap in unit tests.`,
        "",
        `- item ${index + 1}.1`,
        `- item ${index + 1}.2`,
      ].join("\n")
    ).join("\n\n")
    const model = createPretextMarkdownGreenfieldDocument(markdown)
    const { container } = render(
      <PretextMarkdownViewer source={markdownSource(markdown)} />
    )
    const mountedChunks = container.querySelectorAll(
      "[data-pretext-markdown-chunk]"
    )

    expect(model.chunks.length).toBeGreaterThan(12)
    expect(mountedChunks.length).toBeGreaterThan(0)
    expect(mountedChunks.length).toBeLessThan(model.chunks.length)
    expect(mountedChunks.length).toBeLessThanOrEqual(8)
  })

  it("renders huge code fences as copyable virtualized hostile previews", () => {
    const code = Array.from(
      { length: 460 },
      (_, index) => `console.log(${index + 1})`
    ).join("\n")
    const { container } = render(
      <PretextMarkdownViewer
        controls={false}
        source={markdownSource(["```ts", code, "```"].join("\n"))}
      />
    )
    const fallback = container.querySelector<HTMLElement>(
      "[data-pretext-markdown-hostile-fallback]"
    )

    expect(fallback).toBeTruthy()
    expect(
      fallback?.getAttribute("data-pretext-markdown-hostile-line-count")
    ).toBe("462")
    expect(
      Number(
        fallback?.getAttribute("data-pretext-markdown-hostile-omitted-lines")
      )
    ).toBeGreaterThan(0)
    expect(
      fallback?.getAttribute("data-pretext-markdown-hostile-virtualized")
    ).toBe("")
    expect(
      Number(
        fallback?.getAttribute("data-pretext-markdown-hostile-mounted-lines")
      )
    ).toBeLessThan(120)
    expect(
      container.querySelector('[data-pretext-markdown-hostile-line="1"]')
    ).toBeTruthy()
    expect(
      container.querySelector('[data-pretext-markdown-hostile-line="260"]')
    ).toBeNull()

    const preview = screen.getByRole("region", {
      name: "Large Markdown source preview",
    })
    preview.scrollTop = 260 * 24
    fireEvent.scroll(preview)

    expect(
      container.querySelector('[data-pretext-markdown-hostile-line="260"]')
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Copy large Markdown block source" })
    ).toBeTruthy()
  })

  it("renders huge GFM tables as bounded hostile previews instead of mounting every cell", () => {
    const header = "| " + ["A", "B", "C", "D", "E", "F"].join(" | ") + " |"
    const divider =
      "| " + Array.from({ length: 6 }, () => "---").join(" | ") + " |"
    const rows = Array.from({ length: 360 }, (_, rowIndex) => {
      const cells = Array.from(
        { length: 6 },
        (_, columnIndex) => `r${rowIndex + 1}c${columnIndex + 1}`
      )
      return "| " + cells.join(" | ") + " |"
    })
    const markdown = [header, divider, ...rows].join("\n")
    const model = createPretextMarkdownGreenfieldDocument(markdown)
    const { container } = render(
      <PretextMarkdownViewer
        controls={false}
        source={markdownSource(markdown)}
      />
    )
    const fallback = container.querySelector<HTMLElement>(
      "[data-pretext-markdown-hostile-fallback]"
    )

    expect(model.blocks).toHaveLength(1)
    expect(model.blocks[0]?.kind).toBe("table")
    expect(model.blocks[0]?.isHostile).toBe(true)
    expect(fallback).toBeTruthy()
    expect(container.querySelector("[data-pretext-markdown-table]")).toBeNull()
    expect(
      Number(
        fallback?.getAttribute("data-pretext-markdown-hostile-mounted-lines")
      )
    ).toBeLessThan(120)
    expect(
      screen.getByRole("button", { name: "Copy large Markdown block source" })
    ).toBeTruthy()
  })

  it("renders deeply nested raw HTML as a bounded hostile preview", () => {
    const nestedOpen = Array.from(
      { length: 96 },
      (_, index) => `<div id="layer-${index + 1}">`
    ).join("")
    const nestedClose = "</div>".repeat(96)
    const markdown = `${nestedOpen}Deep content${nestedClose}`
    const model = createPretextMarkdownGreenfieldDocument(markdown)
    const { container } = render(
      <PretextMarkdownViewer
        controls={false}
        source={markdownSource(markdown)}
      />
    )

    expect(model.blocks).toHaveLength(1)
    expect(model.blocks[0]?.kind).toBe("html")
    expect(model.blocks[0]?.isHostile).toBe(true)
    expect(
      container.querySelector("[data-pretext-markdown-hostile-fallback]")
    ).toBeTruthy()
    expect(container.querySelector("#user-content-layer-96")).toBeNull()
  })

  it("keys measured heights by scale-sensitive layout identity", async () => {
    const { container } = render(
      <PretextMarkdownViewer
        source={markdownSource(
          [
            "# Measured Layout",
            "",
            "This paragraph is long enough to produce a mounted virtual chunk with a measurable rendered frame.",
          ].join("\n")
        )}
      />
    )
    const firstKey = container
      .querySelector("[data-pretext-measured-height-key]")
      ?.getAttribute("data-pretext-measured-height-key")

    expect(firstKey).toContain(":1.0000:")

    fireEvent.click(screen.getByLabelText("Zoom in"))

    await waitFor(() => {
      const nextKey = container
        .querySelector("[data-pretext-measured-height-key]")
        ?.getAttribute("data-pretext-measured-height-key")

      expect(nextKey).toContain(":1.2000:")
      expect(nextKey).not.toBe(firstKey)
    })
  })
})
