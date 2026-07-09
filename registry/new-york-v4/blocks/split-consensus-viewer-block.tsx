"use client";

import * as React from "react";
import { GitBranch, Vote } from "lucide-react";

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
} from "@/components/ui/file-viewer";
import { Label } from "@/components/ui/label";
import { PdfViewerPages, PdfViewerProvider } from "@/components/ui/pdf-viewer";
import { Switch } from "@/components/ui/switch";
import type {
  SplitResult,
  SplitSubdocumentLikelihood,
  SplitView,
} from "@/components/viewers/lib/split-types";
import {
  SplitViewerDocument,
  SplitViewerLegend,
  SplitViewerPageRail,
  SplitViewerProvider,
  useSplitViewerDocumentControls,
} from "@/components/viewers/split/split-viewer";

const PDF_SOURCE = {
  kind: "url" as const,
  url: "/samples/an-image-is-worth-16x16-words.pdf",
  fileName: "an-image-is-worth-16x16-words.pdf",
};

const SPLIT_OUTPUT: SplitResult[] = [
  { name: "Title, Abstract & Introduction", pages: [1] },
  { name: "Related Work", pages: [2] },
  { name: "Method", pages: [3] },
  { name: "Experiments", pages: pages(4, 8) },
  { name: "Conclusion", pages: [9] },
  { name: "References", pages: pages(10, 12) },
  { name: "Appendix", pages: pages(13, 22) },
];

const SPLIT_CONSENSUS_CHOICES: SplitResult[][] = [
  SPLIT_OUTPUT,
  [
    { name: "Title, Abstract & Introduction", pages: [1] },
    { name: "Related Work", pages: [2] },
    { name: "Method", pages: [3, 4] },
    { name: "Experiments", pages: pages(5, 8) },
    { name: "Conclusion & References", pages: pages(9, 12) },
    { name: "Appendix", pages: pages(13, 22) },
  ],
  [
    { name: "Title, Abstract & Introduction", pages: [1] },
    { name: "Related Work", pages: [2] },
    { name: "Method", pages: [3] },
    { name: "Experiments", pages: pages(4, 8) },
    { name: "Conclusion", pages: [9] },
    { name: "References", pages: pages(10, 12) },
    { name: "Appendix", pages: pages(13, 22) },
  ],
];

const SPLIT_CONSENSUS_LIKELIHOODS: SplitSubdocumentLikelihood[] = [
  { name: 0.98, pages: [0.98] },
  { name: 0.92, pages: [0.91] },
  { name: 0.89, pages: [0.86] },
  { name: 0.95, pages: [0.96, 0.95, 0.95, 0.94, 0.96] },
  { name: 0.8, pages: [0.77] },
  { name: 0.82, pages: [0.81, 0.83, 0.82] },
  {
    name: 0.99,
    pages: [0.98, 0.98, 0.99, 0.98, 0.99, 0.99, 0.98, 0.98, 0.99, 0.98],
  },
];

const SPLIT_RESULT: SplitView = {
  output: SPLIT_OUTPUT,
  consensus: {
    choices: SPLIT_CONSENSUS_CHOICES,
    likelihoods: SPLIT_CONSENSUS_LIKELIHOODS,
  },
  usage: { credits: 3 },
};

const SINGLE_PASS_SPLIT_RESULT: SplitView = {
  output: SPLIT_OUTPUT,
  consensus: { choices: [], likelihoods: null },
  usage: { credits: 1 },
};

export function SplitConsensusViewerBlock() {
  const [isConsensusEnabled, setIsConsensusEnabled] = React.useState(true);
  const result = isConsensusEnabled ? SPLIT_RESULT : SINGLE_PASS_SPLIT_RESULT;

  return (
    <div className="bg-background flex h-full min-h-[680px] flex-col">
      <SplitViewerProvider result={result}>
        <FileViewerProvider source={PDF_SOURCE} defaultSidebarOpen>
          <FileViewer className="bg-background">
            <PdfViewerProvider>
              <FileViewerHeader>
                <FileViewerSidebarTrigger className="-ms-1" />
                <FileViewerTitle />
                <FileViewerControls />
              </FileViewerHeader>
              <FileViewerContent>
                <SplitConsensusSidebar
                  isConsensusEnabled={isConsensusEnabled}
                  onConsensusEnabledChange={setIsConsensusEnabled}
                />
                <FileViewerInset>
                  <FileViewerLegend>
                    <SplitViewerLegend className="px-3 py-2" />
                  </FileViewerLegend>
                  <SplitViewerDocument document={<SplitConsensusDocument />} />
                </FileViewerInset>
              </FileViewerContent>
            </PdfViewerProvider>
          </FileViewer>
        </FileViewerProvider>
      </SplitViewerProvider>
    </div>
  );
}

