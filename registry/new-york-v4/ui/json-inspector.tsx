"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";

const SMALL_JSON_LINE_LIMIT = 500;
const VIRTUAL_LINE_HEIGHT = 20;
const VIRTUAL_OVERSCAN = 8;
const INITIAL_VIEWPORT_HEIGHT = 480;
const MAX_RENDERED_LINES = 500;

/**
 * A small copy-to-clipboard button. Shows a transient check on success; style
 * placement via `className` (e.g. absolute-position it over a panel).
 */
export function CopyButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1.5 transition-colors",
        className,
      )}
      title="Copy"
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}

/** Lightweight JSON syntax highlighting that respects the theme. */
function colorizeJsonLine(line: string): React.ReactNode {
  const patterns: { regex: RegExp; className: string }[] = [
    {
      regex: /"([^"]+)"(?=\s*:)/g,
      className: "text-violet-600 dark:text-violet-400",
    },
    { regex: /"([^"]*)"/g, className: "text-amber-700 dark:text-amber-400" },
    {
      regex: /\b(true|false)\b/g,
      className: "text-emerald-600 dark:text-emerald-400",
    },
    { regex: /\bnull\b/g, className: "text-muted-foreground" },
    {
      regex: /\b(\d+\.?\d*)\b/g,
      className: "text-blue-600 dark:text-blue-400",
    },
  ];

  const spans: {
    start: number;
    end: number;
    className: string;
    text: string;
  }[] = [];

  for (const { regex, className } of patterns) {
    const re = new RegExp(regex.source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(line)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const overlaps = spans.some((s) => !(start >= s.end || end <= s.start));
      if (!overlaps) {
        spans.push({ start, end, className, text: match[0] });
      }
    }
  }

  if (spans.length === 0) {
    return <span className="text-foreground/70">{line}</span>;
  }

  spans.sort((a, b) => a.start - b.start);
  const elements: React.ReactNode[] = [];
  let lastEnd = 0;
  for (const span of spans) {
    if (span.start > lastEnd) {
      elements.push(
        <span key={`t-${lastEnd}`} className="text-foreground/70">
          {line.slice(lastEnd, span.start)}
        </span>,
      );
    }
    elements.push(
      <span key={`s-${span.start}`} className={span.className}>
        {span.text}
      </span>,
    );
    lastEnd = span.end;
  }
  if (lastEnd < line.length) {
    elements.push(
      <span key={`t-${lastEnd}`} className="text-foreground/70">
        {line.slice(lastEnd)}
      </span>,
    );
  }
  return elements;
}

function useJsonLineFragments() {
  const cacheRef = React.useRef(new Map<string, React.ReactNode>());

  return React.useCallback((line: string) => {
    const cached = cacheRef.current.get(line);
    if (cached) return cached;

    const fragments = colorizeJsonLine(line);
    cacheRef.current.set(line, fragments);
    return fragments;
  }, []);
}

