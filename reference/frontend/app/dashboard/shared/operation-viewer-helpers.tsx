"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { Editor } from "@/components/lazy/monaco-editor";

import type { ParseResponse } from "@/app/dashboard/widgets/types/parse";
import type { SplitView } from "@/app/dashboard/widgets/types/split";

import { ParseOutputRenderer } from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/parse-playground";
import { SplitOutputRenderer } from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/split-playground";
import {
  AgentEditOutputRenderer,
  type AgentEditResultState,
} from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/agent-edit-playground";
import {
  TemplateEditOutputRenderer,
  type TemplateEditResultState,
} from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/template-edit-playground";
import type {
  InputState,
  PlaygroundOutputRenderOptions,
} from "@/app/dashboard/workflows/[workflowId]/shared/playgrounds/execute-playground";
import type { FormField } from "@/app/dashboard/widgets/types/edit";

// ---------------------------------------------------------------------------
// UnavailableState – generic "viewer not available" placeholder
// ---------------------------------------------------------------------------

export function UnavailableState({
  title,
  reason,
  details,
}: {
  title?: string;
  reason: string;
  details?: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 p-6 text-center">
      <AlertCircle className="h-8 w-8 text-amber-600" />
      <p className="text-foreground text-sm font-medium">
        {title ?? "Viewer unavailable."}
      </p>
      <p className="text-muted-foreground text-xs">{reason}</p>
      {details}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoadingState – spinner with message
// ---------------------------------------------------------------------------

export function LoadingState({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground flex h-full min-h-[320px] items-center justify-center gap-2 text-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thin renderer wrappers (call the playground renderer functions)
// ---------------------------------------------------------------------------

export function ParseOutputRendererView({
  parseResult,
  filePreview,
  options,
}: {
  parseResult: ParseResponse;
  filePreview?: { buffer: ArrayBuffer; mimeType: string } | null;
  options?: PlaygroundOutputRenderOptions;
}) {
  if (filePreview) {
    return (
      <>{ParseOutputRenderer(parseResult, [], false, filePreview, options)}</>
    );
  }
  return <>{ParseOutputRenderer(parseResult, [], false, options)}</>;
}

export function SplitOutputRendererView({
  splitResult,
  splitInputStates,
}: {
  splitResult: SplitView | null;
  splitInputStates: InputState[];
}) {
  return <>{SplitOutputRenderer(splitResult, splitInputStates, false)}</>;
}

export function TemplateEditOutputRendererView({
  templateViewerResult,
  templateInputStates,
  options,
}: {
  templateViewerResult: TemplateEditResultState | null;
  templateInputStates: InputState[];
  options?: PlaygroundOutputRenderOptions;
}) {
  return (
    <>
      {TemplateEditOutputRenderer(
        templateViewerResult,
        templateInputStates,
        false,
        options,
      )}
    </>
  );
}

export function AgentEditOutputRendererView({
  agentViewerResult,
  agentInputStates,
  options,
}: {
  agentViewerResult: AgentEditResultState | null;
  agentInputStates: InputState[];
  options?: PlaygroundOutputRenderOptions;
}) {
  return (
    <>
      {AgentEditOutputRenderer(
        agentViewerResult,
        agentInputStates,
        false,
        options,
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// SchemaGenerationOutputRendererView – read-only JSON schema display
// ---------------------------------------------------------------------------

export function SchemaGenerationOutputRendererView({
  jsonSchema,
  filename,
}: {
  jsonSchema: Record<string, unknown>;
  filename?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {filename && (
        <div className="text-muted-foreground border-b px-4 py-2 text-xs">
          Source: {filename}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <Editor
          language="json"
          value={JSON.stringify(jsonSchema, null, 2)}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// mapFilledFieldsToFormData – used by edit viewers
// ---------------------------------------------------------------------------

export function mapFilledFieldsToFormData(
  fields: Array<{
    key?: string;
    description: string;
    field_type: string;
    value: string | null;
  }>,
): FormField[] {
  return fields.map((field, index) => ({
    key: field.key || `field_${index}`,
    description: field.description || field.key || `Field ${index + 1}`,
    type: field.field_type === "checkbox" ? "checkbox" : "text",
    value: field.value,
    bbox: {
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      page: 1,
    },
  }));
}

// ---------------------------------------------------------------------------
// Endpoint → operation mapping (for jobs)
// ---------------------------------------------------------------------------

export type OperationType =
  | "extraction"
  | "parse"
  | "split"
  | "classify"
  | "edit";

const ENDPOINT_TO_OPERATION: Record<string, OperationType> = {
  // New resource-oriented routes (migration target).
  "/v1/extractions": "extraction",
  "/v1/extractions/stream": "extraction",
  "/v1/parses": "parse",
  "/v1/splits": "split",
  "/v1/classifications": "classify",
  "/v1/edits": "edit",
  "/v1/edits/templates/generate": "edit",
  "/v1/edit/agent/fill": "edit",
  "/v1/edit/templates/generate": "edit",
};

export function mapEndpointToOperation(endpoint: string): OperationType | null {
  if (endpoint.endsWith("/classify")) {
    return "classify";
  }
  return ENDPOINT_TO_OPERATION[endpoint] ?? null;
}

export function getEditTypeFromEndpoint(
  endpoint: string,
): "agent" | "template" {
  if (endpoint === "/v1/edits" || endpoint === "/v1/edit/agent/fill") {
    return "agent";
  }
  return "template";
}

// ---------------------------------------------------------------------------
// Modal size classes (shared between logs & job modals)
// ---------------------------------------------------------------------------

export const MODAL_CLASS_EXTRACTION =
  "sm:w-[90vw] sm:max-w-[90vw] w-[90vw] h-[80vh] max-h-[80vh] p-0 m-0 overflow-hidden";
export const MODAL_CLASS_DEFAULT =
  "sm:w-3xl sm:max-w-3xl w-3xl h-[95vh] max-h-[95vh] p-0 m-0 overflow-hidden flex flex-col";

// ---------------------------------------------------------------------------
// MIMEData base64 → ArrayBuffer decoder
// ---------------------------------------------------------------------------

export function mimeDataUrlToArrayBuffer(url: string): ArrayBuffer | null {
  try {
    const commaIndex = url.indexOf(",");
    if (commaIndex === -1) return null;
    const base64 = url.slice(commaIndex + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch {
    return null;
  }
}
