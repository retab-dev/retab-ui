"use client";

import * as React from "react";

export function usePptxViewportWidth({
  enabled = true,
}: {
  enabled?: boolean;
} = {}) {
  const [containerElement, setContainerElement] =
    React.useState<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    if (!enabled || !containerElement) {
      if (!enabled) {
        setViewportWidth((current) => (current == null ? current : null));
      }
      return;
    }

    let frame = 0;
    let latest = resolvePptxMeasuredWidth(containerElement.clientWidth);
    setViewportWidth(latest);
    if (typeof ResizeObserver === "undefined") return;

    let observer: ResizeObserver | null = null;
    try {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          latest = resolvePptxMeasuredWidth(
            (entry.target as HTMLElement).clientWidth,
          );
        }
        if (frame) return;
        frame = -1;
        const requestedFrame = requestAnimationFrame(() => {
          frame = 0;
          setViewportWidth((current) =>
            current === latest ? current : latest,
          );
        });
        if (frame === -1) frame = requestedFrame;
      });
      observer.observe(containerElement);
    } catch {
      if (frame > 0) cancelAnimationFrame(frame);
      observer?.disconnect();
      /* Keep the initial measurement when ResizeObserver is unavailable at runtime. */
      return;
    }

    return () => {
      if (frame > 0) cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [containerElement, enabled]);

  return { containerRef: setContainerElement, viewportWidth };
}

function resolvePptxMeasuredWidth(value: number) {
  return Number.isFinite(value) && value > 0 ? value : null;
}
