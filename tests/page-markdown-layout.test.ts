import { describe, expect, it } from "vitest";

import {
  createPageMarkdownLayout,
  estimateMarkdownPageHeight,
  findPageMarkdownPageByOffset,
  getPageMarkdownPageLayout,
  getPageMarkdownVisiblePageNumbers,
  PAGE_MARKDOWN_PAGE_GAP,
  PAGE_MARKDOWN_PAGE_PADDING,
} from "@/components/viewers/page-markdown/page-markdown-layout";

const pages = ["# One\n\nAlpha", "## Two\n\nBeta", "### Three\n\nGamma"];

describe("page markdown layout", () => {
  it("keeps empty documents dimensionless", () => {
    const layout = createPageMarkdownLayout({
      measuredHeightByPageNumber: new Map(),
      mode: "rendered",
      pages: [],
      scale: 1,
    });

    expect(layout.totalHeight).toBe(0);
    expect(layout.width).toBe(768);
    expect(getPageMarkdownPageLayout(layout, 1)).toBeUndefined();
    expect(
      getPageMarkdownVisiblePageNumbers({
        layout,
        scrollTop: 0,
        viewportHeight: 200,
      }),
    ).toEqual([]);
  });

  it("creates page offsets from estimates and measured height deltas", () => {
    const layout = createPageMarkdownLayout({
      measuredHeightByPageNumber: new Map([
        [2, 420],
        [3, 120],
      ]),
      mode: "rendered",
      pages,
      scale: 1,
    });

    const page1 = getPageMarkdownPageLayout(layout, 1)!;
    const page2 = getPageMarkdownPageLayout(layout, 2)!;
    const page3 = getPageMarkdownPageLayout(layout, 3)!;

    expect(page1).toMatchObject({
      pageNumber: 1,
      height: 180,
      offsetTop: PAGE_MARKDOWN_PAGE_PADDING,
      width: 768,
    });
    expect(page2).toMatchObject({
      pageNumber: 2,
      height: 420,
      offsetTop: PAGE_MARKDOWN_PAGE_PADDING + 180 + PAGE_MARKDOWN_PAGE_GAP,
    });
    expect(page3).toMatchObject({
      pageNumber: 3,
      height: 120,
      offsetTop: page2.offsetTop + 420 + PAGE_MARKDOWN_PAGE_GAP,
    });
    expect(layout.totalHeight).toBe(
      PAGE_MARKDOWN_PAGE_PADDING * 2 +
        180 +
        PAGE_MARKDOWN_PAGE_GAP +
        420 +
        PAGE_MARKDOWN_PAGE_GAP +
        120,
    );
  });

  it("finds pages by offset with binary-searchable layout data", () => {
    const layout = createPageMarkdownLayout({
      measuredHeightByPageNumber: new Map([[2, 420]]),
      mode: "rendered",
      pages,
      scale: 1,
    });
    const page2 = getPageMarkdownPageLayout(layout, 2)!;
    const page3 = getPageMarkdownPageLayout(layout, 3)!;

    expect(findPageMarkdownPageByOffset(layout, -100)).toBe(1);
    expect(findPageMarkdownPageByOffset(layout, page2.offsetTop - 1)).toBe(1);
    expect(findPageMarkdownPageByOffset(layout, page2.offsetTop)).toBe(2);
    expect(findPageMarkdownPageByOffset(layout, page3.offsetTop)).toBe(3);
    expect(findPageMarkdownPageByOffset(layout, Number.MAX_SAFE_INTEGER)).toBe(
      3,
    );
  });

  it("returns a bounded overscanned page window", () => {
    const manyPages = Array.from(
      { length: 600 },
      (_, index) => `# Page ${index + 1}`,
    );
    const layout = createPageMarkdownLayout({
      measuredHeightByPageNumber: new Map(),
      mode: "rendered",
      pages: manyPages,
      scale: 1,
    });
    const page400 = getPageMarkdownPageLayout(layout, 400)!;

    expect(
      getPageMarkdownVisiblePageNumbers({
        layout,
        scrollTop: page400.offsetTop,
        viewportHeight: 200,
        overscanPages: 2,
      }),
    ).toEqual([396, 397, 398, 399, 400, 401, 402, 403, 404]);
  });

  it("scales width and estimated height without leaking non-finite scale", () => {
    const scaled = createPageMarkdownLayout({
      measuredHeightByPageNumber: new Map(),
      mode: "text",
      pages,
      scale: 1.5,
    });
    const fallback = createPageMarkdownLayout({
      measuredHeightByPageNumber: new Map(),
      mode: "rendered",
      pages,
      scale: Number.NaN,
    });

    expect(getPageMarkdownPageLayout(scaled, 1)).toMatchObject({
      width: 1152,
      height: 270,
    });
    expect(getPageMarkdownPageLayout(fallback, 1)).toMatchObject({
      width: 768,
      height: 180,
    });
  });

  it("estimates rendered markdown from semantic block shapes", () => {
    const paragraph = "Paragraph ".repeat(80);
    const code = ["```ts", "const a = 1", "const b = 2", "```"].join("\n");
    const table = [
      "| Item | Price |",
      "| --- | ---: |",
      "| One | $1 |",
      "| Two | $2 |",
    ].join("\n");
    const image = "![Preview](https://example.com/image.png)";
    const longText = Array.from({ length: 20 }, (_, index) => `${index}`).join(
      "\n",
    );

    expect(estimateMarkdownPageHeight(paragraph, 1)).toBeGreaterThan(300);
    expect(estimateMarkdownPageHeight(code, 1)).toBe(180);
    expect(estimateMarkdownPageHeight(table, 1)).toBeGreaterThan(240);
    expect(estimateMarkdownPageHeight(image, 1)).toBe(340);
    expect(estimateMarkdownPageHeight(longText, 1, "text")).toBeGreaterThan(
      estimateMarkdownPageHeight(code, 1, "text"),
    );
  });
});
