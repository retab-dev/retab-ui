"use client";

import * as React from "react";
import { Check, Clipboard } from "lucide-react";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";

const MERMAID_MAX_LINES = 160;
const MERMAID_MAX_SOURCE_LENGTH = 12_000;

const MERMAID_CONFIG = {
  flowchart: {
    htmlLabels: false,
    useMaxWidth: true,
  },
  securityLevel: "strict",
  sequence: {
    useMaxWidth: true,
  },
  startOnLoad: false,
  suppressErrorRendering: true,
  theme: "default",
} as const;

const mermaidDiagramCache = new Map<string, Promise<DiagramState>>();

type DiagramState =
  | { status: "failed"; message: string }
  | { status: "loading" }
  | { status: "ready"; svg: string };
type ReadyDiagramState = Extract<DiagramState, { status: "ready" }>;

// A per-instance async store for one diagram's mermaid render. Kept per
// component (not module-global) so instances never share state — no cross-
// render notify fan-out and no shared cache keyed by a render-order id.
type MermaidDiagramStore = {
  key: string;
  result: DiagramState | null;
  listeners: Set<() => void>;
};

export function MarkdownGreenfieldDiagram({
  caption,
  componentName,
  onContentReady,
  source,
  title,
}: {
  caption?: string;
  componentName?: string;
  onContentReady?: () => void;
  source: string;
  title?: string;
}) {
  const limitMessage = React.useMemo(
    () => readDiagramLimitMessage(source),
    [source],
  );
  const diagramId = React.useId().replace(/:/g, "");
  const elementId = `markdown-diagram-${diagramId}`;
  const description = React.useMemo(() => describeDiagram(source), [source]);
  const bodyHeight = React.useMemo(
    () => estimateDiagramBodyHeight(source),
    [source],
  );
  const descriptionId = description
    ? `markdown-diagram-description-${diagramId}`
    : undefined;
  const captionId = caption
    ? `markdown-diagram-caption-${diagramId}`
    : undefined;
  const describedBy =
    [descriptionId, captionId].filter(Boolean).join(" ") || undefined;

  // Derive the displayed state: a limit message fails immediately; otherwise the
  // state follows this instance's async mermaid store (loading until resolved).
  const storeRef = React.useRef<MermaidDiagramStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = { key: "", listeners: new Set(), result: null };
  }
  const store = storeRef.current;
  const renderKey = limitMessage ? "" : `${elementId}\0${source}`;
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      store.listeners.add(onStoreChange);
      // Kick off (or restart on source change) the render here, in the store
      // subscription, so no effect is needed.
      if (!limitMessage && store.key !== renderKey) {
        store.key = renderKey;
        store.result = null;
        void renderMermaidDiagram(source, elementId).then((result) => {
          if (store.key !== renderKey) return;
          store.result = result;
          for (const listener of store.listeners) listener();
        });
      }
      return () => {
        store.listeners.delete(onStoreChange);
      };
    },
    [elementId, limitMessage, renderKey, source, store],
  );
  const getSnapshot = React.useCallback(
    () => (store.key === renderKey ? store.result : null),
    [renderKey, store],
  );
  const resolvedState = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => null,
  );
  const state: DiagramState = limitMessage
    ? { status: "failed", message: limitMessage }
    : (resolvedState ?? { status: "loading" });

  useKeyedLayoutEffect(
    joinEffectKey([bodyHeight, onContentReady, state.status]),
    () => {
      onContentReady?.();
    },
  );

  return (
    <figure
      aria-describedby={describedBy}
      aria-label={title || "Mermaid diagram"}
      className="group bg-muted/30 my-5 min-h-40 overflow-hidden rounded-md border"
      data-diagram-language="mermaid"
      data-diagram-reserved-height={bodyHeight}
      data-diagram-state={state.status}
      data-pretext-component={componentName}
      role="group"
      style={
        {
          "--pretext-diagram-body-height": `${bodyHeight}px`,
        } as React.CSSProperties
      }
    >
      <div className="bg-muted/60 flex h-9 items-center gap-1 border-b px-3">
        <span className="text-muted-foreground min-w-0 truncate text-xs font-medium">
          {title || "mermaid"}
        </span>
        <DiagramCopyButton
          ariaLabel="Copy diagram source"
          className="ml-auto"
          text={source}
        />
        {state.status === "ready" ? (
          <DiagramCopyButton ariaLabel="Copy diagram SVG" text={state.svg} />
        ) : null}
      </div>
      {description ? (
        <p
          className="sr-only"
          data-pretext-diagram-description=""
          id={descriptionId}
        >
          {description}
        </p>
      ) : null}
      <div
        aria-label="Mermaid diagram body"
        className="h-(--pretext-diagram-body-height) overflow-auto p-4"
        data-pretext-diagram-body=""
        onKeyDown={(event) => {
          const element = event.currentTarget;
          if (event.key === "ArrowRight") {
            element.scrollLeft += 50;
            event.preventDefault();
          } else if (event.key === "ArrowLeft") {
            element.scrollLeft -= 50;
            event.preventDefault();
          } else if (event.key === "End") {
            element.scrollLeft = Math.max(
              0,
              element.scrollWidth - element.clientWidth,
            );
            event.preventDefault();
          } else if (event.key === "Home") {
            element.scrollLeft = 0;
            event.preventDefault();
          }
        }}
        role="region"
        tabIndex={0}
      >
        {state.status === "ready" ? (
          <div dangerouslySetInnerHTML={{ __html: state.svg }} />
        ) : (
          <>
            {state.status === "failed" ? (
              <p
                className="border-destructive/25 bg-destructive/10 text-destructive mb-3 rounded border px-3 py-2 text-sm"
                data-pretext-diagram-error=""
                role="alert"
              >
                {state.message}
              </p>
            ) : null}
            <pre
              aria-label="Mermaid diagram source"
              className="text-muted-foreground m-0 overflow-x-auto font-mono text-[0.82em] leading-relaxed"
              tabIndex={0}
            >
              {source}
            </pre>
          </>
        )}
      </div>
      {caption ? (
        <figcaption
          className="bg-muted/30 text-muted-foreground border-t px-3 py-2 text-sm"
          data-pretext-diagram-caption=""
          id={captionId}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function DiagramCopyButton({
  ariaLabel,
  className,
  text,
}: {
  ariaLabel: string;
  className?: string;
  text: string;
}) {
  const [isCopied, setIsCopied] = React.useState(false);

  return (
    <button
      aria-label={isCopied ? "Copied" : ariaLabel}
      className={[
        "text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-ring inline-flex size-7 items-center justify-center rounded-md transition focus-visible:ring-2 focus-visible:outline-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setIsCopied(true);
          window.setTimeout(() => setIsCopied(false), 1200);
        });
      }}
    >
      {isCopied ? (
        <Check aria-hidden="true" className="size-3.5" />
      ) : (
        <Clipboard aria-hidden="true" className="size-3.5" />
      )}
    </button>
  );
}

async function renderMermaidDiagram(
  source: string,
  id: string,
): Promise<DiagramState> {
  const state = await getCachedMermaidDiagram(source);
  return state.status === "ready"
    ? { status: "ready", svg: scopeCachedMermaidSvg(state.svg, id) }
    : state;
}

function getCachedMermaidDiagram(source: string) {
  const key = `${MERMAID_CONFIG.theme}\0${source}`;
  let cached = mermaidDiagramCache.get(key);
  if (!cached) {
    cached = loadMermaidDiagram(source);
    mermaidDiagramCache.set(key, cached);
    while (mermaidDiagramCache.size > 64) {
      const oldestKey = mermaidDiagramCache.keys().next().value;
      if (!oldestKey) break;
      mermaidDiagramCache.delete(oldestKey);
    }
  }
  return cached;
}

async function loadMermaidDiagram(source: string): Promise<DiagramState> {
  try {
    const mermaidModule = await import("mermaid");
    const mermaid = mermaidModule.default;
    mermaid.initialize?.(MERMAID_CONFIG);
    const result = await mermaid.render(
      `markdown-diagram-cache-${hashMermaidSource(source)}`,
      source,
    );
    return { status: "ready", svg: sanitizeSvg(result.svg) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid diagram";
    if (!/getBBox|layout|force-basic-fallback/i.test(message)) {
      return { status: "failed", message };
    }
    return renderBasicMermaidDiagram(source);
  }
}

function scopeCachedMermaidSvg(svg: string, idPrefix: string) {
  if (typeof DOMParser === "undefined") return svg;
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = document.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") return svg;

  const ids = new Map<string, string>();
  for (const element of Array.from(root.querySelectorAll("[id]"))) {
    const id = element.getAttribute("id");
    if (!id) continue;
    const nextId = `${idPrefix}-${id}`;
    ids.set(id, nextId);
    element.setAttribute("id", nextId);
  }
  if (!ids.size) return new XMLSerializer().serializeToString(root);

  for (const element of Array.from(root.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      const value = attribute.value;
      let nextValue = value;
      for (const [oldId, nextId] of ids) {
        nextValue = nextValue
          .replaceAll(`url(#${oldId})`, `url(#${nextId})`)
          .replaceAll(`#${oldId}`, `#${nextId}`);
      }
      if (nextValue !== value) element.setAttribute(attribute.name, nextValue);
    }
  }

  return new XMLSerializer().serializeToString(root);
}

function hashMermaidSource(source: string) {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function renderBasicMermaidDiagram(source: string): ReadyDiagramState {
  const kind = diagramKind(source);
  const lines = readableDiagramLines(source);
  const escaped = escapeHtml(lines.join(" | ") || describeDiagram(source));
  const piePaths =
    kind === "pie"
      ? '<path d="M20 20h20v20H20z"/><path d="M44 20h20v20H44z"/><path d="M68 20h20v20H68z"/>'
      : "";
  return {
    status: "ready",
    svg: `<svg role="img" aria-label="Mermaid diagram" data-pretext-basic-mermaid="${kind}" viewBox="0 0 720 160" width="100%" height="160" xmlns="http://www.w3.org/2000/svg"><rect width="720" height="160" rx="8" fill="currentColor" opacity="0.05"/>${piePaths}<text x="24" y="82" fill="currentColor" font-family="monospace" font-size="16">${escaped}</text></svg>`,
  };
}

function sanitizeSvg(svg: string) {
  if (typeof DOMParser === "undefined") return svg;

  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = document.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") {
    const fallback = renderBasicMermaidDiagram("");
    return fallback.status === "ready" ? fallback.svg : "";
  }

  for (const element of Array.from(root.querySelectorAll("*"))) {
    const tagName = element.tagName.toLowerCase();
    if (
      tagName === "script" ||
      tagName === "a" ||
      tagName === "animate" ||
      tagName === "foreignobject" ||
      tagName === "image" ||
      tagName === "iframe" ||
      tagName === "object" ||
      tagName === "embed" ||
      tagName === "style" ||
      tagName === "use"
    ) {
      element.remove();
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || name === "style") {
        element.removeAttribute(attribute.name);
        continue;
      }
      if ((name === "id" || name === "name") && isDomClobberingId(value)) {
        element.setAttribute(attribute.name, `user-content-${value}`);
        continue;
      }
      if (
        (name === "href" || name.endsWith(":href") || name === "src") &&
        !isSafeSvgReference(value)
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  for (const attribute of Array.from(root.attributes)) {
    const name = attribute.name.toLowerCase();
    if (name.startsWith("on") || name === "style") {
      root.removeAttribute(attribute.name);
      continue;
    }
    if (
      (name === "id" || name === "name") &&
      isDomClobberingId(attribute.value)
    ) {
      root.setAttribute(attribute.name, `user-content-${attribute.value}`);
    }
  }

  return new XMLSerializer()
    .serializeToString(root)
    .replace(/^<svg\b([^>]*)\brole="([^"]*)"([^>]*)>/, '<svg role="$2"$1$3>');
}

function isSafeSvgReference(value: string) {
  return (
    value === "" ||
    value.startsWith("#") ||
    value.startsWith("data:image/") ||
    /^https?:\/\//i.test(value)
  );
}

function readDiagramLimitMessage(source: string) {
  if (source.length > MERMAID_MAX_SOURCE_LENGTH) {
    return "Mermaid diagram too large to render safely. Copy the source and render it in a dedicated diagram tool.";
  }
  if (source.split(/\r\n|[\n\r\u2028\u2029]/).length > MERMAID_MAX_LINES) {
    return "Mermaid diagram has too many lines to render safely. Copy the source and render it in a dedicated diagram tool.";
  }
  return null;
}

function describeDiagram(source: string) {
  const lines = semanticDiagramLines(source);
  const kind = diagramKind(source);
  if (kind === "graph") {
    const direction = lines[0]
      ?.match(/\b(?:graph|flowchart)\s+([A-Z]{2})\b/i)?.[1]
      ?.toUpperCase();
    const directionText = direction === "LR" ? "left to right" : "top down";
    const edges = lines.filter((line) => /-->|---|-.->|==>/.test(line)).length;
    const nodes = new Set<string>();
    for (const line of lines) {
      for (const match of line.matchAll(/\b([A-Za-z][\w-]*)\b/g)) {
        const value = match[1]!;
        if (
          !["graph", "flowchart", "TD", "LR", "TB", "BT", "RL"].includes(value)
        ) {
          nodes.add(value);
        }
      }
    }
    return `Mermaid graph diagram flowing ${directionText}, with ${nodes.size} nodes and ${edges} edge${edges === 1 ? "" : "s"}.`;
  }
  if (kind === "sequence") {
    const messages = lines.filter((line) =>
      /->>|-->>|->|-->/.test(line),
    ).length;
    const participants = new Set<string>();
    for (const line of lines) {
      const participant = /^participant\s+\S+(?:\s+as\s+(.+))?/i.exec(line);
      if (participant)
        participants.add(participant[1] ?? line.split(/\s+/)[1]!);
      for (const side of line.split(/->>|-->>|->|-->/)) {
        const name = side.split(":")[0]?.trim();
        if (name && !/^sequenceDiagram/i.test(name)) participants.add(name);
      }
    }
    return `Mermaid sequence diagram with ${participants.size} participants and ${messages} message${messages === 1 ? "" : "s"}.`;
  }
  if (kind === "state") {
    const transitions = lines.filter((line) => /-->/.test(line)).length;
    const states = new Set<string>();
    for (const line of lines) {
      const stateAlias = /^state\s+"([^"]+)"\s+as\s+(\w+)/.exec(line);
      if (stateAlias) {
        states.add(stateAlias[1]!);
        continue;
      }
      if (!/-->/.test(line)) continue;
      for (const side of line.split(/-->/)) {
        const name = side
          .split(":")[0]!
          .replace(/\[\*\]/g, "")
          .trim();
        if (name && !/^stateDiagram/.test(name)) {
          states.add(name);
        }
      }
    }
    return `Mermaid state diagram with ${states.size} states and ${transitions} transitions.`;
  }
  if (kind === "class") {
    const relationships = lines.filter((line) =>
      /<\|--|--|<--|\.\./.test(line),
    ).length;
    const classes = new Set<string>();
    for (const line of lines) {
      for (const match of line.matchAll(/\b([A-Z][A-Za-z0-9_]*)\b/g))
        classes.add(match[1]!);
    }
    return `Mermaid class diagram with ${classes.size} classes and ${relationships} relationship${relationships === 1 ? "" : "s"}.`;
  }
  if (kind === "er") {
    const relationships = lines.filter((line) =>
      /\|\||o\{|\|\{/.test(line),
    ).length;
    const entities = new Set<string>();
    for (const line of lines) {
      for (const match of line.matchAll(/\b([A-Z][A-Z0-9_]*)\b/g)) {
        if (!["ERDIAGRAM"].includes(match[1]!)) entities.add(match[1]!);
      }
    }
    return `Mermaid entity relationship diagram with ${entities.size} entities and ${relationships} relationships.`;
  }
  if (kind === "journey")
    return `Mermaid journey diagram with ${countLinesStarting(lines, "section ")} sections and ${lines.filter((line) => /:\s*\d+\s*:/.test(line)).length} tasks.`;
  if (kind === "gantt")
    return `Mermaid Gantt chart with ${countLinesStarting(lines, "section ")} sections and ${lines.filter((line) => /:/.test(line) && !/^dateFormat/i.test(line) && !/^title\b/i.test(line)).length} tasks.`;
  if (kind === "gitGraph")
    return `Mermaid Git graph with ${countLinesStarting(lines, "branch ")} branch, ${countExact(lines, "commit")} commits, and ${countLinesStarting(lines, "merge ")} merge.`;
  if (kind === "timeline")
    return `Mermaid timeline with ${countLinesStarting(lines, "section ")} sections and ${lines.filter((line) => /^\d/.test(line)).length} events.`;
  if (kind === "mindmap")
    return `Mermaid mind map with ${Math.max(0, lines.length - 1)} nodes.`;
  if (kind === "quadrantChart")
    return `Mermaid quadrant chart with ${lines.filter((line) => /:\s*\[[^\]]+\]/.test(line)).length} points.`;
  if (kind === "requirementDiagram")
    return `Mermaid requirement diagram with ${countLinesStarting(lines, "requirement ")} requirement, ${countLinesStarting(lines, "element ")} element, and ${lines.filter((line) => /-\s*\w+\s*->/.test(line)).length} relationship.`;
  if (kind === "xychart") {
    const series = lines.filter((line) => /^(bar|line)\s+\[/.test(line));
    const values = series.reduce(
      (sum, line) => sum + (line.match(/-?\d+(?:\.\d+)?/g)?.length ?? 0),
      0,
    );
    return `Mermaid XY chart with ${series.length} series and ${values} values.`;
  }
  if (kind === "sankey") {
    const flows = lines.filter((line) => line.includes(","));
    const nodes = new Set(
      flows.flatMap((line) =>
        line
          .split(",")
          .slice(0, 2)
          .map((item) => item.trim()),
      ),
    );
    return `Mermaid Sankey diagram with ${nodes.size} nodes and ${flows.length} flows.`;
  }
  if (kind === "c4")
    return `Mermaid C4 diagram with ${lines.filter((line) => /^(Person|System)\(/.test(line)).length} nodes and ${countLinesStarting(lines, "Rel(")} relationship.`;
  if (kind === "pie") {
    const values = lines
      .flatMap((line) => line.match(/:\s*(\d+(?:\.\d+)?)/)?.[1] ?? [])
      .map(Number);
    const total = values.reduce((sum, value) => sum + value, 0);
    return `Mermaid pie chart with ${values.length} slices and total value ${total}.`;
  }
  return "Mermaid diagram";
}

function estimateDiagramBodyHeight(source: string) {
  switch (diagramKind(source)) {
    case "graph":
      return 286;
    case "sequence":
      return 160;
    case "state":
      return 238;
    case "class":
      return 220;
    case "er":
      return 292;
    case "journey":
      return 270;
    case "gantt":
      return 300;
    case "gitGraph":
      return 212;
    case "timeline":
      return 270;
    case "mindmap":
      return 232;
    case "quadrantChart":
      return 296;
    case "requirementDiagram":
      return 230;
    case "xychart":
      return 334;
    case "sankey":
      return 310;
    case "c4":
      return 236;
    case "pie":
      return 224;
    default:
      return 180;
  }
}

function diagramKind(source: string) {
  const first = semanticDiagramLines(source)[0] ?? "";
  if (/^(?:graph|flowchart)\b/i.test(first)) return "graph";
  if (/^sequenceDiagram\b/i.test(first)) return "sequence";
  if (/^stateDiagram/i.test(first)) return "state";
  if (/^classDiagram\b/i.test(first)) return "class";
  if (/^erDiagram\b/i.test(first)) return "er";
  if (/^journey\b/i.test(first)) return "journey";
  if (/^gantt\b/i.test(first)) return "gantt";
  if (/^gitGraph\b/i.test(first)) return "gitGraph";
  if (/^timeline\b/i.test(first)) return "timeline";
  if (/^mindmap\b/i.test(first)) return "mindmap";
  if (/^quadrantChart\b/i.test(first)) return "quadrantChart";
  if (/^requirementDiagram\b/i.test(first)) return "requirementDiagram";
  if (/^xychart/i.test(first)) return "xychart";
  if (/^sankey/i.test(first)) return "sankey";
  if (/^C4/i.test(first)) return "c4";
  if (/^pie\b/i.test(first)) return "pie";
  return "source";
}

function semanticDiagramLines(source: string) {
  return stripMermaidFrontmatter(source)
    .split(/\r\n|[\n\r\u2028\u2029]/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%%"));
}

function readableDiagramLines(source: string) {
  const lines = semanticDiagramLines(source);
  if (diagramKind(source) === "pie") {
    return lines.map((line) => {
      const match = /"([^"]+)"\s*:\s*(\d+(?:\.\d+)?)/.exec(line);
      return match ? `${match[1]} ${match[2]} (${match[2]}%)` : line;
    });
  }
  return lines;
}

function stripMermaidFrontmatter(source: string) {
  const lines = source.split(/\r\n|[\n\r\u2028\u2029]/);
  if (lines[0]?.trim() !== "---") return source;
  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  return end === -1 ? source : lines.slice(end + 1).join("\n");
}

function countLinesStarting(lines: readonly string[], prefix: string) {
  return lines.filter((line) => line.startsWith(prefix)).length;
}

function countExact(lines: readonly string[], value: string) {
  return lines.filter((line) => line === value).length;
}

function isDomClobberingId(id: string) {
  return ["constructor", "forms", "images", "location", "__proto__"].includes(
    id,
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
