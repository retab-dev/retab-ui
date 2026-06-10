"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useMemo, useRef } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import { toast } from "sonner";
import { Loader2, Code, History, BookOpen, Workflow } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { isEqual } from "lodash";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DashboardLink } from "@/app/shared/environment/dashboard-link";
import { useDashboardEnvironmentHref } from "@/app/shared/environment/use-dashboard-environment-href";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useJsonSchema } from "@/app/dashboard/shared/schema-editor/contexts/json-schema";
import { apiClient } from "@/app/shared/api/client";
import { ExtendedJSONSchema7 } from "@/app/dashboard/widgets/types/json-schema";
import Marquee from "@/app/components/marquees/marquee-md";
import {
  DocumentExtractRequest,
  Extraction,
} from "@/app/dashboard/widgets/types/extract";
import { useExtraction } from "@/app/dashboard/widgets/queries/extractions";
import { HistoryDialog } from "@/app/dashboard/playground/extract/components/history-dialog";
import { useWorkflowCreateFromPlayground } from "@/app/dashboard/workflows/[workflowId]/shared/queries/workflows";
import { useWorkflowCreateTarget } from "@/app/dashboard/projects/queries";
import {
  useCanOrganization,
  useAuthorizationResources,
} from "@/app/dashboard/shared/authz/authorization-checks";
import { SubscriptionPopover } from "@/app/shared/subscription-popover";

import {
  InputState,
  RunExecutionOptions,
  hasInputValue,
} from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/execute-playground";

import type {
  ExtractConfig,
  ExtractOutputState,
} from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/extract-playground";
import { useExtractPlaygroundStore } from "@/app/dashboard/workflows/[workflowId]/shared/stores/extract-playground-store";
import FilePreview from "@/app/dashboard/widgets/components/file-component/file-preview";

const CodeSection = dynamic(
  () => import("@/app/dashboard/playground/extract/components/code-section"),
);

const ExtractPlaygroundCanvas = dynamic(
  () =>
    import(
      "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/extract-playground"
    ).then((playgroundModule) => playgroundModule.ExtractPlaygroundCanvas),
  {
    loading: () => (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    ),
  },
);

function logExtractFlow(event: string, details: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
    return;
  }
  console.info(`[extract-flow] ${event}`, details);
}

type ExtractPlaygroundCurrentFile = {
  buffer: ArrayBuffer;
  name: string;
  type: string;
};

type ExtractPlaygroundSession = {
  key: string;
  iterationCount: number;
  currentFile: ExtractPlaygroundCurrentFile | null;
  initialInputStates?: Partial<InputState>[];
  initialResult?: ExtractOutputState;
};

