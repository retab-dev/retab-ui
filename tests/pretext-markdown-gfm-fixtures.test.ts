import { describe, expect, it } from "vitest"

import {
  createPretextMarkdownUnifiedDocument,
  PRETEXT_MARKDOWN_REHYPE_PLUGINS,
  PRETEXT_MARKDOWN_REMARK_PLUGINS,
  type PretextMarkdownUnifiedOptions,
} from "@/registry/new-york-v4/ui/pretext-markdown-unified-pipeline"

type MdastNode = {
  align?: Array<string | null>
  checked?: boolean | null
  children?: MdastNode[]
  title?: string | null
  type: string
  url?: string
  value?: string
}

type FixtureCase = {
  input: string
  name: string
  options?: PretextMarkdownUnifiedOptions
}

// Mirrored from remark-gfm's MIT-licensed fixture names and Markdown inputs:
// /private/tmp/retab-markdown-research/remark-gfm/test/fixtures/**
const UPSTREAM_REMARK_GFM_FIXTURES = {
  autolinkLiteral: {
    name: "autolink-literal",
    input: [
      "# Literal autolinks",
      "",
      "## WWW autolinks",
      "",
      "www.commonmark.org",
      "",
      "WWW.COMMONMARK.ORG",
      "",
      "Visit www.commonmark.org/help for more information.",
      "",
      "Visit www.commonmark.org.",
      "",
      "www.google.com/search?q=Markup+(business)",
      "",
      "www.google.com/search?q=Markup+(business)))",
      "",
      "(www.google.com/search?q=Markup+(business))",
      "",
      "www.commonmark.org/he<lp",
      "",
      "## HTTP autolinks",
      "",
      "http://example.com",
      "",
      "https://example.com",
      "",
      "https://example",
      "",
      "(Visit https://encrypted.google.com/search?q=Markup+(business))",
      "",
      "## Email autolinks",
      "",
      "No dot: foo@barbaz",
      "",
      "foo@bar.baz",
      "",
      "hello@mail+xyz.example isn’t valid, but hello+xyz@mail.example is.",
      "",
      "a.b-c_d@a.b",
      "",
      "a.b-c_d@a.b.",
      "",
      "a.b-c_d@a.b-",
      "",
      "a.b-c_d@a.b_",
      "",
      "a@a_b.c",
      "",
      "a@a-b.c",
      "",
      "Can’t end in an underscore followed by a period: aaa@a.b_.",
      "",
      "Can contain an underscore followed by a period: aaa@a.b_.c",
      "",
      "[https://google.com](https://google.com)",
    ].join("\n"),
  },
  strikethroughDefault: {
    name: "strikethrough-default",
    input: "~one~, ~~two~~, ~~~three~~~.",
  },
  strikethroughNotOne: {
    name: "strikethrough-not-one",
    input: "~one~, ~~two~~, ~~~three~~~.",
    options: { gfm: { singleTilde: false } },
  },
  table: {
    name: "table",
    input: [
      "| a | b | c | d |",
      "| - | :- | -: | :-: |",
      "| e | f |",
      "| g | h | i | j | k |",
    ].join("\n"),
  },
  tableNoAlign: {
    name: "table-no-align",
    input: ["| a | b | c | d |", "| - | :- | -: | :-: |"].join("\n"),
  },
  tableNoPadding: {
    name: "table-no-padding",
    input: ["| a | b | c | d |", "| - | :- | -: | :-: |"].join("\n"),
    options: { gfm: { tableCellPadding: false, tablePipeAlign: false } },
  },
  tableStringLength: {
    name: "table-string-length",
    input: ["| a | 古 | 🤔 |", "| - | - | - |"].join("\n"),
    options: {
      gfm: {
        stringLength: (value) => Array.from(value).length,
      },
    },
  },
  tasklist: {
    name: "tasklist",
    input: ["* [x] done", "* [ ] to do", "* other"].join("\n"),
  },
} satisfies Record<string, FixtureCase>

