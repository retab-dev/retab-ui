"use client";

import { useState, useCallback, useMemo, useRef, ReactNode } from "react";
import { toast } from "sonner";
import { LayoutTemplate, Loader2, Eye } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import FilePreview from "@/app/dashboard/widgets/components/file-component/file-preview";
import { fetchWithAuth } from "@/backend/client-auth-utils";
import type { Workflow } from "@/app/dashboard/shared/workflows/types/workflows";
import {
  useEditTemplateList,
  useEditTemplate,
} from "@/app/dashboard/widgets/queries/edit-templates";
import { FormField } from "@/app/dashboard/widgets/types/edit";
import type {
  EditTemplate,
  EditResult as EditResponse,
} from "@/types";
import { TemplateEditor } from "@/app/dashboard/playground/edit/components/lazy-template-editor";
import { useAuth } from "@/app/shared/contexts/auth";
import PdfViewerNoToolbar from "@/app/dashboard/shared/single-page-pdf-viewer";
import { useMountEffect } from "@/hooks/useMountEffect";

import {
  ExecutePlayground,
  PlaygroundCanvas,
  InputState,
  RequirementItem,
  ProcessingNodeSection,
  createJsonInput,
  type PlaygroundOutputRenderOptions,
} from "./execute-playground";

// ═══════════════════════════════════════════════════════════════════════════════
// Types (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

export interface TemplateEditConfig {
  template_id?: string;
  model?: string;
  instructions?: string;
}

export interface TemplateEditResultState {
  response: EditResponse | null;
  filledBuffer: ArrayBuffer | null;
  templateFields: FormField[];
  templatePdfBuffer?: ArrayBuffer | null;
  templateId?: string;
  templateName?: string;
}

export interface TemplateEditTemplatePreviewState {
  templateId: string;
  templateName?: string;
  templatePdfBuffer: ArrayBuffer;
  templateFields: FormField[];
}

interface TemplateEditBlockExecutionPlaygroundProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: TemplateEditConfig;
  onConfigChange?: (config: Record<string, unknown>) => void;
  blockId?: string;
  workflowId?: string;
  workflow?: Workflow;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Template Section Component (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

interface TemplateSectionProps {
  templateId: string | undefined;
  onTemplateChange: (templateId: string) => void;
  onTemplatePreviewChange?: (
    preview: TemplateEditTemplatePreviewState | null,
  ) => void;
}

function TemplateSelectPreviewResetRunner({
  setPdfBuffer,
  setPdfBlobUrl,
  setIsLoadingPdf,
  onTemplatePreviewChange,
}: {
  setPdfBuffer: (buffer: ArrayBuffer | null) => void;
  setPdfBlobUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setIsLoadingPdf: (isLoading: boolean) => void;
  onTemplatePreviewChange?: (
    preview: TemplateEditTemplatePreviewState | null,
  ) => void;
}) {
  useMountEffect(() => {
    onTemplatePreviewChange?.(null);
    setPdfBuffer(null);
    setIsLoadingPdf(false);
    setPdfBlobUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      return null;
    });
  });

  return null;
}

