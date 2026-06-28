"use client";

import * as React from "react";
import {
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";

import { cn } from "@/lib/utils";

type DiagramKind =
  | "boundary"
  | "body"
  | "callout"
  | "document"
  | "header"
  | "row"
  | "sidebar"
  | "surface"
  | "viewport";

type DiagramNodeData = {
  label: string;
  muted?: boolean;
  title?: string;
  kind: DiagramKind;
};

type DiagramNode = Node<DiagramNodeData, "diagramNode">;
type DiagramEdge = Edge;
type DiagramDefinition = {
  ariaLabel: string;
  edges: DiagramEdge[];
  heightClassName?: string;
  nodes: DiagramNode[];
};
type DiagramSelection = "all" | "sidebar" | "structure";

const DIAGRAM_ARROW_COLOR = "currentColor";

const STRUCTURE_NODES = [
  calloutNode("provider-label", "<FileViewerProvider />", 32, 54, 172, 24),
  calloutNode("root-label", "<FileViewer />", 300, 18, 118, 24),
  calloutNode("header-label", "<FileViewerHeader />", 512, 80, 172, 24),
  calloutNode("sidebar-label", "<FileViewerSidebar />", 46, 174, 166, 24),
  calloutNode("inset-label", "<FileViewerInset />", 514, 176, 172, 24),
  calloutNode("viewport-label", "<FileViewerViewport />", 514, 246, 178, 24),
  calloutNode("body-label", "<FileViewerBody />", 62, 302, 142, 24),
  calloutNode("document-label", "<FileViewerDocument />", 494, 326, 188, 24),
  diagramNode("root", "", "boundary", 248, 72, 224, 274),
  diagramNode("header", "Header", "header", 266, 90, 188, 44),
  diagramNode("body", "", "body", 266, 150, 188, 168),
  diagramNode("sidebar", "Sidebar", "sidebar", 284, 170, 66, 126),
  diagramNode("inset", "", "surface", 364, 170, 72, 126),
  diagramNode("viewport", "", "viewport", 376, 194, 48, 76),
  diagramNode("document", "", "document", 385, 222, 30, 28),
] satisfies DiagramNode[];

const STRUCTURE_EDGES = [
  labelEdge("provider-label", "root", "right-source", "left-target-top"),
  labelEdge("root-label", "root", "bottom-source", "top-target"),
  labelEdge("header-label", "header", "left-source", "right-target"),
  labelEdge("sidebar-label", "sidebar", "right-source", "left-target"),
  labelEdge("inset-label", "inset", "left-source", "right-target-top"),
  labelEdge("viewport-label", "viewport", "left-source", "right-target"),
  labelEdge("body-label", "body", "right-source", "left-target-bottom"),
  labelEdge("document-label", "document", "left-source", "bottom-target"),
] satisfies DiagramEdge[];

const SIDEBAR_NODES = [
  calloutNode("trigger-label", "<FileViewerSidebarTrigger />", 72, 48, 226, 24),
  calloutNode("registration-label", "one registered sidebar", 444, 48, 198, 24),
  calloutNode("rows-label", "domain rail owns rows", 76, 362, 186, 24),
  calloutNode(
    "inset-label",
    "file pixels stay in inset",
    424,
    362,
    224,
    24,
  ),
  diagramNode("root", "", "boundary", 86, 92, 544, 244),
  diagramNode("header", "", "header", 116, 124, 484, 46),
  diagramNode("trigger", "=", "document", 137, 137, 24, 20),
  diagramNode("identity", "Identity", "callout", 176, 137, 90, 20),
  diagramNode("toolbar", "Toolbar", "callout", 500, 137, 84, 20),
  diagramNode("body", "", "body", 116, 188, 484, 112),
  diagramNode("sidebar", "", "sidebar", 138, 202, 138, 84),
  calloutNode("sidebar-title", "FileViewer", 155, 216, 104, 16),
  diagramNode("thumbs", "Thumbnails", "row", 154, 240, 104, 16),
  diagramNode("segments", "Segments", "row", 154, 260, 104, 16),
  diagramNode("inset", "Inset", "surface", 306, 202, 256, 84),
  diagramNode("viewport", "", "viewport", 332, 216, 204, 56),
  diagramNode("document", "Document", "document", 382, 228, 104, 32),
] satisfies DiagramNode[];

const SIDEBAR_EDGES = [
  labelEdge("trigger-label", "trigger", "bottom-source", "top-target"),
  labelEdge("registration-label", "header", "bottom-source", "top-target"),
  labelEdge("rows-label", "segments", "top-source", "bottom-target"),
  labelEdge("inset-label", "document", "top-source", "bottom-target"),
] satisfies DiagramEdge[];

const DIAGRAMS = [
  {
    ariaLabel: "File Viewer structure",
    nodes: STRUCTURE_NODES,
    edges: STRUCTURE_EDGES,
  },
  {
    ariaLabel: "File Viewer sidebar ownership",
    nodes: SIDEBAR_NODES,
    edges: SIDEBAR_EDGES,
  },
] satisfies DiagramDefinition[];

const nodeTypes = {
  diagramNode: DiagramNodeComponent,
};

export function FileViewerStructureSketches({
  className,
  diagrams = "all",
  fitViewPadding = 0.08,
  frameClassName,
}: {
  className?: string;
  diagrams?: DiagramSelection;
  fitViewPadding?: number;
  frameClassName?: string;
}) {
  const selectedDiagrams =
    diagrams === "structure"
      ? [DIAGRAMS[0]]
      : diagrams === "sidebar"
        ? [DIAGRAMS[1]]
        : DIAGRAMS;

  return (
    <div className={cn("not-prose my-6 space-y-6", className)}>
      {selectedDiagrams.map((diagram) => (
        <DiagramFrame
          key={diagram.ariaLabel}
          className={frameClassName}
          diagram={diagram}
          fitViewPadding={fitViewPadding}
        />
      ))}
    </div>
  );
}

function DiagramFrame({
  className,
  diagram,
  fitViewPadding,
}: {
  className?: string;
  diagram: DiagramDefinition;
  fitViewPadding: number;
}) {
  return (
    <figure
      aria-label={diagram.ariaLabel}
      className={cn(
        "overflow-hidden rounded-lg border bg-[#fbfbfb] dark:bg-[#0b0b0b]",
        diagram.heightClassName ?? "h-[17.5rem] sm:h-[25rem]",
        className,
      )}
    >
      <ReactFlowProvider>
        <StaticDiagramFlow diagram={diagram} fitViewPadding={fitViewPadding} />
      </ReactFlowProvider>
      <figcaption className="sr-only">{diagram.ariaLabel}</figcaption>
    </figure>
  );
}

function StaticDiagramFlow({
  diagram,
  fitViewPadding,
}: {
  diagram: DiagramDefinition;
  fitViewPadding: number;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const nodesInitialized = useNodesInitialized();
  const { fitView } = useReactFlow<DiagramNode, DiagramEdge>();

  React.useEffect(() => {
    if (!nodesInitialized) return;
    const element = containerRef.current;
    if (!element) return;

    let animationFrame = 0;
    const runFitView = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        void fitView({ duration: 0, padding: fitViewPadding });
      });
    };

    runFitView();

    const observer = new ResizeObserver(runFitView);
    observer.observe(element);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [fitView, fitViewPadding, nodesInitialized]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <ReactFlow
        aria-label={diagram.ariaLabel}
        nodes={diagram.nodes}
        edges={diagram.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: fitViewPadding }}
        minZoom={0.2}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnDoubleClick={false}
        zoomOnPinch={false}
        zoomOnScroll={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        className="file-viewer-structure-flow"
      ></ReactFlow>
    </div>
  );
}

