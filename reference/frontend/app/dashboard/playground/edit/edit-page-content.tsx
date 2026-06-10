"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useMemo, ReactNode, useRef } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Code, History, BookOpen, Workflow } from "lucide-react";
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
import { useEdit } from "@/app/dashboard/widgets/queries/edits";
import { EditType } from "@/app/dashboard/widgets/types/edit";
import type { Edit, EditTemplate } from "@/types";
import MarqueeForm from "@/app/components/marquees/marquee-form";
import { useWorkflowCreateFromPlayground } from "@/app/dashboard/workflows/[workflowId]/shared/queries/workflows";
import { useWorkflowCreateTarget } from "@/app/dashboard/projects/queries";
import {
  useCanOrganization,
  useAuthorizationResources,
} from "@/app/dashboard/shared/authz/authorization-checks";
import { EditBlockConfig } from "@/app/dashboard/workflows/[workflowId]/shared/blocks/registry/edit-block";
import { FeatureFlag } from "@/app/shared/constants/feature-flag";
import { SubscriptionPopover } from "@/app/shared/subscription-popover";
import { FormField } from "@/app/dashboard/widgets/types/edit";
import { useEditTemplate } from "@/app/dashboard/widgets/queries/edit-templates";
import { EditHistoryDialog } from "@/app/dashboard/playground/edit/components/history-dialog";
import {
  arrayBufferToDataUrl,
  dataUrlToArrayBuffer,
  getEditHistoryFilledDocument,
  getEditHistoryFormData,
  getEditHistoryInstructions,
  getEditHistoryModel,
} from "@/app/dashboard/playground/edit/history-hydration";

import {
  InputState,
  ProcessingNodeSection,
  hasInputValue,
  InputType,
  type PlaygroundOutputRenderOptions,
} from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/execute-playground";

import { AgentEditOutputRenderer } from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/agent-edit-playground";
import type {
  AgentEditConfig,
  AgentEditResultState,
} from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/agent-edit-playground";

import { TemplateEditOutputRenderer } from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/template-edit-playground";
import { useDashboardEnvironmentHref } from "@/app/shared/environment/use-dashboard-environment-href";
import type {
  TemplateEditConfig,
  TemplateEditResultState,
} from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/template-edit-playground";

const CodeSection = dynamic(
  () => import("@/app/dashboard/playground/edit/components/code-section"),
);

const TemplateManagementDialog = dynamic(() =>
  import(
    "@/app/dashboard/playground/edit/components/template-management-dialog"
  ).then((dialogModule) => dialogModule.TemplateManagementDialog),
);

const AgentEditPlaygroundCanvas = dynamic(
  () =>
    import(
      "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/agent-edit-playground"
    ).then((playgroundModule) => playgroundModule.AgentEditPlaygroundCanvas),
  {
    loading: () => (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    ),
  },
);

