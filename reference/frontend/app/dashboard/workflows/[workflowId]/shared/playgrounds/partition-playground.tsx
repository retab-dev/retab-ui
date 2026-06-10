"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Key, Layers, Loader2, SquareSplitVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import FilePreview from "@/app/dashboard/widgets/components/file-component/file-preview";
import { MIMEData } from "@/app/dashboard/widgets/types/mime";
import type {
  PartitionChunk,
  PartitionChunkLikelihood,
} from "@/types";
import { fetchWithAuth } from "@/backend/client-auth-utils";

import { ModelAdvancedCard } from "@/app/dashboard/workflows/[workflowId]/shared/blocks/registry/model-advanced-card";
import { ConsensusSection } from "@/app/dashboard/workflows/[workflowId]/shared/blocks/registry/consensus-section";

import {
  PlaygroundCanvas,
  InputState,
  RequirementItem,
  ProcessingNodeSection,
  createFileInput,
  hasInputValue,
} from "./execute-playground";
import { SPLIT_SUPPORTED_FILE_ACCEPT } from "./file-accepts";
import { inputStateToUrlBackedMIMEData } from "./upload-input-state";
import { PartitionWaterfall, buildPartitionRuns } from "./partition-waterfall";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface PartitionConfig {
  model: string;
  key: string;
  instructions: string;
  n_consensus: number;
  allow_overlap: boolean;
}

export type { PartitionChunk, PartitionChunkLikelihood } from "@/types";

export interface PartitionConsensus {
  choices: PartitionChunk[][];
  // Frontend-only: `likelihoods` is nullable here (the operator-review snapshot
  // builder emits `{ choices: [], likelihoods: null }`); the generated
  // PartitionConsensus requires a non-null array, so this stays diverged.
  likelihoods: PartitionChunkLikelihood[] | null;
}

export interface PartitionUsage {
  credits: number;
}

