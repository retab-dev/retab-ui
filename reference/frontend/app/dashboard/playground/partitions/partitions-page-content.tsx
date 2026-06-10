"use client";

import { useCallback, useRef, useState } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { BookOpen, Code, History, Key } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import Marquee from "@/app/components/marquees/marquee-md";
import { SubscriptionPopover } from "@/app/shared/subscription-popover";
import { FeatureFlag } from "@/app/shared/constants/feature-flag";
import { apiClient } from "@/app/shared/api/client";
import { useCanOrganization } from "@/app/dashboard/shared/authz/authorization-checks";
import { usePartition } from "@/app/dashboard/widgets/queries/partitions";
import type { Partition as StoredPartition } from "@/types";
import type {
  InputState,
  InputType,
} from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/execute-playground";

import {
  PartitionConfig,
  PartitionPlaygroundCanvas,
  PartitionResult,
} from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/partition-playground";
import CodeSection from "@/app/dashboard/playground/partitions/components/code-section";
import { PartitionHistoryDialog } from "@/app/dashboard/playground/partitions/components/history-dialog";
import { resolvePartitionHistorySelection } from "@/app/dashboard/playground/partitions/history-hydration";

type PartitionPlaygroundSession = {
  key: string;
  initialInputStates?: Partial<InputState>[];
  initialResult?: PartitionResult;
};

const INITIAL_PARTITION_PLAYGROUND_SESSION: PartitionPlaygroundSession = {
  key: "initial",
};

function PartitionUrlLoader({
  partitionId,
  onLoad,
}: {
  partitionId: string;
  onLoad: (partition: StoredPartition) => Promise<void>;
}) {
  const query = usePartition(partitionId);
  if (query.isError || (query.isFetched && !query.data)) {
    return <PartitionUrlLoadErrorToast />;
  }
  if (!query.data) return null;
  return <PartitionUrlLoadBridge data={query.data} onLoad={onLoad} />;
}

function PartitionUrlLoadErrorToast() {
  useMountEffect(() => {
    toast.error("Failed to load partition from URL");
  });
  return null;
}

function PartitionUrlLoadBridge({
  data,
  onLoad,
}: {
  data: StoredPartition;
  onLoad: (partition: StoredPartition) => Promise<void>;
}) {
  useMountEffect(() => {
    void onLoad(data);
  });
  return null;
}

