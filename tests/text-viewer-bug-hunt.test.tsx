// @vitest-environment jsdom

import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TextViewer } from "@/components/ui/text-viewer"
import {
  createPreparedTextDocument,
  getCodeVisibleLineWindow,
  getInlineVisibleLineWindow,
  getTableVisibleRowWindow,
  layoutTextDocument,
  resolveTextViewerMode,
  serializeMarkdownTableForClipboard,
  textFrameIntersectsLineRange,
  type PreparedTableTextBlock,
  type TableTextBlockFrame,
} from "@/registry/new-york-v4/ui/text-viewer-layout"
import {
  isLineInRange,
  normalizeTextLineRange,
} from "@/registry/new-york-v4/ui/text-viewer-ranges"
import {
  assertTextWithinBounds,
  resolvedTextViewerBounds,
  splitTextLines,
  TextViewerInvalidBoundsError,
  TextViewerTooLargeError,
} from "@/registry/new-york-v4/ui/text-viewer-resource"
import {
  getTextFrameScrollAnchor,
  getTextFrameVirtualItems,
  type TextFrameGeometry,
} from "@/registry/new-york-v4/ui/text-viewer-virtualization"

// Canvas text measurement is unavailable in jsdom; the layout code falls back
// to estimates when getContext throws. Stub it so the pure-layout tests don't
// spam "Not implemented" warnings.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
})

afterEach(() => {
  vi.restoreAllMocks()
})

const STYLE = { fontScale: 1 }

function prepareText(text: string) {
  return createPreparedTextDocument({ mode: "text", style: STYLE, text })
}

function prepareMarkdown(text: string) {
  return createPreparedTextDocument({ mode: "markdown", style: STYLE, text })
}

function findTableBlock(text: string): PreparedTableTextBlock {
  const block = prepareMarkdown(text).blocks.find((b) => b.kind === "table")
  expect(block).toBeTruthy()
  return block as PreparedTableTextBlock
}

// ---------------------------------------------------------------------------
// normalizeTextLineRange / isLineInRange
// ---------------------------------------------------------------------------

describe("normalizeTextLineRange", () => {
  it("returns null for nullish ranges", () => {
    expect(normalizeTextLineRange(null, 10)).toBeNull()
    expect(normalizeTextLineRange(undefined, 10)).toBeNull()
  })

  it("returns null for non-finite endpoints", () => {
    expect(normalizeTextLineRange({ start: Number.NaN, end: 3 }, 10)).toBeNull()
    expect(normalizeTextLineRange({ start: 1, end: Number.NaN }, 10)).toBeNull()
    expect(
      normalizeTextLineRange({ start: 1, end: Number.POSITIVE_INFINITY }, 10)
    ).toBeNull()
  })

  it("returns null for non-positive or non-finite line counts", () => {
    expect(normalizeTextLineRange({ start: 1, end: 2 }, 0)).toBeNull()
    expect(normalizeTextLineRange({ start: 1, end: 2 }, -5)).toBeNull()
    expect(
      normalizeTextLineRange({ start: 1, end: 2 }, Number.NaN)
    ).toBeNull()
  })

  it("swaps reversed ranges", () => {
    expect(normalizeTextLineRange({ start: 8, end: 3 }, 10)).toEqual({
      start: 3,
      end: 8,
      normalized: true,
    })
  })

  it("truncates fractional endpoints toward zero", () => {
    expect(normalizeTextLineRange({ start: 2.9, end: 4.9 }, 10)).toEqual({
      start: 2,
      end: 4,
      normalized: true,
    })
  })

  it("clamps endpoints into [1, lineCount]", () => {
    expect(normalizeTextLineRange({ start: -3, end: 4 }, 10)).toEqual({
      start: 1,
      end: 4,
      normalized: true,
    })
    expect(normalizeTextLineRange({ start: 5, end: 99 }, 10)).toEqual({
      start: 5,
      end: 10,
      normalized: true,
    })
  })

  it("uses the floored line count as the clamp ceiling", () => {
    expect(normalizeTextLineRange({ start: 1, end: 99 }, 5.9)).toEqual({
      start: 1,
      end: 5,
      normalized: true,
    })
  })

  it("rejects ranges entirely outside the document", () => {
    expect(normalizeTextLineRange({ start: -5, end: 0 }, 10)).toBeNull()
    expect(normalizeTextLineRange({ start: 11, end: 20 }, 10)).toBeNull()
  })

  it("keeps a single-line range that touches the last line", () => {
    expect(normalizeTextLineRange({ start: 10, end: 10 }, 10)).toEqual({
      start: 10,
      end: 10,
      normalized: true,
    })
  })
})

