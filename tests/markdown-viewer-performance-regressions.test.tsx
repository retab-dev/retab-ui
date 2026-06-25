// @vitest-environment jsdom

import * as React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarkdownViewer } from "@/components/ui/markdown-viewer";
import { createMarkdownGreenfieldDocument } from "@/registry/new-york-v4/ui/markdown-greenfield-document";
import {
  layoutMarkdownGreenfieldDocument,
  type MarkdownGreenfieldChunkFrame,
} from "@/registry/new-york-v4/ui/markdown-greenfield-layout";
import { MARKDOWN_GREENFIELD_ASYNC_DOCUMENT_MIN_CHARS } from "@/registry/new-york-v4/ui/markdown-greenfield-document-store";
import { getMarkdownGreenfieldVisibleFrames } from "@/registry/new-york-v4/ui/markdown-greenfield-virtualizer";

function markdownSource(text: string, fileName = "performance.md") {
  return {
    kind: "text" as const,
    fileName,
    mimeType: "text/markdown",
    text,
  };
}

function frame(
  id: string,
  index: number,
  top: number,
  height: number,
): MarkdownGreenfieldChunkFrame {
  return {
    bottom: top + height,
    height,
    id,
    index,
    measuredHeight: null,
    sourceEndLine: index + 1,
    sourceStartLine: index + 1,
    top,
  };
}

function sourceLineCount(text: string) {
  return text.split(/\r\n|[\n\r\u2028\u2029]/).length;
}

function maybeSourceLineCount(value: object) {
  return (value as { sourceLineCount?: unknown }).sourceLineCount;
}

