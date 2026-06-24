"use client";

import { useId, useMemo, useState } from "react";

import type { CardTone } from "../types";
import { useMountEffect } from "@/hooks/use-mount-effect";

type ChartPoint = {
  x: number;
  y: number;
};

const CURVE_SERIES: ChartPoint[] = [
  { x: 84, y: 102 },
  { x: 156, y: 94 },
  { x: 230, y: 66 },
  { x: 302, y: 104 },
  { x: 374, y: 119 },
  { x: 446, y: 146 },
  { x: 518, y: 111 },
  { x: 590, y: 47 },
  { x: 626, y: 55 },
];

const TARGET_AVERAGE = 95.2;
const TARGET_CONFIDENCE = 6.92;
const DRAW_DURATION_MS = 2360;
const HOLD_DURATION_MS = 1680;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeInOutCubic(progress: number) {
  if (progress < 0.5) {
    return 4 * progress * progress * progress;
  }
  return 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function getSegmentLengths(points: ChartPoint[]) {
  const lengths: number[] = [];
  let totalLength = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const length = Math.hypot(dx, dy);
    lengths.push(length);
    totalLength += length;
  }
  return { lengths, totalLength };
}

function getPolylinePointsAtProgress(
  points: ChartPoint[],
  segmentLengths: number[],
  totalLength: number,
  progress: number,
) {
  const clampedProgress = clamp(progress, 0, 1);
  if (!points.length || clampedProgress <= 0 || totalLength <= 0) {
    return "";
  }
  if (clampedProgress >= 1) {
    return points.map((point) => `${point.x},${point.y}`).join(" ");
  }

  const targetLength = totalLength * clampedProgress;
  const path: ChartPoint[] = [points[0]];
  let traversed = 0;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];
    const start = points[index];
    const end = points[index + 1];
    const nextDistance = traversed + segmentLength;

    if (targetLength >= nextDistance) {
      path.push(end);
      traversed = nextDistance;
      continue;
    }

    const remaining = targetLength - traversed;
    const ratio = remaining / segmentLength;
    path.push({
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    });
    break;
  }

  return path.map((point) => `${point.x},${point.y}`).join(" ");
}

function EvalsChart({
  curveGradientId,
  curvePoints,
  isCompact,
}: {
  curveGradientId: string;
  curvePoints: string;
  isCompact: boolean;
}) {
  return (
    <svg
      className={
        isCompact ? "h-full w-full sm:hidden" : "hidden h-full w-full sm:block"
      }
      viewBox={isCompact ? "70 28 590 132" : "0 0 700 180"}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient
          id={curveGradientId}
          x1="0"
          y1="149"
          x2="0"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#e8bf49" />
          <stop offset="33%" stopColor="#e8bf49" />
          <stop offset="35%" stopColor="#74cb65" />
          <stop offset="100%" stopColor="#74cb65" />
        </linearGradient>
      </defs>
      <g stroke="#d4d2d0" strokeWidth="1.5">
        <line x1="76" y1="32" x2="652" y2="32" />
        <line x1="76" y1="71" x2="652" y2="71" />
        <line x1="76" y1="110" x2="652" y2="110" />
        <line x1="76" y1="149" x2="652" y2="149" />
      </g>
      <polyline
        fill="none"
        stroke={`url(#${curveGradientId})`}
        strokeWidth={isCompact ? "4.2" : "2.6"}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={curvePoints}
      />
    </svg>
  );
}

export function StudioEvalsArt({
  tone: _tone = "default",
}: {
  tone?: CardTone;
}) {
  const [progress, setProgress] = useState(0);
  const curveGradientId = useId();
  const compactCurveGradientId = useId();

  const curveMetrics = useMemo(() => getSegmentLengths(CURVE_SERIES), []);

  useMountEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      setProgress(1);
      return;
    }

    const loopDuration = DRAW_DURATION_MS + HOLD_DURATION_MS;
    let animationFrame = 0;
    let startAt = 0;

    const animate = (timestamp: number) => {
      if (!startAt) {
        startAt = timestamp;
      }

      const elapsed = (timestamp - startAt) % loopDuration;
      const drawPhase = elapsed / DRAW_DURATION_MS;
      const nextProgress =
        elapsed >= DRAW_DURATION_MS ? 1 : easeInOutCubic(drawPhase);

      setProgress(nextProgress);
      animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  });

  const curvePoints = getPolylinePointsAtProgress(
    CURVE_SERIES,
    curveMetrics.lengths,
    curveMetrics.totalLength,
    progress,
  );
  const averageValue = TARGET_AVERAGE * progress;
  const confidenceValue = TARGET_CONFIDENCE * progress;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-b-sm">
      <div className="absolute inset-0">
        <div className="bg-card absolute top-0 right-1.5 bottom-1 left-1.5 flex min-h-0 flex-col rounded-sm px-1 py-1 sm:top-1 sm:right-3.5 sm:left-3.5 sm:px-2 sm:py-1.5">
          <div className="hidden shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 sm:mb-3 sm:grid">
            <div className="col-start-2 row-start-1 flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5">
                <div className="bg-accent/80 h-2 w-[40px] rounded-sm" />
                <div className="bg-accent/80 h-2 w-[62px] rounded-sm" />
              </div>
              <div className="bg-accent/80 h-2 w-[70px] rounded-sm" />
              <div className="bg-accent/80 h-2 w-[56px] rounded-sm" />
            </div>
            <div className="col-start-1 row-start-1 flex min-w-0 items-end gap-1 self-start pt-0.5">
              <div
                className="text-foreground shrink-0 leading-[0.86] font-semibold tracking-normal"
                style={{ fontSize: "27px" }}
              >
                {averageValue.toFixed(1)}%
              </div>
              <div
                className="text-muted-foreground shrink-0 pb-0.5 leading-none font-normal"
                style={{ fontSize: "14px" }}
              >
                (avg)
              </div>
              <div
                className="bg-success/15 text-success min-w-0 truncate rounded-sm px-1.5 py-1 leading-none font-medium"
                style={{ fontSize: "14px" }}
              >
                {confidenceValue.toFixed(2)}%
              </div>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 p-0 sm:py-1 sm:pr-1.5 sm:pl-8">
            <div className="text-muted-foreground absolute top-1/2 left-0 hidden w-20 -translate-x-[35px] -translate-y-1/2 -rotate-90 text-center text-[10px] leading-none font-medium sm:block">
              Accuracy
            </div>
            <div className="text-muted-foreground absolute inset-y-2 left-8 hidden w-[42px] flex-col justify-between text-[10px] leading-none sm:flex">
              <span>100%</span>
              <span>91%</span>
              <span>85%</span>
              <span>79%</span>
            </div>
            <EvalsChart
              curveGradientId={compactCurveGradientId}
              curvePoints={curvePoints}
              isCompact
            />
            <EvalsChart
              curveGradientId={curveGradientId}
              curvePoints={curvePoints}
              isCompact={false}
            />
          </div>

          {/* <div className="absolute -right-20 top-[58%] -translate-y-1/2 rotate-90 text-[10px] tracking-[0.2em] text-[#9d9994]">
            ( FIG. 010 )
          </div> */}
        </div>
      </div>
    </div>
  );
}