export interface PartitionResult {
  output: PartitionChunk[];
  consensus: PartitionConsensus;
  usage: PartitionUsage | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════════

export function formatPartitionPages(pages: number[]): string {
  if (pages.length === 0) return "";
  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(", ");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Key + Instructions Section
// ═══════════════════════════════════════════════════════════════════════════════

interface PartitionKeySectionProps {
  value: string;
  onChange: (value: string) => void;
}

function PartitionKeySection({ value, onChange }: PartitionKeySectionProps) {
  return (
    <div
      className="space-y-2 rounded-lg bg-gray-50 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <Key
          className={cn(
            "h-3.5 w-3.5",
            value.trim() ? "text-indigo-500" : "text-amber-500",
          )}
        />
        <span className="text-[10px] font-medium text-gray-600">Key</span>
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. invoice_number, section_name"
        className="h-7 bg-white !text-xs"
      />
    </div>
  );
}

interface PartitionInstructionsSectionProps {
  value: string;
  onChange: (value: string) => void;
}

function PartitionInstructionsSection({
  value,
  onChange,
}: PartitionInstructionsSectionProps) {
  return (
    <div
      className="space-y-2 rounded-lg bg-gray-50 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <Layers
          className={cn(
            "h-3.5 w-3.5",
            value.trim() ? "text-indigo-500" : "text-amber-500",
          )}
        />
        <span className="text-[10px] font-medium text-gray-600">
          Instructions
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe how to partition the document by this key..."
        className="min-h-[72px] resize-none bg-white !text-xs"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Output renderer
// ═══════════════════════════════════════════════════════════════════════════════

export function PartitionOutputRenderer(
  result: unknown,
  inputStates: InputState[],
  isProcessing: boolean,
) {
  const partitionResult = result as PartitionResult | null;
  const documentInput = inputStates[0];
  const outputResetKey = `${documentInput?.fileBuffer ? "1" : "0"}\u0000${partitionResult?.output.length ?? 0}`;

  return (
    <PartitionOutputRendererContent
      key={outputResetKey}
      partitionResult={partitionResult}
      documentInput={documentInput}
      isProcessing={isProcessing}
    />
  );
}

export function PartitionOutputViewer({
  result,
  fileBuffer,
  fileName,
  fileMimeType = "application/pdf",
  isProcessing = false,
}: {
  result: PartitionResult | null;
  fileBuffer: ArrayBuffer | null | undefined;
  fileName?: string | null;
  fileMimeType?: string | null;
  isProcessing?: boolean;
}) {
  const inputStates = useMemo<InputState[]>(
    () => [
      {
        id: "document",
        type: "file",
        fileBuffer: fileBuffer ?? null,
        fileName: fileName ?? "document",
        fileMimeType: fileMimeType ?? "application/pdf",
        textValue: "",
      },
    ],
    [fileBuffer, fileName, fileMimeType],
  );

  return <>{PartitionOutputRenderer(result, inputStates, isProcessing)}</>;
}

function PartitionOutputRendererContent({
  partitionResult,
  documentInput,
  isProcessing,
}: {
  partitionResult: PartitionResult | null;
  documentInput: InputState | undefined;
  isProcessing: boolean;
}) {
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const [scrollProgress, setScrollProgress] = useState(0);
  const previewPanelRef = useRef<HTMLDivElement | null>(null);
  const hasOutput = !!partitionResult && partitionResult.output.length > 0;

  const voteChoices = useMemo(
    () => partitionResult?.consensus.choices ?? [],
    [partitionResult?.consensus.choices],
  );

  const pageCount = useMemo(() => {
    if (!partitionResult) return 0;
    const collect = (chunks: PartitionChunk[]) =>
      chunks.reduce((max, c) => {
        const last = c.pages.length > 0 ? c.pages[c.pages.length - 1] : 0;
        return last > max ? last : max;
      }, 0);
    const fromOutput = collect(partitionResult.output);
    const fromVotes = voteChoices.reduce(
      (max, chunks) => Math.max(max, collect(chunks)),
      0,
    );
    return Math.max(fromOutput, fromVotes);
  }, [partitionResult, voteChoices]);

  const runs = useMemo(() => {
    if (!partitionResult || pageCount <= 0) return [];
    return buildPartitionRuns(partitionResult.output, voteChoices, pageCount);
  }, [partitionResult, voteChoices, pageCount]);

  const handleJumpToPage = useCallback((page: number) => {
    if (!previewPanelRef.current) return;
    const target = previewPanelRef.current.querySelector<HTMLElement>(
      `[data-page-number="${page}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const currentPageInt = Math.max(1, Math.floor(currentPdfPage));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Waterfall + PDF */}
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {!hasOutput ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gray-50 px-8 text-gray-400">
            {isProcessing ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
                <p className="text-center text-base text-gray-500">
                  Partitioning...
                </p>
              </>
            ) : (
              <>
                <Key className="h-16 w-16 text-gray-200" />
                <p className="text-center text-base text-gray-500">
                  Run partition to see output
                </p>
                <p className="max-w-sm text-center text-sm text-gray-400">
                  Upload a document, set a key and instructions, then click Run
                  Partition
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {runs.length > 0 && pageCount > 0 && (
              <div className="max-h-[45%] flex-shrink-0 overflow-auto border-b border-gray-200">
                <PartitionWaterfall
                  runs={runs}
                  pageCount={pageCount}
                  currentPage={currentPageInt}
                  scrollProgress={scrollProgress}
                  onJumpToPage={handleJumpToPage}
                />
              </div>
            )}
            <section
              ref={previewPanelRef}
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white"
            >
              {isProcessing ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : documentInput?.fileBuffer ? (
                <FilePreview
                  key="full-document-preview"
                  content={documentInput.fileBuffer}
                  mimeType="application/pdf"
                  onCurrentPageChange={setCurrentPdfPage}
                  onScrollProgressChange={setScrollProgress}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="text-sm text-zinc-500">
                    No document available
                  </span>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Inputs / Sections / Requirements / Run handler
// ═══════════════════════════════════════════════════════════════════════════════

export interface PartitionPlaygroundOptions {
  supportsLoadFromRun?: boolean;
}

export function createPartitionInputs(
  options: PartitionPlaygroundOptions = {},
) {
  return [
    createFileInput("document", "Document", {
      supportsLoadFromRun: options.supportsLoadFromRun ?? false,
      fileAccept: SPLIT_SUPPORTED_FILE_ACCEPT,
    }),
  ];
}

export function createPartitionSections(): ProcessingNodeSection[] {
  return [
    {
      type: "custom",
      render: (cfg, onChange) => (
        <ModelAdvancedCard
          model={(cfg.model as string) || "retab-small"}
          onModelChange={(value) => onChange({ ...cfg, model: value })}
          iconColorClassName="text-indigo-500"
        >
          <ConsensusSection
            nConsensus={(cfg.n_consensus as number) ?? 1}
            onChange={(n) => onChange({ ...cfg, n_consensus: n })}
            noun="partition"
          />
        </ModelAdvancedCard>
      ),
    },
    {
      type: "custom",
      render: (cfg, onChange) => (
        <PartitionKeySection
          value={(cfg.key as string) || ""}
          onChange={(value) => onChange({ ...cfg, key: value })}
        />
      ),
    },
    {
      type: "custom",
      render: (cfg, onChange) => (
        <PartitionInstructionsSection
          value={(cfg.instructions as string) || ""}
          onChange={(value) => onChange({ ...cfg, instructions: value })}
        />
      ),
    },
    {
      type: "custom",
      render: (cfg, onChange) => (
        <div
          className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <div className="text-xs font-medium text-gray-700">
              Allow overlapping pages
            </div>
            <div className="text-[11px] text-gray-500">
              Use the overlapping partition engine when chunks can share pages.
            </div>
          </div>
          <Switch
            checked={cfg.allow_overlap === true}
            onCheckedChange={(checked) =>
              onChange({ ...cfg, allow_overlap: checked })
            }
          />
        </div>
      ),
    },
  ];
}

export function getPartitionRequirements(
  inputStates: InputState[],
  cfg: Record<string, unknown>,
): RequirementItem[] {
  const documentState = inputStates[0];
  const hasDocument = hasInputValue(documentState);
  const key = ((cfg.key as string) || "").trim();
  const instructions = ((cfg.instructions as string) || "").trim();

  return [
    {
      id: "document",
      label: "Document",
      isMet: hasDocument,
      description: hasDocument
        ? documentState.fileName || "File loaded"
        : "Upload a document",
    },
    {
      id: "key",
      label: "Key",
      isMet: key.length > 0,
      description: key.length > 0 ? key : "Set a partition key",
    },
    {
      id: "instructions",
      label: "Instructions",
      isMet: instructions.length > 0,
      description:
        instructions.length > 0
          ? `${instructions.length} chars`
          : "Describe the partitioning",
    },
  ];
}

export function createPartitionRunHandler() {
  return async (inputStates: InputState[], cfg: Record<string, unknown>) => {
    const documentState = inputStates[0];
    const key = ((cfg.key as string) || "").trim();
    const instructions = ((cfg.instructions as string) || "").trim();

    if (!hasInputValue(documentState) || !documentState.fileBuffer) {
      throw new Error("Please upload a document first");
    }
    if (!key) {
      throw new Error("Please set a partition key");
    }
    if (!instructions) {
      throw new Error("Please describe how to partition the document");
    }

    const fileName = (documentState.fileName || "").toLowerCase();
    const fileMimeType = (documentState.fileMimeType || "").toLowerCase();
    const isPdf =
      fileName.endsWith(".pdf") || fileMimeType.includes("application/pdf");
    if (!isPdf) {
      throw new Error("Partition playground currently supports PDF files only");
    }

    const documentData: MIMEData =
      await inputStateToUrlBackedMIMEData(documentState);

    const nConsensus = (cfg.n_consensus as number) ?? 1;
    const body = {
      document: documentData,
      key,
      instructions,
      model: (cfg.model as string) || "retab-small",
      allow_overlap: cfg.allow_overlap === true,
      ...(nConsensus > 1 ? { n_consensus: nConsensus } : {}),
    };

    const response = await fetchWithAuth(
      `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/v1/partitions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      {
        timeout: 600000,
        retryConfig: { maxRetries: 2, baseDelay: 2000, maxDelay: 10000 },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Partition failed: ${errorText || response.statusText}`);
    }

    const result = (await response.json()) as PartitionResult;
    toast.success(
      `Document partitioned into ${result.output.length} chunk${
        result.output.length !== 1 ? "s" : ""
      }`,
    );
    return result;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Partition Playground Canvas
// ═══════════════════════════════════════════════════════════════════════════════

export interface PartitionPlaygroundCanvasProps {
  config: PartitionConfig;
  onConfigChange?: (config: Record<string, unknown>) => void;
  className?: string;
  canvasId?: string;
  headerSlot?: ReactNode;
  initialInputStates?: Partial<InputState>[];
  initialResult?: PartitionResult;
  supportsLoadFromRun?: boolean;
  onRun?: (
    inputStates: InputState[],
    cfg: Record<string, unknown>,
  ) => Promise<PartitionResult>;
  // When set, hides the Run affordance (page-owned capability gate).
  runDisabledReason?: string | null;
}

export function PartitionPlaygroundCanvas({
  config,
  onConfigChange,
  className,
  canvasId = "partition-playground-canvas",
  headerSlot,
  initialInputStates,
  initialResult,
  supportsLoadFromRun = false,
  onRun,
  runDisabledReason,
}: PartitionPlaygroundCanvasProps) {
  const inputs = useMemo(
    () => createPartitionInputs({ supportsLoadFromRun }),
    [supportsLoadFromRun],
  );
  const sections = useMemo(() => createPartitionSections(), []);
  const defaultRun = useMemo(() => createPartitionRunHandler(), []);
  const handleRun = onRun || defaultRun;

  return (
    <PlaygroundCanvas
      blockType="partition"
      title="Partition"
      description="Partition documents by a key"
      icon={SquareSplitVertical}
      color="#6366f1"
      inputs={inputs}
      sections={sections}
      config={config as unknown as Record<string, unknown>}
      onConfigChange={onConfigChange}
      getRequirements={getPartitionRequirements}
      onRun={handleRun}
      renderOutput={PartitionOutputRenderer}
      runButtonLabel="Run Partition"
      runningLabel="Partitioning..."
      className={className}
      canvasId={canvasId}
      headerSlot={headerSlot}
      initialInputStates={initialInputStates}
      initialResult={initialResult}
      runDisabledReason={runDisabledReason}
    />
  );
}
