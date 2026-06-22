import {
  Bot,
  Braces,
  FileText,
  GitBranch,
  Layers2,
  Paperclip,
  Scissors,
  Tags,
} from "lucide-react";

import type {
  DemoBlockConfig,
  DemoBlockType,
  DemoHandleSpec,
  DemoHandleType,
  DemoNodeDefinition,
} from "./workflow-demo-types";

function routeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function outputHandle(type: DemoHandleType, key: string): string {
  return `output-${type}-${routeKey(key)}`;
}

export const nodeDefinitions: Record<DemoBlockType, DemoNodeDefinition> = {
  start_document: {
    type: "start_document",
    label: "Input",
    description: "Input documents to the workflow",
    icon: Paperclip,
    color: "var(--color-success)",
    defaultConfig: {},
  },
  split: {
    type: "split",
    label: "Split Documents",
    description: "Split documents into subdocuments",
    icon: Scissors,
    color: "var(--color-warning)",
    defaultConfig: {
      model: "retab-small",
      subdocuments: [],
    },
  },
  extract: {
    type: "extract",
    label: "Extract",
    description: "Extract data from documents",
    icon: Layers2,
    color: "var(--color-feature)",
    defaultConfig: {
      model: "retab-small",
      json_schema: {
        type: "object",
        properties: {},
      },
    },
  },
  edit: {
    type: "edit",
    label: "Edit",
    description: "Edit documents with extracted context",
    icon: FileText,
    color: "var(--color-success)",
    defaultConfig: { model: "retab-small" },
  },
  classifier: {
    type: "classifier",
    label: "Classify",
    description: "Classify documents into routes",
    icon: Tags,
    color: "var(--color-info)",
    defaultConfig: { categories: [] },
  },
  parse: {
    type: "parse",
    label: "Parse",
    description: "Parse document pages",
    icon: Bot,
    color: "var(--color-info)",
    defaultConfig: { model: "retab-small" },
  },
  conditional: {
    type: "conditional",
    label: "Condition",
    description: "Branch on structured values",
    icon: GitBranch,
    color: "var(--color-warning)",
    defaultConfig: { conditions: [], has_else: true },
  },
};

export const handleColorMap: Record<DemoHandleType, string> = {
  file: "var(--color-info)",
  json: "var(--color-feature)",
};

export const handleIconMap: Record<
  DemoHandleType,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  file: Paperclip,
  json: Braces,
};

export function getInputHandles(blockType: DemoBlockType): DemoHandleSpec[] {
  if (blockType === "start_document") return [];
  if (blockType === "extract") {
    return [{ id: "input-file-document", type: "file", label: "document" }];
  }
  if (blockType === "split") {
    return [{ id: "input-file-0", type: "file", label: "document" }];
  }
  return [{ id: "input-file-0", type: "file", label: "document" }];
}

export function getOutputHandles(
  blockType: DemoBlockType,
  config: DemoBlockConfig,
): DemoHandleSpec[] {
  if (blockType === "start_document") {
    return [{ id: "output-file-0", type: "file", label: "document" }];
  }
  if (blockType === "extract") {
    return [{ id: "output-json-0", type: "json", label: "data" }];
  }
  if (blockType === "split" && Array.isArray(config.subdocuments)) {
    return (
      config.subdocuments as Array<{
        name?: string;
        handle_key?: string | null;
      }>
    ).flatMap((subdocument) => {
      const name = typeof subdocument.name === "string" ? subdocument.name : "";
      const handleKey =
        typeof subdocument.handle_key === "string"
          ? subdocument.handle_key
          : routeKey(name);

      if (!handleKey) return [];
      return [
        {
          id: outputHandle("file", handleKey),
          type: "file",
          label: name || handleKey,
        },
      ];
    });
  }
  return [];
}
