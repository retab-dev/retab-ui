"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-retab/tooltip";

import type { PartitionChunk } from "@/components/viewers/lib/partition-types";

const TABLEAU20 = [
  "#4E79A7",
  "#A0CBE8",
  "#F28E2B",
  "#FFBE7D",
  "#59A14F",
  "#8CD17D",
  "#B6992D",
  "#F1CE63",
  "#499894",
  "#86BCB6",
  "#E15759",
  "#FF9D9A",
  "#79706E",
  "#BAB0AC",
  "#D37295",
  "#FABFD2",
  "#B07AA1",
  "#D4A6C8",
  "#9D7660",
  "#D7B5A6",
];

export interface WaterfallRow {
  id: string;
  key: string;
  startPage: number;
  endPage: number;
  pages: number[];
}

export interface WaterfallRun {
  id: string;
  label: string;
  rows: WaterfallRow[];
  coveredPages: number;
  missingPages: number[];
  isFullPartition: boolean;
}

function chunksToRows(chunks: PartitionChunk[], runId: string): WaterfallRow[] {
  return chunks
    .map((chunk, index) => {
      const pages = [...chunk.pages].sort((a, b) => a - b);
      const startPage = pages[0] ?? 1;
      const endPage = pages[pages.length - 1] ?? startPage;
      return {
        id: `${runId}-${chunk.key}-${index}`,
        key: chunk.key,
        startPage,
        endPage,
        pages,
      };
    })
    .sort(
      (a, b) =>
        a.startPage - b.startPage ||
        a.endPage - b.endPage ||
        a.key.localeCompare(b.key),
    );
}

function auditCoverage(rows: WaterfallRow[], pageCount: number) {
  const coverage = new Array<number>(pageCount + 1).fill(0);
  for (const row of rows) {
    for (const page of row.pages) {
      if (page >= 1 && page <= pageCount) coverage[page] += 1;
    }
  }
  const missingPages: number[] = [];
  let coveredPages = 0;
  for (let page = 1; page <= pageCount; page += 1) {
    if (coverage[page] === 0) {
      missingPages.push(page);
    } else {
      coveredPages += 1;
    }
  }
  return {
    coveredPages,
    missingPages,
    isFullPartition: missingPages.length === 0,
  };
}

export function buildPartitionRuns(
  output: PartitionChunk[],
  voteChoices: PartitionChunk[][],
  pageCount: number,
): WaterfallRun[] {
  const consolidation = chunksToRows(output, "consensus");
  const consolidationAudit = auditCoverage(consolidation, pageCount);
  const runs: WaterfallRun[] = [
    {
      id: "consensus",
      label: "consensus",
      rows: consolidation,
      ...consolidationAudit,
    },
  ];
  voteChoices.forEach((chunks, index) => {
    const runId = `vote-${index + 1}`;
    const rows = chunksToRows(chunks, runId);
    runs.push({
      id: runId,
      label: `vote ${index + 1}`,
      rows,
      ...auditCoverage(rows, pageCount),
    });
  });
  return runs;
}

function rowContainsPage(row: WaterfallRow, page: number) {
  return page >= row.startPage && page < row.endPage + 1;
}

function PageMarker({ scrollProgress }: { scrollProgress: number }) {
  const progress = Math.max(0, Math.min(1, scrollProgress));
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 w-px bg-indigo-500/80"
      style={{ left: `${progress * 100}%` }}
    />
  );
}

function PartitionRunCard({
  run,
  pageCount,
  currentPage,
  scrollProgress,
  colorFor,
  onJumpToPage,
}: {
  run: WaterfallRun;
  pageCount: number;
  currentPage: number;
  scrollProgress: number;
  colorFor: (key: string) => string;
  onJumpToPage: (page: number) => void;
}) {
  return (
    <section className="flex flex-col">
      {run.rows.map((row) => {
        const active = rowContainsPage(row, currentPage);
        return (
          <div key={row.id} className="relative h-2 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${pageCount}, minmax(0, 1fr))`,
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onJumpToPage(row.startPage)}
                    className={cn(
                      "h-full cursor-pointer transition-all hover:brightness-110 focus-visible:outline-none",
                      active
                        ? "ring-1 ring-indigo-500 ring-inset"
                        : "opacity-80 hover:opacity-100",
                    )}
                    style={{
                      gridColumn: `${row.startPage} / ${row.endPage + 1}`,
                      backgroundColor: colorFor(row.key),
                    }}
                    aria-label={`${run.label} · ${row.key} pages ${row.startPage}-${row.endPage}`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="font-mono">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">{row.key}</span>
                    <span className="text-[10px] opacity-80">
                      pages {row.startPage}–{row.endPage} ({row.pages.length})
                    </span>
                    <span className="text-[10px] opacity-60">
                      click to jump to page {row.startPage}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <PageMarker scrollProgress={scrollProgress} />
          </div>
        );
      })}
    </section>
  );
}

export function PartitionWaterfall({
  runs,
  pageCount,
  currentPage,
  scrollProgress,
  onJumpToPage,
  className,
}: {
  runs: WaterfallRun[];
  pageCount: number;
  currentPage: number;
  scrollProgress: number;
  onJumpToPage: (page: number) => void;
  className?: string;
}) {
  const keys = useMemo(() => {
    const set = new Set<string>();
    for (const run of runs) {
      for (const row of run.rows) set.add(row.key);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [runs]);

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    keys.forEach((key, index) =>
      map.set(key, TABLEAU20[index % TABLEAU20.length]),
    );
    return map;
  }, [keys]);
  const colorFor = (key: string) => colorMap.get(key) ?? "#888";

  if (pageCount <= 0 || runs.length === 0) return null;

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col", className)}>
        {runs.map((run) => (
          <PartitionRunCard
            key={run.id}
            run={run}
            pageCount={pageCount}
            currentPage={currentPage}
            scrollProgress={scrollProgress}
            colorFor={colorFor}
            onJumpToPage={onJumpToPage}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}
