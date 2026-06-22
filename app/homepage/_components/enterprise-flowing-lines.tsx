"use client";

import { useRef } from "react";

import { useMountEffect } from "@/hooks/use-mount-effect";
import { cn } from "@/lib/utils";

// A quiet, flowing bundle of lines that fans from a tight knot on the left into
// a wide spray sweeping across the canvas. Rendered in subtle monochrome so it
// works as a backdrop on both light and dark themes. Adapted from the
// "Flowing Lines" design.

type Rgb = [number, number, number];

const MAX_LINES = 46;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// Lighter -> slightly darker gray gives the bundle depth while staying neutral
// enough to read over either theme.
const PALETTE: Rgb[] = [
  [152, 152, 152],
  [140, 140, 140],
  [128, 128, 128],
  [120, 120, 120],
  [112, 112, 112],
  [104, 104, 104],
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const colorAt = (t: number) => {
  const x = t * (PALETTE.length - 1);
  const i = Math.min(PALETTE.length - 2, Math.floor(x));
  const f = x - i;
  const a = PALETTE[i];
  const b = PALETTE[i + 1];
  return `rgb(${Math.round(lerp(a[0], b[0], f))},${Math.round(
    lerp(a[1], b[1], f),
  )},${Math.round(lerp(a[2], b[2], f))})`;
};

export function EnterpriseFlowingLines({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useMountEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let base = 0;
    let lines = MAX_LINES;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Proportion the bundle to the shorter side so it stays a balanced
      // horizontal band on tall/narrow (mobile) canvases instead of blowing up
      // with height, and thin the line count on small widths.
      base = Math.min(h, w * 0.82);
      lines = Math.round(clamp(w / 15, 24, MAX_LINES));
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const start = performance.now();

    const render = (now: number) => {
      const t = reduceMotion ? 0 : (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);

      // The bundle pivots around the right edge; lines fan from a tight knot on
      // the left to a wide spray sweeping past both edges.
      const knotY = h * 0.5;
      const knotSpread = base * 0.42;
      const x0 = -w * 0.25;
      const x1 = w * 1.15;

      for (let i = 0; i < lines; i++) {
        const u = i / (lines - 1);
        const phase = t * 0.18 + u * 2.4;
        const spread = u - 0.5;
        const amp =
          base *
          (0.1 + 0.34 * Math.abs(spread) + 0.05 * Math.sin(t * 0.4 + u * 6));
        const freq = 1.1 + u * 1.4;
        const baseTilt = spread * base * 0.34;

        ctx.beginPath();
        const steps = 90;
        for (let s = 0; s <= steps; s++) {
          const p = s / steps;
          const x = x0 + p * (x1 - x0);
          const startY = knotY + spread * knotSpread;
          const env = 0.45 + 0.55 * Math.pow(p, 1.1);
          const y =
            startY +
            baseTilt * env +
            Math.sin(p * Math.PI * freq + phase) * amp * env +
            Math.sin(p * Math.PI * 0.6 + t * 0.25 + u) * base * 0.04 * env;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = colorAt(u);
        ctx.globalAlpha = 0.1 + 0.2 * (1 - Math.abs(spread) * 1.3);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (!reduceMotion) raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  });

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("absolute inset-0 block size-full", className)}
    />
  );
}
