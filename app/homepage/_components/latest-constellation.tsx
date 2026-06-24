"use client";

import { useRef } from "react";

import { useMountEffect } from "@/hooks/use-mount-effect";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

const LINK_DIST = 140;
const PULL = 1;
// Density target: ~90 nodes across a ~1280x720 hero, clamped for small cards.
const NODE_AREA = 10_500;
const MIN_NODES = 26;
const MAX_NODES = 96;

function readRgb(el: HTMLElement): string {
  const match = getComputedStyle(el).color.match(/[\d.]+/g);
  if (!match || match.length < 3) return "9, 9, 11";
  return `${match[0]}, ${match[1]}, ${match[2]}`;
}

export function LatestConstellationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useMountEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let rgb = readRgb(canvas);
    let W = 0;
    let H = 0;
    let nodes: Node[] = [];
    const mouse = { x: -9999, y: -9999, active: false };
    let raf = 0;

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      if (W === 0 || H === 0) return;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rgb = readRgb(canvas);
      const count = Math.max(
        MIN_NODES,
        Math.min(MAX_NODES, Math.round((W * H) / NODE_AREA)),
      );
      nodes = [];
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: 1.2 + Math.random() * 1.6,
        });
      }
    };

    const draw = () => {
      const ld2 = LINK_DIST * LINK_DIST;
      ctx.clearRect(0, 0, W, H);
      const { x: mx, y: my, active } = mouse;

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < ld2) {
            const alpha = (1 - d2 / ld2) * 0.5;
            ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        if (active) {
          const dx = a.x - mx;
          const dy = a.y - my;
          const d2 = dx * dx + dy * dy;
          const md2 = LINK_DIST * 1.4 * (LINK_DIST * 1.4);
          if (d2 < md2) {
            const alpha = (1 - d2 / md2) * 0.65;
            ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mx, my);
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, 0.85)`;
        ctx.fill();
      }
      if (active) {
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${rgb})`;
        ctx.fill();
      }
    };

    const tick = () => {
      const { x: mx, y: my, active } = mouse;
      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i];
        p.vx += (Math.random() - 0.5) * 0.06;
        p.vy += (Math.random() - 0.5) * 0.06;
        if (active) {
          const dx = mx - p.x;
          const dy = my - p.y;
          const d2 = dx * dx + dy * dy;
          const R = 220;
          if (d2 < R * R && d2 > 1) {
            const d = Math.sqrt(d2);
            const w = 1 - d / R;
            p.vx += (dx / d) * w * 0.18 * PULL;
            p.vy += (dy / d) * w * 0.18 * PULL;
          }
        }
        p.vx *= 0.95;
        p.vy *= 0.95;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 1.4) {
          p.vx = (p.vx / sp) * 1.4;
          p.vy = (p.vy / sp) * 1.4;
        }
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) {
          p.x = 0;
          p.vx *= -1;
        }
        if (p.x > W) {
          p.x = W;
          p.vx *= -1;
        }
        if (p.y < 0) {
          p.y = 0;
          p.vy *= -1;
        }
        if (p.y > H) {
          p.y = H;
          p.vy *= -1;
        }
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active =
        mouse.x >= 0 && mouse.x <= rect.width && mouse.y >= 0 && mouse.y <= rect.height;
    };
    const onLeave = () => {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    };
    const onTouch = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = touch.clientX - rect.left;
      mouse.y = touch.clientY - rect.top;
      mouse.active = true;
    };

    build();

    if (reduceMotion) {
      draw();
      return;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchend", onLeave);

    const resizeObserver = new ResizeObserver(build);
    resizeObserver.observe(canvas);

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onLeave);
    };
  });

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="text-foreground absolute inset-0 block size-full"
    />
  );
}
