"use client";

import { useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  ReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type NodeProps,
  useReactFlow,
} from "@xyflow/react";
import { Maximize, Minus, Plus } from "lucide-react";
import "@xyflow/react/dist/style.css";

import { KeyedRunner } from "@/hooks/KeyedRunner";

import { WorkflowDemoNode } from "./workflow-demo-node";
import {
  DEMO_NODE_TYPE,
  type DemoEdge,
  type DemoNode,
} from "./workflow-demo-types";

interface WorkflowDemoCanvasProps {
  nodes: DemoNode[];
  edges: DemoEdge[];
  onConnect: (connection: Connection) => void;
  onDeleteNode: (nodeId: string) => void;
  onEdgesChange: (changes: EdgeChange<DemoEdge>[]) => void;
  onNodesChange: (changes: NodeChange<DemoNode>[]) => void;
}

const workflowDemoFitPadding = 0.08;
const workflowDemoFitMinZoom = 0.12;
const workflowDemoMinZoom = 0.1;

function WorkflowDemoFitViewRunner({
  nodes,
  fitView,
  reactFlowWrapperRef,
}: {
  nodes: DemoNode[];
  fitView: ReturnType<typeof useReactFlow>["fitView"];
  reactFlowWrapperRef: React.RefObject<HTMLDivElement | null>;
}) {
  const fitKey = nodes.length > 0 ? `workflow-demo-fit-${nodes.length}` : null;

  if (!fitKey) return null;

  return (
    <KeyedRunner
      key={fitKey}
      effect={() => {
        const wrapper = reactFlowWrapperRef.current;
        if (!wrapper) return;

        let frameId: number | null = null;
        const settleTimerIds: number[] = [];

        const fitCanvas = (duration: number) => {
          const wrapperRect = wrapper.getBoundingClientRect();
          if (wrapperRect.width <= 0 || wrapperRect.height <= 0) return;

          void fitView({
            padding: workflowDemoFitPadding,
            duration,
            minZoom: workflowDemoFitMinZoom,
          });
        };

        const scheduleFitCanvas = (duration: number) => {
          if (frameId !== null) window.cancelAnimationFrame(frameId);
          frameId = window.requestAnimationFrame(() => {
            frameId = null;
            fitCanvas(duration);
          });
        };

        scheduleFitCanvas(180);
        settleTimerIds.push(
          window.setTimeout(() => scheduleFitCanvas(180), 120),
          window.setTimeout(() => scheduleFitCanvas(0), 360),
        );

        const resizeObserver = new ResizeObserver(() => {
          scheduleFitCanvas(0);
        });
        resizeObserver.observe(wrapper);

        return () => {
          resizeObserver.disconnect();
          if (frameId !== null) window.cancelAnimationFrame(frameId);
          settleTimerIds.forEach((timerId) => window.clearTimeout(timerId));
        };
      }}
    />
  );
}

function WorkflowViewportControls() {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const controls = [
    ["Zoom in", Plus, () => void zoomIn({ duration: 160 })],
    ["Zoom out", Minus, () => void zoomOut({ duration: 160 })],
    [
      "Fit view",
      Maximize,
      () =>
        void fitView({
          padding: workflowDemoFitPadding,
          duration: 180,
          minZoom: workflowDemoFitMinZoom,
        }),
    ],
  ] as const;

  return (
    <div
      aria-label="Workflow viewport controls"
      className="border-border bg-card absolute right-4 bottom-4 z-20 hidden overflow-hidden rounded-md border shadow-sm md:flex"
    >
      {controls.map(([label, Icon, onClick]) => (
        <button
          aria-label={label}
          className="border-border text-foreground hover:bg-muted focus-visible:ring-ring flex size-8 items-center justify-center border-r font-mono text-sm transition-colors last:border-r-0 focus-visible:ring-2 focus-visible:outline-none"
          key={label}
          onClick={onClick}
          type="button"
        >
          <Icon aria-hidden="true" className="size-4" />
        </button>
      ))}
    </div>
  );
}

export function WorkflowDemoCanvas({
  nodes,
  edges,
  onConnect,
  onDeleteNode,
  onEdgesChange,
  onNodesChange,
}: WorkflowDemoCanvasProps) {
  const { fitView } = useReactFlow();
  const reactFlowWrapperRef = useRef<HTMLDivElement | null>(null);
  const nodeTypes = useMemo(
    () => ({
      [DEMO_NODE_TYPE]: (props: NodeProps<DemoNode>) => (
        <WorkflowDemoNode {...props} onDeleteNode={onDeleteNode} />
      ),
    }),
    [onDeleteNode],
  );

  return (
    <div ref={reactFlowWrapperRef} className="relative h-full w-full">
      <ReactFlow<DemoNode, DemoEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        nodesFocusable
        edgesFocusable
        onlyRenderVisibleElements={false}
        panOnDrag
        autoPanOnNodeDrag={false}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        preventScrolling={false}
        onConnect={onConnect}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
        connectionMode={ConnectionMode.Loose}
        snapToGrid
        snapGrid={[12, 12]}
        fitView
        fitViewOptions={{
          padding: workflowDemoFitPadding,
          minZoom: workflowDemoFitMinZoom,
        }}
        minZoom={workflowDemoMinZoom}
        maxZoom={1.4}
        deleteKeyCode={null}
        className="workflow-demo-canvas bg-card h-full w-full"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={2.4}
          color="var(--color-muted-foreground)"
          className="opacity-20 dark:opacity-30"
        />
      </ReactFlow>
      <WorkflowDemoFitViewRunner
        fitView={fitView}
        nodes={nodes}
        reactFlowWrapperRef={reactFlowWrapperRef}
      />
      <WorkflowViewportControls />
    </div>
  );
}