function DiagramNodeComponent({ data }: NodeProps<DiagramNode>) {
  if (data.kind === "callout") {
    return (
      <NodeShell data={data}>
        <span className="font-mono text-[11px] leading-none font-medium whitespace-pre sm:text-[12px]">
          {data.label}
        </span>
      </NodeShell>
    );
  }

  if (data.kind === "row") {
    return (
      <NodeShell data={data}>
        <span className="font-mono text-[10px] leading-none font-semibold">
          {data.label}
        </span>
      </NodeShell>
    );
  }

  return (
    <NodeShell data={data}>
      {data.label ? (
        <span className="font-mono text-[12px] leading-tight font-semibold whitespace-pre-line">
          {data.label}
        </span>
      ) : null}
    </NodeShell>
  );
}

function NodeShell({
  children,
  data,
}: {
  children: React.ReactNode;
  data: DiagramNodeData;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center rounded-[inherit] text-center",
        nodeClassName(data.kind),
      )}
    >
      <DiagramHandle id="top-target" type="target" position={Position.Top} />
      <DiagramHandle id="left-target" type="target" position={Position.Left} />
      <DiagramHandle
        id="left-target-top"
        type="target"
        position={Position.Left}
        style={{ top: "30%" }}
      />
      <DiagramHandle
        id="left-target-bottom"
        type="target"
        position={Position.Left}
        style={{ top: "70%" }}
      />
      <DiagramHandle
        id="right-target"
        type="target"
        position={Position.Right}
      />
      <DiagramHandle
        id="right-target-top"
        type="target"
        position={Position.Right}
        style={{ top: "30%" }}
      />
      <DiagramHandle
        id="right-target-bottom"
        type="target"
        position={Position.Right}
        style={{ top: "70%" }}
      />
      <DiagramHandle
        id="bottom-target"
        type="target"
        position={Position.Bottom}
      />
      <DiagramHandle id="top-source" type="source" position={Position.Top} />
      <DiagramHandle id="left-source" type="source" position={Position.Left} />
      <DiagramHandle
        id="right-source"
        type="source"
        position={Position.Right}
      />
      <DiagramHandle
        id="bottom-source"
        type="source"
        position={Position.Bottom}
      />
      {children}
    </div>
  );
}

