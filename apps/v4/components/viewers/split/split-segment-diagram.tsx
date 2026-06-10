"use client";

import { useMemo, useState } from "react";

import type { SplitView } from "@/components/viewers/lib/split-types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-retab/tooltip";
import { cn } from "@/lib/utils";

import {
  buildSplitDiagramRows,
  type SplitDiagramSegment,
} from "@/components/viewers/split/split-segment-diagram-utils";

const HORIZONTAL_GAP = 12;
const PAGE_AXIS_W = 12;
const SEGMENT_MAX_W = 48;
const SEGMENT_X = HORIZONTAL_GAP + PAGE_AXIS_W + HORIZONTAL_GAP;
const PAGE_LABEL_X = HORIZONTAL_GAP + PAGE_AXIS_W / 2;
const SEGMENT_OUTER_GAP = SEGMENT_X;
const PAD = {
  top: 24,
  right: SEGMENT_OUTER_GAP,
  bottom: 20,
  left: SEGMENT_OUTER_GAP,
};

type SplitDiagramRow = ReturnType<typeof buildSplitDiagramRows>[number];

type HoveredSegment = {
  row: SplitDiagramRow;
  segment: SplitDiagramSegment;
  centerPercent: number;
} | null;

function compareSegmentsByPage(
  left: SplitDiagramSegment,
  right: SplitDiagramSegment,
): number {
  return (
    left.startPage - right.startPage ||
    left.endPage - right.endPage ||
    left.splitName.localeCompare(right.splitName)
  );
}

function buildTicks(pageCount: number): number[] {
  if (pageCount <= 0) return [];

  const tickStep = Math.max(10, Math.round(pageCount / 10 / 5) * 5);
  const ticks: number[] = [1];
  for (let page = tickStep; page <= pageCount; page += tickStep) {
    ticks.push(page);
  }
  if (ticks[ticks.length - 1] !== pageCount) {
    ticks.push(pageCount);
  }
  return ticks;
}

function segmentContainsFractionalPage(
  startPage: number,
  endPage: number,
  page: number,
) {
  return page >= startPage && page < endPage + 1;
}

function clampPage(pageCount: number, page: number) {
  return Math.max(1, Math.min(pageCount + 1, page));
}

interface SplitSegmentDiagramProps {
  splitResult: SplitView;
  pageCount: number;
  currentPage: number;
  onSelectSplit: (splitName: string, page: number) => void;
  onSelectVote: (splitName: string, voteIndex: number, page: number) => void;
  onJumpToPage: (page: number) => void;
  variant?: "panel" | "header";
  trackCurrentPage?: boolean;
  selectedRowId?: string;
}

