"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useMemo, ReactNode, useRef } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Braces,
  Loader2,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
  Database,
  GalleryVerticalEnd,
  Code,
  Layers2,
  Blocks,
  Table2,
  Blend,
  ChartCandlestick,
} from "lucide-react";
import type { JSONSchema7 } from "json-schema";

import { cn, unflattenDict } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { ClerkButton } from "@/components/ui/clerk-button";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { MIMEData } from "@/app/dashboard/widgets/types/mime";
import { ExtendedJSONSchema7 } from "@/app/dashboard/widgets/types/json-schema";
import { InferenceSettings } from "@/app/dashboard/widgets/types/inference-settings";
import { autoFormatDateTimeFields } from "@/app/dashboard/widgets/lib/date-utils";
import { fetchWithAuth } from "@/backend/client-auth-utils";
import { InferenceCard } from "@/app/dashboard/components/inference-cards/inference-card-workflow";
import type { Workflow } from "@/app/dashboard/shared/workflows/types/workflows";
import { JsonSchemaEditorProvider } from "@/app/dashboard/shared/schema-editor/contexts/json-schema";
import { SchemaTab } from "@/app/dashboard/shared/schema-editor/schema-editor";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import type { ConsensusChoice } from "@/components/ui/uiform-accordion";
import type { FileData } from "@/app/shared/contexts/file";
import type { TableDocument } from "@/app/dashboard/widgets/types/projects";
import VectorSquare from "@/public/icons/vector-square.svg";
import {
  EnsureExtractionsProvider,
  useOptionalExtractions,
} from "@/app/dashboard/widgets/context/extractions-context";
import { OCRProvider } from "@/app/dashboard/shared/contexts/ocr";
import {
  DEFAULT_EXTRACT_PLAYGROUND_PERSISTED_CONFIG,
  useExtractPlaygroundStore,
} from "@/app/dashboard/workflows/[workflowId]/shared/stores/extract-playground-store";

import {
  ExecutePlayground,
  PlaygroundCanvas,
  type PlaygroundOutputRenderOptions,
  InputState,
  InputDefinition,
  RunExecutionOptions,
  RequirementItem,
  ProcessingNodeSection,
  createFileInput,
  createJsonInput,
  hasInputValue,
} from "./execute-playground";
import { EXTRACT_ENDPOINT_SUPPORTED_FILE_ACCEPT } from "./file-accepts";
import { uploadRetabFileAsMIMEData } from "@/app/dashboard/shared/files/queries/files";
import { inputStateToUrlBackedMIMEData } from "./upload-input-state";

const MonacoEditor = dynamic(
  () =>
    import("@monaco-editor/react").then(
      (componentModule) => componentModule.Editor,
    ),
  { loading: () => null },
);

const TemplatesDialog = dynamic(
  () =>
    import("@/app/dashboard/shared/schema-editor/templates-dialog").then(
      (componentModule) => componentModule.TemplatesDialog,
    ),
  { loading: () => null },
);

const ExtractionComponent = dynamic(
  () =>
    import("@/app/dashboard/widgets/components/extraction-component").then(
      (componentModule) => componentModule.ExtractionComponent,
    ),
  { loading: () => null },
);

const PredictionFormWrapper = dynamic(
  () =>
    import(
      "@/app/dashboard/widgets/components/data-component/views/form-view/uiform-wrappers"
    ).then((componentModule) => componentModule.PredictionFormWrapper),
  { loading: () => null },
);

const SingleFileTableView = dynamic(
  () =>
    import(
      "@/app/dashboard/widgets/components/data-component/views/table-view/single-file-table-view"
    ).then((componentModule) => componentModule.SingleFileTableView),
  { loading: () => null },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Types (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

// Input handle type used by the extract block.
export interface ExtractInputHandle {
  name: string;
  type: "json" | "file";
  is_primary?: boolean;
}

export interface ExtractConfig {
  model: string;
  image_resolution_dpi: number;
  json_schema?: Record<string, unknown>;
  n_consensus?: number;
  inputs?: ExtractInputHandle[];
  reasoning_effort?: string;
}

export interface ExtractOutputState {
  output: Record<string, unknown> | null;
  iterationCount: number;
  jsonSchema: JSONSchema7 | undefined;
  extractionId?: string | null;
  likelihoods?: Record<string, unknown>;
  consensusDetails?: ConsensusChoice[];
  nConsensus?: number;
}

interface ExtractBlockExecutionPlaygroundProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ExtractConfig;
  onConfigChange?: (config: Record<string, unknown>) => void;
  blockId?: string;
  workflowId?: string;
  workflow?: Workflow;
  applyPersistedDefaults?: boolean;
  // When set, the user lacks `workflow:run` (page-owned capability gate). The
  // Run button stays visible but disabled; the dialog itself remains openable.
  runDisabledReason?: string | null;
}

type ViewMode = "form" | "table" | "code";
export type ExtractResultViewerMode = "default" | "extraction_component";

const EXTRACT_ID_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const EMPTY_SCHEMA: ExtendedJSONSchema7 = { type: "object", properties: {} };
const EMPTY_LIKELIHOODS: Record<string, unknown> = {};
const EMPTY_CONSENSUS_CHOICES: ConsensusChoice[] = [];

function logExtractFlow(event: string, details: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
    return;
  }
  console.info(`[extract-flow] ${event}`, details);
}

function countSchemaProperties(
  schema: ExtendedJSONSchema7 | undefined,
): number {
  return Object.keys(schema?.properties || {}).length;
}

function isConfigUsingExtractDefaults(config: ExtractConfig): boolean {
  const schemaFieldCount = countSchemaProperties(
    config.json_schema as ExtendedJSONSchema7,
  );

  return (
    (config.model || "retab-small") === "retab-small" &&
    (config.image_resolution_dpi ?? 150) === 150 &&
    (config.n_consensus ?? 1) === 1 &&
    schemaFieldCount === 0
  );
}

function generateExtractionId(): string {
  let extractionId = "extr_";
  for (let i = 0; i < 21; i += 1) {
    extractionId += EXTRACT_ID_CHARS.charAt(
      Math.floor(Math.random() * EXTRACT_ID_CHARS.length),
    );
  }
  return extractionId;
}

function inferSchemaFromData(data: unknown): ExtendedJSONSchema7 {
  if (data === null || data === undefined) {
    return { type: "string" };
  }

  if (typeof data === "string") {
    return { type: "string" };
  }

  if (typeof data === "number") {
    return Number.isInteger(data) ? { type: "integer" } : { type: "number" };
  }

  if (typeof data === "boolean") {
    return { type: "boolean" };
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { type: "array", items: { type: "string" } };
    }
    return { type: "array", items: inferSchemaFromData(data[0]) };
  }

  if (typeof data === "object") {
    const properties: Record<string, ExtendedJSONSchema7> = {};
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      properties[key] = inferSchemaFromData(value);
    }
    return { type: "object", properties };
  }

  return { type: "string" };
}

