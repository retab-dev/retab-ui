// @vitest-environment jsdom

import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { VanillaChengTextViewer } from "@/components/ui/text-viewer-vanillacheng"
import type { TextViewerHandle } from "@/registry/new-york-v4/ui/text-viewer-types"

function textSource(text: string, fileName = "notes.txt") {
  return { kind: "text" as const, fileName, text }
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(function scrollTo(
      this: HTMLElement,
      options?: ScrollToOptions | number
    ) {
      if (typeof options === "object" && typeof options.top === "number") {
        this.scrollTop = options.top
      }
    }),
  })
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("VanillaChengTextViewer parity", () => {
  it("uses the production Pretext projection while keeping its own marker", async () => {
    const { container } = render(
      <VanillaChengTextViewer
        className="h-80 w-[420px]"
        source={textSource(
          [
            "# Statement",
            "",
            '| [Item](https://example.com/items "Items title") | Amount |',
            "| --- | ---: |",
            "| Row 1 | 1 |",
          ].join("\n"),
          "notes.md"
        )}
        controls={false}
      />
    )

    expect(
      await screen.findByRole("heading", { name: "Statement" })
    ).toBeTruthy()
    expect(screen.getByRole("table")).toBeTruthy()
    expect(screen.getByRole("columnheader", { name: "Amount" })).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Item" }).closest("th")
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Item" }).getAttribute("title")
    ).toBe("Items title")
    expect(
      container
        .querySelector('[data-slot="text-virtual-canvas"]')
        ?.getAttribute("data-projection")
    ).toBe("vanillacheng")
  })

  it("honors forced text mode, source lines, and highlights", async () => {
    const { container } = render(
      <VanillaChengTextViewer
        source={textSource("# not a heading\nhighlight me", "notes.md")}
        highlight={{ start: 2, end: 2 }}
        mode="text"
        controls={false}
      />
    )

    expect(await screen.findByText("# not a heading")).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "not a heading" })).toBeNull()

    const highlightedLine = await waitFor(() => {
      const line = container.querySelector<HTMLElement>(
        '[data-source-line="2"]'
      )
      expect(line).toBeTruthy()
      return line as HTMLElement
    })
    expect(highlightedLine.getAttribute("data-text-highlighted")).toBe("")
    expect(highlightedLine.style.backgroundColor).toBe(
      "color-mix(in oklab, var(--foreground) 8%, var(--background))"
    )
    expect(highlightedLine.style.boxShadow).toBe(
      "inset 2px 0 0 0 var(--primary)"
    )
  })

  it("keeps the shared controls and zoom behavior", async () => {
    render(<VanillaChengTextViewer source={textSource("zoomable prose")} />)

    expect(await screen.findByText("100%")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(await screen.findByText("120%")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Reset zoom"))
    expect(await screen.findByText("100%")).toBeTruthy()
  })

  it("implements the TextViewer imperative scroll contract", async () => {
    const viewerRef = React.createRef<TextViewerHandle>()
    const { container } = render(
      <VanillaChengTextViewer
        ref={viewerRef}
        className="h-20 w-[360px]"
        source={textSource(
          Array.from({ length: 80 }, (_, index) => `line ${index + 1}`).join(
            "\n"
          )
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("line 1")).toBeTruthy()
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()

    act(() => {
      viewerRef.current?.scrollToLineRange(
        { end: 70, start: 70 },
        { behavior: "auto" }
      )
    })

    expect(viewport!.scrollTop).toBeGreaterThan(0)
  })
})
