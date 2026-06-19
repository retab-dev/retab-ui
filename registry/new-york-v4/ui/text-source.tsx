"use client";

import * as React from "react";

import type { Source, SourceAnchor } from "@/lib/document-source";
import type { TextLineRange } from "@/components/ui/text-viewer-ranges";

interface TextSourceHandle {
  scrollToLineRange: (range: TextLineRange, options?: ScrollToOptions) => void;
}

export interface SourceTarget {
  scrollTo?: (source: Source, options: { behavior: ScrollBehavior }) => void;
}

/** A text_span anchor → a 1-based inclusive line range. */
export function textAnchorToTarget(
  anchor: SourceAnchor,
): TextLineRange | undefined {
  if (anchor.kind === "text_span") {
    if (
      !Number.isInteger(anchor.line_start) ||
      !Number.isInteger(anchor.line_end) ||
      anchor.line_start < 1 ||
      anchor.line_end < anchor.line_start ||
      !isValidOptionalRange(anchor.char_start, anchor.char_end)
    ) {
      return undefined;
    }
    return { start: anchor.line_start, end: anchor.line_end };
  }
  return undefined;
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

/** A stable source target over a text-like viewer ref. */
export function useTextSourceTarget(
  viewerRef: React.RefObject<TextSourceHandle | null>,
): SourceTarget {
  return React.useMemo<SourceTarget>(
    () => ({
      scrollTo: (source: Source, options) => {
        const target = textAnchorToTarget(source.anchor);
        if (target) viewerRef.current?.scrollToLineRange(target, options);
      },
    }),
    [viewerRef],
  );
}

/**
 * The line-range highlight prop derived from a source.
 */
export function sourceToTextHighlight(
  source: Source | undefined,
): TextLineRange | null {
  return source ? textAnchorToTarget(source.anchor) || null : null;
}
