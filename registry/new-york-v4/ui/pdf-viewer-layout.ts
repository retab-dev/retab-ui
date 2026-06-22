import type { PdfPageSize } from "./pdf-viewer-types";

export const PDF_PAGE_GAP = 16;
export const PDF_PAGE_PADDING = 16;
export const PDF_RENDER_PAGE_OVERSCAN = 2;
export const PDF_VISIBLE_PAGE_OVERSCAN = 2;
export const PDF_PRELOAD_PAGE_OVERSCAN = 4;

export type PdfPageLayout = {
  pageNumber: number;
  width: number;
  height: number;
  offsetTop: number;
};

export type PdfMeasuredPageLayout = {
  pageNumber: number;
  width: number;
  height: number;
  heightDelta: number;
};

export type PdfPageLayoutModel = {
  pageCount: number;
  totalHeight: number;
  maxPageWidth: number;
  estimatedWidth: number;
  estimatedHeight: number;
  measuredPages: readonly PdfMeasuredPageLayout[];
  measuredPageByNumber: ReadonlyMap<number, PdfMeasuredPageLayout>;
  prefixHeightDeltas: readonly number[];
};

export function createPdfPageLayout({
  pageCount,
  defaultPageSize,
  pageSizeByNumber,
  scale,
  rotation,
}: {
  pageCount: number;
  defaultPageSize: PdfPageSize;
  pageSizeByNumber: ReadonlyMap<number, PdfPageSize>;
  scale: number;
  rotation: number;
}): PdfPageLayoutModel {
  const estimatedSize = getRenderedPageSize(defaultPageSize, scale, rotation);
  const measuredPages = Array.from(pageSizeByNumber.entries())
    .filter(([pageNumber]) => pageNumber >= 1 && pageNumber <= pageCount)
    .map(([pageNumber, pageSize]) => {
      const renderedSize = getRenderedPageSize(pageSize, scale, rotation);
      return {
        pageNumber,
        width: renderedSize.width,
        height: renderedSize.height,
        heightDelta: renderedSize.height - estimatedSize.height,
      };
    })
    .filter(
      (page) =>
        page.width !== estimatedSize.width ||
        page.height !== estimatedSize.height,
    )
    .sort((a, b) => a.pageNumber - b.pageNumber);

  const measuredPageByNumber = new Map(
    measuredPages.map((page) => [page.pageNumber, page]),
  );
  const prefixHeightDeltas: number[] = [];
  let totalHeightDelta = 0;
  let maxPageWidth = pageCount === 0 ? 0 : estimatedSize.width;

  for (const page of measuredPages) {
    totalHeightDelta += page.heightDelta;
    prefixHeightDeltas.push(totalHeightDelta);
    maxPageWidth = Math.max(maxPageWidth, page.width);
  }

  return {
    pageCount,
    totalHeight:
      pageCount === 0
        ? 0
        : PDF_PAGE_PADDING * 2 +
          pageCount * estimatedSize.height +
          (pageCount - 1) * PDF_PAGE_GAP +
          totalHeightDelta,
    maxPageWidth,
    estimatedWidth: estimatedSize.width,
    estimatedHeight: estimatedSize.height,
    measuredPages,
    measuredPageByNumber,
    prefixHeightDeltas,
  };
}

export function getPdfPageLayout(
  layout: PdfPageLayoutModel,
  pageNumber: number,
): PdfPageLayout | undefined {
  if (pageNumber < 1 || pageNumber > layout.pageCount) return undefined;

  const measuredPage = layout.measuredPageByNumber.get(pageNumber);
  return {
    pageNumber,
    width: measuredPage?.width ?? layout.estimatedWidth,
    height: measuredPage?.height ?? layout.estimatedHeight,
    offsetTop: getPdfPageOffsetTop(layout, pageNumber),
  };
}

