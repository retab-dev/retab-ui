import { describe, expect, it } from "vitest"

import {
  createMarkdownBlob,
  normalizeMarkdownFileName,
} from "@/components/viewers/page-markdown/page-markdown-actions"

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
})
