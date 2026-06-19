"use client";

import * as React from "react";

import type { Source, SourceAnchor } from "@/lib/document-source";
import type { DocxTarget, DocxViewerHandle } from "@/components/ui/docx-viewer";

export interface SourceTarget {
  scrollTo?: (source: Source, options: { behavior: ScrollBehavior }) => void;
}

/**
 * A docx anchor + source payload -> a viewer-ready `DocxTarget`, or null when
 * the anchor is not a docx anchor. Text spans carry the quoted `content` from
 * the source; table cells carry their index. The adapter resolves the source
 * model, while the viewer resolves the rendered DOM.
 */
export function docxAnchorToTarget(
  anchor: SourceAnchor | undefined,
  source?: Source,
): DocxTarget | null {
  if (!anchor) return null;
  if (anchor.kind === "docx_text_span") {
    if (
      !isNonNegativeInteger(anchor.paragraph) ||
      !isValidOptionalRange(anchor.char_start, anchor.char_end)
    )
      return null;
    const text = source?.content.trim();
    return text ? { kind: "text", text } : null;
  }
  if (anchor.kind === "docx_table_cell") {
    if (
      !isNonNegativeInteger(anchor.table) ||
      !isNonNegativeInteger(anchor.row) ||
      !isNonNegativeInteger(anchor.column) ||
      !isValidOptionalRange(anchor.char_start, anchor.char_end)
    )
      return null;
    return {
      kind: "cell",
      table: anchor.table,
      row: anchor.row,
      column: anchor.column,
    };
  }
  return null;
}

function isNonNegativeInteger(value: number) {
  return Number.isInteger(value) && value >= 0;
}

function isValidOptionalRange(start?: number, end?: number) {
  if (start == null && end == null) return true;
  if (start == null || end == null) return false;
  return (
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    end >= start
  );
}

/** A stable source target over a `DocxViewer` ref. */
export function useDocxSourceTarget(
  viewerRef: React.RefObject<DocxViewerHandle | null>,
): SourceTarget {
  return React.useMemo<SourceTarget>(
    () => ({
      scrollTo: (source: Source, options) => {
        const target = docxAnchorToTarget(source.anchor, source);
        if (target) viewerRef.current?.scrollToTarget(target, options);
      },
    }),
    [viewerRef],
  );
}

/**
 * The `highlight` prop for `DocxViewer` derived from a source; non-docx
 * anchors resolve to null.
 */
export function sourceToDocxHighlight(
  source: Source | undefined,
): DocxTarget | null {
  return source ? docxAnchorToTarget(source.anchor, source) : null;
}
