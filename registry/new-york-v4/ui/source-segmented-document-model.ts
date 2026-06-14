import type { Source, SourceAnchor, SourceMap } from "@/lib/document-source"
import {
  buildColorMap,
  segmentDisplayLabel,
  segmentsPageCount,
} from "@/lib/segments"

import {
  createSegmentedDocumentModel,
  type DocumentSegment,
  type SegmentAnchor,
  type SegmentedDocumentModel,
} from "./segmented-document-model"

export type SegmentedSourceField = {
  id: string
  label: string
  source?: Source | null
}

export function sourceFieldsToSegmentedDocumentModel(
  fields: readonly SegmentedSourceField[]
): SegmentedDocumentModel {
  const colors = buildColorMap(fields.map((field) => field.label))
  const segments: DocumentSegment[] = []
  const anchors: SegmentAnchor[] = []

  fields.forEach((field, index) => {
    const label = sourceSegmentLabel(field)
    const segment: DocumentSegment = {
      id: sourceSegmentId(field.id, index),
      label,
      pages: [],
      color:
        colors.get(label) ??
        colors.get(segmentDisplayLabel(label)) ??
        "var(--color-muted-foreground)",
      index,
      sourceId: field.id,
    }
    const anchor = sourceToSegmentAnchor(field.source, segment.id)
    if (anchor) {
      segment.pages = [anchor.pageNumber]
      anchors.push(anchor)
    }
    segments.push(segment)
  })

  return createSegmentedDocumentModel({
    anchors,
    pageCount: segmentsPageCount(segments),
    segments,
  })
}

export function sourceMapToSegmentedDocumentModel({
  labels,
  sourceMap,
}: {
  labels?: Record<string, string>
  sourceMap: SourceMap
}): SegmentedDocumentModel {
  return sourceFieldsToSegmentedDocumentModel(
    Object.entries(sourceMap).map(([id, source]) => ({
      id,
      label: labels?.[id] ?? (id || "Value"),
      source,
    }))
  )
}

export function sourceToSegmentAnchor(
  source: Source | null | undefined,
  segmentId: string
): SegmentAnchor | null {
  if (!source) return null

  switch (source.anchor.kind) {
    case "pdf_bbox":
      return bboxSourceAnchorToSegmentAnchor({
        anchor: source.anchor,
        pageNumber: source.anchor.page,
        segmentId,
      })
    case "image_bbox":
      return bboxSourceAnchorToSegmentAnchor({
        anchor: source.anchor,
        pageNumber: source.anchor.page ?? 1,
        segmentId,
      })
    case "csv_cell":
    case "spreadsheet_cell":
    case "docx_text_span":
    case "docx_table_cell":
    case "text_span":
      return null
  }
}

function bboxSourceAnchorToSegmentAnchor({
  anchor,
  pageNumber,
  segmentId,
}: {
  anchor: Extract<SourceAnchor, { kind: "pdf_bbox" | "image_bbox" }>
  pageNumber: number
  segmentId: string
}): SegmentAnchor | null {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) return null
  if (!isValidNormalizedBox(anchor)) return null

  return {
    id: `${segmentId}:anchor`,
    segmentId,
    pageNumber,
    bounds: {
      x: anchor.left,
      y: anchor.top,
      width: anchor.width,
      height: anchor.height,
    },
  }
}

function sourceSegmentLabel(field: SegmentedSourceField): string {
  return segmentDisplayLabel(field.label || field.id)
}

function sourceSegmentId(id: string, index: number): string {
  return `source:${id || "value"}:${index}`
}

function isValidNormalizedBox({
  left,
  top,
  width,
  height,
}: {
  left: number
  top: number
  width: number
  height: number
}) {
  return (
    Number.isFinite(left) &&
    Number.isFinite(top) &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    left >= 0 &&
    top >= 0 &&
    width > 0 &&
    height > 0 &&
    left + width <= 1 &&
    top + height <= 1
  )
}
