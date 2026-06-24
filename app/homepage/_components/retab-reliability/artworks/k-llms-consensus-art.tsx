"use client";

import { useId, useRef, useState } from "react";
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
  sourceNodeClassName: "relative w-72 rounded-sm bg-card/95 p-2.5",
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

const COMPACT_SOURCE_NODE_WIDTH = 270;
const SOURCE_NODE_PADDING = 10;
const CONSENSUS_NODE_LEFT = 396;
const DESKTOP_CARD_TITLE_LEFT = 24;

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
  const sourceTitleClassName = data.isCompact
    ? "mb-2 text-[15px] font-medium text-foreground/85"
    : palette.sourceTitleClassName;
  const sourceCodeClassName = data.isCompact
    ? "overflow-hidden rounded-sm border border-border bg-muted/50 px-2 py-2 text-[10px] leading-[13px] whitespace-pre text-foreground/75 font-mono"
    : palette.sourceCodeClassName;

  return (
    <div className="relative">
      <div
        className={palette.sourceNodeClassName}
        style={{
          width: data.isCompact ? COMPACT_SOURCE_NODE_WIDTH : undefined,
        }}
      >
        <div className={sourceTitleClassName}>
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

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 760;

const sourceNodes = [
  { title: "Extraction A", code: SOURCE_EXAMPLES.a, y: 24 },
  { title: "Extraction B", code: SOURCE_EXAMPLES.b, y: 278 },
  { title: "Extraction C", code: SOURCE_EXAMPLES.c, y: 532 },
] as const;

const compactExtractionLines = [
  "bg-success/55",
  "bg-success/55",
  "bg-info/55",
] as const;

const compactExtractionValues = ["value 1", "value 1", "value 2"] as const;

function ConsensusStaticCanvas({
  className = "",
  containerWidth,
  height,
  markerId,
  scale,
  tone,
}: {
  className?: string;
  containerWidth: number;
  height: number;
  markerId: string;
  scale: number;
  tone: CardTone;
}) {
  const palette = K_LLMS_CONSENSUS_PALETTE[tone];
  const canvasLeft = (containerWidth - CANVAS_WIDTH * scale) / 2;
  const sourceNodeLeft =
    (DESKTOP_CARD_TITLE_LEFT - canvasLeft) / scale - SOURCE_NODE_PADDING;
  const sourceJsonRightX =
    sourceNodeLeft + COMPACT_SOURCE_NODE_WIDTH - SOURCE_NODE_PADDING;

  return (
    <div
      data-consensus-canvas
      className={`absolute top-1/2 left-1/2 origin-center ${className}`}
      style={{
        width: CANVAS_WIDTH,
        height,
        transform: `translate(-50%, -50%) scale(${scale})`,
      }}
    >
      <svg
        aria-hidden="true"
        className="text-muted-foreground/55 pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
      >
        <defs>
          <marker
            id={markerId}
            markerHeight="8"
            markerWidth="8"
            orient="auto"
            refX="7"
            refY="4"
            viewBox="0 0 8 8"
          >
            <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
          </marker>
        </defs>
        <path
          className={palette.edgeClassName}
          d={`M${sourceJsonRightX} 112 C336 112 344 306 ${CONSENSUS_NODE_LEFT} 334`}
          fill="none"
          markerEnd={`url(#${markerId})`}
          stroke="currentColor"
          strokeDasharray="8 7"
          strokeLinecap="round"
          strokeOpacity="0.5"
          strokeWidth="2"
        />
        <path
          className={palette.edgeClassName}
          d={`M${sourceJsonRightX} 366 C326 366 346 398 ${CONSENSUS_NODE_LEFT} 398`}
          fill="none"
          markerEnd={`url(#${markerId})`}
          stroke="currentColor"
          strokeDasharray="8 7"
          strokeLinecap="round"
          strokeOpacity="0.5"
          strokeWidth="2"
        />
        <path
          className={palette.edgeClassName}
          d={`M${sourceJsonRightX} 620 C336 620 344 492 ${CONSENSUS_NODE_LEFT} 462`}
          fill="none"
          markerEnd={`url(#${markerId})`}
          stroke="currentColor"
          strokeDasharray="8 7"
          strokeLinecap="round"
          strokeOpacity="0.5"
          strokeWidth="2"
        />
      </svg>

      {sourceNodes.map((sourceNode) => (
        <div
          className="absolute"
          key={sourceNode.title}
          style={{ top: sourceNode.y, left: sourceNodeLeft }}
        >
          <SourceNode
            data={{
              title: sourceNode.title,
              code: sourceNode.code,
              tone,
              isCompact: true,
            }}
          />
        </div>
      ))}

      <div
        className="absolute top-[285px]"
        style={{ left: CONSENSUS_NODE_LEFT }}
      >
        <ConsensusNode data={{ title: "Likelihoods", tone, isCompact: true }} />
      </div>
    </div>
  );
}

function CompactConsensusCanvas({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute inset-x-2 top-0 bottom-2 flex min-h-0 flex-col justify-start ${className}`}
    >
      <div className="grid shrink-0 gap-1.5">
        {sourceNodes.map((sourceNode, index) => (
          <div
            className="border-border bg-card/95 rounded-sm border px-2 py-1.5 shadow-sm"
            key={sourceNode.title}
          >
            <div className="mb-1 flex items-center justify-between gap-1">
              <span className="text-foreground/85 truncate text-[9px] leading-none font-medium">
                {sourceNode.title}
              </span>
              <span className="bg-muted text-muted-foreground rounded-sm px-1 font-mono text-[8px] leading-3">
                {compactExtractionValues[index]}
              </span>
            </div>
            <div
              className={`h-1 rounded-sm ${compactExtractionLines[index]}`}
            />
          </div>
        ))}
      </div>

      <div className="border-muted-foreground/55 mx-auto min-h-6 w-px flex-1 border-l border-dashed" />

      <div className="border-border bg-card/95 shrink-0 rounded-sm border px-2 py-2 shadow-sm">
        <div className="mb-1.5 flex items-center justify-between gap-1">
          <span>Likelihoods</span>
          <span className="bg-muted text-muted-foreground rounded-sm px-1 font-mono text-[8px] leading-3">
            0.67%
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {compactExtractionLines.map((lineClassName, index) => (
            <span
              className={`h-1 rounded-sm ${lineClassName}`}
              key={`${lineClassName}-${index}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function KLlmsConsensusArt({ tone = "default" }: { tone?: CardTone }) {
  const palette = K_LLMS_CONSENSUS_PALETTE[tone];
  const containerRef = useRef<HTMLDivElement>(null);
  const markerId = useId();
  const [containerSize, setContainerSize] = useState({
    width: 360,
    height: CANVAS_HEIGHT,
  });

  useMountEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateContainerSize = () => {
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        setContainerSize({
          width: container.offsetWidth,
          height: container.offsetHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });

    resizeObserver.observe(container);
    updateContainerSize();
    const animationFrame = window.requestAnimationFrame(updateContainerSize);
    const timer = window.setTimeout(updateContainerSize, 250);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timer);
      resizeObserver.disconnect();
    };
  });

  const canvasScale = Math.min(
    Math.max(containerSize.width - 32, 1) / CANVAS_WIDTH,
    Math.max(containerSize.height - 32, 1) / CANVAS_HEIGHT,
    1,
  );

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
          <CompactConsensusCanvas className="sm:hidden" />
          <ConsensusStaticCanvas
            className="hidden sm:block"
            containerWidth={containerSize.width}
            height={CANVAS_HEIGHT}
            markerId={markerId}
            scale={canvasScale}
            tone={tone}
          />
        </div>
      </div>
    </div>
  );
}
