"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2, Tags } from "lucide-react";

import { type Segment, buildColorMap } from "@/lib/segments";
import { SegmentLegend } from "@/components/ui/segment-legend";
import type { ClassifyResult } from "@/components/viewers/lib/classify-types";

/**
 * Handlers a document surface receives. `header` (the category legend) is the
 * viewer's chrome — the surface renders it below the document toolbar, exactly
 * like the partition viewer.
 */
export interface ClassifierDocumentHandlers {
  header: ReactNode;
}

export interface ClassifierViewerProps {
  result: ClassifyResult | null;
  isProcessing?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  renderDocument?: (handlers: ClassifierDocumentHandlers) => ReactNode;
}

/**
 * A classification is a single category over the whole document, so it reduces
 * to one `Segment` — shown as a swatch + label in the legend. No bespoke chrome:
 * the same file + legend system the split and partition viewers use.
 */
export function ClassifierViewer({
  result,
  isProcessing = false,
  emptyTitle = "Run classify to see output",
  emptyDescription = "Provide input, define categories, and click Run Classify",
  renderDocument,
}: ClassifierViewerProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const category = result?.category ?? null;
  const reasoning = result?.reasoning?.trim() || null;

  const segments = useMemo<Segment[]>(() => {
    if (!category) return [];
    const colors = buildColorMap([category]);
    return [
      {
        id: "classification",
        label: category,
        pages: [1],
        color: colors.get(category) ?? "#4E79A7",
        index: 0,
      },
    ];
  }, [category]);

  const handleJumpToTop = useCallback(() => {
    previewRef.current
      ?.querySelector<HTMLElement>(`[data-page-number="1"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (!category) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 bg-muted px-8 text-muted-foreground">
        {isProcessing ? (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-center text-base text-muted-foreground">Classifying...</p>
          </>
        ) : (
          <>
            <Tags className="h-16 w-16 text-muted-foreground" />
            <p className="text-center text-base text-muted-foreground">{emptyTitle}</p>
            <p className="max-w-sm text-center text-sm text-muted-foreground">
              {emptyDescription}
            </p>
          </>
        )}
      </div>
    );
  }

  // The category legend sits below the document toolbar. The reasoning rides
  // along as a muted caption — the only classify-specific detail, passed to the
  // legend's `caption` slot rather than wrapped in chrome of its own.
  const header = (
    <SegmentLegend
      segments={segments}
      activeId={activeId}
      onActivate={setActiveId}
      onSelect={handleJumpToTop}
      caption={reasoning ? <span title={reasoning}>{reasoning}</span> : undefined}
    />
  );

  return (
    <div ref={previewRef} className="flex min-h-0 flex-1 bg-background">
      {renderDocument ? (
        renderDocument({ header })
      ) : (
        <div className="flex h-full flex-1 items-center justify-center">
          <span className="text-sm text-muted-foreground">No document available</span>
        </div>
      )}
    </div>
  );
}
