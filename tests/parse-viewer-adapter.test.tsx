// @vitest-environment jsdom

import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ParseViewer } from "@/components/viewers/parse/parse-viewer"

vi.mock("@/components/viewers/page-markdown/page-markdown-viewer", () => ({
  PageMarkdownViewer: ({
    pages,
    text,
    downloadFileName,
    processingLabel,
  }: {
    pages: string[]
    text?: string
    downloadFileName?: string
    processingLabel?: string
  }) => (
    <div>
      <span data-testid="pages">{pages.join("|")}</span>
      <span data-testid="text">{text}</span>
      <span data-testid="download">{downloadFileName}</span>
      <span data-testid="processing">{processingLabel}</span>
    </div>
  ),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("ParseViewer adapter", () => {
  it("maps parse output to page markdown props", () => {
    render(
      <ParseViewer
        result={{
          output: {
            pages: ["# One", "# Two"],
            text: "# One\n\n# Two",
          },
        }}
      />
    )

    expect(screen.getByTestId("pages").textContent).toBe("# One|# Two")
    expect(screen.getByTestId("text").textContent).toBe("# One\n\n# Two")
    expect(screen.getByTestId("download").textContent).toBe("parse-output.md")
    expect(screen.getByTestId("processing").textContent).toBe(
      "Parsing document..."
    )
  })
})
