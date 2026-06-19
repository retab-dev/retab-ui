import { buildColorMap, segmentDisplayLabel } from "@/lib/segments";

import { getScrollTarget } from "./layout-blocks-geometry";
import type { LayoutDocument, LayoutItem } from "./layout-blocks-types";
import {
  createSegmentedDocumentModel,
  type DocumentSegment,
  type SegmentAnchor,
  type SegmentedDocumentModel,
} from "./segmented-document-model";

export function createOcrSegmentedDocumentModel({
  document,
  items,
}: {
  document: LayoutDocument;
  items: readonly LayoutItem[];
}): SegmentedDocumentModel {
  const colors = buildColorMap(items.map(layoutItemSegmentLabel));
  const pageByNumber = new Map(
    document.pages.map((page) => [page.pageNumber, page]),
  );
  const segments: DocumentSegment[] = [];
  const anchors: SegmentAnchor[] = [];

  items.forEach((item, index) => {
    const label = layoutItemSegmentLabel(item);
    const segment: DocumentSegment = {
      id: layoutItemSegmentId(item),
      label,
      pages: [],
      color:
        colors.get(label) ??
        colors.get(segmentDisplayLabel(label)) ??
        "var(--color-muted-foreground)",
      confidence: item.confidence ?? null,
      index,
      sourceId: item.id,
    };
    const page = pageByNumber.get(item.pageNumber);
    if (page) {
      const target = getScrollTarget(item, page);
      segment.pages = [target.pageNumber];
      anchors.push({
        id: `${segment.id}:anchor`,
        segmentId: segment.id,
        pageNumber: target.pageNumber,
        bounds: {
          x: target.left / 100,
          y: target.top / 100,
          width: target.width / 100,
          height: target.height / 100,
        },
      });
    }
    segments.push(segment);
  });

  return createSegmentedDocumentModel({
    anchors,
    pages: document.pages.map((page) => ({
      pageNumber: page.pageNumber,
      width: page.width,
      height: page.height,
    })),
    segments,
  });
}

function layoutItemSegmentLabel(item: LayoutItem): string {
  return segmentDisplayLabel(item.text || item.kind || item.level);
}

function layoutItemSegmentId(item: LayoutItem): string {
  return `layout:${item.id}`;
}