function progressiveMarkdown() {
  const paragraph =
    "This paragraph keeps async document creation above the store threshold without making any single Markdown block hostile.";
  return Array.from({ length: 520 }, (_, index) =>
    [
      `## Async Section ${index + 1}`,
      "",
      `${paragraph} Segment ${index + 1}.`,
    ].join("\n"),
  ).join("\n\n");
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(function scrollTo(
      this: HTMLElement,
      options?: ScrollToOptions | number,
    ) {
      if (typeof options === "object" && typeof options.top === "number") {
        this.scrollTop = options.top;
      }
    }),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Markdown viewer performance regressions", () => {
  it("keeps visible frame selection half-open while preserving a focused fallback frame", () => {
    const frames = Array.from({ length: 5 }, (_, index) =>
      frame(`chunk-${index}`, index, index * 100, 100),
    );

    expect(
      getMarkdownGreenfieldVisibleFrames({
        frames,
        overscanPx: 0,
        scrollTop: 100,
        viewportHeight: 200,
      }).map((item) => item.index),
    ).toEqual([1, 2]);
    expect(
      getMarkdownGreenfieldVisibleFrames({
        frames,
        overscanPx: 1,
        scrollTop: 100,
        viewportHeight: 200,
      }).map((item) => item.index),
    ).toEqual([0, 1, 2, 3]);
    expect(
      getMarkdownGreenfieldVisibleFrames({
        frames,
        overscanPx: 0,
        scrollTop: 200,
        viewportHeight: 0,
      }).map((item) => item.index),
    ).toEqual([2]);
  });

  it("renders every line for non-hostile code fences and a bounded preview for hostile ones", () => {
    const smallCodeLines = Array.from(
      { length: 398 },
      (_, index) => `small-line-${index + 1}`,
    );
    const small = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          ["```txt", ...smallCodeLines, "```"].join("\n"),
          "small-code.md",
        )}
      />,
    );

    expect(
      small.container.querySelector("[data-markdown-hostile-fallback]"),
    ).toBeNull();
    expect(small.container.querySelectorAll("[data-line]")).toHaveLength(
      smallCodeLines.length,
    );
    expect(small.container.querySelector("[data-line]")?.textContent).toBe(
      "small-line-1",
    );
    expect(
      Array.from(small.container.querySelectorAll("[data-line]")).at(-1)
        ?.textContent,
    ).toBe("small-line-398");
    small.unmount();

    const hostileCodeLines = Array.from(
      { length: 399 },
      (_, index) => `hostile-line-${index + 1}`,
    );
    const large = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          ["```txt", ...hostileCodeLines, "```"].join("\n"),
          "hostile-code.md",
        )}
      />,
    );
    const fallback = large.container.querySelector<HTMLElement>(
      "[data-markdown-hostile-fallback]",
    );

    expect(fallback).toBeTruthy();
    expect(fallback?.getAttribute("data-markdown-hostile-line-count")).toBe(
      "401",
    );
    expect(
      Number(fallback?.getAttribute("data-markdown-hostile-mounted-lines")),
    ).toBeLessThan(120);
    expect(
      Number(fallback?.getAttribute("data-markdown-hostile-omitted-lines")),
    ).toBeGreaterThan(0);
    expect(large.container.querySelectorAll("[data-line]")).toHaveLength(0);
  });

  it("keeps document, chunk, and rendered source-line metrics aligned", () => {
    const markdown = [
      "# Source Metrics",
      "",
      "Intro paragraph.",
      "",
      "```ts",
      "const one = 1",
      "const two = 2",
      "```",
      "",
      ...Array.from(
        { length: 70 },
        (_, index) => `Paragraph ${index + 1} for chunk source accounting.`,
      ).flatMap((line) => [line, ""]),
      "Final paragraph.",
    ].join("\n");
    const document = createMarkdownGreenfieldDocument(markdown);

    for (const block of document.blocks) {
      if (!block.sourceRange) continue;
      const expectedLineCount =
        block.sourceRange.endLine - block.sourceRange.startLine + 1;
      expect(block.sourceText).toBe(
        markdown.slice(
          block.sourceRange.startOffset,
          block.sourceRange.endOffset,
        ),
      );
      expect(sourceLineCount(block.sourceText)).toBe(expectedLineCount);
      if (maybeSourceLineCount(block) !== undefined) {
        expect(maybeSourceLineCount(block)).toBe(expectedLineCount);
      }
    }

    for (const chunk of document.chunks) {
      if (!chunk.sourceRange) continue;
      const expectedLineCount =
        chunk.sourceRange.endLine - chunk.sourceRange.startLine + 1;
      expect(chunk.sourceStartLine).toBe(chunk.sourceRange.startLine);
      expect(chunk.sourceEndLine).toBe(chunk.sourceRange.endLine);
      expect(chunk.sourceText).toBe(
        markdown.slice(
          chunk.sourceRange.startOffset,
          chunk.sourceRange.endOffset,
        ),
      );
      expect(sourceLineCount(chunk.sourceText)).toBe(expectedLineCount);
      if (maybeSourceLineCount(chunk) !== undefined) {
        expect(maybeSourceLineCount(chunk)).toBe(expectedLineCount);
      }
    }

    const layout = layoutMarkdownGreenfieldDocument({
      contentWidth: 820,
      document,
      fontScale: 1,
    });
    expect(
      layout.chunks.map(({ sourceEndLine, sourceStartLine }) => ({
        sourceEndLine,
        sourceStartLine,
      })),
    ).toEqual(
      document.chunks.map(({ sourceEndLine, sourceStartLine }) => ({
        sourceEndLine,
        sourceStartLine,
      })),
    );

    const { container } = render(
      <MarkdownViewer controls={false} source={markdownSource(markdown)} />,
    );
    const renderedChunks = Array.from(
      container.querySelectorAll<HTMLElement>("[data-markdown-chunk]"),
    );

    expect(renderedChunks.length).toBeGreaterThan(0);
    for (const renderedChunk of renderedChunks) {
      const sourceStartLine = Number(
        renderedChunk.getAttribute("data-source-start-line"),
      );
      const sourceEndLine = Number(
        renderedChunk.getAttribute("data-source-end-line"),
      );
      expect(
        layout.chunks.some(
          (chunk) =>
            chunk.sourceStartLine === sourceStartLine &&
            chunk.sourceEndLine === sourceEndLine,
        ),
      ).toBe(true);
    }
  });

  it("keeps async fallback document creation progressive", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);

    const markdown = progressiveMarkdown();
    expect(markdown.length).toBeGreaterThan(
      MARKDOWN_GREENFIELD_ASYNC_DOCUMENT_MIN_CHARS,
    );
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(markdown, "progressive.md")}
      />,
    );

    expect(
      screen.getByRole("status", { name: "Preparing Markdown document" }),
    ).toBeTruthy();
    expect(container.querySelector("[data-markdown-chunk]")).toBeNull();

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(
      screen.queryByRole("status", { name: "Preparing Markdown document" }),
    ).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Async Section 1" }),
    ).toBeTruthy();
    expect(container.querySelector("[data-markdown-chunk]")).toBeTruthy();
  });
});
