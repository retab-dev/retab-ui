"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface FixedRowWindow {
  /** First row index to mount (inclusive). */
  start: number;
  /** One past the last row index to mount (exclusive). */
  end: number;
  /** Pixel height of the full list — used as the scroll spacer height. */
  totalHeight: number;
  /** True once the viewport has been measured at least once. */
  ready: boolean;
}

/**
 * Minimal fixed-height row virtualizer.
 *
 * Every row is exactly `rowHeight` px tall, so the visible window is pure
 * arithmetic — `floor(scrollTop / rowHeight)` for the first row, plus however
 * many fit in the viewport. No per-row measurement, no observers per item, no
 * dependency: a `scroll` listener (rAF-throttled) and one `ResizeObserver` on
 * the scroll element are all it takes.
 *
 * Row `i` is positioned at `top = i * rowHeight` inside a spacer of
 * `totalHeight`. Set the spacer's height to `totalHeight` and absolutely
 * position each mounted row at its `top`.
 */
export function useFixedRowWindow({
  scrollRef,
  rowCount,
  rowHeight,
  overscan = 30,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  rowCount: number;
  rowHeight: number;
  overscan?: number;
}): FixedRowWindow {
  const [range, setRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);
  const rafRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollTop = el.scrollTop;
    const viewport = el.clientHeight;

    const first = Math.floor(scrollTop / rowHeight);
    const visible = Math.ceil(viewport / rowHeight);
    const start = Math.max(0, first - overscan);
    const end = Math.min(rowCount, first + visible + overscan);

    if (!readyRef.current) {
      readyRef.current = true;
      setReady(true);
    }
    setRange((prev) =>
      prev.start === start && prev.end === end ? prev : { start, end },
    );
  }, [scrollRef, rowCount, rowHeight, overscan]);

  // Establish the initial window before the browser paints, and re-measure
  // whenever the row geometry or count changes.
  useLayoutEffect(() => {
    measure();
  }, [measure]);

  // Track scroll and viewport resize. The scroll handler is rAF-throttled so we
  // recompute at most once per frame; `measure` itself bails when the window is
  // unchanged, so most scroll frames cost a comparison and nothing more.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        measure();
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollRef, measure]);

  return {
    start: range.start,
    end: range.end,
    totalHeight: rowCount * rowHeight,
    ready,
  };
}
