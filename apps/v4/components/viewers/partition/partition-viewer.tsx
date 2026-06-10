"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Key, Loader2 } from "lucide-react";

import type {
  PartitionChunk,
  PartitionResult,
} from "@/components/viewers/lib/partition-types";
import {
  PartitionWaterfall,
  buildPartitionRuns,
} from "@/components/viewers/partition/partition-waterfall";

/** Handlers a document surface calls to keep the waterfall in sync with scroll. */
export interface PartitionDocumentHandlers {
  onCurrentPageChange: (page: number) => void;
  onScrollProgressChange: (progress: number) => void;
}

export interface PartitionViewerProps {
  result: PartitionResult | null;
  isProcessing?: boolean;
  /**
   * Render the source document. Receives scroll/page handlers so the waterfall
   * highlights the active page. Omit to show a placeholder. The container sets
   * `data-page-number` on each rendered page to support jump-to-page.
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
  const previewPanelRef = useRef<HTMLDivElement | null>(null);
  const hasOutput = !!result && result.output.length > 0;

  const voteChoices = useMemo(
    () => result?.consensus.choices ?? [],
    [result?.consensus.choices],
  );

  const pageCount = useMemo(() => {
    if (!result) return 0;
    const collect = (chunks: PartitionChunk[]) =>
      chunks.reduce((max, c) => {
        const last = c.pages.length > 0 ? c.pages[c.pages.length - 1] : 0;
        return last > max ? last : max;
      }, 0);
    const fromOutput = collect(result.output);
    const fromVotes = voteChoices.reduce(
      (max, chunks) => Math.max(max, collect(chunks)),
      0,
    );
    return Math.max(fromOutput, fromVotes);
  }, [result, voteChoices]);

  const runs = useMemo(() => {
    if (!result || pageCount <= 0) return [];
    return buildPartitionRuns(result.output, voteChoices, pageCount);
  }, [result, voteChoices, pageCount]);

  const handleJumpToPage = useCallback((page: number) => {
    if (!previewPanelRef.current) return;
    const target = previewPanelRef.current.querySelector<HTMLElement>(
      `[data-page-number="${page}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
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
            {runs.length > 0 && pageCount > 0 && (
              <div className="max-h-[45%] flex-shrink-0 overflow-auto border-b border-gray-200">
                <PartitionWaterfall
                  runs={runs}
                  pageCount={pageCount}
                  currentPage={currentPageInt}
                  scrollProgress={scrollProgress}
                  onJumpToPage={handleJumpToPage}
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