function parseStreamedJsonObject(
  streamedContent: string,
): Record<string, unknown> | null {
  const objectStart = streamedContent.indexOf("{");
  if (objectStart < 0) return null;

  const content = streamedContent.slice(objectStart).trim();
  const direct = parseJsonObject(content);
  if (direct) return direct;

  for (const candidate of buildPartialJsonCandidates(content)) {
    const parsed = parseJsonObject(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function buildPartialJsonCandidates(content: string): string[] {
  const candidates: string[] = [];
  const fullCandidate = closePartialJson(content);
  if (fullCandidate) candidates.push(fullCandidate);

  for (let index = content.length - 1; index >= 0; index--) {
    if (content[index] !== "," || isInsideJsonString(content, index)) continue;
    const truncatedCandidate = closePartialJson(content.slice(0, index));
    if (truncatedCandidate) candidates.push(truncatedCandidate);
  }

  return candidates;
}

function isInsideJsonString(content: string, index: number): boolean {
  let inString = false;
  let isEscaped = false;
  for (let i = 0; i < index; i++) {
    const char = content[i];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (char === "\\") {
      isEscaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
    }
  }
  return inString;
}

function closePartialJson(content: string): string | null {
  let repaired = content.trimEnd();
  if (!repaired.startsWith("{")) return null;

  const closers: string[] = [];
  let inString = false;
  let isEscaped = false;
  for (const char of repaired) {
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (char === "\\") {
      isEscaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") {
      closers.push("}");
    } else if (char === "[") {
      closers.push("]");
    } else if (char === "}" || char === "]") {
      closers.pop();
    }
  }

  if (isEscaped) repaired = repaired.slice(0, -1);
  if (inString) repaired += '"';
  while (/[,:]\s*$/.test(repaired)) {
    repaired = repaired.replace(/[,:]\s*$/, "");
  }

  return `${repaired}${closers.reverse().join("")}`;
}

function extractChoiceParsedData(
  choice: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!choice || typeof choice !== "object") {
    return null;
  }

  const directData = choice.data;
  if (
    directData &&
    typeof directData === "object" &&
    !Array.isArray(directData)
  ) {
    return directData as Record<string, unknown>;
  }

  const message = choice.message as Record<string, unknown> | undefined;
  const parsed = message?.parsed;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  const rawContent = message?.content;
  if (typeof rawContent === "string") {
    try {
      const parsedFromText = JSON.parse(rawContent);
      if (
        parsedFromText &&
        typeof parsedFromText === "object" &&
        !Array.isArray(parsedFromText)
      ) {
        return parsedFromText as Record<string, unknown>;
      }
    } catch {
      // Ignore invalid JSON content
    }
  }

  return null;
}

function buildConsensusChoicesFromChunk(
  chunkChoices: Array<Record<string, unknown>> | undefined,
  fallbackOutput: Record<string, unknown>,
): ConsensusChoice[] {
  if (!Array.isArray(chunkChoices) || chunkChoices.length <= 1) {
    return [];
  }

  const parsedChoices = chunkChoices.reduce<ConsensusChoice[]>(
    (acc, choice, index) => {
      const data = extractChoiceParsedData(choice);
      if (!data) return acc;
      acc.push({
        data,
        index:
          typeof choice.index === "number" ? (choice.index as number) : index,
        likelihoods: {},
      });
      return acc;
    },
    [],
  );

  if (parsedChoices.length <= 1) {
    return [];
  }

  if (Object.keys(fallbackOutput).length > 0) {
    parsedChoices[0] = { ...parsedChoices[0], data: fallbackOutput };
  }
  return parsedChoices;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Schema Section Component (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

interface SchemaSectionProps {
  jsonSchema: ExtendedJSONSchema7;
  onSchemaChange: (schema: ExtendedJSONSchema7) => void;
  hasDocument: boolean;
  fileBuffer: ArrayBuffer | null;
  fileName: string | null;
  fileMimeType: string;
  model: string;
  imageDpi: number;
  openDialogRef?: React.MutableRefObject<(() => void) | null>;
}

export function ExtractSchemaSection({
  jsonSchema,
  onSchemaChange,
  hasDocument,
  fileBuffer,
  fileName,
  fileMimeType,
  model: _model,
  imageDpi,
  openDialogRef,
}: SchemaSectionProps) {
  const setPersistedJsonSchema = useExtractPlaygroundStore(
    (state) => state.setJsonSchema,
  );
  const [showSchemaDialog, setShowSchemaDialog] = useState(false);
  const [schemaEditorView, setSchemaEditorView] = useState<"builder" | "code">(
    "builder",
  );
  const [editorValue, setEditorValue] = useState("");
  const [localJsonSchema, setLocalJsonSchema] =
    useState<ExtendedJSONSchema7>(jsonSchema);

  // Schema generation state
  const [isGeneratingSchema, setIsGeneratingSchema] = useState(false);
  const [generateInstructions, setGenerateInstructions] = useState("");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showGenerateFromDataDialog, setShowGenerateFromDataDialog] =
    useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [inputDataJson, setInputDataJson] = useState("");
  const [inputDataError, setInputDataError] = useState<string | null>(null);

  const schemaFieldCount = Object.keys(jsonSchema?.properties || {}).length;
  const hasNoSchema = schemaFieldCount === 0;

  const handleSchemaChange = useCallback(
    (schema: ExtendedJSONSchema7) => {
      onSchemaChange(schema);
      setPersistedJsonSchema(schema);
    },
    [onSchemaChange, setPersistedJsonSchema],
  );

  const handleOpen = useCallback(() => {
    setLocalJsonSchema(jsonSchema);
    setEditorValue(JSON.stringify(jsonSchema, null, 2));
    setShowSchemaDialog(true);
  }, [jsonSchema]);

  // Expose handleOpen so parent can programmatically open the schema dialog.
  // Use a ref to avoid stale-closure regressions when handleOpen's deps change.
  const handleOpenRef = useRef(handleOpen);
  handleOpenRef.current = handleOpen;
  useMountEffect(() => {
    if (!openDialogRef) return;
    openDialogRef.current = () => handleOpenRef.current();
    return () => {
      openDialogRef.current = null;
    };
  });

  const handleSave = () => {
    handleSchemaChange(localJsonSchema);
    setShowSchemaDialog(false);
    toast.success("Schema saved");
  };

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!value) return;
    setEditorValue(value);
    try {
      const parsed = JSON.parse(value);
      setLocalJsonSchema(parsed);
    } catch {
      // Invalid JSON, don't update
    }
  }, []);

  // Schema tabs config
  const tabsConfig = useMemo(
    () => [
      {
        label: "Builder",
        value: "builder",
        icon: <VectorSquare className="size-4" />,
      },
      { label: "Code", value: "code", icon: <Code className="size-4" /> },
    ],
    [],
  );

  // Generate schema from document
  const runGenerateSchema = useCallback(async () => {
    if (!hasDocument || !fileBuffer) {
      toast.error("Please upload a document first");
      return;
    }

    setIsGeneratingSchema(true);

    try {
      const document = await uploadRetabFileAsMIMEData(
        new File([fileBuffer], fileName || "document", {
          type: fileMimeType || "application/octet-stream",
        }),
      );

      const requestBody = {
        documents: [document],
        model: "retab-large",
        image_resolution_dpi: imageDpi || 192,
        instructions: generateInstructions || undefined,
      };

      const response = await fetchWithAuth(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/v1/schemas/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const generated = (await response.json()) as {
        json_schema?: ExtendedJSONSchema7;
      };
      if (!generated.json_schema || typeof generated.json_schema !== "object") {
        throw new Error("Schema generation returned no schema");
      }

      setLocalJsonSchema(generated.json_schema);
      handleSchemaChange(generated.json_schema);
      setShowGenerateDialog(false);
      setGenerateInstructions("");
      toast.success("Schema generated successfully");
    } catch (error) {
      console.error("Schema generation error:", error);
      toast.error(
        `Generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsGeneratingSchema(false);
    }
  }, [
    hasDocument,
    fileBuffer,
    fileName,
    fileMimeType,
    imageDpi,
    generateInstructions,
    handleSchemaChange,
  ]);

  const handleGenerateFromInputData = useCallback(() => {
    if (!inputDataJson.trim()) {
      setInputDataError("Please enter some JSON data");
      return;
    }

    try {
      const parsedData = JSON.parse(inputDataJson);
      const inferredSchema = inferSchemaFromData(parsedData);
      const schemaWithTitle: ExtendedJSONSchema7 = {
        ...inferredSchema,
        title: `from_json_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
      };
      setLocalJsonSchema(schemaWithTitle);
      setShowGenerateFromDataDialog(false);
      setInputDataJson("");
      setInputDataError(null);
      toast.success("Schema generated from input data");
    } catch {
      setInputDataError("Invalid JSON. Please check your input.");
    }
  }, [inputDataJson]);

  return (
    <>
      {/* Schema Card - Clickable */}
      <div
        className={`cursor-pointer rounded-lg p-3 transition-colors ${hasNoSchema
            ? "border-2 border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100"
            : "border border-gray-200 bg-white hover:bg-gray-50"
          }`}
        onClick={(e) => {
          e.stopPropagation();
          handleOpen();
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${hasNoSchema ? "bg-amber-100" : "bg-violet-100"
              }`}
          >
            <Braces
              className={`h-4 w-4 ${hasNoSchema ? "text-amber-600" : "text-violet-600"}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h4
              className={`text-xs font-medium ${hasNoSchema ? "text-amber-800" : "text-gray-900"}`}
            >
              Schema
            </h4>
            <p
              className={`text-[10px] ${hasNoSchema ? "font-medium text-amber-600" : "text-gray-500"}`}
            >
              {jsonSchema?.title ||
                (schemaFieldCount > 0
                  ? `${schemaFieldCount} fields defined`
                  : "Click to define schema")}
            </p>
          </div>
          <ChevronRight
            className={`h-4 w-4 ${hasNoSchema ? "text-amber-500" : "text-gray-400"}`}
          />
        </div>
      </div>

      {/* Schema Editor Dialog */}
      <Dialog open={showSchemaDialog} onOpenChange={setShowSchemaDialog}>
        <DialogContent
          className="sm:max-w-4xl"
          onClick={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => e.stopPropagation()}
        >
          <JsonSchemaEditorProvider
            jsonSchema={localJsonSchema}
            setJsonSchema={setLocalJsonSchema}
          >
            <div>
              <DialogHeader>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-row items-start justify-between">
                    <div>
                      <DialogTitle>Schema Editor</DialogTitle>
                      <DialogDescription>
                        Define the fields to extract from documents.
                      </DialogDescription>
                    </div>
                    <div className="flex">
                      <div>
                        <AnimatedTabs
                          tabs={tabsConfig}
                          value={schemaEditorView}
                          onChange={(v) =>
                            setSchemaEditorView(v as "builder" | "code")
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-muted-foreground h-7 px-2 text-xs"
                      onClick={() => setShowGenerateDialog(true)}
                    >
                      <Sparkles className="mr-1 h-3 w-3" />
                      Generate with AI
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-muted-foreground h-7 px-2 text-xs"
                      onClick={() => setShowGenerateFromDataDialog(true)}
                    >
                      <Database className="mr-1 h-3 w-3" />
                      Generate from data
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-muted-foreground h-7 px-2 text-xs"
                      onClick={() => setShowTemplatesDialog(true)}
                    >
                      <GalleryVerticalEnd className="mr-1 h-3 w-3" />
                      Templates
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              <div className="max-h-[70vh] min-h-[500px] overflow-y-auto px-6">
                {schemaEditorView === "builder" ? (
                  <SchemaTab
                    editMode={isGeneratingSchema ? "readOnly" : "editable"}
                    show_buttons={true}
                    show_layout={false}
                    showTemplatesButton={false}
                    small_screen={true}
                  />
                ) : (
                  <MonacoEditor
                    height="500px"
                    language="json"
                    theme="vs-dark"
                    value={editorValue}
                    onChange={handleEditorChange}
                    options={{
                      minimap: { enabled: false },
                      automaticLayout: true,
                      fontSize: 13,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      readOnly: isGeneratingSchema,
                    }}
                  />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowSchemaDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Schema</Button>
            </DialogFooter>
            <TemplatesDialog
              open={showTemplatesDialog}
              onOpenChange={setShowTemplatesDialog}
            />
          </JsonSchemaEditorProvider>
        </DialogContent>
      </Dialog>

      {/* Generate from Input Data Dialog */}
      <Dialog
        open={showGenerateFromDataDialog}
        onOpenChange={setShowGenerateFromDataDialog}
      >
        <DialogContent
          className="sm:max-w-xl"
          onClick={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => e.stopPropagation()}
        >
          <div className="flex max-h-[80vh] flex-col overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Generate from Data</DialogTitle>
              <DialogDescription>
                Paste sample JSON data to automatically infer the schema
                structure.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 px-6 py-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Sample JSON Data</Label>
                <div className="overflow-hidden rounded-lg border">
                  <MonacoEditor
                    height="300px"
                    language="json"
                    theme="vs-dark"
                    value={inputDataJson}
                    onChange={(value) => {
                      setInputDataJson(value || "");
                      setInputDataError(null);
                    }}
                    options={{
                      minimap: { enabled: false },
                      automaticLayout: true,
                      fontSize: 11,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      tabSize: 2,
                    }}
                  />
                </div>
                {inputDataError && (
                  <p className="text-xs text-red-500">{inputDataError}</p>
                )}
              </div>
              <p className="text-xs text-gray-500">
                The schema will be inferred from the JSON structure. Arrays will
                use the first element to determine item types.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowGenerateFromDataDialog(false);
                setInputDataJson("");
                setInputDataError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleGenerateFromInputData}>
              <Database className="mr-2 h-4 w-4" />
              Generate Schema
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Schema Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent
          className="sm:max-w-md"
          onClick={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => e.stopPropagation()}
        >
          <div>
            <DialogHeader>
              <DialogTitle>Generate Schema</DialogTitle>
              <DialogDescription>
                Automatically generate a schema from your uploaded document.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 px-6 py-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  Instructions (optional)
                </Label>
                <Textarea
                  value={generateInstructions}
                  onChange={(e) => setGenerateInstructions(e.target.value)}
                  placeholder="e.g., Focus on extracting invoice line items with quantity, unit price, and total..."
                  className="min-h-[80px] resize-none text-xs"
                  disabled={isGeneratingSchema}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowGenerateDialog(false);
                setGenerateInstructions("");
              }}
              disabled={isGeneratingSchema}
            >
              Cancel
            </Button>
            <Button
              onClick={runGenerateSchema}
              disabled={!hasDocument || isGeneratingSchema}
            >
              {isGeneratingSchema ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Inference Settings Section Component (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

interface InferenceSettingsSectionProps {
  config: ExtractConfig;
  onConfigChange: (config: ExtractConfig) => void;
}

export function ExtractInferenceSettingsSection({
  config,
  onConfigChange,
}: InferenceSettingsSectionProps) {
  const setPersistedInferenceSettings = useExtractPlaygroundStore(
    (state) => state.setInferenceSettings,
  );
  const form = useForm<InferenceSettings>({
    values: {
      model: config.model || "retab-small",
      image_resolution_dpi: config.image_resolution_dpi ?? 192,
      n_consensus: config.n_consensus ?? 1,
    },
  });

  const configRef = useRef(config);
  configRef.current = config;
  const onConfigChangeRef = useRef(onConfigChange);
  onConfigChangeRef.current = onConfigChange;

  useMountEffect(() => {
    const subscription = form.watch((raw) => {
      const currentConfig = configRef.current;
      const model = raw.model ?? currentConfig.model ?? "retab-small";
      const image_resolution_dpi =
        raw.image_resolution_dpi ?? currentConfig.image_resolution_dpi ?? 192;
      const n_consensus = raw.n_consensus ?? currentConfig.n_consensus ?? 1;

      const matchesExternalConfig =
        (currentConfig.model || "retab-small") === model &&
        (currentConfig.image_resolution_dpi ?? 192) === image_resolution_dpi &&
        (currentConfig.n_consensus ?? 1) === n_consensus;

      if (matchesExternalConfig) return;

      setPersistedInferenceSettings({
        model,
        image_resolution_dpi,
        n_consensus,
      });
      onConfigChangeRef.current({
        ...currentConfig,
        model,
        image_resolution_dpi,
        n_consensus,
      });
    });
    return () => subscription.unsubscribe();
  });

  return (
    <Form {...form}>
      <InferenceCard
        form={form}
        readonly={false}
        size="sm"
        jsonSchema={config.json_schema}
      />
    </Form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Output Renderer (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

function ConsensusCodeAlternatives({
  details,
  jsonSchema,
  likelihoodsData,
}: {
  details: ConsensusChoice[];
  jsonSchema?: JSONSchema7;
  likelihoodsData: Record<string, unknown>;
}) {
  const hasLikelihoods = Object.keys(likelihoodsData || {}).length > 0;
  const hasDetails = details.length > 0;
  const [activeAlt, setActiveAlt] = useState<string>(
    hasLikelihoods ? "likelihoods" : hasDetails ? "alt-1" : "",
  );
  const fallbackAltTab = hasLikelihoods
    ? "likelihoods"
    : hasDetails
      ? "alt-1"
      : "";
  const isActiveAltValid =
    activeAlt === "likelihoods"
      ? hasLikelihoods
      : activeAlt.startsWith("alt-") && hasDetails
        ? (() => {
          const idx = Number.parseInt(activeAlt.replace("alt-", ""), 10);
          return !Number.isNaN(idx) && idx >= 1 && idx <= details.length;
        })()
        : activeAlt === "";
  const resolvedActiveAlt = isActiveAltValid ? activeAlt : fallbackAltTab;

  if (!hasLikelihoods && !hasDetails) {
    return (
      <p className="text-muted-foreground px-3 py-4 text-sm">
        No consensus alternatives available.
      </p>
    );
  }

  return (
    <Tabs
      value={resolvedActiveAlt}
      onValueChange={setActiveAlt}
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-0"
    >
      <TabsList className="h-10 w-full justify-start overflow-x-auto rounded-none border-none bg-[#252526] p-0">
        <div className="flex h-full items-center gap-[1px] whitespace-nowrap">
          {hasLikelihoods && (
            <TabsTrigger
              key="alt-trigger-likelihoods"
              value="likelihoods"
              className="text-large h-full rounded-none border-x-0 border-t-0 border-b-3 border-transparent bg-[#2D2D2D] font-normal text-[#969696] transition-all duration-200 hover:text-gray-300 data-[state=active]:border-pink-400 data-[state=active]:bg-[#1E1E1E] data-[state=active]:text-white"
            >
              <div className="flex h-full w-full items-center gap-1">
                <ChartCandlestick className="h-4 w-4 text-[#CBCB41]" />
                <Label className="text-xs font-normal text-[#E1C08D]">
                  likelihoods.json
                </Label>
              </div>
            </TabsTrigger>
          )}

          {details.map((_choice, idx) => (
            <TabsTrigger
              key={`alt-trigger-${idx}`}
              value={`alt-${idx + 1}`}
              className="text-large h-full rounded-none border-x-0 border-t-0 border-b-3 border-transparent bg-[#2D2D2D] font-normal text-[#969696] transition-all duration-200 hover:text-gray-300 data-[state=active]:border-pink-400 data-[state=active]:bg-[#1E1E1E] data-[state=active]:text-white"
            >
              <div className="flex h-full w-full items-center gap-1">
                <div className="!size-[11px] rounded-full border-[1.5px] border-[#CBCB41]" />
                <Label className="text-xs font-normal text-[#E1C08D]">{`extraction ${idx + 1}`}</Label>
              </div>
            </TabsTrigger>
          ))}
        </div>
      </TabsList>

      {details.map((choice, idx) => {
        const formatted = jsonSchema
          ? autoFormatDateTimeFields(
            (choice?.data || {}) as Record<string, unknown>,
            jsonSchema as any,
          )
          : choice?.data || {};

        return (
          <TabsContent
            key={`alt-content-${idx}`}
            value={`alt-${idx + 1}`}
            className="m-0 min-h-0 flex-1"
          >
            <MonacoEditor
              language="json"
              theme="vs-dark"
              value={JSON.stringify(formatted || {}, null, 2)}
              className="min-h-0 flex-1 overflow-hidden rounded-b-lg"
              options={{
                automaticLayout: true,
                readOnly: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 12,
                lineNumbers: "off",
                folding: true,
              }}
            />
          </TabsContent>
        );
      })}

      {hasLikelihoods && (
        <TabsContent
          key="alt-content-likelihoods"
          value="likelihoods"
          className="m-0 min-h-0 flex-1"
        >
          <MonacoEditor
            language="json"
            theme="vs-dark"
            value={JSON.stringify(likelihoodsData || {}, null, 2)}
            className="min-h-0 flex-1 overflow-hidden rounded-b-lg"
            options={{
              automaticLayout: true,
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 12,
              lineNumbers: "off",
              folding: true,
            }}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}

export function ExtractOutputRenderer(
  result: unknown,
  inputStates: InputState[],
  isProcessing: boolean,
  options: PlaygroundOutputRenderOptions | ExtractResultViewerMode = "default",
) {
  const resultViewerMode = typeof options === "string" ? options : "default";
  const extractOutputRendererKey = getExtractOutputRendererKey(
    result,
    resultViewerMode,
  );

  return (
    <ExtractOutputRendererContent
      key={extractOutputRendererKey}
      result={result}
      inputStates={inputStates}
      isProcessing={isProcessing}
      resultViewerMode={resultViewerMode}
    />
  );
}

function getExtractOutputRendererKey(
  result: unknown,
  resultViewerMode: ExtractResultViewerMode,
) {
  const extractResult = result as ExtractOutputState | null;
  return [
    resultViewerMode,
    extractResult?.extractionId ?? "no-extraction",
    extractResult?.iterationCount ?? 0,
  ].join(":");
}

function ExtractOutputRendererContent({
  result,
  inputStates,
  isProcessing,
  resultViewerMode = "default",
}: {
  result: unknown;
  inputStates: InputState[];
  isProcessing: boolean;
  resultViewerMode?: ExtractResultViewerMode;
}) {
  const [activeTab, setActiveTab] = useState<ViewMode>("form");
  const renderCountRef = useRef(0);
  const extractResult = result as ExtractOutputState | null;
  const output = extractResult?.output || null;
  const iterationCount = extractResult?.iterationCount || 0;
  const jsonSchema = extractResult?.jsonSchema;
  const extractionId = extractResult?.extractionId || null;
  const nConsensus = extractResult?.nConsensus || 1;
  const isConsensusEnabled = nConsensus > 1;
  const likelihoods = useMemo(() => {
    const nextLikelihoods = extractResult?.likelihoods;
    if (
      nextLikelihoods &&
      typeof nextLikelihoods === "object" &&
      !Array.isArray(nextLikelihoods)
    ) {
      return nextLikelihoods as Record<string, unknown>;
    }
    return EMPTY_LIKELIHOODS;
  }, [extractResult?.likelihoods]);
  const consensusDetails = useMemo(() => {
    const nextConsensusDetails = extractResult?.consensusDetails;
    if (Array.isArray(nextConsensusDetails)) {
      return nextConsensusDetails as ConsensusChoice[];
    }
    return EMPTY_CONSENSUS_CHOICES;
  }, [extractResult?.consensusDetails]);
  const isExtractionComponentMode = resultViewerMode === "extraction_component";

  const hasOutput = output !== null && Object.keys(output).length > 0;
  const hasLikelihoods = Object.keys(likelihoods).length > 0;
  const scalarValueType =
    isConsensusEnabled && hasLikelihoods ? "consensus" : "none";
  const formConsensusDetails = useMemo(
    () =>
      isConsensusEnabled && consensusDetails.length > 0
        ? consensusDetails
        : EMPTY_CONSENSUS_CHOICES,
    [isConsensusEnabled, consensusDetails],
  );
  const codeConsensusDetails = useMemo(() => {
    const withExplicitAlternatives = formConsensusDetails.filter(
      (choice) =>
        typeof choice?.index === "number" && (choice.index as number) > 0,
    );
    if (withExplicitAlternatives.length > 0) {
      return withExplicitAlternatives;
    }
    return formConsensusDetails;
  }, [formConsensusDetails]);
  const hasCodeConsensusTab =
    isConsensusEnabled && (codeConsensusDetails.length > 0 || hasLikelihoods);
  const shouldUseExtractionComponent =
    resultViewerMode === "extraction_component" && !!extractionId;
  const showExtractionStreamingState =
    isExtractionComponentMode && isProcessing && !extractionId;
  const [activeCodeTab, setActiveCodeTab] = useState<string>("extraction");
  const resolvedActiveCodeTab = hasCodeConsensusTab
    ? activeCodeTab
    : "extraction";
  renderCountRef.current += 1;
  logExtractFlow("ExtractOutputRenderer render", {
    renderCount: renderCountRef.current,
    resultViewerMode,
    isProcessing,
    extractionId,
    hasOutput,
    outputKeyCount: output ? Object.keys(output).length : 0,
    nConsensus,
    hasLikelihoods,
    consensusDetailsCount: consensusDetails.length,
    activeTab,
    activeCodeTab,
    resolvedActiveCodeTab,
    shouldUseExtractionComponent,
    showExtractionStreamingState,
  });

  // Memoize tabs config to prevent infinite re-renders
  const outputTabsConfig = useMemo(
    () => [
      { label: "Table", value: "table", icon: <Table2 className="size-4" /> },
      { label: "Form", value: "form", icon: <Blocks className="size-4" /> },
      { label: "Code", value: "code", icon: <Code className="size-4" /> },
    ],
    [],
  );

  // Create a schema for display
  const displaySchema = useMemo((): JSONSchema7 => {
    if (jsonSchema) {
      return jsonSchema as JSONSchema7;
    }
    if (!output) {
      return { type: "object", properties: {} };
    }
    const properties: Record<string, JSONSchema7> = {};
    for (const key of Object.keys(output)) {
      const value = output[key];
      if (Array.isArray(value)) {
        properties[key] = { type: "array", title: key };
      } else if (typeof value === "object" && value !== null) {
        properties[key] = { type: "object", title: key };
      } else if (typeof value === "number") {
        properties[key] = { type: "number", title: key };
      } else if (typeof value === "boolean") {
        properties[key] = { type: "boolean", title: key };
      } else {
        properties[key] = { type: "string", title: key };
      }
    }
    return { type: "object", properties };
  }, [jsonSchema, output]);

  // Create table document for table view. Canonical v2: consensus lives on
  // `metadata.consensus` (choices + likelihoods tree). Legacy flat
  // `metadata.likelihoods` and `metadata.consensus_details` are not emitted.
  const tablePredictionMetadata = useMemo(() => {
    if (!isConsensusEnabled) {
      return {};
    }

    const hasConsensusContent =
      hasLikelihoods || formConsensusDetails.length > 0;
    if (!hasConsensusContent) {
      return {};
    }

    return {
      consensus: {
        choices: formConsensusDetails.map(
          (choice) => choice.data as Record<string, unknown>,
        ),
        likelihoods: hasLikelihoods ? likelihoods : undefined,
      },
    };
  }, [isConsensusEnabled, hasLikelihoods, likelihoods, formConsensusDetails]);

  const tableDocument = useMemo((): TableDocument => {
    return {
      id: "workflow-playground-output",
      project_id: "",
      mime_data: {
        id: "workflow-playground-output",
        filename: "Extraction Output",
        mime_type: "application/json",
      },
      prediction_data: {
        prediction: (output || {}) as Record<string, unknown>,
        metadata: tablePredictionMetadata as any,
      },
      extraction_id: null,
      dataset_id: "",
      iteration_id: "",
      dataset_document_id: "",
    };
  }, [output, tablePredictionMetadata]);

  // Code view value
  const codeValue = useMemo(() => {
    if (!output) return "";
    return JSON.stringify(output, null, 2);
  }, [output]);

  const streamingFileData = useMemo<FileData | null>(() => {
    const documentInputState = inputStates.find(
      (inputState) => inputState.type === "file" && !!inputState.fileBuffer,
    );
    if (!documentInputState?.fileBuffer) {
      return null;
    }

    const filename = documentInputState.fileName || "document";
    const mimeType =
      documentInputState.fileMimeType || "application/octet-stream";
    const file = new File([documentInputState.fileBuffer], filename, {
      type: mimeType,
    });

    return {
      id: extractionId || `temp-${filename}`,
      file,
      buffer: documentInputState.fileBuffer,
    };
  }, [inputStates, extractionId]);

  return (
    <>
      {(isProcessing || (hasOutput && !shouldUseExtractionComponent)) && (
        <div className="flex min-h-[52px] flex-shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {isProcessing && (
              <div className="flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600" />
                <span className="text-xs font-medium text-violet-600">
                  Extracting...
                </span>
              </div>
            )}
          </div>
          {hasOutput && !shouldUseExtractionComponent && (
            <AnimatedTabs
              tabs={outputTabsConfig}
              value={activeTab}
              onChange={(value) => setActiveTab(value as ViewMode)}
            />
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {showExtractionStreamingState ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gray-50 px-8 text-gray-500">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
            <p className="text-center text-base text-gray-700">
              Extraction in progress
            </p>
            <p className="max-w-sm text-center text-sm text-gray-500">
              Streaming output and sources are being prepared.
            </p>
          </div>
        ) : shouldUseExtractionComponent && extractionId ? (
          <div className="flex min-h-0 flex-1 overflow-hidden bg-white">
            <OCRProvider>
              <EnsureExtractionsProvider mode="lite">
                <ExtractionSelectionSync
                  key={extractionId}
                  extractionId={extractionId}
                />
                <ExtractionComponent
                  extractionId={extractionId}
                  externalStreamingOptions={{
                    isActive: isProcessing,
                    predictions: (output || {}) as Record<string, unknown>,
                    likelihoods: likelihoods,
                    consensusDetails: formConsensusDetails.map((choice) => ({
                      data: choice.data,
                      index: choice.index,
                      likelihoods: choice.likelihoods ?? {},
                    })),
                    nConsensus,
                    fileData: streamingFileData,
                    filename: streamingFileData?.file?.name || null,
                  }}
                  extractionDisplayOptions={{
                    showReasoning: true,
                    showTabs: true,
                  }}
                />
              </EnsureExtractionsProvider>
            </OCRProvider>
          </div>
        ) : !hasOutput ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gray-50 px-8 text-gray-400">
            <Braces className="h-16 w-16 text-gray-200" />
            <p className="text-center text-base text-gray-500">
              Run extract to see output
            </p>
            <p className="max-w-sm text-center text-sm text-gray-400">
              Upload a document, define a schema, and click Run Extract
            </p>
          </div>
        ) : (
          <>
            {activeTab === "form" && (
              <div className="flex min-h-0 flex-1 overflow-auto bg-gray-50 p-4 pb-8">
                <PredictionFormWrapper
                  itemIndex={0}
                  iterationIndex={iterationCount}
                  schema={displaySchema as any}
                  setSchema={() => { }}
                  extractionData={output || {}}
                  similarities={
                    scalarValueType === "consensus" ? likelihoods : undefined
                  }
                  isStreamingIteration={isProcessing}
                  isRunningIteration={isProcessing}
                  scalarValueType={scalarValueType}
                  consensusDetails={formConsensusDetails}
                  editMode="readOnly"
                  allowEditing={false}
                  showPropertyEditorPencil={false}
                  showReasoning={true}
                />
              </div>
            )}

            {activeTab === "table" && (
              <div className="flex min-h-0 flex-1">
                <SingleFileTableView
                  document={tableDocument}
                  schema={displaySchema as JSONSchema7}
                  jsonEditMode="readOnly"
                  schemaEditMode="readOnly"
                  onUpdateDocument={async () => { }}
                  cellColorState={
                    scalarValueType === "consensus" ? "consensus" : "none"
                  }
                  showHoverCard={false}
                />
              </div>
            )}

            {activeTab === "code" && (
              <div className="flex min-h-0 flex-1 overflow-hidden bg-[#252526]">
                <Tabs
                  value={resolvedActiveCodeTab}
                  onValueChange={setActiveCodeTab}
                  className="min-h-0 flex-1 gap-0 overflow-hidden bg-[#252526]"
                >
                  <TabsList className="h-10 w-full justify-between overflow-x-auto rounded-none border-none bg-[#252526] p-0">
                    <div className="flex h-full items-center gap-[1px] whitespace-nowrap">
                      <TabsTrigger
                        value="extraction"
                        className="text-large h-full rounded-none border-x-0 border-t-0 border-b-3 border-transparent bg-[#2D2D2D] font-normal text-[#969696] transition-all duration-200 hover:text-gray-300 data-[state=active]:border-teal-400 data-[state=active]:bg-[#1E1E1E] data-[state=active]:text-white"
                      >
                        <div className="flex h-full w-full items-center gap-1">
                          <Braces className="h-4 w-4 text-[#CBCB41]" />
                          <Label className="text-xs font-normal text-[#E1C08D]">
                            extraction.json
                          </Label>
                        </div>
                      </TabsTrigger>

                      {hasCodeConsensusTab && (
                        <TabsTrigger
                          value="consensus"
                          className="text-large h-full rounded-none border-x-0 border-t-0 border-b-3 border-transparent bg-[#2D2D2D] font-normal text-[#969696] transition-all duration-200 hover:text-gray-300 data-[state=active]:border-teal-400 data-[state=active]:bg-[#1E1E1E] data-[state=active]:text-white"
                        >
                          <div className="flex h-full w-full items-center gap-1">
                            <Blend className="h-4 w-4 text-[#CBCB41]" />
                            <Label className="text-xs font-normal text-[#E1C08D]">
                              consensus
                            </Label>
                          </div>
                        </TabsTrigger>
                      )}
                    </div>
                  </TabsList>

                  <TabsContent
                    value="extraction"
                    className="m-0 min-h-0 flex-1"
                  >
                    <MonacoEditor
                      language="json"
                      theme="vs-dark"
                      value={codeValue}
                      className="min-h-0 flex-1 overflow-hidden rounded-b-lg"
                      options={{
                        automaticLayout: true,
                        readOnly: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 12,
                        lineNumbers: "off",
                        folding: true,
                        wordWrap: "on",
                      }}
                    />
                  </TabsContent>

                  {hasCodeConsensusTab && (
                    <TabsContent
                      value="consensus"
                      className="m-0 flex min-h-0 flex-1"
                    >
                      <ConsensusCodeAlternatives
                        details={codeConsensusDetails}
                        jsonSchema={displaySchema}
                        likelihoodsData={likelihoods}
                      />
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function ExtractionSelectionSyncMountRunner({
  extractionId,
  selectedExtractionId,
  setSelectedExtractionId,
}: {
  extractionId: string;
  selectedExtractionId?: string | null;
  setSelectedExtractionId: (extractionId: string) => void;
}) {
  useMountEffect(() => {
    logExtractFlow("ExtractionSelectionSyncMountRunner effect", {
      extractionId,
      selectedExtractionId: selectedExtractionId ?? null,
      shouldSetSelectedExtractionId: selectedExtractionId !== extractionId,
    });
    if (selectedExtractionId !== extractionId) {
      setSelectedExtractionId(extractionId);
    }
  });

  return null;
}

function ExtractionSelectionSync({ extractionId }: { extractionId: string }) {
  const extractionsContext = useOptionalExtractions();

  if (!extractionsContext) {
    logExtractFlow("ExtractionSelectionSync render without context", {
      extractionId,
    });
    return null;
  }

  logExtractFlow("ExtractionSelectionSync render with context", {
    extractionId,
    selectedExtractionId: extractionsContext.selectedExtractionId,
  });

  return (
    <ExtractionSelectionSyncMountRunner
      extractionId={extractionId}
      selectedExtractionId={extractionsContext.selectedExtractionId}
      setSelectedExtractionId={extractionsContext.setSelectedExtractionId}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Editable Output Panel (exported for annotation sidebar)
// ═══════════════════════════════════════════════════════════════════════════════

export type OutputViewMode = "form" | "table" | "code";

export interface ExtractOutputEditorProps {
  output: Record<string, unknown>;
  jsonSchema?: JSONSchema7;
  onOutputChange: (output: Record<string, unknown>) => void;
  title?: string;
  isEditable?: boolean;
  isStreaming?: boolean;
}

function ExtractOutputCodePane({
  initialCodeValue,
  canEdit,
  onOutputChange,
}: {
  initialCodeValue: string;
  canEdit: boolean;
  onOutputChange: (output: Record<string, unknown>) => void;
}) {
  const [codeValue, setCodeValue] = useState(initialCodeValue);

  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      if (!value) return;
      setCodeValue(value);
      try {
        const parsed = JSON.parse(value);
        onOutputChange(parsed);
      } catch {
        // Invalid JSON - don't update
      }
    },
    [onOutputChange],
  );

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <div className="absolute inset-0">
        <MonacoEditor
          language="json"
          theme="vs"
          value={codeValue}
          onChange={canEdit ? handleCodeChange : undefined}
          options={{
            padding: { top: 16, bottom: 16 },
            automaticLayout: true,
            readOnly: !canEdit,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 12,
            lineNumbers: "on",
            folding: true,
            wordWrap: "on",
          }}
        />
      </div>
    </div>
  );
}

export function ExtractOutputEditor({
  output,
  jsonSchema,
  onOutputChange,
  title = "Output",
  isEditable = true,
  isStreaming = false,
}: ExtractOutputEditorProps) {
  const [activeTab, setActiveTab] = useState<OutputViewMode>("form");

  // When streaming, always disable editing
  const canEdit = isEditable && !isStreaming;

  // Memoize tabs config to prevent infinite re-renders
  const tabsConfig = useMemo(
    () => [
      { label: "Table", value: "table", icon: <Table2 className="size-4" /> },
      { label: "Form", value: "form", icon: <Blocks className="size-4" /> },
      { label: "Code", value: "code", icon: <Code className="size-4" /> },
    ],
    [],
  );

  // Create a schema for display
  const displaySchema = useMemo((): JSONSchema7 => {
    if (jsonSchema) {
      return jsonSchema as JSONSchema7;
    }
    if (!output) {
      return { type: "object", properties: {} };
    }
    const properties: Record<string, JSONSchema7> = {};
    for (const key of Object.keys(output)) {
      const value = output[key];
      if (Array.isArray(value)) {
        properties[key] = { type: "array", title: key };
      } else if (typeof value === "object" && value !== null) {
        properties[key] = { type: "object", title: key };
      } else if (typeof value === "number") {
        properties[key] = { type: "number", title: key };
      } else if (typeof value === "boolean") {
        properties[key] = { type: "boolean", title: key };
      } else {
        properties[key] = { type: "string", title: key };
      }
    }
    return { type: "object", properties };
  }, [jsonSchema, output]);

  // Create empty object from schema when no output
  const displayOutput = useMemo((): Record<string, unknown> => {
    if (output && Object.keys(output).length > 0) {
      return output;
    }
    // If we have a schema, create an empty object based on it
    if (jsonSchema?.properties) {
      const emptyObject: Record<string, unknown> = {};
      for (const key of Object.keys(jsonSchema.properties)) {
        const prop = (jsonSchema.properties as Record<string, JSONSchema7>)[
          key
        ];
        if (prop.type === "array") {
          emptyObject[key] = [];
        } else if (prop.type === "object") {
          emptyObject[key] = {};
        } else if (prop.type === "number" || prop.type === "integer") {
          emptyObject[key] = null;
        } else if (prop.type === "boolean") {
          emptyObject[key] = null;
        } else {
          emptyObject[key] = null;
        }
      }
      return emptyObject;
    }
    return {};
  }, [output, jsonSchema]);
  const displayOutputCodeValue = JSON.stringify(displayOutput, null, 2);

  const hasSchema =
    jsonSchema && Object.keys(jsonSchema.properties || {}).length > 0;
  const hasOutput =
    (output !== null && Object.keys(output).length > 0) || hasSchema;
  const nodeColor = "#8b5cf6"; // violet for annotation

  // Create table document for table view
  const tableDocument = useMemo((): TableDocument => {
    return {
      id: "annotation-output",
      project_id: "",
      mime_data: {
        id: "annotation-output",
        filename: "Annotation Output",
        mime_type: "application/json",
      },
      prediction_data: {
        prediction: displayOutput as Record<string, unknown>,
        metadata: {},
      },
      extraction_id: null,
      dataset_id: "",
      iteration_id: "",
      dataset_document_id: "",
    };
  }, [displayOutput]);

  const handleFormChange = useCallback(
    (itemIndex: number, value: Record<string, unknown>) => {
      onOutputChange(value);
    },
    [onOutputChange],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-[39px] flex-shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
        <Braces
          className="h-4 w-4 flex-shrink-0"
          style={{ color: nodeColor }}
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-gray-900">{title}</h3>
        </div>
        {isStreaming && (
          <div className="flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600" />
            <span className="text-xs font-medium text-violet-600">
              Extracting...
            </span>
          </div>
        )}
        <AnimatedTabs
          tabs={tabsConfig}
          value={activeTab}
          onChange={(value) => setActiveTab(value as OutputViewMode)}
        />
        {/* <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleCopyToClipboard}
                >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button> */}
      </div>

      {/* Content */}
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {!hasOutput ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gray-50 px-8 text-gray-400">
            <Braces className="h-16 w-16 text-gray-200" />
            <p className="text-center text-base text-gray-500">
              No schema defined
            </p>
            <p className="max-w-sm text-center text-sm text-gray-400">
              This block has no output schema configured
            </p>
          </div>
        ) : (
          <>
            {activeTab === "form" && (
              <div className="flex min-h-0 flex-1 overflow-auto bg-gray-50 p-4 pb-8">
                <PredictionFormWrapper
                  itemIndex={0}
                  iterationIndex={0}
                  schema={displaySchema as any}
                  setSchema={() => { }}
                  extractionData={displayOutput}
                  similarities={undefined}
                  isStreamingIteration={isStreaming}
                  isRunningIteration={isStreaming}
                  scalarValueType="none"
                  consensusDetails={[]}
                  editMode={canEdit ? "editable" : "readOnly"}
                  allowEditing={canEdit}
                  onPredictionChange={canEdit ? handleFormChange : undefined}
                  showPropertyEditorPencil={false}
                  showReasoning={true}
                />
              </div>
            )}

            {activeTab === "table" && (
              <div className="flex min-h-0 flex-1">
                <SingleFileTableView
                  document={tableDocument}
                  schema={displaySchema as JSONSchema7}
                  jsonEditMode={canEdit ? "editable" : "readOnly"}
                  schemaEditMode={canEdit ? "editable" : "readOnly"}
                  onUpdateDocument={async () => { }}
                  cellColorState="none"
                  showHoverCard={false}
                />
              </div>
            )}

            {activeTab === "code" && (
              <ExtractOutputCodePane
                key={displayOutputCodeValue}
                initialCodeValue={displayOutputCodeValue}
                canEdit={canEdit}
                onOutputChange={onOutputChange}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared Extract Playground Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExtractPlaygroundOptions {
  supportsLoadFromRun?: boolean;
  defaultDpi?: number;
}

// Create input definitions from config.inputs
export function createExtractInputsFromConfig(
  configInputs: ExtractInputHandle[] | undefined,
  options: ExtractPlaygroundOptions = {},
): InputDefinition[] {
  // Default to a single document input if no inputs configured
  const inputHandles =
    configInputs && configInputs.length > 0
      ? configInputs
      : [{ name: "document", type: "file" as const, is_primary: true }];

  return inputHandles.map((handle, index) => {
    const id = `input-${index}`;
    const supportsLoadFromRun = options.supportsLoadFromRun ?? true;
    // Handle ID format must match workflow edge target_handle format: input-${type}-${name}
    const handleId = `input-${handle.type}-${handle.name}`;

    switch (handle.type) {
      case "file":
        return createFileInput(id, handle.name, {
          supportsLoadFromRun,
          fileAccept: EXTRACT_ENDPOINT_SUPPORTED_FILE_ACCEPT,
          handleId,
        });
      case "json":
        return createJsonInput(id, handle.name, {
          supportsLoadFromRun,
          placeholder: '{"key": "value"}',
          handleId,
        });
      default:
        return createFileInput(id, handle.name, {
          supportsLoadFromRun,
          handleId,
        });
    }
  });
}

export function createExtractInputs(options: ExtractPlaygroundOptions = {}) {
  return [
    createFileInput("document", "Document", {
      supportsLoadFromRun: options.supportsLoadFromRun ?? true,
      fileAccept: EXTRACT_ENDPOINT_SUPPORTED_FILE_ACCEPT,
    }),
  ];
}

export function getExtractRequirements(
  inputStates: InputState[],
  cfg: Record<string, unknown>,
  localJsonSchema?: ExtendedJSONSchema7,
  configInputs?: ExtractInputHandle[],
): RequirementItem[] {
  const schema = (cfg.json_schema as ExtendedJSONSchema7) || localJsonSchema;
  const schemaFieldCount = Object.keys(schema?.properties || {}).length;
  const hasSchema = schemaFieldCount > 0;

  // Get input handles from config or default
  const inputHandles =
    configInputs && configInputs.length > 0
      ? configInputs
      : [{ name: "document", type: "file" as const, is_primary: true }];

  // Find the primary file input (the one that gets chunked/is required)
  const primaryFileIndex = inputHandles.findIndex(
    (h) => h.type === "file" && h.is_primary,
  );
  const firstFileIndex = inputHandles.findIndex((h) => h.type === "file");
  const requiredFileIndex =
    primaryFileIndex >= 0 ? primaryFileIndex : firstFileIndex;

  // Build requirements for each input
  const inputRequirements: RequirementItem[] = inputHandles.map(
    (handle, index) => {
      const state = inputStates[index];
      const hasValue = state ? hasInputValue(state) : false;
      const isRequired = handle.type === "file" && index === requiredFileIndex;

      let description: string;
      if (hasValue) {
        if (handle.type === "file") {
          description = state?.fileName || "File loaded";
        } else if (handle.type === "json") {
          description = "JSON provided";
        } else {
          description = "Text provided";
        }
      } else {
        if (handle.type === "file") {
          description = isRequired
            ? "Upload a document (required)"
            : "Upload a file (optional)";
        } else if (handle.type === "json") {
          description = "Provide JSON data (optional)";
        } else {
          description = "Enter text (optional)";
        }
      }

      return {
        id: `input-${index}`,
        label: handle.name,
        // Only mark file inputs as required for "isMet" check
        isMet: isRequired ? hasValue : true,
        description,
      };
    },
  );

  return [
    ...inputRequirements,
    {
      id: "schema",
      label: "Schema",
      isMet: hasSchema,
      description: hasSchema
        ? `${schemaFieldCount} fields defined`
        : "Define schema",
    },
  ];
}

export function createExtractRunHandler(
  localJsonSchema: ExtendedJSONSchema7,
  iterationCount: number,
  setIterationCount: (fn: (prev: number) => number) => void,
  configInputs?: ExtractInputHandle[],
) {
  return async (
    inputStates: InputState[],
    cfg: Record<string, unknown>,
    runExecutionOptions?: RunExecutionOptions,
  ) => {
    // Get input handles from config or default
    const inputHandles =
      configInputs && configInputs.length > 0
        ? configInputs
        : [{ name: "document", type: "file" as const, is_primary: true }];

    // Find the primary file input
    const primaryFileIndex = inputHandles.findIndex(
      (h) => h.type === "file" && h.is_primary,
    );
    const firstFileIndex = inputHandles.findIndex((h) => h.type === "file");
    const documentIndex =
      primaryFileIndex >= 0 ? primaryFileIndex : firstFileIndex;

    if (documentIndex < 0) {
      throw new Error("No file input configured");
    }

    const documentState = inputStates[documentIndex];

    if (!hasInputValue(documentState)) {
      throw new Error("Please upload a document first");
    }

    if (!documentState.fileBuffer) {
      throw new Error("Please upload a document first");
    }

    const schema = (cfg.json_schema as ExtendedJSONSchema7) || localJsonSchema;
    const schemaFieldCount = Object.keys(schema?.properties || {}).length;

    if (schemaFieldCount === 0) {
      throw new Error("Please define a schema first");
    }

    const documentData: MIMEData =
      await inputStateToUrlBackedMIMEData(documentState);
    const preGeneratedExtractionId = generateExtractionId();

    // Collect additional context from other inputs
    const additionalContext: Record<string, unknown> = {};
    for (const [index, handle] of inputHandles.entries()) {
      if (index === documentIndex) continue; // Skip the main document
      const state = inputStates[index];
      if (!state || !hasInputValue(state)) continue;

      if (handle.type === "json" && state.textValue) {
        try {
          additionalContext[handle.name] = JSON.parse(state.textValue);
        } catch {
          additionalContext[handle.name] = state.textValue;
        }
      } else if (handle.type === "file" && state.fileBuffer) {
        additionalContext[handle.name] =
          await inputStateToUrlBackedMIMEData(state);
      }
    }

    const response = await fetchWithAuth(
      `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/v1/extractions/stream`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: documentData,
          model: (cfg.model as string) || "retab-small",
          image_resolution_dpi: (cfg.image_resolution_dpi as number) || 192,
          n_consensus: (cfg.n_consensus as number) || 1,
          json_schema: schema || { type: "object", properties: {} },
          extraction_id: preGeneratedExtractionId,
          stream: true,
          // Pass additional context if any
          ...(Object.keys(additionalContext).length > 0
            ? { context: additionalContext }
            : {}),
        }),
      },
      {
        timeout: 600000,
        retryConfig: {
          maxRetries: 2,
          baseDelay: 2000,
          maxDelay: 10000,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Extract failed: ${error}`);
    }

    if (!response.body) {
      throw new Error("Browser doesn't support streaming responses.");
    }

    console.log("[extract-stream] response received", {
      status: response.status,
      contentType: response.headers.get("content-type"),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let chunkCount = 0;
    const nConsensus = (cfg.n_consensus as number) || 1;
    let flattenedParsed: Record<string, unknown> = {};
    let flattenedLikelihoods: Record<string, number> = {};
    let explicitLikelihoods: Record<string, unknown> = {};
    let consensusFlatParsed: Record<string, unknown>[] = [];
    let consensusDetails: ConsensusChoice[] = [];
    let finalOutput: Record<string, unknown> = {};
    let streamedContent = "";
    let extractionId: string | null = preGeneratedExtractionId;

    runExecutionOptions?.onProgress?.({
      output: finalOutput,
      iterationCount: iterationCount + 1,
      jsonSchema: schema as JSONSchema7,
      extractionId,
      likelihoods: {},
      consensusDetails: [],
      nConsensus,
    } as ExtractOutputState);

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        console.log(
          "[extract-stream] stream done, remaining buffer:",
          buffer.length,
          "bytes",
        );
        if (buffer.trim()) {
          const lines = buffer.split("\n");
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line);
              processChunk(chunk);
            } catch {
              console.warn(
                "[extract-stream] failed to parse final line:",
                line.substring(0, 200),
              );
            }
          }
        }
        break;
      }

      if (value) {
        const decoded = decoder.decode(value, { stream: true });
        buffer += decoded;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        console.log(
          "[extract-stream] read chunk:",
          decoded.length,
          "bytes,",
          lines.filter((l) => l.trim()).length,
          "lines",
        );

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            processChunk(chunk);
          } catch {
            console.warn(
              "[extract-stream] failed to parse line:",
              line.substring(0, 200),
            );
          }
        }
      }
    }
    console.log(
      "[extract-stream] complete: total chunks=%d, extractionId=%s, outputKeys=%d",
      chunkCount,
      extractionId,
      Object.keys(finalOutput).length,
    );
    console.log(
      "[extract-stream] finalOutput:",
      JSON.stringify(finalOutput).substring(0, 500),
    );

    function processChunk(chunk: Record<string, unknown>) {
      chunkCount++;
      // Capture extraction_id from the chunk (it's at the top level)
      if (chunk.extraction_id && typeof chunk.extraction_id === "string") {
        extractionId = chunk.extraction_id;
      }
      const choices =
        (chunk?.choices as Array<Record<string, unknown>> | undefined) || [];
      const firstChoice = choices[0];
      const delta = firstChoice?.delta as Record<string, unknown> | undefined;
      const shouldParseContentDelta =
        chunk.type === "structured_llm_delta" || chunk.type == null;

      const flatParsedKeys = delta?.flat_parsed
        ? Object.keys(delta.flat_parsed as Record<string, unknown>)
        : [];
      const hasFullParsed = delta?.full_parsed != null;
      console.log(
        "[extract-stream] chunk #%d: extraction_id=%s, choices=%d, flat_parsed_keys=%d, has_full_parsed=%s, content_len=%d",
        chunkCount,
        chunk.extraction_id || "-",
        choices.length,
        flatParsedKeys.length,
        hasFullParsed,
        typeof delta?.content === "string"
          ? (delta.content as string).length
          : 0,
      );

      if (choices.length > 0) {
        while (consensusFlatParsed.length < choices.length) {
          consensusFlatParsed.push({});
        }

        choices.forEach((choice, choiceIndex) => {
          const choiceDelta = choice?.delta as
            | Record<string, unknown>
            | undefined;
          if (!choiceDelta) return;

          const deletedKeys = choiceDelta.flat_deleted_keys as
            | string[]
            | undefined;
          if (deletedKeys) {
            deletedKeys.forEach((key: string) => {
              delete consensusFlatParsed[choiceIndex][key];
              if (choiceIndex === 0) {
                delete flattenedParsed[key];
                delete flattenedLikelihoods[key];
              }
            });
          }

          const flatParsed = choiceDelta.flat_parsed as
            | Record<string, unknown>
            | undefined;
          if (flatParsed) {
            consensusFlatParsed[choiceIndex] = {
              ...consensusFlatParsed[choiceIndex],
              ...flatParsed,
            };
            if (choiceIndex === 0) {
              flattenedParsed = { ...flattenedParsed, ...flatParsed };
              finalOutput = unflattenDict(flattenedParsed) as Record<
                string,
                unknown
              >;
            }
          }

          if (choiceIndex === 0) {
            const contentDelta = choiceDelta.content;
            if (
              shouldParseContentDelta &&
              typeof contentDelta === "string" &&
              contentDelta.length > 0
            ) {
              streamedContent += contentDelta;
              const partialOutput = parseStreamedJsonObject(streamedContent);
              if (partialOutput) {
                finalOutput = partialOutput;
              }
            }

            const fullParsed = choiceDelta.full_parsed as
              | Record<string, unknown>
              | undefined;
            if (
              fullParsed &&
              typeof fullParsed === "object" &&
              !Array.isArray(fullParsed)
            ) {
              finalOutput = fullParsed;
              streamedContent = JSON.stringify(fullParsed);
            }

            const flatLikelihoods = choiceDelta.flat_likelihoods as
              | Record<string, number>
              | undefined;
            if (flatLikelihoods) {
              flattenedLikelihoods = {
                ...flattenedLikelihoods,
                ...flatLikelihoods,
              };
            }
          }
        });
      } else if (delta) {
        const deletedKeys = delta.flat_deleted_keys as string[] | undefined;
        if (deletedKeys) {
          deletedKeys.forEach((key: string) => {
            delete flattenedParsed[key];
            delete flattenedLikelihoods[key];
          });
        }

        const flatParsed = delta.flat_parsed as
          | Record<string, unknown>
          | undefined;
        if (flatParsed) {
          flattenedParsed = { ...flattenedParsed, ...flatParsed };
          finalOutput = unflattenDict(flattenedParsed) as Record<
            string,
            unknown
          >;
        }

        const contentDelta = delta.content;
        if (
          shouldParseContentDelta &&
          typeof contentDelta === "string" &&
          contentDelta.length > 0
        ) {
          streamedContent += contentDelta;
          const partialOutput = parseStreamedJsonObject(streamedContent);
          if (partialOutput) {
            finalOutput = partialOutput;
          }
        }

        const fullParsed = delta.full_parsed as
          | Record<string, unknown>
          | undefined;
        if (
          fullParsed &&
          typeof fullParsed === "object" &&
          !Array.isArray(fullParsed)
        ) {
          finalOutput = fullParsed;
          streamedContent = JSON.stringify(fullParsed);
        }

        const flatLikelihoods = delta.flat_likelihoods as
          | Record<string, number>
          | undefined;
        if (flatLikelihoods) {
          flattenedLikelihoods = {
            ...flattenedLikelihoods,
            ...flatLikelihoods,
          };
        }
      }

      const message = firstChoice?.message as
        | Record<string, unknown>
        | undefined;
      const fullParsed = message?.parsed as Record<string, unknown> | undefined;
      if (fullParsed && typeof fullParsed === "object") {
        finalOutput = fullParsed;
      }

      const topLevelLikelihoods = chunk.likelihoods;
      if (
        topLevelLikelihoods &&
        typeof topLevelLikelihoods === "object" &&
        !Array.isArray(topLevelLikelihoods)
      ) {
        explicitLikelihoods = topLevelLikelihoods as Record<string, unknown>;
      }

      const hasFlatLikelihoods = Object.keys(flattenedLikelihoods).length > 0;
      const likelihoods = hasFlatLikelihoods
        ? (unflattenDict(flattenedLikelihoods) as Record<string, unknown>)
        : explicitLikelihoods;

      const chunkConsensusDetails = buildConsensusChoicesFromChunk(
        choices,
        finalOutput,
      );
      if (chunkConsensusDetails.length > 0) {
        consensusDetails = chunkConsensusDetails;
      } else if (consensusFlatParsed.length > 1) {
        consensusDetails = consensusFlatParsed.map((flatChoice, index) => ({
          data:
            index === 0
              ? finalOutput
              : (unflattenDict(flatChoice) as Record<string, unknown>),
          index,
          likelihoods: {},
        }));
      }

      runExecutionOptions?.onProgress?.({
        output: finalOutput,
        iterationCount: iterationCount + 1,
        jsonSchema: schema as JSONSchema7,
        extractionId,
        likelihoods,
        consensusDetails,
        nConsensus,
      } as ExtractOutputState);
    }

    setIterationCount((prev) => prev + 1);
    toast.success("Extraction completed!");

    return {
      output: finalOutput,
      iterationCount: iterationCount + 1,
      jsonSchema: schema as JSONSchema7,
      extractionId,
      likelihoods:
        Object.keys(flattenedLikelihoods).length > 0
          ? (unflattenDict(flattenedLikelihoods) as Record<string, unknown>)
          : explicitLikelihoods,
      consensusDetails,
      nConsensus,
    } as ExtractOutputState;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Extract Playground Canvas (standalone, no dialog)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExtractPlaygroundCanvasProps {
  config: ExtractConfig;
  onConfigChange?: (config: Record<string, unknown>) => void;
  className?: string;
  canvasId?: string;
  headerSlot?: ReactNode;
  initialInputStates?: Partial<InputState>[];
  initialResult?: ExtractOutputState;
  // Workflow context (optional)
  blockId?: string;
  workflowId?: string;
  workflow?: Workflow;
  // Options
  supportsLoadFromRun?: boolean;
  defaultDpi?: number;
  // Schema state management (for external control)
  jsonSchema?: ExtendedJSONSchema7;
  onSchemaChange?: (schema: ExtendedJSONSchema7) => void;
  // Custom run handler (allows wrapping the default handler)
  onRun?: (
    inputStates: InputState[],
    cfg: Record<string, unknown>,
    runExecutionOptions?: RunExecutionOptions,
  ) => Promise<ExtractOutputState>;
  // Result panel rendering mode
  result_viewer_mode?: ExtractResultViewerMode;
  // Current file tracking (for schema generation)
  currentFile?: { buffer: ArrayBuffer; name: string; type: string } | null;
  onCurrentFileChange?: (
    file: { buffer: ArrayBuffer; name: string; type: string } | null,
  ) => void;
  // Optional callback when input handle is clicked - return true to prevent default dialog
  onInputHandleClick?: (
    inputId: string,
    inputState: InputState,
  ) => boolean | void;
  // Callback when input state changes (e.g., when a file is uploaded)
  onInputStateChange?: (inputId: string, inputState: InputState) => void;
  // When set, hides the Run affordance (page-owned capability gate).
  runDisabledReason?: string | null;
}

export function ExtractPlaygroundCanvas({
  config,
  onConfigChange,
  className,
  canvasId = "extract-playground-canvas",
  headerSlot,
  initialInputStates,
  initialResult,
  blockId,
  workflowId,
  workflow,
  supportsLoadFromRun = false,
  defaultDpi = 192,
  jsonSchema: externalJsonSchema,
  onSchemaChange: externalOnSchemaChange,
  onRun: externalOnRun,
  result_viewer_mode = "default",
  currentFile,
  onCurrentFileChange,
  onInputHandleClick,
  onInputStateChange,
  runDisabledReason,
}: ExtractPlaygroundCanvasProps) {
  const persistExtractConfig = useExtractPlaygroundStore(
    (state) => state.setFromExtractConfig,
  );
  // Local state for schema
  const [internalJsonSchema, setInternalJsonSchema] =
    useState<ExtendedJSONSchema7>(
      externalJsonSchema ||
      (config.json_schema as ExtendedJSONSchema7) ||
      EMPTY_SCHEMA,
    );
  const [iterationCount, setIterationCount] = useState(0);

  // Use external or internal schema
  const jsonSchema = externalJsonSchema || internalJsonSchema;
  const setJsonSchema = externalOnSchemaChange || setInternalJsonSchema;

  const options: ExtractPlaygroundOptions = { supportsLoadFromRun, defaultDpi };
  const inputs = createExtractInputs(options);

  // Ref for programmatically opening the schema dialog from the floating panel
  const schemaDialogTriggerRef = useRef<(() => void) | null>(null);

  // Processing block sections
  const sections: ProcessingNodeSection[] = [
    {
      type: "custom",
      render: (cfg, onChange) => {
        const hasDocument = currentFile !== null;
        return (
          <ExtractSchemaSection
            jsonSchema={jsonSchema}
            onSchemaChange={(schema) => {
              setJsonSchema(schema);
              persistExtractConfig({ json_schema: schema });
              onChange({
                ...cfg,
                json_schema: schema as Record<string, unknown>,
              });
            }}
            hasDocument={hasDocument}
            fileBuffer={currentFile?.buffer || null}
            fileName={currentFile?.name || null}
            fileMimeType={currentFile?.type || "application/pdf"}
            model={(cfg.model as string) || "retab-small"}
            imageDpi={(cfg.image_resolution_dpi as number) || defaultDpi}
            openDialogRef={schemaDialogTriggerRef}
          />
        );
      },
    },
    {
      type: "custom",
      render: (cfg, onChange) => (
        <ExtractInferenceSettingsSection
          config={cfg as unknown as ExtractConfig}
          onConfigChange={(newConfig) => {
            persistExtractConfig(newConfig);
            onChange(newConfig as unknown as Record<string, unknown>);
          }}
        />
      ),
    },
  ];

  // Requirements calculation
  const getRequirements = useCallback(
    (
      inputStates: InputState[],
      cfg: Record<string, unknown>,
    ): RequirementItem[] => {
      return getExtractRequirements(inputStates, cfg, jsonSchema);
    },
    [jsonSchema],
  );

  // Run handler
  const defaultRunHandler = useMemo(
    () =>
      createExtractRunHandler(jsonSchema, iterationCount, setIterationCount),
    [jsonSchema, iterationCount],
  );

  const handleRun = useCallback(
    async (
      inputStates: InputState[],
      cfg: Record<string, unknown>,
      runExecutionOptions?: RunExecutionOptions,
    ) => {
      // Track file if callback provided
      const documentState = inputStates[0];
      if (
        onCurrentFileChange &&
        hasInputValue(documentState) &&
        documentState.fileBuffer
      ) {
        onCurrentFileChange({
          buffer: documentState.fileBuffer,
          name: documentState.fileName || "document",
          type: documentState.fileMimeType,
        });
      }

      if (externalOnRun) {
        return externalOnRun(inputStates, cfg, runExecutionOptions);
      }
      return defaultRunHandler(inputStates, cfg, runExecutionOptions);
    },
    [externalOnRun, defaultRunHandler, onCurrentFileChange],
  );

  return (
    <PlaygroundCanvas
      blockType="extract"
      title="Extract"
      description="Extract structured data"
      icon={Layers2}
      color="#8b5cf6"
      inputs={inputs}
      sections={sections}
      config={{
        ...config,
        json_schema: jsonSchema as Record<string, unknown>,
      }}
      onConfigChange={(newConfig) => {
        if (newConfig.json_schema) {
          setJsonSchema(newConfig.json_schema as ExtendedJSONSchema7);
        }
        persistExtractConfig(newConfig as Partial<ExtractConfig>);
        onConfigChange?.(newConfig);
      }}
      getRequirements={getRequirements}
      onRun={handleRun}
      renderOutput={(result, inputStates, isProcessing) => {
        const extractOutputRendererKey = getExtractOutputRendererKey(
          result,
          result_viewer_mode,
        );

        return (
          <ExtractOutputRendererContent
            key={extractOutputRendererKey}
            result={result}
            inputStates={inputStates}
            isProcessing={isProcessing}
            resultViewerMode={result_viewer_mode}
          />
        );
      }}
      runButtonLabel="Run Extract"
      runningLabel="Extracting..."
      className={className}
      canvasId={canvasId}
      headerSlot={headerSlot}
      initialInputStates={initialInputStates}
      initialResult={initialResult}
      blockId={blockId}
      workflowId={workflowId}
      workflow={workflow}
      onInputHandleClick={onInputHandleClick}
      onInputStateChange={onInputStateChange}
      runDisabledReason={runDisabledReason}
      onRequirementClick={(reqId) => {
        if (reqId === "schema") schemaDialogTriggerRef.current?.();
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Extract Execute Playground V2 (dialog version for workflow blocks)
// ═══════════════════════════════════════════════════════════════════════════════

export function ExtractBlockExecutionPlaygroundV2({
  open,
  onOpenChange,
  config,
  onConfigChange,
  blockId,
  workflowId,
  workflow,
  applyPersistedDefaults = false,
  runDisabledReason,
}: ExtractBlockExecutionPlaygroundProps) {
  const persistedConfig = useExtractPlaygroundStore((state) => state.config);
  const isPersistedStoreHydrated = useExtractPlaygroundStore(
    (state) => state.isHydrated,
  );
  const persistExtractConfig = useExtractPlaygroundStore(
    (state) => state.setFromExtractConfig,
  );
  const hasAppliedPersistedDefaultsRef = useRef(false);

  // Local state for schema (needed for schema section component)
  const [localJsonSchema, setLocalJsonSchema] = useState<ExtendedJSONSchema7>(
    (config.json_schema as ExtendedJSONSchema7) || EMPTY_SCHEMA,
  );
  const [iterationCount, setIterationCount] = useState(0);

  // Sync localJsonSchema from parent config when dialog opens
  // (component is always mounted, so useState initializer may be stale)
  const prevOpenRef = useRef(open);
  if (open && !prevOpenRef.current) {
    setLocalJsonSchema(
      (config.json_schema as ExtendedJSONSchema7) || EMPTY_SCHEMA,
    );
  }
  if (prevOpenRef.current !== open) {
    prevOpenRef.current = open;
  }

  if (
    applyPersistedDefaults &&
    isPersistedStoreHydrated &&
    !hasAppliedPersistedDefaultsRef.current
  ) {
    hasAppliedPersistedDefaultsRef.current = true;

    const hasPersistedInferenceOverrides =
      persistedConfig.model !==
      DEFAULT_EXTRACT_PLAYGROUND_PERSISTED_CONFIG.model ||
      persistedConfig.image_resolution_dpi !==
      DEFAULT_EXTRACT_PLAYGROUND_PERSISTED_CONFIG.image_resolution_dpi ||
      persistedConfig.n_consensus !==
      DEFAULT_EXTRACT_PLAYGROUND_PERSISTED_CONFIG.n_consensus;

    const hasPersistedSchema =
      countSchemaProperties(persistedConfig.json_schema) > 0;

    if (
      !isConfigUsingExtractDefaults(config) ||
      (!hasPersistedInferenceOverrides && !hasPersistedSchema)
    ) {
      // Nothing to adopt; keep the guard consumed so we do not revisit this
      // one-shot defaulting path on later rerenders.
    } else {
      const mergedConfig: ExtractConfig = {
        ...config,
        model: persistedConfig.model,
        image_resolution_dpi: persistedConfig.image_resolution_dpi,
        n_consensus: persistedConfig.n_consensus,
        json_schema: hasPersistedSchema
          ? (persistedConfig.json_schema as Record<string, unknown>)
          : (config.json_schema as Record<string, unknown>) ||
          (EMPTY_SCHEMA as Record<string, unknown>),
      };

      if (hasPersistedSchema) {
        setLocalJsonSchema(persistedConfig.json_schema);
      }

      onConfigChange?.(mergedConfig as unknown as Record<string, unknown>);
    }
  }

  // Get inputs from config - dynamically create them based on the block configuration
  const configInputs = config.inputs;
  const inputs = useMemo(() => {
    return createExtractInputsFromConfig(configInputs, {
      supportsLoadFromRun: true,
    });
  }, [configInputs]);

  // Processing block sections
  const sections: ProcessingNodeSection[] = [
    {
      type: "custom",
      render: (cfg, onChange) => {
        const documentState = {
          fileBuffer: null,
          fileName: null,
          fileMimeType: "application/pdf",
        };
        return (
          <ExtractSchemaSection
            jsonSchema={localJsonSchema}
            onSchemaChange={(schema) => {
              setLocalJsonSchema(schema);
              persistExtractConfig({ json_schema: schema });
              onChange({
                ...cfg,
                json_schema: schema as Record<string, unknown>,
              });
            }}
            hasDocument={false} // We'll update this from parent state
            fileBuffer={documentState.fileBuffer}
            fileName={documentState.fileName}
            fileMimeType={documentState.fileMimeType}
            model={(cfg.model as string) || "retab-small"}
            imageDpi={(cfg.image_resolution_dpi as number) || 192}
          />
        );
      },
    },
    {
      type: "custom",
      render: (cfg, onChange) => (
        <ExtractInferenceSettingsSection
          config={cfg as unknown as ExtractConfig}
          onConfigChange={(newConfig) => {
            persistExtractConfig(newConfig);
            onChange(newConfig as unknown as Record<string, unknown>);
          }}
        />
      ),
    },
  ];

  // Requirements calculation - pass configInputs for dynamic requirements
  const getRequirements = useCallback(
    (
      inputStates: InputState[],
      cfg: Record<string, unknown>,
    ): RequirementItem[] => {
      return getExtractRequirements(
        inputStates,
        cfg,
        localJsonSchema,
        configInputs,
      );
    },
    [localJsonSchema, configInputs],
  );

  // Run handler with streaming - pass configInputs for proper input handling
  const handleRun = useMemo(
    () =>
      createExtractRunHandler(
        localJsonSchema,
        iterationCount,
        setIterationCount,
        configInputs,
      ),
    [localJsonSchema, iterationCount, configInputs],
  );

  return (
    <ExecutePlayground
      open={open}
      onOpenChange={onOpenChange}
      blockType="extract"
      title="Extract"
      description="Extract structured data"
      icon={Layers2}
      color="#8b5cf6"
      inputs={inputs}
      sections={sections}
      config={{
        ...config,
        json_schema: localJsonSchema as Record<string, unknown>,
      }}
      onConfigChange={(newConfig) => {
        if (newConfig.json_schema) {
          setLocalJsonSchema(newConfig.json_schema as ExtendedJSONSchema7);
        }
        persistExtractConfig(newConfig as Partial<ExtractConfig>);
        onConfigChange?.(newConfig);
      }}
      getRequirements={getRequirements}
      onRun={handleRun}
      renderOutput={ExtractOutputRenderer}
      runButtonLabel="Run Extract"
      runningLabel="Extracting..."
      blockId={blockId}
      workflowId={workflowId}
      workflow={workflow}
      runDisabledReason={runDisabledReason}
    />
  );
}