const INITIAL_EXTRACT_PLAYGROUND_SESSION: ExtractPlaygroundSession = {
  key: "initial",
  iterationCount: 0,
  currentFile: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Extract Playground Page
// ═══════════════════════════════════════════════════════════════════════════════

export function ExtractPageContent() {
  const isPersistedStoreHydrated = useExtractPlaygroundStore(
    (state) => state.isHydrated,
  );
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  logExtractFlow("ExtractPageContent render", {
    renderCount: renderCountRef.current,
    isPersistedStoreHydrated,
  });
  if (!isPersistedStoreHydrated) return null;
  return <ExtractPlaygroundPageInner />;
}

function ExtractPlaygroundPageInner() {
  const { jsonSchema, setJsonSchema } = useJsonSchema();
  const router = useRouter();
  const dashboardHref = useDashboardEnvironmentHref();
  const searchParams = useSearchParams();
  const createWorkflowMutation = useWorkflowCreateFromPlayground();
  // UI signaling: org RBAC capability for running the extract primitive.
  const canRunExtract = useCanOrganization("rbac:primitive:extract");
  // "Open in Workflow" creates a workflow under a project. No concrete project
  // id is known here, so gate by whether ANY project grants workflow:create.
  const authorizedWorkflowProjectsQuery = useAuthorizationResources({
    resource_type: "project",
    permission: "workflow:create",
    parent: { type: "organization" },
  });
  // Resolve the required target project for the workflow create. The backend
  // now rejects creates without `project_id` (422), so fail closed when none.
  const { targetProjectId } = useWorkflowCreateTarget();
  const canCreateWorkflow =
    (authorizedWorkflowProjectsQuery.data?.resource_ids.length ?? 0) > 0 &&
    targetProjectId !== null;
  const persistedExtractConfig = useExtractPlaygroundStore(
    (state) => state.config,
  );
  const persistExtractConfig = useExtractPlaygroundStore(
    (state) => state.setFromExtractConfig,
  );
  const persistExtractSchema = useExtractPlaygroundStore(
    (state) => state.setJsonSchema,
  );
  const extractionIdFromParams = searchParams?.get("extraction_id") ?? null;
  const loadedUrlExtractionIdRef = useRef<string | null>(null);
  const historySelectionRequestRef = useRef(0);
  const innerRenderCountRef = useRef(0);

  // State — initialized from hydrated persisted store
  const [config, setConfig] = useState<ExtractConfig>(() => ({
    model: persistedExtractConfig.model,
    image_resolution_dpi: persistedExtractConfig.image_resolution_dpi,
    n_consensus: persistedExtractConfig.n_consensus,
    json_schema: persistedExtractConfig.json_schema as Record<string, unknown>,
  }));
  const configRef = useRef(config);
  configRef.current = config;

  const [playgroundSession, setPlaygroundSession] =
    useState<ExtractPlaygroundSession>(INITIAL_EXTRACT_PLAYGROUND_SESSION);
  const setIterationCount = useCallback((fn: (prev: number) => number) => {
    setPlaygroundSession((prev) => ({
      ...prev,
      iterationCount: fn(prev.iterationCount),
    }));
  }, []);

  // Sync context jsonSchema → initial once on mount (store is hydrated here)
  useMountEffect(() => {
    logExtractFlow("persisted schema mount sync", {
      persistedSchemaFieldCount: Object.keys(
        persistedExtractConfig.json_schema?.properties || {},
      ).length,
    });
    setJsonSchema(persistedExtractConfig.json_schema, true);
  });

  // Dialog state
  const [showCodeSection, setShowCodeSection] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  // Open in workflow state
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);

  // Intro dialog state
  const [showIntroDialog, setShowIntroDialog] = useState(false);

  // Preview dialog state
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewState, setPreviewState] = useState<InputState | null>(null);

  // Check if schema has fields defined — prefer live context schema over persisted config copy
  const effectiveSchema = (jsonSchema ??
    config.json_schema) as ExtendedJSONSchema7;
  const schemaFieldCount = Object.keys(
    effectiveSchema?.properties || {},
  ).length;
  const hasSchema = schemaFieldCount > 0;
  innerRenderCountRef.current += 1;
  logExtractFlow("ExtractPlaygroundPageInner render", {
    renderCount: innerRenderCountRef.current,
    extractionIdFromParams,
    loadedUrlExtractionId: loadedUrlExtractionIdRef.current,
    iterationCount: playgroundSession.iterationCount,
    schemaFieldCount,
    hasInitialInputStates: Boolean(playgroundSession.initialInputStates),
    hasInitialResult: Boolean(playgroundSession.initialResult),
    currentFileName: playgroundSession.currentFile?.name ?? null,
    showHistoryDialog,
  });

  // Persist config in the same event that changes it instead of mirroring via useEffect.
  const setConfigAndPersist = useCallback(
    (updater: ExtractConfig | ((prev: ExtractConfig) => ExtractConfig)) => {
      const previousConfig = configRef.current;
      const nextConfig =
        typeof updater === "function" ? updater(previousConfig) : updater;

      if (isEqual(previousConfig, nextConfig)) {
        return previousConfig;
      }

      configRef.current = nextConfig;
      persistExtractConfig(nextConfig);
      setConfig(nextConfig);
      return nextConfig;
    },
    [persistExtractConfig],
  );

  // Config change handler
  const handleConfigChange = useCallback(
    (newConfig: Record<string, unknown>) => {
      setConfigAndPersist((prev) => {
        const nextConfig = {
          ...prev,
          ...newConfig,
        };

        if (isEqual(prev, nextConfig)) {
          return prev;
        }

        return nextConfig;
      });
      // Sync schema to context
      if (newConfig.json_schema) {
        const nextSchema = newConfig.json_schema as ExtendedJSONSchema7;
        if (!isEqual(jsonSchema, nextSchema)) {
          setJsonSchema(nextSchema, true);
        }
      }
    },
    [jsonSchema, setConfigAndPersist, setJsonSchema],
  );

  // History dialog handler
  const handleShowHistoryDialog = useCallback(() => {
    setShowHistoryDialog(true);
  }, []);

  const handleHistoryDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setShowHistoryDialog(false);
    }
  }, []);

  // History selection handler
  const handleHistorySelection = useCallback(
    async (extraction: Extraction) => {
      const requestId = historySelectionRequestRef.current + 1;
      historySelectionRequestRef.current = requestId;
      logExtractFlow("history selection start", {
        extractionId: extraction.id,
        requestId,
        hasOutput: Boolean(extraction.output),
        outputKeyCount:
          extraction.output &&
          typeof extraction.output === "object" &&
          !Array.isArray(extraction.output)
            ? Object.keys(extraction.output as Record<string, unknown>).length
            : 0,
        hasSchema: Boolean(extraction.json_schema),
        schemaFieldCount: Object.keys(
          (extraction.json_schema as ExtendedJSONSchema7 | undefined)
            ?.properties || {},
        ).length,
        hasFile: Boolean(extraction.file?.id),
        fileId: extraction.file?.id ?? null,
        iterationCount: playgroundSession.iterationCount,
      });
      const nextIterationCount = playgroundSession.iterationCount + 1;
      const result = extraction.output
        ? {
            output: extraction.output as Record<string, unknown>,
            iterationCount: nextIterationCount,
            jsonSchema: extraction.json_schema as any,
            extractionId: extraction.id,
          }
        : undefined;
      if (result) {
        logExtractFlow("history selection set initial result", {
          extractionId: extraction.id,
          nextIterationCount,
        });
      }
      const selectedModel = extraction.model;

      let nextCurrentFile: ExtractPlaygroundCurrentFile | null = null;
      let nextInitialInputStates: Partial<InputState>[] | undefined;
      let successMessage = "Extraction loaded from history";

      // Try to load file
      if (extraction.file?.id) {
        try {
          logExtractFlow("history selection request file download link", {
            extractionId: extraction.id,
            fileId: extraction.file.id,
          });
          const { data: link, response: linkResponse } = await apiClient.GET(
            "/v1/files/{file_id}/download-link",
            { params: { path: { file_id: extraction.file.id } } },
          );
          logExtractFlow("history selection download link response", {
            extractionId: extraction.id,
            fileId: extraction.file.id,
            ok: linkResponse.ok,
            status: linkResponse.status,
          });
          if (linkResponse.ok && link) {
            const fileResponse = await fetch(link.download_url);
            logExtractFlow("history selection file response", {
              extractionId: extraction.id,
              fileId: extraction.file.id,
              ok: fileResponse.ok,
              status: fileResponse.status,
            });
            if (fileResponse.ok) {
              const buffer = await fileResponse.arrayBuffer();
              const mimeType = extraction.file.mime_type || "application/pdf";
              const filename = extraction.file.filename || "document";

              nextCurrentFile = {
                buffer,
                name: filename,
                type: mimeType,
              };

              const inputState = {
                id: "document",
                type: "file" as const,
                fileBuffer: buffer,
                fileName: filename,
                fileMimeType: mimeType,
                textValue: "",
              };
              nextInitialInputStates = [inputState];
              logExtractFlow("history selection set file input", {
                extractionId: extraction.id,
                filename,
                mimeType,
                byteLength: buffer.byteLength,
              });

              successMessage = "Extraction and file loaded from history";
            } else {
              successMessage =
                "Extraction loaded from history (file no longer available)";
            }
          } else {
            successMessage =
              "Extraction loaded from history (file no longer available)";
          }
        } catch (error) {
          logExtractFlow("history selection file load failed", {
            extractionId: extraction.id,
            message: error instanceof Error ? error.message : String(error),
          });
          console.error("Error loading file:", error);
          successMessage =
            "Extraction loaded from history (file could not be retrieved)";
        }
      }

      if (historySelectionRequestRef.current !== requestId) {
        logExtractFlow("history selection skipped stale request", {
          extractionId: extraction.id,
          requestId,
          latestRequestId: historySelectionRequestRef.current,
        });
        return;
      }

      if (extraction.json_schema) {
        logExtractFlow("history selection apply schema", {
          extractionId: extraction.id,
          requestId,
          schemaFieldCount: Object.keys(
            (extraction.json_schema as ExtendedJSONSchema7).properties || {},
          ).length,
        });
        setJsonSchema(extraction.json_schema);
        persistExtractSchema(extraction.json_schema as ExtendedJSONSchema7);
      }

      logExtractFlow("history selection apply config", {
        extractionId: extraction.id,
        requestId,
        selectedModel,
        imageResolutionDpi: extraction.image_resolution_dpi ?? null,
        nConsensus: extraction.n_consensus ?? null,
      });
      setConfigAndPersist((prev) => ({
        ...prev,
        ...(selectedModel ? { model: selectedModel } : {}),
        image_resolution_dpi:
          extraction.image_resolution_dpi ?? prev.image_resolution_dpi,
        n_consensus: extraction.n_consensus ?? prev.n_consensus,
      }));

      setPlaygroundSession({
        key: [
          "history",
          extraction.id,
          nextIterationCount,
          nextInitialInputStates ? "file" : "no-file",
        ].join(":"),
        iterationCount: nextIterationCount,
        currentFile: nextCurrentFile,
        initialInputStates: nextInitialInputStates,
        initialResult: result,
      });
      toast.success(successMessage);
    },
    [
      setConfigAndPersist,
      setJsonSchema,
      persistExtractSchema,
      playgroundSession.iterationCount,
    ],
  );

  const handleUrlExtractionLoad = useCallback(
    async (extraction: Extraction) => {
      logExtractFlow("url extraction load requested", {
        extractionId: extraction.id,
        alreadyLoadedId: loadedUrlExtractionIdRef.current,
      });
      if (loadedUrlExtractionIdRef.current === extraction.id) {
        logExtractFlow("url extraction load skipped duplicate", {
          extractionId: extraction.id,
        });
        return;
      }
      loadedUrlExtractionIdRef.current = extraction.id;
      await handleHistorySelection(extraction);
    },
    [handleHistorySelection],
  );

  // Open in workflow handler
  const handleOpenInWorkflow = useCallback(async () => {
    // Fail-closed guard: never create a workflow without workflow:create on a
    // project, even if a stale event reaches this handler.
    if (!canCreateWorkflow) {
      return;
    }
    // Narrow the required target project id for the create request below.
    if (!targetProjectId) {
      return;
    }

    const currentSchema = jsonSchema || config.json_schema;

    if (
      !currentSchema ||
      !(currentSchema as ExtendedJSONSchema7).properties ||
      Object.keys((currentSchema as ExtendedJSONSchema7).properties || {})
        .length === 0
    ) {
      toast.error(
        "Please define a schema with properties before opening in a workflow",
      );
      return;
    }

    setIsCreatingWorkflow(true);

    try {
      const timestamp = Date.now();
      const startBlockId = "start";
      const extractBlockId = `extract-${timestamp}`;

      const newWorkflow = await createWorkflowMutation.mutateAsync({
        name: playgroundSession.currentFile
          ? playgroundSession.currentFile.name.replace(/\.[^/.]+$/, "")
          : "Untitled Workflow",
        description: "",
        project_id: targetProjectId,
        draft_config: {
          blocks: [
            {
              id: startBlockId,
              type: "start_document",
              position: { x: 50, y: 200 },
              label: "Document",
            },
            {
              id: extractBlockId,
              type: "extract",
              position: { x: 400, y: 200 },
              label: "Extract",
              config: {
                model: config.model || "retab-small",
                image_resolution_dpi: config.image_resolution_dpi ?? 192,
                n_consensus: config.n_consensus ?? 1,
                reasoning_effort: config.reasoning_effort || "minimal",
                json_schema: currentSchema,
                inputs: [{ name: "document", type: "file" }],
              },
            },
          ],
          edges: [
            {
              id: `edge-${timestamp}`,
              source: startBlockId,
              target: extractBlockId,
              source_handle: "output-file-0",
              target_handle: "input-file-document",
              animated: true,
            },
          ],
        },
      });

      toast.success("Workflow created successfully");
      router.push(dashboardHref(`/dashboard/workflows/${newWorkflow.id}`));
    } catch (error: unknown) {
      console.error("Error creating workflow:", error);
      toast.error((error as Error).message || "Failed to create workflow");
    } finally {
      setIsCreatingWorkflow(false);
    }
  }, [
    canCreateWorkflow,
    targetProjectId,
    jsonSchema,
    config,
    playgroundSession.currentFile,
    createWorkflowMutation,
    dashboardHref,
    router,
  ]);

  // Code section config values
  const configValues: DocumentExtractRequest = {
    model: config.model,
    image_resolution_dpi: config.image_resolution_dpi,
    n_consensus: config.n_consensus ?? 1,
    json_schema: config.json_schema ?? {},
    document: {
      url: "",
      filename: "",
    },
    stream: false,
    metadata: {},
    extraction_id: undefined,
    additional_messages: undefined,
  };

  // Show intro dialog on first visit
  useMountEffect(() => {
    try {
      const seen =
        typeof window !== "undefined"
          ? window.localStorage.getItem("workflow_extract_intro_seen")
          : "true";
      if (!seen) {
        setShowIntroDialog(true);
      }
    } catch {
      setShowIntroDialog(true);
    }
  });

  // Handler to acknowledge intro dialog
  const handleAcknowledgeIntro = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("workflow_extract_intro_seen", "true");
      }
    } catch {}
    setShowIntroDialog(false);
  }, []);

  // Handler to open docs
  const handleOpenDocs = useCallback(() => {
    try {
      window.open(
        "https://docs.retab.com/core-concepts/Extract",
        "_blank",
        "noopener,noreferrer",
      );
    } catch {}
  }, []);

  // Handler for input handle click - shows preview dialog
  const handleInputHandleClick = useCallback(
    (inputId: string, inputState: InputState): boolean => {
      if (inputState.type === "file" && inputState.fileBuffer) {
        setPreviewState(inputState);
        setShowPreviewDialog(true);
        return true; // Prevent default dialog
      }
      return false;
    },
    [],
  );

  // Handler for input state changes - updates currentFile when a file is uploaded
  const handleInputStateChange = useCallback(
    (inputId: string, inputState: InputState) => {
      if (inputState.type === "file") {
        if (inputState.fileBuffer) {
          const currentFile = {
            buffer: inputState.fileBuffer,
            name: inputState.fileName || "document",
            type: inputState.fileMimeType,
          };
          setPlaygroundSession((prev) => ({ ...prev, currentFile }));
        } else {
          setPlaygroundSession((prev) => ({ ...prev, currentFile: null }));
        }
      }
    },
    [],
  );

  const handleCurrentFileChange = useCallback(
    (currentFile: ExtractPlaygroundCurrentFile | null) => {
      setPlaygroundSession((prev) => ({
        ...prev,
        currentFile,
      }));
    },
    [],
  );

  // Custom run handler that tracks the current file and iteration
  const handleRun = useCallback(
    async (
      inputStates: InputState[],
      cfg: Record<string, unknown>,
      runExecutionOptions?: RunExecutionOptions,
    ) => {
      // Fail-closed guard: never run the extract primitive without the org
      // RBAC capability. UI signaling hides the affordance; this backstops any
      // direct/imperative path to the run handler. Throwing (rather than
      // returning) keeps the canvas onRun result type and surfaces the denial.
      if (!canRunExtract) {
        throw new Error("You do not have permission to run extractions");
      }

      const documentState = inputStates[0];
      if (hasInputValue(documentState) && documentState.fileBuffer) {
        const currentFile = {
          buffer: documentState.fileBuffer,
          name: documentState.fileName || "document",
          type: documentState.fileMimeType,
        };
        setPlaygroundSession((prev) => ({ ...prev, currentFile }));
      }

      // Use the shared run handler
      const { createExtractRunHandler } = await import(
        "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/extract-playground"
      );
      const runHandler = createExtractRunHandler(
        (cfg.json_schema as ExtendedJSONSchema7) ||
          (config.json_schema as ExtendedJSONSchema7) || {
            type: "object",
            properties: {},
          },
        playgroundSession.iterationCount,
        setIterationCount,
      );
      return await runHandler(inputStates, cfg, runExecutionOptions);
    },
    [
      canRunExtract,
      config.json_schema,
      playgroundSession.iterationCount,
      setIterationCount,
    ],
  );

  // Header slot for the canvas
  const headerSlot = useMemo(
    () => (
      <div className="mx-4 -mt-[44px] flex flex-row items-center justify-between border-b border-gray-200 pt-[10px] pb-[11px]">
        <div className="ml-auto flex flex-row items-center gap-2">
          {canCreateWorkflow && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleOpenInWorkflow}
              disabled={isCreatingWorkflow || !hasSchema}
              className="text-muted-foreground relative rounded-full text-xs transition-all duration-200 hover:bg-gray-50 hover:text-gray-700"
            >
              {isCreatingWorkflow ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Workflow className="h-4 w-4" />
              )}
              {isCreatingWorkflow ? "Creating..." : "Open in Workflow"}
            </Button>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground relative rounded-full text-xs transition-all duration-200 hover:bg-gray-50 hover:text-gray-700"
                  onClick={handleShowHistoryDialog}
                >
                  <History className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View history</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleOpenDocs}
            className="text-muted-foreground relative rounded-full text-xs transition-all duration-200 hover:bg-gray-50 hover:text-gray-700"
          >
            <BookOpen className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowCodeSection(true)}
            className={cn(
              "relative rounded-full text-xs transition-all duration-200 hover:bg-gray-50 hover:text-gray-700",
              showCodeSection
                ? "bg-gray-100 text-gray-700"
                : "text-muted-foreground",
            )}
          >
            <Code className="mr-2 h-4 w-4" />
            Code
          </Button>
          <SubscriptionPopover />
        </div>
      </div>
    ),
    [
      canCreateWorkflow,
      handleOpenInWorkflow,
      isCreatingWorkflow,
      hasSchema,
      handleShowHistoryDialog,
      handleOpenDocs,
      showCodeSection,
    ],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-visible">
      {/* Code section overlay */}
      <AnimatePresence>
        {showCodeSection && (
          <CodeSection
            currentSchema={jsonSchema || config.json_schema}
            configValues={configValues}
            onClose={() => setShowCodeSection(false)}
          />
        )}
      </AnimatePresence>

      {/* History dialog */}
      <HistoryDialog
        open={showHistoryDialog}
        onOpenChange={handleHistoryDialogOpenChange}
        onSelectExtraction={handleHistorySelection}
      />

      {/* URL-driven extraction loader (remounts on id change) */}
      {extractionIdFromParams && (
        <ExtractionUrlLoader
          key={extractionIdFromParams}
          extractionId={extractionIdFromParams}
          onLoad={handleUrlExtractionLoad}
        />
      )}

      {/* Introduction Dialog */}
      <Dialog open={showIntroDialog} onOpenChange={setShowIntroDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-none shadow-2xl sm:max-w-3xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-light tracking-tight text-slate-900 uppercase">
              Extract
            </DialogTitle>
            <DialogDescription className="sr-only">
              Upload a document to preview the extracted structured data.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-8">
            <Marquee codeFormat="json" />

            <div className="space-y-4 text-sm text-slate-700">
              <p className="mb-2 text-2xl font-normal text-slate-800">
                Turn any document into structured data.
              </p>
              <p>
                Use our extract API to turn any document into structured data.
                Iterate on your schema to get the best results.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>Upload an image or PDF</li>
                <li>Define or tweak your JSON Schema.</li>
                <li>Pick model and options, then Run</li>
              </ul>
              <p className="text-sm text-slate-500">
                For evals and production deployments, check out{" "}
                <DashboardLink
                  className="text-gray-800 underline"
                  href="/dashboard"
                >
                  projects
                </DashboardLink>
                .
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleOpenDocs}>
              Learn more
            </Button>
            <Button
              className="group before:transtion-opacity relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-md bg-gray-900 text-left font-medium text-white shadow-[0_1px_theme(colors.white/0.07)_inset,0_1px_3px_theme(colors.gray.900/0.2)] ring-1 ring-gray-900 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-md before:bg-gradient-to-b before:from-white/20 before:opacity-50 before:duration-300 before:ease-[cubic-bezier(0.4,0.36,0,1)] after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-md after:bg-gradient-to-b after:from-white/10 after:from-[46%] after:to-[54%] after:mix-blend-overlay hover:bg-gray-900 hover:opacity-80 hover:before:opacity-100"
              onClick={handleAcknowledgeIntro}
            >
              Get started
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="-mx-4 flex min-h-0 flex-1">
        <ExtractPlaygroundCanvas
          key={playgroundSession.key}
          config={config}
          onConfigChange={handleConfigChange}
          result_viewer_mode="extraction_component"
          canvasId="extract-playground-canvas"
          headerSlot={headerSlot}
          initialInputStates={playgroundSession.initialInputStates}
          initialResult={playgroundSession.initialResult}
          supportsLoadFromRun={false}
          defaultDpi={150}
          jsonSchema={(jsonSchema || config.json_schema) as ExtendedJSONSchema7}
          onSchemaChange={(schema) => {
            persistExtractSchema(schema);
            setJsonSchema(schema, true);
            setConfigAndPersist((prev) => ({
              ...prev,
              json_schema: schema as Record<string, unknown>,
            }));
          }}
          currentFile={playgroundSession.currentFile}
          onCurrentFileChange={handleCurrentFileChange}
          onRun={handleRun}
          runDisabledReason={
            canRunExtract ? null : "You don't have permission to run extract"
          }
          onInputHandleClick={handleInputHandleClick}
          onInputStateChange={handleInputStateChange}
        />
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-h-[90vh] sm:max-w-4xl">
          <div className="p-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Document Preview</h3>
                <p className="text-sm text-gray-500">
                  {previewState?.fileName || "Document"}
                </p>
              </div>
              <div className="h-[600px] overflow-hidden rounded-lg">
                {previewState?.fileBuffer && (
                  <FilePreview
                    content={previewState.fileBuffer}
                    mimeType={previewState.fileMimeType}
                  />
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Loads an extraction from the URL once per id via remount (key).
function ExtractionUrlLoader({
  extractionId,
  onLoad,
}: {
  extractionId: string;
  onLoad: (extraction: Extraction) => Promise<void>;
}) {
  const query = useExtraction(extractionId);
  logExtractFlow("ExtractionUrlLoader render", {
    extractionId,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetched: query.isFetched,
    isError: query.isError,
    hasData: Boolean(query.data),
  });
  if (query.isError || (query.isFetched && !query.data)) {
    return <ExtractionUrlLoadErrorToast />;
  }
  if (!query.data) return null;
  return <ExtractionUrlLoadBridge data={query.data} onLoad={onLoad} />;
}

function ExtractionUrlLoadErrorToast() {
  useMountEffect(() => {
    toast.error("Failed to load extraction from URL");
  });
  return null;
}

function ExtractionUrlLoadBridge({
  data,
  onLoad,
}: {
  data: Extraction;
  onLoad: (extraction: Extraction) => Promise<void>;
}) {
  useMountEffect(() => {
    logExtractFlow("ExtractionUrlLoadBridge mount", {
      extractionId: data.id,
    });
    void onLoad(data);
  });
  return null;
}