export function SplitSegmentDiagram({
  splitResult,
  pageCount,
  currentPage,
  onSelectSplit,
  onSelectVote,
  onJumpToPage,
  variant = "panel",
  trackCurrentPage = true,
  selectedRowId,
}: SplitSegmentDiagramProps) {
  const rows = useMemo(() => buildSplitDiagramRows(splitResult), [splitResult]);
  const visibleRows = useMemo(() => {
    if (variant === "header") {
      return rows.slice(0, 1);
    }

    const selectedRow = rows.find((row) => row.id === selectedRowId);
    return selectedRow ? [selectedRow] : rows.slice(0, 1);
  }, [rows, selectedRowId, variant]);
  const orderedRows = useMemo(
    () =>
      visibleRows.map((row) => ({
        ...row,
        segments: [...row.segments].sort(compareSegmentsByPage),
      })),
    [visibleRows],
  );
  const [hovered, setHovered] = useState<HoveredSegment>(null);

  if (orderedRows.length === 0 || pageCount <= 0) {
    return null;
  }

  const columnCount = orderedRows.length;
  const columnWidth = SEGMENT_MAX_W;
  const innerWidth = columnWidth * columnCount;
  const viewWidth = PAD.left + innerWidth + PAD.right;
  const yPercentFor = (page: number) => ((page - 1) / pageCount) * 100;
  const hPercentFor = (startPage: number, endPage: number) =>
    ((endPage - startPage + 1) / pageCount) * 100;
  const ticks = buildTicks(pageCount);
  const cursorPercent = yPercentFor(clampPage(pageCount, currentPage));
  const row = orderedRows[0];

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col text-zinc-950",
        variant === "header" ? "py-2" : null,
      )}
    >
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ width: viewWidth }}
        aria-label="Split result page ribbon"
      >
        <div
          className="absolute rounded-[3px] bg-zinc-50"
          style={{
            left: PAD.left,
            top: PAD.top,
            bottom: PAD.bottom,
            width: columnWidth,
          }}
        >
          {row.segments.map((segment, segmentIndex) => {
            const startPage = Math.max(1, segment.startPage);
            const endPage = Math.min(pageCount, segment.endPage);
            if (endPage < startPage) {
              return null;
            }

            const topPercent = yPercentFor(startPage);
            const heightPercent = hPercentFor(startPage, endPage);
            const centerPercent = topPercent + heightPercent / 2;
            const isHovered =
              hovered?.row.id === row.id && hovered.segment.id === segment.id;
            const isActive =
              trackCurrentPage &&
              segmentContainsFractionalPage(startPage, endPage, currentPage);
            const range =
              startPage === endPage
                ? `page ${startPage}`
                : `pages ${startPage}-${endPage} (${endPage - startPage + 1})`;

            return (
              <Tooltip key={`${row.id}-${segment.id}-${segmentIndex}`}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="absolute left-0 w-full cursor-pointer rounded-[1px] border-x border-b border-x-zinc-100 border-b-white transition-opacity focus-visible:outline-none"
                    style={{
                      top: `${topPercent}%`,
                      height: `max(${heightPercent}%, 1.4px)`,
                      backgroundColor: segment.color,
                      opacity: hovered
                        ? isHovered
                          ? 1
                          : 0.5
                        : isActive
                          ? 1
                          : 0.82,
                      boxShadow:
                        isHovered || isActive
                          ? "inset 0 0 0 1.5px rgb(24 24 27)"
                          : undefined,
                    }}
                    onClick={() => {
                      if (row.voteIndex != null) {
                        onSelectVote(
                          segment.splitName,
                          row.voteIndex,
                          startPage,
                        );
                      } else {
                        onSelectSplit(segment.splitName, startPage);
                      }
                      onJumpToPage(startPage);
                    }}
                    onMouseEnter={() =>
                      setHovered({
                        row,
                        segment,
                        centerPercent,
                      })
                    }
                    onMouseLeave={() => setHovered(null)}
                    aria-label={`${row.label} · ${segment.splitName} pages ${startPage}-${endPage}`}
                  />
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="center"
                  sideOffset={8}
                  className="border border-zinc-300 bg-white px-2 py-1 font-mono text-zinc-500 shadow-sm [&>svg]:!bg-white [&>svg]:!fill-white [&>svg]:stroke-zinc-300"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span
                      className="max-w-32 truncate text-[10px] font-bold"
                      style={{ color: segment.color }}
                    >
                      {segment.splitName}
                    </span>
                  </div>
                  <div className="pl-3.5 text-[9px] whitespace-nowrap text-zinc-500">
                    {range}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {ticks.map((page) => (
            <div
              key={page}
              className="pointer-events-none absolute left-0 h-0 w-full"
              style={{ top: `${yPercentFor(page)}%` }}
            >
              <div className="absolute top-0 right-[-5px] h-px w-[3px] bg-zinc-400" />
              <div className="absolute top-[-6px] left-[calc(100%+8px)] w-10 text-left font-mono text-[9px] leading-none text-zinc-500 tabular-nums">
                {page}
              </div>
            </div>
          ))}

          {trackCurrentPage ? (
            <div
              className="pointer-events-none absolute left-0 h-0 w-full"
              style={{ top: `${cursorPercent}%` }}
            >
              <div
                className="absolute top-[-0.625px] left-[-2px] h-[1.25px] bg-zinc-900"
                style={{ width: columnWidth + 4 }}
              />
              <div className="absolute top-[-4px] left-[-8px] h-0 w-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-zinc-900" />
            </div>
          ) : null}
        </div>

        <div
          className="pointer-events-none absolute font-mono text-[9px] leading-none tracking-[0.2em] text-zinc-500 uppercase"
          style={{
            left: PAGE_LABEL_X,
            top: `calc(${PAD.top}px + (100% - ${PAD.top + PAD.bottom}px) / 2)`,
            transform: "translate(-50%, -50%) rotate(-90deg)",
          }}
        >
          page
        </div>
      </div>
    </div>
  );
}