function jsonLineWindow({
  lineCount,
  scrollTop,
  viewportHeight,
}: {
  lineCount: number;
  scrollTop: number;
  viewportHeight: number;
}) {
  if (lineCount <= 0) return { start: 0, end: 0 };

  const safeScrollTop =
    Number.isFinite(scrollTop) && scrollTop > 0 ? scrollTop : 0;
  const safeViewportHeight =
    Number.isFinite(viewportHeight) && viewportHeight > 0
      ? viewportHeight
      : INITIAL_VIEWPORT_HEIGHT;
  const visibleStart = clamp(
    Math.floor(safeScrollTop / VIRTUAL_LINE_HEIGHT),
    0,
    lineCount - 1,
  );
  const visibleCount = Math.max(
    1,
    Math.ceil(safeViewportHeight / VIRTUAL_LINE_HEIGHT),
  );
  const uncappedStart = Math.max(0, visibleStart - VIRTUAL_OVERSCAN);
  const uncappedEnd = Math.min(
    lineCount,
    visibleStart + visibleCount + VIRTUAL_OVERSCAN,
  );

  if (uncappedEnd - uncappedStart <= MAX_RENDERED_LINES) {
    return { start: uncappedStart, end: uncappedEnd };
  }

  return {
    start: visibleStart,
    end: Math.min(lineCount, visibleStart + MAX_RENDERED_LINES),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function JsonInspectorLines({ lines }: { lines: string[] }) {
  const fragmentsForLine = useJsonLineFragments();

  return (
    <pre className="p-3 font-mono text-xs leading-5">
      {lines.map((line, i) => (
        <div key={i}>{fragmentsForLine(line)}</div>
      ))}
    </pre>
  );
}

function VirtualJsonInspectorLines({ lines }: { lines: string[] }) {
  const fragmentsForLine = useJsonLineFragments();
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const frameRef = React.useRef(0);
  const [windowRange, setWindowRange] = React.useState(() =>
    jsonLineWindow({
      lineCount: lines.length,
      scrollTop: 0,
      viewportHeight: INITIAL_VIEWPORT_HEIGHT,
    }),
  );

  const measure = React.useCallback(() => {
    frameRef.current = 0;
    const viewport = viewportRef.current;
    const nextRange = jsonLineWindow({
      lineCount: lines.length,
      scrollTop: viewport?.scrollTop ?? 0,
      viewportHeight: viewport?.clientHeight ?? INITIAL_VIEWPORT_HEIGHT,
    });
    setWindowRange((current) =>
      current.start === nextRange.start && current.end === nextRange.end
        ? current
        : nextRange,
    );
  }, [lines.length]);

  const scheduleMeasure = React.useCallback(() => {
    if (frameRef.current) return;
    let didRun = false;
    const frame = requestAnimationFrame(() => {
      didRun = true;
      measure();
    });
    frameRef.current = didRun ? 0 : frame;
  }, [measure]);

  useKeyedLayoutEffect(joinEffectKey([measure]), () => {
    measure();
  });

  useKeyedMountEffect(joinEffectKey([scheduleMeasure]), () => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.addEventListener("scroll", scheduleMeasure, { passive: true });
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(scheduleMeasure)
        : null;
    observer?.observe(viewport);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      viewport.removeEventListener("scroll", scheduleMeasure);
      observer?.disconnect();
    };
  });

  const visibleLines = lines.slice(windowRange.start, windowRange.end);

  return (
    <div
      ref={viewportRef}
      data-slot="json-inspector-virtual-scroll"
      className="h-full overflow-auto"
    >
      <pre
        className="relative p-0 font-mono text-xs leading-5"
        style={{ height: lines.length * VIRTUAL_LINE_HEIGHT }}
      >
        <div
          className="absolute right-0 left-0 px-3 py-3"
          style={{
            transform: `translate3d(0, ${
              windowRange.start * VIRTUAL_LINE_HEIGHT
            }px, 0)`,
          }}
        >
          {visibleLines.map((line, offset) => {
            const lineIndex = windowRange.start + offset;
            return (
              <div
                key={lineIndex}
                data-json-line-index={lineIndex}
                style={{ height: VIRTUAL_LINE_HEIGHT }}
              >
                {fragmentsForLine(line)}
              </div>
            );
          })}
        </div>
      </pre>
    </div>
  );
}

/**
 * A read-only JSON viewer: pretty-prints `data`, applies theme-aware syntax
 * highlighting, scrolls within its container, and reveals a copy button on hover.
 */
export function JsonInspector({
  data,
  className,
}: {
  data: unknown;
  className?: string;
}) {
  const formatted = React.useMemo(() => JSON.stringify(data, null, 2), [data]);
  const lines = React.useMemo(() => formatted.split("\n"), [formatted]);
  const shouldVirtualize = lines.length > SMALL_JSON_LINE_LIMIT;

  return (
    <div className={cn("group relative h-full", className)}>
      {shouldVirtualize ? (
        <VirtualJsonInspectorLines lines={lines} />
      ) : (
        <ScrollArea className="h-full">
          <JsonInspectorLines lines={lines} />
        </ScrollArea>
      )}
      <CopyButton
        text={formatted}
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </div>
  );
}
