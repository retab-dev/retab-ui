import { clamp } from "./docx-viewer-core";

export const DOCX_PAGE_GAP_PX = 16;
export const DOCX_VIEWER_PADDING_PX = 16;
export const DOCX_READING_MARKER_RATIO = 0.2;

export interface DocxPageMetric {
  pageNumber: number;
  width: number;
  height: number;
  top: number;
  bottom: number;
}

export interface DocxPageLayout {
  pages: readonly DocxPageMetric[];
  totalHeight: number;
}

export type DocxReadingAnchor =
  | {
      kind: "top";
    }
  | {
      kind: "page";
      pageNumber: number;
      yPercent: number;
    };

export function createDocxPageLayout(
  sizes: readonly (readonly [number, number])[],
  gap = DOCX_PAGE_GAP_PX,
): DocxPageLayout {
  let top = 0;
  const pages = sizes.map(([width, height], index) => {
    const page: DocxPageMetric = {
      pageNumber: index + 1,
      width,
      height,
      top,
      bottom: top + height,
    };
    top = page.bottom + gap;
    return page;
  });

  return {
    pages,
    totalHeight: pages.length ? pages[pages.length - 1]!.bottom : 0,
  };
}

export function findDocxPageByMarker({
  layout,
  scale,
  scrollTop,
  viewportHeight,
}: {
  layout: DocxPageLayout | null;
  scale: number;
  scrollTop: number;
  viewportHeight: number;
}) {
  const pages = layout?.pages;
  if (!pages?.length) return null;

  const marker = scrollTop + viewportHeight * DOCX_READING_MARKER_RATIO;
  const y = Math.max(0, (marker - DOCX_VIEWER_PADDING_PX) / safeScale(scale));
  let low = 0;
  let high = pages.length - 1;
  let current = pages[0]!;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const page = pages[mid]!;
    if (page.top <= y) {
      current = page;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return current;
}

export function captureDocxReadingAnchorFromLayout({
  layout,
  scale,
  scrollTop,
  viewportHeight,
}: {
  layout: DocxPageLayout | null;
  scale: number;
  scrollTop: number;
  viewportHeight: number;
}): DocxReadingAnchor {
  if (scrollTop <= 0) return { kind: "top" };

  const page = findDocxPageByMarker({
    layout,
    scale,
    scrollTop,
    viewportHeight,
  });
  if (!page || page.height <= 0) return { kind: "top" };

  const marker = scrollTop + viewportHeight * DOCX_READING_MARKER_RATIO;
  const y = Math.max(0, (marker - DOCX_VIEWER_PADDING_PX) / safeScale(scale));

  return {
    kind: "page",
    pageNumber: page.pageNumber,
    yPercent: clamp((y - page.top) / page.height, 0, 1),
  };
}

export function restoreDocxReadingAnchorFromLayout({
  anchor,
  layout,
  maxScrollTop,
  scale,
  viewportHeight,
}: {
  anchor: DocxReadingAnchor;
  layout: DocxPageLayout | null;
  maxScrollTop: number;
  scale: number;
  viewportHeight: number;
}) {
  if (anchor.kind === "top") return 0;

  const page = layout?.pages[anchor.pageNumber - 1];
  if (!page || page.height <= 0) return null;

  const y = (page.top + page.height * anchor.yPercent) * safeScale(scale);
  const marker = viewportHeight * DOCX_READING_MARKER_RATIO;
  return clamp(DOCX_VIEWER_PADDING_PX + y - marker, 0, maxScrollTop);
}

function safeScale(scale: number) {
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}
