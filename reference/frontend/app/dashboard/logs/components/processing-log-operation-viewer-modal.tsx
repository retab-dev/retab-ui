"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Loader2,
  Paperclip,
  ScanText,
  SquarePen,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { useAuth } from "@/app/shared/contexts/auth";
import { OCRProvider } from "@/app/dashboard/shared/contexts/ocr";
import { JsonSchemaEditorProvider } from "@/app/dashboard/shared/schema-editor/contexts/json-schema";
import { ExtractionComponent } from "@/app/dashboard/widgets/components/extraction-component";
import { useExtraction } from "@/app/dashboard/widgets/queries/extractions";
import { useParse } from "@/app/dashboard/widgets/queries/parses";
import { useSplit } from "@/app/dashboard/widgets/queries/splits";
import { usePartition } from "@/app/dashboard/widgets/queries/partitions";
import { useClassification } from "@/app/dashboard/widgets/queries/classifications";
import { useSchemaGeneration } from "@/app/dashboard/widgets/queries/schema-generations";
import { useEdit } from "@/app/dashboard/widgets/queries/edits";
import { useEditTemplate } from "@/app/dashboard/widgets/queries/edit-templates";
import type { ExtendedJSONSchema7 } from "@/app/dashboard/widgets/types/json-schema";
import {
  normalizeParseResult,
  type ParseResponse,
} from "@/app/dashboard/widgets/types/parse";
import {
  asSplitView,
  type SplitView,
} from "@/app/dashboard/widgets/types/split";
import {
  PartitionOutputRenderer,
  type PartitionResult,
} from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/partition-playground";
import type { ProcessingLog } from "@/types";
import type { EditType } from "@/app/dashboard/widgets/types/edit";
import {
  ClassifierResultViewer,
  type ClassifierResultViewerInput,
  type ClassifyResult,
} from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/classifier-playground";
import {
  isPdfFile,
  type AgentEditResultState,
} from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/agent-edit-playground";
import type { TemplateEditResultState } from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/template-edit-playground";
import type {
  InputState,
  PlaygroundOutputRenderOptions,
  PlaygroundOutputViewMode,
} from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/execute-playground";
import type { EditResult as EditResponse } from "@/types";
import {
  LoadingState,
  ParseOutputRendererView,
  SplitOutputRendererView,
  TemplateEditOutputRendererView,
  AgentEditOutputRendererView,
  SchemaGenerationOutputRendererView,
  MODAL_CLASS_EXTRACTION,
  MODAL_CLASS_DEFAULT,
} from "@/app/dashboard/shared/operation-viewer-helpers";
import {
  PrimitiveViewerShell,
  buildMarkdownFromPages,
  downloadBuffer,
  downloadJson,
  downloadMarkdown,
  type PrimitiveViewerDownloadAction,
  type PrimitiveViewerOperation,
} from "@/app/dashboard/shared/primitive-viewer/primitive-viewer";

interface ProcessingLogOperationViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processingLog: ProcessingLog | null;
}

const SUPPORTED_OPERATIONS = new Set([
  "extraction",
  "parse",
  "split",
  "classify",
  "edit",
  "schema_generation",
  "partition",
]);
const EMPTY_JSON_SCHEMA: ExtendedJSONSchema7 = {
  title: "",
  description: "",
  type: "object",
  properties: {},
  required: [],
};
const FILE_PREVIEW_QUERY_GC_TIME = 30 * 60 * 1000;

function isSupportedOperation(
  operation: string | null | undefined,
): operation is
  | "extraction"
  | "parse"
  | "split"
  | "classify"
  | "edit"
  | "schema_generation"
  | "partition" {
  return Boolean(operation && SUPPORTED_OPERATIONS.has(operation));
}

function getPrimitiveOperation(
  operation:
    | "extraction"
    | "parse"
    | "split"
    | "classify"
    | "edit"
    | "schema_generation"
    | "partition"
    | null,
): PrimitiveViewerOperation {
  if (operation === "extraction" || operation === "schema_generation") {
    return "extract";
  }
  if (operation === "classify") {
    return "classify";
  }
  if (operation === "partition") {
    return "partition";
  }
  if (operation === "edit") {
    return "edit";
  }
  if (operation === "split") {
    return "split";
  }
  return "parse";
}

function isPdfFileRef(
  file:
    | { filename?: string | null; mime_type?: string | null }
    | null
    | undefined,
) {
  return (
    file?.mime_type === "application/pdf" ||
    Boolean(file?.filename?.toLowerCase().endsWith(".pdf"))
  );
}

function jsonFilename(prefix: string, id: string | null | undefined) {
  return `${prefix}${id ? `-${id}` : ""}.json`;
}

