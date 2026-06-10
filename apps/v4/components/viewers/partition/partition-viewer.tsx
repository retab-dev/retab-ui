"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Key, Loader2 } from "lucide-react";

import type {
  PartitionChunk,
  PartitionResult,
} from "@/components/viewers/lib/partition-types";
import { type Segment, buildColorMap } from "@/lib/segments";
import { SegmentLegend } from "@/components/ui/segment-legend";
import { PageRibbon, type RibbonRow } from "@/components/ui/page-ribbon";

/** Handlers a document surface calls to keep the ribbon in sync with scroll. */
export interface PartitionDocumentHandlers {
  onCurrentPageChange: (page: number) => void;
  onScrollProgressChange: (progress: number) => void;
}

export interface PartitionViewerProps {
  result: PartitionResult | null;
  isProcessing?: boolean;
  /**
   * Render the source document. Receives scroll/page handlers so the ribbon
   * highlights the active page. The container sets `data-page-number` on each
   * rendered page to support jump-to-page.
   */
  renderDocument?: (handlers: PartitionDocumentHandlers) => ReactNode;
}

export function PartitionViewer({
  result,
  isProcessing = false,
  renderDocument,
}: PartitionViewerProps) {
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const previewPanelRef = useRef<HTMLDivElement | null>(null);
  const hasOutput = !!result && result.output.length > 0;

  const voteChoices = useMemo(
    () => result?.consensus.choices ?? [],
    [result?.consensus.choices],
  );

  const pageCount = useMemo(() => {
    if (!result) return 0;
    const lastPage = (chunks: PartitionChunk[]) =>
      chunks.reduce(
        (max, c) => Math.max(max, c.pages.length ? c.pages[c.pages.length - 1] : 0),
        0,
      );
    return Math.max(
      lastPage(result.output),
      voteChoices.reduce((m, chunks) => Math.max(m, lastPage(chunks)), 0),
    );
  }, [result, voteChoices]);

  // One color per chunk key, shared across the consensus and every vote so the
  // same key is one color everywhere. `id` is the key, so hovering it in the
  // legend dims every other key across all rows.
  const { legendSegments, rows } = useMemo(() => {
    if (!result) return { legendSegments: [] as Segment[], rows: [] as RibbonRow[] };
    const colors = buildColorMap([
      ...result.output.map((c) => c.key),
      ...voteChoices.flat().map((c) => c.key),
    ]);
    const seg = (c: PartitionChunk): Segment => ({
      id: c.key,
      label: c.key,
      pages: [...c.pages].sort((a, b) => a - b),
      color: colors.get(c.key) ?? "#888888",
      index: 0,
    });

    const legendByKey = new Map<string, Segment>();
    for (const c of result.output) {
      const existing = legendByKey.get(c.key);
      legendByKey.set(c.key, existing ? { ...existing, pages: [...existing.pages, ...c.pages] } : seg(c));
    }

    const ribbonRows: RibbonRow[] = [
      ...result.output.map((c, i) => ({ id: `c-${i}`, segments: [seg(c)] })),
      ...voteChoices.flatMap((chunks, vi) =>
        chunks.map((c, i) => ({ id: `v${vi}-${i}`, segments: [seg(c)] })),
      ),
    ];
    return { legendSegments: [...legendByKey.values()], rows: ribbonRows };
  }, [result, voteChoices]);

  const handleJumpToPage = useCallback((page: number) => {
    previewPanelRef.current
      ?.querySelector<HTMLElement>(`[data-page-number="${page}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const currentPageInt = Math.max(1, Math.floor(currentPdfPage));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {!hasOutput ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gray-50 px-8 text-gray-400">
            {isProcessing ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
                <p className="text-center text-base text-gray-500">
                  Partitioning...
                </p>
              </>
            ) : (
              <>
                <Key className="h-16 w-16 text-gray-200" />
                <p className="text-center text-base text-gray-500">
                  Run partition to see output
                </p>
                <p className="max-w-sm text-center text-sm text-gray-400">
                  Upload a document, set a key and instructions, then click Run
                  Partition
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {rows.length > 0 && pageCount > 0 && (
              <div className="max-h-[45%] flex-shrink-0 space-y-2 overflow-auto border-b border-gray-200 bg-white px-3 py-2">
                <SegmentLegend
                  segments={legendSegments}
                  currentPage={currentPageInt}
                  activeId={activeId}
                  onActivate={setActiveId}
                  onSelect={(id) => {
                    const seg = legendSegments.find((s) => s.id === id);
                    if (seg?.pages.length) handleJumpToPage(seg.pages[0]);
                  }}
                  columns={4}
                />
                <PageRibbon
                  orientation="horizontal"
                  rows={rows}
                  pageCount={pageCount}
                  currentPage={currentPageInt}
                  scrollProgress={scrollProgress}
                  activeId={activeId}
                  onActivate={setActiveId}
                  onSelectPage={handleJumpToPage}
                />
              </div>
            )}
            <section
              ref={previewPanelRef}
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white"
            >
              {isProcessing ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : renderDocument ? (
                renderDocument({
                  onCurrentPageChange: setCurrentPdfPage,
                  onScrollProgressChange: setScrollProgress,
                })
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="text-sm text-zinc-500">
                    No document available
                  </span>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
