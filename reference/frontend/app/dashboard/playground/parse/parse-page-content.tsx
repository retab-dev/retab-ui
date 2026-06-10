"use client";

import { useCallback, useRef, useState } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ScanText,
  Loader2,
  Code,
  History,
  BookOpen,
  Workflow,
} from "lucide-react";

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

import {
  ParseRequest,
  ParseResponse,
  storedParseToParseResponse,
} from "@/app/dashboard/widgets/types/parse";
import type { Parse as StoredParse } from "@/types";
import { apiClient } from "@/app/shared/api/client";
import { useParse } from "@/app/dashboard/widgets/queries/parses";
import { useWorkflowCreateFromPlayground } from "@/app/dashboard/workflows/[workflowId]/shared/queries/workflows";
import { useWorkflowCreateTarget } from "@/app/dashboard/projects/queries";
import {
  useAuthorizationResources,
  useCanOrganization,
} from "@/app/dashboard/shared/authz/authorization-checks";
import CodeSection from "@/app/dashboard/playground/parse/components/code-section";
import { ParseHistoryDialog } from "@/app/dashboard/playground/parse/components/history-dialog";
import { SubscriptionPopover } from "@/app/shared/subscription-popover";
import Marquee from "@/app/components/marquees/marquee-md";
import { FeatureFlag } from "@/app/shared/constants/feature-flag";
import { InputState } from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/execute-playground";

import { useDashboardEnvironmentHref } from "@/app/shared/environment/use-dashboard-environment-href";
import {
  ParsePlaygroundCanvas,
  ParseConfig,
} from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/parse-playground";

type ParsePlaygroundSession = {
  key: string;
  initialInputStates?: Partial<InputState>[];
  initialResult?: ParseResponse;
};