const TemplateEditPlaygroundCanvas = dynamic(
  () =>
    import(
      "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/template-edit-playground"
    ).then((playgroundModule) => playgroundModule.TemplateEditPlaygroundCanvas),
  {
    loading: () => (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    ),
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Consolidated Config Type
// ═══════════════════════════════════════════════════════════════════════════════

interface ConsolidatedEditConfig {
  model: string;
  use_template: boolean;
  template_id?: string | null;
  instructions?: string;
}

type EditPlaygroundCurrentFile = {
  buffer: ArrayBuffer;
  name: string;
  type: string;
};

type EditPlaygroundSession = {
  key: string;
  currentFile: EditPlaygroundCurrentFile | null;
  initialInputStates?: Partial<InputState>[];
  initialResult?: AgentEditResultState | TemplateEditResultState;
};

const INITIAL_EDIT_PLAYGROUND_SESSION: EditPlaygroundSession = {
  key: "initial",
  currentFile: null,
};

interface TemplateEditHistoryPreview {
  templatePdfBuffer: ArrayBuffer;
  templateFields: FormField[];
  templateName?: string;
}

async function fetchTemplateEmptyFormBufferForHistory(templateId: string) {
  const { data, response } = await apiClient.GET(
    "/v1/edits/templates/{template_id}/empty-form",
    { params: { path: { template_id: templateId } } },
  );
  if (!response.ok || !data) {
    return null;
  }

  return dataUrlToArrayBuffer(data.url);
}

async function fetchTemplateEditPreviewForHistory(
  templateId: string,
): Promise<TemplateEditHistoryPreview | null> {
  try {
    const { data: template, response } = await apiClient.GET(
      "/v1/edits/templates/{template_id}",
      { params: { path: { template_id: templateId } } },
    );
    if (!response.ok || !template) {
      return null;
    }

    const templatePdfBuffer =
      await fetchTemplateEmptyFormBufferForHistory(templateId);
    if (!templatePdfBuffer) {
      return null;
    }

    return {
      templatePdfBuffer,
      templateFields:
        (template.form_fields as unknown as FormField[] | undefined) ?? [],
      templateName: template.name,
    };
  } catch (error) {
    console.error("Error loading template preview:", error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Consolidated Config Section Component
// ═══════════════════════════════════════════════════════════════════════════════

interface ConsolidatedConfigSectionProps {
  config: ConsolidatedEditConfig;
  onConfigChange: (config: ConsolidatedEditConfig) => void;
}

function ConsolidatedConfigSection({
  config,
  onConfigChange,
}: ConsolidatedConfigSectionProps) {
  return (
    <div className="-mx-4 -mb-3">
      <EditBlockConfig
        config={{
          model: config.model,
          use_template: config.use_template,
          template_id: config.template_id,
        }}
        onConfigChange={(newConfig) => {
          const typedConfig = newConfig as {
            model?: string;
            use_template?: boolean;
            template_id?: string | null;
          };
          onConfigChange({
            ...config,
            model: typedConfig.model ?? config.model,
            use_template: typedConfig.use_template ?? config.use_template,
            template_id: typedConfig.template_id ?? config.template_id,
          });
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Consolidated Edit Playground Page
// ═══════════════════════════════════════════════════════════════════════════════

export function EditPageContent() {
  const router = useRouter();
  const dashboardHref = useDashboardEnvironmentHref();
  const searchParams = useSearchParams();
  const createWorkflowMutation = useWorkflowCreateFromPlayground();
  // UI signaling: org RBAC capability for running the edit primitive. The same
  // capability governs both agent and template runs and (per the affordance
  // inventory) edit-template management, which has no distinct route policy.
  const canRunEdit = useCanOrganization("rbac:primitive:edit");
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
  const editIdFromParams = searchParams?.get("edit_id") ?? null;
  const editTypeFromParams: EditType =
    searchParams?.get("edit_type") === "template" ? "template" : "agent";
  const historySelectionRequestRef = useRef(0);
  const playgroundSessionSequenceRef = useRef(0);

  // Unified config state
  const [config, setConfig] = useState<ConsolidatedEditConfig>({
    model: "retab-small",
    use_template: false,
    template_id: null,
    instructions: "",
  });

  const [playgroundSession, setPlaygroundSession] =
    useState<EditPlaygroundSession>(INITIAL_EDIT_PLAYGROUND_SESSION);

  // Agent mode state: Track detection state across runs
  const [detectedFields, setDetectedFields] = useState<FormField[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);

  // Template mode state
  const { data: selectedTemplate } = useEditTemplate(
    config.template_id || undefined,
  );
  const templateFields = useMemo(
    () => (selectedTemplate?.form_fields as FormField[]) || [],
    [selectedTemplate?.form_fields],
  );

  // Fetch template PDF via react-query so we replace an ad-hoc effect with a cached request.
  const templateFileId = config.use_template
    ? selectedTemplate?.file?.id
    : null;
  const templatePdfQuery = useQuery<ArrayBuffer | null>({
    queryKey: ["template-pdf-buffer", templateFileId],
    queryFn: async () => {
      if (!templateFileId) return null;
      const { data: link, response: linkResponse } = await apiClient.GET(
        "/v1/files/{file_id}/download-link",
        { params: { path: { file_id: templateFileId } } },
      );
      if (!linkResponse.ok || !link) return null;
      const fileResponse = await fetch(link.download_url);
      if (!fileResponse.ok) return null;
      return fileResponse.arrayBuffer();
    },
    enabled: Boolean(templateFileId),
  });
  const templatePdfBuffer = templatePdfQuery.data ?? null;

  // Dialog state
  const [showCodeSection, setShowCodeSection] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showTemplateManagementDialog, setShowTemplateManagementDialog] =
    useState(false);

  // Open in workflow state
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);

  // Welcome dialog state
  const [openWelcome, setOpenWelcome] = useState(false);

  // First-time welcome dialog with TTL
  useMountEffect(() => {
    try {
      const STORAGE_KEY = "retab-consolidated-edit-onboarding-v1";
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

  // Processing block sections with a unified config section
  const sections: ProcessingNodeSection[] = [
    {
      type: "custom",
      render: (cfg, onChange) => (
        <ConsolidatedConfigSection
          config={cfg as unknown as ConsolidatedEditConfig}
          onConfigChange={(newConfig) => {
            onChange(newConfig as unknown as Record<string, unknown>);
          }}
        />
      ),
    },
  ];

  // Config change handler — also resets per-mode state when the user toggles use_template
  const handleConfigChange = useCallback(
    (newConfig: Record<string, unknown>) => {
      setConfig((prev) => {
        const nextUseTemplate =
          (newConfig.use_template as boolean) ?? prev.use_template;
        if (nextUseTemplate !== prev.use_template) {
          playgroundSessionSequenceRef.current += 1;
          setPlaygroundSession({
            key: `mode:${nextUseTemplate ? "template" : "agent"}:${playgroundSessionSequenceRef.current}`,
            currentFile: null,
          });
          setDetectedFields([]);
          setIsDetecting(false);
        }
        return {
          model: (newConfig.model as string) || prev.model,
          use_template: nextUseTemplate,
          template_id:
            (newConfig.template_id as string | null) ?? prev.template_id,
          instructions: (newConfig.instructions as string) ?? prev.instructions,
        };
      });
    },
    [],
  );

  // History dialog handler
  const handleShowHistoryDialog = useCallback(() => {
    setShowHistoryDialog(true);
  }, []);

  // History selection handler - handles both agent and template edits
  const handleHistorySelection = useCallback(
    async (edit: Edit) => {
      const requestId = historySelectionRequestRef.current + 1;
      historySelectionRequestRef.current = requestId;
      const editModel = getEditHistoryModel(edit);
      const editInstructions = getEditHistoryInstructions(edit);
      const editFormData = getEditHistoryFormData(edit);
      const editFilledDocument = getEditHistoryFilledDocument(edit);
      const isTemplateEdit = !!edit.template_id;
      let nextConfig: ConsolidatedEditConfig;
      let nextCurrentFile: EditPlaygroundCurrentFile | null = null;
      let nextInitialInputStates: Partial<InputState>[] | undefined;
      let nextInitialResult:
        | AgentEditResultState
        | TemplateEditResultState
        | undefined;
      let successMessage = "Edit settings loaded from history";

      if (isTemplateEdit) {
        const templatePreview = await fetchTemplateEditPreviewForHistory(
          edit.template_id!,
        );
        nextConfig = {
          ...config,
          use_template: true,
          template_id: edit.template_id!,
          model: editModel ?? config.model,
          instructions: editInstructions,
        };

        if (editInstructions) {
          nextInitialInputStates = [
            {
              id: "instructions",
              type: "text" as InputType,
              fileBuffer: null,
              fileName: null,
              fileMimeType: "",
              textValue: editInstructions,
            },
          ];
        }

        if (editFilledDocument?.url) {
          const filledBuffer = dataUrlToArrayBuffer(editFilledDocument.url);
          if (filledBuffer) {
            nextInitialResult = {
              response: {
                form_data: editFormData,
                filled_document: {
                  filename:
                    editFilledDocument.filename || "filled_document.pdf",
                  url: editFilledDocument.url,
                },
              },
              filledBuffer,
              templatePdfBuffer: templatePreview?.templatePdfBuffer ?? null,
              templateFields: templatePreview?.templateFields ?? [],
              templateId: edit.template_id!,
              templateName: templatePreview?.templateName,
            } as TemplateEditResultState;
          }
        } else if (edit.filled_document_ref?.id) {
          try {
            const { data: link, response: linkResponse } = await apiClient.GET(
              "/v1/files/{file_id}/download-link",
              { params: { path: { file_id: edit.filled_document_ref.id } } },
            );
            if (linkResponse.ok && link) {
              const fileResponse = await fetch(link.download_url);
              if (fileResponse.ok) {
                const filledBuffer = await fileResponse.arrayBuffer();
                const filledMimeType =
                  edit.filled_document_ref?.mime_type || "application/pdf";

                nextInitialResult = {
                  response: {
                    form_data: editFormData,
                    filled_document: {
                      filename:
                        edit.filled_document_ref?.filename || "filled_document.pdf",
                      url: arrayBufferToDataUrl(filledBuffer, filledMimeType),
                    },
                  },
                  filledBuffer,
                  templatePdfBuffer: templatePreview?.templatePdfBuffer ?? null,
                  templateFields: templatePreview?.templateFields ?? [],
                  templateId: edit.template_id!,
                  templateName:
                    templatePreview?.templateName,
                } as TemplateEditResultState;
              }
            }
          } catch (error) {
            console.error("Error loading filled document:", error);
          }
        }

        if (!nextInitialResult && templatePreview) {
          nextInitialResult = {
            response: null,
            filledBuffer: null,
            templatePdfBuffer: templatePreview.templatePdfBuffer,
            templateFields: templatePreview.templateFields,
            templateId: edit.template_id!,
            templateName: templatePreview.templateName,
          } as TemplateEditResultState;
        }

        const templateName =
          templatePreview?.templateName || "template";
        successMessage = `Template edit loaded (${templateName})`;
      } else {
        nextConfig = {
          ...config,
          use_template: false,
          template_id: null,
          model: editModel ?? config.model,
          instructions: editInstructions,
        };

        let fileLoaded = false;
        let filledDocLoaded = false;
        let loadedFileBuffer: ArrayBuffer | null = null;
        let loadedFileName = "document";
        let loadedMimeType = "application/pdf";
        let filledBuffer: ArrayBuffer | null = null;

        // Try to load original file
        if (edit.file?.id) {
          try {
            const { data: link, response: linkResponse } = await apiClient.GET(
              "/v1/files/{file_id}/download-link",
              { params: { path: { file_id: edit.file.id } } },
            );
            if (linkResponse.ok && link) {
              const fileResponse = await fetch(link.download_url);
              if (fileResponse.ok) {
                loadedFileBuffer = await fileResponse.arrayBuffer();
                loadedMimeType = edit.file.mime_type || "application/pdf";
                loadedFileName = edit.file.filename || "document";

                nextCurrentFile = {
                  buffer: loadedFileBuffer,
                  name: loadedFileName,
                  type: loadedMimeType,
                };

                fileLoaded = true;
              }
            }
          } catch (error) {
            console.error("Error loading file:", error);
          }
        }

        // Try to load filled document
        if (editFilledDocument?.url) {
          filledBuffer = dataUrlToArrayBuffer(editFilledDocument.url);
          filledDocLoaded = filledBuffer !== null;
        } else if (edit.filled_document_ref?.id) {
          try {
            const { data: link, response: linkResponse } = await apiClient.GET(
              "/v1/files/{file_id}/download-link",
              { params: { path: { file_id: edit.filled_document_ref.id } } },
            );
            if (linkResponse.ok && link) {
              const fileResponse = await fetch(link.download_url);
              if (fileResponse.ok) {
                filledBuffer = await fileResponse.arrayBuffer();
                filledDocLoaded = true;
              }
            }
          } catch (error) {
            console.error("Error loading filled document:", error);
          }
        }

        if (fileLoaded && loadedFileBuffer) {
          nextInitialInputStates = [
            {
              id: "document",
              type: "file" as InputType,
              fileBuffer: loadedFileBuffer,
              fileName: loadedFileName,
              fileMimeType: loadedMimeType,
              textValue: "",
            },
            {
              id: "instructions",
              type: "text" as InputType,
              fileBuffer: null,
              fileName: null,
              fileMimeType: "",
              textValue: editInstructions,
            },
          ];
        }

        if (filledDocLoaded && filledBuffer) {
          const filledMimeType =
            edit.filled_document_ref?.mime_type || loadedMimeType;

          nextInitialResult = {
            response: {
              form_data: editFormData,
              filled_document: {
                filename:
                  editFilledDocument?.filename ||
                  edit.filled_document_ref?.filename ||
                  "filled_document",
                url:
                  editFilledDocument?.url ||
                  arrayBufferToDataUrl(filledBuffer, filledMimeType),
              },
            },
            filledBuffer,
            detectedFields: [],
            isPdfFile: loadedMimeType.includes("application/pdf"),
            originalMimeType: loadedMimeType,
            isDetecting: false,
          } as AgentEditResultState;
        }

        if (fileLoaded && filledDocLoaded) {
          successMessage = "Edit and file loaded from history";
        } else if (fileLoaded) {
          successMessage =
            "Edit and file loaded from history (filled document no longer available)";
        } else if (filledDocLoaded) {
          successMessage =
            "Edit settings loaded (original file no longer available)";
        } else if (edit.file?.id || edit.filled_document_ref?.id) {
          successMessage = "Edit settings loaded (files no longer available)";
        }
      }

      if (historySelectionRequestRef.current !== requestId) return;

      setConfig(nextConfig);
      setPlaygroundSession({
        key: `history:${edit.id}:${isTemplateEdit ? "template" : "agent"}:${requestId}`,
        currentFile: nextCurrentFile,
        initialInputStates: nextInitialInputStates,
        initialResult: nextInitialResult,
      });
      setDetectedFields([]);
      setIsDetecting(false);
      toast.success(successMessage);
      setShowHistoryDialog(false);
    },
    [config],
  );

  // Template selection handler from management dialog
  const handleTemplateSelection = useCallback((template: EditTemplate) => {
    setConfig((prev) => ({ ...prev, template_id: template.id }));
    toast.success(`Template "${template.name}" selected`);
  }, []);

  // Open in workflow handler - mode-aware
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

    if (config.use_template && !config.template_id) {
      toast.error("Please select a template before opening in a workflow");
      return;
    }

    setIsCreatingWorkflow(true);

    try {
      const timestamp = Date.now();
      const startBlockId = "start";

      if (config.use_template) {
        // Template mode: create parse → template-edit workflow
        const parseBlockId = `parse-${timestamp}`;
        const templateEditBlockId = `template-edit-${timestamp}`;

        const newWorkflow = await createWorkflowMutation.mutateAsync({
          name: selectedTemplate?.name || "Template Edit Workflow",
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
                position: { x: 300, y: 200 },
                label: "Parse",
              },
              {
                id: templateEditBlockId,
                type: "edit",
                position: { x: 700, y: 200 },
                label: "Template Edit",
                config: {
                  model: config.model,
                  use_template: true,
                  template_id: config.template_id,
                },
              },
            ],
            edges: [
              {
                id: `edge-start-parse-${timestamp}`,
                source: startBlockId,
                target: parseBlockId,
                source_handle: "output-file-0",
                target_handle: "input-file-0",
                animated: true,
              },
              {
                id: `edge-parse-edit-${timestamp}`,
                source: parseBlockId,
                target: templateEditBlockId,
                source_handle: "output-json-0",
                target_handle: "input-json-0",
                animated: true,
              },
            ],
          },
        });

        toast.success("Workflow created successfully");
        router.push(dashboardHref(`/dashboard/workflows/${newWorkflow.id}`));
      } else {
        // Agent mode: create start → edit workflow
        const editBlockId = `edit-${timestamp}`;

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
                id: editBlockId,
                type: "edit",
                position: { x: 400, y: 200 },
                label: "Edit",
                config: {
                  model: config.model,
                },
              },
            ],
            edges: [
              {
                id: `edge-${timestamp}`,
                source: startBlockId,
                target: editBlockId,
                source_handle: "output-file-0",
                target_handle: "input-file-0",
                animated: true,
              },
            ],
          },
        });

        toast.success("Workflow created successfully");
        router.push(dashboardHref(`/dashboard/workflows/${newWorkflow.id}`));
      }
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
    playgroundSession.currentFile,
    selectedTemplate,
    createWorkflowMutation,
    dashboardHref,
    router,
  ]);

  // Agent mode: Custom run handler that tracks file and detection state
  const handleAgentRun = useCallback(
    async (inputStates: InputState[], cfg: Record<string, unknown>) => {
      // Fail-closed guard: never run the edit primitive without the org RBAC
      // capability. Backstops any direct/imperative path to the run handler.
      // Throwing keeps the canvas onRun result type and surfaces the denial.
      if (!canRunEdit) {
        throw new Error("You do not have permission to run edits");
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

      // Use the shared run handler with detection callbacks
      const { createAgentEditRunHandler } = await import(
        "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/agent-edit-playground"
      );
      const runHandler = createAgentEditRunHandler(
        () => {
          setIsDetecting(true);
          setDetectedFields([]);
        },
        (fields) => {
          setIsDetecting(false);
          setDetectedFields(fields);
        },
      );

      const result = await runHandler(inputStates, cfg);
      return result;
    },
    [canRunEdit],
  );

  // Agent mode: Custom output renderer that merges detection state
  const renderAgentOutput = useCallback(
    (
      result: unknown,
      inputStates: InputState[],
      isProcessing: boolean,
      renderOptions?: PlaygroundOutputRenderOptions,
    ): ReactNode => {
      // Merge detection state into result
      const documentState = inputStates.find(
        (inputState) => inputState.id === "document",
      );
      const outputState = result as AgentEditResultState | null;
      const mergedResult: AgentEditResultState | null = outputState
        ? {
            ...outputState,
            originalBuffer:
              outputState.originalBuffer ||
              playgroundSession.currentFile?.buffer ||
              null,
            isDetecting,
            detectedFields:
              outputState.detectedFields.length > 0
                ? outputState.detectedFields
                : detectedFields,
          }
        : isDetecting
          ? {
              response: null,
              filledBuffer: null,
              originalBuffer: playgroundSession.currentFile?.buffer || null,
              detectedFields,
              isPdfFile: true,
              originalMimeType:
                playgroundSession.currentFile?.type ||
                documentState?.fileMimeType ||
                "application/pdf",
              isDetecting,
            }
          : null;

      return AgentEditOutputRenderer(
        mergedResult,
        inputStates,
        isProcessing,
        renderOptions,
      );
    },
    [isDetecting, detectedFields, playgroundSession.currentFile],
  );

  // Template mode: Custom run handler that includes template data in result
  const handleTemplateRun = useCallback(
    async (inputStates: InputState[], cfg: Record<string, unknown>) => {
      // Fail-closed guard: never run the edit primitive without the org RBAC
      // capability. Backstops any direct/imperative path to the run handler.
      // Throwing keeps the canvas onRun result type and surfaces the denial.
      if (!canRunEdit) {
        throw new Error("You do not have permission to run edits");
      }

      const { createTemplateEditRunHandler } = await import(
        "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/template-edit-playground"
      );
      const runHandler = createTemplateEditRunHandler();
      const result = await runHandler(inputStates, cfg);

      // Enhance result with template data for display
      return {
        ...result,
        templatePdfBuffer,
        templateFields,
      };
    },
    [canRunEdit, templatePdfBuffer, templateFields],
  );

  // Template mode: Custom output renderer that merges template data
  const renderTemplateOutput = useCallback(
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
              outputState.templatePdfBuffer || templatePdfBuffer,
            templateFields:
              outputState.templateFields?.length > 0
                ? outputState.templateFields
                : templateFields,
            templateId:
              outputState.templateId || config.template_id || undefined,
            templateName: outputState.templateName || selectedTemplate?.name,
          }
        : templatePdfBuffer && templateFields.length > 0
          ? {
              response: null,
              filledBuffer: null,
              templatePdfBuffer,
              templateFields,
              templateId: config.template_id || undefined,
              templateName: selectedTemplate?.name,
            }
          : null;

      return TemplateEditOutputRenderer(
        mergedResult,
        inputStates,
        isProcessing,
        renderOptions,
      );
    },
    [
      templatePdfBuffer,
      templateFields,
      config.template_id,
      selectedTemplate?.name,
    ],
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
            disabled={
              isCreatingWorkflow || (config.use_template && !config.template_id)
            }
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
              "https://docs.retab.com/core-concepts/Edit",
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-visible">
      {/* Code section overlay - uses existing CodeSection which already handles both modes */}
      <AnimatePresence>
        {showCodeSection && (
          <CodeSection
            configValues={{
              model: config.model,
              template_id: config.use_template
                ? (config.template_id ?? undefined)
                : undefined,
              instructions: config.instructions,
            }}
            onClose={() => setShowCodeSection(false)}
          />
        )}
      </AnimatePresence>

      {/* History dialog - shows both agent and template edits */}
      <EditHistoryDialog
        open={showHistoryDialog}
        onOpenChange={setShowHistoryDialog}
        onSelectEdit={handleHistorySelection}
      />

      {/* URL-driven edit loader (remounts on id change) */}
      {editIdFromParams && (
        <EditUrlLoader
          key={`${editIdFromParams}-${editTypeFromParams}`}
          editId={editIdFromParams}
          editType={editTypeFromParams}
          onLoad={handleHistorySelection}
        />
      )}

      {/* Template management dialog - only for template mode. Hidden entirely
          when the edit primitive capability is absent, since it exposes
          template create/update/duplicate/delete and generate-with-AI, all
          gated under rbac:primitive:edit (no distinct route policy). */}
      {canRunEdit && config.use_template && showTemplateManagementDialog && (
        <TemplateManagementDialog
          open={true}
          onOpenChange={setShowTemplateManagementDialog}
          onSelectTemplate={handleTemplateSelection}
        />
      )}

      <div className="-mx-4 flex min-h-0 min-w-0 flex-1">
        {/* Conditional canvas rendering based on mode */}
        {config.use_template ? (
          <TemplateEditPlaygroundCanvas
            key={playgroundSession.key}
            config={config as TemplateEditConfig}
            onConfigChange={handleConfigChange}
            canvasId="edit-consolidated-canvas"
            headerSlot={headerSlot}
            initialInputStates={playgroundSession.initialInputStates}
            initialResult={
              playgroundSession.initialResult as TemplateEditResultState
            }
            supportsLoadFromRun={false}
            customSections={sections}
            onRun={handleTemplateRun}
            runDisabledReason={
              canRunEdit ? null : "You don't have permission to run edit"
            }
            renderOutput={renderTemplateOutput}
            templatePdfBuffer={templatePdfBuffer}
            templateFields={templateFields}
            templateName={selectedTemplate?.name}
          />
        ) : (
          <AgentEditPlaygroundCanvas
            key={playgroundSession.key}
            config={config as AgentEditConfig}
            onConfigChange={handleConfigChange}
            canvasId="edit-consolidated-canvas"
            headerSlot={headerSlot}
            initialInputStates={playgroundSession.initialInputStates}
            initialResult={
              playgroundSession.initialResult as AgentEditResultState
            }
            supportsLoadFromRun={false}
            customSections={sections}
            onRun={handleAgentRun}
            runDisabledReason={
              canRunEdit ? null : "You don't have permission to run edit"
            }
            renderOutput={renderAgentOutput}
          />
        )}
      </div>

      {/* First-time welcome dialog */}
      <Dialog
        open={openWelcome}
        onOpenChange={(isOpen) => {
          setOpenWelcome(isOpen);
          if (!isOpen) {
            try {
              localStorage.setItem(
                "retab-consolidated-edit-onboarding-v1",
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
              Edit Playground
            </DialogTitle>
            <DialogDescription className="sr-only">
              Edit documents with AI using agent mode or templates.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-8">
            <MarqueeForm />

            <div className="space-y-4 text-sm text-slate-700">
              <p className="mb-2 text-2xl font-normal text-slate-800">
                Edit documents with AI.
              </p>
              <p>Choose between two modes:</p>
              <ul className="list-disc space-y-2 pl-5 text-sm">
                <li>
                  <strong>Agent Mode:</strong> Upload any PDF or Office document
                  and let AI detect and fill form fields automatically
                </li>
                <li>
                  <strong>Template Mode:</strong> Use a pre-defined template
                  with fixed field positions for consistent, batch processing
                </li>
              </ul>
              <p className="text-sm text-slate-500">
                Toggle &quot;Use Template&quot; in the settings to switch
                between modes. For more details, check out our{" "}
                <Link
                  className="text-gray-800 underline"
                  href="https://docs.retab.com/core-concepts/Edit"
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
                    "https://docs.retab.com/core-concepts/Edit",
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

// Loads an edit from the URL once per id via remount (key).
function EditUrlLoader({
  editId,
  editType,
  onLoad,
}: {
  editId: string;
  editType: EditType;
  onLoad: (edit: Edit) => Promise<void>;
}) {
  const query = useEdit(editId, { editType });
  if (query.isError || (query.isFetched && !query.data)) {
    return <EditUrlLoadErrorToast />;
  }
  if (!query.data) return null;
  return <EditUrlLoadBridge data={query.data} onLoad={onLoad} />;
}

function EditUrlLoadErrorToast() {
  useMountEffect(() => {
    toast.error("Failed to load edit from URL");
  });
  return null;
}

function EditUrlLoadBridge({
  data,
  onLoad,
}: {
  data: Edit;
  onLoad: (edit: Edit) => Promise<void>;
}) {
  useMountEffect(() => {
    void onLoad(data);
  });
  return null;
}
