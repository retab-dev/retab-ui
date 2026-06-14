import { segmentsPageCount, type Segment } from "@/lib/segments"

export type DocumentSegment = Segment & {
  sourceId?: string
}

export type SegmentBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type SegmentAnchor = {
  id: string
  segmentId: string
  pageNumber: number
  bounds?: SegmentBounds
}

export type SegmentedPage = {
  pageNumber: number
  width?: number
  height?: number
}

export type SegmentRow = {
  id: string
  label?: string
  segments: DocumentSegment[]
}

export type SegmentedDocumentModel = {
  pages: SegmentedPage[]
  segments: DocumentSegment[]
  anchors?: SegmentAnchor[]
  rows?: SegmentRow[]
}

export function createSegmentedDocumentModel({
  anchors,
  pageCount,
  pages,
  rows,
  segments,
}: {
  anchors?: SegmentAnchor[]
  pageCount?: number
  pages?: SegmentedPage[]
  rows?: SegmentRow[]
  segments: DocumentSegment[]
}): SegmentedDocumentModel {
  return {
    pages:
      pages ?? createSegmentedPages(pageCount ?? segmentsPageCount(segments)),
    segments,
    ...(anchors ? { anchors } : null),
    ...(rows ? { rows } : null),
  }
}

export function createSegmentedPages(pageCount: number): SegmentedPage[] {
  const count =
    Number.isFinite(pageCount) && pageCount > 0 ? Math.floor(pageCount) : 0
  return Array.from({ length: count }, (_, index) => ({
    pageNumber: index + 1,
  }))
}
