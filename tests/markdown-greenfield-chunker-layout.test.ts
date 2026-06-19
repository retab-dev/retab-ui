import { describe, expect, it } from "vitest";

import {
  createMarkdownGreenfieldDocument,
  findMarkdownGreenfieldChunkByBlockId,
} from "@/registry/new-york-v4/ui/markdown-greenfield-document";
import {
  layoutMarkdownGreenfieldDocument,
  type MarkdownGreenfieldChunkFrame,
} from "@/registry/new-york-v4/ui/markdown-greenfield-layout";
import { getMarkdownGreenfieldVisibleFrames } from "@/registry/new-york-v4/ui/markdown-greenfield-virtualizer";

function totalHeight(markdown: string, contentWidth = 820, fontScale = 1) {
  return layoutMarkdownGreenfieldDocument({
    contentWidth,
    document: createMarkdownGreenfieldDocument(markdown),
    fontScale,
  }).totalHeight;
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

describe("pretext markdown greenfield chunker", () => {
  it("starts a new chunk on a heading near the target size so it stays with following content", () => {
    // One hard-wrapped paragraph spanning enough source lines to push the next
    // heading past the chunk target, so the heading opens a fresh chunk.
    const wrappedParagraph = Array.from(
      { length: 50 },
      () => "Wrapped sentence inside a single paragraph block.",
    ).join("\n");
    const markdown = [
      wrappedParagraph,
      "",
      "## Section Heading",
      "",
      "Body sentence that belongs with the heading.",
    ].join("\n");
    const document = createMarkdownGreenfieldDocument(markdown);
    const heading = document.headings.find(
      (item) => item.text === "Section Heading",
    );
    expect(heading).toBeTruthy();

    const headingChunk = findMarkdownGreenfieldChunkByBlockId(
      document,
      heading!.blockId,
    );

    expect(document.chunks.length).toBeGreaterThan(1);
    // The heading opens its own chunk rather than being stranded at the tail of
    // the previous one, and the following body block rides along with it.
    expect(headingChunk?.blockIds[0]).toBe(heading!.blockId);
    expect(headingChunk?.blockIds.length).toBeGreaterThanOrEqual(2);
  });

  it("isolates a hostile block into its own chunk away from neighboring prose", () => {
    const markdown = [
      "Intro paragraph before the hostile block.",
      "",
      ...Array.from(
        { length: 90 },
        (_, index) => `<details><summary>Level ${index + 1}</summary>`,
      ),
      "Deeply nested content",
      ...Array.from({ length: 90 }, () => "</details>"),
      "",
      "Outro paragraph after the hostile block.",
    ].join("\n");
    const document = createMarkdownGreenfieldDocument(markdown);
    const hostileBlock = document.blocks.find((block) => block.isHostile);
    expect(hostileBlock).toBeTruthy();

    const hostileChunk = findMarkdownGreenfieldChunkByBlockId(
      document,
      hostileBlock!.id,
    );

    expect(hostileChunk?.isHostile).toBe(true);
    expect(hostileChunk?.blockIds).toEqual([hostileBlock!.id]);
    // Surrounding prose is not pulled into the isolated hostile chunk.
    expect(document.chunks.filter((chunk) => chunk.isHostile).length).toBe(1);
    expect(document.chunks.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps a small document in a single virtual chunk", () => {
    const document = createMarkdownGreenfieldDocument(
      ["# Title", "", "One short paragraph."].join("\n"),
    );

    expect(document.chunks.length).toBe(1);
  });
});

describe("pretext markdown greenfield layout estimates", () => {
  it("estimates taller content for the same paragraph at a narrower width", () => {
    const markdown = `# Width\n\n${"sentence ".repeat(400)}`;

    expect(totalHeight(markdown, 360)).toBeGreaterThan(
      totalHeight(markdown, 1200),
    );
  });

  it("estimates a heading taller than the same text as a paragraph", () => {
    const text = "Release readiness ".repeat(20).trim();

    expect(totalHeight(`# ${text}`)).toBeGreaterThan(totalHeight(text));
  });

  it("estimates code block height that grows with line count", () => {
    const small = [
      "```ts",
      ...Array.from({ length: 5 }, () => "const x = 1"),
      "```",
    ].join("\n");
    const large = [
      "```ts",
      ...Array.from({ length: 40 }, () => "const x = 1"),
      "```",
    ].join("\n");

    expect(totalHeight(large)).toBeGreaterThan(totalHeight(small));
  });

  it("estimates table height that grows with row count", () => {
    const header = ["| A | B |", "| - | - |"];
    const small = [
      ...header,
      ...Array.from({ length: 3 }, () => "| a | b |"),
    ].join("\n");
    const large = [
      ...header,
      ...Array.from({ length: 18 }, () => "| a | b |"),
    ].join("\n");

    expect(totalHeight(large)).toBeGreaterThan(totalHeight(small));
  });
});

describe("pretext markdown greenfield virtualizer visible range", () => {
  const frames = Array.from({ length: 10 }, (_, index) =>
    frame(`chunk-${index}`, index, index * 100, 100),
  );

  it("returns only frames intersecting the viewport with no overscan", () => {
    const visible = getMarkdownGreenfieldVisibleFrames({
      frames,
      overscanPx: 0,
      scrollTop: 300,
      viewportHeight: 200,
    });

    expect(visible.map((item) => item.index)).toEqual([3, 4]);
  });

  it("expands the visible range by pixel overscan on both sides", () => {
    const visible = getMarkdownGreenfieldVisibleFrames({
      frames,
      overscanPx: 100,
      scrollTop: 300,
      viewportHeight: 200,
    });

    expect(visible.map((item) => item.index)).toEqual([2, 3, 4, 5]);
  });

  it("returns an empty range for an empty document", () => {
    expect(
      getMarkdownGreenfieldVisibleFrames({
        frames: [],
        overscanPx: 200,
        scrollTop: 0,
        viewportHeight: 720,
      }),
    ).toEqual([]);

    // A blank document degrades to a single bounded placeholder chunk rather
    // than throwing or producing a runaway frame list.
    const emptyDocument = createMarkdownGreenfieldDocument("");
    const emptyFrame = layoutMarkdownGreenfieldDocument({
      contentWidth: 820,
      document: emptyDocument,
      fontScale: 1,
    });
    expect(Number.isFinite(emptyFrame.totalHeight)).toBe(true);
    expect(emptyFrame.chunks.length).toBeLessThanOrEqual(1);
    const emptyVisible = getMarkdownGreenfieldVisibleFrames({
      frames: emptyFrame.chunks,
      overscanPx: 200,
      scrollTop: 0,
      viewportHeight: 720,
    });
    expect(emptyVisible.length).toBe(emptyFrame.chunks.length);
  });
});

describe("pretext markdown greenfield heading slugs", () => {
  it("suffixes duplicate heading ids so navigation targets stay unique", () => {
    const document = createMarkdownGreenfieldDocument(
      ["# Title", "", "## Title", "", "### Title"].join("\n"),
    );
    const ids = document.headings.map((heading) => heading.id);

    expect(ids[0]).toBe("title");
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(3);
  });
});
