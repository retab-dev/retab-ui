// @vitest-environment jsdom

import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { type ParseResponse } from "@/components/viewers/lib/parse-types"
import { type PageMarkdownViewerProps } from "@/components/viewers/page-markdown/page-markdown-types"
import { ParseViewer } from "@/components/viewers/parse/parse-viewer"

const { pageMarkdownViewerMock } = vi.hoisted(() => ({
  pageMarkdownViewerMock: vi.fn(),
}))

vi.mock("@/components/viewers/page-markdown/page-markdown-viewer", () => ({
  PageMarkdownViewerProvider: (
    props: PageMarkdownViewerProps & { children: React.ReactNode }
  ) => {
    pageMarkdownViewerMock(props)

    return (
      <div>
        <span data-testid="pages">{props.pages.join("|")}</span>
        <span data-testid="text">{props.text}</span>
        <span data-testid="download">{props.fileName}</span>
        <span data-testid="processing">{props.processingLabel}</span>
        {props.children}
      </div>
    )
  },
  PageMarkdownViewerHeader: () => <div data-testid="markdown-header" />,
  PageMarkdownViewerContent: () => <div data-testid="markdown-content" />,
  usePageMarkdownViewerDocument: () => ({}),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("ParseViewer adapter", () => {
  function getLastMarkdownProps() {
    return pageMarkdownViewerMock.mock.lastCall?.[0] as PageMarkdownViewerProps
  }

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

    expect(getLastMarkdownProps()).toMatchObject({
      pages: ["# One", "# Two"],
      text: "# One\n\n# Two",
      fileName: "parse-output.md",
      processingLabel: "Parsing document...",
    })
  })

  it("keeps an explicit empty text output instead of falling back to joined pages", () => {
    render(
      <ParseViewer
        result={{
          output: {
            pages: ["# Page with content"],
            text: "",
          },
        }}
      />
    )

    expect(getLastMarkdownProps().text).toBe("")
  })

  it("renders empty markdown state inputs when the parse result is missing", () => {
    render(<ParseViewer result={null} />)

    expect(getLastMarkdownProps()).toMatchObject({
      pages: [],
      text: undefined,
      isProcessing: false,
    })
  })

  it("renders empty markdown state inputs when the parse output is null", () => {
    render(<ParseViewer result={{ output: null }} />)

    expect(getLastMarkdownProps()).toMatchObject({
      pages: [],
      text: undefined,
    })
  })

  it("tolerates partial API output without throwing", () => {
    const partialResult = {
      output: {
        text: "Document text without page chunks",
      },
    } as unknown as ParseResponse

    render(<ParseViewer result={partialResult} />)

    expect(getLastMarkdownProps()).toMatchObject({
      pages: [],
      text: "Document text without page chunks",
    })
  })

  it("forwards processing state and visible page changes", () => {
    const onVisiblePageChange = vi.fn()

    render(
      <ParseViewer
        result={{
          output: {
            pages: ["# One"],
            text: "# One",
          },
        }}
        isProcessing
        onVisiblePageChange={onVisiblePageChange}
      />
    )

    expect(getLastMarkdownProps()).toMatchObject({
      isProcessing: true,
      onVisiblePageChange,
    })
  })

  it("uses the parse document id as the markdown reset key", () => {
    render(
      <ParseViewer
        result={{
          document: { id: "parse-document-id" },
          output: {
            pages: ["# One"],
            text: "# One",
          },
        }}
      />
    )

    expect(getLastMarkdownProps().resetKey).toBe("parse-document-id")
  })
})
