import { describe, expect, it } from "vitest"

import {
  createPretextMarkdownSanitizeSchema,
  sanitizePretextMarkdownImageUrl,
  sanitizePretextMarkdownMediaUrl,
  sanitizePretextMarkdownUrl,
} from "@/registry/new-york-v4/ui/pretext-markdown-policy"

describe("Pretext Markdown policy", () => {
  it("keeps the raw HTML sanitizer surface narrow", () => {
    const schema = createPretextMarkdownSanitizeSchema()

    expect(schema.tagNames).toContain("caption")
    expect(schema.tagNames).toContain("details")
    expect(schema.tagNames).toContain("dd")
    expect(schema.tagNames).toContain("dl")
    expect(schema.tagNames).toContain("dt")
    expect(schema.tagNames).toContain("kbd")
    expect(schema.tagNames).toContain("mark")
    expect(schema.tagNames).toContain("sub")
    expect(schema.tagNames).toContain("sup")
    expect(schema.tagNames).not.toContain("script")
    expect(schema.tagNames).not.toContain("style")
    expect(schema.tagNames).not.toContain("iframe")
    expect(schema.tagNames).not.toContain("object")
    expect(schema.tagNames).not.toContain("embed")
    expect(schema.tagNames).not.toContain("form")
    expect(schema.tagNames).not.toContain("svg")
    expect(schema.attributes?.["*"]).not.toContain("style")
    expect(schema.attributes?.["*"]).not.toContain("onClick")
    expect(schema.attributes?.["*"]).not.toContain("onclick")
  })

  it("allows supported link destinations", () => {
    expect(sanitizePretextMarkdownUrl("https://retab.com/docs")).toBe(
      "https://retab.com/docs"
    )
    expect(sanitizePretextMarkdownUrl("http://retab.com/docs")).toBe(
      "http://retab.com/docs"
    )
    expect(sanitizePretextMarkdownUrl("mailto:hello@retab.com")).toBe(
      "mailto:hello@retab.com"
    )
    expect(sanitizePretextMarkdownUrl("#heading")).toBe("#heading")
    expect(sanitizePretextMarkdownUrl("/docs/viewers")).toBe("/docs/viewers")
    expect(sanitizePretextMarkdownUrl("docs/viewers")).toBe("docs/viewers")
  })

  it("blocks unsafe link destinations", () => {
    const blockedUrls = [
      "",
      "//example.com/path",
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "javascript%3Aalert(1)",
      "%6a%61vascript:alert(1)",
      "java\u0000script:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
    ]

    for (const url of blockedUrls) {
      expect(sanitizePretextMarkdownUrl(url)).toBe("")
    }
  })

  it("blocks unsafe image destinations", () => {
    expect(sanitizePretextMarkdownImageUrl("/image.png")).toBe("/image.png")
    expect(sanitizePretextMarkdownImageUrl("https://retab.com/image.png")).toBe(
      "https://retab.com/image.png"
    )
    expect(sanitizePretextMarkdownImageUrl("#image")).toBe("")
    expect(sanitizePretextMarkdownImageUrl("mailto:hello@retab.com")).toBe("")
    expect(sanitizePretextMarkdownImageUrl("javascript%3Aalert(1)")).toBe("")
    expect(sanitizePretextMarkdownImageUrl("//example.com/image.png")).toBe("")
  })

  it("uses the same safe destination policy for media components", () => {
    expect(sanitizePretextMarkdownMediaUrl("/demo.mp4")).toBe("/demo.mp4")
    expect(sanitizePretextMarkdownMediaUrl("https://retab.com/demo.webm")).toBe(
      "https://retab.com/demo.webm"
    )
    expect(sanitizePretextMarkdownMediaUrl("mailto:hello@retab.com")).toBe("")
    expect(sanitizePretextMarkdownMediaUrl("javascript:alert(1)")).toBe("")
    expect(sanitizePretextMarkdownMediaUrl("//example.com/demo.mp4")).toBe("")
  })
})
