// @vitest-environment jsdom

import * as React from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  SuperfastTextpretext,
  superfastTextpretext,
  type TextViewerHandle,
} from "@/components/ui/superfast-textpretext"

function textSource(text: string, fileName = "notes.txt") {
  return { kind: "text" as const, text, fileName, mimeType: "text/plain" }
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
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 8 }),
  } as CanvasRenderingContext2D)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("SuperfastTextpretext", () => {
  it("exports the requested lower-camel alternate viewer name", () => {
    expect(superfastTextpretext).toBe(SuperfastTextpretext)
  })

  it("renders text through the native chunk canvas", async () => {
    const { container } = render(
      <SuperfastTextpretext
        source={textSource("alpha\nbeta\n\ngamma")}
        toolbar={false}
      />
    )

    expect(
      (
        await screen.findAllByText(
          (_, node) =>
            node?.tagName.toLowerCase() === "p" &&
            node.textContent === "alpha\nbeta"
        )
      )[0]
    ).toBeTruthy()
    expect(
      container.querySelector(
        '[data-slot="superfast-textpretext-virtual-canvas"]'
      )
    ).toBeTruthy()
    expect(
      container.querySelectorAll("[data-superfast-textpretext-chunk]").length
    ).toBe(3)
  })

  it("keeps mounted chunk count bounded for large text", async () => {
    const text = Array.from(
      { length: 1_000 },
      (_, index) => `large line ${index + 1}`
    ).join("\n")
    const { container } = render(
      <SuperfastTextpretext source={textSource(text)} toolbar={false} />
    )

    expect(await screen.findByText(/large line 1/)).toBeTruthy()
    expect(
      container.querySelectorAll("[data-superfast-textpretext-chunk]").length
    ).toBeLessThan(80)
  })

  it("highlights chunks by source-line range", async () => {
    const { container } = render(
      <SuperfastTextpretext
        source={textSource("alpha\n\nbeta\n\ngamma")}
        highlight={{ start: 3, end: 3 }}
        toolbar={false}
      />
    )

    await screen.findByText("beta")
    const highlighted = container.querySelector(
      "[data-superfast-textpretext-highlighted]"
    )
    expect(highlighted).toBeTruthy()
    expect(highlighted?.getAttribute("data-source-start-line")).toBe("3")
    expect(highlighted?.getAttribute("data-source-end-line")).toBe("3")
    expect(highlighted?.getAttribute("data-source-highlight-start")).toBe("3")
    expect(highlighted?.getAttribute("data-source-highlight-end")).toBe("3")
    expect(highlighted?.getAttribute("role")).toBe("region")
    expect(highlighted?.getAttribute("aria-label")).toBe(
      "Highlighted source lines 3 to 3"
    )
  })

  it("renders preformatted chunks with native pre/code markup", async () => {
    const { container } = render(
      <SuperfastTextpretext
        source={textSource("alpha\n\n  indented code")}
        toolbar={false}
      />
    )

    await screen.findByText("indented code")
    const code = container.querySelector("pre code")
    expect(code?.textContent).toBe("  indented code")
  })

  it("exposes the same imperative line-range scroll contract as TextViewer", async () => {
    const ref = React.createRef<TextViewerHandle>()
    render(
      <SuperfastTextpretext
        ref={ref}
        source={textSource(
          Array.from({ length: 300 }, (_, index) => `line ${index + 1}`).join(
            "\n"
          )
        )}
        toolbar={false}
      />
    )

    await screen.findByText(/line 1/)
    ref.current?.scrollToLineRange(
      { start: 240, end: 240 },
      { behavior: "auto" }
    )

    await waitFor(() => {
      expect(ref.current?.getViewportElement()?.scrollTop ?? 0).toBeGreaterThan(
        0
      )
    })
  })

  it("does not repeat highlight autoscroll after chunk measurement updates", async () => {
    const scrollSpy = vi.spyOn(HTMLElement.prototype, "scrollTo")
    render(
      <SuperfastTextpretext
        source={textSource(
          Array.from({ length: 300 }, (_, index) => `line ${index + 1}`).join(
            "\n"
          )
        )}
        highlight={{ start: 220, end: 220 }}
        toolbar={false}
      />
    )

    await screen.findByText(/line 1/)
    await waitFor(() => {
      expect(scrollSpy).toHaveBeenCalledTimes(1)
    })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(scrollSpy).toHaveBeenCalledTimes(1)
  })
})
