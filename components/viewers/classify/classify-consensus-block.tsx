"use client";

import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  FileViewer,
  FileViewerContent,
  FileViewerControls,
  FileViewerHeader,
  FileViewerInset,
  FileViewerProvider,
  FileViewerSidebar,
  FileViewerSidebarContent,
  FileViewerSidebarTrigger,
  FileViewerTitle,
  FileViewerViewport,
  type ViewerSource,
} from "@/components/ui/file-viewer";
import { PdfViewerPages, PdfViewerProvider } from "@/components/ui/pdf-viewer";
import { ClassifierViewerProvider } from "@/components/viewers/classify/classifier-viewer";
import type {
  ClassifyCandidate,
  ClassifyResult,
} from "@/components/viewers/lib/classify-types";

export type ClassifyConsensusBlockProps = {
  source: ViewerSource;
  result: ClassifyResult;
  sidebarWidth?: string;
  sidebarLabel?: string;
  minHeightClassName?: string;
};

export function ClassifyConsensusBlock({
  source,
  result,
  sidebarWidth = "18rem",
  sidebarLabel = "Classification consensus",
  minHeightClassName = "min-h-[680px]",
}: ClassifyConsensusBlockProps) {
  return (
    <div
      className={cn("bg-background flex h-full flex-col", minHeightClassName)}
    >
      <ClassifierViewerProvider result={result}>
        <FileViewerProvider source={source} defaultSidebarOpen>
          <FileViewer className="bg-background">
            <PdfViewerProvider>
              <FileViewerHeader>
                <FileViewerSidebarTrigger className="-ms-1" />
                <FileViewerTitle />
                <FileViewerControls />
              </FileViewerHeader>
              <FileViewerContent>
                <ClassifyConsensusSidebar
                  result={result}
                  width={sidebarWidth}
                  label={sidebarLabel}
                />
                <FileViewerInset>
                  <FileViewerViewport>
                    <PdfViewerPages bare className="h-full" />
                  </FileViewerViewport>
                </FileViewerInset>
              </FileViewerContent>
            </PdfViewerProvider>
          </FileViewer>
        </FileViewerProvider>
      </ClassifierViewerProvider>
    </div>
  );
}

function ClassifyConsensusSidebar({
  result,
  width,
  label,
}: {
  result: ClassifyResult;
  width: string;
  label: string;
}) {
  return (
    <FileViewerSidebar aria-label={label} width={width} className="border-r">
      <FileViewerSidebarContent>
        <ClassifyConsensusLegend result={result} />
        <ClassifyConsensusDetails result={result} />
      </FileViewerSidebarContent>
    </FileViewerSidebar>
  );
}

function ClassifyConsensusLegend({ result }: { result: ClassifyResult }) {
  const candidates = normalizeClassifyCandidates({
    candidates: result.candidates ?? [],
    category: result.category,
  });
  const consensus = result.consensus;
  const likelihood =
    typeof consensus?.likelihoods === "number" ? consensus.likelihoods : null;

  if (candidates.length === 0) return null;

  return (
    <div className="bg-background flex shrink-0 flex-col gap-2 px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        {candidates.map((candidate) => {
          const isActive = candidate.category === result.category;
          return (
            <div
              className={cn(
                "flex max-w-full min-w-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                isActive
                  ? "text-foreground border-emerald-500 bg-emerald-500/10"
                  : "border-border bg-muted/30 text-muted-foreground",
              )}
              key={candidate.category}
              title={candidate.description}
            >
              {isActive ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                />
              ) : null}
              <span className="min-w-0 font-medium break-words">
                {candidate.category}
              </span>
              {isActive && likelihood !== null ? (
                <span
                  className={cn(
                    "shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                    getConfidenceClassName(likelihood),
                  )}
                >
                  {formatPercent(likelihood)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClassifyConsensusDetails({
  result,
}: {
  result: ClassifyResult;
}) {
  const consensus = result.consensus;
  const choices = consensus?.choices ?? [];

  return (
    <div className="space-y-4 px-3 pt-3 pb-3">
      {choices.length > 0 ? (
        <div className="space-y-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <span>Votes</span>
          </div>
          {choices.map((choice, index) => {
            const isWinner = choice.category === result.category;
            return (
              <div
                key={`${choice.category}-${index}`}
                className="border-border/70 rounded-md border px-2 py-1.5"
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0 text-xs font-medium break-words">
                    Vote {index + 1}
                  </span>
                  <span
                    className={cn(
                      "max-w-[9rem] shrink-0 rounded-sm px-1.5 py-0.5 text-right text-[10px] font-medium break-words",
                      isWinner
                        ? "bg-emerald-500/12 text-emerald-700"
                        : "bg-amber-500/12 text-amber-700",
                    )}
                  >
                    {choice.category}
                  </span>
                </div>
                {choice.reasoning ? (
                  <p className="text-muted-foreground mt-1 text-[11px] leading-4">
                    {choice.reasoning}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getConfidenceClassName(value: number) {
  if (value >= 0.9) return "bg-emerald-500/12 text-emerald-700";
  if (value >= 0.67) return "bg-amber-500/12 text-amber-700";
  return "bg-destructive/10 text-destructive";
}

function normalizeClassifyCandidates({
  candidates,
  category,
}: {
  candidates: readonly ClassifyCandidate[];
  category: string;
}) {
  if (candidates.length === 0) return [{ category }];
  if (candidates.some((candidate) => candidate.category === category)) {
    return candidates;
  }
  return [{ category }, ...candidates];
}
