"use client";

import * as React from "react";

export function usePptxViewportWidth() {
  const [viewportWidth, setViewportWidth] = React.useState<number | null>(null);

  const containerRef = React.useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    setViewportWidth(element.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    let observer: ResizeObserver | null = null;
    try {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setViewportWidth((entry.target as HTMLElement).clientWidth);
        }
      });
      observer.observe(element);
      return () => observer?.disconnect();
    } catch {
      observer?.disconnect();
      /* Keep the initial measurement when ResizeObserver is unavailable at runtime. */
    }
  }, []);

  return { containerRef, viewportWidth };
}
