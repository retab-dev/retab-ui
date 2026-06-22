"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Bot, Braces, ChevronDown, ChevronRight, Tags, X } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  getInputHandles,
  getOutputHandles,
  handleColorMap,
  handleIconMap,
  nodeDefinitions,
} from "./workflow-demo-registry";
import {
  START_NODE_ID,
  type DemoBlockConfig,
  type DemoBlockType,
  type DemoHandleSpec,
  type DemoNode,
} from "./workflow-demo-types";

function getDefaultIconClass(type: DemoHandleSpec["type"]): string {
  return type === "json" ? "text-feature" : "text-info";
}

function getModelIconClass(blockType: DemoBlockType): string {
  if (blockType === "extract") return "text-feature";
  if (blockType === "split") return "text-warning";
  if (blockType === "classifier" || blockType === "parse") return "text-info";
  return "text-muted-foreground";
}

function RetabModelMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 210 216"
    >
      <rect y="108" width="58" height="54" fill="currentColor" />
      <rect width="58" height="54" fill="currentColor" />
      <rect x="58" y="54" width="152" height="54" fill="currentColor" />
      <rect x="58" y="162" width="152" height="54" fill="currentColor" />
    </svg>
  );
}

function WorkflowHandle({
  handle,
  io,
}: {
  handle: DemoHandleSpec;
  io: "source" | "target";
}) {
  const Icon = handleIconMap[handle.type];
  const isSplitOutput =
    io === "source" && handle.type === "file" && handle.id !== "output-file-0";
  const sizeClass = isSplitOutput ? "!h-6 !w-6" : "!h-7 !w-7";
  const iconSizeClass = isSplitOutput ? "h-2.5 w-2.5" : "h-3 w-3";
  const labelSpan = handle.label ? (
    <span className="bg-card/70 text-muted-foreground truncate rounded px-2 py-1 text-[10px] font-medium">
      {handle.label}
    </span>
  ) : null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        io === "target" ? "justify-end" : "justify-start",
        isSplitOutput && "max-w-[100px]",
      )}
      draggable={false}
    >
      {io === "target" ? labelSpan : null}
      <div className="relative">
        <Handle
          type={io}
          position={io === "source" ? Position.Right : Position.Left}
          id={handle.id}
          className={cn(
            "!relative !top-auto !left-auto !flex !transform-none !items-center !justify-center !rounded-full !border-2",
            sizeClass,
          )}
          style={{
            background: "var(--color-card)",
            borderColor: handleColorMap[handle.type],
          }}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Icon
            className={cn(iconSizeClass, getDefaultIconClass(handle.type))}
          />
        </div>
      </div>
      {io === "source" ? labelSpan : null}
    </div>
  );
}

function getModel(config: DemoBlockConfig): string {
  return typeof config.model === "string" ? config.model : "retab-small";
}

function getSchemaTitle(config: DemoBlockConfig): string {
  const schema = config.json_schema;
  if (typeof schema === "object" && schema !== null) {
    const title = (schema as { title?: unknown }).title;
    if (typeof title === "string" && title.trim()) {
      return title;
    }
  }
  return "Schema";
}

function getSubdocuments(config: DemoBlockConfig): string[] {
  if (!Array.isArray(config.subdocuments)) return [];
  return config.subdocuments.flatMap((subdocument) => {
    if (
      typeof subdocument === "object" &&
      subdocument !== null &&
      typeof (subdocument as { name?: unknown }).name === "string"
    ) {
      return [(subdocument as { name: string }).name];
    }
    return [];
  });
}

function StaticModelTrigger({ model }: { model: string }) {
  return (
    <span className="border-border bg-card text-foreground inline-flex h-7 min-w-[148px] items-center justify-between gap-3 rounded-md border px-2 pr-1 text-xs font-semibold shadow-sm">
      <span className="inline-flex min-w-0 items-center gap-2 truncate">
        <RetabModelMark className="size-3 shrink-0" />
        <span className="truncate">{model}</span>
      </span>
      <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
    </span>
  );
}

function ModelRow({
  blockType,
  config,
}: {
  blockType: DemoBlockType;
  config: DemoBlockConfig;
}) {
  if (blockType !== "extract" && blockType !== "split") return null;

  return (
    <div className="bg-muted/50 rounded-lg p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className={cn("h-3.5 w-3.5", getModelIconClass(blockType))} />
          <span className="text-muted-foreground text-[10px] font-medium">
            Model
          </span>
        </div>
        <StaticModelTrigger model={getModel(config)} />
      </div>
    </div>
  );
}

