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

import { TextViewer } from "@/components/ui/text-viewer"
import { createPreparedTextDocument } from "@/registry/new-york-v4/ui/text-viewer-layout"

function textSource(text: string, fileName = "notes.txt") {
  return { kind: "text" as const, text, fileName }
}

function getPublicViewer(container: HTMLElement) {
  const viewer = container.querySelector<HTMLElement>(
    '[data-slot="text-viewer"]'
  )
  expect(viewer).toBeTruthy()
  return viewer as HTMLElement
}

async function findSourceLine(container: HTMLElement, lineNumber: number) {
  return await waitFor(() => {
    const line = container.querySelector<HTMLElement>(
      `[data-source-line="${lineNumber}"]`
    )
    expect(line).toBeTruthy()
    return line as HTMLElement
  })
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

describe("public TextViewer prose cutover", () => {
  it("publishes the prose viewer from components/ui/text-viewer with the text-viewer slot", async () => {
    const { container } = render(
      <TextViewer source={textSource("A prose paragraph.")} controls={false} />
    )

    const viewer = getPublicViewer(container)
    expect(await screen.findByText("A prose paragraph.")).toBeTruthy()
    expect(viewer.querySelector("pre")).toBeNull()
  })

  it("renders source-line data without a visible line-number gutter", async () => {
    const { container } = render(
      <TextViewer source={textSource("alpha\nbeta")} controls={false} />
    )

    const firstLine = await findSourceLine(container, 1)
    const secondLine = await findSourceLine(container, 2)
    expect(firstLine.textContent).toBe("alpha")
    expect(secondLine.textContent).toBe("beta")
    expect(
      Array.from(firstLine.querySelectorAll("*")).some(
        (node) => node.textContent?.trim() === "1"
      )
    ).toBe(false)
    expect(
      Array.from(secondLine.querySelectorAll("*")).some(
        (node) => node.textContent?.trim() === "2"
      )
    ).toBe(false)
  })

  it("wraps long prose inside the viewer instead of creating a horizontal code canvas", async () => {
    const longWord = "unbroken-prose-token-".repeat(20)
    const { container } = render(
      <TextViewer
        className="h-40 w-48"
        source={textSource(longWord)}
        controls={false}
      />
    )

    const viewer = getPublicViewer(container)
    const line = await findSourceLine(container, 1)
    const textElement = line.querySelector<HTMLElement>("span")
    expect(textElement?.textContent).toBe(longWord)
    expect(textElement?.className).toContain("whitespace-pre-wrap")
    expect(textElement?.className).toContain("wrap-break-word")
    expect(viewer.querySelector("pre")).toBeNull()
  })

  it("highlights prose rows by source-line data", async () => {
    const { container } = render(
      <TextViewer
        source={textSource("alpha\nbeta\ngamma")}
        highlight={{ start: 2, end: 2 }}
        controls={false}
      />
    )

    const firstLine = await findSourceLine(container, 1)
    const highlightedLine = await findSourceLine(container, 2)
    const thirdLine = await findSourceLine(container, 3)
    expect(highlightedLine.getAttribute("data-text-highlighted")).toBe("")
    expect(highlightedLine.style.backgroundColor).toBe(
      "color-mix(in oklab, var(--foreground) 8%, var(--background))"
    )
    expect(highlightedLine.style.boxShadow).toBe(
      "inset 2px 0 0 0 var(--primary)"
    )
    expect(firstLine.getAttribute("data-text-highlighted")).toBeNull()
    expect(thirdLine.getAttribute("data-text-highlighted")).toBeNull()
  })

  it("keeps the existing zoom controls on the public prose viewer", async () => {
    render(<TextViewer source={textSource("zoomable prose")} />)

    expect(await screen.findByText("100%")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(await screen.findByText("120%")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Reset zoom"))
    expect(await screen.findByText("100%")).toBeTruthy()
  })

  it("uses custom virtualization for the public viewer", async () => {
    const { container } = render(
      <TextViewer
        source={textSource(
          Array.from({ length: 120 }, (_, index) => `line ${index + 1}`).join(
            "\n"
          )
        )}
        controls={false}
      />
    )

    expect(await screen.findByText("line 1")).toBeTruthy()
    expect(
      container.querySelector('[data-slot="text-virtual-canvas"]')
    ).toBeTruthy()
    expect(
      container.querySelectorAll('[data-slot="text-line"]').length
    ).toBeLessThan(120)
  })

  it("groups hard-wrapped plain text into paragraph blocks", () => {
    const source = Array.from(
      { length: 5 },
      () =>
        "This is a deliberately long prose line that looks like a hard-wrapped paragraph and should flow as one text block."
    ).join("\n")

    const document = createPreparedTextDocument({
      mode: "text",
      style: { fontScale: 1 },
      text: source,
    })

    expect(document.blocks).toHaveLength(1)
    expect(document.blocks[0]).toMatchObject({
      sourceEndLine: 5,
      sourceStartLine: 1,
    })
  })

  it("keeps short plain text lines individually addressable", () => {
    const document = createPreparedTextDocument({
      mode: "text",
      style: { fontScale: 1 },
      text: "alpha\nbeta",
    })

    expect(document.blocks).toHaveLength(2)
    expect(document.blocks[0]).toMatchObject({
      sourceEndLine: 1,
      sourceStartLine: 1,
    })
    expect(document.blocks[1]).toMatchObject({
      sourceEndLine: 2,
      sourceStartLine: 2,
    })
  })
})
