"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Tags } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSurface,
} from "@/components/ui/viewer";
import type {
  ClassifyCandidate,
  ClassifyResult,
} from "@/components/viewers/lib/classify-types";

type ClassifierViewerContextValue = {
  category: string | null;
  candidates: readonly ClassifyCandidate[];
  emptyDescription: string;
  emptyTitle: string;
  isProcessing: boolean;
  reasoning: string | null;
  result: ClassifyResult | null;
};

type ClassifierViewerHeaderState = {
  category: string | null;
};

type ClassifierViewerLegendState = {
  candidates: readonly ClassifyCandidate[];
  category: string | null;
  reasoning: string | null;
};

type ClassifierViewerEmptyStatusState = {
  emptyDescription: string;
  emptyTitle: string;
  isProcessing: boolean;
};

type ClassifierViewerDocumentState = {
  hasOutput: boolean;
};

const ClassifierViewerContext =
  React.createContext<ClassifierViewerContextValue | null>(null);
const EMPTY_CLASSIFY_CANDIDATES: readonly ClassifyCandidate[] = [];

export interface ClassifierViewerProviderProps {
  result: ClassifyResult | null;
  isProcessing?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: React.ReactNode;
}

export interface ClassifierViewerProps {
  result: ClassifyResult | null;
  isProcessing?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  document?: React.ReactNode;
}

function useClassifierViewerContext(): ClassifierViewerContextValue {
  const context = React.useContext(ClassifierViewerContext);
  if (!context) {
    throw new Error(
      "useClassifierViewer must be used within ClassifierViewerProvider.",
    );
  }
  return context;
}

function useClassifierViewerHeader(): ClassifierViewerHeaderState {
  const { category } = useClassifierViewerContext();

  return {
    category,
  };
}

function useClassifierViewerLegend(): ClassifierViewerLegendState {
  const { candidates, category, reasoning } = useClassifierViewerContext();

  return {
    candidates,
    category,
    reasoning,
  };
}

function useClassifierViewerEmpty(): ClassifierViewerEmptyStatusState {
  const { emptyDescription, emptyTitle, isProcessing } =
    useClassifierViewerContext();
  return {
    emptyDescription,
    emptyTitle,
    isProcessing,
  };
}

function useClassifierViewerDocument(): ClassifierViewerDocumentState {
  return {
    hasOutput: useClassifierViewerContext().category !== null,
  };
}

export function ClassifierViewerProvider({
  result,
  isProcessing = false,
  emptyTitle = "Run classify to see output",
  emptyDescription = "Provide input, define categories, and click Run Classify",
  children,
}: ClassifierViewerProviderProps) {
  const category = result?.category ?? null;
  const candidates = result?.candidates ?? EMPTY_CLASSIFY_CANDIDATES;
  const reasoning = result?.reasoning?.trim() || null;
  const value = React.useMemo<ClassifierViewerContextValue>(
    () => ({
      category,
      candidates,
      emptyDescription,
      emptyTitle,
      isProcessing,
      reasoning,
      result,
    }),
    [
      category,
      candidates,
      emptyDescription,
      emptyTitle,
      isProcessing,
      reasoning,
      result,
    ],
  );

  return (
    <ClassifierViewerContext.Provider value={value}>
      {children}
    </ClassifierViewerContext.Provider>
  );
}

export function ClassifierViewerHeader({ className }: { className?: string }) {
  const { category } = useClassifierViewerHeader();

  if (!category) return null;

  const categoryNode = (
    <span className="bg-background text-foreground inline-flex min-h-7 min-w-0 items-center rounded-md border px-2.5 text-sm font-medium">
      <span className="truncate">{category}</span>
    </span>
  );

  return (
    <ViewerHeader
      className={cn(
        "bg-background flex min-h-10 items-center gap-3 px-3 py-2",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Tags className="text-muted-foreground size-4 shrink-0" />
        <span className="shrink-0 text-sm font-medium">Classification</span>
        <span className="min-w-0">{categoryNode}</span>
      </div>
    </ViewerHeader>
  );
}

export function ClassifierViewerLegend({ className }: { className?: string }) {
  const { candidates, category, reasoning } = useClassifierViewerLegend();

  if (!category) return null;

  const normalizedCandidates = normalizeClassifierCandidates({
    candidates,
    category,
  });

  if (normalizedCandidates.length === 0 && !reasoning) return null;

  return (
    <div
      className={cn(
        "bg-background flex flex-shrink-0 flex-col gap-2 border-b px-3 py-2",
        className,
      )}
    >
      {normalizedCandidates.length > 0 ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {normalizedCandidates.map((candidate) => {
            const isActive = candidate.category === category;
            return (
              <div
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
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
                <span className="min-w-0 truncate font-medium">
                  {candidate.category}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {reasoning ? (
        <p className="text-muted-foreground max-h-10 overflow-hidden text-xs leading-5">
          {reasoning}
        </p>
      ) : null}
    </div>
  );
}

export function ClassifierViewerEmptyState() {
  const { emptyDescription, emptyTitle, isProcessing } =
    useClassifierViewerEmpty();

  return (
    <div className="bg-background text-muted-foreground flex h-full flex-1 flex-col items-center justify-center gap-4 px-8">
      {isProcessing ? (
        <>
          <Loader2 className="text-primary h-12 w-12 animate-spin" />
          <p className="text-muted-foreground text-center text-base">
            Classifying...
          </p>
        </>
      ) : (
        <>
          <Tags className="text-muted-foreground h-16 w-16" />
          <p className="text-muted-foreground text-center text-base">
            {emptyTitle}
          </p>
          <p className="text-muted-foreground max-w-sm text-center text-sm">
            {emptyDescription}
          </p>
        </>
      )}
    </div>
  );
}

export function ClassifierViewerDocument({
  document,
}: {
  document?: React.ReactNode;
}) {
  const { hasOutput } = useClassifierViewerDocument();

  if (!hasOutput) return <ClassifierViewerEmptyState />;

  return document ? (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">{document}</div>
  ) : (
    <div className="flex h-full flex-1 items-center justify-center">
      <span className="text-muted-foreground text-sm">
        No document available
      </span>
    </div>
  );
}

export function ClassifierViewer({
  result,
  isProcessing = false,
  emptyTitle,
  emptyDescription,
  document,
}: ClassifierViewerProps) {
  return (
    <ClassifierViewerProvider
      result={result}
      isProcessing={isProcessing}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
    >
      <ViewerRoot className="bg-background h-full flex-1">
        <ViewerBody>
          <ViewerSurface>
            <ClassifierViewerDocument document={document} />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </ClassifierViewerProvider>
  );
}

function normalizeClassifierCandidates({
  candidates,
  category,
}: {
  candidates: readonly ClassifyCandidate[];
  category: string;
}): readonly ClassifyCandidate[] {
  if (candidates.length === 0) {
    return [{ category }];
  }

  if (candidates.some((candidate) => candidate.category === category)) {
    return candidates;
  }

  return [{ category }, ...candidates];
}