export function findPdfPageByOffset(
  layout: PdfPageLayoutModel,
  offset: number,
) {
  if (layout.pageCount === 0) return 1;

  let low = 1;
  let high = layout.pageCount;
  let match = 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (getPdfPageOffsetTop(layout, mid) <= offset) {
      match = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return match;
}

export function getPdfVisiblePageNumbers({
  layout,
  scrollTop,
  viewportHeight,
  overscanPages = PDF_VISIBLE_PAGE_OVERSCAN,
}: {
  layout: PdfPageLayoutModel;
  scrollTop: number;
  viewportHeight: number;
  overscanPages?: number;
}) {
  if (layout.pageCount === 0) return [];

  return getPdfPageNumbersInRange({
    layout,
    startOffset: Math.max(0, scrollTop - viewportHeight),
    endOffset: scrollTop + viewportHeight * 2,
    overscanPages,
  });
}

export function getPdfRenderPageNumbers({
  layout,
  scrollTop,
  viewportHeight,
  overscanPages = PDF_RENDER_PAGE_OVERSCAN,
}: {
  layout: PdfPageLayoutModel;
  scrollTop: number;
  viewportHeight: number;
  overscanPages?: number;
}) {
  if (layout.pageCount === 0) return [];

  return getPdfPageNumbersInRange({
    layout,
    startOffset: scrollTop,
    endOffset: scrollTop + viewportHeight,
    overscanPages,
  });
}

export function getPdfPreloadPageNumbers({
  layout,
  renderPageNumbers,
  overscanPages = PDF_PRELOAD_PAGE_OVERSCAN,
}: {
  layout: PdfPageLayoutModel;
  renderPageNumbers: readonly number[];
  overscanPages?: number;
}) {
  if (layout.pageCount === 0 || renderPageNumbers.length === 0) return [];

  const firstRenderPage = renderPageNumbers[0];
  const lastRenderPage = renderPageNumbers[renderPageNumbers.length - 1];
  const firstPage = Math.max(1, firstRenderPage - overscanPages);
  const lastPage = Math.min(layout.pageCount, lastRenderPage + overscanPages);

  return createPageNumberRange(firstPage, lastPage);
}

function getPdfPageNumbersInRange({
  layout,
  startOffset,
  endOffset,
  overscanPages,
}: {
  layout: PdfPageLayoutModel;
  startOffset: number;
  endOffset: number;
  overscanPages: number;
}) {
  const safeStartOffset = Math.max(0, startOffset);
  const safeEndOffset = Math.max(safeStartOffset, endOffset);
  const firstVisiblePage = findPdfPageByOffset(layout, safeStartOffset);
  const lastVisiblePage = findPdfPageByOffset(layout, safeEndOffset);
  const firstPage = Math.max(1, firstVisiblePage - overscanPages);
  const lastPage = Math.min(layout.pageCount, lastVisiblePage + overscanPages);

  return createPageNumberRange(firstPage, lastPage);
}

function createPageNumberRange(firstPage: number, lastPage: number) {
  if (lastPage < firstPage) return [];

  return Array.from(
    { length: lastPage - firstPage + 1 },
    (_, index) => firstPage + index,
  );
}

function getRenderedPageSize(
  pageSize: PdfPageSize,
  scale: number,
  rotation: number,
) {
  const isRotated = rotation % 180 !== 0;
  return {
    width: Math.round((isRotated ? pageSize.height : pageSize.width) * scale),
    height: Math.round((isRotated ? pageSize.width : pageSize.height) * scale),
  };
}

function getPdfPageOffsetTop(layout: PdfPageLayoutModel, pageNumber: number) {
  return (
    PDF_PAGE_PADDING +
    (pageNumber - 1) * (layout.estimatedHeight + PDF_PAGE_GAP) +
    getHeightDeltaBeforePage(layout, pageNumber)
  );
}

function getHeightDeltaBeforePage(
  layout: PdfPageLayoutModel,
  pageNumber: number,
) {
  const measuredPageIndex = getLastMeasuredPageIndexBefore(layout, pageNumber);
  return measuredPageIndex < 0
    ? 0
    : layout.prefixHeightDeltas[measuredPageIndex];
}

function getLastMeasuredPageIndexBefore(
  layout: PdfPageLayoutModel,
  pageNumber: number,
) {
  let low = 0;
  let high = layout.measuredPages.length - 1;
  let match = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (layout.measuredPages[mid].pageNumber < pageNumber) {
      match = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return match;
}
