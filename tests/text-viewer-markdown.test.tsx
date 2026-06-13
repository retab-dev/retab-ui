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

function markdownSource(text: string, fileName = "notes.md") {
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
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: vi.fn(() => Promise.resolve()),
    },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("TextViewer Markdown mode", () => {
  it("renders real table structure while mounting only the visible row window", async () => {
    const rows = Array.from(
      { length: 240 },
      (_, index) => `| Row ${index + 1} | ${index + 1} |`
    )
    const markdown = [
      "# Statement",
      "",
      '| [Item](https://example.com/items "Items title") | Amount |',
      "| --- | ---: |",
      ...rows,
    ].join("\n")
    const { container } = render(
      <TextViewer
        className="h-80 w-[420px]"
        source={markdownSource(markdown)}
        toolbar={false}
      />
    )

    expect(
      await screen.findByRole("heading", { name: "Statement" })
    ).toBeTruthy()
    expect(await screen.findByRole("table")).toBeTruthy()
    const itemLink = screen.getByRole("link", { name: "Item" })
    expect(itemLink.closest("th")).toBeTruthy()
    expect(itemLink.getAttribute("title")).toBe("Items title")
    expect(screen.getByRole("columnheader", { name: "Amount" })).toBeTruthy()
    expect(screen.getByText("Row 1")).toBeTruthy()
    expect(container.querySelector("pre")).toBeNull()
    expect(container.querySelectorAll("tbody tr").length).toBeLessThan(80)
  })

  it("renders standalone safe images and keeps unsafe image URLs inert", async () => {
    const { container, rerender } = render(
      <TextViewer
        source={markdownSource("![Diagram](https://example.com/diagram.png)")}
        toolbar={false}
      />
    )

    const image = await screen.findByRole("img", { name: "Diagram" })
    expect(image).toBeInstanceOf(HTMLImageElement)
    expect((image as HTMLElement).getAttribute("data-image-state")).toBe("idle")
    expect((image as HTMLImageElement).src).toBe(
      "https://example.com/diagram.png"
    )
    fireEvent.error(image)
    expect(
      await screen.findByRole("img", { name: "Diagram" })
    ).not.toBeInstanceOf(HTMLImageElement)

    rerender(
      <TextViewer
        source={markdownSource("![Unsafe](javascript:alert('xss'))")}
        toolbar={false}
      />
    )

    const placeholder = await screen.findByRole("img", { name: "Unsafe" })
    expect(placeholder).not.toBeInstanceOf(HTMLImageElement)
    expect(container.querySelector("img")).toBeNull()
  })

  it("renders raw html as inert text or code, never live DOM", async () => {
    const { container } = render(
      <TextViewer
        source={markdownSource(
          [
            "Inline <button onclick=\"alert('xss')\">button</button> text.",
            "",
            "<script>alert('xss')</script>",
          ].join("\n")
        )}
        toolbar={false}
      />
    )

    expect(await screen.findByText(/Inline/)).toBeTruthy()
    expect(container.querySelector("span button")).toBeNull()
    expect(container.querySelector("script")).toBeNull()
    expect(container.querySelector("[onclick]")).toBeNull()
  })

  it("keeps safe markdown links and leaves unsafe protocols inert", async () => {
    const { container } = render(
      <TextViewer
        source={markdownSource(
          [
            "[Retab](https://retab.com)",
            '[Titled](https://example.com "Example title")',
            "[Docs](/docs)",
            "[Mail](mailto:team@example.com)",
            "[Unsafe](javascript:alert('xss'))",
          ].join(" ")
        )}
        toolbar={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Retab" })).toBeTruthy()
    })
    const safeLinks = Array.from(container.querySelectorAll("a"))
    expect(safeLinks.map((link) => link.textContent)).toEqual([
      "Retab",
      "Titled",
      "Docs",
      "Mail",
    ])
    expect(
      screen.getByRole("link", { name: "Titled" }).getAttribute("title")
    ).toBe("Example title")
    for (const link of safeLinks) {
      expect(link.getAttribute("target")).toBe("_blank")
      expect(link.getAttribute("rel")).toBe("noopener noreferrer")
    }
    expect(screen.getByText("Unsafe")).toBeTruthy()
    expect(safeLinks.some((link) => link.textContent === "Unsafe")).toBe(false)
  })

  it("shows fenced code language and copies the code block", async () => {
    render(
      <TextViewer
        source={markdownSource(
          ["```ts", "const answer = 42", "```"].join("\n")
        )}
        toolbar={false}
      />
    )

    expect(await screen.findByText("ts")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Copy code block"))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "const answer = 42"
      )
    })
  })

  it("narrows list item source lines and exposes list item semantics", async () => {
    const { container } = render(
      <TextViewer
        source={markdownSource(
          ["- first", "- second", "  continued"].join("\n")
        )}
        toolbar={false}
      />
    )

    const first = await screen.findByText("first")
    const second = await screen.findByText(/second/)
    const firstBlock = first.closest('[data-slot="text-line"]')
    const secondBlock = second.closest('[data-slot="text-line"]')

    expect(firstBlock?.getAttribute("data-source-line")).toBe("1")
    expect(secondBlock?.getAttribute("data-source-line")).toBe("2")
    expect(firstBlock?.getAttribute("role")).toBe("listitem")
    expect(secondBlock?.getAttribute("data-list-depth")).toBe("1")
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(2)
  })

  it("assigns source lines to visible table rows", async () => {
    const { container } = render(
      <TextViewer
        source={markdownSource(
          ["| A | B |", "| --- | --- |", "| one | two |"].join("\n")
        )}
        toolbar={false}
      />
    )

    expect(await screen.findByRole("table")).toBeTruthy()
    expect(
      container.querySelector("tbody tr[data-source-line='3']")
    ).toBeTruthy()
  })
})
