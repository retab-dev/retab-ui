import { describe, expect, it } from "vitest"

import {
  createPretextMarkdownSanitizeSchema,
  PRETEXT_MARKDOWN_KATEX_OPTIONS,
  PRETEXT_MARKDOWN_SVG_SANITIZE_OPTIONS,
  sanitizePretextMarkdownImageUrl,
  sanitizePretextMarkdownMediaUrl,
  sanitizePretextMarkdownSvg,
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
    expect(schema.tagNames).toContain("ins")
    expect(schema.tagNames).toContain("kbd")
    expect(schema.tagNames).toContain("mark")
    expect(schema.tagNames).toContain("q")
    expect(schema.tagNames).toContain("samp")
    expect(schema.tagNames).toContain("sub")
    expect(schema.tagNames).toContain("sup")
    expect(schema.tagNames).toContain("var")
    expect(schema.tagNames).not.toContain("script")
    expect(schema.tagNames).not.toContain("style")
    expect(schema.tagNames).not.toContain("iframe")
    expect(schema.tagNames).not.toContain("object")
    expect(schema.tagNames).not.toContain("embed")
    expect(schema.tagNames).not.toContain("form")
    expect(schema.tagNames).not.toContain("svg")
    expect(schema.clobberPrefix).toBe("user-content-")
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
    expect(sanitizePretextMarkdownImageUrl("/icons/logo.svg")).toBe("")
    expect(
      sanitizePretextMarkdownImageUrl("https://retab.com/icons/logo.svg?raw=1")
    ).toBe("")
    expect(sanitizePretextMarkdownImageUrl("/icons/logo.svgz")).toBe("")
    expect(sanitizePretextMarkdownImageUrl("data:image/png;base64,AAAA")).toBe(
      ""
    )
    expect(sanitizePretextMarkdownImageUrl("blob:https://retab.com/id")).toBe(
      ""
    )
  })

  it("uses the same safe destination policy for media components", () => {
    expect(sanitizePretextMarkdownMediaUrl("/demo.mp4")).toBe("/demo.mp4")
    expect(sanitizePretextMarkdownMediaUrl("https://retab.com/demo.webm")).toBe(
      "https://retab.com/demo.webm"
    )
    expect(sanitizePretextMarkdownMediaUrl("mailto:hello@retab.com")).toBe("")
    expect(sanitizePretextMarkdownMediaUrl("javascript:alert(1)")).toBe("")
    expect(sanitizePretextMarkdownMediaUrl("//example.com/demo.mp4")).toBe("")
    expect(sanitizePretextMarkdownMediaUrl("/demo.svg")).toBe("")
    expect(sanitizePretextMarkdownMediaUrl("data:video/mp4;base64,AAAA")).toBe(
      ""
    )
    expect(sanitizePretextMarkdownMediaUrl("blob:https://retab.com/id")).toBe(
      ""
    )
  })

  it("normalizes Mermaid SVG through the viewer sanitizer contract", () => {
    const calls: Array<unknown> = []
    const sanitizer = {
      sanitize: (source: string, options: unknown) => {
        calls.push(options)
        expect(source).toContain("<script")
        return '<svg role="img"><text>Safe</text></svg>'
      },
    }

    expect(sanitizePretextMarkdownSvg("<svg><script /></svg>", sanitizer)).toBe(
      '<svg role="img"><text>Safe</text></svg>'
    )
    expect(calls).toEqual([PRETEXT_MARKDOWN_SVG_SANITIZE_OPTIONS])
  })

  it("rejects sanitized Mermaid output that is no longer an SVG", () => {
    expect(
      sanitizePretextMarkdownSvg("<svg></svg>", {
        sanitize: () => "<span>not svg</span>",
      })
    ).toBe("")
  })

  it("keeps KaTeX rendering locked to untrusted bounded input", () => {
    expect(PRETEXT_MARKDOWN_KATEX_OPTIONS).toEqual({
      maxExpand: 1000,
      maxSize: 10,
      strict: "ignore",
      trust: false,
    })
  })
})
