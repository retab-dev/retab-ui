import { describe, expect, it } from "vitest";

import {
  createPdfPageLayout,
  findPdfPageByOffset,
  getPdfPageLayout,
  getPdfRenderedPageWindow,
  getPdfRenderPageNumbers,
  getPdfVisiblePageNumbers,
  PDF_PAGE_GAP,
  PDF_PAGE_PADDING,
  PDF_RENDER_PAGE_OVERSCAN,
} from "@/registry/new-york-v4/ui/pdf-viewer-layout";

const pageSize = { width: 100, height: 200 };

describe("pdf viewer layout", () => {
  it("keeps empty documents dimensionless", () => {
    const layout = createPdfPageLayout({
      pageCount: 0,
      defaultPageSize: pageSize,
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });

    expect(layout.totalHeight).toBe(0);
    expect(layout.maxPageWidth).toBe(0);
    expect(getPdfPageLayout(layout, 1)).toBeUndefined();
    expect(
      getPdfVisiblePageNumbers({ layout, scrollTop: 0, viewportHeight: 200 }),
    ).toEqual([]);
  });

  it("creates scaled page offsets and document dimensions", () => {
    const layout = createPdfPageLayout({
      pageCount: 3,
      defaultPageSize: pageSize,
      pageSizeByNumber: new Map([[2, { width: 120, height: 300 }]]),
      scale: 2,
      rotation: 0,
    });

    expect(layout.measuredPages).toEqual([
      {
        pageNumber: 2,
        width: 240,
        height: 600,
        heightDelta: 200,
      },
    ]);
    expect(getPdfPageLayout(layout, 1)).toEqual({
      pageNumber: 1,
      width: 200,
      height: 400,
      offsetTop: PDF_PAGE_PADDING,
    });
    expect(getPdfPageLayout(layout, 2)).toEqual({
      pageNumber: 2,
      width: 240,
      height: 600,
      offsetTop: PDF_PAGE_PADDING + 400 + PDF_PAGE_GAP,
    });
    expect(getPdfPageLayout(layout, 3)).toEqual({
      pageNumber: 3,
      width: 200,
      height: 400,
      offsetTop: PDF_PAGE_PADDING + 400 + PDF_PAGE_GAP + 600 + PDF_PAGE_GAP,
    });
    expect(layout.maxPageWidth).toBe(240);
    expect(layout.totalHeight).toBe(
      PDF_PAGE_PADDING * 2 + 400 + PDF_PAGE_GAP + 600 + PDF_PAGE_GAP + 400,
    );
  });

  it("does not store measured pages that match the estimate", () => {
    const layout = createPdfPageLayout({
      pageCount: 3,
      defaultPageSize: pageSize,
      pageSizeByNumber: new Map([
        [1, pageSize],
        [3, { width: 120, height: 220 }],
      ]),
      scale: 1,
      rotation: 0,
    });

    expect(layout.measuredPages).toEqual([
      {
        pageNumber: 3,
        width: 120,
        height: 220,
        heightDelta: 20,
      },
    ]);
    expect(getPdfPageLayout(layout, 3)).toEqual({
      pageNumber: 3,
      width: 120,
      height: 220,
      offsetTop: PDF_PAGE_PADDING + 2 * (200 + PDF_PAGE_GAP),
    });
  });

  it("swaps page dimensions when rotated sideways", () => {
    const layout = createPdfPageLayout({
      pageCount: 1,
      defaultPageSize: pageSize,
      pageSizeByNumber: new Map(),
      scale: 1.5,
      rotation: 90,
    });

    expect(getPdfPageLayout(layout, 1)).toMatchObject({
      width: 300,
      height: 150,
      offsetTop: PDF_PAGE_PADDING,
    });
    expect(layout.maxPageWidth).toBe(300);
  });

  it("finds the nearest page at or before an offset", () => {
    const layout = createPdfPageLayout({
      pageCount: 3,
      defaultPageSize: pageSize,
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });

    expect(findPdfPageByOffset(layout, -100)).toBe(1);
    expect(findPdfPageByOffset(layout, PDF_PAGE_PADDING)).toBe(1);
    expect(findPdfPageByOffset(layout, PDF_PAGE_PADDING + 200)).toBe(1);
    expect(
      findPdfPageByOffset(layout, PDF_PAGE_PADDING + 200 + PDF_PAGE_GAP),
    ).toBe(2);
    expect(findPdfPageByOffset(layout, Number.MAX_SAFE_INTEGER)).toBe(3);
  });

  it("accounts for measured page height deltas while finding pages by offset", () => {
    const layout = createPdfPageLayout({
      pageCount: 4,
      defaultPageSize: pageSize,
      pageSizeByNumber: new Map([
        [2, { width: 100, height: 500 }],
        [3, { width: 100, height: 120 }],
      ]),
      scale: 1,
      rotation: 0,
    });

    const page2 = getPdfPageLayout(layout, 2)!;
    const page3 = getPdfPageLayout(layout, 3)!;
    const page4 = getPdfPageLayout(layout, 4)!;

    expect(page3.offsetTop).toBe(page2.offsetTop + 500 + PDF_PAGE_GAP);
    expect(page4.offsetTop).toBe(page3.offsetTop + 120 + PDF_PAGE_GAP);
    expect(findPdfPageByOffset(layout, page2.offsetTop + 499)).toBe(2);
    expect(findPdfPageByOffset(layout, page3.offsetTop)).toBe(3);
    expect(findPdfPageByOffset(layout, page4.offsetTop)).toBe(4);
  });

  it("uses measured rotated dimensions for total height and max width", () => {
    const layout = createPdfPageLayout({
      pageCount: 2,
      defaultPageSize: pageSize,
      pageSizeByNumber: new Map([[2, { width: 80, height: 500 }]]),
      scale: 1,
      rotation: 90,
    });

    expect(getPdfPageLayout(layout, 1)).toMatchObject({
      width: 200,
      height: 100,
      offsetTop: PDF_PAGE_PADDING,
    });
    expect(getPdfPageLayout(layout, 2)).toMatchObject({
      width: 500,
      height: 80,
      offsetTop: PDF_PAGE_PADDING + 100 + PDF_PAGE_GAP,
    });
    expect(layout.maxPageWidth).toBe(500);
    expect(layout.totalHeight).toBe(
      PDF_PAGE_PADDING * 2 + 100 + PDF_PAGE_GAP + 80,
    );
  });

  it("returns a bounded overscanned page window", () => {
    const layout = createPdfPageLayout({
      pageCount: 585,
      defaultPageSize: pageSize,
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const page400 = getPdfPageLayout(layout, 400);
    expect(page400).toBeTruthy();

    expect(
      getPdfVisiblePageNumbers({
        layout,
        scrollTop: page400!.offsetTop,
        viewportHeight: 200,
        overscanPages: 2,
      }),
    ).toEqual([397, 398, 399, 400, 401, 402, 403]);
  });

  it("renders two pages of lookahead by default", () => {
    const layout = createPdfPageLayout({
      pageCount: 585,
      defaultPageSize: pageSize,
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const page400 = getPdfPageLayout(layout, 400);
    expect(page400).toBeTruthy();

    expect(
      getPdfRenderPageNumbers({
        layout,
        scrollTop: page400!.offsetTop,
        viewportHeight: 200,
      }),
    ).toEqual([398, 399, 400, 401, 402]);
    expect(PDF_RENDER_PAGE_OVERSCAN).toBe(2);
  });

  it("builds an inverse-sticky rendered page window", () => {
    const layout = createPdfPageLayout({
      pageCount: 5,
      defaultPageSize: pageSize,
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });

    const window = getPdfRenderedPageWindow({
      layout,
      pageNumbers: [2, 3],
      viewportHeight: 100,
    });

    expect(window).toMatchObject({
      beforeHeight: PDF_PAGE_PADDING + 200 + PDF_PAGE_GAP,
      height: 200 + PDF_PAGE_GAP + 200,
      stickyInset: -(200 + PDF_PAGE_GAP + 200 - 100),
    });
    expect(window?.afterHeight).toBe(
      layout.totalHeight -
        (PDF_PAGE_PADDING + 200 + PDF_PAGE_GAP + 200 + PDF_PAGE_GAP + 200),
    );
    expect(window?.pages).toEqual([
      expect.objectContaining({ pageNumber: 2, windowTop: 0 }),
      expect.objectContaining({
        pageNumber: 3,
        windowTop: 200 + PDF_PAGE_GAP,
      }),
    ]);
    expect(
      (window?.beforeHeight ?? 0) +
        (window?.height ?? 0) +
        (window?.afterHeight ?? 0),
    ).toBe(layout.totalHeight);
  });

  it("omits the rendered page window when no requested pages are valid", () => {
    const layout = createPdfPageLayout({
      pageCount: 2,
      defaultPageSize: pageSize,
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });

    expect(
      getPdfRenderedPageWindow({
        layout,
        pageNumbers: [10],
        viewportHeight: 100,
      }),
    ).toBeNull();
  });

  it("clips the visible page window at document edges", () => {
    const layout = createPdfPageLayout({
      pageCount: 5,
      defaultPageSize: pageSize,
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });

    expect(
      getPdfVisiblePageNumbers({
        layout,
        scrollTop: 0,
        viewportHeight: 200,
        overscanPages: 2,
      }),
    ).toEqual([1, 2, 3, 4]);

    expect(
      getPdfVisiblePageNumbers({
        layout,
        scrollTop: layout.totalHeight,
        viewportHeight: 200,
        overscanPages: 2,
      }),
    ).toEqual([3, 4, 5]);
  });
});
