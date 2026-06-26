"use client";

import * as React from "react";
import Link from "next/link";
import { Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { cn } from "@/lib/utils";

type Phase = "caught" | "catching" | "pinned" | "scrolling" | "synced";

const oldPages = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29];
const newPages = [22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33];
const ANIMATION_DURATION_MS = 4800;
const VIEWPORT_HEIGHT = 540;
const STACK_HEIGHT = 860;
const START_TOP = -54;
const PINNED_TOP = VIEWPORT_HEIGHT - STACK_HEIGHT;
const RELEASED_TOP = -218;

export function MinimalInverseSticky() {
  const animationFrameRef = React.useRef<number | null>(null);
  const animationStartedAtRef = React.useRef<number | null>(null);
  const [progress, setProgress] = React.useState(0);

  const stopAnimation = React.useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    animationStartedAtRef.current = null;
  }, []);

  const play = React.useCallback(() => {
    stopAnimation();
    setProgress(0);

    const tick = (timestamp: number) => {
      if (animationStartedAtRef.current === null) {
        animationStartedAtRef.current = timestamp;
      }

      const elapsed = timestamp - animationStartedAtRef.current;
      const nextProgress = clamp(elapsed / ANIMATION_DURATION_MS, 0, 1);
      setProgress(nextProgress);

      if (nextProgress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
  }, [stopAnimation]);

  const reset = React.useCallback(() => {
    stopAnimation();
    setProgress(0);
  }, [stopAnimation]);

  useMountEffect(() => {
    play();
    return stopAnimation;
  });

  const phase = phaseForProgress(progress);
  const stackTop = stackTopForProgress(progress);
  const newRangeOpacity = opacityForNewRange(progress);
  const oldRangeOpacity = 1 - newRangeOpacity;
  const isPinned = phase === "pinned";
  const isParsing = phase === "pinned" || phase === "catching";

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
              This version behaves like a short scroll. The content glides, the
              rendered range briefly sticks when parsing falls behind, then the
              nearby pages fade in.
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

          <div className="grid gap-6 p-4 lg:grid-cols-[120px_minmax(0,1fr)] lg:p-6">
            <DocumentRail progress={progress} />

            <div>
              <div
                className="border-border bg-muted relative overflow-hidden rounded-md border"
                style={{ height: VIEWPORT_HEIGHT }}
              >
                <div className="border-border bg-background/95 absolute inset-x-0 top-0 z-30 flex items-center justify-between border-b px-4 py-3 text-sm backdrop-blur">
                  <span className="font-medium">viewport</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {phaseLabel(phase)}
                  </span>
                </div>

                <PageStack
                  activePage={24}
                  label="current rendered pages"
                  opacity={oldRangeOpacity}
                  pages={oldPages}
                  stackTop={stackTop}
                />
                <PageStack
                  activePage={28}
                  label="updated rendered pages"
                  opacity={newRangeOpacity}
                  pages={newPages}
                  stackTop={stackTop}
                />

                <div
                  className={cn(
                    "pointer-events-none absolute inset-x-0 bottom-0 z-40 border-t px-4 py-2 text-center text-xs font-medium transition-opacity duration-300",
                    isPinned
                      ? "border-foreground bg-background text-foreground opacity-100"
                      : "border-transparent opacity-0",
                  )}
                >
                  pinned edge keeps the viewport filled
                </div>

                <TargetGhost visible={isParsing} />
              </div>

              <StepStrip phase={phase} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Status({ phase }: { phase: Phase }) {
  const label =
    phase === "synced"
      ? "1. native scroll starts synced"
      : phase === "scrolling"
        ? "2. pages glide like a normal scroll"
        : phase === "pinned"
          ? "3. render lags; old range pins"
          : phase === "catching"
            ? "4. parser replaces the range"
            : "5. nearby pages are rendered";

  return (
    <div className="text-muted-foreground font-mono text-xs sm:text-sm">
      {label}
    </div>
  );
}

function DocumentRail({ progress }: { progress: number }) {
  const knobTop = lerp(25, 50, easeOutCubic(clamp(progress / 0.58, 0, 1)));

  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-4 lg:flex lg:flex-col lg:items-start">
      <div
        className="border-border bg-muted relative w-12 rounded-full border"
        style={{ height: VIEWPORT_HEIGHT }}
      >
        <div className="bg-border absolute inset-x-1 top-[34%] h-px" />
        <div className="bg-border absolute inset-x-1 top-[52%] h-px" />
        <div
          className="border-foreground bg-background absolute left-1/2 h-12 w-8 -translate-x-1/2 rounded-full border"
          style={{ top: `${knobTop}%` }}
        />
      </div>
      <div className="text-muted-foreground grid gap-2 text-xs lg:mt-3">
        <div className="flex items-center gap-2">
          <span className="bg-border h-px w-5" />
          start
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-foreground h-px w-5" />
          scroll target
        </div>
      </div>
    </div>
  );
}

function PageStack({
  activePage,
  label,
  opacity,
  pages,
  stackTop,
}: {
  activePage: number;
  label: string;
  opacity: number;
  pages: number[];
  stackTop: number;
}) {
  return (
    <div
      className="bg-background absolute right-8 left-8 rounded-md border border-border shadow-sm will-change-transform sm:right-14 sm:left-14"
      style={{
        height: STACK_HEIGHT,
        opacity,
        transform: `translate3d(0, ${stackTop}px, 0)`,
      }}
    >
      <div className="border-border bg-background text-muted-foreground sticky top-0 z-10 border-b px-4 py-3 font-mono text-xs">
        {label}
      </div>
      <div className="grid gap-2 p-4">
        {pages.map((page) => (
          <PageSlice key={page} active={page === activePage} page={page} />
        ))}
      </div>
    </div>
  );
}

function TargetGhost({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        "border-foreground/40 bg-background/70 text-muted-foreground pointer-events-none absolute top-24 right-6 z-20 hidden w-36 rounded-md border border-dashed p-3 text-xs transition-opacity duration-300 sm:block",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      nearby pages parsing
    </div>
  );
}

function PageSlice({ active, page }: { active: boolean; page: number }) {
  return (
    <div
      className={cn(
        "border-border bg-card h-[58px] rounded-sm border px-3 py-2 transition-colors",
        active && "border-foreground bg-background",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-muted-foreground font-mono text-xs">
          page {page}
        </span>
        <span className="bg-border h-1.5 w-10 rounded-full" />
      </div>
      <div className="grid gap-1.5">
        <span className="bg-border h-px w-11/12" />
        <span className="bg-border h-px w-7/12" />
        <span className="bg-border h-px w-9/12" />
      </div>
    </div>
  );
}

function StepStrip({ phase }: { phase: Phase }) {
  const steps: Array<{ id: Phase; label: string }> = [
    { id: "synced", label: "native" },
    { id: "scrolling", label: "scrolling" },
    { id: "pinned", label: "pinned" },
    { id: "catching", label: "replace" },
    { id: "caught", label: "caught up" },
  ];

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-5">
      {steps.map((step) => (
        <div
          key={step.id}
          className={cn(
            "border-border text-muted-foreground rounded-md border px-3 py-2 text-center text-xs transition-colors",
            phase === step.id && "border-foreground text-foreground",
          )}
        >
          {step.label}
        </div>
      ))}
    </div>
  );
}

function phaseForProgress(progress: number): Phase {
  if (progress >= 0.92) return "caught";
  if (progress >= 0.74) return "catching";
  if (progress >= 0.58) return "pinned";
  if (progress >= 0.08) return "scrolling";
  return "synced";
}

function phaseLabel(phase: Phase) {
  if (phase === "synced") return "native scroll";
  if (phase === "scrolling") return "native scrolling";
  if (phase === "pinned") return "old range pinned";
  if (phase === "catching") return "parser replacing range";
  return "nearby range rendered";
}

function stackTopForProgress(progress: number) {
  if (progress < 0.58) {
    return lerp(START_TOP, PINNED_TOP, easeOutCubic(progress / 0.58));
  }

  if (progress < 0.74) return PINNED_TOP;

  return lerp(
    PINNED_TOP,
    RELEASED_TOP,
    easeOutCubic(clamp((progress - 0.74) / 0.26, 0, 1)),
  );
}

function opacityForNewRange(progress: number) {
  return easeInOutCubic(clamp((progress - 0.74) / 0.18, 0, 1));
}

function easeOutCubic(value: number) {
  const inverse = 1 - clamp(value, 0, 1);
  return 1 - inverse * inverse * inverse;
}

function easeInOutCubic(value: number) {
  const clamped = clamp(value, 0, 1);
  if (clamped < 0.5) return 4 * clamped * clamped * clamped;
  return 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
