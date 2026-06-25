"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";
import {
  MERMAID_VIEWER_STYLES,
  renderDiagram,
  type DiagramState,
} from "@/registry/new-york-v4/ui/mermaid-renderer";

export function MermaidDiagram({
  chart,
  className,
}: {
  chart: string;
  className?: string;
}) {
  const reactId = React.useId();
  const [state, setState] = React.useState<DiagramState>({
    status: "loading",
  });

  useKeyedMountEffect(joinEffectKey([chart, reactId]), () => {
    let cancelled = false;
    const renderId = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

    async function renderCurrentDiagram() {
      setState({ status: "loading" });
      try {
        const result = await renderDiagram(chart, renderId);
        if (!cancelled) {
          setState(result);
        }
      } catch (renderError) {
        if (!cancelled) {
          setState({
            status: "failed",
            message:
              renderError instanceof Error
                ? renderError.message
                : "Unable to render Mermaid diagram.",
          });
        }
      }
    }

    renderCurrentDiagram();

    return () => {
      cancelled = true;
    };
  });

  return (
    <div
      className={cn(
        "bg-muted/20 my-6 overflow-x-auto rounded-lg border p-4",
        className,
      )}
      data-diagram-language="mermaid"
      data-diagram-renderer={
        state.status === "ready" ? state.renderer : undefined
      }
      data-diagram-state={state.status}
    >
      {state.status === "ready" ? (
        <>
          <style data-pretext-mermaid-styles="">{MERMAID_VIEWER_STYLES}</style>
          <div
            className="text-foreground [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
            data-pretext-mermaid-svg=""
            dangerouslySetInnerHTML={{ __html: state.svg }}
          />
        </>
      ) : (
        <pre className="overflow-x-auto text-xs leading-relaxed">
          <code>
            {state.status === "failed" ? `${state.message}\n\n${chart}` : chart}
          </code>
        </pre>
      )}
    </div>
  );
}
