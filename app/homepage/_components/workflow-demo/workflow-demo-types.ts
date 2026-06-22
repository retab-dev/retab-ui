import type { CSSProperties } from "react";
import type { Edge, Node } from "@xyflow/react";

export type DemoHandleType = "file" | "json";

export type DemoBlockType =
  | "start_document"
  | "extract"
  | "edit"
  | "classifier"
  | "parse"
  | "split"
  | "conditional";

export interface DemoBlockConfig {
  [key: string]: unknown;
}

export interface DemoHandleSpec {
  id: string;
  type: DemoHandleType;
  label?: string;
}

export interface DemoNodeData extends Record<string, unknown> {
  blockType: DemoBlockType;
  label: string;
  color: string;
  config: DemoBlockConfig;
}

export interface DemoNodeDefinition {
  type: DemoBlockType;
  label: string;
  description: string;
  icon: React.ComponentType<{
    className?: string;
    style?: CSSProperties;
  }>;
  color: string;
  defaultConfig: DemoBlockConfig;
}

export type DemoNode = Node<DemoNodeData>;
export type DemoEdge = Edge;

export const DEMO_NODE_TYPE = "demo-node";
export const START_NODE_ID = "start_document-node";

export interface DemoGraphState {
  nodes: DemoNode[];
  edges: DemoEdge[];
}
