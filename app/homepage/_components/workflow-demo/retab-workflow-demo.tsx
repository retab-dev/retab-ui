"use client";

import { useCallback, useMemo } from "react";
import {
  addEdge,
  MarkerType,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
} from "@xyflow/react";

import { cn } from "@/lib/utils";

import { WorkflowDemoCanvas } from "./workflow-demo-canvas";
import { buildDefaultWorkflowDemoState } from "./workflow-demo-graph";
import { handleColorMap } from "./workflow-demo-registry";

function getConnectionColor(sourceHandle: string | null | undefined): string {
  return sourceHandle?.startsWith("output-json-")
    ? handleColorMap.json
    : handleColorMap.file;
}

export function RetabWorkflowDemo({ className }: { className?: string }) {
  const initialGraphState = useMemo(() => buildDefaultWorkflowDemoState(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialGraphState.nodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialGraphState.edges,
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const color = getConnectionColor(connection.sourceHandle);
      const id = [
        "edge",
        connection.source,
        connection.sourceHandle ?? "source",
        connection.target,
        connection.targetHandle ?? "target",
      ].join("-");

      setEdges((currentEdges) => {
        if (currentEdges.some((edge) => edge.id === id)) return currentEdges;

        return addEdge(
          {
            ...connection,
            id,
            type: "smoothstep",
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, color },
            style: { stroke: color, strokeWidth: 2 },
          },
          currentEdges,
        );
      });
    },
    [setEdges],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((currentNodes) =>
        currentNodes.filter((node) => node.id !== nodeId),
      );
      setEdges((currentEdges) =>
        currentEdges.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId,
        ),
      );
    },
    [setEdges, setNodes],
  );

  return (
    <div
      className={cn("bg-card h-full min-h-0 w-full overflow-hidden", className)}
    >
      <ReactFlowProvider>
        <WorkflowDemoCanvas
          edges={edges}
          nodes={nodes}
          onConnect={handleConnect}
          onDeleteNode={handleDeleteNode}
          onEdgesChange={onEdgesChange}
          onNodesChange={onNodesChange}
        />
      </ReactFlowProvider>
    </div>
  );
}
