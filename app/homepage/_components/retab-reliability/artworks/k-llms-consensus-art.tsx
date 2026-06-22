"use client";

import { useMemo, useRef, useState } from "react";
import {
  type Edge,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Node,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMountEffect } from "@/hooks/use-mount-effect";

import type { CardTone } from "../types";
import { buildTonePalette } from "./tone-palette";

type SourceNodeData = {
  title: string;
  code: string;
  tone?: CardTone;
  isCompact?: boolean;
};

type ConsensusNodeData = {
  title: string;
  tone?: CardTone;
  isCompact?: boolean;
};

type KLlmsConsensusPalette = {
  sourceNodeClassName: string;
  sourceTitleClassName: string;
  sourceCodeClassName: string;
  consensusNodeClassName: string;
  consensusTitleClassName: string;
  consensusRowClassName: string;
  consensusFieldClassName: string;
  consensusScoreClassName: string;
  edgeClassName: string;
  baseBackgroundClassName: string;
  bottomGlowClassName: string;
  topGlowClassName: string;
  leftGlowClassName: string | null;
};

const DEFAULT_K_LLMS_CONSENSUS_PALETTE: KLlmsConsensusPalette = {
  sourceNodeClassName:
    "relative w-72 rounded-sm border border-border bg-card/95 p-2.5",
  sourceTitleClassName: "mb-1.5 text-[13px] font-medium text-foreground/85",
  sourceCodeClassName:
    "overflow-hidden rounded-sm border border-border bg-muted/50 px-2 py-2 text-[11px] leading-5 whitespace-pre text-foreground/75 font-mono",
  consensusNodeClassName:
    "relative w-60 rounded-sm border border-border bg-card/95 p-2.5",
  consensusTitleClassName: "mb-1.5 text-[13px] font-medium text-foreground/85",
  consensusRowClassName:
    "flex items-center justify-between rounded-sm border border-border bg-muted/50 px-2 py-1.5 text-[11px]",
  consensusFieldClassName: "text-muted-foreground font-mono",
  consensusScoreClassName:
    "rounded-sm bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success",
  edgeClassName: "stroke-muted-foreground",
  baseBackgroundClassName: "absolute inset-0",
  bottomGlowClassName: "hidden",
  topGlowClassName: "hidden",
  leftGlowClassName: null,
};

const K_LLMS_CONSENSUS_PALETTE = buildTonePalette(
  DEFAULT_K_LLMS_CONSENSUS_PALETTE,
);

const SCHEMA_FIELDS = [
  "loan_amount",
  "applicant_name",
  "debt_to_income",
  "term_months",
  "annual_income",
  "credit_score",
  "property_value",
  "down_payment",
] as const;

const SIMILARITY_BY_FIELD = {
  loan_amount: "96%",
  applicant_name: "99%",
  debt_to_income: "91%",
  term_months: "94%",
  annual_income: "93%",
  credit_score: "98%",
  property_value: "95%",
  down_payment: "97%",
} satisfies Record<(typeof SCHEMA_FIELDS)[number], string>;

const SOURCE_EXAMPLES = {
  a: `{
  "loan_amount": 250000,
  "applicant_name": "Jane M. Doe",
  "debt_to_income": 0.34,
  "term_months": 360,
  "annual_income": 184000,
  "credit_score": 742,
  "property_value": 325000,
  "down_payment": 75000
}`,
  b: `{
  "loan_amount": 249500,
  "applicant_name": "Jane Marie Doe",
  "debt_to_income": 0.35,
  "term_months": 360,
  "annual_income": 181500,
  "credit_score": 739,
  "property_value": 324500,
  "down_payment": 75000
}`,
  c: `{
  "loan_amount": 250000,
  "applicant_name": "J. M. Doe",
  "debt_to_income": 0.33,
  "term_months": 359,
  "annual_income": 184000,
  "credit_score": 741,
  "property_value": 325000,
  "down_payment": 76000
}`,
} as const;

const JSON_TOKEN_PATTERN =
  /"(?:[^"\\]|\\.)*"\s*:|"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|[{}[\],:]/g;

