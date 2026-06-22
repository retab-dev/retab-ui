import type { CSSProperties } from "react";
import { MarkerType } from "@xyflow/react";

import { clone } from "./workflow-demo-utils";
import {
  DEMO_NODE_TYPE,
  START_NODE_ID,
  type DemoBlockType,
  type DemoEdge,
  type DemoGraphState,
  type DemoNode,
} from "./workflow-demo-types";
import { handleColorMap, nodeDefinitions } from "./workflow-demo-registry";

const SUBDOCUMENT_NAMES = ["ACORD Form", "Police Report", "Medical Records"];

const CLAIMS_EXTRACTION_SCHEMA = {
  title: "ClaimsDataExtraction",
  description:
    "Structured fields extracted from an insurance claims packet sub-document.",
  type: "object",
  additionalProperties: false,
  required: ["claim", "claimant", "incident"],
  properties: {
    claim: {
      type: "object",
      required: ["claim_number", "policy_number", "date_of_loss", "claim_type"],
      properties: {
        claim_number: { type: "string" },
        policy_number: { type: "string" },
        date_of_loss: { type: "string", format: "date" },
        claim_type: {
          type: "string",
          enum: ["auto", "property", "liability", "workers_comp", "health"],
        },
      },
    },
    claimant: {
      type: "object",
      required: ["full_name", "phone", "address"],
      properties: {
        full_name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string", format: "email" },
      },
    },
    incident: {
      type: "object",
      required: ["description", "location"],
      properties: {
        description: { type: "string" },
        location: { type: "string" },
        police_report_number: { type: "string" },
        injuries_reported: { type: "boolean" },
      },
    },
  },
};

function defaultNode(
  blockType: DemoBlockType,
  position: { x: number; y: number },
  customId: string,
): DemoNode {
  const definition = nodeDefinitions[blockType];

  return {
    id: customId,
    type: DEMO_NODE_TYPE,
    position,
    data: {
      blockType,
      label: definition.label,
      color: definition.color,
      config: clone(definition.defaultConfig),
    },
  };
}

function withDemoAnimation(node: DemoNode, animationDelayMs: number): DemoNode {
  return {
    ...node,
    className: "workflow-demo-graph-node",
    style: {
      ...node.style,
      "--workflow-demo-node-delay": `${animationDelayMs}ms`,
    } as CSSProperties,
  };
}

function createDefaultEdge({
  source,
  sourceHandle,
  target,
  targetHandle,
  animationDelayMs,
}: {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
  animationDelayMs: number;
}): DemoEdge {
  const handleType = sourceHandle.split("-")[1];
  const edgeColor =
    handleType === "json" ? handleColorMap.json : handleColorMap.file;

  return {
    id: `edge-${source}-${sourceHandle}-${target}-${targetHandle}`,
    source,
    sourceHandle,
    target,
    targetHandle,
    type: "smoothstep",
    animated: true,
    className: "workflow-demo-graph-edge",
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
    style: {
      stroke: edgeColor,
      strokeWidth: 2,
      "--workflow-demo-edge-delay": `${animationDelayMs}ms`,
    } as CSSProperties,
  };
}

export function buildDefaultWorkflowDemoState(): DemoGraphState {
  const claimsPacket = withDemoAnimation(
    defaultNode("start_document", { x: -160, y: 300 }, START_NODE_ID),
    80,
  );
  claimsPacket.data.label = "Claims Packet";

  const splitDocs = withDemoAnimation(
    defaultNode("split", { x: 320, y: 240 }, "split-docs-node"),
    240,
  );
  splitDocs.data.label = "Split Documents";
  splitDocs.data.config = {
    ...splitDocs.data.config,
    subdocuments: SUBDOCUMENT_NAMES.map((name) => ({
      name,
      handle_key: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      description: "",
    })),
  };

  const extractAcord = withDemoAnimation(
    defaultNode("extract", { x: 780, y: 0 }, "extract-acord-node"),
    420,
  );
  extractAcord.data.label = "Extract ACORD";
  extractAcord.data.config = {
    ...extractAcord.data.config,
    json_schema: CLAIMS_EXTRACTION_SCHEMA,
  };

  const extractPolice = withDemoAnimation(
    defaultNode("extract", { x: 780, y: 240 }, "extract-police-node"),
    540,
  );
  extractPolice.data.label = "Extract Police Report";
  extractPolice.data.config = {
    ...extractPolice.data.config,
    json_schema: CLAIMS_EXTRACTION_SCHEMA,
  };

  const extractMedical = withDemoAnimation(
    defaultNode("extract", { x: 780, y: 480 }, "extract-medical-node"),
    660,
  );
  extractMedical.data.label = "Extract Medical Records";
  extractMedical.data.config = {
    ...extractMedical.data.config,
    json_schema: CLAIMS_EXTRACTION_SCHEMA,
  };

  return {
    nodes: [
      claimsPacket,
      splitDocs,
      extractAcord,
      extractPolice,
      extractMedical,
    ],
    edges: [
      createDefaultEdge({
        source: START_NODE_ID,
        sourceHandle: "output-file-0",
        target: "split-docs-node",
        targetHandle: "input-file-0",
        animationDelayMs: 860,
      }),
      createDefaultEdge({
        source: "split-docs-node",
        sourceHandle: "output-file-acord-form",
        target: "extract-acord-node",
        targetHandle: "input-file-document",
        animationDelayMs: 1040,
      }),
      createDefaultEdge({
        source: "split-docs-node",
        sourceHandle: "output-file-police-report",
        target: "extract-police-node",
        targetHandle: "input-file-document",
        animationDelayMs: 1160,
      }),
      createDefaultEdge({
        source: "split-docs-node",
        sourceHandle: "output-file-medical-records",
        target: "extract-medical-node",
        targetHandle: "input-file-document",
        animationDelayMs: 1280,
      }),
    ],
  };
}
