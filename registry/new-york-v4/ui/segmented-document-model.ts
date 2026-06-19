import { segmentsPageCount, type Segment } from "@/lib/segments";

export type DocumentSegment = Segment & {
  /** Stable domain id for the item that produced this segment. */
  sourceId?: string;
};

export type SegmentBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SegmentAnchor = {
  id: string;
  segmentId: string;
  /** 1-based page/frame number. */
  pageNumber: number;
  /** Normalized page-local rectangle. Omit for whole-page anchors. */
  bounds?: SegmentBounds;
};

export type SegmentedPage = {
  pageNumber: number;
  width?: number;
  height?: number;
};

export type SegmentRow = {
  id: string;
  label?: string;
  /** Generic display grouping only; domain vote/output semantics stay outside. */
  segments: DocumentSegment[];
};

export type SegmentedDocumentModel = {
  pages: SegmentedPage[];
  /** Viewport/navigation projection used for page ownership and jumps. */
  segments: DocumentSegment[];
  /** Optional page-local targets for segment-level navigation and overlays. */
  anchors?: SegmentAnchor[];
  /** Optional generic row projection for visual ribbons or grouped legends. */
  rows?: SegmentRow[];
};

export function createSegmentedDocumentModel({
  anchors,
  pageCount,
  pages,
  rows,
  segments,
}: {
  anchors?: SegmentAnchor[];
  pageCount?: number;
  pages?: SegmentedPage[];
  rows?: SegmentRow[];
  segments: DocumentSegment[];
}): SegmentedDocumentModel {
  return {
    pages:
      pages ?? createSegmentedPages(pageCount ?? segmentsPageCount(segments)),
    segments,
    ...(anchors ? { anchors } : null),
    ...(rows ? { rows } : null),
  };
}

export function createSegmentedPages(pageCount: number): SegmentedPage[] {
  const count =
    Number.isFinite(pageCount) && pageCount > 0 ? Math.floor(pageCount) : 0;
  return Array.from({ length: count }, (_, index) => ({
    pageNumber: index + 1,
  }));
}