function SplitConsensusSidebar({
  isConsensusEnabled,
  onConsensusEnabledChange,
}: {
  isConsensusEnabled: boolean;
  onConsensusEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <FileViewerSidebar
      aria-label="Split consensus"
      width="19rem"
      className="border-r"
    >
      <FileViewerSidebarHeader className="min-h-12">
        <Label
          htmlFor="split-consensus-switch"
          className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium"
        >
          <GitBranch className="text-muted-foreground size-4 shrink-0" />
          <span className="truncate">Consensus</span>
        </Label>
        <Switch
          id="split-consensus-switch"
          checked={isConsensusEnabled}
          onCheckedChange={onConsensusEnabledChange}
          size="sm"
        />
      </FileViewerSidebarHeader>
      <FileViewerSidebarContent className="overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-cols-[4.5rem_minmax(0,1fr)]">
          <div className="min-h-0 border-r">
            <SplitViewerPageRail />
          </div>
          <SplitConsensusDetails isConsensusEnabled={isConsensusEnabled} />
        </div>
      </FileViewerSidebarContent>
    </FileViewerSidebar>
  );
}

function SplitConsensusDetails({
  isConsensusEnabled,
}: {
  isConsensusEnabled: boolean;
}) {
  return (
    <div className="min-h-0 overflow-auto px-3 py-3">
      <div className="text-muted-foreground mb-3 flex items-center justify-between gap-3 text-xs">
        <span className="font-mono">
          n_consensus={isConsensusEnabled ? 3 : 1}
        </span>
        <span>{SPLIT_OUTPUT.length} segments</span>
      </div>

      <div className="space-y-1.5">
        {SPLIT_OUTPUT.map((segment, index) => {
          const likelihood = isConsensusEnabled
            ? SPLIT_CONSENSUS_LIKELIHOODS[index]
            : null;
          return (
            <div
              key={segment.name}
              className="border-border/70 bg-background rounded-md border px-2 py-1.5"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-medium">
                  {segment.name}
                </span>
                {likelihood ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                      getConfidenceClassName(meanLikelihood(likelihood)),
                    )}
                  >
                    {formatPercent(meanLikelihood(likelihood))}
                  </span>
                ) : null}
              </div>
              <div className="text-muted-foreground mt-1 font-mono text-[10px]">
                p. {formatPageList(segment.pages)}
              </div>
            </div>
          );
        })}
      </div>

      {isConsensusEnabled ? (
        <div className="mt-4 space-y-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <Vote className="size-3.5" />
            <span>Votes</span>
          </div>
          {SPLIT_CONSENSUS_CHOICES.map((choice, choiceIndex) => (
            <div
              key={choiceIndex}
              className="border-border/70 rounded-md border px-2 py-1.5"
            >
              <div className="text-xs font-medium">Run {choiceIndex + 1}</div>
              <div className="text-muted-foreground mt-1 line-clamp-2 text-[11px] leading-4">
                {choice
                  .map(
                    (segment) =>
                      `${segment.name}: ${formatPageList(segment.pages)}`,
                  )
                  .join(" | ")}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SplitConsensusDocument() {
  const controls = useSplitViewerDocumentControls();

  return (
    <PdfViewerPages
      ref={controls.setDocumentHandle}
      bare
      onVisiblePageChange={controls.onCurrentPageChange}
      onScrollProgressChange={controls.onScrollProgressChange}
      className="h-full"
    />
  );
}

function pages(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function meanLikelihood(likelihood: SplitSubdocumentLikelihood) {
  const values = [
    typeof likelihood.name === "number" ? likelihood.name : null,
    ...(likelihood.pages ?? []),
  ].filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPercent(value: number | null) {
  if (value === null) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function getConfidenceClassName(value: number | null) {
  if (value === null) return "bg-muted text-muted-foreground";
  if (value >= 0.9) return "bg-emerald-500/12 text-emerald-700";
  if (value >= 0.8) return "bg-amber-500/12 text-amber-700";
  return "bg-destructive/10 text-destructive";
}

function formatPageList(pages: readonly number[]) {
  if (pages.length === 0) return "none";
  const ranges: string[] = [];
  let start = pages[0]!;
  let previous = pages[0]!;

  for (const page of pages.slice(1)) {
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = page;
    previous = page;
  }

  ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
  return ranges.join(", ");
}