describe("pretext markdown unified GFM fixtures", () => {
  it("exports the unified plugin policy order", () => {
    expect(PRETEXT_MARKDOWN_REMARK_PLUGINS).toEqual([
      "remark-parse",
      "remark-directive",
      "remark-gfm",
      "remark-breaks",
      "remark-math",
      "remark-gemoji",
      "remark-pretext-markdown-prose-transforms",
      "remark-smartypants",
      "remark-pretext-markdown-github-alerts",
      "remark-pretext-markdown-definition-lists",
      "remark-pretext-markdown-components",
      "remark-pretext-markdown-code-metadata",
    ])
    expect(PRETEXT_MARKDOWN_REHYPE_PLUGINS).toEqual([
      "remark-rehype",
      "rehype-raw",
      "rehype-slug",
      "rehype-sanitize",
      "rehype-pretext-markdown-trusted-metadata",
      "rehype-pretext-markdown-safe-inputs",
      "rehype-katex",
    ])
  })

  it("mirrors upstream autolink literal recognition", () => {
    const document = parseFixture(UPSTREAM_REMARK_GFM_FIXTURES.autolinkLiteral)
    const urls = collectMdastNodes(document.mdast, "link").map(
      (node) => node.url
    )

    expect(urls).toContain("http://www.commonmark.org")
    expect(urls).toContain("http://WWW.COMMONMARK.ORG")
    expect(urls).toContain("http://www.commonmark.org/help")
    expect(urls).toContain("http://www.google.com/search?q=Markup+(business)")
    expect(urls).toContain("https://example.com")
    expect(urls).toContain(
      "https://encrypted.google.com/search?q=Markup+(business)"
    )
    expect(urls).toContain("mailto:foo@bar.baz")
    expect(urls).toContain("mailto:hello+xyz@mail.example")
    expect(urls).toContain("mailto:a.b-c_d@a.b")
    expect(urls).toContain("mailto:a@a-b.c")
    expect(urls).toContain("mailto:a@a_b.c")
    expect(urls).not.toContain("mailto:foo@barbaz")
    expect(urls).not.toContain("mailto:a.b-c_d@a.b-")
    expect(urls).not.toContain("mailto:a.b-c_d@a.b_")
  })

  it("mirrors upstream strikethrough defaults", () => {
    const document = parseFixture(
      UPSTREAM_REMARK_GFM_FIXTURES.strikethroughDefault
    )

    expect(collectDeleteText(document.mdast)).toEqual(["one", "two"])
  })

  it("mirrors upstream singleTilde=false strikethrough behavior", () => {
    const document = parseFixture(
      UPSTREAM_REMARK_GFM_FIXTURES.strikethroughNotOne
    )

    expect(collectDeleteText(document.mdast)).toEqual(["two"])
  })

  it.each([
    UPSTREAM_REMARK_GFM_FIXTURES.table,
    UPSTREAM_REMARK_GFM_FIXTURES.tableNoAlign,
    UPSTREAM_REMARK_GFM_FIXTURES.tableNoPadding,
  ])("mirrors upstream table alignment for $name", (fixture) => {
    const document = parseFixture(fixture)
    const table = collectMdastNodes(document.mdast, "table")[0]
    const renderedTable = findHastElement(document.hast, "table")
    const renderedHeaderCells = collectHastElements(document.hast, "th")

    expect(table?.align).toEqual([null, "left", "right", "center"])
    expect(renderedTable).toBeTruthy()
    expect(renderedHeaderCells.map((cell) => cell.properties?.align)).toEqual([
      undefined,
      "left",
      "right",
      "center",
    ])
  })

  it("mirrors upstream table string-length fixture as table semantics", () => {
    const document = parseFixture(
      UPSTREAM_REMARK_GFM_FIXTURES.tableStringLength
    )
    const table = collectMdastNodes(document.mdast, "table")[0]

    expect(table?.align).toEqual([null, null, null])
    expect(collectText(table).join(" ")).toBe("a 古 🤔")
  })

  it("mirrors upstream task list item state", () => {
    const document = parseFixture(UPSTREAM_REMARK_GFM_FIXTURES.tasklist)
    const items = collectMdastNodes(document.mdast, "listItem")
    const checkboxes = collectHastElements(document.hast, "input")

    expect(items.map((item) => item.checked ?? null)).toEqual([
      true,
      false,
      null,
    ])
    expect(
      checkboxes.map((input) => input.properties?.checked === true)
    ).toEqual([true, false])
  })

  it("returns recoverable unified messages for component fallbacks", () => {
    const document = createPretextMarkdownUnifiedDocument(
      '<Metric label="Accuracy" value="99%" onClick="steal" />'
    )

    expect(document.messages).toEqual([
      expect.objectContaining({
        fatal: false,
        line: 1,
        reason: "Event handler props are not supported",
        ruleId: "component-fallback",
        source: "pretext-markdown",
      }),
    ])
  })
})

function parseFixture(fixture: FixtureCase) {
  return createPretextMarkdownUnifiedDocument(fixture.input, fixture.options)
}

function collectMdastNodes(node: MdastNode, type: string): MdastNode[] {
  return [
    ...(node.type === type ? [node] : []),
    ...(node.children ?? []).flatMap((child) => collectMdastNodes(child, type)),
  ]
}

function collectDeleteText(node: MdastNode) {
  return collectMdastNodes(node, "delete").map((deleteNode) =>
    collectText(deleteNode).join("")
  )
}

function collectText(node: MdastNode | undefined): string[] {
  if (!node) return []
  return [
    typeof node.value === "string" ? node.value : "",
    ...(node.children ?? []).flatMap(collectText),
  ].filter(Boolean)
}

function collectHastElements(
  node: {
    children?: Array<any>
    tagName?: string
    type: string
  },
  tagName: string
): Array<{ properties?: Record<string, unknown>; tagName: string }> {
  return [
    node.type === "element" && node.tagName === tagName
      ? (node as { properties?: Record<string, unknown>; tagName: string })
      : null,
    ...(node.children ?? []).flatMap((child) =>
      collectHastElements(child, tagName)
    ),
  ].filter(
    (
      element
    ): element is { properties?: Record<string, unknown>; tagName: string } =>
      Boolean(element)
  )
}

function findHastElement(
  node: {
    children?: Array<any>
    tagName?: string
    type: string
  },
  tagName: string
) {
  return collectHastElements(node, tagName)[0] ?? null
}
