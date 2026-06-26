"use client";

import * as React from "react";
import Link from "next/link";
import { Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { cn } from "@/lib/utils";

type Phase = "caught" | "pinned" | "scrolling" | "synced";

const PAGE_COUNT = 48;
const PAGE_HEIGHT = 96;
const WINDOW_PAGE_COUNT = 12;
const VIEWPORT_HEIGHT = 560;
const WINDOW_HEIGHT = WINDOW_PAGE_COUNT * PAGE_HEIGHT;
const START_SCROLL_TOP = 14 * PAGE_HEIGHT;
const TARGET_SCROLL_TOP = 20 * PAGE_HEIGHT;
const START_WINDOW_PAGE = 12;
const TARGET_WINDOW_PAGE = 18;
const ANIMATION_DURATION_MS = 4600;

export function MinimalInverseSticky() {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const frameRef = React.useRef<number | null>(null);
  const startedAtRef = React.useRef<number | null>(null);
  const phaseRef = React.useRef<Phase>("synced");
  const didCommitRef = React.useRef(false);

  const [committedWindowPage, setCommittedWindowPage] =
    React.useState(START_WINDOW_PAGE);
  const [phase, setPhase] = React.useState<Phase>("synced");
  const [scrollTop, setScrollTop] = React.useState(START_SCROLL_TOP);
  const [animationProgress, setAnimationProgress] = React.useState(0);

  const setPhaseOnce = React.useCallback((nextPhase: Phase) => {
    if (phaseRef.current === nextPhase) return;
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const stopAnimation = React.useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    startedAtRef.current = null;
  }, []);

  const reset = React.useCallback(() => {
    stopAnimation();
    didCommitRef.current = false;
    phaseRef.current = "synced";
    setPhase("synced");
    setCommittedWindowPage(START_WINDOW_PAGE);
    setScrollTop(START_SCROLL_TOP);
    setAnimationProgress(0);

    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = START_SCROLL_TOP;
  }, [stopAnimation]);

  const play = React.useCallback(() => {
    reset();

    const tick = (timestamp: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      if (startedAtRef.current === null) startedAtRef.current = timestamp;

      const progress = clamp(
        (timestamp - startedAtRef.current) / ANIMATION_DURATION_MS,
        0,
        1,
      );
      setAnimationProgress(progress);
      const scrollProgress = scrollProgressForAnimation(progress);
      const nextScrollTop = lerp(
        START_SCROLL_TOP,
        TARGET_SCROLL_TOP,
        scrollProgress,
      );
      viewport.scrollTop = nextScrollTop;
      setScrollTop(nextScrollTop);

      if (progress < 0.06) {
        setPhaseOnce("synced");
      } else if (scrollProgress < 0.995) {
        setPhaseOnce("scrolling");
      } else if (progress < 0.84) {
        setPhaseOnce("pinned");
      } else {
        if (!didCommitRef.current) {
          didCommitRef.current = true;
          setCommittedWindowPage(TARGET_WINDOW_PAGE);
        }
        setPhaseOnce("caught");
      }

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
      }
    };

    frameRef.current = window.requestAnimationFrame(tick);
  }, [reset, setPhaseOnce]);

  const handleViewportScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(event.currentTarget.scrollTop);
    },
    [],
  );

  useMountEffect(() => {
    reset();
    play();
    return stopAnimation;
  });

  const committedTop = committedWindowPage * PAGE_HEIGHT;
  const browserPage = Math.floor(scrollTop / PAGE_HEIGHT);
  const viewportLeadPage = browserPage + 1;
  const scrollPercent =
    (scrollTop - START_SCROLL_TOP) / (TARGET_SCROLL_TOP - START_SCROLL_TOP);
  const parserProgress = parserProgressForAnimation(animationProgress);
  const stickyOffset = VIEWPORT_HEIGHT - WINDOW_HEIGHT;
  const postHeight = Math.max(
    0,
    PAGE_COUNT * PAGE_HEIGHT - committedTop - WINDOW_HEIGHT,
  );
  const pages = Array.from(
    { length: WINDOW_PAGE_COUNT },
    (_, index) => committedWindowPage + index,
  );

  return (
    <main className="bg-background text-foreground min-h-screen">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-6">
        <header className="border-border flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-muted-foreground text-sm">minimal study</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">
              inverse sticky
            </h1>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
              A real scroll container moves a few pages. The rendered range is
              held by sticky positioning while the next nearby range catches up.
            </p>
          </div>
          <Link
            href="https://pierre.computer/writing/on-rendering-diffs"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground w-fit text-sm underline underline-offset-4"
          >
            pierre.computer
          </Link>
        </header>

        <section className="border-border bg-card rounded-md border">
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <Status phase={phase} />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={reset}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="gap-2"
                onClick={play}
              >
                <Play className="size-4" aria-hidden="true" />
                Replay
              </Button>
            </div>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:p-6">
            <div
              ref={viewportRef}
              tabIndex={0}
              role="region"
              aria-label="Animated native scroll inverse sticky illustration"
              className="ring-ring relative overflow-y-auto rounded-md bg-neutral-200 p-4 outline-none focus-visible:ring-2"
              style={{ height: VIEWPORT_HEIGHT }}
              onScroll={handleViewportScroll}
            >
              <ScrollTelemetry
                browserPage={browserPage}
                committedWindowPage={committedWindowPage}
                scrollPercent={scrollPercent}
              />
              <ParserCue parserProgress={parserProgress} phase={phase} />
              <div
                className="relative mx-auto w-full max-w-2xl"
                style={{ height: PAGE_COUNT * PAGE_HEIGHT }}
              >
                <div aria-hidden="true" style={{ height: committedTop }} />
                <div
                  className={cn(
                    "relative z-10 overflow-hidden rounded-md border bg-white text-neutral-950 shadow-sm transition-[border-color,box-shadow]",
                    phase === "pinned"
                      ? "border-amber-400 shadow-lg shadow-amber-400/20"
                      : phase === "caught"
                        ? "border-emerald-300 shadow-md shadow-emerald-500/10"
                        : "border-neutral-300",
                  )}
                  style={{
                    height: WINDOW_HEIGHT,
                    position: "sticky",
                    top: stickyOffset,
                    bottom: stickyOffset,
                  }}
                >
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/95 px-4 py-3 text-xs backdrop-blur">
                    <span className="font-medium text-neutral-950">
                      rendered pages {committedWindowPage}-
                      {committedWindowPage + WINDOW_PAGE_COUNT - 1}
                    </span>
                    <span className="font-mono text-neutral-500">
                      {phaseLabel(phase)}
                    </span>
                  </div>
                  <div>
                    {pages.map((page) => {
                      const isHeldForCommit =
                        phase === "pinned" &&
                        page >= TARGET_WINDOW_PAGE &&
                        page < START_WINDOW_PAGE + WINDOW_PAGE_COUNT;
                      const isFreshAfterCommit =
                        phase === "caught" &&
                        page >= START_WINDOW_PAGE + WINDOW_PAGE_COUNT;

                      return (
                        <DocumentPage
                          key={page}
                          page={page}
                          isFreshAfterCommit={isFreshAfterCommit}
                          isHeldForCommit={isHeldForCommit}
                          isViewportLead={page === viewportLeadPage}
                        />
                      );
                    })}
                  </div>
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1.5 overflow-hidden bg-black/10 transition-opacity duration-200",
                      phase === "pinned" || phase === "caught"
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  >
                    <div
                      className={cn(
                        "h-full rounded-r-full transition-colors",
                        phase === "caught" ? "bg-emerald-500" : "bg-amber-500",
                      )}
                      style={{
                        width: `${Math.max(parserProgress * 100, phase === "pinned" ? 8 : 0)}%`,
                      }}
                    />
                  </div>
                </div>
                <div aria-hidden="true" style={{ height: postHeight }} />
              </div>
            </div>

            <aside className="border-border rounded-md border p-4 text-sm">
              <h2 className="font-medium">What is moving</h2>
              <dl className="mt-4 grid gap-3">
                <Metric label="browser page" value={String(browserPage)} />
                <Metric
                  label="rendered range"
                  value={`${committedWindowPage}-${committedWindowPage + WINDOW_PAGE_COUNT - 1}`}
                />
                <Metric
                  label="parser target"
                  value={`${TARGET_WINDOW_PAGE}-${TARGET_WINDOW_PAGE + WINDOW_PAGE_COUNT - 1}`}
                />
                <Metric label="scroll amount" value="6 pages" />
                <Metric label="state" value={phaseLabel(phase)} />
              </dl>
              <ProgressMeter
                label="browser scroll"
                value={clamp(scrollPercent, 0, 1)}
              />
              <ProgressMeter label="parser" value={parserProgress} />
              <p className="text-muted-foreground mt-5 leading-6">
                During the pause, the browser has already scrolled. The old
                rendered range sticks to the viewport edge until the parser
                commits the nearby range.
              </p>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function Status({ phase }: { phase: Phase }) {
  const label =
    phase === "synced"
      ? "1. ready at page 14"
      : phase === "scrolling"
        ? "2. native scroll is moving"
        : phase === "pinned"
          ? "3. render lags; sticky keeps pages visible"
          : "4. parser commits pages 18-29";

  return (
    <div className="text-muted-foreground font-mono text-xs sm:text-sm">
      {label}
    </div>
  );
}

function ScrollTelemetry({
  browserPage,
  committedWindowPage,
  scrollPercent,
}: {
  browserPage: number;
  committedWindowPage: number;
  scrollPercent: number;
}) {
  return (
    <div className="pointer-events-none sticky top-0 z-30 mx-auto mb-[-42px] flex max-w-2xl items-center gap-3 rounded-b-md border-x border-b border-neutral-300 bg-white/95 px-3 py-2 text-[11px] text-neutral-600 shadow-sm backdrop-blur">
      <span className="font-mono">browser p{browserPage}</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-neutral-900"
          style={{ width: `${clamp(scrollPercent, 0, 1) * 100}%` }}
        />
      </div>
      <span className="font-mono">
        rendered {committedWindowPage}-
        {committedWindowPage + WINDOW_PAGE_COUNT - 1}
      </span>
    </div>
  );
}

function ParserCue({
  parserProgress,
  phase,
}: {
  parserProgress: number;
  phase: Phase;
}) {
  const visible = parserProgress > 0 || phase === "caught";

  return (
    <div
      className={cn(
        "pointer-events-none sticky top-12 z-30 mx-auto mb-[-82px] grid w-[min(280px,80%)] gap-2 rounded-md border px-3 py-2 text-xs font-medium shadow-sm transition-opacity",
        phase === "caught"
          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
          : "border-amber-300 bg-amber-50 text-amber-950",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <span>
        {phase === "caught"
          ? "parser committed pages 18-29"
          : "parser streaming pages 18-29"}
      </span>
      <span className="h-1 overflow-hidden rounded-full bg-black/10">
        <span
          className={cn(
            "block h-full rounded-full",
            phase === "caught" ? "bg-emerald-600" : "bg-amber-500",
          )}
          style={{ width: `${clamp(parserProgress, 0, 1) * 100}%` }}
        />
      </span>
    </div>
  );
}

function DocumentPage({
  isFreshAfterCommit,
  isHeldForCommit,
  isViewportLead,
  page,
}: {
  isFreshAfterCommit: boolean;
  isHeldForCommit: boolean;
  isViewportLead: boolean;
  page: number;
}) {
  return (
    <section
      className={cn(
        "relative grid border-b border-neutral-200 bg-white px-4 py-3 transition-colors duration-300",
        isHeldForCommit && "bg-amber-50/80",
        isFreshAfterCommit && "bg-emerald-50",
      )}
      style={{ height: PAGE_HEIGHT }}
    >
      <span
        className={cn(
          "absolute inset-y-3 left-0 w-1 rounded-r-full transition-[background-color,opacity]",
          isViewportLead ? "bg-neutral-950 opacity-100" : "opacity-0",
        )}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-neutral-500">page {page}</span>
        <span
          className={cn(
            "h-1.5 w-10 rounded-full bg-neutral-200 transition-colors",
            isHeldForCommit && "bg-amber-300",
            isFreshAfterCommit && "bg-emerald-400",
            isViewportLead && "bg-neutral-950",
          )}
        />
      </div>
      <div className="grid gap-2">
        <span className="h-px w-11/12 bg-neutral-200" />
        <span className="h-px w-7/12 bg-neutral-200" />
        <span className="h-px w-10/12 bg-neutral-200" />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs">{value}</dd>
    </div>
  );
}

function ProgressMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground font-mono">
          {Math.round(value * 100)}%
        </span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-foreground h-full rounded-full transition-[width]"
          style={{ width: `${clamp(value, 0, 1) * 100}%` }}
        />
      </div>
    </div>
  );
}

function phaseLabel(phase: Phase) {
  if (phase === "synced") return "synced";
  if (phase === "scrolling") return "scrolling";
  if (phase === "pinned") return "sticky pinned";
  return "caught up";
}

function parserProgressForAnimation(progress: number) {
  if (progress < 0.48) return 0;
  if (progress >= 0.84) return 1;
  return easeInOutCubic((progress - 0.48) / 0.36);
}

function scrollProgressForAnimation(progress: number) {
  const active = clamp((progress - 0.03) / 0.61, 0, 1);
  const firstImpulse = 0.43 * easeOutCubic(clamp(active / 0.34, 0, 1));
  const secondImpulse = 0.35 * easeOutCubic(clamp((active - 0.2) / 0.38, 0, 1));
  const coast = 0.22 * easeOutCubic(clamp((active - 0.5) / 0.5, 0, 1));

  return clamp(firstImpulse + secondImpulse + coast, 0, 1);
}

function easeInOutCubic(value: number) {
  const clamped = clamp(value, 0, 1);
  if (clamped < 0.5) return 4 * clamped * clamped * clamped;
  return 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

function easeOutCubic(value: number) {
  const clamped = clamp(value, 0, 1);
  return 1 - Math.pow(1 - clamped, 3);
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
