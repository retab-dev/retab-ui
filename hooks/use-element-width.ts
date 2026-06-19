"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

export function useElementWidth<T extends HTMLElement = HTMLDivElement>(): [
  React.RefCallback<T>,
  number | null,
] {
  const cleanupRef = React.useRef<(() => void) | null>(null);
  const [width, setWidth] = React.useState<number | null>(null);

  const ref = React.useCallback((element: T | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;

    if (!element) return;
    const target = element;

    let frame = 0;
    let timeout = 0;
    let isReadScheduled = false;
    let lastReadWidth: number | null = null;

    function scheduleRead() {
      if (isReadScheduled) return;

      isReadScheduled = true;
      const run = () => {
        if (!isReadScheduled) return;
        isReadScheduled = false;
        if (frame > 0 && typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(frame);
        }
        if (timeout) window.clearTimeout(timeout);
        frame = 0;
        timeout = 0;
        readStableWidth();
      };

      timeout = window.setTimeout(run, 50);
      if (typeof requestAnimationFrame !== "function") return;

      frame = -1;
      const requestedFrame = requestAnimationFrame(run);
      if (frame === -1) frame = requestedFrame;
    }

    function readStableWidth() {
      const nextWidth = target.clientWidth;
      if (lastReadWidth === nextWidth) {
        setWidth(nextWidth);
        return;
      }
      lastReadWidth = nextWidth;
      scheduleRead();
    }

    scheduleRead();
    const cleanupScheduledRead = () => {
      if (frame > 0 && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frame);
      }
      if (timeout) window.clearTimeout(timeout);
    };
    if (typeof ResizeObserver !== "function") {
      cleanupRef.current = cleanupScheduledRead;
      return;
    }

    const observer = new ResizeObserver(() => {
      lastReadWidth = null;
      scheduleRead();
    });

    observer.observe(element);
    cleanupRef.current = () => {
      cleanupScheduledRead();
      observer.disconnect();
    };
  }, []);

  React.useEffect(() => () => cleanupRef.current?.(), []);

  return [ref, width];
}
