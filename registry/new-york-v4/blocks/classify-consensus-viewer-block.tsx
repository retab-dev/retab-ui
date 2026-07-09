"use client";

import * as React from "react";
import { CheckCircle2, Tags, Vote } from "lucide-react";

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
  FileViewerSidebarHeader,
  FileViewerSidebarTrigger,
  FileViewerTitle,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import { Label } from "@/components/ui/label";
import { PdfViewerPages, PdfViewerProvider } from "@/components/ui/pdf-viewer";
import { Switch } from "@/components/ui/switch";
import { ClassifierViewerProvider } from "@/components/viewers/classify/classifier-viewer";
import type {
  ClassifyCandidate,
  ClassifyResult,
} from "@/components/viewers/lib/classify-types";

const LOAN_APPLICATION_SOURCE = {
  kind: "url" as const,
  url: "/samples/loan-application.pdf",
  fileName: "loan-application.pdf",
};

const CLASSIFY_RESULT: ClassifyResult = {
  category: "Loan Application",
  candidates: [
    {
      category: "Loan Application",
      description: "Uniform Residential Loan Application Form 1003.",
    },
    {
      category: "Tax Form",
      description: "Structured form, but no IRS tax identifiers.",
    },
    {
      category: "Bank Statement",
      description: "Financial fields are present, but no transactions.",
    },
  ],
  reasoning:
    "The document is a Uniform Residential Loan Application (Form 1003): it collects borrower, employment, and property details for a mortgage request.",
  consensus: {
    likelihoods: 0.67,
    choices: [
      {
        category: "Loan Application",
        reasoning:
          "The document is a Form 1003 loan application with borrower, employment, and property sections.",
      },
      {
        category: "Loan Application",
        reasoning:
          "The mortgage application fields and declarations match a loan application packet.",
      },
      {
        category: "Tax Form",
        reasoning:
          "The form is structured and financial, but it does not contain transaction rows or statement periods.",
      },
    ],
  },
};

const SINGLE_PASS_CLASSIFY_RESULT: ClassifyResult = {
  ...CLASSIFY_RESULT,
  consensus: { choices: [], likelihoods: null },
};

export function ClassifyConsensusViewerBlock() {
  const [isConsensusEnabled, setIsConsensusEnabled] = React.useState(true);
  const result = isConsensusEnabled
    ? CLASSIFY_RESULT
    : SINGLE_PASS_CLASSIFY_RESULT;

  return (
    <div className="bg-background flex h-full min-h-[680px] flex-col">
      <ClassifierViewerProvider result={result}>
        <FileViewerProvider source={LOAN_APPLICATION_SOURCE} defaultSidebarOpen>
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
                  isConsensusEnabled={isConsensusEnabled}
                  onConsensusEnabledChange={setIsConsensusEnabled}
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
  isConsensusEnabled,
  onConsensusEnabledChange,
}: {
  result: ClassifyResult;
  isConsensusEnabled: boolean;
  onConsensusEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <FileViewerSidebar
      aria-label="Classification consensus"
      width="18rem"
      className="border-r"
    >
      <FileViewerSidebarHeader className="min-h-12">
        <Label
          htmlFor="classify-consensus-switch"
          className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium"
        >
          <Tags className="text-muted-foreground size-4 shrink-0" />
          <span>Consensus</span>
        </Label>
        <Switch
          id="classify-consensus-switch"
          checked={isConsensusEnabled}
          onCheckedChange={onConsensusEnabledChange}
          size="sm"
        />
      </FileViewerSidebarHeader>
      <FileViewerSidebarContent>
        <ClassifyConsensusLegend result={result} />
        <ClassifyConsensusDetails
          result={result}
          isConsensusEnabled={isConsensusEnabled}
        />
      </FileViewerSidebarContent>
    </FileViewerSidebar>
  );
}

function ClassifyConsensusLegend({ result }: { result: ClassifyResult }) {
  const candidates = normalizeClassifyCandidates({
    candidates: result.candidates ?? [],
    category: result.category,
  });

  return (
    <div className="bg-background flex shrink-0 flex-col gap-2 px-3 py-2">
      {candidates.length > 0 ? (
        <div className="flex min-w-0 flex-wrap items-start gap-2">
          {candidates.map((candidate) => {
            const isActive = candidate.category === result.category;
            return (
              <div
                className={cn(
                  "flex max-w-full min-w-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                  isActive
                    ? "border-emerald-300 bg-emerald-500/10 text-emerald-950"
                    : "border-border bg-muted/30 text-muted-foreground",
                )}
                key={candidate.category}
                title={candidate.description}
              >
                {isActive ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                  />
                ) : null}
                <span className="min-w-0 font-medium break-words">
                  {candidate.category}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {result.reasoning ? (
        <p className="text-muted-foreground text-xs leading-5">
          {result.reasoning}
        </p>
      ) : null}
    </div>
  );
}

function ClassifyConsensusDetails({
  result,
  isConsensusEnabled,
}: {
  result: ClassifyResult;
  isConsensusEnabled: boolean;
}) {
  const consensus = result.consensus;
  const choices = isConsensusEnabled ? (consensus?.choices ?? []) : [];
  const likelihood =
    isConsensusEnabled && typeof consensus?.likelihoods === "number"
      ? consensus.likelihoods
      : null;

  return (
    <div className="space-y-4 px-3 pb-3">
      <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
        <span className="font-mono">
          n_consensus={isConsensusEnabled ? 3 : 1}
        </span>
        {likelihood !== null ? (
          <span
            className={cn(
              "rounded-sm px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
              getConfidenceClassName(likelihood),
            )}
          >
            {formatPercent(likelihood)}
          </span>
        ) : null}
      </div>

      <div className="border-border/70 rounded-md border px-2 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
          <span className="min-w-0 text-xs font-medium break-words">
            {result.category}
          </span>
        </div>
        {result.reasoning ? (
          <p className="text-muted-foreground mt-1 text-[11px] leading-4">
            {result.reasoning}
          </p>
        ) : null}
      </div>

      {choices.length > 0 ? (
        <div className="space-y-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <Vote className="size-3.5" />
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
                    Run {index + 1}
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
