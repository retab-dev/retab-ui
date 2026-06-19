import { type PageMarkdownViewMode } from "./page-markdown-types";

export const PAGE_MARKDOWN_PAGE_WIDTH = 768;
export const PAGE_MARKDOWN_PAGE_PADDING_X = 36;
export const PAGE_MARKDOWN_PAGE_PADDING_Y = 28;
export const PAGE_MARKDOWN_PAGE_GAP = 16;
export const PAGE_MARKDOWN_PAGE_PADDING = 16;

const PAGE_MARKDOWN_ESTIMATE_MIN = 180;
const PAGE_MARKDOWN_ESTIMATE_MAX = 1800;
const PAGE_MARKDOWN_TEXT_LINE_HEIGHT = 22;
const PAGE_MARKDOWN_RENDERED_LINE_HEIGHT = 26;
const PAGE_MARKDOWN_ESTIMATE_VERTICAL_PADDING = 80;
const PAGE_MARKDOWN_ESTIMATE_CHARS_PER_LINE = 82;

export type PageMarkdownMeasuredPageLayout = {
  height: number;
  heightDelta: number;
  pageNumber: number;
};

export type PageMarkdownPageLayout = {
  height: number;
  offsetTop: number;
  pageNumber: number;
  width: number;
};

export type PageMarkdownLayoutModel = {
  estimatedHeights: readonly number[];
  measuredPageByNumber: ReadonlyMap<number, PageMarkdownMeasuredPageLayout>;
  measuredPages: readonly PageMarkdownMeasuredPageLayout[];
  pageCount: number;
  prefixEstimatedHeights: readonly number[];
  prefixHeightDeltas: readonly number[];
  totalHeight: number;
  width: number;
};

export function createPageMarkdownLayout({
  measuredHeightByPageNumber,
  mode,
  pages,
  scale,
  width = PAGE_MARKDOWN_PAGE_WIDTH,
}: {
  measuredHeightByPageNumber: ReadonlyMap<number, number>;
  mode: PageMarkdownViewMode;
  pages: readonly string[];
  scale: number;
  width?: number;
}): PageMarkdownLayoutModel {
  const safeScale = safePageScale(scale);
  const pageCount = pages.length;
  const estimatedHeights = pages.map((markdown) =>
    estimateMarkdownPageHeight(markdown, safeScale, mode),
  );
  const prefixEstimatedHeights: number[] = [];
  let estimatedTotalHeight = 0;

  for (const height of estimatedHeights) {
    prefixEstimatedHeights.push(estimatedTotalHeight);
    estimatedTotalHeight += height;
  }

  const measuredPages = Array.from(measuredHeightByPageNumber.entries())
    .filter(([pageNumber, height]) => {
      return (
        pageNumber >= 1 &&
        pageNumber <= pageCount &&
        Number.isFinite(height) &&
        height > 0
      );
    })
    .map(([pageNumber, height]) => ({
      height,
      heightDelta: height - estimatedHeights[pageNumber - 1]!,
      pageNumber,
    }))
    .filter((measuredPage) => measuredPage.heightDelta !== 0)
    .sort((a, b) => a.pageNumber - b.pageNumber);

  const measuredPageByNumber = new Map(
    measuredPages.map((measuredPage) => [
      measuredPage.pageNumber,
      measuredPage,
    ]),
  );
  const prefixHeightDeltas: number[] = [];
  let totalHeightDelta = 0;
  for (const measuredPage of measuredPages) {
    totalHeightDelta += measuredPage.heightDelta;
    prefixHeightDeltas.push(totalHeightDelta);
  }

  return {
    estimatedHeights,
    measuredPageByNumber,
    measuredPages,
    pageCount,
    prefixEstimatedHeights,
    prefixHeightDeltas,
    totalHeight:
      pageCount === 0
        ? 0
        : PAGE_MARKDOWN_PAGE_PADDING * 2 +
          estimatedTotalHeight +
          (pageCount - 1) * PAGE_MARKDOWN_PAGE_GAP +
          totalHeightDelta,
    width: Math.max(1, width * safeScale),
  };
}

export function getPageMarkdownPageLayout(
  layout: PageMarkdownLayoutModel,
  pageNumber: number,
): PageMarkdownPageLayout | undefined {
  if (pageNumber < 1 || pageNumber > layout.pageCount) return undefined;

  const measuredPage = layout.measuredPageByNumber.get(pageNumber);
  return {
    height: measuredPage?.height ?? layout.estimatedHeights[pageNumber - 1]!,
    offsetTop: getPageMarkdownPageOffsetTop(layout, pageNumber),
    pageNumber,
    width: layout.width,
  };
}