const INITIAL_PARSE_PLAYGROUND_SESSION: ParsePlaygroundSession = {
  key: "initial",
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Parse Playground Page
// ═══════════════════════════════════════════════════════════════════════════════

export function ParsePageContent() {
  const router = useRouter();
  const dashboardHref = useDashboardEnvironmentHref();
  const searchParams = useSearchParams();
  const createWorkflowMutation = useWorkflowCreateFromPlayground();
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
  const parseIdFromParams = searchParams?.get("parse_id") ?? null;
  const historySelectionRequestRef = useRef(0);

  // State
  const [config, setConfig] = useState<ParseConfig>({
    model: "retab-small",
    image_resolution_dpi: 128,
    table_parsing_format: "html",
  });
  const [showCodeSection, setShowCodeSection] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [openWelcome, setOpenWelcome] = useState(false);

  const [playgroundSession, setPlaygroundSession] =
    useState<ParsePlaygroundSession>(INITIAL_PARSE_PLAYGROUND_SESSION);

  // UI authorization signaling: running parse requires `rbac:primitive:parse`.
  // The run handler lives inside the shared canvas, so we hide the Run button
  // by passing a denial reason rather than guarding a page-level handler.
  const canRunParse = useCanOrganization("rbac:primitive:parse");

  // Config change handler
  const handleConfigChange = useCallback(
    (newConfig: Record<string, unknown>) => {
      setConfig({
        model: (newConfig.model as string) || config.model,
        image_resolution_dpi:
          (newConfig.image_resolution_dpi as number) ||
          config.image_resolution_dpi,
        table_parsing_format:
          (newConfig.table_parsing_format as string) ||
          config.table_parsing_format,
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
    async (parsing: StoredParse) => {
      const requestId = historySelectionRequestRef.current + 1;
      historySelectionRequestRef.current = requestId;
      const mimeType = parsing.file?.mime_type || "application/pdf";
      const nextConfig: ParseConfig = {
        model: parsing.model || "retab-small",
        image_resolution_dpi: parsing.image_resolution_dpi || 128,
        table_parsing_format: parsing.table_parsing_format || "html",
      };
      const nextInitialResult = storedParseToParseResponse(parsing);
      let nextInitialInputStates: Partial<InputState>[] | undefined;
      let successMessage = "Parse loaded from history";

      // Try to load file
      if (parsing.file?.id) {
        try {
          const { data: link, response: linkResponse } = await apiClient.GET(
            "/v1/files/{file_id}/download-link",
            { params: { path: { file_id: parsing.file.id } } },
          );
          if (linkResponse.ok && link) {
            const fileResponse = await fetch(link.download_url);
            if (fileResponse.ok) {
              const buffer = await fileResponse.arrayBuffer();

              nextInitialInputStates = [
                {
                  id: "document",
                  type: "file",
                  fileBuffer: buffer,
                  fileName: parsing.file.filename || "document",
                  fileMimeType: mimeType,
                  textValue: "",
                },
              ];
              successMessage = "Parse and file loaded from history";
            } else {
              successMessage =
                "Parse loaded from history (file no longer available)";
            }
          } else {
            successMessage =
              "Parse loaded from history (file no longer available)";
          }
        } catch (error) {
          console.error("Error loading file:", error);
          successMessage =
            "Parse loaded from history (file could not be retrieved)";
        }
      }

      if (historySelectionRequestRef.current !== requestId) return;

      setConfig(nextConfig);
      setPlaygroundSession({
        key: `history:${parsing.id}:${requestId}`,
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

    setIsCreatingWorkflow(true);

    try {
      const timestamp = Date.now();
      const startBlockId = "start";
      const parseBlockId = `parse-${timestamp}`;

      const newWorkflow = await createWorkflowMutation.mutateAsync({
        name: "Parse Workflow",
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
              id: parseBlockId,
              type: "parse",
              position: { x: 400, y: 200 },
              label: "Parse",
              config: {
                image_resolution_dpi: config.image_resolution_dpi,
              },
            },
          ],
          edges: [
            {
              id: `edge-${timestamp}`,
              source: startBlockId,
              target: parseBlockId,
              source_handle: "output-file-0",
              target_handle: "input-file-0",
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
    createWorkflowMutation,
    dashboardHref,
    router,
  ]);

  // First-time welcome dialog with TTL
  useMountEffect(() => {
    try {
      const STORAGE_KEY = "retab-workflow-parse-onboarding-v1";
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

  // Header slot for the canvas
  const headerSlot = (
    <div className="mx-4 -mt-[44px] flex flex-row items-center justify-between border-b border-gray-200 pt-[10px] pb-[11px]">
      <div className="ml-auto flex flex-row items-center gap-2">
        {canCreateWorkflow && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleOpenInWorkflow}
            disabled={isCreatingWorkflow}
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
              "https://docs.retab.com/core-concepts/Parse",
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
            configValues={{
              model: config.model as ParseRequest["model"],
              image_resolution_dpi: config.image_resolution_dpi,
              table_parsing_format: (config.table_parsing_format ||
                "html") as ParseRequest["table_parsing_format"],
              document: { filename: "document.pdf", url: "" },
            }}
            onClose={() => setShowCodeSection(false)}
          />
        )}
      </AnimatePresence>

      {/* History dialog */}
      <ParseHistoryDialog
        open={showHistoryDialog}
        onOpenChange={setShowHistoryDialog}
        onSelectParse={handleHistorySelection}
      />

      {/* URL-driven parse loader (remounts on id change) */}
      {parseIdFromParams && (
        <ParseUrlLoader
          key={parseIdFromParams}
          parseId={parseIdFromParams}
          onLoad={handleHistorySelection}
        />
      )}

      <div className="-mx-4 flex min-h-0 flex-1">
        {/* Main Playground Canvas */}
        <ParsePlaygroundCanvas
          key={playgroundSession.key}
          config={config}
          onConfigChange={handleConfigChange}
          canvasId="parse-playground-canvas"
          headerSlot={headerSlot}
          initialInputStates={playgroundSession.initialInputStates}
          initialResult={playgroundSession.initialResult}
          defaultDpi={128}
          supportsLoadFromRun={false}
          runDisabledReason={
            canRunParse ? null : "You don't have permission to run parse"
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
                "retab-workflow-parse-onboarding-v1",
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
              Parse
            </DialogTitle>
            <DialogDescription className="sr-only">
              Upload a document to preview the parsed text and a rendered view.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-8">
            <Marquee />

            <div className="space-y-4 text-sm text-slate-700">
              <p className="mb-2 text-2xl font-normal text-slate-800">
                Turn any document into text.
              </p>
              <p>
                Use our parse API to turn any document into text. Switch between
                a raw text view and a rendered preview to verify how tables and
                headings are captured.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>Upload a supported file</li>
                <li>Pick model and options, then Run</li>
                <li>Copy or download the parsed content</li>
              </ul>
              <p className="text-sm text-slate-500">
                For chunking and RAG applications, check out our{" "}
                <Link
                  className="text-gray-800 underline"
                  href="https://docs.retab.com/core-concepts/Parse"
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
                    "https://docs.retab.com/core-concepts/Parse",
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

// Loads a parse from the URL once per id via remount (key). Splits loading/loaded
// states so the onLoad callback runs exactly once on mount of the "loaded" branch.
function ParseUrlLoader({
  parseId,
  onLoad,
}: {
  parseId: string;
  onLoad: (parsing: StoredParse) => Promise<void>;
}) {
  const query = useParse(parseId);
  if (query.isError || (query.isFetched && !query.data)) {
    return <ParseUrlLoadErrorToast />;
  }
  if (!query.data) return null;
  return <ParseUrlLoadBridge data={query.data} onLoad={onLoad} />;
}

function ParseUrlLoadErrorToast() {
  useMountEffect(() => {
    toast.error("Failed to load parse from URL");
  });
  return null;
}

function ParseUrlLoadBridge({
  data,
  onLoad,
}: {
  data: StoredParse;
  onLoad: (parsing: StoredParse) => Promise<void>;
}) {
  useMountEffect(() => {
    void onLoad(data);
  });
  return null;
}
