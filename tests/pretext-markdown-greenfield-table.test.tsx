// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PretextMarkdownViewer } from "@/components/ui/pretext-markdown-viewer"

function markdownSource(text: string) {
  return {
    kind: "text" as const,
    fileName: "tables.md",
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

describe("pretext markdown greenfield tables", () => {
  it("renders GFM tables with a visible TSV copy control", () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    const { container } = render(
      <PretextMarkdownViewer
        controls={false}
        source={markdownSource(
          [
            "| Name | Qty | Note |",
            "| :--- | --: | :--- |",
            "| Alpha | 2 | **ready** |",
            "| Pipe | 3 | a \\| b |",
          ].join("\n")
        )}
      />
    )

    const region = screen.getByRole("region", { name: "Markdown table" })
    const table = container.querySelector("[data-pretext-markdown-table]")

    expect(region.getAttribute("data-pretext-markdown-table-region")).toBe("")
    expect(table?.getAttribute("aria-colcount")).toBe("3")
    expect(table?.getAttribute("aria-rowcount")).toBe("3")
    expect(
      screen.getByRole("columnheader", { name: "Qty" }).getAttribute("align")
    ).toBe("right")
    expect(
      screen.getByRole("columnheader", { name: "Qty" }).getAttribute("id")
    ).toBe("pretext-markdown-table-1-column-2")
    expect(
      screen.getByRole("cell", { name: "2" }).getAttribute("headers")
    ).toBe("pretext-markdown-table-1-column-2")

    fireEvent.click(screen.getByRole("button", { name: "Copy table as TSV" }))

    expect(writeText).toHaveBeenCalledWith(
      ["Name\tQty\tNote", "Alpha\t2\tready", "Pipe\t3\ta | b"].join("\n")
    )
  })

  it("reserves an inner width floor for wide tables instead of shrinking the page", () => {
    const { container } = render(
      <PretextMarkdownViewer
        controls={false}
        source={markdownSource(
          [
            "| Area | Status | Owner | Risk | Notes |",
            "| :--- | :---: | ---: | ---: | --- |",
            "| Layout | Ready | Platform | Low | Continuous virtual flow. |",
          ].join("\n")
        )}
      />
    )

    const table = container.querySelector<HTMLElement>(
      "[data-pretext-markdown-table]"
    )
    const scroller = container.querySelector<HTMLElement>(
      "[data-pretext-markdown-table-scroll]"
    )
    const region = screen.getByRole("region", { name: "Markdown table" })

    expect(table?.style.minWidth).toBe("800px")
    expect(scroller).toBeTruthy()

    Object.defineProperty(scroller, "clientWidth", {
      configurable: true,
      value: 300,
    })
    Object.defineProperty(scroller, "scrollWidth", {
      configurable: true,
      value: 800,
    })
    fireEvent.keyDown(region, { key: "ArrowRight" })

    expect(scroller?.scrollLeft).toBe(50)
  })
})
