// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createMarkdownBlob,
  downloadMarkdown,
  normalizeMarkdownFileName,
} from "@/components/viewers/page-markdown/page-markdown-actions"

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("page markdown actions", () => {
  it("creates a markdown blob", async () => {
    const blob = createMarkdownBlob("# Page")

    expect(blob.type).toBe("text/markdown;charset=utf-8")
    expect(await blob.text()).toBe("# Page")
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

  it("revokes object URLs when download click throws", () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn(() => "blob:failed-markdown-download")
    const revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("download blocked")
    })
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    })

    expect(() => downloadMarkdown("# Page", "page.md")).toThrow(
      "download blocked"
    )
    expect(document.querySelector('a[download="page.md"]')).toBeNull()

    vi.runOnlyPendingTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith(
      "blob:failed-markdown-download"
    )
  })
})
