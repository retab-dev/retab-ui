"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
  createRef,
} from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { uploadRetabFile } from "@/app/dashboard/shared/files/queries/files";
import type { RetabUploadedFile } from "@/app/dashboard/shared/files/queries/files";
import { formatDistanceToNow } from "date-fns";
import {
  Paperclip,
  Loader2,
  Download,
  Upload,
  X,
  Play,
  CheckCircle2,
  Bot,
  ChevronRight,
  History,
  XCircle,
  List,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Braces,
  Tags,
  Scissors,
  ScanText,
  ImageIcon,
  FileText,
  FileSpreadsheet,
  SquarePen,
  LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { ClerkButton } from "@/components/ui/clerk-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FilePreview from "@/app/dashboard/widgets/components/file-component/file-preview";
import { FilePreviewTooltip } from "@/app/dashboard/shared/schema-editor/file-preview-tooltip";
import ModelDropdown from "@/app/dashboard/components/inference-cards/model-dropdown";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import {
  PrimitiveViewerShell,
  buildMarkdownFromPages,
  downloadBuffer,
  downloadJson,
  downloadMarkdown,
  type PrimitiveViewerDownloadAction,
  type PrimitiveViewerOperation,
} from "@/app/dashboard/shared/primitive-viewer/primitive-viewer";
import {
  useWorkflowRunList,
  fetchRunDocumentContent,
  fetchStepExecution,
  getStepPrimaryHandleData,
} from "@/app/dashboard/workflows/[workflowId]/shared/queries/workflows";
import type { ListWorkflowRunsResponse } from "@/app/dashboard/shared/workflows/types/workflows";
import { useAuth } from "@/app/shared/contexts/auth";
import type {
  WorkflowRun,
  Workflow,
  WorkflowConfigBlock,
  WorkflowConfigEdge,
} from "@/app/dashboard/shared/workflows/types/workflows";
import type { DragFileType } from "@/app/dashboard/workflows/[workflowId]/shared/utils/drag-file";
import { useDragFile } from "@/app/dashboard/workflows/[workflowId]/shared/hooks/use-drag-file";
import { useDragDrop } from "@/app/dashboard/workflows/[workflowId]/shared/blocks/registry/start-document-block-base/hooks/use-drag-drop";
import { CreditsBadge } from "@/app/dashboard/components/inference-cards/credits-badge";

// Combined type for workflow with blocks and edges (constructed from separate collections)
type WorkflowWithGraph = Workflow & {
  blocks?: WorkflowConfigBlock[];
  edges?: WorkflowConfigEdge[];
};
// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type InputType = "file" | "json";

export interface InputDefinition {
  id: string;
  name: string;
  type: InputType;
  label: string;
  icon: LucideIcon;
  color: string;
  placeholder?: string;
  fileAccept?: string;
  allowTypeChange?: boolean;
  supportsLoadFromRun?: boolean;
  // For inputs that should sync with config
  configKey?: string; // If set, this input's text value will be read from and written to config[configKey]
  // Handle ID for matching this input to workflow edges (e.g., "input-file-0", "input-json-0")
  handleId?: string;
}

export interface InputState {
  id: string;
  type: InputType;
  // File input state
  fileBuffer: ArrayBuffer | null;
  fileName: string | null;
  fileMimeType: string;
  uploadedFile?: RetabUploadedFile | null;
  // Text input state
  textValue: string;
}

export interface ProcessingNodeSection {
  type: "model" | "categories" | "input-type" | "instructions" | "custom";
  inputId?: string; // For input-type sections
  render?: (
    config: Record<string, unknown>,
    onConfigChange: (config: Record<string, unknown>) => void,
  ) => ReactNode;
}

export interface RequirementItem {
  id: string;
  label: string;
  isMet: boolean;
  description: string;
  onClick?: () => void;
}

export interface RunExecutionOptions {
  onProgress?: (partialResult: unknown) => void;
}

export type PlaygroundOutputViewMode =
  | "text"
  | "rendered"
  | "file"
  | "template"
  | "original"
  | "filled";

export interface PlaygroundOutputRenderOptions {
  viewMode?: PlaygroundOutputViewMode;
  onViewModeChange?: (viewMode: PlaygroundOutputViewMode) => void;
}

// Base props shared between dialog and canvas modes
export interface PlaygroundCanvasBaseProps {
  // Block identification
  blockType:
    | "classifier"
    | "edit"
    | "extract"
    | "parse"
    | "split"
    | "partition";
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;

  // Inputs configuration
  inputs: InputDefinition[];

  // Processing block sections
  sections: ProcessingNodeSection[];

  // Config state
  config: Record<string, unknown>;
  onConfigChange?: (config: Record<string, unknown>) => void;

  // Requirements calculation
  getRequirements: (
    inputStates: InputState[],
    config: Record<string, unknown>,
  ) => RequirementItem[];

  // Run handler
  onRun: (
    inputStates: InputState[],
    config: Record<string, unknown>,
    options?: RunExecutionOptions,
  ) => Promise<unknown>;

  // Output rendering
  renderOutput: (
    result: unknown,
    inputStates: InputState[],
    isProcessing: boolean,
    options?: PlaygroundOutputRenderOptions,
  ) => ReactNode;

  // Run button customization
  runButtonLabel?: string;
  runningLabel?: string;

  // Requirement click handler (for non-file requirements like schema)
  onRequirementClick?: (requirementId: string) => void;

  // Workflow context (optional, for loading from previous runs)
  blockId?: string;
  workflowId?: string;
  workflow?: WorkflowWithGraph;
}

// Props for the canvas component (standalone, no dialog)
export interface PlaygroundCanvasProps extends PlaygroundCanvasBaseProps {
  // Optional class name for the canvas container
  className?: string;
  // Canvas container ID (for connection overlay)
  canvasId?: string;
  // Header slot for additional controls
  headerSlot?: ReactNode;
  // Initial input states to load when the canvas mounts.
  // Remount the canvas with a new key to apply a different session.
  initialInputStates?: Partial<InputState>[];
  // Initial result to display when the canvas mounts.
  initialResult?: unknown;
  // Optional callback when input handle is clicked - return true to prevent default dialog
  onInputHandleClick?: (
    inputId: string,
    inputState: InputState,
  ) => boolean | void;
  // Callback to report run state changes (for external run button)
  onRunStateChange?: (state: {
    canRun: boolean;
    isRunning: boolean;
    run: () => void;
  }) => void;
  // Hide the floating requirements panel (useful when run controls are in a header)
  hideFloatingPanel?: boolean;
  // Callback when input state changes (e.g., when a file is uploaded)
  onInputStateChange?: (inputId: string, inputState: InputState) => void;
  // When set to a non-empty string, the Run affordance is HIDDEN entirely
  // (not merely disabled) and the reason is surfaced as a hint in the
  // requirements panel. This is the page-owned capability gate: a playground
  // page passes a reason when the current user lacks the RBAC capability to run
  // the primitive, so the run button never appears. `canRun` reported through
  // `onRunStateChange` is forced false as well, so header/external run controls
  // are blocked too.
  runDisabledReason?: string | null;
}

// Props for the dialog wrapper
export interface ExecutePlaygroundProps extends PlaygroundCanvasBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Page-owned capability gate, forwarded to the inner canvas. When set the Run
  // affordance is hidden/disabled and the reason is surfaced; the dialog itself
  // stays openable so read-only users can still inspect the block config.
  runDisabledReason?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════════════════════════════════════════

function getDefaultInputName(type: InputType): string {
  switch (type) {
    case "file":
      return "document";
    case "json":
      return "data";
  }
}

function createInputState(
  input: InputDefinition,
  config: Record<string, unknown>,
  existingState?: Partial<InputState>,
): InputState {
  return {
    id: input.id,
    type: existingState?.type ?? input.type,
    fileBuffer: existingState?.fileBuffer ?? null,
    fileName: existingState?.fileName ?? null,
    fileMimeType: existingState?.fileMimeType ?? "application/pdf",
    uploadedFile: existingState?.uploadedFile ?? null,
    textValue:
      existingState?.textValue ??
      (input.configKey ? (config[input.configKey] as string) || "" : ""),
  };
}

function primitiveOperationFromBlockType(
  blockType: PlaygroundCanvasBaseProps["blockType"],
): PrimitiveViewerOperation {
  return blockType === "classifier" ? "classify" : blockType;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  const record = toRecord(value);
  return Boolean(record && Object.keys(record).length > 0);
}

function getStringField(
  record: Record<string, unknown> | null,
  field: string,
): string | null {
  const value = record?.[field];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getBufferField(
  record: Record<string, unknown> | null,
  field: string,
): ArrayBuffer | null {
  const value = record?.[field];
  return value instanceof ArrayBuffer ? value : null;
}

function getFirstFileInput(inputStates: InputState[]): InputState | null {
  return (
    inputStates.find(
      (inputState) => inputState.type === "file" && inputState.fileBuffer,
    ) ?? null
  );
}

function getFileStem(filename: string) {
  const lastDotIndex = filename.lastIndexOf(".");
  return lastDotIndex > 0 ? filename.slice(0, lastDotIndex) : filename;
}

function getDataUrlMimeType(url: string | null) {
  return url?.match(/^data:([^;]+);/)?.[1] ?? null;
}

function getParsePages(result: unknown) {
  const resultRecord = toRecord(result);
  const outputRecord = toRecord(resultRecord?.output);
  const pages = outputRecord?.pages;
  if (Array.isArray(pages)) {
    return pages.filter((page): page is string => typeof page === "string");
  }

  const legacyPages = resultRecord?.pages;
  if (Array.isArray(legacyPages)) {
    return legacyPages.filter(
      (page): page is string => typeof page === "string",
    );
  }

  const text = outputRecord?.text ?? resultRecord?.text;
  return typeof text === "string" && text.length > 0 ? [text] : [];
}

function buildPrimitiveViewerDownloadActions({
  operation,
  result,
  inputStates,
  config,
}: {
  operation: PrimitiveViewerOperation;
  result: unknown;
  inputStates: InputState[];
  config: Record<string, unknown>;
}): PrimitiveViewerDownloadAction[] {
  const actions: PrimitiveViewerDownloadAction[] = [];
  const fileInput = getFirstFileInput(inputStates);
  const resultRecord = toRecord(result);
  const sourceFilename = fileInput?.fileName || "document";
  const sourceMimeType = fileInput?.fileMimeType || "application/octet-stream";
  const sourceFileStem = getFileStem(sourceFilename);

  const addSourceDocumentAction = (label: string) => {
    const sourceBuffer = fileInput?.fileBuffer;
    if (!sourceBuffer) return;
    actions.push({
      id: "source-document",
      label,
      run: () =>
        downloadBuffer({
          buffer: sourceBuffer,
          filename: sourceFilename,
          mimeType: sourceMimeType,
        }),
    });
  };

  if (operation === "parse") {
    addSourceDocumentAction("Download full document");
    const pages = getParsePages(result);
    if (pages.length > 0) {
      actions.push({
        id: "parsed-markdown",
        label: "Download parsed Markdown",
        run: () =>
          downloadMarkdown(
            buildMarkdownFromPages(pages),
            `${sourceFileStem || "parsed"}-parsed.md`,
          ),
      });
    }
    return actions;
  }

  if (operation === "extract") {
    addSourceDocumentAction("Download document");

    if (isNonEmptyRecord(config.json_schema)) {
      actions.push({
        id: "schema-json",
        label: "Download schema JSON",
        run: () => downloadJson(config.json_schema, "schema.json"),
      });
    }

    if (isNonEmptyRecord(resultRecord?.output)) {
      actions.push({
        id: "extraction-json",
        label: "Download extraction JSON",
        run: () => downloadJson(resultRecord?.output, "extraction.json"),
      });
    }

    if (isNonEmptyRecord(resultRecord?.likelihoods)) {
      actions.push({
        id: "likelihoods-json",
        label: "Download likelihoods JSON",
        run: () => downloadJson(resultRecord?.likelihoods, "likelihoods.json"),
      });
    }

    return actions;
  }

  if (operation === "edit") {
    addSourceDocumentAction("Download input document");

    const templatePdfBuffer = getBufferField(resultRecord, "templatePdfBuffer");
    if (templatePdfBuffer) {
      actions.push({
        id: "template-pdf",
        label: "Download template",
        run: () =>
          downloadBuffer({
            buffer: templatePdfBuffer,
            filename:
              getStringField(resultRecord, "templateName") || "template.pdf",
            mimeType: "application/pdf",
          }),
      });
    }

    const filledBuffer = getBufferField(resultRecord, "filledBuffer");
    if (filledBuffer) {
      const responseRecord = toRecord(resultRecord?.response);
      const filledDocumentRecord = toRecord(responseRecord?.filled_document);
      const filledUrl = getStringField(filledDocumentRecord, "url");
      const filename =
        getStringField(filledDocumentRecord, "filename") ||
        `${sourceFileStem || "document"}-filled`;
      actions.push({
        id: "filled-output",
        label: "Download filled output",
        run: () =>
          downloadBuffer({
            buffer: filledBuffer,
            filename,
            mimeType: getDataUrlMimeType(filledUrl) || sourceMimeType,
          }),
      });
    }

    return actions;
  }

  if (operation === "split") {
    addSourceDocumentAction("Download full document");
    return actions;
  }

  if (operation === "partition") {
    addSourceDocumentAction("Download partition document");
    return actions;
  }

  addSourceDocumentAction("Download document");
  return actions;
}

function getPrimitiveViewerContextText(inputStates: InputState[]) {
  const fileNames = inputStates
    .filter((inputState) => inputState.type === "file" && inputState.fileName)
    .map((inputState) => inputState.fileName);
  return fileNames.length > 0 ? fileNames.join(", ") : null;
}

function getEditPrimitiveViewerState(
  result: unknown,
  inputStates: InputState[],
) {
  const resultRecord = toRecord(result);
  const documentInput =
    inputStates.find((inputState) => inputState.id === "document") ??
    getFirstFileInput(inputStates);
  const hasOriginal = Boolean(
    documentInput?.fileBuffer || getBufferField(resultRecord, "originalBuffer"),
  );
  const hasOutput = Boolean(getBufferField(resultRecord, "filledBuffer"));
  const detectedFields = resultRecord?.detectedFields;
  const hasDetectedFields =
    Array.isArray(detectedFields) && detectedFields.length > 0;
  const templateFields = resultRecord?.templateFields;
  const hasTemplateFields =
    Array.isArray(templateFields) && templateFields.length > 0;
  const hasTemplatePdf = Boolean(
    getBufferField(resultRecord, "templatePdfBuffer"),
  );
  const hasTemplateView =
    (resultRecord?.isPdfFile === true && hasDetectedFields && hasOriginal) ||
    (hasTemplatePdf && hasTemplateFields);
  const availableTabs = hasTemplateView
    ? [
        {
          label: "Template",
          value: "template" as PlaygroundOutputViewMode,
          icon: <FileSpreadsheet className="size-4" />,
        },
        ...(hasOutput
          ? [
              {
                label: "Filled",
                value: "filled" as PlaygroundOutputViewMode,
                icon: <FileText className="size-4" />,
              },
            ]
          : []),
      ]
    : [
        ...(hasOriginal
          ? [
              {
                label: "Original",
                value: "original" as PlaygroundOutputViewMode,
                icon: <FileText className="size-4" />,
              },
            ]
          : []),
        ...(hasOutput
          ? [
              {
                label: "Filled",
                value: "filled" as PlaygroundOutputViewMode,
                icon: <SquarePen className="size-4" />,
              },
            ]
          : []),
      ];

  if (availableTabs.length < 2) {
    return {
      tabs: [] as Array<{
        label: string;
        value: PlaygroundOutputViewMode;
        icon: ReactNode;
      }>,
      fallbackViewMode: "filled" as PlaygroundOutputViewMode,
    };
  }

  if (hasTemplateView) {
    return {
      tabs: availableTabs,
      fallbackViewMode: (hasOutput
        ? "filled"
        : "template") as PlaygroundOutputViewMode,
    };
  }

  return {
    tabs: availableTabs,
    fallbackViewMode: (hasOutput
      ? "filled"
      : hasOriginal
        ? "original"
        : "filled") as PlaygroundOutputViewMode,
  };
}

function createInitialInputStates(
  inputs: InputDefinition[],
  config: Record<string, unknown>,
  initialInputStates?: Partial<InputState>[],
): InputState[] {
  const initialStateById = new Map(
    (initialInputStates ?? [])
      .filter((state): state is Partial<InputState> & { id: string } =>
        Boolean(state.id),
      )
      .map((state) => [state.id, state]),
  );

  return inputs.map((input) =>
    createInputState(input, config, initialStateById.get(input.id)),
  );
}

function areInputStatesEqual(
  current: InputState[],
  next: InputState[],
): boolean {
  if (current.length !== next.length) return false;
  return current.every((state, index) => {
    const nextState = next[index];
    if (!nextState) return false;
    return (
      state.id === nextState.id &&
      state.type === nextState.type &&
      state.fileBuffer === nextState.fileBuffer &&
      state.fileName === nextState.fileName &&
      state.fileMimeType === nextState.fileMimeType &&
      state.uploadedFile?.url === nextState.uploadedFile?.url &&
      state.textValue === nextState.textValue
    );
  });
}

function hasInputValue(state: InputState | null | undefined): boolean {
  if (!state) return false;
  if (state.type === "file") {
    return state.fileBuffer !== null;
  }
  return state.textValue.trim().length > 0;
}

function isFileAccepted(file: File, acceptedValues?: string): boolean {
  if (!acceptedValues) return true;

  const tokens = acceptedValues
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length === 0) return true;

  const fileName = file.name.toLowerCase();
  const fileType = (file.type || "").toLowerCase();

  return tokens.some((token) => {
    if (token.startsWith(".")) {
      return fileName.endsWith(token);
    }
    if (token.endsWith("/*")) {
      const prefix = token.slice(0, -1);
      return fileType.startsWith(prefix);
    }
    if (token.includes("/")) {
      return fileType === token;
    }
    return fileName.endsWith(token);
  });
}

function getAcceptedFileTypesLabel(acceptedValues?: string): string {
  return acceptedValues || "this input";
}

// ═══════════════════════════════════════════════════════════════════════════════
// Floating Requirements Panel
// ═══════════════════════════════════════════════════════════════════════════════

interface FloatingRequirementsPanelProps {
  requirements: RequirementItem[];
  canRun: boolean;
  isRunning: boolean;
  onRun: () => void;
  runButtonLabel: string;
  runningLabel: string;
  // When set, the Run button is replaced by a "no permission" hint.
  runDisabledReason?: string | null;
  // Previous runs
  showLoadFromRun?: boolean;
  onLoadFromRun?: (run: WorkflowRun) => void;
  isLoadingFromRun?: boolean;
  completedRuns?: WorkflowRun[];
  isLoadingRuns?: boolean;
  paginationMetadata?: ListWorkflowRunsResponse["list_metadata"];
  onPrevPage?: () => void;
  onNextPage?: () => void;
}

function getRequirementIcon(requirement: RequirementItem): React.ReactNode {
  const requirementKey = `${requirement.id} ${requirement.label}`.toLowerCase();

  if (requirementKey.includes("schema")) {
    return (
      <Braces
        className={cn(
          "h-3.5 w-3.5",
          requirement.isMet ? "text-violet-500" : "text-violet-400",
        )}
      />
    );
  }

  if (
    requirementKey.includes("instruction") ||
    requirementKey.includes("filling")
  ) {
    return (
      <Braces
        className={cn(
          "h-3.5 w-3.5",
          requirement.isMet ? "text-violet-500" : "text-gray-400",
        )}
      />
    );
  }

  if (requirementKey.includes("categor")) {
    return (
      <Tags
        className={cn(
          "h-3.5 w-3.5",
          requirement.isMet ? "text-teal-500" : "text-gray-400",
        )}
      />
    );
  }

  if (requirementKey.includes("subdocument")) {
    return (
      <Scissors
        className={cn(
          "h-3.5 w-3.5",
          requirement.isMet ? "text-amber-500" : "text-gray-400",
        )}
      />
    );
  }

  return (
    <Paperclip
      className={cn(
        "h-3.5 w-3.5",
        requirement.isMet ? "text-green-500" : "text-gray-400",
      )}
    />
  );
}

function FloatingRequirementsPanel({
  requirements,
  canRun,
  isRunning,
  onRun,
  runButtonLabel,
  runningLabel,
  runDisabledReason,
  showLoadFromRun = false,
  onLoadFromRun,
  isLoadingFromRun = false,
  completedRuns = [],
  isLoadingRuns = false,
  paginationMetadata,
  onPrevPage,
  onNextPage,
}: FloatingRequirementsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const readyCount = requirements.filter((r) => r.isMet).length;
  const totalCount = requirements.length;
  const allReady = readyCount === totalCount;

  return (
    <div className="absolute top-4 left-4 z-30 transition-all duration-300 ease-in-out">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "w-56 overflow-hidden rounded-sm border bg-white",
          allReady ? "border-gray-200" : "border-amber-200",
        )}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-[9px] transition-colors",
            allReady
              ? "bg-gray-50 hover:bg-gray-100"
              : "bg-amber-50 hover:bg-amber-100",
          )}
        >
          <List
            className={cn(
              "h-4 w-4 flex-shrink-0",
              allReady ? "text-gray-500" : "text-amber-500",
            )}
          />
          <span
            className={cn(
              "flex-1 text-left text-xs font-medium",
              allReady ? "text-gray-800" : "text-amber-800",
            )}
          >
            Requirements
          </span>
          <div className="flex items-center">
            <div className="mr-2 flex items-center gap-0.5">
              {requirements.map((req) => (
                <div
                  key={req.id}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-colors",
                    req.isMet ? "bg-green-500" : "bg-gray-300",
                  )}
                />
              ))}
            </div>
            {isCollapsed ? (
              <ChevronDown
                className={cn(
                  "h-4 w-4",
                  allReady ? "text-gray-500" : "text-amber-500",
                )}
              />
            ) : (
              <ChevronUp
                className={cn(
                  "h-4 w-4",
                  allReady ? "text-gray-500" : "text-amber-500",
                )}
              />
            )}
          </div>
        </button>

        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className={cn(
                  "max-h-64 space-y-0 divide-y divide-gray-100 overflow-y-auto px-2",
                  allReady
                    ? "border-t border-gray-200"
                    : "border-t border-amber-200",
                )}
              >
                {requirements.map((req) => (
                  <div
                    key={req.id}
                    className={cn(
                      "flex items-start gap-2.5 bg-white py-2 transition-colors",
                      req.onClick &&
                        "cursor-pointer rounded-sm hover:bg-gray-50",
                    )}
                    onClick={req.onClick}
                    role={req.onClick ? "button" : undefined}
                    tabIndex={req.onClick ? 0 : undefined}
                    onKeyDown={
                      req.onClick
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              req.onClick?.();
                            }
                          }
                        : undefined
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-sm border border-gray-200 bg-white">
                          {getRequirementIcon(req)}
                        </div>
                        <p className="truncate text-xs font-medium text-gray-800">
                          {req.label}
                        </p>
                      </div>
                      <div className="mt-1 space-y-0.5">
                        <div className="flex items-center gap-1">
                          {req.isMet ? (
                            <CheckCircle2 className="h-2.5 w-2.5 flex-shrink-0 text-green-500" />
                          ) : (
                            <Upload className="h-2.5 w-2.5 flex-shrink-0 text-orange-500" />
                          )}
                          <p
                            className={cn(
                              "truncate text-[10px]",
                              req.isMet ? "text-green-600" : "text-orange-600",
                            )}
                          >
                            {req.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load from previous run */}
              {showLoadFromRun && onLoadFromRun && (
                <div className="mt-2 px-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-full text-xs text-gray-600 hover:text-gray-800"
                        disabled={isLoadingFromRun}
                      >
                        {isLoadingFromRun ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <History className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Load from previous run
                        <ChevronDown className="ml-auto h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[250px]">
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <DropdownMenuLabel className="p-0 text-[10px] font-normal text-gray-500">
                          Previous runs
                        </DropdownMenuLabel>
                        <div className="flex items-center gap-0">
                          <Button
                            variant="ghost"
                            size="iconXs"
                            className="text-2xs group px-1 py-1"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onPrevPage?.();
                            }}
                            disabled={
                              !paginationMetadata?.before || isLoadingRuns
                            }
                          >
                            <ChevronLeft className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="iconXs"
                            className="text-2xs group px-1 py-1"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onNextPage?.();
                            }}
                            disabled={
                              !paginationMetadata?.after || isLoadingRuns
                            }
                          >
                            <ChevronRight className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                      <DropdownMenuSeparator />
                      {isLoadingRuns ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        </div>
                      ) : completedRuns.length === 0 ? (
                        <div className="px-2 py-4 text-center text-[11px] text-gray-400">
                          No completed runs available
                        </div>
                      ) : (
                        <div className="flex max-h-[200px] flex-col gap-1 overflow-y-auto">
                          {completedRuns.map((run) => (
                            <DropdownMenuItem
                              key={run.id}
                              disabled={isLoadingFromRun}
                              onClick={() => onLoadFromRun(run)}
                              className="flex cursor-pointer items-center gap-2"
                            >
                              {run.lifecycle.status === "completed" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
                              )}
                              <div className="flex min-w-0 flex-1 justify-between">
                                <p className="truncate text-[11px] font-medium text-gray-700">
                                  Run {run.id.slice(-8)}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  {formatDistanceToNow(
                                    new Date(
                                      run.timing.started_at ??
                                        run.timing.created_at,
                                    ),
                                    {
                                      addSuffix: true,
                                    },
                                  )}
                                </p>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </div>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              {/* Run Button — hidden entirely when the page reports a
                  capability denial (`runDisabledReason`); a hint takes its
                  place so the affordance is gone, not merely disabled. */}
              <div className="px-1 pb-1">
                {runDisabledReason ? (
                  <div
                    role="note"
                    className="flex items-center justify-center gap-1.5 rounded-sm border border-gray-200 bg-gray-50 px-3 py-2 text-center text-[11px] text-gray-500"
                  >
                    <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    <span>{runDisabledReason}</span>
                  </div>
                ) : (
                  <Button
                    onClick={onRun}
                    disabled={!canRun}
                    size="sm"
                    className={cn(
                      "group before:transtion-opacity relative isolate inline-flex h-[1.875rem] w-full items-center justify-center overflow-hidden rounded-sm bg-gray-900 px-3 text-left text-sm font-medium text-white ring-1 ring-gray-900 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-sm before:bg-gradient-to-b before:from-white/20 before:opacity-50 before:duration-300 before:ease-[cubic-bezier(0.4,0.36,0,1)] after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-sm after:bg-gradient-to-b after:from-white/10 after:from-[46%] after:to-[54%] after:mix-blend-overlay hover:before:opacity-100",
                      canRun ? "cursor-pointer" : "cursor-not-allowed",
                    )}
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {runningLabel}
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        {runButtonLabel}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Generic Input Node
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Stage a newly selected file into an InputState.
 *
 * This is split out from `GenericInputNode.loadFile` so the synchronous-clear
 * behaviour is unit-testable. The key invariant: any stale `uploadedFile` must
 * be cleared **synchronously** (before any await), so that a Run firing during
 * the upload window cannot pick up the previous file's cached URL. Previously
 * this ran `await file.arrayBuffer()` and `await uploadRetabFile(file)` first,
 * leaving the old `uploadedFile` visible to a concurrent Run handler which
 * would then send the OLD file's URL to the backend.
 */
export async function loadFileIntoInputState(
  state: InputState,
  file: File,
  onStateChange: (next: InputState) => void,
): Promise<void> {
  onStateChange({
    ...state,
    fileBuffer: null,
    fileName: file.name,
    fileMimeType: file.type || "application/octet-stream",
    uploadedFile: null,
    textValue: "",
  });
  const buffer = await file.arrayBuffer();
  const uploadedFile = await uploadRetabFile(file);
  onStateChange({
    ...state,
    fileBuffer: buffer,
    fileName: file.name,
    fileMimeType: file.type || "application/octet-stream",
    uploadedFile,
    textValue: "",
  });
}

interface GenericInputNodeProps {
  definition: InputDefinition;
  state: InputState;
  onStateChange: (state: InputState) => void;
  onViewContent?: () => void;
  handleRef?: React.RefObject<HTMLDivElement | null>;
  dragFileType?: DragFileType;
  uploadTriggerRef?: React.MutableRefObject<(() => void) | null>;
}

function GenericInputNode({
  definition,
  state,
  onStateChange,
  onViewContent,
  handleRef,
  dragFileType,
  uploadTriggerRef,
}: GenericInputNodeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expose a trigger function so parent can programmatically open the file picker
  useMountEffect(() => {
    if (!uploadTriggerRef) return;
    uploadTriggerRef.current = () => fileInputRef.current?.click();
    return () => {
      uploadTriggerRef.current = null;
    };
  });
  const hasInput = hasInputValue(state);
  const isFileInput = state.type === "file";

  const loadFile = useCallback(
    async (file: File) => {
      try {
        await loadFileIntoInputState(state, file, onStateChange);
        toast.success("File loaded successfully");
      } catch (error) {
        console.error("Error loading file:", error);
        toast.error("Failed to load file");
      }
    },
    [state, onStateChange],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!isFileAccepted(file, definition.fileAccept)) {
        toast.error(
          `File type not supported. Accepted: ${getAcceptedFileTypesLabel(definition.fileAccept)}`,
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      await loadFile(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [definition.fileAccept, loadFile],
  );

  const validateDroppedFile = useCallback(
    (file: File) => {
      const isValid = isFileAccepted(file, definition.fileAccept);
      if (!isValid) {
        toast.error(
          `File type not supported. Accepted: ${getAcceptedFileTypesLabel(definition.fileAccept)}`,
        );
      }
      return isValid;
    },
    [definition.fileAccept],
  );

  const {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = useDragDrop({
    onDrop: loadFile,
    validateFile: validateDroppedFile,
  });

  // Text file drag-and-drop for JSON inputs
  const loadTextFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        let jsonText: string;
        try {
          JSON.parse(text);
          jsonText = text;
        } catch {
          jsonText = JSON.stringify({ text }, null, 2);
        }
        onStateChange({
          ...state,
          textValue: jsonText,
          fileBuffer: null,
          fileName: null,
          uploadedFile: null,
        });
        toast.success(`Loaded ${file.name}`);
      } catch (error) {
        console.error("Error loading text file:", error);
        toast.error("Failed to load file");
      }
    },
    [state, onStateChange],
  );

  const validateTextFile = useCallback((file: File) => {
    const textExtensions = [
      ".json",
      ".txt",
      ".csv",
      ".xml",
      ".md",
      ".yaml",
      ".yml",
      ".log",
      ".tsv",
      ".html",
      ".htm",
    ];
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
    const isText =
      file.type.startsWith("text/") ||
      file.type === "application/json" ||
      textExtensions.includes(ext);
    if (!isText) {
      toast.error("Only text files are supported for this input");
    }
    return isText;
  }, []);

  const {
    isDragging: isTextDragging,
    handleDragEnter: handleTextDragEnter,
    handleDragLeave: handleTextDragLeave,
    handleDragOver: handleTextDragOver,
    handleDrop: handleTextDrop,
  } = useDragDrop({
    onDrop: loadTextFile,
    validateFile: validateTextFile,
  });

  const handleTextChange = useCallback(
    (value: string) => {
      onStateChange({
        ...state,
        textValue: value,
        // Clear file state when text is entered
        fileBuffer: value.trim() ? null : state.fileBuffer,
        fileName: value.trim() ? null : state.fileName,
        uploadedFile: value.trim() ? null : state.uploadedFile,
      });
    },
    [state, onStateChange],
  );

  const handleClear = useCallback(() => {
    onStateChange({
      ...state,
      fileBuffer: null,
      fileName: null,
      fileMimeType: "application/pdf",
      uploadedFile: null,
      textValue: "",
    });
  }, [state, onStateChange]);

  const Icon = definition.icon;
  const showGlobalHighlight =
    dragFileType !== null && !isDragging && !isTextDragging && !hasInput;
  const showDragHighlight =
    (isDragging || isTextDragging || showGlobalHighlight) && !hasInput;

  const getInputTitle = () => {
    switch (state.type) {
      case "json":
        return "JSON Input";
      default:
        return definition.label;
    }
  };

  return (
    <div className="relative">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept={
          definition.fileAccept ||
          ".pdf,.png,.jpg,.jpeg,.webp,.gif,.tiff,.bmp,.heic,.heif"
        }
      />

      {/* Main Card */}
      <div
        className={cn(
          "min-w-[200px] overflow-hidden rounded-lg border bg-white transition-all",
          "border-gray-200",
          showDragHighlight && "scale-[1.02] border-blue-400 bg-blue-50/50",
        )}
        onDragEnter={isFileInput ? handleDragEnter : handleTextDragEnter}
        onDragLeave={isFileInput ? handleDragLeave : handleTextDragLeave}
        onDragOver={isFileInput ? handleDragOver : handleTextDragOver}
        onDrop={isFileInput ? handleDrop : handleTextDrop}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
          {state.type === "json" ? (
            <Braces className="h-5 w-5 flex-shrink-0 text-violet-500" />
          ) : (
            <Icon
              className="h-5 w-5 flex-shrink-0"
              style={{ color: definition.color }}
            />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-medium text-gray-900">
              {getInputTitle()}
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2 px-4 py-3">
          {state.type === "file" ? (
            // File input content
            <>
              {hasInput ? (
                <FilePreviewTooltip
                  contextFileFetcher={async () => {
                    const file = new File(
                      [state.fileBuffer!],
                      state.fileName || "file",
                      { type: state.fileMimeType },
                    );
                    return {
                      id: state.id,
                      file,
                      buffer: state.fileBuffer!,
                    };
                  }}
                >
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 p-2">
                    <Paperclip className="h-4 w-4 flex-shrink-0 text-green-600" />
                    <span
                      className="flex max-w-[140px] cursor-pointer items-center text-xs text-green-700 hover:underline"
                      onClick={onViewContent}
                    >
                      <span className="truncate">
                        {state.fileName?.replace(/\.[^/.]+$/, "")}
                      </span>
                      <span className="flex-shrink-0">
                        {state.fileName?.match(/\.[^/.]+$/)?.[0] || ""}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                      onClick={handleClear}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </FilePreviewTooltip>
              ) : showDragHighlight ? (
                <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/50 p-3">
                  <Upload className="h-4 w-4 animate-bounce text-blue-500" />
                  <span className="text-xs font-medium text-blue-600">
                    Drop file here
                  </span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full border-dashed text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload or drop file
                </Button>
              )}
            </>
          ) : (
            // Text/JSON input content
            <div className="flex flex-col items-start gap-2">
              {isTextDragging ? (
                <div className="flex h-24 w-[200px] max-w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-violet-300 bg-violet-50/50">
                  <Upload className="h-4 w-4 animate-bounce text-violet-500" />
                  <span className="text-xs font-medium text-violet-600">
                    Drop text file here
                  </span>
                </div>
              ) : (
                <textarea
                  value={state.textValue}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder={definition.placeholder || '{"key": "value"}'}
                  className={cn(
                    "block h-24 w-[200px] max-w-full resize-none rounded-lg border p-2 text-xs focus:ring-2 focus:outline-none",
                    "border-violet-200 bg-violet-50/50 font-mono focus:ring-violet-300",
                  )}
                />
              )}
              {hasInput && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-fit justify-start px-0 text-xs text-gray-500 hover:text-red-500"
                  onClick={handleClear}
                >
                  <X className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Connection anchor (invisible) */}
      <div
        ref={handleRef}
        className="pointer-events-none absolute top-1/2 right-0 h-0 w-0 -translate-y-1/2"
        aria-hidden
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Processing Node
// ═══════════════════════════════════════════════════════════════════════════════

interface ProcessingNodeProps {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  inputHandles: React.RefObject<HTMLDivElement | null>[];
  outputRef?: React.RefObject<HTMLDivElement | null>;
  cardClassName?: string;
  creditsPerPage?: number;
  children: ReactNode;
}

function ProcessingNode({
  icon: Icon,
  title,
  description,
  color,
  inputHandles,
  outputRef,
  cardClassName,
  creditsPerPage,
  children,
}: ProcessingNodeProps) {
  return (
    <div className="relative">
      {/* Main Card */}
      <div
        className={cn(
          "min-w-[280px] overflow-hidden rounded-lg border border-gray-200 bg-white transition-all",
          cardClassName,
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
          <Icon className="h-5 w-5 flex-shrink-0" style={{ color }} />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-medium text-gray-900">{title}</h3>
          </div>
          {creditsPerPage != null && (
            <CreditsBadge
              creditsPerPage={creditsPerPage}
              tooltipText={`Uses ${creditsPerPage < 1 ? creditsPerPage.toFixed(2).replace(/\.?0+$/, "") : creditsPerPage} credit${creditsPerPage !== 1 ? "s" : ""} per page processed`}
            />
          )}
        </div>

        {/* Settings */}
        <div className="space-y-3 px-4 pt-3 pb-4">
          <p className="text-xs text-gray-500">{description}</p>
          {children}
        </div>
      </div>

      {/* Input connection anchors (invisible) */}
      {inputHandles.map((handleRef, index) => {
        const topPercent =
          inputHandles.length > 1
            ? ((index + 1) / (inputHandles.length + 1)) * 100
            : 50;

        return (
          <div
            key={index}
            ref={handleRef}
            className="pointer-events-none absolute left-0 h-0 w-0 -translate-x-1/2 -translate-y-1/2"
            style={{ top: `${topPercent}%` }}
            aria-hidden
          />
        );
      })}

      {/* Output connection anchor (invisible) */}
      <div
        ref={outputRef}
        className="pointer-events-none absolute top-1/2 right-0 h-0 w-0 translate-x-1/2 -translate-y-1/2"
        aria-hidden
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Connection Overlay
// ═══════════════════════════════════════════════════════════════════════════════

interface ConnectionOverlayProps {
  connections: {
    from: React.RefObject<HTMLDivElement | null>;
    to: React.RefObject<HTMLDivElement | null>;
    active: boolean;
  }[];
  containerId: string;
}

function ConnectionOverlayResizeRunner({
  containerId,
  updatePathsRef,
}: {
  containerId: string;
  updatePathsRef: React.MutableRefObject<() => void>;
}) {
  useMountEffect(() => {
    const updatePaths = () => updatePathsRef.current();
    window.addEventListener("resize", updatePaths);

    const container = document.getElementById(containerId);
    const observer = new ResizeObserver(updatePaths);
    if (container) {
      observer.observe(container);
    }

    return () => {
      window.removeEventListener("resize", updatePaths);
      observer.disconnect();
    };
  });

  return null;
}

function ConnectionOverlayRefreshRunner({
  updatePathsRef,
}: {
  updatePathsRef: React.MutableRefObject<() => void>;
}) {
  useMountEffect(() => {
    const updatePaths = () => updatePathsRef.current();
    const initialTimeout = setTimeout(updatePaths, 100);
    const intervalId = setInterval(updatePaths, 200);
    const stopIntervalTimeout = setTimeout(
      () => clearInterval(intervalId),
      2000,
    );

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
      clearTimeout(stopIntervalTimeout);
    };
  });

  return null;
}

function ConnectionOverlay({
  connections,
  containerId,
}: ConnectionOverlayProps) {
  const [paths, setPaths] = useState<
    { d: string; color: string; id: string }[]
  >([]);
  const connectionsRef = useRef(connections);
  const containerIdRef = useRef(containerId);
  connectionsRef.current = connections;
  containerIdRef.current = containerId;

  const updatePathsRef = useRef<() => void>(() => {});
  updatePathsRef.current = () => {
    const container = document.getElementById(containerIdRef.current);
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    const newPaths = connectionsRef.current
      .map((conn) => {
        if (!conn.from.current || !conn.to.current) return null;

        const fromRect = conn.from.current.getBoundingClientRect();
        const toRect = conn.to.current.getBoundingClientRect();

        // Gap between handles and arrows
        const gap = 6;

        // Start from the right edge of the "from" element + gap (center vertically)
        const startX = fromRect.right - containerRect.left + gap;
        const startY = fromRect.top + fromRect.height / 2 - containerRect.top;

        // End at the left edge of the "to" element - gap (center vertically)
        const endX = toRect.left - containerRect.left - gap;
        const endY = toRect.top + toRect.height / 2 - containerRect.top;

        // L-shaped path: horizontal to midpoint, then vertical, then horizontal to end
        const midX = (startX + endX) / 2;
        const d = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;

        return {
          d,
          color: conn.active ? "#bbf7d0" : "#d1d5db",
          id: `arrow-${conn.active ? "active" : "inactive"}`,
        };
      })
      .filter(Boolean) as { d: string; color: string; id: string }[];

    setPaths(newPaths);
  };

  const refreshRunnerRef = useRef({
    connections,
    containerId,
    version: 0,
  });
  if (
    refreshRunnerRef.current.connections !== connections ||
    refreshRunnerRef.current.containerId !== containerId
  ) {
    refreshRunnerRef.current = {
      connections,
      containerId,
      version: refreshRunnerRef.current.version + 1,
    };
  }

  return (
    <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible">
      <ConnectionOverlayResizeRunner
        key={containerId}
        containerId={containerId}
        updatePathsRef={updatePathsRef}
      />
      <ConnectionOverlayRefreshRunner
        key={refreshRunnerRef.current.version}
        updatePathsRef={updatePathsRef}
      />
      <defs>
        {/* Arrow marker pointing right (toward end of path) */}
        <marker
          id="sim-arrow-active"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L8,4 L0,8 z" fill="#bbf7d0" />
        </marker>
        <marker
          id="sim-arrow-inactive"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L8,4 L0,8 z" fill="#d1d5db" />
        </marker>
      </defs>
      {paths.map((path, i) => (
        <path
          key={i}
          d={path.d}
          fill="none"
          stroke={path.color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd={
            path.color === "#bbf7d0"
              ? "url(#sim-arrow-active)"
              : "url(#sim-arrow-inactive)"
          }
          style={{ transition: "stroke 0.3s ease" }}
        />
      ))}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Playground Canvas - The core canvas component (usable standalone or in dialog)
// ═══════════════════════════════════════════════════════════════════════════════

function PlaygroundRunStateChangeRunner({
  canRun,
  isRunning,
  run,
  onRunStateChange,
}: {
  canRun: boolean;
  isRunning: boolean;
  run: () => void;
  onRunStateChange?: (state: {
    canRun: boolean;
    isRunning: boolean;
    run: () => void;
  }) => void;
}) {
  useMountEffect(() => {
    onRunStateChange?.({ canRun, isRunning, run });
  });

  return null;
}

function PlaygroundInputShapeRunner({
  inputs,
  config,
  setInputStates,
}: {
  inputs: InputDefinition[];
  config: Record<string, unknown>;
  setInputStates: React.Dispatch<React.SetStateAction<InputState[]>>;
}) {
  useMountEffect(() => {
    setInputStates((prev) => {
      const previousById = new Map(prev.map((state) => [state.id, state]));
      const next = inputs.map((input) =>
        createInputState(input, config, previousById.get(input.id)),
      );
      return areInputStatesEqual(prev, next) ? prev : next;
    });
  });

  return null;
}

function ExecuteDialogConfigResetRunner({
  open,
  config,
  setLocalConfig,
  setLoadedInputStates,
}: {
  open: boolean;
  config: Record<string, unknown>;
  setLocalConfig: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  setLoadedInputStates: React.Dispatch<
    React.SetStateAction<Partial<InputState>[] | undefined>
  >;
}) {
  useMountEffect(() => {
    if (!open) return;
    setLocalConfig(config);
    setLoadedInputStates(undefined);
  });

  return null;
}

export function PlaygroundCanvas({
  blockType,
  title,
  description,
  icon,
  color,
  inputs,
  sections,
  config,
  onConfigChange,
  getRequirements,
  onRun,
  renderOutput,
  runButtonLabel: customRunButtonLabel,
  runningLabel: customRunningLabel,
  blockId,
  workflowId,
  workflow,
  className,
  canvasId = "playground-canvas",
  headerSlot,
  initialInputStates,
  initialResult,
  onInputHandleClick,
  onRunStateChange,
  hideFloatingPanel = false,
  onInputStateChange,
  onRequirementClick,
  runDisabledReason,
}: PlaygroundCanvasProps) {
  const { fetchWithAuth: fetchWithAuthContext } = useAuth();
  const dragFileType = useDragFile();

  // Input states - one per input definition
  const [inputStates, setInputStates] = useState<InputState[]>(() =>
    createInitialInputStates(inputs, config, initialInputStates),
  );

  // Local config state
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>(
    () => config,
  );

  // Processing state
  const [result, setResult] = useState<unknown>(() => initialResult ?? null);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputShapeSyncKey = useMemo(
    () =>
      JSON.stringify(
        inputs.map((input) => ({
          id: input.id,
          type: input.type,
          configKey: input.configKey ?? null,
          handleId: input.handleId ?? null,
          supportsLoadFromRun: input.supportsLoadFromRun ?? false,
          defaultText: input.configKey
            ? (config[input.configKey] as string) || ""
            : "",
        })),
      ),
    [config, inputs],
  );
  // Previous runs state
  const [isLoadingFromRun, setIsLoadingFromRun] = useState(false);
  const [runsBeforeCursor, setRunsBeforeCursor] = useState<
    string | undefined
  >();
  const [runsAfterCursor, setRunsAfterCursor] = useState<string | undefined>();

  // Dialog state
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewInputId, setPreviewInputId] = useState<string | null>(null);

  // Refs for connection handles
  const inputOutRefs = useRef<
    Record<string, React.RefObject<HTMLDivElement | null>>
  >({});
  const processingInRefs = useRef<
    Record<string, React.RefObject<HTMLDivElement | null>>
  >({});
  const processingOutRef = useRef<HTMLDivElement>(null);
  const outputInRef = useRef<HTMLDivElement>(null);

  // Refs for programmatic file upload triggers (one per input)
  const uploadTriggerRefs = useRef<
    Record<string, React.MutableRefObject<(() => void) | null>>
  >({});

  // Fetch previous runs
  const { data: runsData, isLoading: isLoadingRuns } = useWorkflowRunList(
    workflowId
      ? {
          workflow_id: workflowId,
          limit: 10,
          order: "desc",
          before: runsBeforeCursor,
          after: runsAfterCursor,
        }
      : {},
  );

  // All completed/errored runs. Per-block filtering would require fetching
  // the per-run step list separately; for the playground load flow, operators
  // can pick any completed run and the load step below handles missing data
  // gracefully.
  const completedRuns =
    runsData?.data?.filter(
      (run) =>
        run.lifecycle.status === "completed" ||
        run.lifecycle.status === "error",
    ) ?? [];
  const runsPaginationMetadata = runsData?.list_metadata;

  // Handlers
  const handleRunsPrevPage = useCallback(() => {
    if (runsPaginationMetadata?.before) {
      setRunsAfterCursor(undefined);
      setRunsBeforeCursor(runsPaginationMetadata.before);
    }
  }, [runsPaginationMetadata?.before]);

  const handleRunsNextPage = useCallback(() => {
    if (runsPaginationMetadata?.after) {
      setRunsBeforeCursor(undefined);
      setRunsAfterCursor(runsPaginationMetadata.after);
    }
  }, [runsPaginationMetadata?.after]);

  const handleInputStateChange = useCallback(
    (inputId: string, newState: InputState) => {
      setInputStates((prev) =>
        prev.map((s) => (s.id === inputId ? newState : s)),
      );
      setResult(null);

      // Notify parent of state change
      onInputStateChange?.(inputId, newState);

      // If this input has a configKey, sync the text value to config
      const inputDef = inputs.find((i) => i.id === inputId);
      if (inputDef?.configKey) {
        setLocalConfig((prev) => ({
          ...prev,
          [inputDef.configKey!]: newState.textValue,
        }));
      }
    },
    [inputs, onInputStateChange],
  );

  const handleConfigChange = useCallback(
    (newConfig: Record<string, unknown>) => {
      setLocalConfig(newConfig);
      onConfigChange?.(newConfig);
    },
    [onConfigChange],
  );

  const handleLoadFromRun = useCallback(
    async (run: WorkflowRun) => {
      if (!blockId || !workflow) {
        toast.error("Cannot load from run: missing block information");
        return;
      }

      // Find all inputs that support load from run
      const inputsWithLoadSupport = inputs.filter(
        (input) => input.supportsLoadFromRun,
      );

      if (inputsWithLoadSupport.length === 0) {
        toast.error("No inputs available to load");
        return;
      }

      setIsLoadingFromRun(true);
      try {
        // Track what we loaded for each input
        const loadedInputs: { id: string; success: boolean }[] = [];

        // Process each input that supports loading from run
        for (const inputDef of inputsWithLoadSupport) {
          const inputState = inputStates.find((s) => s.id === inputDef.id);
          if (!inputState) continue;

          // Find the edge that connects to this specific input's handle
          const handleId = inputDef.handleId || `input-${inputState.type}-0`;
          const edge = workflow.edges?.find(
            (e) => e.target === blockId && e.target_handle === handleId,
          );

          if (!edge) {
            loadedInputs.push({ id: inputDef.id, success: false });
            continue;
          }

          const sourceBlockId = edge.source;
          const sourceBlock = workflow.blocks?.find(
            (block) => block.id === sourceBlockId,
          );
          const isStartNode =
            sourceBlock?.type === "start_document" ||
            sourceBlock?.type === "start_json";

          try {
            if (inputState.type === "file") {
              // Load file content
              const docType = isStartNode ? "input" : "output";
              const docContent = await fetchRunDocumentContent(
                { runId: run.id, blockId: sourceBlockId, docType },
                fetchWithAuthContext,
              );

              setInputStates((prev) =>
                prev.map((s) => {
                  if (s.id !== inputDef.id) return s;
                  return {
                    ...s,
                    fileBuffer: docContent.content,
                    fileName: docContent.filename,
                    fileMimeType: docContent.mimeType,
                    uploadedFile: null,
                    textValue: "",
                  };
                }),
              );
              loadedInputs.push({ id: inputDef.id, success: true });
            } else if (inputState.type === "json") {
              // Load JSON content from the source step
              let textContent: string | null = null;

              if (isStartNode) {
                // For start-json blocks, check inputs.json_data on the run
                if (
                  sourceBlock?.type === "start_json" &&
                  run.inputs.json_data?.[sourceBlockId]
                ) {
                  textContent = JSON.stringify(
                    run.inputs.json_data[sourceBlockId],
                    null,
                    2,
                  );
                }
                // Fallback: check the start_document block config
                if (!textContent) {
                  const startConfig = sourceBlock?.config as
                    | Record<string, unknown>
                    | undefined;
                  if (startConfig) {
                    const possibleKeys = [
                      "instructions",
                      "text",
                      "content",
                      "value",
                    ];
                    for (const key of possibleKeys) {
                      if (typeof startConfig[key] === "string") {
                        textContent = startConfig[key] as string;
                        break;
                      }
                    }
                  }
                }
              } else {
                // For regular blocks, fetch full step execution data — the
                // per-run step list returns lightweight summaries without
                // `handle_outputs`.
                try {
                  const fullStep = await fetchStepExecution(
                    run.id,
                    sourceBlockId,
                    fetchWithAuthContext,
                  );
                  if (fullStep) {
                    // Check handle_outputs using the source handle
                    const sourceHandleId = edge.source_handle;
                    if (
                      sourceHandleId &&
                      fullStep.handle_outputs?.[sourceHandleId]
                    ) {
                      const handleOutput =
                        fullStep.handle_outputs[sourceHandleId];
                      if (handleOutput.type === "json" && handleOutput.data) {
                        textContent = JSON.stringify(
                          handleOutput.data,
                          null,
                          2,
                        );
                      }
                    }

                    // Fallback to step execution
                    const artifactData = getStepPrimaryHandleData(fullStep);
                    if (!textContent && artifactData) {
                      const output = artifactData;
                      const possibleKeys = [
                        "text",
                        "content",
                        "result",
                        "instructions",
                        "textContent",
                      ];
                      for (const key of possibleKeys) {
                        if (typeof output[key] === "string") {
                          textContent = output[key] as string;
                          break;
                        }
                      }
                    }
                  }
                } catch (stepError) {
                  console.error(
                    `Failed to fetch step execution for ${sourceBlockId}:`,
                    stepError,
                  );
                }
              }

              if (textContent) {
                setInputStates((prev) =>
                  prev.map((s) => {
                    if (s.id !== inputDef.id) return s;
                    return {
                      ...s,
                      textValue: textContent!,
                      fileBuffer: null,
                      fileName: null,
                      uploadedFile: null,
                    };
                  }),
                );

                // Also sync with config if there's a configKey
                if (inputDef.configKey) {
                  setLocalConfig((prev) => ({
                    ...prev,
                    [inputDef.configKey!]: textContent,
                  }));
                }

                loadedInputs.push({ id: inputDef.id, success: true });
              } else {
                loadedInputs.push({ id: inputDef.id, success: false });
              }
            }
          } catch (inputError) {
            console.error(`Failed to load ${inputDef.id}:`, inputError);
            loadedInputs.push({ id: inputDef.id, success: false });
          }
        }

        setResult(null);

        // Report results
        const successCount = loadedInputs.filter((i) => i.success).length;
        const totalCount = loadedInputs.length;
        if (successCount === totalCount) {
          toast.success(`Loaded data from run ${run.id.slice(-8)}`);
        } else if (successCount > 0) {
          toast.success(
            `Loaded ${successCount}/${totalCount} inputs from run ${run.id.slice(-8)}`,
          );
        } else {
          toast.error("Could not load any data from run");
        }
      } catch (error) {
        console.error("Failed to load from run:", error);
        toast.error("Failed to load from run");
      } finally {
        setIsLoadingFromRun(false);
      }
    },
    [blockId, workflow, fetchWithAuthContext, inputs, inputStates],
  );

  const handleRun = useCallback(async () => {
    setIsProcessing(true);
    setResult(null);

    try {
      const runResult = await onRun(inputStates, localConfig, {
        onProgress: (partialResult) => {
          setResult(partialResult);
        },
      });
      setResult(runResult);
    } catch (error) {
      console.error("Run error:", error);
      toast.error(
        `Run failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsProcessing(false);
    }
  }, [inputStates, localConfig, onRun]);

  const handleViewContent = useCallback(
    (inputId: string) => {
      // If external handler provided and returns true, skip default dialog
      if (onInputHandleClick) {
        const inputState = inputStates.find((s) => s.id === inputId);
        if (inputState && onInputHandleClick(inputId, inputState)) {
          return;
        }
      }
      setPreviewInputId(inputId);
      setShowPreviewDialog(true);
    },
    [onInputHandleClick, inputStates],
  );

  // Computed state
  const rawRequirements = getRequirements(inputStates, localConfig);

  // Augment requirements with click handlers
  const requirements = rawRequirements.map((req) => {
    // Try to match requirement to a file input definition
    // 1. Exact match on ID
    let matchedInput = inputs.find((inp) => inp.id === req.id);
    // 2. Index-based fallback for "input-N" pattern
    if (!matchedInput) {
      const indexMatch = req.id.match(/^input-(\d+)$/);
      if (indexMatch) {
        matchedInput = inputs[parseInt(indexMatch[1])];
      }
    }

    if (matchedInput && matchedInput.type === "file") {
      const inputId = matchedInput.id;
      return {
        ...req,
        onClick: () => uploadTriggerRefs.current[inputId]?.current?.(),
      };
    }

    // For non-file requirements, delegate to parent handler
    if (!matchedInput && onRequirementClick) {
      return { ...req, onClick: () => onRequirementClick(req.id) };
    }

    return req;
  });

  // A page-owned capability denial both hides the Run affordance and forces
  // `canRun` false, so header/external run controls relayed via
  // `onRunStateChange` are blocked alongside the floating panel button.
  const isRunBlockedByPermission = Boolean(runDisabledReason);
  const canRun =
    requirements.every((r) => r.isMet) &&
    !isProcessing &&
    !isRunBlockedByPermission;
  const hasOutput = result !== null;
  const [primitiveOutputViewMode, setPrimitiveOutputViewMode] =
    useState<PlaygroundOutputViewMode>("text");
  const primitiveViewerOperation = primitiveOperationFromBlockType(blockType);
  const primitiveViewerContextText = getPrimitiveViewerContextText(inputStates);
  const primitiveViewerDownloadActions = useMemo(
    () =>
      buildPrimitiveViewerDownloadActions({
        operation: primitiveViewerOperation,
        result,
        inputStates,
        config: localConfig,
      }),
    [primitiveViewerOperation, result, inputStates, localConfig],
  );
  const editPrimitiveViewerState =
    blockType === "edit"
      ? getEditPrimitiveViewerState(result, inputStates)
      : null;
  const resolvedPrimitiveOutputViewMode =
    editPrimitiveViewerState &&
    editPrimitiveViewerState.tabs.length > 0 &&
    !editPrimitiveViewerState.tabs.some(
      (tab) => tab.value === primitiveOutputViewMode,
    )
      ? editPrimitiveViewerState.fallbackViewMode
      : primitiveOutputViewMode;
  const primitiveViewerHeaderAccessory =
    blockType === "parse" && hasOutput ? (
      <AnimatedTabs
        tabs={[
          {
            label: "Text",
            value: "text",
            icon: <ScanText className="size-4" />,
          },
          {
            label: "Render",
            value: "rendered",
            icon: <ImageIcon className="size-4" />,
          },
          ...(getFirstFileInput(inputStates)?.fileBuffer
            ? [
                {
                  label: "File",
                  value: "file",
                  icon: <Paperclip className="size-4" />,
                },
              ]
            : []),
        ]}
        value={resolvedPrimitiveOutputViewMode}
        onChange={(value) =>
          setPrimitiveOutputViewMode(value as PlaygroundOutputViewMode)
        }
      />
    ) : blockType === "edit" &&
      editPrimitiveViewerState &&
      editPrimitiveViewerState.tabs.length > 0 ? (
      <AnimatedTabs
        tabs={editPrimitiveViewerState.tabs}
        value={resolvedPrimitiveOutputViewMode}
        onChange={(value) =>
          setPrimitiveOutputViewMode(value as PlaygroundOutputViewMode)
        }
      />
    ) : undefined;
  const primitiveOutputRenderOptions =
    blockType === "parse" || blockType === "edit"
      ? {
          viewMode: resolvedPrimitiveOutputViewMode,
          onViewModeChange: setPrimitiveOutputViewMode,
        }
      : undefined;
  const runStateRelayRef = useRef({
    canRun,
    isRunning: isProcessing,
    run: handleRun as () => void,
    onRunStateChange,
    version: 0,
  });
  if (
    runStateRelayRef.current.canRun !== canRun ||
    runStateRelayRef.current.isRunning !== isProcessing ||
    runStateRelayRef.current.run !== handleRun ||
    runStateRelayRef.current.onRunStateChange !== onRunStateChange
  ) {
    runStateRelayRef.current = {
      canRun,
      isRunning: isProcessing,
      run: handleRun,
      onRunStateChange,
      version: runStateRelayRef.current.version + 1,
    };
  }

  // Check if we should show load from run (any input supports it)
  const showLoadFromRun = Boolean(
    blockId && workflowId && inputs.some((input) => input.supportsLoadFromRun),
  );

  // Build connections for overlay - ensure refs exist
  const connections = inputs.map((input) => {
    if (!inputOutRefs.current[input.id]) {
      inputOutRefs.current[input.id] = createRef<HTMLDivElement>();
    }
    if (!processingInRefs.current[input.id]) {
      processingInRefs.current[input.id] = createRef<HTMLDivElement>();
    }
    const inputState = inputStates.find((s) => s.id === input.id);
    return {
      from: inputOutRefs.current[input.id],
      to: processingInRefs.current[input.id],
      active: hasInputValue(inputState),
    };
  });
  connections.push({
    from: processingOutRef,
    to: outputInRef,
    active: hasOutput,
  });

  // Get preview input state
  const previewState = previewInputId
    ? inputStates.find((s) => s.id === previewInputId)
    : null;

  const handlePreviewDownload = useCallback(() => {
    if (previewState?.type !== "file" || !previewState.fileBuffer) return;

    const blob = new Blob([previewState.fileBuffer], {
      type: previewState.fileMimeType || "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = previewState.fileName || "document";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Document downloaded");
  }, [previewState]);

  // Get run button labels based on block type or custom labels
  const runButtonLabel =
    customRunButtonLabel ||
    (blockType === "classifier"
      ? "Run Classify"
      : blockType === "parse"
        ? "Run Parse"
        : blockType === "split"
          ? "Run Split"
          : blockType === "extract"
            ? "Run Extract"
            : "Run Edit");
  const runningLabel =
    customRunningLabel ||
    (blockType === "classifier"
      ? "Classifying..."
      : blockType === "parse"
        ? "Parsing..."
        : blockType === "split"
          ? "Splitting..."
          : blockType === "extract"
            ? "Extracting..."
            : "Filling...");

  // Compute credits per page for display
  const creditsPerPage = (() => {
    if (blockType === "parse") return 1;
    const model = (localConfig.model as string) || "retab-small";
    const nConsensus = (localConfig.n_consensus as number) ?? 1;
    const baseCredits =
      model === "retab-large" ? 3 : model === "retab-micro" ? 0.2 : 1;
    const perPage =
      blockType === "edit"
        ? 3
        : blockType === "classifier"
          ? baseCredits / 4
          : baseCredits;
    return (blockType === "extract" || blockType === "split") && nConsensus > 1
      ? perPage * nConsensus
      : perPage;
  })();

  return (
    <div
      className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col", className)}
    >
      <PlaygroundInputShapeRunner
        key={inputShapeSyncKey}
        inputs={inputs}
        config={config}
        setInputStates={setInputStates}
      />
      {onRunStateChange ? (
        <PlaygroundRunStateChangeRunner
          key={runStateRelayRef.current.version}
          canRun={canRun}
          isRunning={isProcessing}
          run={handleRun}
          onRunStateChange={onRunStateChange}
        />
      ) : null}
      {/* Optional Header Slot */}
      {headerSlot}

      {/* Canvas */}
      <div className="relative flex min-h-0 min-w-0 flex-1">
        {/* Canvas background */}
        <div
          id={canvasId}
          className="relative flex flex-1 items-center justify-center overflow-hidden"
          style={{
            backgroundImage: `radial-gradient(circle, #EEEEEE 1.5px, transparent 1.5px)`,
            backgroundSize: "25px 25px",
            backgroundColor: "white",
          }}
        >
          {/* SVG Connection Overlay */}
          <ConnectionOverlay connections={connections} containerId={canvasId} />

          <div
            className={cn(
              "z-10 flex h-full w-full items-center justify-center gap-16 px-4 py-4",
              inputs.length > 1 ? "gap-12" : "gap-8",
            )}
          >
            {/* Input Nodes */}
            <div
              className={cn(
                "flex gap-8",
                inputs.length > 1 ? "flex-col justify-center" : "",
              )}
            >
              {inputs.map((inputDef) => {
                const inputState =
                  inputStates.find((s) => s.id === inputDef.id) ||
                  createInputState(inputDef, localConfig);
                // Ensure ref exists
                if (!inputOutRefs.current[inputDef.id]) {
                  inputOutRefs.current[inputDef.id] =
                    createRef<HTMLDivElement>();
                }
                // Ensure upload trigger ref exists
                if (!uploadTriggerRefs.current[inputDef.id]) {
                  uploadTriggerRefs.current[inputDef.id] = { current: null };
                }
                return (
                  <GenericInputNode
                    key={inputDef.id}
                    definition={inputDef}
                    state={inputState}
                    onStateChange={(newState) =>
                      handleInputStateChange(inputDef.id, newState)
                    }
                    onViewContent={() => handleViewContent(inputDef.id)}
                    handleRef={inputOutRefs.current[inputDef.id]}
                    dragFileType={dragFileType}
                    uploadTriggerRef={uploadTriggerRefs.current[inputDef.id]}
                  />
                );
              })}
            </div>

            {/* Processing Node */}
            <ProcessingNode
              icon={icon}
              title={title}
              description={description}
              color={color}
              creditsPerPage={creditsPerPage}
              cardClassName={
                blockType === "split" ||
                blockType === "edit" ||
                blockType === "extract" ||
                blockType === "parse" ||
                blockType === "classifier" ||
                blockType === "partition"
                  ? "max-w-[300px]"
                  : undefined
              }
              inputHandles={inputs.map((input) => {
                // Ensure ref exists
                if (!processingInRefs.current[input.id]) {
                  processingInRefs.current[input.id] =
                    createRef<HTMLDivElement>();
                }
                return processingInRefs.current[input.id];
              })}
              outputRef={processingOutRef}
            >
              {/* Render sections */}
              {sections.map((section, index) => {
                if (section.type === "model") {
                  return (
                    <div
                      key={index}
                      className="space-y-2 rounded-lg bg-gray-50 p-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bot className="h-3.5 w-3.5 text-teal-500" />
                          <span className="text-[10px] font-medium text-gray-600">
                            Model
                          </span>
                        </div>
                        <ModelDropdown
                          value={(localConfig.model as string) || "retab-small"}
                          onChange={(value) =>
                            handleConfigChange({ ...localConfig, model: value })
                          }
                          triggerClassName="bg-white text-xs h-7 px-2 justify-between"
                        />
                      </div>
                    </div>
                  );
                }

                if (section.type === "input-type" && section.inputId) {
                  const inputState = inputStates.find(
                    (s) => s.id === section.inputId,
                  );
                  if (!inputState) return null;
                  const inputDef = inputs.find((i) => i.id === section.inputId);
                  if (!inputDef?.allowTypeChange) return null;

                  return (
                    <div
                      key={index}
                      className="space-y-2 rounded-lg bg-gray-50 p-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-[10px] font-medium text-gray-600">
                            Input
                          </span>
                        </div>
                        <Select
                          value={inputState.type}
                          onValueChange={(value) => {
                            const newType = value as InputType;
                            setInputStates((prev) =>
                              prev.map((s) =>
                                s.id === section.inputId
                                  ? {
                                      ...s,
                                      type: newType,
                                      // Clear values when type changes
                                      fileBuffer: null,
                                      fileName: null,
                                      uploadedFile: null,
                                      textValue: "",
                                    }
                                  : s,
                              ),
                            );
                            // Also update config if needed
                            handleConfigChange({
                              ...localConfig,
                              input: {
                                name: getDefaultInputName(newType),
                                type: newType,
                              },
                            });
                          }}
                        >
                          <SelectTrigger className="!h-7 w-24 bg-white !text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="file">
                              <div className="flex items-center gap-1.5">
                                <Paperclip className="h-3 w-3 text-blue-600" />
                                File
                              </div>
                            </SelectItem>
                            <SelectItem value="json">
                              <div className="flex items-center gap-1.5">
                                <Braces className="h-3 w-3 text-violet-600" />
                                JSON
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                }

                if (section.type === "custom" && section.render) {
                  return (
                    <div key={index} onClick={(e) => e.stopPropagation()}>
                      {section.render(localConfig, handleConfigChange)}
                    </div>
                  );
                }

                return null;
              })}
            </ProcessingNode>

            {/* Output Node */}
            <div className="relative flex h-full min-w-0 flex-1 items-center">
              <div
                ref={outputInRef}
                className="pointer-events-none absolute top-1/2 left-0 h-0 w-0 -translate-x-1/2 -translate-y-1/2"
                aria-hidden
              />

              {/* Output content */}
              <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-all">
                <PrimitiveViewerShell
                  operation={primitiveViewerOperation}
                  contextText={primitiveViewerContextText}
                  actions={primitiveViewerDownloadActions}
                  accessory={primitiveViewerHeaderAccessory}
                >
                  {renderOutput(
                    result,
                    inputStates,
                    isProcessing,
                    primitiveOutputRenderOptions,
                  )}
                </PrimitiveViewerShell>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Requirements Panel */}
        {!hideFloatingPanel && (
          <FloatingRequirementsPanel
            requirements={requirements}
            canRun={canRun}
            isRunning={isProcessing}
            onRun={handleRun}
            runButtonLabel={runButtonLabel}
            runningLabel={runningLabel}
            runDisabledReason={runDisabledReason}
            showLoadFromRun={showLoadFromRun}
            onLoadFromRun={handleLoadFromRun}
            isLoadingFromRun={isLoadingFromRun}
            completedRuns={completedRuns}
            isLoadingRuns={isLoadingRuns}
            paginationMetadata={runsPaginationMetadata}
            onPrevPage={handleRunsPrevPage}
            onNextPage={handleRunsNextPage}
          />
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-h-[90vh] sm:max-w-4xl">
          <DialogHeader className="sr-only">
            <DialogTitle className="sr-only">Input Preview</DialogTitle>
            <DialogDescription className="sr-only">
              {previewState?.type === "file"
                ? previewState.fileName
                : `${previewState?.type} content`}
            </DialogDescription>
          </DialogHeader>
          <div className="p-4">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">
                    {previewState?.type === "file"
                      ? "Document Preview"
                      : "JSON Input"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {previewState?.type === "file"
                      ? previewState.fileName
                      : `${previewState?.type} content`}
                  </p>
                </div>
                {previewState?.type === "file" && previewState.fileBuffer && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePreviewDownload}
                    className="flex-shrink-0"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                )}
              </div>
              <div className="h-[600px] overflow-hidden rounded-lg">
                {previewState?.type === "file" ? (
                  previewState.fileBuffer && (
                    <FilePreview
                      content={previewState.fileBuffer}
                      mimeType={previewState.fileMimeType}
                    />
                  )
                ) : (
                  <pre
                    className={cn(
                      "h-full overflow-auto rounded-lg p-4 text-sm break-words whitespace-pre-wrap",
                      previewState?.type === "json"
                        ? "bg-violet-50 font-mono text-violet-800"
                        : "bg-cyan-50 text-cyan-800",
                    )}
                  >
                    {previewState?.textValue || "No input provided"}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Unified Execute Playground (Dialog wrapper around PlaygroundCanvas)
// ═══════════════════════════════════════════════════════════════════════════════

export function ExecutePlayground({
  open,
  onOpenChange,
  blockType,
  title,
  description,
  icon,
  color,
  inputs,
  sections,
  config,
  onConfigChange,
  getRequirements,
  onRun,
  renderOutput,
  runButtonLabel,
  runningLabel,
  onRequirementClick,
  blockId,
  workflowId,
  workflow,
  runDisabledReason,
}: ExecutePlaygroundProps) {
  const { fetchWithAuth: fetchWithAuthContext } = useAuth();
  const [localConfig, setLocalConfig] =
    useState<Record<string, unknown>>(config);
  const [isLoadingFromRun, setIsLoadingFromRun] = useState(false);
  const [runsBeforeCursor, setRunsBeforeCursor] = useState<
    string | undefined
  >();
  const [runsAfterCursor, setRunsAfterCursor] = useState<string | undefined>();

  // Store loaded run data to pass to canvas
  const [loadedInputStates, setLoadedInputStates] = useState<
    Partial<InputState>[] | undefined
  >();

  // Run state from PlaygroundCanvas
  const [runState, setRunState] = useState<{
    canRun: boolean;
    isRunning: boolean;
    run: () => void;
  }>({
    canRun: false,
    isRunning: false,
    run: () => {},
  });

  // Fetch previous runs
  const { data: runsData, isLoading: isLoadingRuns } = useWorkflowRunList(
    workflowId && open
      ? {
          workflow_id: workflowId,
          limit: 10,
          order: "desc",
          before: runsBeforeCursor,
          after: runsAfterCursor,
        }
      : {},
  );

  // All completed/errored runs. Per-block filtering would require fetching
  // the per-run step list separately; for the playground load flow, operators
  // can pick any completed run and the load step below handles missing data
  // gracefully.
  const completedRuns =
    runsData?.data?.filter(
      (run) =>
        run.lifecycle.status === "completed" ||
        run.lifecycle.status === "error",
    ) ?? [];
  const runsPaginationMetadata = runsData?.list_metadata;

  const dialogOpenResetKey = useMemo(
    () => (open ? JSON.stringify(config) : null),
    [config, open],
  );
  const loadedInputStatesResetKey = useMemo(
    () =>
      loadedInputStates && loadedInputStates.length > 0
        ? JSON.stringify(loadedInputStates)
        : "no-loaded-inputs",
    [loadedInputStates],
  );
  const playgroundCanvasKey = `${dialogOpenResetKey ?? "closed"}:${loadedInputStatesResetKey}`;

  const handleConfigChange = useCallback(
    (newConfig: Record<string, unknown>) => {
      setLocalConfig(newConfig);
      // Propagate config changes immediately through the workflow store pattern
      // This ensures changes are synced to the backend via the collaborative hooks
      onConfigChange?.(newConfig);
    },
    [onConfigChange],
  );

  const handleSaveAndClose = useCallback(() => {
    // Config changes are already propagated via handleConfigChange,
    // so we just close the dialog
    onOpenChange(false);
  }, [onOpenChange]);

  const handleRunsPrevPage = useCallback(() => {
    if (runsPaginationMetadata?.before) {
      setRunsAfterCursor(undefined);
      setRunsBeforeCursor(runsPaginationMetadata.before);
    }
  }, [runsPaginationMetadata?.before]);

  const handleRunsNextPage = useCallback(() => {
    if (runsPaginationMetadata?.after) {
      setRunsBeforeCursor(undefined);
      setRunsAfterCursor(runsPaginationMetadata.after);
    }
  }, [runsPaginationMetadata?.after]);

  const handleLoadFromRun = useCallback(
    async (run: WorkflowRun) => {
      console.log("[handleLoadFromRun] Starting load from run:", {
        runId: run.id,
        blockId,
        hasWorkflow: !!workflow,
        workflowEdges: workflow?.edges?.map((e) => ({
          source: e.source,
          target: e.target,
          source_handle: e.source_handle,
          target_handle: e.target_handle,
        })),
        workflowBlocks: workflow?.blocks?.map((block) => ({
          id: block.id,
          type: block.type,
        })),
        inputDefs: inputs.map((i) => ({
          id: i.id,
          type: i.type,
          handleId: i.handleId,
          supportsLoadFromRun: i.supportsLoadFromRun,
        })),
      });

      if (!blockId || !workflow) {
        console.error("[handleLoadFromRun] Missing blockId or workflow:", {
          blockId,
          hasWorkflow: !!workflow,
        });
        toast.error("Cannot load from run: missing block information");
        return;
      }

      // Find all inputs that support load from run
      const inputsWithLoadSupport = inputs.filter(
        (input) => input.supportsLoadFromRun,
      );

      console.log(
        "[handleLoadFromRun] Inputs with load support:",
        inputsWithLoadSupport.map((i) => ({
          id: i.id,
          type: i.type,
          handleId: i.handleId,
        })),
      );

      if (inputsWithLoadSupport.length === 0) {
        toast.error("No inputs available to load");
        return;
      }

      setIsLoadingFromRun(true);
      try {
        const newInputStates: Partial<InputState>[] = [];
        const loadResults: { id: string; success: boolean }[] = [];

        // Process each input that supports loading from run
        for (const inputDef of inputsWithLoadSupport) {
          // Find the edge that connects to this specific input's handle
          const handleId = inputDef.handleId || `input-${inputDef.type}-0`;
          const edge = workflow.edges?.find(
            (e) => e.target === blockId && e.target_handle === handleId,
          );

          console.log("[handleLoadFromRun] Edge search:", {
            inputId: inputDef.id,
            handleId,
            edgeFound: !!edge,
            allEdgesTargetingBlock: workflow.edges
              ?.filter((e) => e.target === blockId)
              .map((e) => ({
                source: e.source,
                target_handle: e.target_handle,
                source_handle: e.source_handle,
              })),
          });

          if (!edge) {
            newInputStates.push({ id: inputDef.id });
            loadResults.push({ id: inputDef.id, success: false });
            continue;
          }

          const sourceBlockId = edge.source;
          const sourceBlock = workflow.blocks?.find(
            (block) => block.id === sourceBlockId,
          );
          const isStartNode =
            sourceBlock?.type === "start_document" ||
            sourceBlock?.type === "start_json";

          console.log("[handleLoadFromRun] Resolved source:", {
            sourceBlockId,
            sourceNodeType: sourceBlock?.type,
            isStartNode,
            inputDefType: inputDef.type,
          });

          try {
            if (inputDef.type === "file") {
              // Load file content
              const docType = isStartNode ? "input" : "output";
              console.log("[handleLoadFromRun] Fetching document:", {
                runId: run.id,
                blockId: sourceBlockId,
                docType,
              });
              const docContent = await fetchRunDocumentContent(
                { runId: run.id, blockId: sourceBlockId, docType },
                fetchWithAuthContext,
              );

              newInputStates.push({
                id: inputDef.id,
                fileBuffer: docContent.content,
                fileName: docContent.filename,
                fileMimeType: docContent.mimeType,
                uploadedFile: null,
                textValue: "",
              });
              loadResults.push({ id: inputDef.id, success: true });
            } else if (inputDef.type === "json") {
              // Load JSON content from the source step
              let textContent: string | null = null;

              if (isStartNode) {
                // For start-json blocks, check inputs.json_data on the run
                if (
                  sourceBlock?.type === "start_json" &&
                  run.inputs.json_data?.[sourceBlockId]
                ) {
                  textContent = JSON.stringify(
                    run.inputs.json_data[sourceBlockId],
                    null,
                    2,
                  );
                }
                // Fallback: check the start_document block config
                if (!textContent) {
                  const startConfig = sourceBlock?.config as
                    | Record<string, unknown>
                    | undefined;
                  if (startConfig) {
                    const possibleKeys = [
                      "instructions",
                      "text",
                      "content",
                      "value",
                      "json_input",
                      "data",
                    ];
                    for (const key of possibleKeys) {
                      if (typeof startConfig[key] === "string") {
                        textContent = startConfig[key] as string;
                        break;
                      } else if (
                        typeof startConfig[key] === "object" &&
                        startConfig[key] !== null
                      ) {
                        textContent = JSON.stringify(startConfig[key], null, 2);
                        break;
                      }
                    }
                  }
                }
              } else {
                // For regular blocks, fetch full step execution data — the
                // per-run step list returns lightweight summaries without
                // `handle_outputs`.
                try {
                  const fullStep = await fetchStepExecution(
                    run.id,
                    sourceBlockId,
                    fetchWithAuthContext,
                  );
                  if (fullStep) {
                    // Check handle_outputs using the source handle
                    const sourceHandleId = edge.source_handle;
                    if (
                      sourceHandleId &&
                      fullStep.handle_outputs?.[sourceHandleId]
                    ) {
                      const handleOutput =
                        fullStep.handle_outputs[sourceHandleId];
                      if (handleOutput.type === "json" && handleOutput.data) {
                        textContent = JSON.stringify(
                          handleOutput.data,
                          null,
                          2,
                        );
                      }
                    }

                    // Fallback to step execution
                    const artifactData = getStepPrimaryHandleData(fullStep);
                    if (!textContent && artifactData) {
                      const output = artifactData;
                      const possibleKeys = [
                        "text",
                        "content",
                        "result",
                        "instructions",
                        "textContent",
                        "data",
                      ];
                      for (const key of possibleKeys) {
                        if (typeof output[key] === "string") {
                          textContent = output[key] as string;
                          break;
                        } else if (
                          typeof output[key] === "object" &&
                          output[key] !== null
                        ) {
                          textContent = JSON.stringify(output[key], null, 2);
                          break;
                        }
                      }
                    }
                  }
                } catch (stepError) {
                  console.error(
                    `Failed to fetch step execution for ${sourceBlockId}:`,
                    stepError,
                  );
                }
              }

              if (textContent) {
                newInputStates.push({
                  id: inputDef.id,
                  textValue: textContent,
                  fileBuffer: null,
                  fileName: null,
                  uploadedFile: null,
                });
                loadResults.push({ id: inputDef.id, success: true });
              } else {
                newInputStates.push({ id: inputDef.id });
                loadResults.push({ id: inputDef.id, success: false });
              }
            } else {
              newInputStates.push({ id: inputDef.id });
              loadResults.push({ id: inputDef.id, success: false });
            }
          } catch (err) {
            console.error(`Failed to load input ${inputDef.id}:`, err);
            newInputStates.push({ id: inputDef.id });
            loadResults.push({ id: inputDef.id, success: false });
          }
        }

        setLoadedInputStates(newInputStates);

        // Report results
        const successCount = loadResults.filter((r) => r.success).length;
        const totalCount = loadResults.length;
        if (successCount === totalCount) {
          toast.success(`Loaded data from run ${run.id.slice(-8)}`);
        } else if (successCount > 0) {
          toast.success(
            `Loaded ${successCount}/${totalCount} inputs from run ${run.id.slice(-8)}`,
          );
        } else {
          toast.error("Could not load any data from run");
        }
      } catch (error) {
        console.error("Error loading from run:", error);
        toast.error("Failed to load from run");
      } finally {
        setIsLoadingFromRun(false);
      }
    },
    [blockId, workflow, inputs, fetchWithAuthContext],
  );

  const Icon = icon;
  const canLoadFromRuns = Boolean(
    blockId && workflowId && inputs.some((input) => input.supportsLoadFromRun),
  );

  // Get the actual block label from the workflow if available.
  const blockLabel =
    blockId && workflow
      ? workflow.blocks?.find((n) => n.id === blockId)?.label || title
      : title;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {dialogOpenResetKey ? (
        <ExecuteDialogConfigResetRunner
          key={dialogOpenResetKey}
          open={open}
          config={config}
          setLocalConfig={setLocalConfig}
          setLoadedInputStates={setLoadedInputStates}
        />
      ) : null}
      <DialogContent
        className="flex h-[100vh] max-h-[100vh] w-[100vw] flex-col overflow-hidden rounded-lg border border-gray-200 p-0 sm:max-w-[100vw]"
        onClick={(e) => e.stopPropagation()}
        onPointerDownOutside={(e) => e.stopPropagation()}
      >
        <DialogTitle className="sr-only">
          {blockLabel} Execute Playground
        </DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          {/* Left: Node info */}
          <div className="flex items-center gap-2.5">
            <Icon className="h-5 w-5" style={{ color }} />
            <h2 className="text-lg font-medium text-gray-900">{blockLabel}</h2>

            {/* Center: Load from previous runs */}
            <div className="flex items-center gap-3">
              {canLoadFromRuns && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-sm text-gray-600 hover:text-gray-800"
                      disabled={isLoadingFromRun}
                    >
                      {isLoadingFromRun ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <History className="mr-2 h-4 w-4" />
                      )}
                      Load from previous run
                      <ChevronDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-72">
                    <DropdownMenuLabel className="text-xs text-gray-500">
                      Select a completed run
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {isLoadingRuns ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    ) : completedRuns.length === 0 ? (
                      <div className="py-4 text-center text-xs text-gray-500">
                        No completed runs yet
                      </div>
                    ) : (
                      <>
                        {completedRuns.map((run) => (
                          <DropdownMenuItem
                            key={run.id}
                            onClick={() => handleLoadFromRun(run)}
                            className="flex cursor-pointer items-center gap-2"
                          >
                            <div
                              className={cn(
                                "h-2 w-2 rounded-full",
                                run.lifecycle.status === "completed"
                                  ? "bg-green-500"
                                  : "bg-red-500",
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-medium">
                                {run.id.slice(0, 8)}...
                              </div>
                              <div className="text-[10px] text-gray-500">
                                {formatDistanceToNow(
                                  new Date(run.timing.created_at),
                                  {
                                    addSuffix: true,
                                  },
                                )}
                              </div>
                            </div>
                          </DropdownMenuItem>
                        ))}
                        {/* Pagination */}
                        {(runsPaginationMetadata?.before ||
                          runsPaginationMetadata?.after) && (
                          <>
                            <DropdownMenuSeparator />
                            <div className="flex items-center justify-between px-2 py-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px]"
                                disabled={!runsPaginationMetadata?.before}
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleRunsPrevPage();
                                }}
                              >
                                <ChevronLeft className="mr-1 h-3 w-3" />
                                Prev
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px]"
                                disabled={!runsPaginationMetadata?.after}
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleRunsNextPage();
                                }}
                              >
                                Next
                                <ChevronRight className="ml-1 h-3 w-3" />
                              </Button>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Run button */}
              <ClerkButton
                onClick={runState.run}
                disabled={!runState.canRun}
                size="sm"
              >
                {runState.isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {runningLabel || "Running..."}
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    {runButtonLabel || `Run ${title}`}
                  </>
                )}
              </ClerkButton>
            </div>
          </div>

          {/* Right: Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-9 w-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-0">
          <PlaygroundCanvas
            key={playgroundCanvasKey}
            blockType={blockType}
            title={title}
            description={description}
            icon={icon}
            color={color}
            inputs={inputs}
            sections={sections}
            config={localConfig}
            onConfigChange={handleConfigChange}
            getRequirements={getRequirements}
            onRun={onRun}
            renderOutput={renderOutput}
            runButtonLabel={runButtonLabel}
            runningLabel={runningLabel}
            blockId={blockId}
            workflowId={workflowId}
            workflow={workflow}
            canvasId="execute-workflow-canvas"
            initialInputStates={loadedInputStates}
            onRunStateChange={setRunState}
            hideFloatingPanel={true}
            onRequirementClick={onRequirementClick}
            runDisabledReason={runDisabledReason}
          />
        </div>

        <DialogFooter className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <ClerkButton onClick={handleSaveAndClose}>Close</ClerkButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Export helper to create input definitions
// ═══════════════════════════════════════════════════════════════════════════════

export function createFileInput(
  id: string,
  label: string,
  options?: Partial<InputDefinition>,
): InputDefinition {
  return {
    id,
    name: id,
    type: "file",
    label,
    icon: Paperclip,
    color: "#22c55e",
    fileAccept: ".pdf,.png,.jpg,.jpeg,.webp,.gif,.tiff,.bmp",
    supportsLoadFromRun: true,
    ...options,
  };
}

export function createJsonInput(
  id: string,
  label: string,
  options?: Partial<InputDefinition>,
): InputDefinition {
  return {
    id,
    name: id,
    type: "json",
    label,
    icon: Braces,
    color: "#8b5cf6",
    placeholder: '{"key": "value"}',
    supportsLoadFromRun: false,
    ...options,
  };
}

export {
  hasInputValue,
  getDefaultInputName,
  FloatingRequirementsPanel,
  GenericInputNode,
  ProcessingNode,
  ConnectionOverlay,
};
