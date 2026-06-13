// Bug-hunting suite for the Markdown document viewer's pure logic
// (model / layout / virtualizer). End-to-end component behavior is covered by
// markdown-document-viewer.test.tsx; this file targets the deterministic units
// underneath it, where subtle correctness bugs hide.
//
// These cases pin correct behavior so they act as regression guards for the
// perf refactor on this branch. See the summary at the bottom of this file.

import { describe, expect, it } from "vitest"

import {
  clampMarkdownPageHeight,
  createMarkdownLayoutStyle,
  estimateMarkdownBlockHeight,
  isHostileMarkdownBlock,
  MARKDOWN_DOCUMENT_MAX_ESTIMATED_PAGE_HEIGHT,
  MARKDOWN_DOCUMENT_MIN_PAGE_HEIGHT,
} from "@/registry/new-york-v4/ui/markdown-document-layout"
import {
  createMarkdownDocument,
  findMarkdownPageForLine,
  markdownPageIntersectsLineRange,
  serializeMarkdownTableForClipboard,
  type MarkdownDocumentPage,
} from "@/registry/new-york-v4/ui/markdown-document-model"
import {
  createMarkdownVirtualGeometry,
  getMarkdownScrollAnchor,
  getMarkdownVirtualItems,
  scrollTopForMarkdownAnchor,
  topForMarkdownIndex,
} from "@/registry/new-york-v4/ui/markdown-document-virtualizer"

const headingIds = (text: string) =>
  createMarkdownDocument(text)
    .blocks.filter((block) => block.headingId)
    .map((block) => block.headingId!)

const blockShape = (text: string) =>
  createMarkdownDocument(text).blocks.map((block) => ({
    kind: block.kind,
    start: block.blockStartLine,
    end: block.blockEndLine,
  }))

const geometry = (heights: number[]) =>
  createMarkdownVirtualGeometry({
    count: heights.length,
    estimateHeight: (index) => heights[index]!,
    getKey: (index) => `key-${index}`,
    measuredHeights: new Map(),
  })

// The page renderer feeds compact `page.markdown` to react-markdown, then maps
// rendered line positions back to true source lines through the page model.
const rendererSourceLines = (page: MarkdownDocumentPage) =>
  page.blocks.map((block, index) => {
    const prefix =
      page.blocks
        .slice(0, index)
        .map((b) => b.markdown)
        .join("\n\n") + (index > 0 ? "\n\n" : "")
    const lineWithinPage = prefix.length === 0 ? 1 : prefix.split("\n").length
    return (
      page.sourceLineByRenderedLine.get(lineWithinPage) ??
      page.pageStartLine + lineWithinPage - 1
    )
  })

// ---------------------------------------------------------------------------
// Heading ids — slug generation and de-duplication
// ---------------------------------------------------------------------------