export function findPageMarkdownPageByOffset(
  layout: PageMarkdownLayoutModel,
  offset: number,
) {
  if (layout.pageCount === 0) return 1;

  let low = 1;
  let high = layout.pageCount;
  let match = 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (getPageMarkdownPageOffsetTop(layout, mid) <= offset) {
      match = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return match;
}

export function getPageMarkdownVisiblePageNumbers({
  layout,
  overscanPages = 2,
  scrollTop,
  viewportHeight,
}: {
  layout: PageMarkdownLayoutModel;
  overscanPages?: number;
  scrollTop: number;
  viewportHeight: number;
}) {
  if (layout.pageCount === 0) return [];

  const safeViewportHeight = Math.max(0, viewportHeight);
  const startOffset = Math.max(0, scrollTop - safeViewportHeight);
  const endOffset = scrollTop + safeViewportHeight * 2;
  const firstVisiblePage = findPageMarkdownPageByOffset(layout, startOffset);
  const lastVisiblePage = findPageMarkdownPageByOffset(layout, endOffset);
  const firstPage = Math.max(1, firstVisiblePage - overscanPages);
  const lastPage = Math.min(layout.pageCount, lastVisiblePage + overscanPages);

  return Array.from(
    { length: lastPage - firstPage + 1 },
    (_, index) => firstPage + index,
  );
}

export function estimateMarkdownPageHeight(
  markdown: string,
  scale: number,
  mode: PageMarkdownViewMode = "rendered",
): number {
  const safeScale = safePageScale(scale);
  const estimatedContentHeight =
    mode === "text"
      ? estimateTextContentHeight(markdown)
      : estimateRenderedContentHeight(markdown);

  return Math.min(
    PAGE_MARKDOWN_ESTIMATE_MAX * safeScale,
    Math.max(
      PAGE_MARKDOWN_ESTIMATE_MIN * safeScale,
      estimatedContentHeight * safeScale +
        PAGE_MARKDOWN_ESTIMATE_VERTICAL_PADDING * safeScale,
    ),
  );
}

export function createPageMeasurementKey({
  markdown,
  mode,
  scale,
}: {
  markdown: string;
  mode: string;
  scale: number;
}): string {
  return `${mode}:${safePageScale(scale).toFixed(3)}:${markdown.length}:${hashMarkdown(markdown)}`;
}

function getPageMarkdownPageOffsetTop(
  layout: PageMarkdownLayoutModel,
  pageNumber: number,
) {
  return (
    PAGE_MARKDOWN_PAGE_PADDING +
    layout.prefixEstimatedHeights[pageNumber - 1]! +
    (pageNumber - 1) * PAGE_MARKDOWN_PAGE_GAP +
    getHeightDeltaBeforePage(layout, pageNumber)
  );
}

function getHeightDeltaBeforePage(
  layout: PageMarkdownLayoutModel,
  pageNumber: number,
) {
  const measuredPageIndex = getLastMeasuredPageIndexBefore(layout, pageNumber);
  return measuredPageIndex < 0
    ? 0
    : layout.prefixHeightDeltas[measuredPageIndex]!;
}

function getLastMeasuredPageIndexBefore(
  layout: PageMarkdownLayoutModel,
  pageNumber: number,
) {
  let low = 0;
  let high = layout.measuredPages.length - 1;
  let match = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (layout.measuredPages[mid]!.pageNumber < pageNumber) {
      match = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return match;
}

function safePageScale(scale: number) {
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function estimateTextContentHeight(markdown: string): number {
  return (
    Math.max(1, markdown.split("\n").length) * PAGE_MARKDOWN_TEXT_LINE_HEIGHT
  );
}

function estimateRenderedContentHeight(markdown: string): number {
  const lines = markdown.split("\n");
  let height = 0;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;
    const trimmed = line.trim();

    if (!trimmed) {
      height += 10;
      index += 1;
      continue;
    }

    if (/^```|^~~~/.test(trimmed)) {
      const fence = trimmed.slice(0, 3);
      let codeLines = 0;
      index += 1;
      while (index < lines.length && !lines[index]!.trim().startsWith(fence)) {
        codeLines += 1;
        index += 1;
      }
      if (index < lines.length) index += 1;
      height += 42 + Math.max(1, codeLines) * 22;
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      let rowCount = 0;
      while (index < lines.length && isMarkdownTableRow(lines[index]!)) {
        rowCount += 1;
        index += 1;
      }
      height += 34 + Math.max(1, rowCount) * 34;
      continue;
    }

    const heading = /^(#{1,6})\s+/.exec(trimmed);
    if (heading) {
      height += Math.max(30, 48 - heading[1]!.length * 3);
      index += 1;
      continue;
    }

    if (/^!\[[^\]]*]\([^)]+\)/.test(trimmed)) {
      height += 260;
      index += 1;
      continue;
    }

    if (/^(?:[-*+]\s+|\d+\.\s+|>\s*)/.test(trimmed)) {
      height += PAGE_MARKDOWN_RENDERED_LINE_HEIGHT + 8;
      index += 1;
      continue;
    }

    let paragraphChars = trimmed.length;
    index += 1;
    while (index < lines.length && lines[index]!.trim()) {
      const nextLine = lines[index]!.trim();
      if (
        /^```|^~~~/.test(nextLine) ||
        /^#{1,6}\s+/.test(nextLine) ||
        /^!\[[^\]]*]\([^)]+\)/.test(nextLine) ||
        /^(?:[-*+]\s+|\d+\.\s+|>\s*)/.test(nextLine) ||
        isMarkdownTableStart(lines, index)
      ) {
        break;
      }
      paragraphChars += 1 + nextLine.length;
      index += 1;
    }

    height +=
      Math.ceil(paragraphChars / PAGE_MARKDOWN_ESTIMATE_CHARS_PER_LINE) *
        PAGE_MARKDOWN_RENDERED_LINE_HEIGHT +
      14;
  }

  return height;
}

function isMarkdownTableStart(
  lines: readonly string[],
  index: number,
): boolean {
  return (
    index + 1 < lines.length &&
    isMarkdownTableRow(lines[index]!) &&
    /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(
      lines[index + 1]!,
    )
  );
}

function isMarkdownTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.includes("|") && !/^```|^~~~/.test(trimmed);
}

function hashMarkdown(markdown: string): string {
  let hash = 2166136261;
  for (let index = 0; index < markdown.length; index += 1) {
    hash ^= markdown.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
