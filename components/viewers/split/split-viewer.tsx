"use client";

import * as React from "react";
import { type ReactNode } from "react";
import { Loader2, Scissors } from "lucide-react";

import { segmentsPageCount, toSegments } from "@/lib/segments";
import { cn } from "@/lib/utils";
import type { ViewerSource } from "@/lib/viewer-source";
import {
  FileViewerBody,
  FileViewerHeader,
  FileViewerHeaderEnd,
  FileViewerHeaderStart,
  FileViewerIdentity,
  FileViewerLegend,
  FileViewer,
  FileViewerProvider,
  FileViewerSidebar,
  FileViewerSidebarContent,
  FileViewerSidebarTrigger,
  FileViewerSurface,
  FileViewerToolbar,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import { SegmentLegend } from "@/components/ui/segment-legend";
import { SegmentPageRail } from "@/components/ui/segment-page-rail";
import {
  createSegmentedDocumentModel,
  type DocumentSegment,
  type SegmentedDocumentModel,
} from "@/components/ui/segmented-document-model";
import {
  SegmentedDocumentProvider,
  useSegmentedDocumentViewport,
} from "@/components/ui/segmented-document-provider";
import {
  type SegmentDocumentHandle,
  type SegmentViewportController,
} from "@/components/ui/use-segment-viewport-controller";
import { ViewerHeader } from "@/components/ui/viewer";
import { type SplitView } from "@/components/viewers/lib/split-types";

export interface SplitDocumentHandlers {
  onCurrentPageChange: (page: number) => void;
  onScrollProgressChange: (progress: number) => void;
  setDocumentHandle: (handle: SegmentDocumentHandle | null) => void;
}

export interface SplitViewerProps {
  result: SplitView | null;
  source: ViewerSource;
  isProcessing?: boolean;
  document?: ReactNode;
}

export type SplitViewerSidebarProps = React.ComponentProps<
  typeof FileViewerSidebar
>;

export function SplitViewer({
  result,
  source,
  isProcessing = false,
  document,
}: SplitViewerProps) {
  return (
    <SplitViewerProvider result={result} isProcessing={isProcessing}>
      <FileViewerProvider
        source={source}
        headerMode="outlets"
        defaultSidebarOpen
      >
        <FileViewer className="bg-background" sidebarMode="inline">
          <SplitViewerFileHeader />
          <FileViewerBody>
            <SplitViewerSidebar />
            <FileViewerSurface>
              <FileViewerLegend>
                <SplitViewerLegend className="px-3 py-2" />
              </FileViewerLegend>
              <SplitViewerDocument document={document} />
            </FileViewerSurface>
          </FileViewerBody>
        </FileViewer>
      </FileViewerProvider>
    </SplitViewerProvider>
  );
}

function SplitViewerFileHeader() {
  return (
    <FileViewerHeader>
      <FileViewerHeaderStart>
        <FileViewerSidebarTrigger />
        <FileViewerIdentity meta="hidden" />
      </FileViewerHeaderStart>
      <FileViewerHeaderEnd>
        <FileViewerToolbar />
      </FileViewerHeaderEnd>
    </FileViewerHeader>
  );
}

type SplitViewerContextValue = {
  model: SplitViewerModel;
  viewport: SegmentViewportController;
};

export type SplitViewerModel = {
  hasOutput: boolean;
  isProcessing: boolean;
  pageCount: number;
  segments: DocumentSegment[];
};

type SplitViewerHeaderState = {
  hasOutput: boolean;
  isProcessing: boolean;
  pageCount: number;
  segments: DocumentSegment[];
};

type SplitViewerSidebarState = {
  hasOutput: boolean;
  pageCount: number;
};

type SplitViewerPageRailState = {
  hasOutput: boolean;
  pageCount: number;
  segments: DocumentSegment[];
  viewport: SegmentViewportController;
};

type SplitViewerLegendState = {
  hasOutput: boolean;
  segments: DocumentSegment[];
  viewport: SegmentViewportController;
};

type SplitViewerDocumentState = {
  hasOutput: boolean;
  isProcessing: boolean;
};

const SplitViewerContext = React.createContext<SplitViewerContextValue | null>(
  null,
);

function useSplitViewerContext(): SplitViewerContextValue {
  const context = React.useContext(SplitViewerContext);
  if (!context) {
    throw new Error("useSplitViewer must be used within SplitViewerProvider.");
  }
  return context;
}

function useSplitViewerHeader(): SplitViewerHeaderState {
  return useSplitViewerContext().model;
}

function useSplitViewerSidebar(): SplitViewerSidebarState {
  const { hasOutput, pageCount } = useSplitViewerContext().model;
  return { hasOutput, pageCount };
}

function useSplitViewerPageRail(): SplitViewerPageRailState {
  const { model, viewport } = useSplitViewerContext();
  return {
    hasOutput: model.hasOutput,
    pageCount: model.pageCount,
    segments: model.segments,
    viewport,
  };
}

function useSplitViewerLegend(): SplitViewerLegendState {
  const { model, viewport } = useSplitViewerContext();
  return { hasOutput: model.hasOutput, segments: model.segments, viewport };
}

function useSplitViewerDocument(): SplitViewerDocumentState {
  const { hasOutput, isProcessing } = useSplitViewerContext().model;
  return { hasOutput, isProcessing };
}

export function useSplitViewerDocumentControls(): SplitDocumentHandlers {
  return useSplitViewerContext().viewport.documentHandlers;
}

export function createSplitViewerModel({
  result,
  isProcessing,
}: {
  result: SplitView | null;
  isProcessing: boolean;
}): SplitViewerModel {
  const segments = toSegments(result?.output ?? []) satisfies DocumentSegment[];

  return {
    hasOutput: Boolean(result && result.output.length > 0),
    isProcessing,
    pageCount: segmentsPageCount(segments),
    segments,
  };
}

function createSplitSegmentedDocumentModel(
  model: Pick<SplitViewerModel, "pageCount" | "segments">,
): SegmentedDocumentModel {
  return createSegmentedDocumentModel({
    pageCount: model.pageCount,
    segments: model.segments,
  });
}

export function SplitViewerProvider({
  result,
  isProcessing = false,
  children,
}: {
  result: SplitView | null;
  isProcessing?: boolean;
  children: React.ReactNode;
}) {
  const model = React.useMemo(
    () => createSplitViewerModel({ result, isProcessing }),
    [isProcessing, result],
  );
  const segmentedDocumentModel = React.useMemo(
    () => createSplitSegmentedDocumentModel(model),
    [model],
  );

  return (
    <SegmentedDocumentProvider model={segmentedDocumentModel}>
      <SplitViewerContextProvider model={model}>
        {children}
      </SplitViewerContextProvider>
    </SegmentedDocumentProvider>
  );
}

function SplitViewerContextProvider({
  children,
  model,
}: {
  children: React.ReactNode;
  model: SplitViewerModel;
}) {
  const viewport = useSegmentedDocumentViewport();

  const value = React.useMemo<SplitViewerContextValue>(
    () => ({
      model,
      viewport,
    }),
    [model, viewport],
  );

  return (
    <SplitViewerContext.Provider value={value}>
      {children}
    </SplitViewerContext.Provider>
  );
}

export function SplitViewerHeader() {
  const { hasOutput, isProcessing, pageCount, segments } =
    useSplitViewerHeader();
  const title = hasOutput
    ? `${segments.length} segment${segments.length === 1 ? "" : "s"}`
    : isProcessing
      ? "Splitting"
      : "Split viewer";

  return (
    <ViewerHeader className="flex flex-col">
      <div className="flex min-h-10 items-center justify-between gap-3 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {hasOutput && pageCount > 0 ? (
            <FileViewerSidebarTrigger className="-ml-1" />
          ) : null}
          <Scissors className="text-muted-foreground size-4" />
          <span>{title}</span>
        </div>
        {hasOutput ? (
          <div className="text-muted-foreground text-xs">
            {pageCount} page{pageCount === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
    </ViewerHeader>
  );
}

export function SplitViewerSidebar({
  children,
  className,
  width = "4rem",
  "aria-label": ariaLabel = "Split pages",
  ...props
}: SplitViewerSidebarProps) {
  const { hasOutput, pageCount } = useSplitViewerSidebar();
  if (!hasOutput || pageCount <= 0) return null;

  return (
    <FileViewerSidebar
      aria-label={ariaLabel}
      width={width}
      className={cn("border-r", className)}
      {...props}
    >
      <FileViewerSidebarContent className="p-0">
        {children ?? <SplitViewerPageRail />}
      </FileViewerSidebarContent>
    </FileViewerSidebar>
  );
}

export function SplitViewerPageRail() {
  const { hasOutput, pageCount, segments, viewport } = useSplitViewerPageRail();
  if (!hasOutput || pageCount <= 0) return null;

  return (
    <SegmentPageRail
      segments={segments}
      pageCount={pageCount}
      currentPage={viewport.model.currentPage}
      scrollProgress={viewport.model.scrollProgress}
      interaction={viewport.interaction}
      railApi={viewport.rail}
      onSelectPage={viewport.navigation.scrollToPage}
      showTicks
    />
  );
}

export function SplitViewerLegend({ className }: { className?: string }) {
  const { hasOutput, segments, viewport } = useSplitViewerLegend();
  if (!hasOutput) return null;

  return (
    <SegmentLegend
      segments={segments}
      currentPage={viewport.model.currentPage}
      interaction={viewport.interaction}
      onSelect={viewport.navigation.scrollToSegmentStart}
      columns={4}
      variant="plain"
      showUnusedToggle
      className={className}
    />
  );
}

export function SplitViewerDocument({ document }: { document?: ReactNode }) {
  const { hasOutput, isProcessing } = useSplitViewerDocument();

  if (!hasOutput) {
    return <SplitViewerEmptyState isProcessing={isProcessing} />;
  }

  return document ? (
    <FileViewerViewport>{document}</FileViewerViewport>
  ) : (
    <div className="flex h-full flex-1 items-center justify-center">
      <span className="text-muted-foreground text-sm">
        No document available
      </span>
    </div>
  );
}

export function SplitViewerEmptyState({
  isProcessing,
}: {
  isProcessing: boolean;
}) {
  return (
    <div className="bg-background text-muted-foreground flex h-full flex-1 flex-col items-center justify-center gap-4 px-8">
      {isProcessing ? (
        <>
          <Loader2 className="text-warning-foreground h-12 w-12 animate-spin" />
          <p className="text-muted-foreground text-center text-base">
            Splitting...
          </p>
        </>
      ) : (
        <>
          <Scissors className="text-muted-foreground h-16 w-16" />
          <p className="text-muted-foreground text-center text-base">
            Run split to see output
          </p>
          <p className="text-muted-foreground max-w-sm text-center text-sm">
            Upload a document, define subdocuments, then click Run Split
          </p>
        </>
      )}
    </div>
  );
}