function UnavailableState({
  processingLog,
  reason,
}: {
  processingLog: ProcessingLog | null;
  reason: string;
}) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 p-6 text-center">
      <AlertCircle className="h-8 w-8 text-amber-600" />
      <p className="text-foreground text-sm font-medium">
        Viewer unavailable for this historical log.
      </p>
      <p className="text-muted-foreground text-xs">{reason}</p>
      {processingLog && (
        <div className="bg-muted/30 text-muted-foreground rounded border px-3 py-2 text-left text-xs">
          <div>Log ID: {processingLog.id}</div>
          <div>Operation: {processingLog.operation || "-"}</div>
          <div>
            Created: {new Date(processingLog.created_at ?? "").toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProcessingLogOperationViewerModal({
  open,
  onOpenChange,
  processingLog,
}: ProcessingLogOperationViewerModalProps) {
  const { fetchWithAuth } = useAuth();
  const operation = processingLog?.operation;
  const supportedOperation = isSupportedOperation(operation) ? operation : null;
  const [parseOutputViewMode, setParseOutputViewMode] =
    useState<PlaygroundOutputViewMode>("text");
  const [editOutputViewMode, setEditOutputViewMode] =
    useState<PlaygroundOutputViewMode>("filled");

  const extractionId =
    supportedOperation === "extraction"
      ? processingLog?.extraction_props?.extraction_id
      : undefined;
  const parseId =
    supportedOperation === "parse"
      ? processingLog?.parse_props?.parse_id
      : undefined;
  const splitId =
    supportedOperation === "split"
      ? processingLog?.split_props?.split_id
      : undefined;
  const classificationId =
    supportedOperation === "classify"
      ? processingLog?.classify_props?.classification_id
      : undefined;
  const editId =
    supportedOperation === "edit"
      ? processingLog?.edit_props?.edit_id
      : undefined;
  const editType: EditType =
    processingLog?.edit_props?.edit_type === "template" ? "template" : "agent";
  const schemaGenerationId =
    supportedOperation === "schema_generation"
      ? processingLog?.extraction_props?.extraction_id
      : undefined;
  const partitionId =
    supportedOperation === "partition"
      ? processingLog?.partition_props?.partition_id
      : undefined;

  const extractionQuery = useExtraction(extractionId ?? null);
  const parseQuery = useParse(parseId ?? null);
  const splitQuery = useSplit(splitId ?? null);
  const classificationQuery = useClassification(classificationId ?? null);
  const editQuery = useEdit(editId ?? null, { editType });
  const templateQuery = useEditTemplate(
    editType === "template"
      ? editQuery.data?.template_id || undefined
      : undefined,
  );
  const schemaGenerationQuery = useSchemaGeneration(schemaGenerationId ?? null);
  const partitionQuery = usePartition(partitionId ?? null);

  const getMissingLinkReason = useMemo(() => {
    if (!supportedOperation) {
      return "This operation does not have a dedicated viewer.";
    }
    if (supportedOperation === "extraction" && !extractionId)
      return "Missing extraction_id in processing log payload.";
    if (supportedOperation === "parse" && !parseId)
      return "Missing parse_id in processing log payload.";
    if (supportedOperation === "split" && !splitId)
      return "Missing split_id in processing log payload.";
    if (supportedOperation === "classify" && !classificationId)
      return "Missing classification_id in processing log payload.";
    if (supportedOperation === "edit" && !editId)
      return "Missing edit_id in processing log payload.";
    if (supportedOperation === "schema_generation" && !schemaGenerationId)
      return "Missing extraction_id in processing log payload.";
    if (supportedOperation === "partition" && !partitionId)
      return "Missing partition_id in processing log payload.";
    return null;
  }, [
    supportedOperation,
    extractionId,
    parseId,
    splitId,
    classificationId,
    editId,
    schemaGenerationId,
    partitionId,
  ]);

  const fetchFileBuffer = useCallback(
    async (
      fileId: string,
    ): Promise<{ buffer: ArrayBuffer; mimeType: string | null }> => {
      let signedLinkError: string | null = null;

      const trySignedLinkFetch = async (): Promise<{
        buffer: ArrayBuffer;
        mimeType: string | null;
      } | null> => {
        try {
          const linkResponse = await fetchWithAuth(
            `/v1/files/${fileId}/download-link`,
          );
          if (!linkResponse.ok) {
            signedLinkError = `download-link ${linkResponse.status}`;
            return null;
          }
          const linkBody = (await linkResponse.json()) as {
            download_url?: string;
          };
          if (!linkBody.download_url) {
            signedLinkError = "download-link missing url";
            return null;
          }
          const fileResponse = await fetch(linkBody.download_url);
          if (!fileResponse.ok) {
            signedLinkError = `signed-url fetch ${fileResponse.status}`;
            return null;
          }
          return {
            buffer: await fileResponse.arrayBuffer(),
            mimeType: fileResponse.headers.get("content-type"),
          };
        } catch (error) {
          signedLinkError =
            error instanceof Error
              ? error.message
              : "signed-url fetch exception";
          return null;
        }
      };

      const signedResult = await trySignedLinkFetch();
      if (signedResult) {
        return signedResult;
      }

      const sampleResponse = await fetchWithAuth(
        `/v1/files/${fileId}/sample-document`,
      );
      if (!sampleResponse.ok) {
        throw new Error(
          `sample-document ${sampleResponse.status}${signedLinkError ? ` (after ${signedLinkError})` : ""}`,
        );
      }
      return {
        buffer: await sampleResponse.arrayBuffer(),
        mimeType: sampleResponse.headers.get("content-type"),
      };
    },
    [fetchWithAuth],
  );

  const parseResult = useMemo<ParseResponse | null>(() => {
    return normalizeParseResult(parseQuery.data);
  }, [parseQuery.data]);
  const parseFileId =
    supportedOperation === "parse" ? (parseQuery.data?.file?.id ?? null) : null;
  const parseFilePreviewQuery = useQuery({
    queryKey: ["processing-log-viewer", "parse", parseId, parseFileId],
    enabled: open && supportedOperation === "parse" && Boolean(parseFileId),
    queryFn: async (): Promise<{
      buffer: ArrayBuffer;
      mimeType: string;
    } | null> => {
      if (!parseFileId) return null;
      try {
        const { buffer, mimeType } = await fetchFileBuffer(parseFileId);
        return {
          buffer,
          mimeType:
            parseQuery.data?.file?.mime_type || mimeType || "application/pdf",
        };
      } catch {
        return null;
      }
    },
    staleTime: Infinity,
    gcTime: FILE_PREVIEW_QUERY_GC_TIME,
  });
  const parseFilePreview = parseFilePreviewQuery.data ?? null;
  const isParseFileLoading =
    open &&
    supportedOperation === "parse" &&
    Boolean(parseFileId) &&
    (parseFilePreviewQuery.isLoading || parseFilePreviewQuery.isFetching);

  const splitResult = useMemo<SplitView | null>(() => {
    const split = splitQuery.data;
    if (!split) return null;
    return asSplitView(split as Parameters<typeof asSplitView>[0]);
  }, [splitQuery.data]);

  const partitionResult = useMemo<PartitionResult | null>(() => {
    const partition = partitionQuery.data;
    if (!partition) return null;
    return {
      output: partition.output ?? [],
      consensus: {
        choices: partition.consensus?.choices ?? [],
        likelihoods: partition.consensus?.likelihoods
          ? partition.consensus.likelihoods.map((lk) => ({
              key: lk.key ?? null,
              pages: lk.pages ?? [],
            }))
          : null,
      },
      usage: partition.usage ? { credits: partition.usage.credits ?? 0 } : null,
    };
  }, [partitionQuery.data]);

  const classifyResult = useMemo<ClassifyResult | null>(() => {
    const classification = classificationQuery.data;
    if (!classification) return null;
    return {
      category: classification.output?.category || "Unknown",
      reasoning: classification.output?.reasoning || "",
    };
  }, [classificationQuery.data]);

  const defaultClassifyInput = useMemo<ClassifierResultViewerInput>(
    () => ({
      type: "file",
      fileBuffer: null,
      fileName:
        classificationQuery.data?.file?.filename ||
        processingLog?.filename ||
        "Document",
      fileMimeType:
        classificationQuery.data?.file?.mime_type ||
        processingLog?.mime_type ||
        "application/octet-stream",
      textValue: "",
    }),
    [classificationQuery.data, processingLog],
  );
  const splitBaseInputState = useMemo<InputState | null>(() => {
    if (supportedOperation !== "split" || !splitQuery.data) {
      return null;
    }
    return {
      id: "document",
      type: "file",
      fileBuffer: null,
      fileName:
        splitQuery.data.file?.filename || processingLog?.filename || null,
      fileMimeType:
        splitQuery.data.file?.mime_type ||
        processingLog?.mime_type ||
        "application/pdf",
      textValue: "",
    };
  }, [processingLog, splitQuery.data, supportedOperation]);
  const splitFileId =
    supportedOperation === "split" ? (splitQuery.data?.file?.id ?? null) : null;
  const splitPreviewQuery = useQuery({
    queryKey: ["processing-log-viewer", "split", splitId, splitFileId],
    enabled: open && supportedOperation === "split" && Boolean(splitFileId),
    queryFn: async (): Promise<{
      buffer: ArrayBuffer;
      mimeType: string;
    } | null> => {
      if (!splitFileId) return null;
      try {
        const { buffer, mimeType } = await fetchFileBuffer(splitFileId);
        return {
          buffer,
          mimeType:
            splitQuery.data?.file?.mime_type || mimeType || "application/pdf",
        };
      } catch {
        return null;
      }
    },
    staleTime: Infinity,
    gcTime: FILE_PREVIEW_QUERY_GC_TIME,
  });
  const splitInputStates = useMemo<InputState[]>(() => {
    if (!splitBaseInputState) {
      return [];
    }
    if (!splitPreviewQuery.data) {
      return [splitBaseInputState];
    }
    return [
      {
        ...splitBaseInputState,
        fileBuffer: splitPreviewQuery.data.buffer,
        fileMimeType: splitPreviewQuery.data.mimeType,
      },
    ];
  }, [splitBaseInputState, splitPreviewQuery.data]);
  const isSplitFileLoading =
    open &&
    supportedOperation === "split" &&
    Boolean(splitFileId) &&
    (splitPreviewQuery.isLoading || splitPreviewQuery.isFetching);

  const partitionBaseInputState = useMemo<InputState | null>(() => {
    if (supportedOperation !== "partition" || !partitionQuery.data) {
      return null;
    }
    return {
      id: "document",
      type: "file",
      fileBuffer: null,
      fileName:
        partitionQuery.data.file?.filename || processingLog?.filename || null,
      fileMimeType:
        partitionQuery.data.file?.mime_type ||
        processingLog?.mime_type ||
        "application/pdf",
      textValue: "",
    };
  }, [partitionQuery.data, processingLog, supportedOperation]);
  const partitionFileId =
    supportedOperation === "partition"
      ? (partitionQuery.data?.file?.id ?? null)
      : null;
  const partitionPreviewQuery = useQuery({
    queryKey: [
      "processing-log-viewer",
      "partition",
      partitionId,
      partitionFileId,
    ],
    enabled:
      open && supportedOperation === "partition" && Boolean(partitionFileId),
    queryFn: async (): Promise<{
      buffer: ArrayBuffer;
      mimeType: string;
    } | null> => {
      if (!partitionFileId) return null;
      try {
        const { buffer, mimeType } = await fetchFileBuffer(partitionFileId);
        return {
          buffer,
          mimeType:
            partitionQuery.data?.file?.mime_type ||
            mimeType ||
            "application/pdf",
        };
      } catch {
        return null;
      }
    },
    staleTime: Infinity,
    gcTime: FILE_PREVIEW_QUERY_GC_TIME,
  });
  const partitionInputStates = useMemo<InputState[]>(() => {
    if (!partitionBaseInputState) {
      return [];
    }
    if (!partitionPreviewQuery.data) {
      return [partitionBaseInputState];
    }
    return [
      {
        ...partitionBaseInputState,
        fileBuffer: partitionPreviewQuery.data.buffer,
        fileMimeType: partitionPreviewQuery.data.mimeType,
      },
    ];
  }, [partitionBaseInputState, partitionPreviewQuery.data]);
  const isPartitionFileLoading =
    open &&
    supportedOperation === "partition" &&
    Boolean(partitionFileId) &&
    (partitionPreviewQuery.isLoading || partitionPreviewQuery.isFetching);

  const classificationFileId =
    supportedOperation === "classify"
      ? classificationQuery.data?.file?.id ||
        processingLog?.document_id ||
        processingLog?.document_ids?.[0] ||
        null
      : null;
  const classifyViewerQuery = useQuery({
    queryKey: [
      "processing-log-viewer",
      "classify",
      classificationId,
      classificationFileId,
    ],
    enabled:
      open &&
      supportedOperation === "classify" &&
      Boolean(classificationQuery.data) &&
      Boolean(classificationFileId),
    queryFn: async (): Promise<{
      input: ClassifierResultViewerInput;
      errorMessage: string | null;
    }> => {
      if (!classificationFileId) {
        return {
          input: defaultClassifyInput,
          errorMessage: "This classification does not have an associated file.",
        };
      }
      try {
        const { buffer, mimeType } =
          await fetchFileBuffer(classificationFileId);
        return {
          input: {
            type: "file",
            fileBuffer: buffer,
            fileName:
              classificationQuery.data?.file?.filename ||
              defaultClassifyInput.fileName,
            fileMimeType:
              mimeType ||
              classificationQuery.data?.file?.mime_type ||
              defaultClassifyInput.fileMimeType,
            textValue: "",
          },
          errorMessage: null,
        };
      } catch {
        return {
          input: defaultClassifyInput,
          errorMessage: `File preview is unavailable for file ${classificationFileId}. Classification data is still shown.`,
        };
      }
    },
    staleTime: Infinity,
    gcTime: FILE_PREVIEW_QUERY_GC_TIME,
  });
  const classifyViewerInput =
    classifyViewerQuery.data?.input ??
    (classificationQuery.data ? defaultClassifyInput : null);
  const classifyViewerError =
    open && supportedOperation === "classify" && classificationQuery.data
      ? !classificationFileId
        ? "This classification does not have an associated file."
        : (classifyViewerQuery.data?.errorMessage ?? null)
      : null;
  const isClassifyViewerLoading =
    open &&
    supportedOperation === "classify" &&
    Boolean(classificationQuery.data) &&
    Boolean(classificationFileId) &&
    (classifyViewerQuery.isLoading || classifyViewerQuery.isFetching);

  const editViewerQuery = useQuery({
    queryKey: [
      "processing-log-viewer",
      "edit",
      editId,
      editType,
      editQuery.data?.file?.id ?? null,
      editQuery.data?.filled_document_ref?.id ?? null,
      templateQuery.data?.file?.id ?? null,
    ],
    enabled:
      open &&
      supportedOperation === "edit" &&
      Boolean(editId) &&
      Boolean(editQuery.data) &&
      !editQuery.isLoading,
    queryFn: async (): Promise<{
      originalBuffer: ArrayBuffer | null;
      filledBuffer: ArrayBuffer | null;
      templatePdfBuffer: ArrayBuffer | null;
      errorMessage: string | null;
    }> => {
      const selectedEdit = editQuery.data;
      if (!selectedEdit) {
        return {
          originalBuffer: null,
          filledBuffer: null,
          templatePdfBuffer: null,
          errorMessage: null,
        };
      }

      let nextOriginalBuffer: ArrayBuffer | null = null;
      let nextFilledBuffer: ArrayBuffer | null = null;
      let nextTemplatePdfBuffer: ArrayBuffer | null = null;
      let nextError: string | null = null;

      if (editType === "agent" && selectedEdit.file?.id) {
        try {
          nextOriginalBuffer = (await fetchFileBuffer(selectedEdit.file.id))
            .buffer;
        } catch {
          nextError = "Failed to load original document.";
        }
      }

      if (selectedEdit.filled_document_ref?.id) {
        try {
          nextFilledBuffer = (
            await fetchFileBuffer(selectedEdit.filled_document_ref.id)
          ).buffer;
        } catch {
          nextError = nextError
            ? `${nextError} Failed to load filled document.`
            : "Failed to load filled document.";
        }
      }

      if (editType === "template" && templateQuery.data?.file?.id) {
        try {
          nextTemplatePdfBuffer = (
            await fetchFileBuffer(templateQuery.data.file.id)
          ).buffer;
        } catch {
          nextError = nextError
            ? `${nextError} Failed to load template source.`
            : "Failed to load template source.";
        }
      }

      return {
        originalBuffer: nextOriginalBuffer,
        filledBuffer: nextFilledBuffer,
        templatePdfBuffer: nextTemplatePdfBuffer,
        errorMessage: nextError,
      };
    },
    staleTime: Infinity,
    gcTime: FILE_PREVIEW_QUERY_GC_TIME,
  });
  const originalBuffer = editViewerQuery.data?.originalBuffer ?? null;
  const filledBuffer = editViewerQuery.data?.filledBuffer ?? null;
  const templatePdfBuffer = editViewerQuery.data?.templatePdfBuffer ?? null;
  const editViewerError = editViewerQuery.data?.errorMessage ?? null;
  const isEditViewerLoading =
    editViewerQuery.isLoading || editViewerQuery.isFetching;

  const editResponsePayload = useMemo<EditResponse | null>(() => {
    const selectedEdit = editQuery.data;
    if (!selectedEdit) return null;
    const formData = selectedEdit.output?.form_data ?? [];
    return {
      form_data: formData,
      filled_document: {
        filename:
          selectedEdit.filled_document_ref?.filename ||
          selectedEdit.file?.filename ||
          "filled_document",
        url: "",
      },
    };
  }, [editQuery.data]);

  const agentInputStates = useMemo<InputState[]>(() => {
    const selectedEdit = editQuery.data;
    const mimeType =
      selectedEdit?.file?.mime_type || "application/octet-stream";
    return [
      {
        id: "document",
        type: "file",
        fileBuffer: originalBuffer,
        fileName: selectedEdit?.file?.filename || null,
        fileMimeType: mimeType,
        textValue: "",
      },
      {
        id: "instructions",
        type: "json",
        fileBuffer: null,
        fileName: null,
        fileMimeType: "",
        textValue: selectedEdit?.instructions || "",
      },
    ];
  }, [editQuery.data, originalBuffer]);

  const templateInputStates = useMemo<InputState[]>(
    () => [
      {
        id: "instructions",
        type: "json",
        fileBuffer: null,
        fileName: null,
        fileMimeType: "",
        textValue: editQuery.data?.instructions || "",
      },
    ],
    [editQuery.data],
  );

  const agentViewerResult = useMemo<AgentEditResultState | null>(() => {
    const selectedEdit = editQuery.data;
    if (!selectedEdit || !editResponsePayload) return null;
    const fileName = selectedEdit.file?.filename || "document";
    const originalMimeType =
      selectedEdit.filled_document_ref?.mime_type ||
      selectedEdit.file?.mime_type ||
      "application/pdf";
    return {
      response: editResponsePayload,
      filledBuffer,
      originalBuffer,
      detectedFields: [],
      isPdfFile: isPdfFile(selectedEdit.file?.mime_type || "", fileName),
      originalMimeType,
      isDetecting: false,
    };
  }, [editQuery.data, editResponsePayload, filledBuffer, originalBuffer]);

  const templateViewerResult = useMemo<TemplateEditResultState | null>(() => {
    const selectedEdit = editQuery.data;
    if (!selectedEdit || !editResponsePayload) return null;
    return {
      response: editResponsePayload,
      filledBuffer,
      templateFields: templateQuery.data?.form_fields || [],
      templatePdfBuffer,
      templateId: selectedEdit.template_id || undefined,
      templateName: templateQuery.data?.name,
    };
  }, [
    editQuery.data,
    editResponsePayload,
    filledBuffer,
    templateQuery.data?.name,
    templateQuery.data?.form_fields,
    templatePdfBuffer,
  ]);

  const parseFileTabAvailable = Boolean(parseFilePreview);
  const parseFileTabVisible = Boolean(parseFilePreview || parseFileId);
  const resolvedParseOutputViewMode: PlaygroundOutputViewMode =
    parseOutputViewMode === "file" && !parseFileTabAvailable
      ? "text"
      : parseOutputViewMode === "text" ||
          parseOutputViewMode === "rendered" ||
          parseOutputViewMode === "file"
        ? parseOutputViewMode
        : "text";

  const editViewerTabs = useMemo(() => {
    const selectedEdit = editQuery.data;
    if (!selectedEdit) {
      return [];
    }

    const hasFilledOutput = Boolean(filledBuffer);
    const hasOriginal = Boolean(originalBuffer);
    if (editType === "template") {
      const hasTemplate =
        Boolean(templatePdfBuffer) &&
        (templateQuery.data?.form_fields?.length || 0) > 0;
      const tabs = [
        ...(hasTemplate
          ? [
              {
                label: "Template",
                value: "template" as PlaygroundOutputViewMode,
                icon: <FileSpreadsheet className="size-4" />,
              },
            ]
          : []),
        ...(hasFilledOutput
          ? [
              {
                label: "Filled",
                value: "filled" as PlaygroundOutputViewMode,
                icon: <FileText className="size-4" />,
              },
            ]
          : []),
      ];
      return tabs.length > 1 ? tabs : [];
    }

    const hasAgentTemplate =
      agentViewerResult?.isPdfFile === true &&
      (agentViewerResult.detectedFields?.length || 0) > 0 &&
      hasOriginal;
    const tabs = hasAgentTemplate
      ? [
          {
            label: "Template",
            value: "template" as PlaygroundOutputViewMode,
            icon: <FileSpreadsheet className="size-4" />,
          },
          ...(hasFilledOutput
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
          ...(hasFilledOutput
            ? [
                {
                  label: "Filled",
                  value: "filled" as PlaygroundOutputViewMode,
                  icon: <SquarePen className="size-4" />,
                },
              ]
            : []),
        ];

    return tabs.length > 1 ? tabs : [];
  }, [
    agentViewerResult,
    editQuery.data,
    editType,
    filledBuffer,
    originalBuffer,
    templatePdfBuffer,
    templateQuery.data?.form_fields,
  ]);

  const resolvedEditOutputViewMode: PlaygroundOutputViewMode =
    editViewerTabs.length > 0 &&
    !editViewerTabs.some((tab) => tab.value === editOutputViewMode)
      ? editViewerTabs.some((tab) => tab.value === "filled")
        ? "filled"
        : editViewerTabs[0].value
      : editOutputViewMode;

  const primitiveViewerHeaderAccessory =
    supportedOperation === "parse" && parseResult ? (
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
          ...(parseFileTabVisible
            ? [
                {
                  label: "File",
                  value: "file",
                  icon: <Paperclip className="size-4" />,
                  disabled: !parseFileTabAvailable,
                },
              ]
            : []),
        ]}
        value={resolvedParseOutputViewMode}
        onChange={(value) =>
          setParseOutputViewMode(value as PlaygroundOutputViewMode)
        }
      />
    ) : supportedOperation === "edit" && editViewerTabs.length > 0 ? (
      <AnimatedTabs
        tabs={editViewerTabs}
        value={resolvedEditOutputViewMode}
        onChange={(value) =>
          setEditOutputViewMode(value as PlaygroundOutputViewMode)
        }
      />
    ) : undefined;

  const primitiveOutputRenderOptions = useMemo<
    PlaygroundOutputRenderOptions | undefined
  >(() => {
    if (supportedOperation === "parse") {
      return {
        viewMode: resolvedParseOutputViewMode,
        onViewModeChange: setParseOutputViewMode,
      };
    }
    if (supportedOperation === "edit") {
      return {
        viewMode: resolvedEditOutputViewMode,
        onViewModeChange: setEditOutputViewMode,
      };
    }
    return undefined;
  }, [
    resolvedEditOutputViewMode,
    resolvedParseOutputViewMode,
    supportedOperation,
  ]);

  const modalClassName =
    supportedOperation === "extraction"
      ? MODAL_CLASS_EXTRACTION
      : MODAL_CLASS_DEFAULT;

  const extractionJsonSchema = useMemo<ExtendedJSONSchema7>(() => {
    const schema = extractionQuery.data?.json_schema;
    return (
      schema && typeof schema === "object" ? schema : EMPTY_JSON_SCHEMA
    ) as ExtendedJSONSchema7;
  }, [extractionQuery.data?.json_schema]);
  const primitiveOperation = getPrimitiveOperation(supportedOperation);
  const operationLabel =
    supportedOperation === "schema_generation"
      ? "Schema Generation"
      : undefined;
  const headerContextText = useMemo(() => {
    if (!processingLog) {
      return null;
    }
    if (supportedOperation === "extraction") {
      return (
        extractionQuery.data?.file?.filename ||
        processingLog.filename ||
        processingLog.id
      );
    }
    if (supportedOperation === "parse") {
      return (
        parseQuery.data?.file?.filename ||
        processingLog.filename ||
        processingLog.id
      );
    }
    if (supportedOperation === "split") {
      return (
        splitQuery.data?.file?.filename ||
        processingLog.filename ||
        processingLog.id
      );
    }
    if (supportedOperation === "classify") {
      return (
        classificationQuery.data?.file?.filename ||
        processingLog.filename ||
        processingLog.id
      );
    }
    if (supportedOperation === "edit") {
      return (
        editQuery.data?.file?.filename ||
        processingLog.filename ||
        processingLog.id
      );
    }
    if (supportedOperation === "schema_generation") {
      return (
        schemaGenerationQuery.data?.file?.filename ||
        processingLog.filename ||
        processingLog.id
      );
    }
    if (supportedOperation === "partition") {
      return (
        partitionQuery.data?.file?.filename ||
        processingLog.filename ||
        processingLog.id
      );
    }
    return (
      processingLog.filename ||
      new Date(processingLog.created_at ?? "").toLocaleString()
    );
  }, [
    processingLog,
    supportedOperation,
    extractionQuery.data?.file?.filename,
    parseQuery.data?.file?.filename,
    splitQuery.data?.file?.filename,
    classificationQuery.data?.file?.filename,
    editQuery.data?.file?.filename,
    schemaGenerationQuery.data?.file?.filename,
    partitionQuery.data?.file?.filename,
  ]);

  const downloadActions = useMemo<PrimitiveViewerDownloadAction[]>(() => {
    const actions: PrimitiveViewerDownloadAction[] = [];
    const addFileDownloadAction = ({
      id,
      label,
      fileId,
      filename,
      mimeType,
      fallbackBuffer,
    }: {
      id: string;
      label: string;
      fileId: string | null | undefined;
      filename: string | null | undefined;
      mimeType: string | null | undefined;
      fallbackBuffer?: ArrayBuffer | null;
    }) => {
      if (!fileId && !fallbackBuffer) {
        return;
      }
      actions.push({
        id,
        label,
        run: async () => {
          if (fallbackBuffer) {
            downloadBuffer({
              buffer: fallbackBuffer,
              filename: filename || "document",
              mimeType: mimeType || "application/octet-stream",
            });
            return;
          }
          if (!fileId) {
            return;
          }
          const file = await fetchFileBuffer(fileId);
          downloadBuffer({
            buffer: file.buffer,
            filename: filename || "document",
            mimeType: mimeType || file.mimeType || "application/octet-stream",
          });
        },
      });
    };

    if (supportedOperation === "extraction" && extractionQuery.data) {
      addFileDownloadAction({
        id: "extract-document",
        label: "Download document",
        fileId: extractionQuery.data.file?.id,
        filename: extractionQuery.data.file?.filename,
        mimeType: extractionQuery.data.file?.mime_type,
      });
      actions.push({
        id: "extract-schema",
        label: "Download schema JSON",
        run: () =>
          downloadJson(
            extractionQuery.data?.json_schema ?? {},
            jsonFilename("extraction-schema", extractionId),
          ),
      });
      actions.push({
        id: "extract-output",
        label: "Download extraction JSON",
        run: () =>
          downloadJson(
            extractionQuery.data?.output ?? {},
            jsonFilename("extraction-output", extractionId),
          ),
      });
      if (extractionQuery.data.consensus?.likelihoods) {
        actions.push({
          id: "extract-likelihoods",
          label: "Download likelihoods JSON",
          run: () =>
            downloadJson(
              extractionQuery.data?.consensus?.likelihoods ?? {},
              jsonFilename("extraction-likelihoods", extractionId),
            ),
        });
      }
    }

    if (supportedOperation === "parse") {
      addFileDownloadAction({
        id: "parse-document",
        label: "Download full document",
        fileId: parseFileId,
        filename: parseQuery.data?.file?.filename,
        mimeType: parseQuery.data?.file?.mime_type,
        fallbackBuffer: parseFilePreview?.buffer ?? null,
      });
      if (parseResult) {
        actions.push({
          id: "parse-markdown",
          label: "Download parsed result (.md)",
          run: () => {
            const pages = parseResult.output.pages;
            const markdown =
              pages.length > 0
                ? buildMarkdownFromPages(pages)
                : parseResult.output.text;
            downloadMarkdown(
              markdown,
              `parsed-result${parseId ? `-${parseId}` : ""}.md`,
            );
          },
        });
      }
    }

    if (supportedOperation === "split") {
      addFileDownloadAction({
        id: "split-document",
        label: "Download full document",
        fileId: splitFileId,
        filename: splitQuery.data?.file?.filename,
        mimeType: splitQuery.data?.file?.mime_type,
        fallbackBuffer: splitPreviewQuery.data?.buffer ?? null,
      });
    }

    if (supportedOperation === "classify") {
      addFileDownloadAction({
        id: "classify-document",
        label: "Download document",
        fileId: classificationFileId,
        filename:
          classificationQuery.data?.file?.filename ||
          classifyViewerInput?.fileName,
        mimeType:
          classificationQuery.data?.file?.mime_type ||
          classifyViewerInput?.fileMimeType,
        fallbackBuffer: classifyViewerInput?.fileBuffer ?? null,
      });
    }

    if (supportedOperation === "edit" && editQuery.data) {
      addFileDownloadAction({
        id: "edit-input-document",
        label: "Download input document",
        fileId: editQuery.data.file?.id,
        filename: editQuery.data.file?.filename,
        mimeType: editQuery.data.file?.mime_type,
        fallbackBuffer: originalBuffer,
      });
      if (editType === "template" && isPdfFileRef(templateQuery.data?.file)) {
        addFileDownloadAction({
          id: "edit-template",
          label: "Download template",
          fileId: templateQuery.data?.file?.id,
          filename: templateQuery.data?.file?.filename,
          mimeType: templateQuery.data?.file?.mime_type,
          fallbackBuffer: templatePdfBuffer,
        });
      }
      addFileDownloadAction({
        id: "edit-filled-output",
        label: "Download filled output",
        fileId: editQuery.data.filled_document_ref?.id,
        filename: editQuery.data.filled_document_ref?.filename,
        mimeType: editQuery.data.filled_document_ref?.mime_type,
        fallbackBuffer: filledBuffer,
      });
    }

    if (
      supportedOperation === "schema_generation" &&
      schemaGenerationQuery.data
    ) {
      addFileDownloadAction({
        id: "schema-generation-document",
        label: "Download document",
        fileId: schemaGenerationQuery.data.file?.id,
        filename: schemaGenerationQuery.data.file?.filename,
        mimeType: schemaGenerationQuery.data.file?.mime_type,
      });
      actions.push({
        id: "schema-generation-schema",
        label: "Download schema JSON",
        run: () =>
          downloadJson(
            schemaGenerationQuery.data?.json_schema ?? {},
            jsonFilename("generated-schema", schemaGenerationId),
          ),
      });
    }

    if (supportedOperation === "partition") {
      addFileDownloadAction({
        id: "partition-document",
        label: "Download partition document",
        fileId: partitionFileId,
        filename: partitionQuery.data?.file?.filename,
        mimeType: partitionQuery.data?.file?.mime_type,
        fallbackBuffer: partitionPreviewQuery.data?.buffer ?? null,
      });
    }

    return actions;
  }, [
    supportedOperation,
    extractionQuery.data,
    extractionId,
    parseFileId,
    parseQuery.data?.file?.filename,
    parseQuery.data?.file?.mime_type,
    parseFilePreview?.buffer,
    parseResult,
    parseId,
    splitFileId,
    splitQuery.data?.file?.filename,
    splitQuery.data?.file?.mime_type,
    splitPreviewQuery.data?.buffer,
    classificationFileId,
    classificationQuery.data?.file?.filename,
    classificationQuery.data?.file?.mime_type,
    classifyViewerInput,
    editQuery.data,
    editType,
    originalBuffer,
    templateQuery.data?.file,
    templatePdfBuffer,
    filledBuffer,
    schemaGenerationQuery.data,
    schemaGenerationId,
    partitionFileId,
    partitionQuery.data?.file?.filename,
    partitionQuery.data?.file?.mime_type,
    partitionPreviewQuery.data?.buffer,
    fetchFileBuffer,
  ]);

  const renderContent = () => {
    if (!processingLog) {
      return (
        <UnavailableState
          processingLog={processingLog}
          reason="No processing log selected."
        />
      );
    }
    if (getMissingLinkReason) {
      return (
        <UnavailableState
          processingLog={processingLog}
          reason={getMissingLinkReason}
        />
      );
    }
    if (supportedOperation === "extraction" && extractionId) {
      if (extractionQuery.isLoading && !extractionQuery.data) {
        return <LoadingState message="Loading extraction viewer..." />;
      }
      if (extractionQuery.isError) {
        return (
          <UnavailableState
            processingLog={processingLog}
            reason="Extraction result was not found."
          />
        );
      }
      return (
        <OCRProvider>
          <JsonSchemaEditorProvider jsonSchema={extractionJsonSchema}>
            <ExtractionComponent
              extractionId={extractionId}
              extractionDisplayOptions={{
                showTabs: true,
                showDisplayTabs: true,
              }}
            />
          </JsonSchemaEditorProvider>
        </OCRProvider>
      );
    }
    if (supportedOperation === "parse") {
      if (parseQuery.isLoading) {
        return <LoadingState message="Loading parse viewer..." />;
      }
      if (parseQuery.isError || !parseResult) {
        return (
          <UnavailableState
            processingLog={processingLog}
            reason="Parse result was not found."
          />
        );
      }
      return (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {isParseFileLoading && (
            <div className="text-muted-foreground absolute top-3 right-3 z-20 flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-xs shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Loading file preview...</span>
            </div>
          )}
          <ParseOutputRendererView
            parseResult={parseResult}
            filePreview={parseFilePreview}
            options={primitiveOutputRenderOptions}
          />
        </div>
      );
    }
    if (supportedOperation === "split") {
      if (splitQuery.isLoading || splitInputStates.length === 0) {
        return <LoadingState message="Loading split viewer..." />;
      }
      if (splitQuery.isError || !splitResult) {
        return (
          <UnavailableState
            processingLog={processingLog}
            reason="Split result was not found."
          />
        );
      }
      return (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {isSplitFileLoading && (
            <div className="text-muted-foreground absolute top-3 right-3 z-20 flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-xs shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Loading file preview...</span>
            </div>
          )}
          <SplitOutputRendererView
            splitResult={splitResult}
            splitInputStates={splitInputStates}
          />
        </div>
      );
    }
    if (supportedOperation === "classify") {
      if (classificationQuery.isLoading || !classifyResult) {
        return <LoadingState message="Loading classification viewer..." />;
      }
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          {isClassifyViewerLoading && (
            <div className="text-muted-foreground flex items-center gap-2 border-b px-4 py-2 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading document preview...
            </div>
          )}
          {classifyViewerError && (
            <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-700">
              {classifyViewerError}
            </div>
          )}
          <ClassifierResultViewer
            result={classifyResult}
            documentInput={classifyViewerInput || defaultClassifyInput}
          />
        </div>
      );
    }
    if (supportedOperation === "edit") {
      if (isEditViewerLoading || editQuery.isLoading) {
        return <LoadingState message="Loading edit viewer..." />;
      }
      if (!editQuery.data) {
        return (
          <UnavailableState
            processingLog={processingLog}
            reason="Edit result was not found."
          />
        );
      }
      return (
        <div className="flex h-full min-h-0 flex-col">
          {editViewerError && (
            <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              {editViewerError}
            </div>
          )}
          {editType === "template" ? (
            <TemplateEditOutputRendererView
              templateViewerResult={templateViewerResult}
              templateInputStates={templateInputStates}
              options={primitiveOutputRenderOptions}
            />
          ) : (
            <AgentEditOutputRendererView
              agentViewerResult={agentViewerResult}
              agentInputStates={agentInputStates}
              options={primitiveOutputRenderOptions}
            />
          )}
        </div>
      );
    }
    if (supportedOperation === "schema_generation") {
      if (schemaGenerationQuery.isLoading) {
        return <LoadingState message="Loading schema generation viewer..." />;
      }
      if (schemaGenerationQuery.isError || !schemaGenerationQuery.data) {
        return (
          <UnavailableState
            processingLog={processingLog}
            reason="Schema generation result was not found."
          />
        );
      }
      return (
        <SchemaGenerationOutputRendererView
          jsonSchema={schemaGenerationQuery.data.json_schema}
          filename={schemaGenerationQuery.data.file?.filename}
        />
      );
    }
    if (supportedOperation === "partition") {
      if (partitionQuery.isLoading || partitionInputStates.length === 0) {
        return <LoadingState message="Loading partition viewer..." />;
      }
      if (partitionQuery.isError || !partitionResult) {
        return (
          <UnavailableState
            processingLog={processingLog}
            reason="Partition result was not found."
          />
        );
      }
      return (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {isPartitionFileLoading && (
            <div className="text-muted-foreground absolute top-3 right-3 z-20 flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-xs shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Loading file preview...</span>
            </div>
          )}
          {PartitionOutputRenderer(
            partitionResult,
            partitionInputStates,
            false,
          )}
        </div>
      );
    }
    return (
      <UnavailableState
        processingLog={processingLog}
        reason="No dedicated viewer for this operation."
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${modalClassName} flex flex-col gap-0`}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Processing log viewer</DialogTitle>
        <PrimitiveViewerShell
          operation={primitiveOperation}
          operationLabel={operationLabel}
          contextText={headerContextText}
          actions={downloadActions}
          accessory={primitiveViewerHeaderAccessory}
          onClose={() => onOpenChange(false)}
          className="h-full"
        >
          {renderContent()}
        </PrimitiveViewerShell>
      </DialogContent>
    </Dialog>
  );
}
