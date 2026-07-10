"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  FileViewer,
  FileViewerContent,
  FileViewerControls,
  FileViewerHeader,
  FileViewerInset,
  FileViewerLegend,
  FileViewerProvider,
  FileViewerSidebar,
  FileViewerSidebarContent,
  FileViewerSidebarHeader,
  FileViewerSidebarTrigger,
  FileViewerTitle,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import {
  PdfViewerPages,
  PdfViewerProvider,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer";
import { PageRibbon, type RibbonRow } from "@/components/ui/page-ribbon";
import { SegmentLegend } from "@/components/ui/segment-legend";
import type { DocumentSegment } from "@/components/ui/segmented-document-model";
import { useSegmentInteraction } from "@/components/ui/use-segment-interaction";

type SegmentVoteCounts = Record<string, number>;

type Segment = {
  type: string;
  startPage: number;
  endPage: number;
};

type SegmentRow = {
  id: string;
  label: string;
  shortLabel: string;
  ribbonSegments: DocumentSegment[];
};

type SegmentDiagramDoc = {
  fileName: string;
  label: string;
  pageCount: number;
  pdfUrl: string;
  legendSegments: DocumentSegment[];
  rows: SegmentRow[];
  ribbonRows: RibbonRow[];
  diffRibbonRow: RibbonRow;
};

type DiagramOrientation = "horizontal" | "vertical";
type DiagramSegmentInteraction = ReturnType<typeof useSegmentInteraction>;

const HARRIS_SOURCE = {
  kind: "url" as const,
  url: "/samples/harris_2023_federal_state_returns.pdf",
  fileName: "harris_2023_federal_state_returns.pdf",
};

const TYPE_COLORS = new Map<string, string>([
  ["Form 1040", "#4E79A7"],
  ["misc_form", "#F28E2B"],
  ["Schedule 2 (Form 1040)", "#59A14F"],
  ["Schedule B (Form 1040)", "#B6992D"],
  ["Schedule H (Form 1040)", "#499894"],
  ["supplement", "#E15759"],
  ["Form 8960", "#A0CBE8"],
  ["Schedule 1 (Form 1040)", "#FFBE7D"],
  ["Schedule A (Form 1040)", "#8CD17D"],
  ["Schedule C (Form 1040)", "#F1CE63"],
  ["Schedule SE (Form 1040)", "#86BCB6"],
]);

const TYPE_ORDER = Array.from(TYPE_COLORS.keys());

/** Floor for the diff shading so a single dissenting vote still reads clearly. */
const DIFF_MIN_PERCENT = 40;

const VOTE_SEGMENTS: Segment[][] = [
  [
    segment("Form 1040", 1, 2),
    segment("Schedule 1 (Form 1040)", 3, 4),
    segment("Schedule 2 (Form 1040)", 5, 6),
    segment("Schedule A (Form 1040)", 7, 7),
    segment("Schedule B (Form 1040)", 8, 8),
    segment("Schedule C (Form 1040)", 9, 9),
    segment("Schedule SE (Form 1040)", 10, 10),
    segment("Schedule H (Form 1040)", 11, 12),
    segment("misc_form", 13, 13),
    segment("Form 8960", 14, 14),
    segment("supplement", 15, 20),
    segment("misc_form", 21, 40),
  ],
  [
    segment("Form 1040", 1, 2),
    segment("Schedule 1 (Form 1040)", 3, 4),
    segment("Schedule 2 (Form 1040)", 5, 6),
    segment("Schedule A (Form 1040)", 7, 7),
    segment("Schedule B (Form 1040)", 8, 8),
    segment("Schedule C (Form 1040)", 9, 9),
    segment("Schedule SE (Form 1040)", 10, 10),
    segment("Schedule H (Form 1040)", 11, 12),
    segment("misc_form", 13, 13),
    segment("Form 8960", 14, 14),
    segment("supplement", 15, 20),
    segment("misc_form", 21, 39),
    segment("supplement", 40, 40),
  ],
  [
    segment("Form 1040", 1, 2),
    segment("Schedule 1 (Form 1040)", 3, 4),
    segment("Schedule 2 (Form 1040)", 5, 6),
    segment("Schedule A (Form 1040)", 7, 7),
    segment("Schedule B (Form 1040)", 8, 8),
    segment("Schedule C (Form 1040)", 9, 9),
    segment("Schedule SE (Form 1040)", 10, 10),
    segment("Schedule H (Form 1040)", 11, 12),
    segment("misc_form", 13, 13),
    segment("Form 8960", 14, 15),
    segment("supplement", 16, 20),
    segment("misc_form", 21, 39),
    segment("supplement", 40, 40),
  ],
  [
    segment("Form 1040", 1, 2),
    segment("Schedule 1 (Form 1040)", 3, 4),
    segment("Schedule 2 (Form 1040)", 5, 6),
    segment("Schedule A (Form 1040)", 7, 7),
    segment("Schedule B (Form 1040)", 8, 8),
    segment("Schedule C (Form 1040)", 9, 9),
    segment("Schedule SE (Form 1040)", 10, 10),
    segment("Schedule H (Form 1040)", 11, 12),
    segment("misc_form", 13, 13),
    segment("Form 8960", 14, 14),
    segment("supplement", 15, 20),
    segment("misc_form", 21, 40),
  ],
  [
    segment("Form 1040", 1, 2),
    segment("Schedule 1 (Form 1040)", 3, 4),
    segment("Schedule 2 (Form 1040)", 5, 6),
    segment("Schedule A (Form 1040)", 7, 7),
    segment("Schedule B (Form 1040)", 8, 8),
    segment("Schedule C (Form 1040)", 9, 9),
    segment("Schedule SE (Form 1040)", 10, 10),
    segment("Schedule H (Form 1040)", 11, 12),
    segment("misc_form", 13, 13),
    segment("Form 8960", 14, 14),
    segment("supplement", 15, 20),
    segment("misc_form", 21, 39),
    segment("supplement", 40, 40),
  ],
];

const HARRIS_CONSOLIDATION_SEGMENTS = weightedConsolidationSegments(
  VOTE_SEGMENTS,
  40,
);
const HARRIS_SEGMENT_ROWS: SegmentRow[] = [
  createSegmentRow(
    "harris-consolidation",
    "consolidation",
    "cons",
    HARRIS_CONSOLIDATION_SEGMENTS,
  ),
  ...VOTE_SEGMENTS.map((segments, index) =>
    createSegmentRow(
      `harris-vote-${index + 1}`,
      `vote ${index + 1}`,
      `v${index + 1}`,
      segments,
    ),
  ),
];

const HARRIS_SEGMENT_DOC: SegmentDiagramDoc = {
  fileName: HARRIS_SOURCE.fileName,
  label: "Harris 2023 Federal / State Returns",
  pageCount: 40,
  pdfUrl: HARRIS_SOURCE.url,
  legendSegments: createLegendSegments(HARRIS_CONSOLIDATION_SEGMENTS),
  rows: HARRIS_SEGMENT_ROWS,
  ribbonRows: HARRIS_SEGMENT_ROWS.map(toRibbonRow),
  diffRibbonRow: createDiffRibbonRow({
    id: "harris-diff",
    voteRows: VOTE_SEGMENTS,
    pageCount: 40,
  }),
};

export function SplitConsensusSegmentDiagramViewer({
  orientation,
}: {
  orientation: DiagramOrientation;
}) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const segmentInteraction = useSegmentInteraction();
  const pdfRef = React.useRef<PdfViewerHandle | null>(null);
  const isHorizontal = orientation === "horizontal";

  const jumpToPage = React.useCallback((page: number) => {
    const nextPage = clampPage(page, HARRIS_SEGMENT_DOC.pageCount);
    setCurrentPage(nextPage);
    pdfRef.current?.scrollToPage(nextPage, { behavior: "smooth" });
  }, []);

  return (
    <div className="bg-background text-foreground flex h-full min-h-[760px] flex-col">
      <FileViewerProvider source={HARRIS_SOURCE} defaultSidebarOpen>
        <FileViewer className="bg-background">
          <PdfViewerProvider>
            <FileViewerHeader>
              <FileViewerSidebarTrigger className="-ms-1" />
              <FileViewerTitle />
              <FileViewerControls />
            </FileViewerHeader>
            <FileViewerContent>
              <FileViewerSidebar
                aria-label={
                  isHorizontal
                    ? "Horizontal split consensus diagram"
                    : "Vertical split consensus diagram"
                }
                width={isHorizontal ? "42rem" : "24rem"}
                className="border-r"
              >
                {isHorizontal ? (
                  <FileViewerSidebarHeader className="min-h-12">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Segment diagram</div>
                      <div className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                        {HARRIS_SEGMENT_DOC.rows.length - 1} votes /{" "}
                        {HARRIS_SEGMENT_DOC.pageCount} pages
                      </div>
                    </div>
                  </FileViewerSidebarHeader>
                ) : null}
                <FileViewerSidebarContent>
                  {isHorizontal ? (
                    <HorizontalSegmentDiagram
                      doc={HARRIS_SEGMENT_DOC}
                      currentPage={currentPage}
                      scrollProgress={scrollProgress}
                      interaction={segmentInteraction}
                      onJumpToPage={jumpToPage}
                    />
                  ) : (
                    <VerticalSegmentDiagram
                      doc={HARRIS_SEGMENT_DOC}
                      currentPage={currentPage}
                      scrollProgress={scrollProgress}
                      interaction={segmentInteraction}
                      onJumpToPage={jumpToPage}
                    />
                  )}
                </FileViewerSidebarContent>
              </FileViewerSidebar>

              <FileViewerInset>
                <FileViewerLegend>
                  <SegmentLegend
                    segments={HARRIS_SEGMENT_DOC.legendSegments}
                    currentPage={currentPage}
                    interaction={segmentInteraction}
                    onSelect={(segment) => jumpToPage(firstLegendPage(segment))}
                    columns={4}
                    variant="plain"
                    showUnusedToggle
                    className="px-3 py-2"
                  />
                </FileViewerLegend>
                <FileViewerViewport>
                  <PdfViewerPages
                    ref={pdfRef}
                    bare
                    className="h-full"
                    onVisiblePageChange={(page) =>
                      setCurrentPage(
                        clampPage(page, HARRIS_SEGMENT_DOC.pageCount),
                      )
                    }
                    onScrollProgressChange={setScrollProgress}
                  />
                </FileViewerViewport>
              </FileViewerInset>
            </FileViewerContent>
          </PdfViewerProvider>
        </FileViewer>
      </FileViewerProvider>
    </div>
  );
}