function HighlightedJson({ code }: { code: string }) {
  const nodes = [];
  let cursor = 0;
  let key = 0;

  for (const match of code.matchAll(JSON_TOKEN_PATTERN)) {
    const token = match[0];
    const index = match.index ?? 0;

    if (index > cursor) {
      nodes.push(code.slice(cursor, index));
    }

    if (token.trimEnd().endsWith(":") && token.startsWith('"')) {
      const keyToken = token.slice(0, token.lastIndexOf(":"));
      nodes.push(
        <span key={`key-${key}`} className="text-foreground font-medium">
          {keyToken}
        </span>,
        <span
          key={`key-punctuation-${key}`}
          className="text-muted-foreground/70"
        >
          :
        </span>,
      );
    } else if (token.startsWith('"')) {
      nodes.push(
        <span key={`string-${key}`} className="text-success">
          {token}
        </span>,
      );
    } else if (/^-?\d/.test(token)) {
      nodes.push(
        <span key={`number-${key}`} className="text-warning">
          {token}
        </span>,
      );
    } else {
      nodes.push(
        <span key={`punctuation-${key}`} className="text-muted-foreground/70">
          {token}
        </span>,
      );
    }

    key += 1;
    cursor = index + token.length;
  }

  if (cursor < code.length) {
    nodes.push(code.slice(cursor));
  }

  return <>{nodes}</>;
}

function SourceNode({ data }: { data: SourceNodeData }) {
  const palette = K_LLMS_CONSENSUS_PALETTE[data.tone ?? "default"];
  const sourceCodeClassName = data.isCompact
    ? "overflow-hidden rounded-sm border border-border bg-muted/50 px-2 py-1.5 text-[9px] leading-3 whitespace-pre text-foreground/75 font-mono"
    : palette.sourceCodeClassName;

  return (
    <div className="relative">
      <div
        className={palette.sourceNodeClassName}
        style={{ width: data.isCompact ? 220 : undefined }}
      >
        <Handle
          type="source"
          position={Position.Right}
          id="output-json-0"
          className="!pointer-events-none !h-2 !w-2 !border-0 !bg-transparent !opacity-0"
          style={{ right: -3, top: "50%" }}
        />
        <div className={palette.sourceTitleClassName}>
          <span>{data.title}</span>
        </div>
        <pre className={sourceCodeClassName}>
          <HighlightedJson code={data.code} />
        </pre>
      </div>
    </div>
  );
}

function ConsensusNode({ data }: { data: ConsensusNodeData }) {
  const palette = K_LLMS_CONSENSUS_PALETTE[data.tone ?? "default"];

  return (
    <div className="relative">
      <div
        className={palette.consensusNodeClassName}
        style={{ width: data.isCompact ? 185 : undefined }}
      >
        <Handle
          type="target"
          position={Position.Left}
          id="input-json-0"
          className="!pointer-events-none !h-2 !w-2 !border-0 !bg-transparent !opacity-0"
          style={{ left: -3, top: "24%" }}
        />
        <Handle
          type="target"
          position={Position.Left}
          id="input-json-1"
          className="!pointer-events-none !h-2 !w-2 !border-0 !bg-transparent !opacity-0"
          style={{ left: -3, top: "50%" }}
        />
        <Handle
          type="target"
          position={Position.Left}
          id="input-json-2"
          className="!pointer-events-none !h-2 !w-2 !border-0 !bg-transparent !opacity-0"
          style={{ left: -3, top: "76%" }}
        />
        <div className={palette.consensusTitleClassName}>
          <span>{data.title}</span>
        </div>
        <div className="space-y-1.5">
          {SCHEMA_FIELDS.map((field) => (
            <div key={field} className={palette.consensusRowClassName}>
              <span className={palette.consensusFieldClassName}>{field}</span>
              <span className={palette.consensusScoreClassName}>
                {SIMILARITY_BY_FIELD[field]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  source: SourceNode,
  consensus: ConsensusNode,
};

function ConsensusFitViewRunner({
  fitView,
  isMobile,
}: {
  fitView: ReturnType<typeof useReactFlow>["fitView"];
  isMobile: boolean;
}) {
  useMountEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: isMobile ? 0.13 : 0.1, duration: 220 });
    }, 60);

    return () => clearTimeout(timer);
  });

  return null;
}

