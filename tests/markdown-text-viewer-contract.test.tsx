// @vitest-environment jsdom

import { readFileSync } from "node:fs"
import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CodeViewer } from "@/components/ui/code-viewer"
import { FileViewer } from "@/components/ui/file-viewer"
import { TextViewer } from "@/components/ui/text-viewer"
import {
  createPreparedTextDocument,
  layoutTextDocument,
} from "@/registry/new-york-v4/ui/text-viewer-layout"

function textSource(text: string, fileName = "notes.txt", mimeType?: string) {
  return { kind: "text" as const, text, fileName, mimeType }
}

async function findTextLine(container: HTMLElement, sourceLine: number) {
  return await waitFor(() => {
    const line = container.querySelector<HTMLElement>(
      `[data-slot="text-line"][data-source-line="${sourceLine}"]`
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
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 8 }),
  } as CanvasRenderingContext2D)
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

describe("Markdown/Text viewer contract", () => {
  it("routes FileViewer Markdown through PretextMarkdownViewer, not the old HTML markdown document viewer", async () => {
    const fileViewerSource = readFileSync(
      "registry/new-york-v4/ui/file-viewer.tsx",
      "utf8"
    )

    expect(fileViewerSource).toContain(
      'import("@/components/ui/pretext-markdown-viewer")'
    )
    expect(fileViewerSource).toContain("<PretextMarkdownViewer")
    expect(fileViewerSource).not.toContain('mode="markdown"')
    expect(fileViewerSource).not.toContain(
      'import("@/components/ui/markdown-document-viewer")'
    )
    expect(fileViewerSource).not.toContain("MarkdownDocViewer")
    expect(fileViewerSource).not.toContain("MarkdownHtml")
    expect(fileViewerSource).not.toContain("file-viewer-markdown-viewer")

    render(
      <FileViewer
        source={textSource(
          "# Routed Markdown\n\nBody copy",
          "routed.md",
          "text/markdown"
        )}
        bare
      />
    )

    expect(
      await screen.findByRole(
        "heading",
        { name: "Routed Markdown" },
        { timeout: 5_000 }
      )
    ).toBeTruthy()
    expect(document.querySelector('[data-slot="text-viewer"]')).toBeTruthy()
    expect(
      document.querySelector('[data-slot="pretext-markdown-virtual-canvas"]')
    ).toBeTruthy()
    expect(
      document.querySelector('[data-slot="markdown-document-virtual-canvas"]')
    ).toBeNull()
    expect(document.querySelector("[data-line-number]")).toBeNull()
  })

  it("prepares Markdown as semantic Pretext-backed blocks with custom frame virtualization", () => {
    const document = createPreparedTextDocument({
      mode: "markdown",
      style: { fontScale: 1 },
      text: [
        "# Title",
        "",
        "> Quoted **strong** text",
        "",
        "- [x] First item",
        "- Second item",
        "",
        "---",
        "",
        "```ts",
        "const answer = 42",
        "```",
      ].join("\n"),
    })
    const frame = layoutTextDocument({
      contentWidth: 640,
      document,
      fontScale: 1,
    })

    expect(document.mode).toBe("markdown")
    expect(document.blocks.length).toBeGreaterThanOrEqual(6)
    expect(document.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          headingId: "title",
          kind: "inline",
          variant: "heading-1",
        }),
        expect.objectContaining({ kind: "rule" }),
        expect.objectContaining({ kind: "code" }),
      ])
    )
    expect(
      document.blocks.some((block) => block.quoteRailLefts.length > 0)
    ).toBe(true)
    expect(document.blocks.some((block) => block.markerText === "\u2611")).toBe(
      true
    )
    expect(document.blocks.some((block) => block.markerText === "\u2022")).toBe(
      true
    )
    expect(frame.frames).toHaveLength(document.blocks.length)
    expect(frame.totalHeight).toBeGreaterThan(0)
  })

  it("scrolls FileViewer Markdown fragment links through the custom virtualizer", async () => {
    const filler = Array.from(
      { length: 90 },
      (_, index) => `Paragraph ${index}`
    )
    const { container } = render(
      <FileViewer
        source={textSource(
          [
            "[Jump](#target-section)",
            "",
            ...filler,
            "",
            "## Target Section",
          ].join("\n"),
          "fragment.md",
          "text/markdown"
        )}
        bare
      />
    )

    const link = await screen.findByRole(
      "link",
      { name: "Jump" },
      { timeout: 5_000 }
    )
    expect(link.getAttribute("target")).toBeNull()
    expect(link.getAttribute("rel")).toBeNull()
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()

    fireEvent.click(link)
    expect(viewport!.scrollTop).toBeGreaterThan(0)
  })

  it("anchors Pretext Markdown source-mode rows to the source canvas origin", () => {
    const source = readFileSync(
      "registry/new-york-v4/ui/pretext-markdown-viewer-content.tsx",
      "utf8"
    )

    expect(source).toContain(
      '"absolute top-0 right-0 left-0 grid whitespace-pre"'
    )
  })

  it("copies complete FileViewer Markdown tables from the document projection", async () => {
    render(
      <FileViewer
        source={textSource(
          [
            "| Name | Amount |",
            "| --- | ---: |",
            "| Alpha | 1 |",
            "| Beta | 2 |",
          ].join("\n"),
          "table.md",
          "text/markdown"
        )}
        bare
      />
    )

    expect(await screen.findByRole("table")).toBeTruthy()
    const amountHeader = screen.getByRole("columnheader", { name: "Amount" })
    expect(
      screen.getByText("Alpha").closest("tr")?.querySelectorAll("td")[1]
        ?.headers
    ).toBe(amountHeader.id)
    fireEvent.click(screen.getByLabelText("Copy table"))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        ["Name\tAmount", "Alpha\t1", "Beta\t2"].join("\n")
      )
    })
  })

  it("renders safe Markdown without turning raw HTML into live DOM", async () => {
    const { container } = render(
      <TextViewer
        source={textSource(
          [
            "# Safe Markdown",
            "",
            "A [safe link](https://retab.com) and [unsafe link](javascript:alert(1)).",
            "",
            '<script data-testid="xss">alert("xss")</script>',
            '<img src="x" onerror="alert(1)" />',
          ].join("\n"),
          "safe.md",
          "text/markdown"
        )}
        mode="markdown"
        controls={false}
      />
    )

    expect(
      await screen.findByRole("heading", { name: "Safe Markdown" })
    ).toBeTruthy()
    const safeLink = screen.getByRole("link", { name: "safe link" })
    expect(safeLink.getAttribute("href")).toBe("https://retab.com/")
    expect(screen.getByText(/unsafe link/).closest("a")).toBeNull()
    expect(container.querySelector("script")).toBeNull()
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("[onerror]")).toBeNull()
    expect(
      container.querySelector('[data-slot="text-virtual-canvas"]')
    ).toBeTruthy()
  })

  it("keeps TextViewer free of code line numbers while CodeViewer keeps the numbered code surface", async () => {
    const prose = render(
      <TextViewer
        source={textSource("alpha\nbeta", "notes.txt")}
        controls={false}
      />
    )

    const textLine = await findTextLine(prose.container, 1)
    expect(textLine.textContent).toBe("alpha")
    expect(prose.container.querySelector("[data-line-number]")).toBeNull()
    expect(prose.container.querySelector("pre")).toBeNull()

    prose.unmount()

    const code = render(
      <CodeViewer
        source={textSource("alpha\nbeta", "events.log")}
        controls={false}
      />
    )

    expect(code.container.querySelector('[data-line-number="1"]')).toBeTruthy()
    expect(code.container.querySelector('[data-line-number="2"]')).toBeTruthy()
    expect(code.container.querySelector("pre")).toBeTruthy()
  })
})
