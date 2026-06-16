// @vitest-environment jsdom

import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
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
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("markdown whitelisted components", () => {
  it("renders whitelisted raw component markdown inertly", async () => {
    const { container } = render(
      <MarkdownDocumentViewer
        controls={false}
        source={markdownSource(
          '<Metric label="Accuracy" value="98%" onClick="alert(1)" />'
        )}
      />
    )

    await screen.findByText("Accuracy")
    expect(screen.getByText("98%")).toBeTruthy()
    expect(container.querySelector('[data-component-name="metric"]')).toBeTruthy()
    expect(container.querySelector("[onclick]")).toBeNull()
  })

  it("renders whitelisted directive components", async () => {
    const { container } = render(
      <MarkdownDocumentViewer
        controls={false}
        source={markdownSource('::badge{label="Beta"}')}
      />
    )

    await screen.findByText("Beta")
    expect(container.querySelector('[data-component-name="badge"]')).toBeTruthy()
  })

  it("renders unknown component markdown as an inert unsupported component", async () => {
    const { container } = render(
      <MarkdownDocumentViewer
        controls={false}
        source={markdownSource("<ChartWidget>Revenue</ChartWidget>")}
      />
    )

    await screen.findByText("Unsupported component: chartwidget")
    expect(screen.getByText("Revenue")).toBeTruthy()
    expect(container.querySelector('[data-component-name="unknown"]')).toBeTruthy()
  })
})