function dataUrlToTemplateBuffer(dataUrl: string | undefined) {
  const base64Part = dataUrl?.split(",")[1];
  if (!base64Part) {
    return null;
  }

  const binaryString = atob(base64Part);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function fetchTemplateEmptyFormBuffer(
  fetchWithAuth: ReturnType<typeof useAuth>["fetchWithAuth"],
  templateId: string,
) {
  const response = await fetchWithAuth(
    `/v1/edits/templates/${templateId}/empty-form`,
  );
  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return dataUrlToTemplateBuffer(data.url);
}

function TemplateSelectPreviewLoaderRunner({
  fileId,
  templateId,
  templateName,
  templateFields,
  fetchWithAuth,
  setPdfBuffer,
  setPdfBlobUrl,
  setIsLoadingPdf,
  onTemplatePreviewChange,
}: {
  fileId: string;
  templateId: string;
  templateName?: string;
  templateFields: FormField[];
  fetchWithAuth: ReturnType<typeof useAuth>["fetchWithAuth"];
  setPdfBuffer: (buffer: ArrayBuffer | null) => void;
  setPdfBlobUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setIsLoadingPdf: (isLoading: boolean) => void;
  onTemplatePreviewChange?: (
    preview: TemplateEditTemplatePreviewState | null,
  ) => void;
}) {
  useMountEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    onTemplatePreviewChange?.(null);
    setIsLoadingPdf(true);
    setPdfBuffer(null);
    setPdfBlobUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      return null;
    });

    void (async () => {
      try {
        const linkResponse = await fetchWithAuth(
          `/v1/files/${fileId}/download-link`,
        );
        if (!linkResponse.ok) {
          console.error("Failed to get download link for template file");
          return;
        }
        const { download_url } = await linkResponse.json();

        const fileResponse = await fetch(download_url);
        if (!fileResponse.ok) {
          console.error("Failed to download template file");
          return;
        }

        const buffer = await fileResponse.arrayBuffer();
        if (cancelled) {
          return;
        }

        const emptyTemplateBuffer = await fetchTemplateEmptyFormBuffer(
          fetchWithAuth,
          templateId,
        );
        if (cancelled) {
          return;
        }

        setPdfBuffer(buffer);
        onTemplatePreviewChange?.({
          templateId,
          templateName,
          templatePdfBuffer: emptyTemplateBuffer || buffer,
          templateFields,
        });

        const blob = new Blob([buffer], { type: "application/pdf" });
        createdUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(createdUrl);
      } catch (err) {
        if (!cancelled) {
          console.error("Error fetching template PDF:", err);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPdf(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  });

  return null;
}

export function TemplateSelectSection({
  templateId,
  onTemplateChange,
  onTemplatePreviewChange,
}: TemplateSectionProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  const { fetchWithAuth } = useAuth();

  // Fetch templates list
  const { data: templatesResponse, isLoading: templatesLoading } =
    useEditTemplateList({ limit: 100 });
  const templates = templatesResponse?.data || [];

  // Find selected template from list (for basic info)
  const selectedTemplateFromList = templates.find(
    (t: EditTemplate) => t.id === templateId,
  );

  // Fetch full template details when selected
  const { data: selectedTemplate } = useEditTemplate(templateId);
  const previewFileId = selectedTemplate?.file?.id ?? null;
  const selectedTemplateFields =
    (selectedTemplate?.form_fields as FormField[] | undefined) ?? [];

  const hasTemplate = !!templateId;

  return (
    <>
      {previewFileId && selectedTemplate ? (
        <TemplateSelectPreviewLoaderRunner
          key={previewFileId}
          fileId={previewFileId}
          templateId={selectedTemplate.id}
          templateName={selectedTemplate.name}
          templateFields={selectedTemplateFields}
          fetchWithAuth={fetchWithAuth}
          setPdfBuffer={setPdfBuffer}
          setPdfBlobUrl={setPdfBlobUrl}
          setIsLoadingPdf={setIsLoadingPdf}
          onTemplatePreviewChange={onTemplatePreviewChange}
        />
      ) : (
        <TemplateSelectPreviewResetRunner
          key={`reset:${templateId ?? "none"}`}
          setPdfBuffer={setPdfBuffer}
          setPdfBlobUrl={setPdfBlobUrl}
          setIsLoadingPdf={setIsLoadingPdf}
          onTemplatePreviewChange={onTemplatePreviewChange}
        />
      )}
      <div
        className={`rounded-lg p-3 transition-colors ${
          !hasTemplate
            ? "border-2 border-dashed border-amber-300 bg-amber-50"
            : "border border-gray-200 bg-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <h4
              className={`text-xs font-medium ${!hasTemplate ? "text-amber-800" : "text-gray-900"}`}
            >
              Template
            </h4>
            <p
              className={`text-[10px] ${!hasTemplate ? "font-medium text-amber-600" : "text-gray-500"}`}
            >
              Select a template
            </p>
          </div>
        </div>

        <Select
          value={templateId || ""}
          onValueChange={(nextTemplateId) => {
            onTemplatePreviewChange?.(null);
            onTemplateChange(nextTemplateId);
          }}
          disabled={templatesLoading}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue
              placeholder={
                templatesLoading ? "Loading templates..." : "Select a template"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {templates.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-gray-500">
                No templates available
              </div>
            ) : (
              templates.map((template: EditTemplate) => (
                <SelectItem
                  key={template.id}
                  value={template.id}
                  className="text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span>{template.name}</span>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {/* Selected Template Preview & Info */}
        {(selectedTemplateFromList || selectedTemplate) && (
          <div className="mt-3 space-y-2">
            {/* Thumbnail Preview */}
            <div
              className="group relative h-32 w-full cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-gray-50 transition-colors hover:border-sky-300"
              onClick={(e) => {
                e.stopPropagation();
                setIsPreviewOpen(true);
              }}
            >
              {isLoadingPdf ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : pdfBlobUrl ? (
                <>
                  <div className="h-full w-full">
                    <PdfViewerNoToolbar url={pdfBlobUrl} />
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <Eye className="h-4 w-4" />
                      <span>View Template</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <LayoutTemplate className="mb-1 h-8 w-8" />
                  <span className="text-[10px]">No preview</span>
                </div>
              )}
            </div>

            {/* Template Info */}
            <div className="rounded bg-gray-50 p-2">
              <div className="text-[10px] text-gray-500">
                <div className="flex items-center justify-between">
                  <span>File:</span>
                  <span className="max-w-[150px] truncate font-medium text-gray-700">
                    {
                      (selectedTemplate || selectedTemplateFromList)?.file
                        .filename
                    }
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span>Fields:</span>
                  <span className="font-medium text-gray-700">
                    {(selectedTemplate || selectedTemplateFromList)
                      ?.field_count ||
                      (selectedTemplate || selectedTemplateFromList)
                        ?.form_fields?.length ||
                      0}{" "}
                    defined
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Template Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent
          className="flex h-[85vh] max-w-5xl flex-col"
          onClick={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => e.stopPropagation()}
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-sky-600" />
              {selectedTemplate?.name || "Template Preview"}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate?.file.filename} •{" "}
              {selectedTemplate?.field_count ||
                selectedTemplate?.form_fields?.length ||
                0}{" "}
              fields defined
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200">
            {pdfBuffer && selectedTemplate ? (
              <TemplateEditor
                fields={selectedTemplate.form_fields as FormField[]}
                onChange={() => {}}
                pdfBuffer={pdfBuffer}
                readonly={true}
              />
            ) : (
              <div className="flex h-full items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Output Renderer Component (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

export function TemplateEditOutputRenderer(
  result: unknown,
  _inputStates: InputState[],
  isProcessing: boolean,
  options?: PlaygroundOutputRenderOptions,
) {
  const editResult = result as TemplateEditResultState | null;
  const hasOutput = editResult?.filledBuffer != null;
  const hasTemplate =
    editResult?.templatePdfBuffer !== null &&
    editResult?.templatePdfBuffer !== undefined &&
    (editResult?.templateFields?.length || 0) > 0;
  const initialViewMode = hasOutput ? "filled" : "template";
  const outputViewKey = `${hasOutput ? "1" : "0"}\u0000${hasTemplate ? "1" : "0"}\u0000${initialViewMode}`;

  return (
    <TemplateEditOutputRendererContent
      key={outputViewKey}
      editResult={editResult}
      isProcessing={isProcessing}
      initialViewMode={initialViewMode}
      options={options}
    />
  );
}

function TemplateEditOutputRendererContent({
  editResult,
  isProcessing,
  initialViewMode,
  options,
}: {
  editResult: TemplateEditResultState | null;
  isProcessing: boolean;
  initialViewMode: "template" | "filled";
  options?: PlaygroundOutputRenderOptions;
}) {
  const hasTemplate =
    editResult?.templatePdfBuffer !== null &&
    editResult?.templatePdfBuffer !== undefined &&
    (editResult?.templateFields?.length || 0) > 0;
  const hasOutput = editResult?.filledBuffer != null;
  const requestedViewMode = options?.viewMode;
  const viewMode: "template" | "filled" =
    requestedViewMode === "template" && hasTemplate
      ? "template"
      : requestedViewMode === "filled" && hasOutput
        ? "filled"
        : initialViewMode;

  return (
    <>
      {/* Content */}
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {/* Loading overlay */}
        {isProcessing && viewMode === "filled" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              <span className="text-sm text-gray-500">Filling template...</span>
            </div>
          </div>
        )}

        {viewMode === "template" &&
        hasTemplate &&
        editResult?.templatePdfBuffer ? (
          <div className="flex-1 overflow-hidden">
            <TemplateEditor
              fields={editResult.templateFields}
              onChange={() => {}}
              pdfBuffer={editResult.templatePdfBuffer}
              readonly={true}
              isDrawingMode={false}
              onDrawingComplete={() => {}}
              hoveredFieldIndex={null}
              selectedFieldIndex={null}
              onSelectedFieldChange={() => {}}
            />
          </div>
        ) : editResult?.filledBuffer && viewMode === "filled" ? (
          <div className="flex-1 overflow-hidden">
            <FilePreview
              content={editResult.filledBuffer}
              mimeType="application/pdf"
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gray-50 px-8 text-gray-400">
            <LayoutTemplate className="h-16 w-16 text-gray-200" />
            <p className="text-center text-base text-gray-500">
              Run to fill template
            </p>
            <p className="max-w-sm text-center text-sm text-gray-400">
              Select a template, provide filling data, and click Run
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared Template Edit Playground Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface TemplateEditPlaygroundOptions {
  supportsLoadFromRun?: boolean;
}

export interface TemplateEditSectionsOptions {
  onTemplatePreviewChange?: (
    preview: TemplateEditTemplatePreviewState | null,
  ) => void;
}

export function createTemplateEditInputs(
  options: TemplateEditPlaygroundOptions = {},
) {
  return [
    createJsonInput("instructions", "Filling Data", {
      placeholder: '{"name":"John Doe","email":"john@example.com"}',
      supportsLoadFromRun: options.supportsLoadFromRun ?? true,
      configKey: "instructions",
      handleId: "input-json-0",
    }),
  ];
}

export function createTemplateEditSections(
  options: TemplateEditSectionsOptions = {},
): ProcessingNodeSection[] {
  return [
    { type: "model" },
    {
      type: "custom",
      render: (cfg, onChange) => (
        <TemplateSelectSection
          templateId={cfg.template_id as string | undefined}
          onTemplateChange={(templateId) =>
            onChange({ ...cfg, template_id: templateId })
          }
          onTemplatePreviewChange={options.onTemplatePreviewChange}
        />
      ),
    },
  ];
}

export function getTemplateEditRequirements(
  inputStates: InputState[],
  cfg: Record<string, unknown>,
): RequirementItem[] {
  const instructionsState = inputStates.find((s) => s.id === "instructions")!;

  // Check instructions from either input state or config
  const instructionsText =
    instructionsState?.textValue || (cfg.instructions as string) || "";
  const hasInstructions = instructionsText.trim().length > 0;
  const hasTemplate = !!(cfg.template_id as string);

  return [
    {
      id: "template",
      label: "Template",
      isMet: hasTemplate,
      description: hasTemplate ? "Selected" : "Select a template",
    },
    {
      id: "instructions",
      label: "Filling Data",
      isMet: hasInstructions,
      description: hasInstructions ? "Provided" : "Enter in block",
    },
  ];
}

export function createTemplateEditRunHandler() {
  return async (
    inputStates: InputState[],
    cfg: Record<string, unknown>,
  ): Promise<TemplateEditResultState> => {
    const instructionsState = inputStates.find((s) => s.id === "instructions")!;
    const templateId = cfg.template_id as string;

    if (!templateId) {
      throw new Error("Please select a template first");
    }

    // Get instructions from input state or config
    const instructions =
      instructionsState?.textValue || (cfg.instructions as string) || "";
    if (!instructions.trim()) {
      throw new Error("Please provide filling data or instructions");
    }

    // Build filling instructions
    let fillingInstructions = instructions;

    // Try to parse as JSON and convert to instructions format
    try {
      const jsonData = JSON.parse(instructions);
      if (typeof jsonData === "object" && jsonData !== null) {
        const dataInstructions = Object.entries(jsonData)
          .map(([key, value]) => {
            if (value === null || value === undefined) return null;
            if (typeof value === "object") {
              return `${key}: ${JSON.stringify(value)}`;
            }
            return `${key}: ${value}`;
          })
          .filter(Boolean)
          .join("\n");
        if (dataInstructions) {
          fillingInstructions = dataInstructions;
        }
      }
    } catch {
      // Not JSON, use as-is
    }

    // Call the unified edit API in template-fill mode (template_id in the body).
    const response = await fetchWithAuth(
      `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/v1/edits`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          model: (cfg.model as string) || "retab-small",
          instructions: fillingInstructions,
        }),
      },
      {
        timeout: 300000,
        retryConfig: { maxRetries: 4, baseDelay: 2000, maxDelay: 20000 },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Template edit failed: ${errorText || response.statusText}`,
      );
    }

    // `/v1/edits` returns `Edit { output: { form_data, filled_document }, ... }`.
    const rawResponse = (await response.json()) as {
      output: EditResponse;
    };
    const editResponse: EditResponse = rawResponse.output;

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

    const filledCount =
      editResponse.form_data?.filter((f) => f.value).length || 0;
    toast.success(`Template filled successfully (${filledCount} fields)`);

    return {
      response: editResponse,
      filledBuffer,
      templateFields: [],
    };
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Template Edit Playground Canvas (standalone, no dialog)
// ═══════════════════════════════════════════════════════════════════════════════

export interface TemplateEditPlaygroundCanvasProps {
  config: TemplateEditConfig;
  onConfigChange?: (config: Record<string, unknown>) => void;
  className?: string;
  canvasId?: string;
  headerSlot?: ReactNode;
  initialInputStates?: Partial<InputState>[];
  initialResult?: TemplateEditResultState;
  // Workflow context (optional)
  blockId?: string;
  workflowId?: string;
  workflow?: Workflow;
  // Options
  supportsLoadFromRun?: boolean;
  // Custom sections (allows injecting custom section with manage button)
  customSections?: ProcessingNodeSection[];
  // Custom run handler
  onRun?: (
    inputStates: InputState[],
    cfg: Record<string, unknown>,
  ) => Promise<TemplateEditResultState>;
  // Custom output renderer
  renderOutput?: (
    result: unknown,
    inputStates: InputState[],
    isProcessing: boolean,
    options?: PlaygroundOutputRenderOptions,
  ) => ReactNode;
  // Template data for output display
  templatePdfBuffer?: ArrayBuffer | null;
  templateFields?: FormField[];
  templateName?: string;
  // When set, hides the Run affordance (page-owned capability gate).
  runDisabledReason?: string | null;
}

export function TemplateEditPlaygroundCanvas({
  config,
  onConfigChange,
  className,
  canvasId = "template-edit-playground-canvas",
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
  templatePdfBuffer,
  templateFields,
  templateName,
  runDisabledReason,
}: TemplateEditPlaygroundCanvasProps) {
  const options: TemplateEditPlaygroundOptions = { supportsLoadFromRun };
  const inputs = createTemplateEditInputs(options);
  const [selectedTemplatePreview, setSelectedTemplatePreview] =
    useState<TemplateEditTemplatePreviewState | null>(null);
  const sections = useMemo(
    () =>
      customSections ||
      createTemplateEditSections({
        onTemplatePreviewChange: setSelectedTemplatePreview,
      }),
    [customSections],
  );

  const defaultRunHandler = useMemo(() => createTemplateEditRunHandler(), []);

  const handleRun = useCallback(
    async (inputStates: InputState[], cfg: Record<string, unknown>) => {
      const runResult = externalOnRun
        ? await externalOnRun(inputStates, cfg)
        : await defaultRunHandler(inputStates, cfg);
      const fallbackTemplatePdfBuffer =
        templatePdfBuffer || selectedTemplatePreview?.templatePdfBuffer || null;
      const fallbackTemplateFields =
        templateFields && templateFields.length > 0
          ? templateFields
          : selectedTemplatePreview?.templateFields || [];

      return {
        ...runResult,
        templatePdfBuffer:
          runResult.templatePdfBuffer || fallbackTemplatePdfBuffer,
        templateFields:
          runResult.templateFields?.length > 0
            ? runResult.templateFields
            : fallbackTemplateFields,
        templateId:
          runResult.templateId ||
          config.template_id ||
          selectedTemplatePreview?.templateId,
        templateName:
          runResult.templateName ||
          templateName ||
          selectedTemplatePreview?.templateName,
      };
    },
    [
      externalOnRun,
      defaultRunHandler,
      templatePdfBuffer,
      selectedTemplatePreview,
      templateFields,
      config.template_id,
      templateName,
    ],
  );

  // Custom render that merges template data
  const renderOutput = useCallback(
    (
      result: unknown,
      inputStates: InputState[],
      isProcessing: boolean,
      renderOptions?: PlaygroundOutputRenderOptions,
    ): ReactNode => {
      // Merge template data into result
      const outputState = result as TemplateEditResultState | null;
      const fallbackTemplatePdfBuffer =
        templatePdfBuffer || selectedTemplatePreview?.templatePdfBuffer || null;
      const fallbackTemplateFields =
        templateFields && templateFields.length > 0
          ? templateFields
          : selectedTemplatePreview?.templateFields || [];
      const fallbackTemplateId =
        config.template_id || selectedTemplatePreview?.templateId;
      const fallbackTemplateName =
        templateName || selectedTemplatePreview?.templateName;
      const mergedResult: TemplateEditResultState | null = outputState
        ? {
            ...outputState,
            templatePdfBuffer:
              outputState.templatePdfBuffer || fallbackTemplatePdfBuffer,
            templateFields:
              outputState.templateFields?.length > 0
                ? outputState.templateFields
                : fallbackTemplateFields,
            templateId: outputState.templateId || fallbackTemplateId,
            templateName: outputState.templateName || fallbackTemplateName,
          }
        : fallbackTemplatePdfBuffer && fallbackTemplateFields.length > 0
          ? {
              response: null,
              filledBuffer: null,
              templatePdfBuffer: fallbackTemplatePdfBuffer,
              templateFields: fallbackTemplateFields,
              templateId: fallbackTemplateId,
              templateName: fallbackTemplateName,
            }
          : null;

      if (externalRenderOutput) {
        return externalRenderOutput(
          mergedResult,
          inputStates,
          isProcessing,
          renderOptions,
        );
      }

      return TemplateEditOutputRenderer(
        mergedResult,
        inputStates,
        isProcessing,
        renderOptions,
      );
    },
    [
      externalRenderOutput,
      templatePdfBuffer,
      templateFields,
      config.template_id,
      templateName,
      selectedTemplatePreview,
    ],
  );

  return (
    <PlaygroundCanvas
      blockType="edit"
      title="Template Edit"
      description="Fill a template with provided data"
      icon={LayoutTemplate}
      color="#0ea5e9"
      inputs={inputs}
      sections={sections}
      config={config as unknown as Record<string, unknown>}
      onConfigChange={onConfigChange}
      getRequirements={getTemplateEditRequirements}
      onRun={handleRun}
      renderOutput={renderOutput}
      runButtonLabel="Run Fill"
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
// Main Template Edit Execute Playground (dialog version for workflow blocks)
// ═══════════════════════════════════════════════════════════════════════════════

export function TemplateEditBlockExecutionPlaygroundV2({
  open,
  onOpenChange,
  config,
  onConfigChange,
  blockId,
  workflowId,
  workflow,
}: TemplateEditBlockExecutionPlaygroundProps) {
  const inputs = createTemplateEditInputs({ supportsLoadFromRun: true });
  const [selectedTemplatePreview, setSelectedTemplatePreview] =
    useState<TemplateEditTemplatePreviewState | null>(null);
  const sections = useMemo(
    () =>
      createTemplateEditSections({
        onTemplatePreviewChange: setSelectedTemplatePreview,
      }),
    [],
  );
  const runHandler = useMemo(() => createTemplateEditRunHandler(), []);
  const handleRun = useCallback(
    async (inputStates: InputState[], cfg: Record<string, unknown>) => {
      const runResult = await runHandler(inputStates, cfg);
      return {
        ...runResult,
        templatePdfBuffer:
          runResult.templatePdfBuffer ||
          selectedTemplatePreview?.templatePdfBuffer ||
          null,
        templateFields:
          runResult.templateFields?.length > 0
            ? runResult.templateFields
            : selectedTemplatePreview?.templateFields || [],
        templateId:
          runResult.templateId ||
          selectedTemplatePreview?.templateId ||
          config.template_id,
        templateName:
          runResult.templateName || selectedTemplatePreview?.templateName,
      };
    },
    [config.template_id, runHandler, selectedTemplatePreview],
  );
  const renderOutput = useCallback(
    (
      result: unknown,
      inputStates: InputState[],
      isProcessing: boolean,
      renderOptions?: PlaygroundOutputRenderOptions,
    ): ReactNode => {
      const outputState = result as TemplateEditResultState | null;
      const mergedResult: TemplateEditResultState | null = outputState
        ? {
            ...outputState,
            templatePdfBuffer:
              outputState.templatePdfBuffer ||
              selectedTemplatePreview?.templatePdfBuffer ||
              null,
            templateFields:
              outputState.templateFields?.length > 0
                ? outputState.templateFields
                : selectedTemplatePreview?.templateFields || [],
            templateId:
              outputState.templateId ||
              selectedTemplatePreview?.templateId ||
              config.template_id,
            templateName:
              outputState.templateName || selectedTemplatePreview?.templateName,
          }
        : selectedTemplatePreview
          ? {
              response: null,
              filledBuffer: null,
              templatePdfBuffer: selectedTemplatePreview.templatePdfBuffer,
              templateFields: selectedTemplatePreview.templateFields,
              templateId: selectedTemplatePreview.templateId,
              templateName: selectedTemplatePreview.templateName,
            }
          : null;

      return TemplateEditOutputRenderer(
        mergedResult,
        inputStates,
        isProcessing,
        renderOptions,
      );
    },
    [config.template_id, selectedTemplatePreview],
  );

  return (
    <ExecutePlayground
      open={open}
      onOpenChange={onOpenChange}
      blockType="edit"
      title="Template Edit"
      description="Fill a template with provided data"
      icon={LayoutTemplate}
      color="#0ea5e9"
      inputs={inputs}
      sections={sections}
      config={config as unknown as Record<string, unknown>}
      onConfigChange={onConfigChange}
      getRequirements={getTemplateEditRequirements}
      onRun={handleRun}
      renderOutput={renderOutput}
      runButtonLabel="Run Fill"
      runningLabel="Filling..."
      blockId={blockId}
      workflowId={workflowId}
      workflow={workflow}
    />
  );
}
