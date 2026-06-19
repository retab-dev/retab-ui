"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

import { cn } from "@/lib/utils";

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (
    id: string,
    chart: string,
  ) => Promise<{ svg: string; bindFunctions?: (element: Element) => void }>;
};

declare global {
  interface Window {
    mermaid?: MermaidApi;
  }
}

let mermaidScriptPromise: Promise<MermaidApi> | null = null;

function loadMermaid() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Mermaid can only render in the browser."));
  }

  if (window.mermaid) {
    return Promise.resolve(window.mermaid);
  }

  mermaidScriptPromise ??= new Promise<MermaidApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-mermaid="true"]',
    );

    if (existing) {
      existing.addEventListener("load", () => {
        if (window.mermaid) {
          resolve(window.mermaid);
        } else {
          reject(new Error("Mermaid failed to load."));
        }
      });
      existing.addEventListener("error", () =>
        reject(new Error("Mermaid failed to load.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    script.async = true;
    script.dataset.mermaid = "true";
    script.addEventListener("load", () => {
      if (window.mermaid) {
        resolve(window.mermaid);
      } else {
        reject(new Error("Mermaid failed to load."));
      }
    });
    script.addEventListener("error", () =>
      reject(new Error("Mermaid failed to load.")),
    );
    document.head.appendChild(script);
  });

  return mermaidScriptPromise;
}

export function MermaidDiagram({
  chart,
  className,
}: {
  chart: string;
  className?: string;
}) {
  const reactId = React.useId();
  const [svg, setSvg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const renderId = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

    async function renderDiagram() {
      try {
        const mermaid = await loadMermaid();

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            background: "transparent",
            primaryColor: "#f8fafc",
            primaryTextColor: "#0f172a",
            primaryBorderColor: "#94a3b8",
            lineColor: "#64748b",
            secondaryColor: "#ecfeff",
            tertiaryColor: "#f0fdf4",
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          },
        });

        const result = await mermaid.render(renderId, chart);
        if (!cancelled) {
          setSvg(result.svg);
          setError(null);
        }
      } catch (renderError) {
        if (!cancelled) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Unable to render Mermaid diagram.",
          );
        }
      }
    }

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  return (
    <div
      className={cn(
        "bg-muted/20 my-6 overflow-x-auto rounded-lg border p-4",
        className,
      )}
    >
      {svg ? (
        <div
          className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <pre className="overflow-x-auto text-xs leading-relaxed">
          <code>{error ? `${error}\n\n${chart}` : chart}</code>
        </pre>
      )}
    </div>
  );
}
