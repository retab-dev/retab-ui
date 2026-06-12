// @vitest-environment jsdom

import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  downloadMarkdownAction,
  MarkdownActionButtons,
  normalizeMarkdownFileName,
} from "@/components/viewers/page-markdown/page-markdown-actions"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("page markdown actions", () => {
  it("creates a lazy markdown download action", async () => {
    const action = downloadMarkdownAction("# Page", "page.pdf")
    const payload = await action.getPayload()

    expect(action).toMatchObject({
      id: "download-markdown",
      label: "Download markdown",
      fileName: "page.md",
      origin: "derived",
    })
    expect(payload).toEqual({
      kind: "text",
      text: "# Page",
      mimeType: "text/markdown;charset=utf-8",
    })
  })

  it("normalizes download file names", () => {
    expect(normalizeMarkdownFileName("parsed.md")).toBe("parsed.md")
    expect(normalizeMarkdownFileName("parsed.markdown")).toBe("parsed.markdown")
    expect(normalizeMarkdownFileName("  parsed.md  ")).toBe("parsed.md")
    expect(normalizeMarkdownFileName("parsed")).toBe("parsed.md")
    expect(normalizeMarkdownFileName("report.pdf")).toBe("report.md")
    expect(normalizeMarkdownFileName("")).toBe("document.md")
    expect(normalizeMarkdownFileName()).toBe("document.md")
  })

  it("reports markdown download failures through the shared download surface", async () => {
    const onDownloadError = vi.fn()
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => {
        throw new Error("blocked")
      }),
    })

    render(
      React.createElement(MarkdownActionButtons, {
        text: "# Page",
        fileName: "page.md",
        onDownloadError,
      })
    )

    fireEvent.click(screen.getByRole("button", { name: "Download markdown" }))

    await waitFor(() =>
      expect(onDownloadError).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "ViewerDownloadError",
          kind: "unsupported",
          actionId: "download-markdown",
        }),
        expect.objectContaining({
          id: "download-markdown",
          fileName: "page.md",
        })
      )
    )
  })
})
