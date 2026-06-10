"use client";

import { useState, useMemo, ReactNode } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
  ScanText,
  Loader2,
  ImageIcon,
  TableIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FilePreview from "@/app/dashboard/widgets/components/file-component/file-preview";

import { MIMEData } from "@/app/dashboard/widgets/types/mime";
import { fetchWithAuth } from "@/backend/client-auth-utils";
import type { Workflow } from "@/app/dashboard/shared/workflows/types/workflows";

import {
  ExecutePlayground,
  PlaygroundCanvas,
  InputState,
  RequirementItem,
  ProcessingNodeSection,
  createFileInput,
  hasInputValue,
  PlaygroundCanvasProps,
  type PlaygroundOutputRenderOptions,
  type PlaygroundOutputViewMode,
} from "./execute-playground";
import { EXTRACT_ENDPOINT_SUPPORTED_FILE_ACCEPT } from "./file-accepts";
import { inputStateToUrlBackedMIMEData } from "./upload-input-state";

import { customMarkdownInHTMLFix } from "@/app/components/markdown-html-fix";

// ═══════════════════════════════════════════════════════════════════════════════
// Types (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

type ViewMode = PlaygroundOutputViewMode;

export interface ParseConfig {
  model: string;
  image_resolution_dpi: number;
  table_parsing_format?: string;
}

export interface ParseResponse {
  document: {
    id: string;
    filename: string;
    mime_type: string;
  };
  usage: {
    credits: number;
  };
  output: {
    pages: string[];
    text: string;
  };
  // Legacy flat fields are accepted only so older persisted payloads
  // can still render in viewers. New frontend requests use `output`.
  pages?: string[];
  text?: string;
}

interface ParseBlockExecutionPlaygroundProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ParseConfig;
  onConfigChange?: (config: Record<string, unknown>) => void;
  blockId?: string;
  workflowId?: string;
  workflow?: Workflow;
  // When set, the user lacks `workflow:run` (page-owned capability gate). The
  // Run button stays visible but disabled; the dialog itself remains openable.
  runDisabledReason?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Image Resolution Section (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

interface ImageResolutionSectionProps {
  value: number;
  onChange: (value: number) => void;
  defaultValue?: number;
}

export function ImageResolutionSection({
  value,
  onChange,
  defaultValue = 192,
}: ImageResolutionSectionProps) {
  return (
    <div
      className="space-y-2 rounded-lg bg-gray-50 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <ImageIcon className="h-3.5 w-3.5 text-cyan-500" />
        <span className="text-[10px] font-medium text-gray-600">
          Image Resolution
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Slider
          min={72}
          max={300}
          step={1}
          value={[value || defaultValue]}
          onValueChange={(values) => onChange(values[0])}
          className="flex-1"
        />
        <span className="w-12 text-right font-mono text-[10px] text-gray-700">
          {value || defaultValue} DPI
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Table Format Section (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

interface TableFormatSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export function TableFormatSection({
  value,
  onChange,
}: TableFormatSectionProps) {
  return (
    <div
      className="space-y-2 rounded-lg bg-gray-50 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TableIcon className="h-3.5 w-3.5 text-cyan-500" />
          <span className="text-[10px] font-medium text-gray-600">
            Table Format
          </span>
        </div>
        <Select value={value || "html"} onValueChange={onChange}>
          <SelectTrigger className="h-7 w-28 bg-white text-xs">
            <SelectValue placeholder="Select format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem className="text-xs" value="html">
              HTML
            </SelectItem>
            <SelectItem className="text-xs" value="markdown">
              Markdown
            </SelectItem>
            <SelectItem className="text-xs" value="json">
              JSON
            </SelectItem>
            <SelectItem className="text-xs" value="yaml">
              YAML
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Output Renderer (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

export function ParseOutputRenderer(
  result: unknown,
  inputStates: InputState[],
  isProcessing: boolean,
  previewOrOptions?:
    | { buffer: ArrayBuffer; mimeType: string }
    | PlaygroundOutputRenderOptions
    | null,
  renderOptions?: PlaygroundOutputRenderOptions,
) {
  const parseResult = result as ParseResponse | null;
  const resolvedPages = useMemo(
    () => parseResult?.output?.pages ?? [],
    [parseResult?.output?.pages],
  );
  const resolvedText: string = parseResult?.output?.text ?? "";
  const inputFilePreview = useMemo(() => {
    const documentInput = inputStates.find(
      (state) => state.type === "file" && state.fileBuffer,
    );

    if (!documentInput?.fileBuffer) {
      return null;
    }

    return {
      buffer: documentInput.fileBuffer,
      mimeType:
        documentInput.fileMimeType ||
        parseResult?.document?.mime_type ||
        "application/octet-stream",
    };
  }, [inputStates, parseResult?.document?.mime_type]);
  let providedFilePreview: { buffer: ArrayBuffer; mimeType: string } | null =
    null;
  let options: PlaygroundOutputRenderOptions | undefined = renderOptions;
  if (isParseFilePreview(previewOrOptions)) {
    providedFilePreview = previewOrOptions;
  } else {
    options = previewOrOptions ?? undefined;
  }
  const resolvedFilePreview = providedFilePreview ?? inputFilePreview;
  const parseViewerKey = `${parseResult?.document?.id ?? "empty"}\u0000${resolvedPages.length}\u0000${resolvedText.length}\u0000${resolvedFilePreview ? "file" : "no-file"}`;

  return (
    <ParseOutputRendererContent
      key={parseViewerKey}
      parseResult={parseResult}
      resolvedPages={resolvedPages}
      isProcessing={isProcessing}
      filePreview={resolvedFilePreview}
      options={options}
    />
  );
}

function isParseFilePreview(
  value:
    | { buffer: ArrayBuffer; mimeType: string }
    | PlaygroundOutputRenderOptions
    | null
    | undefined,
): value is { buffer: ArrayBuffer; mimeType: string } {
  return (
    value !== null &&
    value !== undefined &&
    "buffer" in value &&
    value.buffer instanceof ArrayBuffer
  );
}

function ParseOutputRendererContent({
  parseResult,
  resolvedPages,
  isProcessing,
  filePreview,
  options,
}: {
  parseResult: ParseResponse | null;
  resolvedPages: string[];
  isProcessing: boolean;
  filePreview?: { buffer: ArrayBuffer; mimeType: string } | null;
  options?: PlaygroundOutputRenderOptions;
}) {
  const requestedTab = options?.viewMode ?? "text";
  const activeTab: ViewMode =
    requestedTab === "file" && !filePreview ? "text" : requestedTab;
  const [currentPage, setCurrentPage] = useState(0);
  const hasOutput = parseResult !== null && resolvedPages.length > 0;

  return (
    <>
      {/* Content */}
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {hasOutput && resolvedPages.length > 1 && activeTab !== "file" && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-white"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 bg-white px-3"
                >
                  Page {currentPage + 1} / {resolvedPages.length}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-96 overflow-auto">
                {resolvedPages.map((_, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => setCurrentPage(index)}
                    className={currentPage === index ? "bg-gray-100" : ""}
                  >
                    Page {index + 1}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-white"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === resolvedPages.length - 1}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {!hasOutput ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gray-50 px-8 text-gray-400">
            {isProcessing ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-cyan-500" />
                <p className="text-center text-base text-gray-500">
                  Parsing...
                </p>
              </>
            ) : (
              <>
                <ScanText className="h-16 w-16 text-gray-200" />
                <p className="text-center text-base text-gray-500">
                  Run parse to see output
                </p>
                <p className="max-w-sm text-center text-sm text-gray-400">
                  Upload a document and click Run Parse
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {activeTab === "text" && (
              <div className="flex min-h-0 flex-1 overflow-auto bg-white p-5 text-xs whitespace-pre-wrap">
                {resolvedPages[currentPage]}
              </div>
            )}

            {activeTab === "rendered" && (
              <div className="flex min-h-0 flex-1 overflow-auto bg-white p-5">
                <div className="prose prose-sm w-full max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, customMarkdownInHTMLFix]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      h1: ({ ...props }) => (
                        <h1 className="text-4xl font-extrabold" {...props} />
                      ),
                      h2: ({ ...props }) => (
                        <h2 className="text-3xl font-bold" {...props} />
                      ),
                      h3: ({ ...props }) => (
                        <h3 className="text-2xl font-semibold" {...props} />
                      ),
                      h4: ({ ...props }) => (
                        <h4 className="text-xl font-medium" {...props} />
                      ),
                      h5: ({ ...props }) => (
                        <h5 className="text-lg font-normal" {...props} />
                      ),
                      h6: ({ ...props }) => (
                        <h6 className="text-base font-light" {...props} />
                      ),
                      td: ({ ...props }) => (
                        <td
                          className="border bg-gray-50 px-2 py-1"
                          {...props}
                        />
                      ),
                      th: ({ ...props }) => (
                        <td
                          className="border bg-gray-200 px-2 py-1"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {resolvedPages[currentPage]}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {activeTab === "file" && filePreview && (
              <div className="flex min-h-0 flex-1 overflow-auto bg-gray-50">
                <FilePreview
                  content={filePreview.buffer}
                  mimeType={filePreview.mimeType}
                />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared Parse Playground Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface ParsePlaygroundOptions {
  supportsLoadFromRun?: boolean;
  defaultDpi?: number;
}

export function createParseInputs(options: ParsePlaygroundOptions = {}) {
  return [
    createFileInput("document", "Document", {
      supportsLoadFromRun: options.supportsLoadFromRun ?? true,
      fileAccept: EXTRACT_ENDPOINT_SUPPORTED_FILE_ACCEPT,
    }),
  ];
}

export function createParseSections(
  options: ParsePlaygroundOptions = {},
): ProcessingNodeSection[] {
  const defaultDpi = options.defaultDpi ?? 192;
  return [
    { type: "model" },
    {
      type: "custom",
      render: (cfg, onChange) => (
        <ImageResolutionSection
          value={(cfg.image_resolution_dpi as number) || defaultDpi}
          onChange={(value) =>
            onChange({ ...cfg, image_resolution_dpi: value })
          }
          defaultValue={defaultDpi}
        />
      ),
    },
    {
      type: "custom",
      render: (cfg, onChange) => (
        <TableFormatSection
          value={(cfg.table_parsing_format as string) || "html"}
          onChange={(value) =>
            onChange({ ...cfg, table_parsing_format: value })
          }
        />
      ),
    },
  ];
}

export function getParseRequirements(
  inputStates: InputState[],
  _cfg: Record<string, unknown>,
): RequirementItem[] {
  const documentState = inputStates[0];
  const hasDocument = hasInputValue(documentState);

  return [
    {
      id: "document",
      label: "Document",
      isMet: hasDocument,
      description: hasDocument
        ? documentState.fileName || "File loaded"
        : "Upload a document",
    },
  ];
}

export function createParseRunHandler(options: ParsePlaygroundOptions = {}) {
  const defaultDpi = options.defaultDpi ?? 192;

  return async (inputStates: InputState[], cfg: Record<string, unknown>) => {
    const documentState = inputStates[0];

    if (!hasInputValue(documentState) || !documentState.fileBuffer) {
      throw new Error("Please upload a document first");
    }

    const documentData: MIMEData =
      await inputStateToUrlBackedMIMEData(documentState);

    const parseRequest = {
      document: documentData,
      model: (cfg.model as string) || "retab-small",
      table_parsing_format: (cfg.table_parsing_format as string) || "html",
      image_resolution_dpi: (cfg.image_resolution_dpi as number) || defaultDpi,
    };

    const response = await fetchWithAuth(
      `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/v1/parses`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseRequest),
      },
      {
        timeout: 600000,
        retryConfig: { maxRetries: 2, baseDelay: 2000, maxDelay: 10000 },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Parse failed: ${errorText || response.statusText}`);
    }

    const artifactData = (await response.json()) as {
      file?: { id?: string; filename?: string; mime_type?: string };
      usage?: { credits?: number };
      output?: { pages?: string[]; text?: string };
    };
    const result: ParseResponse = {
      document: {
        id: artifactData.file?.id ?? "",
        filename: artifactData.file?.filename ?? documentData.filename,
        mime_type: artifactData.file?.mime_type ?? documentState.fileMimeType,
      },
      usage: {
        credits: artifactData.usage?.credits ?? 0,
      },
      output: {
        pages: artifactData.output?.pages ?? [],
        text: artifactData.output?.text ?? "",
      },
    };
    const pageCount = result.output.pages.length;
    toast.success(`Document parsed: ${pageCount} page(s)`);
    return result;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Parse Playground Canvas (standalone, no dialog)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ParsePlaygroundCanvasProps {
  config: ParseConfig;
  onConfigChange?: (config: Record<string, unknown>) => void;
  className?: string;
  canvasId?: string;
  headerSlot?: ReactNode;
  initialInputStates?: Partial<InputState>[];
  initialResult?: ParseResponse;
  // Workflow context (optional)
  blockId?: string;
  workflowId?: string;
  workflow?: Workflow;
  // Options
  defaultDpi?: number;
  supportsLoadFromRun?: boolean;
  // When set, the canvas hides the Run button and shows this hint instead
  // (UI authorization signaling for the parse primitive capability).
  runDisabledReason?: string | null;
}

export function ParsePlaygroundCanvas({
  config,
  onConfigChange,
  className,
  canvasId = "parse-playground-canvas",
  headerSlot,
  initialInputStates,
  initialResult,
  blockId,
  workflowId,
  workflow,
  defaultDpi = 128,
  supportsLoadFromRun = false,
  runDisabledReason,
}: ParsePlaygroundCanvasProps) {
  const options = useMemo<ParsePlaygroundOptions>(
    () => ({ defaultDpi, supportsLoadFromRun }),
    [defaultDpi, supportsLoadFromRun],
  );
  const inputs = createParseInputs(options);
  const sections = createParseSections(options);
  const handleRun = useMemo(() => createParseRunHandler(options), [options]);
  const normalizedInitialInputStates = useMemo(
    () =>
      initialInputStates?.map((state) => {
        if (!state || state.id) {
          return state;
        }

        return {
          ...state,
          id: "document",
        };
      }),
    [initialInputStates],
  );

  return (
    <PlaygroundCanvas
      blockType="parse"
      title="Parse"
      description="Extract text from documents"
      icon={ScanText}
      color="#06b6d4"
      inputs={inputs}
      sections={sections}
      config={config as unknown as Record<string, unknown>}
      onConfigChange={onConfigChange}
      getRequirements={getParseRequirements}
      onRun={handleRun}
      renderOutput={ParseOutputRenderer}
      className={className}
      canvasId={canvasId}
      headerSlot={headerSlot}
      initialInputStates={normalizedInitialInputStates}
      initialResult={initialResult}
      blockId={blockId}
      workflowId={workflowId}
      workflow={workflow}
      runDisabledReason={runDisabledReason}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Parse Execute Playground (dialog version for workflow blocks)
// ═══════════════════════════════════════════════════════════════════════════════

export function ParseBlockExecutionPlaygroundV2({
  open,
  onOpenChange,
  config,
  onConfigChange,
  blockId,
  workflowId,
  workflow,
  runDisabledReason,
}: ParseBlockExecutionPlaygroundProps) {
  const options = useMemo<ParsePlaygroundOptions>(
    () => ({ defaultDpi: 192, supportsLoadFromRun: true }),
    [],
  );
  const inputs = createParseInputs(options);
  const sections = createParseSections(options);
  const handleRun = useMemo(() => createParseRunHandler(options), [options]);

  return (
    <ExecutePlayground
      open={open}
      onOpenChange={onOpenChange}
      blockType="parse"
      title="Parse"
      description="Extract text from documents"
      icon={ScanText}
      color="#06b6d4"
      inputs={inputs}
      sections={sections}
      config={config as unknown as Record<string, unknown>}
      onConfigChange={onConfigChange}
      getRequirements={getParseRequirements}
      onRun={handleRun}
      renderOutput={ParseOutputRenderer}
      blockId={blockId}
      workflowId={workflowId}
      workflow={workflow}
      runDisabledReason={runDisabledReason}
    />
  );
}