function SplitConfig({ config }: { config: DemoBlockConfig }) {
  const subdocuments = getSubdocuments(config);
  if (subdocuments.length === 0) return null;

  return (
    <div className="bg-muted/50 rounded-lg p-3 transition-colors">
      <div className="mb-2 flex items-center gap-2">
        <Tags className="text-warning h-3.5 w-3.5" />
        <span className="text-muted-foreground text-[10px] font-medium">
          Subdocuments
        </span>
        <ChevronRight className="text-muted-foreground/60 ml-auto h-3 w-3" />
      </div>
      <div className="flex flex-wrap gap-1">
        {subdocuments.map((subdocument) => (
          <span
            className="bg-warning/15 text-warning inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium"
            key={subdocument}
          >
            {subdocument}
          </span>
        ))}
      </div>
    </div>
  );
}

function ExtractConfig({ config }: { config: DemoBlockConfig }) {
  return (
    <div className="border-border bg-card rounded-lg border p-3 transition-colors">
      <div className="flex items-center gap-3">
        <div className="bg-feature/15 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
          <Braces className="text-feature h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-foreground text-xs font-medium">Schema</h4>
          <p className="text-muted-foreground truncate text-[10px]">
            {getSchemaTitle(config)}
          </p>
        </div>
        <ChevronDown className="text-muted-foreground/60 h-4 w-4" />
      </div>
    </div>
  );
}

function NodeConfig({
  blockType,
  config,
}: {
  blockType: DemoBlockType;
  config: DemoBlockConfig;
}) {
  if (blockType === "start_document") return null;

  return (
    <div className="space-y-3 px-4 pb-3">
      <ModelRow blockType={blockType} config={config} />
      {blockType === "split" ? <SplitConfig config={config} /> : null}
      {blockType === "extract" ? <ExtractConfig config={config} /> : null}
    </div>
  );
}

interface WorkflowDemoNodeProps extends NodeProps<DemoNode> {
  onDeleteNode: (nodeId: string) => void;
}

function WorkflowDemoNodeInner({
  id,
  data,
  selected,
  onDeleteNode,
}: WorkflowDemoNodeProps) {
  const definition = nodeDefinitions[data.blockType];
  const Icon = definition.icon;
  const inputHandles = getInputHandles(data.blockType);
  const outputHandles = getOutputHandles(data.blockType, data.config);
  const canDelete = id !== START_NODE_ID;

  return (
    <div className="group relative flex items-center gap-2">
      {inputHandles.length > 0 ? (
        <div className="absolute top-1/2 right-full mr-2 flex -translate-y-1/2 flex-col gap-1">
          {inputHandles.map((handle) => (
            <WorkflowHandle handle={handle} io="target" key={handle.id} />
          ))}
        </div>
      ) : null}

      <div className="relative">
        {canDelete ? (
          <button
            aria-label={`Delete ${data.label}`}
            className="nodrag border-border bg-card text-muted-foreground/60 hover:border-destructive/25 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border p-0 shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteNode(id);
            }}
            type="button"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <div
          className={cn(
            "bg-card w-[280px] rounded-xl border transition-all duration-300 ease-out",
            selected ? "border-ring ring-ring/30 ring-2" : "border-border",
          )}
        >
          <div className="border-border flex items-center gap-3 border-b px-4 py-3">
            <Icon
              className="h-5 w-5 flex-shrink-0"
              style={{ color: data.color, filter: "brightness(1.0)" }}
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-foreground truncate text-base font-medium">
                {data.label}
              </h3>
            </div>
          </div>
          <p className="text-muted-foreground px-4 py-2 text-xs leading-relaxed">
            {definition.description}
          </p>
          <NodeConfig blockType={data.blockType} config={data.config} />
        </div>
      </div>

      {outputHandles.length > 0 ? (
        <div className="absolute top-1/2 left-full ml-2 flex -translate-y-1/2 flex-col gap-1">
          {outputHandles.map((handle) => (
            <WorkflowHandle handle={handle} io="source" key={handle.id} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const WorkflowDemoNode = memo(WorkflowDemoNodeInner);
