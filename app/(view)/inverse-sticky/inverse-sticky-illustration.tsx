"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ExternalLink,
  Gauge,
  type LucideIcon,
  MoveDown,
  Timer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { cn } from "@/lib/utils";

const PAGE_COUNT = 54;
const PAGE_HEIGHT = 228;
const RENDERED_PAGE_COUNT = 8;
const RENDERED_HEIGHT = RENDERED_PAGE_COUNT * PAGE_HEIGHT;
const MAX_RANGE_START = PAGE_COUNT - RENDERED_PAGE_COUNT;
const DEFAULT_VIEWPORT_HEIGHT = 620;
const INITIAL_SCROLL_TOP = 18 * PAGE_HEIGHT;
const INITIAL_RANGE_START = calculateRangeStart(
  INITIAL_SCROLL_TOP,
  DEFAULT_VIEWPORT_HEIGHT,
);

const lineWidths = [86, 68, 78, 54, 92, 64, 74, 58, 82] as const;

type PinState = "native" | "top" | "bottom";

export function InverseStickyIllustration() {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const renderedRangeStartRef = React.useRef(INITIAL_RANGE_START);
  const catchupTimeoutRef = React.useRef<number | null>(null);

  const [viewportHeight, setViewportHeight] = React.useState(
    DEFAULT_VIEWPORT_HEIGHT,
  );
  const [scrollTop, setScrollTop] = React.useState(INITIAL_SCROLL_TOP);
  const [targetRangeStart, setTargetRangeStart] =
    React.useState(INITIAL_RANGE_START);
  const [renderedRangeStart, setRenderedRangeStart] =
    React.useState(INITIAL_RANGE_START);
  const [isParsing, setIsParsing] = React.useState(false);
  const [parserDelay, setParserDelay] = React.useState(760);

  renderedRangeStartRef.current = renderedRangeStart;

  useMountEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollTop = INITIAL_SCROLL_TOP;

    const updateViewportMetrics = () => {
      setViewportHeight(viewport.clientHeight || DEFAULT_VIEWPORT_HEIGHT);
      setScrollTop(viewport.scrollTop);
    };

    updateViewportMetrics();

    const resizeObserver = new ResizeObserver(updateViewportMetrics);
    resizeObserver.observe(viewport);

    return () => resizeObserver.disconnect();
  });

  useMountEffect(() => {
    return () => {
      if (catchupTimeoutRef.current !== null) {
        window.clearTimeout(catchupTimeoutRef.current);
      }
    };
  });

  const commitRange = React.useCallback(
    (nextRangeStart: number) => {
      if (catchupTimeoutRef.current !== null) {
        window.clearTimeout(catchupTimeoutRef.current);
      }

      const distance = Math.abs(nextRangeStart - renderedRangeStartRef.current);

      if (distance <= 1) {
        setRenderedRangeStart(nextRangeStart);
        setIsParsing(false);
        catchupTimeoutRef.current = null;
        return;
      }

      setIsParsing(true);
      catchupTimeoutRef.current = window.setTimeout(() => {
        setRenderedRangeStart(nextRangeStart);
        setIsParsing(false);
        catchupTimeoutRef.current = null;
      }, parserDelay);
    },
    [parserDelay],
  );

  const updateScrollModel = React.useCallback(
    (nextScrollTop: number) => {
      const nextRangeStart = calculateRangeStart(nextScrollTop, viewportHeight);

      setScrollTop(nextScrollTop);
      setTargetRangeStart(nextRangeStart);
      commitRange(nextRangeStart);
    },
    [commitRange, viewportHeight],
  );

  const handleScroll = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    updateScrollModel(viewport.scrollTop);
  }, [updateScrollModel]);

  const jumpTo = React.useCallback(
    (ratio: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const maxScrollTop = PAGE_COUNT * PAGE_HEIGHT - viewport.clientHeight;
      const nextScrollTop = Math.round(maxScrollTop * ratio);
      viewport.scrollTo({ top: nextScrollTop, behavior: "auto" });
      updateScrollModel(nextScrollTop);
    },
    [updateScrollModel],
  );

  const renderedTop = renderedRangeStart * PAGE_HEIGHT;
  const viewportBottom = scrollTop + viewportHeight;
  const pinState = getPinState(scrollTop, viewportBottom, renderedTop);
  const stickyOffset = Math.min(0, viewportHeight - RENDERED_HEIGHT);
  const preBufferHeight = renderedTop;
  const postBufferHeight = Math.max(
    0,
    PAGE_COUNT * PAGE_HEIGHT - preBufferHeight - RENDERED_HEIGHT,
  );
  const scrollProgress =
    scrollTop / (PAGE_COUNT * PAGE_HEIGHT - viewportHeight);
  const renderedProgress = renderedTop / (PAGE_COUNT * PAGE_HEIGHT);
  const targetProgress =
    (targetRangeStart * PAGE_HEIGHT) / (PAGE_COUNT * PAGE_HEIGHT);

  return (
    <main className="bg-background text-foreground min-h-screen">
      <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="border-border flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-muted-foreground mb-2 text-sm font-medium">
              FileViewer virtualization model
            </p>
            <h1 className="text-foreground text-3xl font-semibold tracking-normal sm:text-4xl">
              Inverse Sticky Technique
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6 sm:text-base">
              A full-height native scroll region keeps browser behavior intact,
              while the materialized pages stick to the nearest viewport edge
              until parsing catches up.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="w-fit gap-2">
            <Link
              href="https://pierre.computer/writing/on-rendering-diffs"
              target="_blank"
              rel="noreferrer"
            >
              Pierre article
              <ExternalLink className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </header>

        <section className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="border-border bg-card min-w-0 overflow-hidden rounded-lg border shadow-sm">
            <div className="border-border flex flex-col gap-3 border-b p-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  icon={Gauge}
                  label="Native scroll"
                  value={`${Math.round(scrollProgress * 100)}%`}
                />
                <StatusPill
                  icon={Timer}
                  label={isParsing ? "Parser catching up" : "Parser synced"}
                  value={`${parserDelay}ms`}
                  tone={isParsing ? "warning" : "success"}
                />
                <StatusPill
                  icon={MoveDown}
                  label="Sticky edge"
                  value={pinStateLabel(pinState)}
                  tone={pinState === "native" ? "default" : "accent"}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => jumpTo(0)}
                >
                  <ArrowUpToLine className="size-4" aria-hidden="true" />
                  Top
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => jumpTo(0.72)}
                >
                  <MoveDown className="size-4" aria-hidden="true" />
                  Large jump
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => jumpTo(1)}
                >
                  <ArrowDownToLine className="size-4" aria-hidden="true" />
                  End
                </Button>
              </div>
            </div>

            <div
              ref={viewportRef}
              onScroll={handleScroll}
              tabIndex={0}
              role="region"
              aria-label="Native scrolling inverse sticky illustration"
              className="ring-ring relative h-[min(72vh,720px)] min-h-[520px] overflow-y-auto bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-neutral-950)_94%,var(--color-cyan-400))_0%,var(--color-neutral-950)_62%,color-mix(in_srgb,var(--color-neutral-950)_92%,var(--color-emerald-400))_100%)] p-3 transition outline-none focus-visible:ring-2 md:p-5"
            >
              <div className="pointer-events-none sticky top-3 z-30 mb-[-48px] flex justify-center">
                <div
                  className={cn(
                    "rounded-md border px-3 py-2 text-xs font-medium shadow-lg backdrop-blur",
                    pinState === "native" &&
                      "border-cyan-300/30 bg-cyan-950/70 text-cyan-50",
                    pinState === "top" &&
                      "border-amber-300/40 bg-amber-950/75 text-amber-50",
                    pinState === "bottom" &&
                      "border-emerald-300/40 bg-emerald-950/75 text-emerald-50",
                  )}
                >
                  {isParsing
                    ? "Rendered range pinned; new pages are parsing"
                    : "Rendered range tracks the viewport"}
                </div>
              </div>

              <div
                className="relative mx-auto w-full max-w-[820px]"
                style={{ height: PAGE_COUNT * PAGE_HEIGHT }}
              >
                <DocumentPositionRail
                  renderedProgress={renderedProgress}
                  scrollProgress={scrollProgress}
                  targetProgress={targetProgress}
                />
                <div aria-hidden="true" style={{ height: preBufferHeight }} />
                <div
                  className={cn(
                    "relative z-10 overflow-hidden rounded-md border bg-white shadow-2xl transition-shadow duration-200",
                    pinState === "native" &&
                      "border-cyan-300/60 shadow-cyan-950/40",
                    pinState === "top" &&
                      "border-amber-300/80 shadow-amber-950/50",
                    pinState === "bottom" &&
                      "border-emerald-300/80 shadow-emerald-950/50",
                  )}
                  style={{
                    height: RENDERED_HEIGHT,
                    position: "sticky",
                    top: stickyOffset,
                    bottom: stickyOffset,
                  }}
                >
                  <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/95 px-4 py-2 text-xs font-medium text-neutral-600 backdrop-blur">
                    <span>
                      Rendered pages {renderedRangeStart + 1}-
                      {renderedRangeStart + RENDERED_PAGE_COUNT}
                    </span>
                    <span className="font-mono text-[11px] text-neutral-500">
                      sticky: {stickyOffset}px
                    </span>
                  </div>
                  <div className="pt-9">
                    {Array.from({ length: RENDERED_PAGE_COUNT }, (_, index) => (
                      <DocumentPage
                        key={renderedRangeStart + index}
                        pageNumber={renderedRangeStart + index + 1}
                        isAnchor={
                          renderedRangeStart + index === targetRangeStart
                        }
                      />
                    ))}
                  </div>
                </div>
                <div aria-hidden="true" style={{ height: postBufferHeight }} />
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="border-border bg-card rounded-lg border p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Scroll Model</h2>
                <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 font-mono text-[11px]">
                  {PAGE_COUNT} pages
                </span>
              </div>
              <ModelMeter
                label="Viewport"
                value={scrollProgress}
                className="bg-cyan-500"
              />
              <ModelMeter
                label="Rendered window"
                value={renderedProgress}
                className="bg-emerald-500"
              />
              <ModelMeter
                label="Parser target"
                value={targetProgress}
                className="bg-amber-500"
              />
            </div>

            <div className="border-border bg-card rounded-lg border p-4 shadow-sm">
              <label
                htmlFor="parser-delay"
                className="flex items-center justify-between gap-3 text-sm font-semibold"
              >
                Parser delay
                <output
                  htmlFor="parser-delay"
                  className="text-muted-foreground font-mono text-xs"
                >
                  {parserDelay}ms
                </output>
              </label>
              <input
                id="parser-delay"
                type="range"
                min={120}
                max={1400}
                step={80}
                value={parserDelay}
                onChange={(event) =>
                  setParserDelay(Number(event.currentTarget.value))
                }
                className="accent-foreground mt-4 w-full"
              />
              <p className="text-muted-foreground mt-3 text-sm leading-6">
                Increase the delay, then use Large jump. The browser moves the
                scroll position immediately; the rendered window stays visible
                until the target range commits.
              </p>
            </div>

            <div className="border-border bg-card rounded-lg border p-4 shadow-sm">
              <h2 className="text-sm font-semibold">Pinned Range Rules</h2>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                <RuleSwatch
                  className="bg-cyan-500"
                  title="Inside range"
                  body="The rendered pages scroll normally with the native viewport."
                />
                <RuleSwatch
                  className="bg-amber-500"
                  title="Jump above"
                  body="The top edge sticks to the viewport while older content catches up."
                />
                <RuleSwatch
                  className="bg-emerald-500"
                  title="Jump below"
                  body="The bottom edge sticks to the viewport instead of revealing blank space."
                />
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function DocumentPage({
  isAnchor,
  pageNumber,
}: {
  isAnchor: boolean;
  pageNumber: number;
}) {
  return (
    <section
      className={cn(
        "border-t border-neutral-200 bg-white p-4 text-neutral-900",
        isAnchor && "bg-amber-50",
      )}
      style={{ height: PAGE_HEIGHT }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] font-medium tracking-normal text-neutral-500 uppercase">
            Page {pageNumber.toString().padStart(2, "0")}
          </div>
          <div className="mt-2 h-3 w-44 rounded-sm bg-neutral-900" />
        </div>
        <div className="rounded-sm border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-[11px] text-neutral-500">
          parsed
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        {lineWidths.map((width, index) => (
          <div
            key={`${pageNumber}-${index}`}
            className="flex items-center gap-2"
          >
            <span className="w-8 text-right font-mono text-[11px] text-neutral-400">
              {pageNumber * 10 + index}
            </span>
            <span
              className={cn(
                "h-2 rounded-full",
                index % 5 === 0 && "bg-cyan-300",
                index % 5 === 1 && "bg-neutral-300",
                index % 5 === 2 && "bg-emerald-300",
                index % 5 === 3 && "bg-neutral-200",
                index % 5 === 4 && "bg-amber-300",
              )}
              style={{ width: `${width}%` }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function DocumentPositionRail({
  renderedProgress,
  scrollProgress,
  targetProgress,
}: {
  renderedProgress: number;
  scrollProgress: number;
  targetProgress: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="absolute top-0 right-[-18px] bottom-0 hidden w-3 rounded-full bg-white/10 xl:block"
    >
      <span
        className="absolute left-0 h-9 w-3 rounded-full bg-emerald-400"
        style={{ top: `${clamp(renderedProgress, 0, 0.95) * 100}%` }}
      />
      <span
        className="absolute left-[-3px] h-3 w-9 rounded-full bg-cyan-300"
        style={{ top: `${clamp(scrollProgress, 0, 0.98) * 100}%` }}
      />
      <span
        className="absolute left-0 h-3 w-3 rounded-full bg-amber-300"
        style={{ top: `${clamp(targetProgress, 0, 0.98) * 100}%` }}
      />
    </div>
  );
}

function StatusPill({
  icon: Icon,
  label,
  tone = "default",
  value,
}: {
  icon: LucideIcon;
  label: string;
  tone?: "accent" | "default" | "success" | "warning";
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
        tone === "default" && "border-border bg-background",
        tone === "accent" && "border-cyan-500/30 bg-cyan-500/10",
        tone === "success" && "border-emerald-500/30 bg-emerald-500/10",
        tone === "warning" && "border-amber-500/30 bg-amber-500/10",
      )}
    >
      <Icon className="size-3.5" aria-hidden={true} />
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground font-mono">{value}</span>
    </div>
  );
}

function ModelMeter({
  className,
  label,
  value,
}: {
  className: string;
  label: string;
  value: number;
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground font-mono">
          {Math.round(clamp(value, 0, 1) * 100)}%
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full", className)}
          style={{ width: `${clamp(value, 0, 1) * 100}%` }}
        />
      </div>
    </div>
  );
}

function RuleSwatch({
  body,
  className,
  title,
}: {
  body: string;
  className: string;
  title: string;
}) {
  return (
    <div className="grid grid-cols-[12px_minmax(0,1fr)] gap-3">
      <span className={cn("mt-1 h-3 w-3 rounded-sm", className)} />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="text-muted-foreground mt-1 block leading-6">
          {body}
        </span>
      </span>
    </div>
  );
}

function calculateRangeStart(scrollTop: number, viewportHeight: number) {
  const firstVisiblePage = Math.floor(scrollTop / PAGE_HEIGHT);
  const visiblePageCount = Math.max(1, Math.ceil(viewportHeight / PAGE_HEIGHT));
  const leadingBuffer = Math.max(
    1,
    Math.floor((RENDERED_PAGE_COUNT - visiblePageCount) / 2),
  );

  return clamp(firstVisiblePage - leadingBuffer, 0, MAX_RANGE_START);
}

function getPinState(
  scrollTop: number,
  viewportBottom: number,
  renderedTop: number,
): PinState {
  if (scrollTop < renderedTop) return "top";
  if (viewportBottom > renderedTop + RENDERED_HEIGHT) return "bottom";
  return "native";
}

function pinStateLabel(pinState: PinState) {
  if (pinState === "top") return "top";
  if (pinState === "bottom") return "bottom";
  return "none";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