function HorizontalSegmentDiagram({
  doc,
  currentPage,
  scrollProgress,
  interaction,
  onJumpToPage,
}: {
  doc: SegmentDiagramDoc;
  currentPage: number;
  scrollProgress: number;
  interaction: DiagramSegmentInteraction;
  onJumpToPage: (page: number) => void;
}) {
  const rows = [...doc.ribbonRows, doc.diffRibbonRow];

  return (
    <div className="flex min-h-full flex-col gap-5 overflow-auto p-5">
      <DiagramIntro doc={doc} />
      <div className="flex min-w-0 items-start gap-4 pb-6">
        <div className="flex w-28 shrink-0 flex-col gap-px">
          {rows.map((row) => (
            <div
              key={row.id}
              className="text-muted-foreground flex h-9 items-center justify-end font-mono text-[11px]"
            >
              {row.label}
            </div>
          ))}
        </div>
        <PageRibbon
          orientation="horizontal"
          rows={rows}
          pageCount={doc.pageCount}
          currentPage={currentPage}
          scrollProgress={scrollProgress}
          interaction={interaction}
          onSelectPage={onJumpToPage}
          showTicks
          rowThickness={36}
          className="min-w-0 flex-1"
        />
      </div>
    </div>
  );
}

function VerticalSegmentDiagram({
  doc,
  currentPage,
  scrollProgress,
  interaction,
  onJumpToPage,
}: {
  doc: SegmentDiagramDoc;
  currentPage: number;
  scrollProgress: number;
  interaction: DiagramSegmentInteraction;
  onJumpToPage: (page: number) => void;
}) {
  const rows = [...doc.ribbonRows, doc.diffRibbonRow];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${rows.length}, 44px) 1rem`,
          }}
        >
          {doc.rows.map((row) => (
            <div
              key={row.id}
              className="text-muted-foreground text-center font-mono text-[10px]"
              title={row.label}
            >
              {row.shortLabel}
            </div>
          ))}
          <div
            className="text-muted-foreground text-center font-mono text-[10px]"
            title={doc.diffRibbonRow.label}
          >
            diff
          </div>
          <div />
        </div>
        <PageRibbon
          orientation="vertical"
          rows={rows}
          pageCount={doc.pageCount}
          currentPage={currentPage}
          scrollProgress={scrollProgress}
          interaction={interaction}
          onSelectPage={onJumpToPage}
          showTicks
          className="min-h-0 flex-1"
        />
      </div>
    </div>
  );
}

function DiagramIntro({
  doc,
  compact = false,
}: {
  doc: SegmentDiagramDoc;
  compact?: boolean;
}) {
  return (
    <div className={cn("grid gap-3", !compact && "grid-cols-[1fr_0.8fr]")}>
      <div>
        <h2 className={cn("font-semibold", compact ? "text-base" : "text-xl")}>
          Segment diagram
        </h2>
        <p className="text-muted-foreground mt-1 text-[11px] leading-5">
          Consolidation, all {doc.rows.length - 1} raw consensus votes, and a
          per-page vote-disagreement diff.
        </p>
      </div>
      <p className="text-muted-foreground text-[11px] leading-5">{doc.label}</p>
    </div>
  );
}

function segment(type: string, startPage: number, endPage: number): Segment {
  return { type, startPage, endPage };
}

function createSegmentRow(
  id: string,
  label: string,
  shortLabel: string,
  segments: Segment[],
): SegmentRow {
  return {
    id,
    label,
    shortLabel,
    ribbonSegments: createRibbonSegments(id, segments),
  };
}

function toRibbonRow(row: SegmentRow): RibbonRow {
  return {
    id: row.id,
    label: row.label,
    segments: row.ribbonSegments,
  };
}

function createLegendSegments(segments: readonly Segment[]): DocumentSegment[] {
  return TYPE_ORDER.map((type, index) => ({
    id: segmentIdForType(type),
    label: type,
    pages: segmentPagesForType(segments, type),
    color: colorForType(type),
    index,
    confidence: null,
  }));
}

function createRibbonSegments(
  rowId: string,
  segments: readonly Segment[],
): DocumentSegment[] {
  return segments.map((segment, index) => ({
    id: segmentIdForType(segment.type),
    sourceId: `${rowId}-${index}`,
    label: segment.type,
    pages: pagesInRange(segment.startPage, segment.endPage),
    color: colorForType(segment.type),
    index,
    confidence: null,
  }));
}

/**
 * The "diff" lane: each page shaded proportionally to how much the votes
 * disagree on it. A page where every vote assigns the same type reads as empty;
 * an even split reads as full-strength. Intensity is the share of dissenting
 * votes, normalized so a maximally-split page (the most even split possible for
 * the vote count) saturates the color — floored to DIFF_MIN_PERCENT so any
 * non-zero disagreement stays visible.
 */
function createDiffRibbonRow({
  id,
  voteRows,
  pageCount,
}: {
  id: string;
  voteRows: readonly (readonly Segment[])[];
  pageCount: number;
}): RibbonRow {
  const pageVotes = buildPageVotes(voteRows, pageCount);
  const maxDissent = Math.max(1, Math.floor(voteRows.length / 2));
  const pagesByPercent = new Map<number, number[]>();

  for (let page = 1; page <= pageCount; page += 1) {
    const counts = Object.values(pageVotes[page]!);
    const total = counts.reduce((sum, count) => sum + count, 0);
    if (total === 0) continue;
    const dissent = total - Math.max(...counts);
    if (dissent <= 0) continue;
    // Proportional to the dissent share, but floored so even a single
    // dissenting vote stays clearly visible rather than reading as empty.
    const normalized = Math.min(1, dissent / maxDissent);
    const percent = Math.round(DIFF_MIN_PERCENT + normalized * (100 - DIFF_MIN_PERCENT));
    const bucket = pagesByPercent.get(percent) ?? [];
    bucket.push(page);
    pagesByPercent.set(percent, bucket);
  }

  const segments: DocumentSegment[] = Array.from(pagesByPercent.entries())
    .sort(([left], [right]) => left - right)
    .map(([percent, pages], index) => ({
      id: `${id}-diff-${percent}`,
      label: `${percent}% disagreement`,
      pages: pages.sort((left, right) => left - right),
      color: `color-mix(in oklab, var(--warning) ${percent}%, transparent)`,
      index,
      confidence: null,
    }));

  return {
    id,
    label: "diff",
    segments,
  };
}

function segmentPagesForType(segments: readonly Segment[], type: string) {
  const pages = new Set<number>();
  segments
    .filter((segment) => segment.type === type)
    .forEach((segment) => {
      pagesInRange(segment.startPage, segment.endPage).forEach((page) =>
        pages.add(page),
      );
    });
  return Array.from(pages).sort((left, right) => left - right);
}

function firstLegendPage(segment: DocumentSegment) {
  return segment.pages[0] ?? 1;
}

function pagesInRange(startPage: number, endPage: number) {
  const start = Math.max(1, Math.min(startPage, endPage));
  const end = Math.max(start, endPage);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function segmentIdForType(type: string) {
  const index = TYPE_ORDER.indexOf(type);
  return `segment-type-${index === -1 ? type : index}`;
}

function buildPageVotes(
  voteRows: readonly (readonly Segment[])[],
  pageCount: number,
): SegmentVoteCounts[] {
  const pageVotes: SegmentVoteCounts[] = Array.from(
    { length: pageCount + 1 },
    () => ({}),
  );

  voteRows.forEach((segments) => {
    segments.forEach((seg) => {
      for (let page = seg.startPage; page <= seg.endPage; page += 1) {
        if (page < 1 || page > pageCount) continue;
        pageVotes[page]![seg.type] = (pageVotes[page]![seg.type] ?? 0) + 1;
      }
    });
  });

  return pageVotes;
}

function weightedConsolidationSegments(
  voteRows: readonly (readonly Segment[])[],
  pageCount: number,
): Segment[] {
  const pageVotes = buildPageVotes(voteRows, pageCount);

  const weightedSegments: Segment[] = [];
  let currentKey = voteSignature(pageVotes[1]!);
  let startPage: number | null = currentKey === "" ? null : 1;

  for (let page = 2; page <= pageCount; page += 1) {
    const nextKey = voteSignature(pageVotes[page]!);
    if (nextKey === currentKey) continue;

    if (currentKey !== "" && startPage !== null) {
      weightedSegments.push(
        weightedSegment(pageVotes[startPage]!, startPage, page - 1),
      );
    }
    currentKey = nextKey;
    startPage = nextKey === "" ? null : page;
  }

  if (currentKey !== "" && startPage !== null) {
    weightedSegments.push(
      weightedSegment(pageVotes[startPage]!, startPage, pageCount),
    );
  }

  return weightedSegments;
}

function weightedSegment(
  voteCounts: SegmentVoteCounts,
  startPage: number,
  endPage: number,
): Segment {
  return {
    type: winningType(voteCounts),
    startPage,
    endPage,
  };
}

function voteSignature(voteCounts: SegmentVoteCounts) {
  return Object.entries(voteCounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => `${type}:${count}`)
    .join("|");
}

function winningType(voteCounts: SegmentVoteCounts) {
  return (
    Object.entries(voteCounts).sort(
      ([leftType, leftCount], [rightType, rightCount]) =>
        rightCount === leftCount
          ? leftType.localeCompare(rightType)
          : rightCount - leftCount,
    )[0]?.[0] ?? "unassigned"
  );
}

function colorForType(type: string) {
  return TYPE_COLORS.get(type) ?? "#888";
}

function clampPage(page: number, pageCount: number) {
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, Math.min(pageCount, Math.round(page)));
}
