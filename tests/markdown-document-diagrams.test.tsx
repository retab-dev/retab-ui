// @vitest-environment jsdom

import * as React from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
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
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(() => Promise.resolve()) },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("markdown diagrams", () => {
  it("renders mermaid fences as measured SVG diagram surfaces", async () => {
    const { container } = render(
      <MarkdownDocumentViewer
        controls={false}
        source={markdownSource("```mermaid\ngraph TD\n  A-->B\n```")}
      />
    )

    await screen.findByText("mermaid")
    const diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )

    expect(diagram).toBeTruthy()
    expect(diagram?.textContent).not.toContain("Rendering diagram")
    await waitFor(() =>
      expect(diagram?.dataset.diagramState).toBe("ready")
    )
    expect(diagram?.querySelector("svg")).toBeTruthy()
  })

  it("renders invalid mermaid fences as non-crashing errors", async () => {
    const { container } = render(
      <MarkdownDocumentViewer
        controls={false}
        source={markdownSource("```mermaid\nsequenceDiagram\nA->>B: hi\n```")}
      />
    )

    await screen.findByText("mermaid")
    const diagram = container.querySelector<HTMLElement>(
      '[data-diagram-language="mermaid"]'
    )

    await waitFor(() =>
      expect(diagram?.dataset.diagramState).toBe("failed")
    )
    expect(diagram?.textContent).toContain("Unsupported Mermaid diagram")
  })
})