describe("markdown model — heading ids", () => {
  it("slugifies headings the way fragment links expect", () => {
    expect(headingIds("# Hello, World!")).toEqual(["hello-world"])
    expect(headingIds("## Café & Crème")).toEqual(["café-crème"])
    expect(headingIds("# 123 Go")).toEqual(["123-go"])
  })

  it("falls back to `section` for headings with no slug-able characters", () => {
    expect(headingIds("# !!!")).toEqual(["section"])
    expect(headingIds(["# !!!", "", "# ???"].join("\n"))).toEqual([
      "section",
      "section-1",
    ])
  })

  it("disambiguates repeated identical headings", () => {
    expect(
      headingIds(["# Intro", "", "# Intro", "", "# Intro"].join("\n"))
    ).toEqual(["intro", "intro-1", "intro-2"])
  })

  it("produces collision-free ids when a natural slug clashes with a de-dup suffix", () => {
    // Regression guard: `# Section` twice yields `section` then `section-1`,
    // and `# Section 1` *naturally* slugifies to `section-1`. createHeadingId
    // must keep bumping (`section-1-1`) so no two headings share a DOM id —
    // otherwise the HTML is invalid and `#section-1` jumps to the wrong heading.
    const ids = headingIds(
      ["# Section", "", "# Section", "", "# Section 1"].join("\n")
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("maps heading ids to their source line", () => {
    const document = createMarkdownDocument(
      ["# A", "", "text", "", "## B"].join("\n")
    )
    expect(document.headingIdsByLine.get(1)).toBe("a")
    expect(document.headingIdsByLine.get(5)).toBe("b")
  })
})

// ---------------------------------------------------------------------------
// Source-line attribution — drives highlight + scroll-to-line + data-source-line
// ---------------------------------------------------------------------------

describe("markdown model — source line attribution", () => {
  it("tracks lines across blank gaps", () => {
    expect(
      blockShape(["# Title", "", "Paragraph one", "", "Second"].join("\n"))
    ).toEqual([
      { kind: "heading", start: 1, end: 1 },
      { kind: "paragraph", start: 3, end: 3 },
      { kind: "paragraph", start: 5, end: 5 },
    ])
  })

  it("spans multi-line blocks (code, lists, blockquotes)", () => {
    expect(
      blockShape(["# H", "", "```", "a", "b", "```", "", "after"].join("\n"))
    ).toEqual([
      { kind: "heading", start: 1, end: 1 },
      { kind: "code", start: 3, end: 6 },
      { kind: "paragraph", start: 8, end: 8 },
    ])
    expect(blockShape(["- a", "- b", "- c", "", "after"].join("\n"))).toEqual([
      { kind: "list", start: 1, end: 3 },
      { kind: "paragraph", start: 5, end: 5 },
    ])
    expect(blockShape(["> a", "> b", "", "after"].join("\n"))).toEqual([
      { kind: "blockquote", start: 1, end: 2 },
      { kind: "paragraph", start: 4, end: 4 },
    ])
  })

  it("handles CRLF line endings without drifting", () => {
    expect(blockShape(["# H", "", "para"].join("\r\n"))).toEqual([
      { kind: "heading", start: 1, end: 1 },
      { kind: "paragraph", start: 3, end: 3 },
    ])
  })

  it("collapses runs of blank lines correctly", () => {
    expect(blockShape("# H\n\n\n\npara\n\n\n")).toEqual([
      { kind: "heading", start: 1, end: 1 },
      { kind: "paragraph", start: 5, end: 5 },
    ])
  })

  it("keeps adjacent headings on their own lines", () => {
    expect(blockShape(["# A", "## B", "", "p"].join("\n"))).toEqual([
      { kind: "heading", start: 1, end: 1 },
      { kind: "heading", start: 2, end: 2 },
      { kind: "paragraph", start: 4, end: 4 },
    ])
  })

  it("keeps rendered source lines aligned with true source lines (single-blank gaps)", () => {
    // When blocks are separated by exactly one blank line, the reconstructed
    // page.markdown matches the original spacing, so attribution is exact.
    const document = createMarkdownDocument(
      ["# First", "", "Paragraph", "", "## Second"].join("\n")
    )
    const page = document.pages[0]!
    expect(rendererSourceLines(page)).toEqual(
      page.blocks.map((block) => block.blockStartLine)
    )
  })

  it("keeps rendered source lines aligned with true source lines across wide gaps", () => {
    // page.markdown stays compact for render performance, but the page model
    // preserves the original source line for each rendered markdown line.
    const document = createMarkdownDocument(
      ["# First", "", "", "", "Paragraph", "", "", "## Second"].join("\n")
    )
    const page = document.pages[0]!
    expect(rendererSourceLines(page)).toEqual(
      page.blocks.map((block) => block.blockStartLine)
    )
  })
})

// ---------------------------------------------------------------------------
// YAML frontmatter
// ---------------------------------------------------------------------------

describe("markdown model — frontmatter", () => {
  it("renders frontmatter as an inert yaml code block and offsets the body", () => {
    const document = createMarkdownDocument(
      ["---", "title: Demo", "tags: [a]", "---", "", "# Body"].join("\n")
    )
    expect(document.blocks[0]).toMatchObject({
      kind: "code",
      blockStartLine: 1,
      blockEndLine: 4,
    })
    expect(document.blocks[0]?.markdown).toContain("```yaml")
    expect(document.headingIdsByLine.get(6)).toBe("body")
  })

  it("handles frontmatter at end-of-file with no trailing newline", () => {
    const document = createMarkdownDocument(["---", "a: 1", "---"].join("\n"))
    expect(document.blocks).toHaveLength(1)
    expect(document.blocks[0]).toMatchObject({
      kind: "code",
      blockStartLine: 1,
    })
  })

  it("offsets the body heading correctly with no blank line after frontmatter", () => {
    const document = createMarkdownDocument(
      ["---", "a: 1", "---", "# Body"].join("\n")
    )
    expect(document.headingIdsByLine.get(4)).toBe("body")
  })

  it("does not treat a horizontal rule as frontmatter", () => {
    // A leading thematic break is not YAML frontmatter.
    const document = createMarkdownDocument(["---", "", "# After"].join("\n"))
    expect(document.blocks[0]?.kind).not.toBe("code")
  })
})

// ---------------------------------------------------------------------------
// Empty / degenerate documents
// ---------------------------------------------------------------------------

describe("markdown model — degenerate input", () => {
  it("never produces an empty document", () => {
    for (const text of ["", " ", "\n\n\n", "\t"]) {
      const document = createMarkdownDocument(text)
      expect(document.blocks.length).toBeGreaterThan(0)
      expect(document.pages.length).toBeGreaterThan(0)
      expect(document.lineCount).toBeGreaterThanOrEqual(1)
    }
  })

  it("reports word counts", () => {
    expect(createMarkdownDocument("one two three").wordCount).toBe(3)
    expect(createMarkdownDocument("").wordCount).toBe(0)
    expect(createMarkdownDocument("   \n   ").wordCount).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe("markdown model — pages", () => {
  it("covers every source line with page bounds (incl. blank gaps)", () => {
    const document = createMarkdownDocument(
      Array.from({ length: 60 }, (_, i) => `## H${i}\n\nBody ${i}`).join("\n\n")
    )
    expect(document.pages.length).toBeGreaterThan(1)
    // First page starts at line 1; pages are monotonic and non-overlapping.
    expect(document.pages[0]!.pageStartLine).toBe(1)
    for (let i = 1; i < document.pages.length; i++) {
      expect(document.pages[i]!.pageStartLine).toBeGreaterThan(
        document.pages[i - 1]!.pageEndLine
      )
    }
  })

  it("isolates hostile blocks onto their own page", () => {
    const document = createMarkdownDocument(
      [
        "Before",
        "",
        "```txt",
        ...Array.from({ length: 401 }, (_, i) => `line ${i}`),
        "```",
        "",
        "After",
      ].join("\n")
    )
    const hostilePage = document.pages.find((page) =>
      page.blocks.some((block) => block.isHostile)
    )
    expect(hostilePage?.blocks).toHaveLength(1)
  })

  it("finds the owning page for any in-range line", () => {
    const document = createMarkdownDocument(
      Array.from({ length: 40 }, (_, i) => `Paragraph ${i}`).join("\n\n")
    )
    const page = document.pages[0]!
    expect(findMarkdownPageForLine(document.pages, page.pageStartLine)).toBe(
      page
    )
    expect(findMarkdownPageForLine(document.pages, page.pageEndLine)).toBe(page)
    expect(findMarkdownPageForLine(document.pages, 100000)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Range intersection (highlight ring)
// ---------------------------------------------------------------------------

describe("markdown model — line-range intersection", () => {
  const page = { pageStartLine: 5, pageEndLine: 10 } as MarkdownDocumentPage

  it("returns false for a null range", () => {
    expect(markdownPageIntersectsLineRange({ page, range: null })).toBe(false)
  })

  it("detects overlap inclusively at both edges", () => {
    expect(
      markdownPageIntersectsLineRange({ page, range: { start: 1, end: 4 } })
    ).toBe(false)
    expect(
      markdownPageIntersectsLineRange({ page, range: { start: 1, end: 5 } })
    ).toBe(true)
    expect(
      markdownPageIntersectsLineRange({ page, range: { start: 10, end: 12 } })
    ).toBe(true)
    expect(
      markdownPageIntersectsLineRange({ page, range: { start: 11, end: 12 } })
    ).toBe(false)
    expect(
      markdownPageIntersectsLineRange({ page, range: { start: 1, end: 99 } })
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Table clipboard serialization
// ---------------------------------------------------------------------------

describe("markdown model — table clipboard", () => {
  it("serializes a GFM table to TSV", () => {
    expect(
      serializeMarkdownTableForClipboard(
        [
          "| Name | Amount |",
          "| --- | ---: |",
          "| Alpha | 1 |",
          "| Beta | 2 |",
        ].join("\n")
      )
    ).toBe(["Name\tAmount", "Alpha\t1", "Beta\t2"].join("\n"))
  })

  it("unescapes escaped pipes inside cells", () => {
    expect(
      serializeMarkdownTableForClipboard(
        ["| A | B |", "| - | - |", "| x \\| y | 2 |"].join("\n")
      )
    ).toBe(["A\tB", "x | y\t2"].join("\n"))
  })

  it("falls back to trimmed source when there is no table", () => {
    expect(serializeMarkdownTableForClipboard("just text\n")).toBe("just text")
  })

  it("serializes the first table when several are present", () => {
    const tsv = serializeMarkdownTableForClipboard(
      [
        "| A | B |",
        "| - | - |",
        "| 1 | 2 |",
        "",
        "| C | D |",
        "| - | - |",
        "| 3 | 4 |",
      ].join("\n")
    )
    expect(tsv).toBe(["A\tB", "1\t2"].join("\n"))
  })
})

// ---------------------------------------------------------------------------
// Layout estimates
// ---------------------------------------------------------------------------

describe("markdown layout — estimates", () => {
  it("clamps page heights to the configured envelope", () => {
    expect(clampMarkdownPageHeight(-100)).toBe(
      MARKDOWN_DOCUMENT_MIN_PAGE_HEIGHT
    )
    expect(clampMarkdownPageHeight(10)).toBe(MARKDOWN_DOCUMENT_MIN_PAGE_HEIGHT)
    expect(clampMarkdownPageHeight(99999)).toBe(
      MARKDOWN_DOCUMENT_MAX_ESTIMATED_PAGE_HEIGHT
    )
  })

  it("scales block estimates with zoom", () => {
    const block = {
      kind: "paragraph" as const,
      markdown: "hello world ".repeat(40),
    }
    const small = estimateMarkdownBlockHeight(
      block,
      createMarkdownLayoutStyle({ zoom: 1 })
    )
    const large = estimateMarkdownBlockHeight(
      block,
      createMarkdownLayoutStyle({ zoom: 2 })
    )
    expect(large).toBeGreaterThan(small)
  })

  it("returns a finite positive estimate for every block kind", () => {
    const kinds = [
      "blockquote",
      "callout",
      "code",
      "heading",
      "html",
      "image",
      "list",
      "math",
      "paragraph",
      "rule",
      "table",
    ] as const
    for (const kind of kinds) {
      const height = estimateMarkdownBlockHeight(
        { kind, markdown: "sample\nsample" },
        createMarkdownLayoutStyle()
      )
      expect(Number.isFinite(height)).toBe(true)
      expect(height).toBeGreaterThan(0)
    }
  })

  it("flags only oversized payloads as hostile", () => {
    const lines = (n: number) =>
      Array.from({ length: n }, (_, i) => `l${i}`).join("\n")
    expect(isHostileMarkdownBlock({ kind: "code", markdown: lines(400) })).toBe(
      false
    )
    expect(isHostileMarkdownBlock({ kind: "code", markdown: lines(401) })).toBe(
      true
    )
    expect(
      isHostileMarkdownBlock({
        kind: "paragraph",
        markdown: "x".repeat(20_000),
      })
    ).toBe(false)
    expect(
      isHostileMarkdownBlock({
        kind: "paragraph",
        markdown: "x".repeat(20_001),
      })
    ).toBe(true)
    expect(
      isHostileMarkdownBlock({ kind: "heading", markdown: lines(9999) })
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Virtualizer geometry
// ---------------------------------------------------------------------------

describe("markdown virtualizer", () => {
  it("builds cumulative offsets and total height", () => {
    const g = geometry([100, 200, 300])
    expect(g.offsets).toEqual([0, 100, 300, 600])
    expect(g.totalHeight).toBe(600)
  })

  it("prefers measured heights over estimates", () => {
    const g = createMarkdownVirtualGeometry({
      count: 2,
      estimateHeight: () => 100,
      getKey: (index) => `key-${index}`,
      measuredHeights: new Map([["key-1", 555]]),
    })
    expect(g.heights).toEqual([100, 555])
  })

  it("round-trips scroll anchors within an item", () => {
    const g = geometry([100, 200, 300])
    for (const top of [0, 50, 250, 599]) {
      const anchor = getMarkdownScrollAnchor({ geometry: g, scrollTop: top })!
      expect(scrollTopForMarkdownAnchor({ anchor, geometry: g })).toBe(top)
    }
  })

  it("clamps anchors past the end of content", () => {
    const g = geometry([100, 200, 300])
    const anchor = getMarkdownScrollAnchor({ geometry: g, scrollTop: 100_000 })!
    expect(anchor.index).toBe(2)
    expect(
      scrollTopForMarkdownAnchor({ anchor, geometry: g })
    ).toBeLessThanOrEqual(600)
  })

  it("windows only the visible items plus overscan", () => {
    const g = geometry([100, 100, 100, 100, 100])
    const tight = getMarkdownVirtualItems({
      geometry: g,
      overscanPx: 0,
      scrollTop: 150,
      viewportHeight: 100,
    })
    expect(tight.items.map((i) => i.index)).toEqual([1, 2])

    const padded = getMarkdownVirtualItems({
      geometry: g,
      overscanPx: 100,
      scrollTop: 150,
      viewportHeight: 100,
    })
    expect(padded.items.map((i) => i.index)).toEqual([0, 1, 2, 3])
  })

  it("degrades gracefully on an empty document", () => {
    const g = geometry([])
    expect(getMarkdownScrollAnchor({ geometry: g, scrollTop: 10 })).toBeNull()
    expect(topForMarkdownIndex({ geometry: g, index: 0 })).toBe(0)
    expect(
      getMarkdownVirtualItems({
        geometry: g,
        overscanPx: 0,
        scrollTop: 0,
        viewportHeight: 100,
      })
    ).toEqual({
      items: [],
      totalHeight: 0,
    })
  })

  it("clamps topForMarkdownIndex into range", () => {
    const g = geometry([100, 200, 300])
    expect(topForMarkdownIndex({ geometry: g, index: -5 })).toBe(0)
    expect(topForMarkdownIndex({ geometry: g, index: 99 })).toBe(300)
  })
})

// ---------------------------------------------------------------------------
// FINDINGS
//
// BUG 1 (FIXED during this session) — Duplicate heading ids. createHeadingId
// used to register only the *base* slug, so `# Section` / `# Section` /
// `# Section 1` collided on `section-1`. It now bumps until the candidate id is
// unused (`section / section-1 / section-1-1`); the heading-ids test above is a
// regression guard for that fix. NOTE: the renderer's nextHeadingId fallback
// (markdown-document-renderers.tsx) still keys on the base slug and was not
// updated to match — only a problem when that fallback path is hit, which BUG 2
// makes more likely.
//
// BUG 2 (FIXED during this session) — Source-line drift for rendered elements.
// createMarkdownPages keeps page markdown compact, but now also carries a
// rendered-line -> source-line map. The renderer uses that map for
// data-source-line and highlight rings, so wide blank gaps no longer make later
// blocks steal earlier lines.
//
// Everything else in this file pins behavior that is currently correct and
// serves as a regression guard for the perf refactor on this branch.
// ---------------------------------------------------------------------------
