"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2, Scissors } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-retab/tooltip";
import { type SplitView } from "@/components/viewers/lib/split-types";
import {
  buildPageRuns,
  buildSplitDiagramColorMap,
  getMaxSplitDiagramPage,
} from "@/components/viewers/split/split-segment-diagram-utils";
import { SplitSegmentDiagram } from "@/components/viewers/split/split-segment-diagram";

/** Handlers a document surface calls to keep the diagram/legend in sync. */
export interface SplitDocumentHandlers {
  onCurrentPageChange: (page: number) => void;
}

export interface SplitViewerProps {
  result: SplitView | null;
  isProcessing?: boolean;
  /** Render the source document (with split overlays, ideally). */
  renderDocument?: (handlers: SplitDocumentHandlers) => ReactNode;
}

export function buildSplitLegendItems(
  splitResult: SplitView,
  currentPage: number,
) {
  const colorMap = buildSplitDiagramColorMap(splitResult);
  const legendItemsByName = new Map<
    string,
    { name: string; color: string; isUsed: boolean; isActive: boolean }
  >();

  for (const split of splitResult.output) {
    const pageRuns = buildPageRuns(split.pages);
    const existing = legendItemsByName.get(split.name);
    const isUsed = pageRuns.length > 0;
    const isActive = pageRuns.some(
      (run) => currentPage >= run.start_page && currentPage < run.end_page + 1,
    );

    legendItemsByName.set(split.name, {
      name: split.name,
      color: existing?.color ?? colorMap.get(split.name) ?? "#4E79A7",
      isUsed: (existing?.isUsed ?? false) || isUsed,
      isActive: (existing?.isActive ?? false) || isActive,
    });
  }

  return Array.from(legendItemsByName.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function SplitLegendStrip({
  splitResult,
  currentPage,
}: {
  splitResult: SplitView;
  currentPage: number;
}) {
  const [isShowingAll, setIsShowingAll] = useState(false);
  const legendItems = useMemo(
    () => buildSplitLegendItems(splitResult, currentPage),
    [currentPage, splitResult],
  );

  const visibleLegendItems = isShowingAll
    ? legendItems
    : legendItems.filter((item) => item.isUsed);
  const hasHiddenItems = legendItems.some((item) => !item.isUsed);

  if (visibleLegendItems.length === 0) {
    return null;
  }

  return (
    <div
      className="shrink-0 border-b border-zinc-200 bg-white px-3 py-2 text-zinc-950"
      aria-label="Split legend"
    >
      <div className="grid grid-cols-4 gap-x-4 gap-y-1.5">
        {visibleLegendItems.map((item) => (
          <div key={item.name} className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="h-3 w-5 shrink-0 border border-zinc-950/50"
              style={{ backgroundColor: item.color }}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "truncate text-xs",
                    item.isActive
                      ? "font-semibold text-black"
                      : "font-normal text-gray-600",
                  )}
                >
                  {item.name}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs break-words">
                {item.name}
              </TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>
      {hasHiddenItems ? (
        <button
          type="button"
          className="mt-2 text-[10px] font-medium text-zinc-500 underline-offset-2 hover:text-zinc-950 hover:underline"
          onClick={() => setIsShowingAll((showingAll) => !showingAll)}
        >
          {isShowingAll ? "Hide unused" : "Show all"}
        </button>
      ) : null}
    </div>
  );
}

export function SplitViewer({
  result,
  isProcessing = false,
  renderDocument,
}: SplitViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const hasOutput = !!result && result.output.length > 0;
  const pageCount = useMemo(() => getMaxSplitDiagramPage(result), [result]);

  const handleJumpToPage = useCallback((page: number) => {
    if (!previewRef.current) return;
    const target = previewRef.current.querySelector<HTMLElement>(
      `[data-page-number="${page}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (!hasOutput) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 bg-gray-50 px-8 text-gray-400">
        {isProcessing ? (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
            <p className="text-center text-base text-gray-500">Splitting...</p>
          </>
        ) : (
          <>
            <Scissors className="h-16 w-16 text-gray-200" />
            <p className="text-center text-base text-gray-500">
              Run split to see output
            </p>
            <p className="max-w-sm text-center text-sm text-gray-400">
              Upload a document, define subdocuments, then click Run Split
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-full min-h-0">
        {pageCount > 0 ? (
          <div className="flex shrink-0 overflow-auto border-r border-zinc-200 bg-white">
            <SplitSegmentDiagram
              splitResult={result!}
              pageCount={pageCount}
              currentPage={currentPage}
              onSelectSplit={(_name, page) => handleJumpToPage(page)}
              onSelectVote={(_name, _voteIndex, page) => handleJumpToPage(page)}
              onJumpToPage={handleJumpToPage}
            />
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
          <SplitLegendStrip splitResult={result!} currentPage={currentPage} />
          <section ref={previewRef} className="min-h-0 flex-1 overflow-hidden">
            {renderDocument ? (
              renderDocument({ onCurrentPageChange: setCurrentPage })
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="text-sm text-zinc-500">
                  No document available
                </span>
              </div>
            )}
          </section>
        </div>
      </div>
    </TooltipProvider>
  );
}