function ConsensusWorkflowCanvas({
  containerWidth,
  tone,
}: {
  containerWidth: number;
  tone: CardTone;
}) {
  const { fitView } = useReactFlow();
  const palette = K_LLMS_CONSENSUS_PALETTE[tone];
  const isMobile = containerWidth < 520;
  const canvasWidth = Math.max(containerWidth, isMobile ? 660 : 760);
  const sourceStartY = isMobile ? 32 : 24;
  const sourceGapY = isMobile ? 252 : 232;
  const sourceX = canvasWidth * (isMobile ? 0.05 : 0.04);
  const consensusX = canvasWidth * (isMobile ? 0.61 : 0.62);

  const nodes: Node[] = useMemo(
    () => [
      {
        id: "extract-a",
        type: "source",
        position: { x: sourceX, y: sourceStartY },
        sourcePosition: Position.Right,
        data: {
          title: "Extraction A",
          code: SOURCE_EXAMPLES.a,
          tone,
          isCompact: isMobile,
        },
        draggable: false,
      },
      {
        id: "extract-b",
        type: "source",
        position: { x: sourceX, y: sourceStartY + sourceGapY },
        sourcePosition: Position.Right,
        data: {
          title: "Extraction B",
          code: SOURCE_EXAMPLES.b,
          tone,
          isCompact: isMobile,
        },
        draggable: false,
      },
      {
        id: "extract-c",
        type: "source",
        position: { x: sourceX, y: sourceStartY + sourceGapY * 2 },
        sourcePosition: Position.Right,
        data: {
          title: "Extraction C",
          code: SOURCE_EXAMPLES.c,
          tone,
          isCompact: isMobile,
        },
        draggable: false,
      },
      {
        id: "consensus",
        type: "consensus",
        position: { x: consensusX, y: sourceStartY + sourceGapY },
        targetPosition: Position.Left,
        data: { title: "Likelihoods", tone, isCompact: isMobile },
        draggable: false,
      },
    ],
    [consensusX, isMobile, sourceGapY, sourceStartY, sourceX, tone],
  );

  const edges: Edge[] = useMemo(
    () => [
      {
        id: "a-to-consensus",
        source: "extract-a",
        target: "consensus",
        sourceHandle: "output-json-0",
        targetHandle: "input-json-0",
        type: "bezier",
        className: palette.edgeClassName,
        animated: true,
        style: {
          strokeWidth: 2,
          strokeDasharray: "8 7",
          strokeOpacity: 0.5,
          strokeLinecap: "round" as const,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "currentColor",
        },
      },
      {
        id: "b-to-consensus",
        source: "extract-b",
        target: "consensus",
        sourceHandle: "output-json-0",
        targetHandle: "input-json-1",
        type: "bezier",
        className: palette.edgeClassName,
        animated: true,
        style: {
          strokeWidth: 2,
          strokeDasharray: "8 7",
          strokeOpacity: 0.5,
          strokeLinecap: "round" as const,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "currentColor",
        },
      },
      {
        id: "c-to-consensus",
        source: "extract-c",
        target: "consensus",
        sourceHandle: "output-json-0",
        targetHandle: "input-json-2",
        type: "bezier",
        className: palette.edgeClassName,
        animated: true,
        style: {
          strokeWidth: 2,
          strokeDasharray: "8 7",
          strokeOpacity: 0.5,
          strokeLinecap: "round" as const,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "currentColor",
        },
      },
    ],
    [palette.edgeClassName],
  );

  return (
    <>
      <ConsensusFitViewRunner
        key={`${canvasWidth}:${isMobile ? "mobile" : "desktop"}`}
        fitView={fitView}
        isMobile={isMobile}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        fitView
        fitViewOptions={{ padding: isMobile ? 0.13 : 0.1 }}
        minZoom={0.2}
        maxZoom={1.8}
        className="pointer-events-none"
        proOptions={{ hideAttribution: true }}
      />
    </>
  );
}

export function KLlmsConsensusArt({ tone = "default" }: { tone?: CardTone }) {
  const palette = K_LLMS_CONSENSUS_PALETTE[tone];
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(860);

  useMountEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setContainerWidth(width);
        }
      }
    });

    resizeObserver.observe(container);
    setContainerWidth(container.offsetWidth || 860);

    return () => {
      resizeObserver.disconnect();
    };
  });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className={palette.baseBackgroundClassName} />
      <div className={palette.bottomGlowClassName} />
      <div className={palette.topGlowClassName} />
      {palette.leftGlowClassName ? (
        <div className={palette.leftGlowClassName} />
      ) : null}
      <div className="absolute inset-0">
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-hidden rounded-sm"
        >
          <ReactFlowProvider>
            <ConsensusWorkflowCanvas
              containerWidth={containerWidth}
              tone={tone}
            />
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
}
