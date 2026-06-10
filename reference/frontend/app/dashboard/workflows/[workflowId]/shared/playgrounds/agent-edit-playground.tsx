"use client";

import dynamic from "next/dynamic";
import { useMemo, ReactNode } from "react";
import { toast } from "sonner";
import { SquarePen, Pencil, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { fetchWithAuth } from "@/backend/client-auth-utils";
import type { Workflow } from "@/app/dashboard/shared/workflows/types/workflows";
import { FormField } from "@/app/dashboard/widgets/types/edit";
import type {
  EditResult as EditResponse,
  InferFormSchemaResponse,
} from "@/types";

import {
  ExecutePlayground,
  PlaygroundCanvas,
  InputState,
  RequirementItem,
  ProcessingNodeSection,
  createFileInput,
  createJsonInput,
  hasInputValue,
  type PlaygroundOutputRenderOptions,
} from "./execute-playground";
import { AGENT_EDIT_SUPPORTED_FILE_ACCEPT } from "./file-accepts";
import { inputStateToUrlBackedMIMEData } from "./upload-input-state";

const FilePreview = dynamic(
  () =>
    import("@/app/dashboard/widgets/components/file-component/file-preview"),
  { loading: () => null },
);

const TemplateEditor = dynamic(
  () =>
    import("@/app/dashboard/playground/edit/components/template-editor").then(
      (componentModule) => componentModule.TemplateEditor,
    ),
  { loading: () => null },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Types (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AgentEditConfig {
  model: string;
}

export interface AgentEditResultState {
  response: EditResponse | null;
  filledBuffer: ArrayBuffer | null;
  originalBuffer?: ArrayBuffer | null;
  detectedFields: FormField[];
  isPdfFile: boolean;
  originalMimeType: string;
  isDetecting?: boolean;
}

interface AgentEditBlockExecutionPlaygroundProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: AgentEditConfig;
  onConfigChange?: (config: Record<string, unknown>) => void;
  blockId?: string;
  workflowId?: string;
  workflow?: Workflow;
  // When set, the user lacks `workflow:run` (page-owned capability gate). The
  // Run button stays visible but disabled; the dialog itself remains openable.
  runDisabledReason?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIME type helpers (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

export const DOCX_MIME_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const PPTX_MIME_TYPES = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export const XLSX_MIME_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const isDocxFile = (mimeType: string, fileName: string): boolean => {
  const name = fileName.toLowerCase();
  return (
    DOCX_MIME_TYPES.includes(mimeType) ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  );
};

export const isPptxFile = (mimeType: string, fileName: string): boolean => {
  const name = fileName.toLowerCase();
  return (
    PPTX_MIME_TYPES.includes(mimeType) ||
    name.endsWith(".pptx") ||
    name.endsWith(".ppt")
  );
};

export const isXlsxFile = (mimeType: string, fileName: string): boolean => {
  const name = fileName.toLowerCase();
  return (
    XLSX_MIME_TYPES.includes(mimeType) ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  );
};

export const isOfficeFile = (mimeType: string, fileName: string): boolean => {
  return (
    isDocxFile(mimeType, fileName) ||
    isPptxFile(mimeType, fileName) ||
    isXlsxFile(mimeType, fileName)
  );
};

export const isPdfFile = (mimeType: string, fileName: string): boolean => {
  return (
    mimeType.includes("application/pdf") ||
    fileName.toLowerCase().endsWith(".pdf")
  );
};

export const getOfficeMimeType = (fileName: string): string => {
  const name = fileName.toLowerCase();
  if (name.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".pptx"))
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (name.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (name.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (name.endsWith(".xls")) return "application/vnd.ms-excel";
  return "application/octet-stream";
};

// ═══════════════════════════════════════════════════════════════════════════════
// Output Renderer Component (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

export function AgentEditOutputRenderer(
  result: unknown,
  inputStates: InputState[],
  isProcessing: boolean,
  options?: PlaygroundOutputRenderOptions,
) {
  const editResult = result as AgentEditResultState | null;
  const hasOutput = editResult?.filledBuffer != null;
  const documentInput = inputStates.find((s) => s.id === "document");
  const isDetecting = editResult?.isDetecting || false;
  const detectedFields = editResult?.detectedFields || [];
  const isPdf = editResult?.isPdfFile || false;
  const originalBuffer =
    editResult?.originalBuffer || documentInput?.fileBuffer || null;
  const originalMimeType =
    documentInput?.fileMimeType ||
    editResult?.originalMimeType ||
    "application/octet-stream";
  const hasOriginal = originalBuffer !== null;
  const hasTemplateView = isPdf && detectedFields.length > 0 && hasOriginal;
  const initialViewMode =
    isDetecting && isPdf
      ? "template"
      : hasOutput
        ? "filled"
        : hasTemplateView
          ? "template"
          : hasOriginal
            ? "original"
            : "filled";
  const outputViewKey = `${isDetecting && isPdf ? "detecting" : "ready"}\u0000${initialViewMode}`;

  return (
    <AgentEditOutputRendererContent
      key={outputViewKey}
      editResult={editResult}
      isProcessing={isProcessing}
      isDetecting={isDetecting}
      hasTemplateView={hasTemplateView}
      originalBuffer={originalBuffer}
      originalMimeType={originalMimeType}
      detectedFields={detectedFields}
      initialViewMode={initialViewMode}
      options={options}
    />
  );
}

function AgentEditOutputRendererContent({
  editResult,
  isProcessing,
  isDetecting,
  hasTemplateView,
  originalBuffer,
  originalMimeType,
  detectedFields,
  initialViewMode,
  options,
}: {
  editResult: AgentEditResultState | null;
  isProcessing: boolean;
  isDetecting: boolean;
  hasTemplateView: boolean;
  originalBuffer: ArrayBuffer | null;
  originalMimeType: string;
  detectedFields: FormField[];
  initialViewMode: "template" | "original" | "filled";
  options?: PlaygroundOutputRenderOptions;
}) {
  const requestedViewMode = options?.viewMode;
  const viewMode: "template" | "original" | "filled" =
    requestedViewMode === "template" ||
    requestedViewMode === "original" ||
    requestedViewMode === "filled"
      ? requestedViewMode
      : initialViewMode;

  return (
    <>
      {/* Content */}
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {/* Loading overlay */}
        {isDetecting && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              <span className="text-sm text-gray-500">
                Detecting form fields...
              </span>
            </div>
          </div>
        )}
        {isProcessing && !isDetecting && viewMode === "filled" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              <span className="text-sm text-gray-500">Filling document...</span>
            </div>
          </div>
        )}

        {hasTemplateView &&
        viewMode === "template" &&
        detectedFields.length > 0 &&
        originalBuffer ? (
          <div className="flex-1 overflow-hidden">
            <TemplateEditor
              fields={detectedFields}
              onChange={() => {}}
              pdfBuffer={originalBuffer}
              readonly={true}
              isDrawingMode={false}
              onDrawingComplete={() => {}}
              hoveredFieldIndex={null}
              selectedFieldIndex={null}
              onSelectedFieldChange={() => {}}
            />
          </div>
        ) : viewMode === "original" && originalBuffer ? (
          <div className="flex-1 overflow-hidden">
            <FilePreview content={originalBuffer} mimeType={originalMimeType} />
          </div>
        ) : editResult?.filledBuffer && viewMode === "filled" ? (
          <div className="flex-1 overflow-hidden">
            <FilePreview
              content={editResult.filledBuffer}
              mimeType={
                editResult.response?.filled_document?.url?.match(
                  /^data:([^;]+);/,
                )?.[1] || editResult.originalMimeType
              }
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gray-50 px-8 text-gray-400">
            <Pencil className="h-16 w-16 text-gray-200" />
            <p className="text-center text-base text-gray-500">
              Run edit to see output
            </p>
            <p className="max-w-sm text-center text-sm text-gray-400">
              Upload a document, add filling instructions, and click Run Edit
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared Agent Edit Playground Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface AgentEditPlaygroundOptions {
  supportsLoadFromRun?: boolean;
}

export function createAgentEditInputs(
  options: AgentEditPlaygroundOptions = {},
) {
  return [
    createFileInput("document", "Document", {
      fileAccept: AGENT_EDIT_SUPPORTED_FILE_ACCEPT,
      supportsLoadFromRun: options.supportsLoadFromRun ?? true,
      handleId: "input-file-0",
    }),
    createJsonInput("instructions", "Instructions", {
      placeholder: '{"instructions":"Enter instructions to fill the document"}',
      supportsLoadFromRun: options.supportsLoadFromRun ?? true,
      configKey: "instructions",
      handleId: "input-json-0",
    }),
  ];
}

export function createAgentEditSections(): ProcessingNodeSection[] {
  return [{ type: "model" }];
}

export function getAgentEditRequirements(
  inputStates: InputState[],
  cfg: Record<string, unknown>,
): RequirementItem[] {
  const documentState = inputStates.find((s) => s.id === "document")!;
  const instructionsState = inputStates.find((s) => s.id === "instructions")!;
  const hasDocument = hasInputValue(documentState);

  // Check instructions from either input state or config
  const instructionsText =
    instructionsState?.textValue || (cfg.instructions as string) || "";
  const hasInstructions = instructionsText.trim().length > 0;

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
      id: "instructions",
      label: "Instructions",
      isMet: hasInstructions,
      description: hasInstructions ? "Defined" : "Define instructions",
    },
  ];
}

export function createAgentEditRunHandler(
  onDetectionStart?: () => void,
  onDetectionEnd?: (fields: FormField[]) => void,
) {
  return async (
    inputStates: InputState[],
    cfg: Record<string, unknown>,
  ): Promise<AgentEditResultState> => {
    const documentState = inputStates.find((s) => s.id === "document")!;
    const instructionsState = inputStates.find((s) => s.id === "instructions")!;

    if (!hasInputValue(documentState) || !documentState.fileBuffer) {
      throw new Error("Please upload a document first");
    }

    // Get instructions from input state or config
    const instructions =
      instructionsState?.textValue || (cfg.instructions as string) || "";
    if (!instructions.trim()) {
      throw new Error("Please add filling instructions");
    }

    const fileName = documentState.fileName || "document";
    const fileMimeType = documentState.fileMimeType;

    // Check file type
    const isPdf = isPdfFile(fileMimeType, fileName);
    const isOffice = isOfficeFile(fileMimeType, fileName);

    if (!isPdf && !isOffice) {
      throw new Error(
        "Please upload a PDF or Office document (DOC, DOCX, XLS, XLSX, PPT, PPTX)",
      );
    }

    const mimeType = isPdf ? "application/pdf" : getOfficeMimeType(fileName);
    const documentPayload = await inputStateToUrlBackedMIMEData(documentState);

    let detectedFields: FormField[] = [];

    // For PDFs, run fast detection first
    if (isPdf) {
      onDetectionStart?.();

      try {
        const fastResponse = await fetchWithAuth(
          `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/v1/edits/templates/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              document: documentPayload,
              confidence: 0.135,
            }),
          },
          {
            timeout: 60000,
            retryConfig: { maxRetries: 4, baseDelay: 1000, maxDelay: 15000 },
          },
        );

        if (fastResponse.ok) {
          const fastResult: InferFormSchemaResponse = await fastResponse.json();
          detectedFields = fastResult.form_schema.form_fields;
          onDetectionEnd?.(detectedFields);
          toast.success(
            `Detected ${detectedFields.length} form fields. Filling document...`,
          );
        }
      } catch (error) {
        console.error("Fast detection error:", error);
        onDetectionEnd?.([]);
      }
    }

    // Now run the actual edit
    const response = await fetchWithAuth(
      `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/v1/edits`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: documentPayload,
          model: (cfg.model as string) || "retab-small",
          instructions: instructions,
        }),
      },
      {
        timeout: 300000,
        retryConfig: { maxRetries: 4, baseDelay: 2000, maxDelay: 20000 },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edit failed: ${errorText || response.statusText}`);
    }

    const rawResponse = await response.json();
    // New `/v1/edits` returns `Edit { data: { form_data, filled_document }, ... }`.
    // Older edit responses returned the flat `EditResponse { form_data, filled_document }`.
    const editResponse: EditResponse = rawResponse?.data
      ? (rawResponse.data as EditResponse)
      : (rawResponse as EditResponse);

    // Extract filled document buffer
    let filledBuffer: ArrayBuffer | null = null;
    if (editResponse.filled_document?.url) {
      try {
        const base64Part = editResponse.filled_document.url.split(",")[1];
        if (base64Part) {
          const binaryString = atob(base64Part);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          filledBuffer = bytes.buffer;
        }
      } catch (e) {
        console.error("Failed to decode filled document:", e);
      }
    }

    toast.success("Document filled successfully");

    return {
      response: editResponse,
      filledBuffer,
      originalBuffer: documentState.fileBuffer,
      detectedFields,
      isPdfFile: isPdf,
      originalMimeType: mimeType,
      isDetecting: false,
    };
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Agent Edit Playground Canvas (standalone, no dialog)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AgentEditPlaygroundCanvasProps {
  config: AgentEditConfig;
  onConfigChange?: (config: Record<string, unknown>) => void;
  className?: string;
  canvasId?: string;
  headerSlot?: ReactNode;
  initialInputStates?: Partial<InputState>[];
  initialResult?: AgentEditResultState;
  // Workflow context (optional)
  blockId?: string;
  workflowId?: string;
  workflow?: Workflow;
  // Options
  supportsLoadFromRun?: boolean;
  // Custom sections (allows injecting custom model section)
  customSections?: ProcessingNodeSection[];
  // Custom run handler
  onRun?: (
    inputStates: InputState[],
    cfg: Record<string, unknown>,
  ) => Promise<AgentEditResultState>;
  // Custom output renderer
  renderOutput?: (
    result: unknown,
    inputStates: InputState[],
    isProcessing: boolean,
    options?: PlaygroundOutputRenderOptions,
  ) => ReactNode;
  // Detection state callbacks
  onDetectionStart?: () => void;
  onDetectionEnd?: (fields: FormField[]) => void;
  // When set, hides the Run affordance (page-owned capability gate).
  runDisabledReason?: string | null;
}

export function AgentEditPlaygroundCanvas({
  config,
  onConfigChange,
  className,
  canvasId = "agent-edit-playground-canvas",
  headerSlot,
  initialInputStates,
  initialResult,
  blockId,
  workflowId,
  workflow,
  supportsLoadFromRun = false,
  customSections,
  onRun: externalOnRun,
  renderOutput: externalRenderOutput,
  onDetectionStart,
  onDetectionEnd,
  runDisabledReason,
}: AgentEditPlaygroundCanvasProps) {
  const options: AgentEditPlaygroundOptions = { supportsLoadFromRun };
  const inputs = createAgentEditInputs(options);
  const sections = customSections || createAgentEditSections();

  const defaultRunHandler = useMemo(
    () => createAgentEditRunHandler(onDetectionStart, onDetectionEnd),
    [onDetectionStart, onDetectionEnd],
  );

  const handleRun = externalOnRun || defaultRunHandler;
  const renderOutput = externalRenderOutput || AgentEditOutputRenderer;

  return (
    <PlaygroundCanvas
      blockType="edit"
      title="Edit"
      description="Edit documents with AI"
      icon={SquarePen}
      color="#10b981"
      inputs={inputs}
      sections={sections}
      config={config as unknown as Record<string, unknown>}
      onConfigChange={onConfigChange}
      getRequirements={getAgentEditRequirements}
      onRun={handleRun}
      renderOutput={renderOutput}
      runButtonLabel="Run Edit"
      runningLabel="Filling..."
      className={className}
      canvasId={canvasId}
      headerSlot={headerSlot}
      initialInputStates={initialInputStates}
      initialResult={initialResult}
      blockId={blockId}
      workflowId={workflowId}
      workflow={workflow}
      runDisabledReason={runDisabledReason}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Agent Edit Execute Playground (dialog version for workflow blocks)
// ═══════════════════════════════════════════════════════════════════════════════

export function AgentEditBlockExecutionPlaygroundV2({
  open,
  onOpenChange,
  config,
  onConfigChange,
  blockId,
  workflowId,
  workflow,
  runDisabledReason,
}: AgentEditBlockExecutionPlaygroundProps) {
  const inputs = createAgentEditInputs({ supportsLoadFromRun: true });
  const sections = createAgentEditSections();
  const handleRun = useMemo(() => createAgentEditRunHandler(), []);

  return (
    <ExecutePlayground
      open={open}
      onOpenChange={onOpenChange}
      blockType="edit"
      title="Edit"
      description="Fill forms using an AI agent"
      icon={SquarePen}
      color="#10b981"
      inputs={inputs}
      sections={sections}
      config={config as unknown as Record<string, unknown>}
      onConfigChange={onConfigChange}
      getRequirements={getAgentEditRequirements}
      onRun={handleRun}
      renderOutput={AgentEditOutputRenderer}
      blockId={blockId}
      workflowId={workflowId}
      workflow={workflow}
      runDisabledReason={runDisabledReason}
    />
  );
}