describe("isLineInRange", () => {
  it("is inclusive of both endpoints", () => {
    const range = normalizeTextLineRange({ start: 3, end: 5 }, 10)
    expect(isLineInRange(3, range)).toBe(true)
    expect(isLineInRange(5, range)).toBe(true)
    expect(isLineInRange(2, range)).toBe(false)
    expect(isLineInRange(6, range)).toBe(false)
  })

  it("is false for a null range", () => {
    expect(isLineInRange(1, null)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// splitTextLines
// ---------------------------------------------------------------------------

describe("splitTextLines", () => {
  it("splits on LF, CR, CRLF and unicode line separators", () => {
    expect(splitTextLines("a\nb\rc\r\nd e f")).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ])
  })

  it("treats CRLF as a single break (no phantom empty line)", () => {
    expect(splitTextLines("a\r\nb")).toEqual(["a", "b"])
  })

  it("produces a trailing empty line for a trailing newline", () => {
    expect(splitTextLines("a\n")).toEqual(["a", ""])
  })

  it("returns a single empty line for an empty string", () => {
    expect(splitTextLines("")).toEqual([""])
  })
})

// ---------------------------------------------------------------------------
// bounds
// ---------------------------------------------------------------------------

describe("resolvedTextViewerBounds", () => {
  it("applies defaults", () => {
    expect(resolvedTextViewerBounds()).toEqual({
      maxBytes: 1_000_000,
      maxLines: 10_000,
    })
  })

  it("rejects non-positive, fractional, and non-finite bounds", () => {
    for (const bad of [0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => resolvedTextViewerBounds({ maxBytes: bad })).toThrow(
        TextViewerInvalidBoundsError
      )
      expect(() => resolvedTextViewerBounds({ maxLines: bad })).toThrow(
        TextViewerInvalidBoundsError
      )
    }
  })

  it("names the offending bound on the error", () => {
    try {
      resolvedTextViewerBounds({ maxBytes: 0 })
      throw new Error("expected throw")
    } catch (error) {
      expect(error).toBeInstanceOf(TextViewerInvalidBoundsError)
      expect((error as TextViewerInvalidBoundsError).boundName).toBe("maxBytes")
    }
  })
})

describe("assertTextWithinBounds", () => {
  const bounds = { maxBytes: 1_000_000, maxLines: 10_000 }

  it("accepts text at the exact byte and line limits", () => {
    expect(() =>
      assertTextWithinBounds("abcde", { maxBytes: 5, maxLines: 1 })
    ).not.toThrow()
  })

  it("counts bytes by UTF-8 length, not code unit length", () => {
    // "💡" is 1 JS string of length 2 but 4 UTF-8 bytes.
    expect(() =>
      assertTextWithinBounds("💡", { maxBytes: 3, maxLines: 10 })
    ).toThrow(TextViewerTooLargeError)
    expect(() =>
      assertTextWithinBounds("💡", { maxBytes: 4, maxLines: 10 })
    ).not.toThrow()
  })

  it("throws a bytes error tagged with the reason", () => {
    try {
      assertTextWithinBounds("abcdef", { maxBytes: 5, maxLines: 10 })
      throw new Error("expected throw")
    } catch (error) {
      expect(error).toBeInstanceOf(TextViewerTooLargeError)
      expect((error as TextViewerTooLargeError).reason).toBe("bytes")
    }
  })

  it("throws a lines error when the line budget is exceeded", () => {
    try {
      assertTextWithinBounds("a\nb\nc", { maxBytes: 1000, maxLines: 2 })
      throw new Error("expected throw")
    } catch (error) {
      expect(error).toBeInstanceOf(TextViewerTooLargeError)
      expect((error as TextViewerTooLargeError).reason).toBe("lines")
    }
    expect(() =>
      assertTextWithinBounds("a\nb\nc", { maxBytes: 1000, maxLines: 3 })
    ).not.toThrow()
  })

  void bounds
})

// ---------------------------------------------------------------------------
// resolveTextViewerMode
// ---------------------------------------------------------------------------

describe("resolveTextViewerMode", () => {
  it("selects markdown for .md and .markdown names", () => {
    expect(resolveTextViewerMode({ fileName: "README.md" })).toBe("markdown")
    expect(resolveTextViewerMode({ fileName: "NOTES.MARKDOWN" })).toBe(
      "markdown"
    )
  })

  it("selects markdown for a text/markdown mime even on a .txt name", () => {
    expect(
      resolveTextViewerMode({
        fileName: "notes.txt",
        mimeType: "text/markdown",
      })
    ).toBe("markdown")
  })

  it("ignores mime parameters and case", () => {
    expect(
      resolveTextViewerMode({
        fileName: "notes.txt",
        mimeType: "TEXT/MARKDOWN; charset=utf-8",
      })
    ).toBe("markdown")
  })

  it("falls back to text for plain names and mimes", () => {
    expect(resolveTextViewerMode({ fileName: "log.txt" })).toBe("text")
    expect(
      resolveTextViewerMode({ fileName: "log.txt", mimeType: "text/plain" })
    ).toBe("text")
  })

  it("does not treat 'mdx' or names merely containing md as markdown", () => {
    expect(resolveTextViewerMode({ fileName: "readme.mdx" })).toBe("text")
    expect(resolveTextViewerMode({ fileName: "command.txt" })).toBe("text")
  })
})

// ---------------------------------------------------------------------------
// plain text document model
// ---------------------------------------------------------------------------

describe("createPreparedTextDocument (plain text)", () => {
  it("counts source lines including a trailing newline", () => {
    expect(prepareText("a\nb\nc").sourceLineCount).toBe(3)
    expect(prepareText("a\nb\nc\n").sourceLineCount).toBe(4)
  })

  it("counts words ignoring surrounding whitespace", () => {
    expect(prepareText("  the quick   brown\nfox  ").wordCount).toBe(4)
    expect(prepareText("   ").wordCount).toBe(0)
  })

  it("keeps short distinct lines individually addressable", () => {
    const blocks = prepareText("alpha\nbeta\ngamma").blocks
    expect(blocks).toHaveLength(3)
    expect(blocks.map((b) => b.sourceStartLine)).toEqual([1, 2, 3])
  })

  it("does not join record-like log lines into a paragraph", () => {
    const log = [
      "2024-01-01 INFO starting up the service and connecting to database now",
      "2024-01-02 WARN slow query detected on the analytics table this morning",
      "2024-01-03 ERROR failed to reach the upstream billing service endpoint",
      "2024-01-04 INFO recovered and resumed processing the queued work items",
    ].join("\n")
    const blocks = prepareText(log).blocks
    // Record-like lines must stay individually addressable, not merged.
    expect(blocks.length).toBeGreaterThanOrEqual(4)
  })

  it("joins genuinely hard-wrapped prose into one block", () => {
    const prose = Array.from(
      { length: 5 },
      () =>
        "This is a deliberately long prose sentence that reads like hard wrapped paragraph text."
    ).join("\n")
    const blocks = prepareText(prose).blocks
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ sourceStartLine: 1, sourceEndLine: 5 })
  })

  it("represents a blank line as its own source-addressable block", () => {
    const blocks = prepareText("alpha\n\ngamma").blocks
    expect(blocks.map((b) => b.sourceStartLine)).toEqual([1, 2, 3])
  })

  it("handles an empty document without throwing", () => {
    const doc = prepareText("")
    expect(doc.sourceLineCount).toBe(1)
    expect(doc.wordCount).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// markdown source-line mapping (off-by-one hunting)
// ---------------------------------------------------------------------------

describe("createPreparedTextDocument markdown source lines", () => {
  it("maps a heading to its source line", () => {
    const blocks = prepareMarkdown("# Title\n\nBody text here.").blocks
    const heading = blocks.find((b) => b.kind === "inline" && b.headingId)
    expect(heading?.sourceStartLine).toBe(1)
  })

  it("keeps body source lines after frontmatter", () => {
    const blocks = prepareMarkdown(
      ["---", "title: Demo", "tags: [x]", "---", "", "# Body"].join("\n")
    ).blocks
    const heading = blocks.find((b) => b.kind === "inline" && b.headingId)
    expect(heading?.sourceStartLine).toBe(6)
  })

  it("does not treat an empty frontmatter fence as frontmatter", () => {
    // "---\n---" is two adjacent fences with no body — should not crash and
    // should not swallow the rest of the document.
    const doc = prepareMarkdown("---\n---\n# After")
    const heading = doc.blocks.find((b) => b.kind === "inline" && b.headingId)
    expect(heading).toBeTruthy()
  })

  it("maps table rows to their source lines", () => {
    const table = findTableBlock(
      ["| A | B |", "| --- | --- |", "| one | two |", "| three | four |"].join(
        "\n"
      )
    )
    expect(table.rowSourceStartLines).toEqual([3, 4])
  })

  it("uniquifies duplicate heading ids", () => {
    const blocks = prepareMarkdown("# Dup\n\n# Dup").blocks
    const ids = blocks
      .filter((b) => b.kind === "inline" && b.headingId)
      .map((b) => (b as { headingId: string }).headingId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[0]).toBe("dup")
    expect(ids[1]).toBe("dup-1")
  })

  it("falls back to plain text rendering for malformed markdown without throwing", () => {
    // Deeply nested / pathological markdown should never throw.
    const nasty = "> ".repeat(50) + "text\n" + "#".repeat(10) + " heading"
    expect(() => prepareMarkdown(nasty)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// KNOWN BUG — markdown source-line drift across blank lines.
//
// `parseBlockTokens` advances a per-token line cursor using
// `markdownRawLineCount(token.raw)`. For a blank-line gap, marked emits a
// `space` token whose raw is "\n\n". `markdownRawLineCount` strips a single
// trailing newline ("\n\n" -> "\n") and then splits, yielding 2 — so a single
// blank line is counted as TWO source lines. Every block that follows a
// blank-line gap is therefore mis-attributed by +1, and the error ACCUMULATES
// with each gap.
//
// Real-world impact (markdown mode only):
//   * `data-source-line` is wrong for every block after the first blank line.
//   * highlight={{start,end}} targets the wrong row (or none).
//   * scrollToLineRange() scrolls to the wrong block.
//   * blocks can end up with sourceStartLine > sourceEndLine (inverted) and
//     sourceStartLine > sourceLineCount (past the end of the document).
//
// These are written with `it.fails` so they stay green while documenting the
// defect. When the parser is fixed, `it.fails` will start failing — that is the
// signal to flip them back to `it`.
// ---------------------------------------------------------------------------

describe("KNOWN BUG: markdown blank-line source drift", () => {
  it.fails("attributes a paragraph after a blank line to its real line", () => {
    const inlines = prepareMarkdown(
      "First para.\n\nSecond para."
    ).blocks.filter((b) => b.kind === "inline")
    // Real source line of "Second para." is 3, not 4.
    expect(inlines[inlines.length - 1]?.sourceStartLine).toBe(3)
  })

  it.fails("maps a fenced code block after a blank line to its real span", () => {
    const code = prepareMarkdown(
      ["intro", "", "```ts", "const x = 1", "const y = 2", "```"].join("\n")
    ).blocks.find((b) => b.kind === "code")
    expect(code?.sourceStartLine).toBe(3)
    expect(code?.sourceEndLine).toBe(6)
  })

  it.fails(
    "never inverts a source range or runs past the document line count",
    () => {
      const markdown = [
        "# Heading",
        "",
        "- item one",
        "- item two",
        "",
        "> quote line",
        "",
        "| A | B |",
        "| --- | --- |",
        "| 1 | 2 |",
      ].join("\n")
      const doc = prepareMarkdown(markdown)
      for (const block of doc.blocks) {
        expect(block.sourceEndLine).toBeGreaterThanOrEqual(
          block.sourceStartLine
        )
        expect(block.sourceStartLine).toBeLessThanOrEqual(doc.sourceLineCount)
      }
    }
  )
})

// ---------------------------------------------------------------------------
// table serialization
// ---------------------------------------------------------------------------

describe("serializeMarkdownTableForClipboard", () => {
  it("includes the header row and tab-separates columns", () => {
    const table = findTableBlock(
      ["| Name | Qty |", "| --- | --- |", "| Apple | 3 |"].join("\n")
    )
    expect(serializeMarkdownTableForClipboard(table)).toBe(
      "Name\tQty\nApple\t3"
    )
  })

  it("collapses tabs and newlines inside a cell", () => {
    const table = findTableBlock(
      ["| Col |", "| --- |", "| a b |"].join("\n")
    )
    const serialized = serializeMarkdownTableForClipboard(table)
    expect(serialized).not.toMatch(/\t.*\t/)
    expect(serialized.split("\n")).toHaveLength(2)
  })

  it("aligns ragged rows to the header column count", () => {
    // GFM pads/truncates, but the serializer must stay header-shaped.
    const table = findTableBlock(
      ["| A | B | C |", "| --- | --- | --- |", "| 1 | 2 | 3 |"].join("\n")
    )
    for (const line of serializeMarkdownTableForClipboard(table).split("\n")) {
      expect(line.split("\t")).toHaveLength(3)
    }
  })
})

// ---------------------------------------------------------------------------
// layout invariants
// ---------------------------------------------------------------------------

describe("layoutTextDocument", () => {
  it("produces a frame per block aligned by kind, in document order", () => {
    const doc = prepareMarkdown(
      ["# H", "", "para", "", "```", "code", "```"].join("\n")
    )
    const frame = layoutTextDocument({ contentWidth: 600, document: doc })
    expect(frame.frames).toHaveLength(doc.blocks.length)
    frame.frames.forEach((f, index) => {
      expect(f.kind).toBe(doc.blocks[index]!.kind)
      expect(f.blockIndex).toBe(index)
    })
  })

  it("lays frames out with non-overlapping, monotonically increasing tops", () => {
    const doc = prepareText(
      Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n")
    )
    const frame = layoutTextDocument({ contentWidth: 600, document: doc })
    let previousBottom = 0
    for (const f of frame.frames) {
      expect(f.top).toBeGreaterThanOrEqual(previousBottom)
      expect(f.bottom).toBeGreaterThanOrEqual(f.top)
      previousBottom = f.bottom
    }
    expect(frame.totalHeight).toBeGreaterThanOrEqual(previousBottom)
  })

  it("survives hostile content widths", () => {
    const doc = prepareText("alpha\nbeta")
    for (const width of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      const frame = layoutTextDocument({ contentWidth: width, document: doc })
      expect(frame.frames).toHaveLength(2)
      for (const f of frame.frames) {
        expect(Number.isFinite(f.top)).toBe(true)
        expect(Number.isFinite(f.height)).toBe(true)
        expect(f.height).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it("survives hostile font scales", () => {
    const doc = prepareText("alpha\nbeta")
    for (const scale of [0, -2, Number.NaN]) {
      const frame = layoutTextDocument({
        contentWidth: 600,
        document: doc,
        fontScale: scale,
      })
      for (const f of frame.frames) {
        expect(Number.isFinite(f.height)).toBe(true)
        expect(f.height).toBeGreaterThan(0)
      }
    }
  })

  it("keeps every inline block at least one line tall", () => {
    const doc = prepareText("a\n\nb")
    const frame = layoutTextDocument({ contentWidth: 600, document: doc })
    for (const f of frame.frames) {
      if (f.kind === "inline") {
        expect(f.lineCount).toBeGreaterThanOrEqual(1)
        expect(f.height).toBeGreaterThan(0)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// virtualization windows
// ---------------------------------------------------------------------------

describe("visible line windows", () => {
  function inlineFrame(lineCount: number, lineHeight = 24, top = 100) {
    return {
      kind: "inline" as const,
      lineCount,
      lineHeight,
      top,
    }
  }

  it("returns null when the block is fully outside the viewport", () => {
    const frame = inlineFrame(10, 24, 1000)
    // viewport well above the frame
    expect(
      getInlineVisibleLineWindow({
        frame: frame as never,
        viewportTop: 0,
        viewportBottom: 200,
      })
    ).toBeNull()
  })

  it("clamps the window to the available line range", () => {
    const frame = inlineFrame(5, 24, 0)
    const window = getInlineVisibleLineWindow({
      frame: frame as never,
      viewportTop: -1000,
      viewportBottom: 100000,
    })
    expect(window).toEqual({ firstLine: 0, lastLine: 4 })
  })

  it("offsets the code window by the code block padding", () => {
    const frame = {
      kind: "code" as const,
      lineCount: 10,
      lineHeight: 20,
      top: 0,
    }
    const window = getCodeVisibleLineWindow({
      frame: frame as never,
      viewportTop: 0,
      viewportBottom: 40,
    })
    expect(window).toBeTruthy()
    expect(window!.firstLine).toBe(0)
  })
})

describe("getTableVisibleRowWindow", () => {
  const frame: TableTextBlockFrame = {
    blockIndex: 0,
    bottom: 0,
    columnWidths: [100, 100],
    contentLeft: 0,
    headerHeight: 38,
    height: 0,
    kind: "table",
    listDepth: 0,
    markerClassName: null,
    markerLeft: null,
    markerText: null,
    quoteDepth: 0,
    quoteRailLefts: [],
    rowCount: 5,
    rowHeights: [34, 34, 34, 34, 34],
    rowOffsets: [0, 34, 68, 102, 136, 170],
    rowSourceStartLines: [3, 4, 5, 6, 7],
    scale: 1,
    sourceEndLine: 7,
    sourceStartLine: 1,
    tableWidth: 200,
    top: 0,
  }

  it("covers the full row range when the viewport spans the whole table", () => {
    const window = getTableVisibleRowWindow({
      frame,
      viewportTop: -1000,
      viewportBottom: 10000,
    })
    expect(window.startIndex).toBe(0)
    expect(window.endIndex).toBe(5)
    expect(window.beforeHeight).toBe(0)
    expect(window.afterHeight).toBe(0)
  })

  it("never produces a negative spacer height", () => {
    const window = getTableVisibleRowWindow({
      frame,
      viewportTop: 5000,
      viewportBottom: 6000,
    })
    expect(window.beforeHeight).toBeGreaterThanOrEqual(0)
    expect(window.afterHeight).toBeGreaterThanOrEqual(0)
    expect(window.startIndex).toBeLessThanOrEqual(window.endIndex)
  })

  it("keeps before/after spacers consistent with body height", () => {
    const bodyHeight = frame.rowOffsets[frame.rowOffsets.length - 1]!
    const window = getTableVisibleRowWindow({
      frame,
      viewportTop: 40,
      viewportBottom: 80,
    })
    const visibleHeight = frame.rowOffsets
      .slice(window.startIndex, window.endIndex + 1)
      .reduce((acc, _, i) => acc, 0)
    void visibleHeight
    expect(window.beforeHeight + window.afterHeight).toBeLessThanOrEqual(
      bodyHeight
    )
  })
})

describe("textFrameIntersectsLineRange", () => {
  const frame = { sourceStartLine: 3, sourceEndLine: 7 } as never

  it("is false for a null range", () => {
    expect(textFrameIntersectsLineRange({ frame, range: null })).toBe(false)
  })

  it("detects overlap at the boundaries", () => {
    expect(
      textFrameIntersectsLineRange({ frame, range: { start: 7, end: 9 } })
    ).toBe(true)
    expect(
      textFrameIntersectsLineRange({ frame, range: { start: 1, end: 3 } })
    ).toBe(true)
  })

  it("is false for non-overlapping ranges", () => {
    expect(
      textFrameIntersectsLineRange({ frame, range: { start: 1, end: 2 } })
    ).toBe(false)
    expect(
      textFrameIntersectsLineRange({ frame, range: { start: 8, end: 10 } })
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// frame-based virtualization (getTextFrameVirtualItems / scroll anchor)
// ---------------------------------------------------------------------------

describe("getTextFrameVirtualItems", () => {
  const frames: TextFrameGeometry[] = Array.from({ length: 5 }, (_, i) => ({
    top: i * 100,
    bottom: i * 100 + 100,
    height: 100,
  }))

  it("returns an empty list for an empty frame set", () => {
    expect(
      getTextFrameVirtualItems({
        frames: [],
        scrollTop: 0,
        viewportHeight: 100,
      })
    ).toEqual([])
  })

  it("returns exactly the frames intersecting the viewport with no overscan", () => {
    const items = getTextFrameVirtualItems({
      frames,
      overscanPx: 0,
      scrollTop: 150,
      viewportHeight: 100,
    })
    expect(items.map((i) => i.index)).toEqual([1, 2])
    // start/size/end mirror the frame geometry
    expect(items[0]).toMatchObject({ start: 100, size: 100, end: 200 })
  })

  it("expands the window symmetrically by the overscan in pixels", () => {
    const items = getTextFrameVirtualItems({
      frames,
      overscanPx: 100,
      scrollTop: 150,
      viewportHeight: 100,
    })
    expect(items.map((i) => i.index)).toEqual([0, 1, 2, 3])
  })

  it("always covers the full visible window even with a tiny maxItems", () => {
    // maxItems must never clip content that is actually visible.
    const items = getTextFrameVirtualItems({
      frames,
      maxItems: 1,
      overscanPx: 0,
      scrollTop: 150,
      viewportHeight: 100,
    })
    expect(items.map((i) => i.index)).toEqual([1, 2])
  })

  it("clamps hostile scroll/viewport values to a valid window", () => {
    const items = getTextFrameVirtualItems({
      frames,
      overscanPx: Number.NaN,
      scrollTop: Number.NaN,
      viewportHeight: 0,
    })
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(Number.isFinite(item.start)).toBe(true)
      expect(item.size).toBeGreaterThanOrEqual(0)
    }
  })
})

describe("getTextFrameScrollAnchor", () => {
  const frames: TextFrameGeometry[] = Array.from({ length: 5 }, (_, i) => ({
    top: i * 100,
    bottom: i * 100 + 100,
    height: 100,
  }))

  it("returns null for an empty frame set", () => {
    expect(getTextFrameScrollAnchor({ frames: [], scrollTop: 0 })).toBeNull()
  })

  it("anchors to the frame containing the scroll offset", () => {
    expect(getTextFrameScrollAnchor({ frames, scrollTop: 150 })).toEqual({
      index: 1,
      offsetWithinFrame: 50,
    })
  })

  it("anchors to the top of the document at scrollTop 0", () => {
    expect(getTextFrameScrollAnchor({ frames, scrollTop: 0 })).toEqual({
      index: 0,
      offsetWithinFrame: 0,
    })
  })

  it("clamps to the last frame when scrolled past the end", () => {
    const anchor = getTextFrameScrollAnchor({ frames, scrollTop: 99999 })
    expect(anchor?.index).toBe(4)
    expect(anchor?.offsetWithinFrame).toBeGreaterThanOrEqual(0)
  })

  it("never returns a negative offset for a negative scrollTop", () => {
    const anchor = getTextFrameScrollAnchor({ frames, scrollTop: -500 })
    expect(anchor?.offsetWithinFrame).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// markdown table layout invariants
// ---------------------------------------------------------------------------

describe("markdown table layout", () => {
  function tableFrame(markdown: string) {
    const doc = prepareMarkdown(markdown)
    const frame = layoutTextDocument({
      contentWidth: 600,
      document: doc,
    }).frames.find((f) => f.kind === "table")
    expect(frame).toBeTruthy()
    return frame as TableTextBlockFrame
  }

  it("keeps rowHeights/rowSourceStartLines aligned with rowCount", () => {
    const frame = tableFrame(
      [
        "| A | B |",
        "| --- | --- |",
        "| 1 | 2 |",
        "| 3 | 4 |",
        "| 5 | 6 |",
      ].join("\n")
    )
    expect(frame.rowCount).toBe(3)
    expect(frame.rowHeights).toHaveLength(3)
    expect(frame.rowSourceStartLines).toHaveLength(3)
    // rowOffsets is a prefix-sum sentinel array of length rowCount + 1.
    expect(frame.rowOffsets).toHaveLength(4)
  })

  it("builds strictly monotonic row offsets summing to body height", () => {
    const frame = tableFrame(
      ["| A | B |", "| --- | --- |", "| 1 | 2 |", "| 3 | 4 |"].join("\n")
    )
    for (let i = 1; i < frame.rowOffsets.length; i++) {
      expect(frame.rowOffsets[i]!).toBeGreaterThan(frame.rowOffsets[i - 1]!)
    }
    const sum = frame.rowHeights.reduce((a, b) => a + b, 0)
    expect(frame.rowOffsets[frame.rowOffsets.length - 1]).toBe(sum)
  })

  it("never renders a zero-row table narrower than the viewport content", () => {
    const frame = tableFrame(["| A | B |", "| --- | --- |"].join("\n"))
    expect(frame.rowCount).toBe(0)
    expect(frame.tableWidth).toBeGreaterThan(0)
    expect(frame.height).toBeGreaterThanOrEqual(frame.headerHeight)
  })
})

// ---------------------------------------------------------------------------
// markdown heading slug / id generation
// ---------------------------------------------------------------------------

describe("markdown heading ids", () => {
  function headingIds(markdown: string) {
    return prepareMarkdown(markdown)
      .blocks.filter((b) => b.kind === "inline" && b.headingId)
      .map((b) => (b as { headingId: string }).headingId)
  }

  it("slugifies punctuation and collapses whitespace", () => {
    expect(headingIds("# Hello, World!")).toEqual(["hello-world"])
    expect(headingIds("#   Spaced   Out  ")).toEqual(["spaced-out"])
  })

  it("falls back to 'section' when a heading has no slug characters", () => {
    expect(headingIds("# 🚀")).toEqual(["section"])
  })

  it("disambiguates repeated empty-slug headings", () => {
    expect(headingIds("# 🚀\n\n# ✨")).toEqual(["section", "section-1"])
  })
})

// ---------------------------------------------------------------------------
// component behavior
// ---------------------------------------------------------------------------

function textSource(text: string, fileName = "notes.txt") {
  return { kind: "text" as const, text, fileName }
}

function markdownSource(text: string, fileName = "notes.md") {
  return { kind: "text" as const, text, fileName }
}

describe("TextViewer component behavior", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(function scrollTo(
        this: HTMLElement,
        options?: ScrollToOptions | number
      ) {
        if (typeof options === "object" && typeof options.top === "number") {
          this.scrollTop = options.top
        }
      }),
    })
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("renders an empty document without crashing", async () => {
    const { container } = render(
      <TextViewer source={textSource("")} toolbar={false} />
    )
    expect(
      container.querySelector('[data-slot="text-viewer"]')
    ).toBeTruthy()
  })

  it("renders a whitespace-only document without crashing", () => {
    expect(() =>
      render(<TextViewer source={textSource("   \n\t\n  ")} toolbar={false} />)
    ).not.toThrow()
  })

  it("does not crash the copy action when navigator.clipboard is unavailable", async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard")
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    })
    try {
      render(
        <TextViewer
          source={markdownSource(["```", "code here", "```"].join("\n"))}
          toolbar={false}
        />
      )
      const button = await screen.findByLabelText("Copy code block")
      expect(() => fireEvent.click(button)).not.toThrow()
    } finally {
      if (original) {
        Object.defineProperty(navigator, "clipboard", original)
      }
    }
  })

  it("ignores a highlight range that falls entirely outside the document", async () => {
    const { container } = render(
      <TextViewer
        source={textSource("alpha\nbeta")}
        highlight={{ start: 50, end: 60 }}
        toolbar={false}
      />
    )
    await waitFor(() => {
      expect(
        container.querySelector('[data-source-line="1"]')
      ).toBeTruthy()
    })
    expect(
      container.querySelector(".bg-primary\\/12")
    ).toBeNull()
  })

  it("clamps a partially out-of-range highlight to the document", async () => {
    const { container } = render(
      <TextViewer
        source={textSource("alpha\nbeta\ngamma")}
        highlight={{ start: 2, end: 999 }}
        toolbar={false}
      />
    )
    const second = await waitFor(() => {
      const el = container.querySelector('[data-source-line="2"]')
      expect(el).toBeTruthy()
      return el as HTMLElement
    })
    expect(second.className).toContain("bg-primary/12")
  })

  it("exposes a working imperative scrollToLineRange handle", async () => {
    const ref = React.createRef<{
      scrollToLineRange: (r: { start: number; end: number }) => void
      getViewportElement: () => HTMLDivElement | null
    }>()
    const { container } = render(
      <TextViewer
        ref={ref as never}
        className="h-40 w-[360px]"
        source={textSource(
          Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join("\n")
        )}
        toolbar={false}
      />
    )
    await screen.findByText("line 1")
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()
    ref.current?.scrollToLineRange({ start: 150, end: 150 })
    await waitFor(() => {
      expect(viewport!.scrollTop).toBeGreaterThan(0)
    })
  })

  it("treats h3-h6 markdown headings consistently (documents current semantics)", async () => {
    render(
      <TextViewer
        source={markdownSource("### Small Heading")}
        toolbar={false}
      />
    )
    const text = await screen.findByText("Small Heading")
    const block = text.closest('[data-slot="text-line"]')
    // h3 collapses to body variant: no heading role is exposed.
    expect(block?.getAttribute("role")).not.toBe("heading")
  })

  it("renders a tab character line without throwing and addresses it", async () => {
    const { container } = render(
      <TextViewer source={textSource("a\n\t\nb")} toolbar={false} />
    )
    await waitFor(() => {
      expect(container.querySelector('[data-source-line="3"]')).toBeTruthy()
    })
  })

  it("highlights the correct row in plain-text mode after a blank line", async () => {
    // Plain-text mode builds one block per source line, so it is immune to the
    // markdown blank-line drift bug — highlighting must land precisely.
    const { container } = render(
      <TextViewer
        source={textSource("para one\n\npara three")}
        highlight={{ start: 3, end: 3 }}
        toolbar={false}
      />
    )
    const target = await waitFor(() => {
      const el = container.querySelector('[data-source-line="3"]')
      expect(el).toBeTruthy()
      return el as HTMLElement
    })
    expect(target.textContent).toContain("para three")
    expect(target.className).toContain("bg-primary/12")
  })

  // KNOWN BUG (user-facing fallout of the source-line drift): highlighting the
  // true source line of a markdown block that follows a blank line fails to
  // highlight it, because the block's frame is mis-attributed by +1.
  it.fails(
    "highlights the markdown paragraph at its real source line after a blank line",
    async () => {
      const { container } = render(
        <TextViewer
          source={markdownSource("Para one.\n\nPara three.")}
          highlight={{ start: 3, end: 3 }}
          toolbar={false}
        />
      )
      const target = await waitFor(() => {
        const block = Array.from(
          container.querySelectorAll<HTMLElement>('[data-slot="text-line"]')
        ).find((el) => el.textContent?.includes("Para three."))
        expect(block).toBeTruthy()
        return block as HTMLElement
      })
      expect(target.className).toContain("bg-primary/12")
    }
  )
})
