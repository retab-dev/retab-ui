"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useRef } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Code, Tags, History, BookOpen, Workflow } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { apiClient } from "@/app/shared/api/client";
import { Category } from "@/app/dashboard/widgets/types/classify";
import { useClassification } from "@/app/dashboard/widgets/queries/classifications";
import MarqueeClassify from "@/app/components/marquees/marquee-classify";
import { useWorkflowCreateFromPlayground } from "@/app/dashboard/workflows/[workflowId]/shared/queries/workflows";
import { useWorkflowCreateTarget } from "@/app/dashboard/projects/queries";
import {
  useCanOrganization,
  useAuthorizationResources,
} from "@/app/dashboard/shared/authz/authorization-checks";
import { SubscriptionPopover } from "@/app/shared/subscription-popover";
import { FeatureFlag } from "@/app/shared/constants/feature-flag";
import {
  InputState,
  hasInputValue,
  InputType,
} from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/execute-playground";
import { ClassifyHistoryDialog } from "./components/history-dialog";

import type { ClassifierConfig } from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/classifier-playground";
import type { Classification } from "@/types";
import { useDashboardEnvironmentHref } from "@/app/shared/environment/use-dashboard-environment-href";

const CodeSection = dynamic(() => import("./components/code-section"));

const ClassifierPlaygroundCanvas = dynamic(
  () =>
    import(
      "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/classifier-playground"
    ).then((playgroundModule) => playgroundModule.ClassifierPlaygroundCanvas),
  {
    loading: () => (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    ),
  },
);

type ClassifyPlaygroundCurrentFile = {
  buffer: ArrayBuffer;
  name: string;
  type: string;
};

type ClassifyPlaygroundSession = {
  key: string;
  currentFile: ClassifyPlaygroundCurrentFile | null;
  initialInputStates?: Partial<InputState>[];
  initialResult?: Record<string, unknown>;
};

const INITIAL_CLASSIFY_PLAYGROUND_SESSION: ClassifyPlaygroundSession = {
  key: "initial",
  currentFile: null,
};

function ClassificationUrlLoader({
  classificationId,
  onLoad,
}: {
  classificationId: string;
  onLoad: (classification: Classification) => Promise<void>;
}) {
  const query = useClassification(classificationId);
  if (query.isError || (query.isFetched && !query.data)) {
    return <ClassificationUrlLoadErrorToast />;
  }
  if (!query.data) return null;
  return <ClassificationUrlLoadBridge data={query.data} onLoad={onLoad} />;
}

function ClassificationUrlLoadErrorToast() {
  useMountEffect(() => {
    toast.error("Failed to load classification from URL");
  });
  return null;
}

