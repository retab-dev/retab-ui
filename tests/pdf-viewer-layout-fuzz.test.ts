import { describe, expect, it } from "vitest";

import {
  createPdfPageLayout,
  findPdfPageByOffset,
  getPdfPageLayout,
  getPdfVisiblePageNumbers,
  PDF_PAGE_GAP,
  PDF_PAGE_PADDING,
  type PdfPageLayoutModel,
} from "@/registry/new-york-v4/ui/pdf-viewer-layout";

/** Deterministic PRNG so a failing case is always reproducible from its seed. */
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROTATIONS = [0, 90, 180, 270, -90, -180, 360, 450, 540];

function randomConfig(rand: () => number) {
  const pageCount = 1 + Math.floor(rand() * 200);
  const defaultPageSize = {
    width: 1 + Math.floor(rand() * 2000),
    height: 1 + Math.floor(rand() * 2000),
  };
  // Mix typical scales with extreme ones to stress rounding.
  const scaleRoll = rand();
  const scale =
    scaleRoll < 0.15
      ? rand() * 0.05 // sub-pixel scales (can round dimensions to 0)
      : scaleRoll < 0.85
        ? 0.25 + rand() * 4.75
        : 5 + rand() * 20; // beyond the viewer's normal max
  const rotation = ROTATIONS[Math.floor(rand() * ROTATIONS.length)];

  const pageSizeByNumber = new Map<number, { width: number; height: number }>();
  const measuredCount = Math.floor(rand() * Math.min(pageCount, 25));
  for (let i = 0; i < measuredCount; i++) {
    // Occasionally include out-of-range keys; createPdfPageLayout must ignore them.
    const page =
      rand() < 0.1
        ? Math.floor(rand() * 2 * pageCount) - pageCount
        : 1 + Math.floor(rand() * pageCount);
    pageSizeByNumber.set(page, {
      width: 1 + Math.floor(rand() * 2000),
      height: 1 + Math.floor(rand() * 2000),
    });
  }

  return { pageCount, defaultPageSize, pageSizeByNumber, scale, rotation };
}

function eachPage(layout: PdfPageLayoutModel) {
  return Array.from({ length: layout.pageCount }, (_, i) =>
    getPdfPageLayout(layout, i + 1),
  );
}

describe("createPdfPageLayout — property fuzz", () => {
  const SEEDS = [1, 7, 42, 1337, 99991, 2_024_06_12];

  for (const seed of SEEDS) {
    it(`upholds layout invariants across random configs (seed ${seed})`, () => {
      const rand = mulberry32(seed);
      for (let iteration = 0; iteration < 400; iteration++) {
        const config = randomConfig(rand);
        const layout = createPdfPageLayout(config);
        const pages = eachPage(layout);
        // Serialize the config once per iteration (not per assertion) so a
        // failure is reproducible without blowing up runtime on big documents.
        const ctx = `seed=${seed} iter=${iteration} ${JSON.stringify(
          config,
          (_k, v) => (v instanceof Map ? [...v.entries()] : v),
        )}`;

        // Every page in range resolves; none out of range does.
        expect(getPdfPageLayout(layout, 0), ctx).toBeUndefined();
        expect(
          getPdfPageLayout(layout, layout.pageCount + 1),
          ctx,
        ).toBeUndefined();

        for (const page of pages) {
          expect(page, ctx).toBeDefined();
          expect(Number.isInteger(page!.width), ctx).toBe(true);
          expect(Number.isInteger(page!.height), ctx).toBe(true);
          expect(page!.width, ctx).toBeGreaterThanOrEqual(0);
          expect(page!.height, ctx).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(page!.offsetTop), ctx).toBe(true);
        }

        // Adjacent pages are stacked with exactly one gap between them.
        for (let i = 1; i < pages.length; i++) {
          expect(pages[i]!.offsetTop, ctx).toBe(
            pages[i - 1]!.offsetTop + pages[i - 1]!.height + PDF_PAGE_GAP,
          );
        }

        // First page sits below the top padding.
        expect(pages[0]!.offsetTop, ctx).toBe(PDF_PAGE_PADDING);

        // The last page's bottom edge plus padding is the total height.
        const last = pages[pages.length - 1]!;
        expect(last.offsetTop + last.height + PDF_PAGE_PADDING, ctx).toBe(
          layout.totalHeight,
        );

        // totalHeight equals the closed-form sum of page heights, gaps, padding.
        const sumHeights = pages.reduce((acc, p) => acc + p!.height, 0);
        expect(layout.totalHeight, ctx).toBe(
          PDF_PAGE_PADDING * 2 +
            sumHeights +
            (layout.pageCount - 1) * PDF_PAGE_GAP,
        );

        // maxPageWidth is the true maximum across pages.
        expect(layout.maxPageWidth, ctx).toBe(
          Math.max(...pages.map((p) => p!.width)),
        );

        // findPdfPageByOffset round-trips at the top of each page and mid-page.
        for (const page of pages) {
          expect(findPdfPageByOffset(layout, page!.offsetTop), ctx).toBe(
            page!.pageNumber,
          );
          const mid = page!.offsetTop + Math.floor(page!.height / 2);
          expect(findPdfPageByOffset(layout, mid), ctx).toBe(page!.pageNumber);
        }

        // Offsets below the document clamp to page 1; far below the bottom to last.
        expect(findPdfPageByOffset(layout, -1_000_000), ctx).toBe(1);
        expect(findPdfPageByOffset(layout, Number.MAX_SAFE_INTEGER), ctx).toBe(
          layout.pageCount,
        );

        // Visible window: contiguous, in-bounds, and contains the anchor page.
        const scrollTop = Math.floor(rand() * (layout.totalHeight + 500));
        const viewportHeight = 1 + Math.floor(rand() * 1500);
        const visible = getPdfVisiblePageNumbers({
          layout,
          scrollTop,
          viewportHeight,
        });
        expect(visible.length, ctx).toBeGreaterThan(0);
        expect(visible[0], ctx).toBeGreaterThanOrEqual(1);
        expect(visible[visible.length - 1], ctx).toBeLessThanOrEqual(
          layout.pageCount,
        );
        for (let i = 1; i < visible.length; i++) {
          expect(visible[i], ctx).toBe(visible[i - 1] + 1);
        }
        const anchorPage = findPdfPageByOffset(layout, scrollTop);
        expect(visible.includes(anchorPage), ctx).toBe(true);
      }
    }, 30_000);
  }
});