function DiagramHandle({
  id,
  type,
  position,
  style,
}: {
  id: string;
  position: Position;
  style?: React.CSSProperties;
  type: "source" | "target";
}) {
  return (
    <Handle
      id={id}
      className="size-1 opacity-0"
      type={type}
      position={position}
      style={style}
    />
  );
}

function diagramNode(
  id: string,
  label: string,
  kind: DiagramKind,
  x: number,
  y: number,
  width: number,
  height: number,
): DiagramNode {
  return {
    id,
    type: "diagramNode",
    position: { x, y },
    data: { kind, label },
    draggable: false,
    selectable: false,
    style: {
      borderRadius: nodeRadius(kind),
      height,
      width,
    },
  };
}

function calloutNode(
  id: string,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
): DiagramNode {
  return diagramNode(id, label, "callout", x, y, width, height);
}

function labelEdge(
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle: string,
): DiagramEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle,
    targetHandle,
    focusable: false,
    selectable: false,
    zIndex: 20,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: DIAGRAM_ARROW_COLOR,
      markerUnits: "userSpaceOnUse",
      strokeWidth: 1.3,
      width: 9,
      height: 9,
    },
    style: {
      stroke: DIAGRAM_ARROW_COLOR,
      strokeDasharray: "5 6",
      strokeLinecap: "round",
      strokeWidth: 1.3,
    },
    className: "opacity-[0.82] drop-shadow-[0_0_0_rgba(0,0,0,0)]",
  };
}

function nodeClassName(kind: DiagramKind) {
  switch (kind) {
    case "boundary":
      return "border-[3px] border-neutral-500/80 bg-transparent text-neutral-700 dark:border-neutral-200/80 dark:text-neutral-200";
    case "header":
      return "border-[3px] border-sky-600/85 bg-sky-500/20 text-neutral-600 dark:border-sky-400/90 dark:bg-sky-500/30 dark:text-neutral-200";
    case "body":
      return "border-[3px] border-neutral-400/50 bg-neutral-200/40 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-300";
    case "sidebar":
      return "border-[3px] border-emerald-600/85 bg-emerald-500/20 text-neutral-600 dark:border-emerald-400/80 dark:bg-emerald-500/25 dark:text-neutral-200";
    case "surface":
      return "border-[3px] border-amber-600/85 bg-amber-500/20 text-neutral-600 dark:border-amber-400/80 dark:bg-amber-500/25 dark:text-neutral-200";
    case "viewport":
      return "border-[3px] border-orange-600/80 bg-background text-neutral-600 dark:border-orange-400/80 dark:text-neutral-200";
    case "document":
      return "border-[3px] border-orange-600/80 bg-orange-500/20 text-neutral-600 dark:border-orange-400/80 dark:bg-orange-500/25 dark:text-neutral-200";
    case "row":
      return "border border-neutral-400/70 bg-background text-neutral-600 dark:border-neutral-700 dark:text-neutral-200";
    case "callout":
      return "border-0 bg-transparent text-neutral-700 dark:text-neutral-200";
  }
}

function nodeRadius(kind: DiagramKind) {
  switch (kind) {
    case "boundary":
      return 28;
    case "header":
    case "surface":
    case "sidebar":
    case "body":
      return 13;
    case "viewport":
      return 10;
    case "document":
      return 7;
    case "row":
      return 5;
    case "callout":
      return 0;
  }
}
