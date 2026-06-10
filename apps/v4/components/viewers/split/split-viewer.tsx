"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2, Scissors } from "lucide-react";

import { type SplitView } from "@/components/viewers/lib/split-types";
import { segmentsPageCount, toSegments } from "@/lib/segments";
import { SegmentLegend } from "@/components/ui/segment-legend";
import { PageRibbon } from "@/components/ui/page-ribbon";

/**
 * Handlers a document surface receives. `header` (the legend) and `aside` (the
 * page ribbon) are the viewer's chrome — the surface renders them around the
 * document so the document's own controls stay on top.
 */
export interface SplitDocumentHandlers {
  onCurrentPageChange: (page: number) => void;
  header: ReactNode;
  aside: ReactNode;
}

export interface SplitViewerProps {
  result: SplitView | null;
  isProcessing?: boolean;
  renderDocument?: (handlers: SplitDocumentHandlers) => ReactNode;
}

export function SplitViewer({
  result,
  isProcessing = false,
  renderDocument,
}: SplitViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const hasOutput = !!result && result.output.length > 0;

  const segments = useMemo(
    () => toSegments(result?.output ?? []),
    [result?.output],
  );
  const pageCount = useMemo(() => segmentsPageCount(segments), [segments]);

  const handleJumpToPage = useCallback((page: number) => {
    previewRef.current
      ?.querySelector<HTMLElement>(`[data-page-number="${page}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  // The legend sits below the document toolbar; the ribbon is the left rail.
  const header = (
    <div className="border-b border-zinc-200 bg-white px-3 py-2">
      <SegmentLegend
        segments={segments}
        currentPage={currentPage}
        activeId={activeId}
        onActivate={setActiveId}
        onSelect={(id) => {
          const seg = segments.find((s) => s.id === id);
          if (seg?.pages.length) handleJumpToPage(seg.pages[0]);
        }}
        columns={4}
        showUnusedToggle
      />
    </div>
  );

  const aside =
    pageCount > 0 ? (
      <div className="h-full overflow-auto border-r border-zinc-200 bg-white px-3 py-6">
        <PageRibbon
          orientation="vertical"
          rows={[{ id: "split", segments }]}
          pageCount={pageCount}
          currentPage={currentPage}
          activeId={activeId}
          onActivate={setActiveId}
          onSelectPage={handleJumpToPage}
          showTicks
        />
      </div>
    ) : null;

  return (
    <div ref={previewRef} className="flex min-h-0 flex-1 bg-white">
      {renderDocument ? (
        renderDocument({ onCurrentPageChange: setCurrentPage, header, aside })
      ) : (
        <div className="flex h-full flex-1 items-center justify-center">
          <span className="text-sm text-zinc-500">No document available</span>
        </div>
      )}
    </div>
  );
}
