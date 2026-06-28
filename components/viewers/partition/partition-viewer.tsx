"use client";

import * as React from "react";
import { Key, Loader2 } from "lucide-react";

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
  FileViewerInset,
  FileViewerToolbar,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import { PageRibbon } from "@/components/ui/page-ribbon";
import { SegmentLegend } from "@/components/ui/segment-legend";
import {
  SegmentedDocumentProvider,
  useSegmentedDocumentViewport,
} from "@/components/ui/segmented-document-provider";
import { type SegmentViewportController } from "@/components/ui/use-segment-viewport-controller";
import { ViewerHeader } from "@/components/ui/viewer";
import type { PartitionResult } from "@/components/viewers/lib/partition-types";

import {
  createPartitionSegmentedDocumentModel,
  createPartitionViewerModel,
  type PartitionViewerModel,
} from "./partition-viewer-model";

export type PartitionDocumentControls =
  SegmentViewportController["documentHandlers"];

type PartitionViewerContextValue = {
  isProcessing: boolean;
  model: PartitionViewerModel;
  viewport: SegmentViewportController;
};

type PartitionViewerHeaderState = {
  currentPage: SegmentViewportController["model"]["currentPage"];
  interaction: SegmentViewportController["interaction"];
  legendSegments: PartitionViewerModel["legendSegments"];
  navigation: SegmentViewportController["navigation"];
  pageCount: number;
};

type PartitionViewerRibbonState = {
  currentPage: SegmentViewportController["model"]["currentPage"];
  interaction: SegmentViewportController["interaction"];
  navigation: SegmentViewportController["navigation"];
  pageCount: number;
  rows: PartitionViewerModel["ribbonRows"];
  scrollProgress: SegmentViewportController["model"]["scrollProgress"];
};

type PartitionViewerDocumentState = {
  hasOutput: boolean;
};

type PartitionViewerEmptyStatusState = {
  isProcessing: boolean;
};

const PartitionViewerContext =
  React.createContext<PartitionViewerContextValue | null>(null);

export interface PartitionViewerProviderProps {
  result: PartitionResult | null;
  isProcessing?: boolean;
  children: React.ReactNode;
}

export interface PartitionViewerProps {
  result: PartitionResult | null;
  source: ViewerSource;
  isProcessing?: boolean;
  document?: React.ReactNode;
}

function usePartitionViewerContext(): PartitionViewerContextValue {
  const context = React.useContext(PartitionViewerContext);
  if (!context) {
    throw new Error(
      "usePartitionViewer must be used within PartitionViewerProvider.",
    );
  }
  return context;
}

function usePartitionViewerHeader(): PartitionViewerHeaderState {
  const { model, viewport } = usePartitionViewerContext();

  return {
    currentPage: viewport.model.currentPage,
    interaction: viewport.interaction,
    legendSegments: model.legendSegments,
    navigation: viewport.navigation,
    pageCount: model.pageCount,
  };
}

function usePartitionViewerRibbon(): PartitionViewerRibbonState {
  const { model, viewport } = usePartitionViewerContext();

  return {
    currentPage: viewport.model.currentPage,
    interaction: viewport.interaction,
    navigation: viewport.navigation,
    pageCount: model.pageCount,
    rows: model.ribbonRows,
    scrollProgress: viewport.model.scrollProgress,
  };
}

export function usePartitionViewerDocumentControls(): PartitionDocumentControls {
  return usePartitionViewerContext().viewport.documentHandlers;
}

function usePartitionViewerDocument(): PartitionViewerDocumentState {
  return {
    hasOutput: usePartitionViewerContext().model.hasOutput,
  };
}

function usePartitionViewerEmpty(): PartitionViewerEmptyStatusState {
  return {
    isProcessing: usePartitionViewerContext().isProcessing,
  };
}

export function PartitionViewerProvider({
  result,
  isProcessing = false,
  children,
}: PartitionViewerProviderProps) {
  const model = React.useMemo(
    () => createPartitionViewerModel(result),
    [result],
  );
  const segmentedDocumentModel = React.useMemo(
    () => createPartitionSegmentedDocumentModel(model),
    [model],
  );

  return (
    <SegmentedDocumentProvider model={segmentedDocumentModel}>
      <PartitionViewerContextProvider isProcessing={isProcessing} model={model}>
        {children}
      </PartitionViewerContextProvider>
    </SegmentedDocumentProvider>
  );
}

function PartitionViewerContextProvider({
  children,
  isProcessing,
  model,
}: {
  children: React.ReactNode;
  isProcessing: boolean;
  model: PartitionViewerModel;
}) {
  const viewport = useSegmentedDocumentViewport();

  const value = React.useMemo<PartitionViewerContextValue>(
    () => ({
      isProcessing,
      model,
      viewport,
    }),
    [isProcessing, model, viewport],
  );

  return (
    <PartitionViewerContext.Provider value={value}>
      {children}
    </PartitionViewerContext.Provider>
  );
}