function ClassificationUrlLoadBridge({
  data,
  onLoad,
}: {
  data: Classification;
  onLoad: (classification: Classification) => Promise<void>;
}) {
  useMountEffect(() => {
    void onLoad(data);
  });
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Classify Playground Page
// ═══════════════════════════════════════════════════════════════════════════════

export function ClassifyPageContent() {
  const router = useRouter();
  const dashboardHref = useDashboardEnvironmentHref();
  const searchParams = useSearchParams();
  const createWorkflowMutation = useWorkflowCreateFromPlayground();
  // UI signaling: org RBAC capability for running the classify primitive.
  const canRunClassify = useCanOrganization("rbac:primitive:classify");
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
  const classificationIdFromParams =
    searchParams?.get("classification_id") ?? null;
  const historySelectionRequestRef = useRef(0);

  // Config state
  const [config, setConfig] = useState<ClassifierConfig>({
    model: "retab-small",
    categories: [],
    first_n_pages: undefined,
    n_consensus: 1,
  });

  const [playgroundSession, setPlaygroundSession] =
    useState<ClassifyPlaygroundSession>(INITIAL_CLASSIFY_PLAYGROUND_SESSION);

  // Dialog state
  const [showCodeSection, setShowCodeSection] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  // Open in workflow state
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);

  // Welcome dialog state
  const [openWelcome, setOpenWelcome] = useState(false);

  // Check if categories are valid (only name is required)
  const validCategories = config.categories.filter((cat) => cat.name.trim());

  // First-time welcome dialog with TTL
  useMountEffect(() => {
    try {
      const STORAGE_KEY = "retab-workflow-classify-onboarding-v1";
      const TTL_MS = FeatureFlag ? 1000 * 60 : 1000 * 60 * 60 * 24 * 14; // 1m dev, 14d prod
      const raw = localStorage.getItem(STORAGE_KEY);
      const now = Date.now();
      let shouldOpen = true;
      if (raw) {
        const { lastSeenAt } = JSON.parse(raw);
        if (typeof lastSeenAt === "number" && lastSeenAt + TTL_MS > now) {
          shouldOpen = false;
        }
      }
      if (shouldOpen) {
        setOpenWelcome(true);
      }
    } catch {
      // no-op
    }
  });

  // Config change handler
  const handleConfigChange = useCallback(
    (newConfig: Record<string, unknown>) => {
      setConfig({
        model: (newConfig.model as string) || config.model,
        categories: (newConfig.categories as Category[]) || config.categories,
        first_n_pages: newConfig.first_n_pages as number | undefined,
        n_consensus:
          (newConfig.n_consensus as number) ?? config.n_consensus ?? 1,
      });
    },
    [config],
  );

  // History dialog handler
  const handleShowHistoryDialog = useCallback(() => {
    setShowHistoryDialog(true);
  }, []);

  // History selection handler
  const handleHistorySelection = useCallback(
    async (classification: Classification) => {
      const requestId = historySelectionRequestRef.current + 1;
      historySelectionRequestRef.current = requestId;
      const nextConfig: ClassifierConfig = {
        model: classification.model || "retab-small",
        categories: classification.categories || [],
        first_n_pages: undefined,
        n_consensus: classification.n_consensus ?? 1,
      };
      let nextCurrentFile: ClassifyPlaygroundCurrentFile | null = null;
      let nextInitialInputStates: Partial<InputState>[] | undefined;
      const nextInitialResult = classification as unknown as Record<
        string,
        unknown
      >;
      let successMessage = "Settings loaded from history";

      // Try to load file
      if (classification.file?.id) {
        try {
          const { data: link, response: linkResponse } = await apiClient.GET(
            "/v1/files/{file_id}/download-link",
            { params: { path: { file_id: classification.file.id } } },
          );
          if (linkResponse.ok && link) {
            const fileResponse = await fetch(link.download_url);
            if (fileResponse.ok) {
              const buffer = await fileResponse.arrayBuffer();
              const mimeType =
                classification.file.mime_type || "application/pdf";
              const fileName = classification.file.filename || "document";

              nextCurrentFile = {
                buffer,
                name: fileName,
                type: mimeType,
              };

              nextInitialInputStates = [
                {
                  id: "document",
                  type: "file" as InputType,
                  fileBuffer: buffer,
                  fileName: fileName,
                  fileMimeType: mimeType,
                  textValue: "",
                },
              ];
              successMessage = "Classification loaded from history";
            } else {
              successMessage = "Settings loaded (file no longer available)";
            }
          } else {
            successMessage = "Settings loaded (file no longer available)";
          }
        } catch (error) {
          console.error("Error loading file:", error);
          successMessage = "Settings loaded (file could not be retrieved)";
        }
      }

      if (historySelectionRequestRef.current !== requestId) return;

      setConfig(nextConfig);
      setPlaygroundSession({
        key: `history:${classification.id}:${requestId}`,
        currentFile: nextCurrentFile,
        initialInputStates: nextInitialInputStates,
        initialResult: nextInitialResult,
      });
      toast.success(successMessage);
      setShowHistoryDialog(false);
    },
    [],
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

    if (validCategories.length === 0) {
      toast.error(
        "Please define at least one category before opening in a workflow",
      );
      return;
    }

    setIsCreatingWorkflow(true);

    try {
      const timestamp = Date.now();
      const startBlockId = "start";
      const classifyBlockId = `classifier-${timestamp}`;

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
              id: classifyBlockId,
              type: "classifier",
              position: { x: 400, y: 200 },
              label: "Classify",
              config: {
                model: config.model || "retab-small",
                categories: validCategories.map((cat) => ({
                  name: cat.name,
                  description: cat.description || "",
                })),
                ...(config.first_n_pages
                  ? { first_n_pages: config.first_n_pages }
                  : {}),
              },
            },
          ],
          edges: [
            {
              id: `edge-${timestamp}`,
              source: startBlockId,
              target: classifyBlockId,
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
    config,
    validCategories,
    playgroundSession.currentFile,
    createWorkflowMutation,
    dashboardHref,
    router,
  ]);

  // Custom run handler that tracks the current file
  const handleRun = useCallback(
    async (inputStates: InputState[], cfg: Record<string, unknown>) => {
      // Fail-closed guard: never run the classify primitive without the org
      // RBAC capability. Backstops any direct/imperative path to the handler.
      // Throwing keeps the canvas onRun result type and surfaces the denial.
      if (!canRunClassify) {
        throw new Error("You do not have permission to run classifications");
      }

      const documentState = inputStates[0];
      if (hasInputValue(documentState) && documentState.fileBuffer) {
        const fileBuffer = documentState.fileBuffer;
        setPlaygroundSession((previousSession) => ({
          ...previousSession,
          currentFile: {
            buffer: fileBuffer,
            name: documentState.fileName || "document",
            type: documentState.fileMimeType,
          },
        }));
      }
      // Use the shared run handler
      const { createClassifierRunHandler } = await import(
        "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/classifier-playground"
      );
      const runHandler = createClassifierRunHandler();
      return runHandler(inputStates, cfg);
    },
    [canRunClassify],
  );

  // Header slot for the canvas
  const headerSlot = (
    <div className="mx-4 -mt-[44px] flex flex-row items-center justify-between border-b border-gray-200 pt-[10px] pb-[11px]">
      <div className="ml-auto flex flex-row items-center gap-2">
        {canCreateWorkflow && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleOpenInWorkflow}
            disabled={isCreatingWorkflow || validCategories.length === 0}
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
          onClick={() =>
            window.open(
              "https://docs.retab.com",
              "_blank",
              "noopener,noreferrer",
            )
          }
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
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-visible">
      {/* Code section overlay */}
      <AnimatePresence>
        {showCodeSection && (
          <CodeSection
            configValues={config}
            onClose={() => setShowCodeSection(false)}
          />
        )}
      </AnimatePresence>

      {/* History dialog */}
      <ClassifyHistoryDialog
        open={showHistoryDialog}
        onOpenChange={setShowHistoryDialog}
        onSelectClassification={handleHistorySelection}
      />

      {/* URL-driven classification loader (remounts on id change) */}
      {classificationIdFromParams && (
        <ClassificationUrlLoader
          key={classificationIdFromParams}
          classificationId={classificationIdFromParams}
          onLoad={handleHistorySelection}
        />
      )}

      <div className="-mx-4 flex min-h-0 flex-1">
        {/* Main Playground Canvas */}
        <ClassifierPlaygroundCanvas
          key={playgroundSession.key}
          config={config}
          onConfigChange={handleConfigChange}
          canvasId="classify-playground-canvas"
          headerSlot={headerSlot}
          initialInputStates={playgroundSession.initialInputStates}
          initialResult={playgroundSession.initialResult}
          supportsLoadFromRun={false}
          inputType="file"
          allowTypeChange={false}
          onRun={handleRun}
          runDisabledReason={
            canRunClassify ? null : "You don't have permission to run classify"
          }
        />
      </div>

      {/* First-time welcome dialog */}
      <Dialog
        open={openWelcome}
        onOpenChange={(isOpen) => {
          setOpenWelcome(isOpen);
          if (!isOpen) {
            try {
              localStorage.setItem(
                "retab-workflow-classify-onboarding-v1",
                JSON.stringify({ lastSeenAt: Date.now() }),
              );
            } catch {
              // no-op
            }
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-none shadow-2xl sm:max-w-3xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-light tracking-tight text-slate-900 uppercase">
              Classify
            </DialogTitle>
            <DialogDescription className="sr-only">
              Upload a document to classify it into predefined categories.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-8">
            <MarqueeClassify />

            <div className="space-y-4 text-sm text-slate-700">
              <p className="mb-2 text-2xl font-normal text-slate-800">
                Classify documents by category.
              </p>
              <p>
                Use our classify API to automatically route documents to the
                correct category based on their content.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>Upload a document</li>
                <li>Define categories with descriptions</li>
                <li>Get the matching category with reasoning</li>
              </ul>
              <p className="text-sm text-slate-500">
                Perfect for document routing, triage, and automated workflows.
                Check out our{" "}
                <Link
                  className="text-gray-800 underline"
                  href="https://docs.retab.com"
                >
                  docs
                </Link>
                .
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  window.open(
                    "https://docs.retab.com",
                    "_blank",
                    "noopener,noreferrer",
                  );
                } catch {}
              }}
            >
              Learn more
            </Button>
            <Button
              className="group before:transtion-opacity relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-md bg-gray-900 text-left font-medium text-white shadow-[0_1px_theme(colors.white/0.07)_inset,0_1px_3px_theme(colors.gray.900/0.2)] ring-1 ring-gray-900 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-md before:bg-gradient-to-b before:from-white/20 before:opacity-50 before:duration-300 before:ease-[cubic-bezier(0.4,0.36,0,1)] after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-md after:bg-gradient-to-b after:from-white/10 after:from-[46%] after:to-[54%] after:mix-blend-overlay hover:bg-gray-900 hover:opacity-80 hover:before:opacity-100"
              onClick={() => setOpenWelcome(false)}
            >
              Get started
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
