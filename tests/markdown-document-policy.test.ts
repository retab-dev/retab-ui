import { describe, expect, it } from "vitest"

import {
  markdownCalloutKindFromProps,
  markdownCalloutTitleFromProps,
  normalizeMarkdownCalloutKind,
  remarkMarkdownCallouts,
} from "@/registry/new-york-v4/ui/markdown-document-callouts"
import {
  MARKDOWN_DOCUMENT_REHYPE_PLUGINS,
  MARKDOWN_DOCUMENT_REMARK_PLUGINS,
} from "@/registry/new-york-v4/ui/markdown-document-plugins"
import { createMarkdownSanitizeSchema } from "@/registry/new-york-v4/ui/markdown-document-sanitize"
import {
  sanitizeMarkdownImageUrl,
  sanitizeMarkdownUrl,
} from "@/registry/new-york-v4/ui/markdown-document-url-policy"

function pluginName(plugin: unknown) {
  const pluginEntry = Array.isArray(plugin) ? plugin[0] : plugin
  return typeof pluginEntry === "function" ? pluginEntry.name : null
}

describe("markdown document policy", () => {
  it("normalizes callout directives and preserves generated HAST properties", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "containerDirective",
          name: "caution",
          attributes: { title: "Careful" },
        },
      ],
    }

    remarkMarkdownCallouts()(tree)

    expect(tree.children[0]).toMatchObject({
      data: {
        hName: "div",
        hProperties: {
          dataCalloutKind: "caution",
          dataCalloutTitle: "Careful",
        },
      },
    })
    expect(normalizeMarkdownCalloutKind("success")).toBe("tip")
    expect(markdownCalloutKindFromProps({ "data-callout-kind": "error" })).toBe(
      "danger"
    )
    expect(markdownCalloutTitleFromProps({ "data-callout-kind": "tip" })).toBe(
      "Tip"
    )
  })

  it("keeps plugin policy declared once and in the expected order", () => {
    expect(
      MARKDOWN_DOCUMENT_REMARK_PLUGINS?.map((plugin) => pluginName(plugin))
    ).toEqual([
      "remarkGfm",
      "remarkBreaks",
      "remarkMath",
      "remarkDirective",
      "remarkMarkdownCallouts",
      "remarkMarkdownComponents",
      "remarkMarkdownProseTransforms",
    ])
    expect(
      MARKDOWN_DOCUMENT_REHYPE_PLUGINS?.map((plugin) => pluginName(plugin))
    ).toEqual([
      "rehypeRaw",
      "rehypeMarkdownComponents",
      "rehypeSanitize",
      "rehypeKatex",
      "rehypePrettyCode",
    ])
  })

  it("allows only the intended sanitizer surface", () => {
    const schema = createMarkdownSanitizeSchema()

    expect(schema.tagNames).toContain("details")
    expect(schema.tagNames).toContain("mark")
    expect(schema.attributes?.["*"]).toContain("dataCalloutKind")
    expect(schema.attributes?.["*"]).not.toContain("className")
    expect(schema.attributes?.["*"]).not.toContain("style")
    expect(schema.attributes?.figure).not.toContain("className")
    expect(schema.attributes?.pre).not.toContain("className")
    expect(schema.attributes?.span).not.toContain("className")
    expect(schema.attributes?.span).not.toContain("style")
    expect(schema.attributes?.div).toContain("dataCalloutTitle")
  })

  it("sanitizes links and images with distinct policies", () => {
    expect(sanitizeMarkdownUrl("https://retab.com")).toBe("https://retab.com")
    expect(sanitizeMarkdownUrl("mailto:hello@retab.com")).toBe(
      "mailto:hello@retab.com"
    )
    expect(sanitizeMarkdownUrl("#section")).toBe("#section")
    expect(sanitizeMarkdownUrl("javascript:alert(1)")).toBe("")

    expect(sanitizeMarkdownImageUrl("/image.png")).toBe("/image.png")
    expect(sanitizeMarkdownImageUrl("mailto:hello@retab.com")).toBe("")
    expect(sanitizeMarkdownImageUrl("#section")).toBe("")
  })
})