export function PartitionViewerHeader({
  className,
  trailing,
}: {
  className?: string;
  trailing?: React.ReactNode;
}) {
  const { currentPage, interaction, legendSegments, navigation } =
    usePartitionViewerHeader();

  if (legendSegments.length === 0) return null;

  return (
    <ViewerHeader className={className ?? "bg-background space-y-2 px-3 py-2"}>
      <SegmentLegend
        variant="plain"
        segments={legendSegments}
        currentPage={currentPage}
        interaction={interaction}
        onSelect={navigation.scrollToSegmentStart}
        columns={4}
      />
      {trailing}
    </ViewerHeader>
  );
}

export function PartitionViewerHeaderMeta({
  className,
}: {
  className?: string;
}) {
  const { currentPage, legendSegments, pageCount } = usePartitionViewerHeader();
  const text = formatHeaderPageLabel({ currentPage, pageCount });

  if (legendSegments.length === 0 || !text) return null;

  return (
    <span className={cn("text-muted-foreground shrink-0 text-xs", className)}>
      {text}
    </span>
  );
}

function formatHeaderPageLabel({
  currentPage,
  pageCount,
}: {
  currentPage: number | null;
  pageCount: number;
}) {
  if (pageCount <= 0) return null;

  const page = Math.min(Math.max(currentPage ?? 1, 1), pageCount);
  return `Page ${page}`;
}

export function PartitionViewerLegend({ className }: { className?: string }) {
  const { currentPage, interaction, legendSegments, navigation } =
    usePartitionViewerHeader();

  if (legendSegments.length === 0) return null;

  return (
    <SegmentLegend
      variant="plain"
      segments={legendSegments}
      currentPage={currentPage}
      interaction={interaction}
      onSelect={navigation.scrollToSegmentStart}
      columns={4}
      className={className}
    />
  );
}

export function PartitionViewerRibbon({ className }: { className?: string }) {
  const {
    currentPage,
    interaction,
    navigation,
    pageCount,
    rows,
    scrollProgress,
  } = usePartitionViewerRibbon();

  if (rows.length === 0) return null;

  return (
    <div className={className ?? "bg-background border-b px-3 py-2"}>
      <PageRibbon
        orientation="horizontal"
        rows={rows}
        pageCount={pageCount}
        currentPage={currentPage}
        scrollProgress={scrollProgress}
        interaction={interaction}
        onSelectPage={navigation.scrollToPage}
      />
    </div>
  );
}

export function PartitionViewerDocument({
  document,
}: {
  document?: React.ReactNode;
}) {
  const { hasOutput } = usePartitionViewerDocument();

  if (!hasOutput) return <PartitionViewerEmptyState />;

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

export function PartitionViewerEmptyState() {
  const { isProcessing } = usePartitionViewerEmpty();

  return (
    <div className="bg-background text-muted-foreground flex h-full flex-1 flex-col items-center justify-center gap-4 px-8">
      {isProcessing ? (
        <>
          <Loader2 className="text-primary h-12 w-12 animate-spin" />
          <p className="text-muted-foreground text-center text-base">
            Partitioning...
          </p>
        </>
      ) : (
        <>
          <Key className="text-muted-foreground h-16 w-16" />
          <p className="text-muted-foreground text-center text-base">
            Run partition to see output
          </p>
          <p className="text-muted-foreground max-w-sm text-center text-sm">
            Upload a document, set a key and instructions, then click Run
            Partition
          </p>
        </>
      )}
    </div>
  );
}

export function PartitionViewer({
  result,
  source,
  isProcessing = false,
  document,
}: PartitionViewerProps) {
  return (
    <PartitionViewerProvider result={result} isProcessing={isProcessing}>
      <FileViewerProvider source={source} headerMode="outlets">
        <FileViewer className="bg-background">
          <PartitionViewerFileHeader />
          <FileViewerBody>
            <FileViewerInset>
              <FileViewerLegend>
                <PartitionViewerLegend className="px-3 py-2" />
              </FileViewerLegend>
              <PartitionViewerRibbon />
              <PartitionViewerDocument document={document} />
            </FileViewerInset>
          </FileViewerBody>
        </FileViewer>
      </FileViewerProvider>
    </PartitionViewerProvider>
  );
}

function PartitionViewerFileHeader() {
  return (
    <FileViewerHeader>
      <FileViewerHeaderStart>
        <FileViewerIdentity meta="hidden" />
        <PartitionViewerHeaderMeta />
      </FileViewerHeaderStart>
      <FileViewerHeaderEnd>
        <FileViewerToolbar />
      </FileViewerHeaderEnd>
    </FileViewerHeader>
  );
}