export function PartitionsPageContent() {
  const searchParams = useSearchParams();
  // UI signaling: partition history is a read surface. Hide the "View history"
  // affordance when the org RBAC read capability is absent.
  const canReadPartitions = useCanOrganization("rbac:partition:read");
  // Running the partition playground creates a partition.
  const canCreatePartitions = useCanOrganization("rbac:partition:create");
  const partitionIdFromParams = searchParams?.get("partition_id") ?? null;
  const historySelectionRequestRef = useRef(0);

  const [config, setConfig] = useState<PartitionConfig>({
    model: "retab-small",
    key: "",
    instructions: "",
    n_consensus: 1,
    allow_overlap: true,
  });

  const [playgroundSession, setPlaygroundSession] =
    useState<PartitionPlaygroundSession>(INITIAL_PARTITION_PLAYGROUND_SESSION);

  const [showCodeSection, setShowCodeSection] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [openWelcome, setOpenWelcome] = useState(false);

  useMountEffect(() => {
    try {
      const STORAGE_KEY = "retab-workflow-partition-onboarding-v1";
      const TTL_MS = FeatureFlag ? 1000 * 60 : 1000 * 60 * 60 * 24 * 14;
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

  const handleConfigChange = useCallback(
    (newConfig: Record<string, unknown>) => {
      setConfig((prev) => ({
        model: (newConfig.model as string) || prev.model,
        key: (newConfig.key as string) ?? prev.key,
        instructions: (newConfig.instructions as string) ?? prev.instructions,
        n_consensus: (newConfig.n_consensus as number) ?? prev.n_consensus ?? 1,
        allow_overlap:
          (newConfig.allow_overlap as boolean) ?? prev.allow_overlap ?? true,
      }));
    },
    [],
  );

  const handleShowHistoryDialog = useCallback(() => {
    // Fail-closed guard: only open the history (read) surface with the capability.
    if (!canReadPartitions) return;
    setShowHistoryDialog(true);
  }, [canReadPartitions]);

  const hydrateFromStoredPartition = useCallback(
    async (partition: StoredPartition) => {
      const requestId = historySelectionRequestRef.current + 1;
      historySelectionRequestRef.current = requestId;
      const nextConfig: PartitionConfig = {
        model: partition.model || "retab-small",
        key: partition.key || "",
        instructions: partition.instructions || "",
        n_consensus: partition.n_consensus ?? 1,
        allow_overlap: partition.allow_overlap !== false,
      };
      let nextInitialInputStates: Partial<InputState>[] | undefined;
      let nextInitialResult: PartitionResult | undefined;
      let successMessage = "Settings loaded from history";

      if (partition.output && partition.output.length > 0) {
        nextInitialResult = {
          output: partition.output,
          consensus: {
            choices: partition.consensus?.choices ?? [],
            likelihoods: partition.consensus?.likelihoods
              ? partition.consensus.likelihoods.map((lk) => ({
                  key: lk.key ?? null,
                  pages: lk.pages ?? [],
                }))
              : null,
          },
          usage: partition.usage
            ? { credits: partition.usage.credits ?? 0 }
            : null,
        };
      }

      if (partition.file?.id) {
        try {
          const { data: link, response: linkResponse } = await apiClient.GET(
            "/v1/files/{file_id}/download-link",
            { params: { path: { file_id: partition.file.id } } },
          );
          if (linkResponse.ok && link) {
            const fileResponse = await fetch(link.download_url);
            if (fileResponse.ok) {
              const buffer = await fileResponse.arrayBuffer();
              const mimeType = partition.file.mime_type || "application/pdf";
              const fileName = partition.file.filename || "document";
              nextInitialInputStates = [
                {
                  id: "document",
                  type: "file" as InputType,
                  fileBuffer: buffer,
                  fileName,
                  fileMimeType: mimeType,
                  textValue: "",
                },
              ];
              successMessage = "Partition loaded from history";
            } else {
              successMessage = "Settings loaded (file no longer available)";
            }
          } else {
            successMessage = "Settings loaded (file no longer available)";
          }
        } catch (error) {
          console.error("Error loading partition file:", error);
          successMessage = "Settings loaded (file could not be retrieved)";
        }
      }

      if (historySelectionRequestRef.current !== requestId) return;

      setConfig(nextConfig);
      setPlaygroundSession({
        key: `history:${partition.id}:${requestId}`,
        initialInputStates: nextInitialInputStates,
        initialResult: nextInitialResult,
      });
      toast.success(successMessage);
    },
    [],
  );

  const handlePartitionHistorySelection = useCallback(
    async (partition: StoredPartition) => {
      const latestPartition =
        await resolvePartitionHistorySelection(partition);
      await hydrateFromStoredPartition(latestPartition);
    },
    [hydrateFromStoredPartition],
  );

  const headerSlot = (
    <div className="mx-4 -mt-[44px] flex flex-row items-center justify-between border-b border-gray-200 pt-[10px] pb-[11px]">
      <div className="ml-auto flex flex-row items-center gap-2">
        {canReadPartitions && (
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
        )}

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
      <AnimatePresence>
        {showCodeSection && (
          <CodeSection
            configValues={config}
            onClose={() => setShowCodeSection(false)}
          />
        )}
      </AnimatePresence>

      <PartitionHistoryDialog
        open={showHistoryDialog}
        onOpenChange={setShowHistoryDialog}
        onSelectPartition={handlePartitionHistorySelection}
      />

      {/* URL-driven partition loader (remounts on id change) */}
      {partitionIdFromParams && (
        <PartitionUrlLoader
          key={partitionIdFromParams}
          partitionId={partitionIdFromParams}
          onLoad={hydrateFromStoredPartition}
        />
      )}

      <div className="-mx-4 flex min-h-0 flex-1">
        <PartitionPlaygroundCanvas
          key={playgroundSession.key}
          config={config}
          onConfigChange={handleConfigChange}
          canvasId="partition-playground-canvas"
          headerSlot={headerSlot}
          supportsLoadFromRun={false}
          initialInputStates={playgroundSession.initialInputStates}
          initialResult={playgroundSession.initialResult}
          runDisabledReason={
            canCreatePartitions
              ? null
              : "You don't have permission to create partitions"
          }
        />
      </div>

      <Dialog
        open={openWelcome}
        onOpenChange={(isOpen) => {
          setOpenWelcome(isOpen);
          if (!isOpen) {
            try {
              localStorage.setItem(
                "retab-workflow-partition-onboarding-v1",
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
              Partition
            </DialogTitle>
            <DialogDescription className="sr-only">
              Upload a document and partition it by a key.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-8">
            <Marquee codeFormat="json" />

            <div className="space-y-4 text-sm text-slate-700">
              <p className="mb-2 text-2xl font-normal text-slate-800">
                Partition documents by a key.
              </p>
              <p>
                Use our partition API to segment a document into chunks grouped
                by a key you define, such as invoice number or section name.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>Upload a multi-page PDF</li>
                <li>Pick a key and describe how to partition</li>
                <li>Get chunk/page ranges for each key value</li>
              </ul>
              <p className="text-sm text-slate-500">
                For a deeper overview, check our{" "}
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
                } catch {
                  // no-op
                }
              }}
            >
              Learn more
            </Button>
            <Button
              className="group relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-md bg-gray-900 text-left font-medium text-white shadow-[0_1px_theme(colors.white/0.07)_inset,0_1px_3px_theme(colors.gray.900/0.2)] ring-1 ring-gray-900 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] hover:bg-gray-900 hover:opacity-80"
              onClick={() => setOpenWelcome(false)}
            >
              <Key className="h-4 w-4" /> Get started
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
