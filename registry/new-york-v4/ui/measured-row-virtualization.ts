"use client";

import * as React from "react";

import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";

const DEFAULT_INITIAL_VIEWPORT_HEIGHT = 600;
const DEFAULT_OVERSCAN = 6;
const MAX_VIRTUAL_ITEMS = 1_000;

export interface MeasuredRowVirtualItem {
  index: number;
  key: React.Key;
  start: number;
  size: number;
  end: number;
}

export interface MeasuredRowOffsets {
  starts: number[];
  totalSize: number;
}

export interface MeasuredRowScrollTarget {
  align?: "start" | "center" | "end";
  behavior?: ScrollBehavior;
}

export function buildMeasuredRowOffsets({
  rowSizes,
  paddingStart = 0,
  paddingEnd = 0,
}: {
  rowSizes: readonly number[];
  paddingStart?: number;
  paddingEnd?: number;
}): MeasuredRowOffsets {
  const starts: number[] = [];
  let offset = safeSize(paddingStart);

  for (const rowSize of rowSizes) {
    starts.push(offset);
    offset += safeSize(rowSize);
  }

  return {
    starts,
    totalSize: offset + safeSize(paddingEnd),
  };
}

export function getMeasuredRowVirtualItems({
  getItemKey,
  maxItems = MAX_VIRTUAL_ITEMS,
  offsets,
  overscan = DEFAULT_OVERSCAN,
  rowSizes,
  scrollTop,
  viewportHeight,
}: {
  getItemKey?: (index: number) => React.Key;
  maxItems?: number;
  offsets: MeasuredRowOffsets;
  overscan?: number;
  rowSizes: readonly number[];
  scrollTop: number;
  viewportHeight: number;
}): MeasuredRowVirtualItem[] {
  const count = rowSizes.length;
  if (count === 0) return [];

  const safeScrollTop = safeOffset(scrollTop);
  const safeViewportHeight = Math.max(1, safeSize(viewportHeight));
  const visibleStartIndex = findFirstRowEndingAfter({
    offset: safeScrollTop,
    rowSizes,
    starts: offsets.starts,
  });
  const visibleEndExclusive = findFirstRowStartingAtOrAfter({
    offset: safeScrollTop + safeViewportHeight,
    starts: offsets.starts,
  });
  const start = Math.max(0, visibleStartIndex - safeCount(overscan));
  const end = Math.min(
    count,
    Math.max(visibleStartIndex + 1, visibleEndExclusive) + safeCount(overscan),
  );
  const [cappedStart, cappedEnd] = capMeasuredRowRange({
    count,
    end,
    maxItems,
    start,
    visibleEnd: Math.min(
      count,
      Math.max(visibleStartIndex + 1, visibleEndExclusive),
    ),
    visibleStart: visibleStartIndex,
  });

  return Array.from({ length: cappedEnd - cappedStart }, (_, offset) => {
    const index = cappedStart + offset;
    const rowStart = offsets.starts[index] ?? 0;
    const size = safeSize(rowSizes[index]);
    return {
      index,
      key: getItemKey?.(index) ?? index,
      start: rowStart,
      size,
      end: rowStart + size,
    };
  });
}

export function measuredRowScrollTopForIndex({
  align = "center",
  index,
  offsets,
  rowSizes,
  viewportHeight,
}: {
  align?: NonNullable<MeasuredRowScrollTarget["align"]>;
  index: number;
  offsets: MeasuredRowOffsets;
  rowSizes: readonly number[];
  viewportHeight: number;
}) {
  if (!Number.isSafeInteger(index) || index < 0) return 0;

  const rowStart = offsets.starts[index];
  if (rowStart == null) return 0;

  const rowSize = safeSize(rowSizes[index]);
  const safeViewportHeight = safeSize(viewportHeight);

  if (align === "end")
    return Math.max(0, rowStart - safeViewportHeight + rowSize);
  if (align === "center") {
    return Math.max(0, rowStart - safeViewportHeight / 2 + rowSize / 2);
  }
  return Math.max(0, rowStart);
}

export function useMeasuredRowVirtualization({
  count,
  estimateSize,
  getItemKey,
  initialViewportHeight = DEFAULT_INITIAL_VIEWPORT_HEIGHT,
  overscan = DEFAULT_OVERSCAN,
  paddingEnd = 0,
  paddingStart = 0,
  scrollRef,
}: {
  count: number;
  estimateSize: number;
  getItemKey?: (index: number) => React.Key;
  initialViewportHeight?: number;
  overscan?: number;
  paddingEnd?: number;
  paddingStart?: number;
  scrollRef: React.RefObject<HTMLElement | null>;
}) {
  const safeCount = measuredRowCount(count);
  const safeEstimateSize = Math.max(1, safeSize(estimateSize));
  const [version, forceVersion] = React.useReducer(
    (current: number) => current + 1,
    0,
  );
  const [scrollElement, setScrollElement] = React.useState<HTMLElement | null>(
    scrollRef.current,
  );
  const [viewport, setViewport] = React.useState({
    clientHeight: 0,
    scrollTop: 0,
  });
  const measuredSizesRef = React.useRef(new Map<number, number>());
  const rowElementsRef = React.useRef(new Map<number, HTMLElement>());
  const observedIndexesRef = React.useRef(new Map<HTMLElement, number>());
  const rowObserverRef = React.useRef<ResizeObserver | null>(null);
  const offsetsRef = React.useRef<MeasuredRowOffsets>({
    starts: [],
    totalSize: 0,
  });
  const rowSizesRef = React.useRef<number[]>([]);
  const viewportRef = React.useRef(viewport);

  viewportRef.current = viewport;

  const updateMeasuredSize = React.useCallback(
    (index: number, nextSize: number | null) => {
      if (!Number.isSafeInteger(index) || index < 0 || index >= safeCount) {
        return;
      }
      if (nextSize == null) return;

      const safeNextSize = safeSize(nextSize);
      if (safeNextSize <= 0) return;

      const measuredSizes = measuredSizesRef.current;
      const previousSize = measuredSizes.get(index) ?? safeEstimateSize;
      if (previousSize === safeNextSize) return;

      const previousOffsets = offsetsRef.current;
      const previousStart = previousOffsets.starts[index] ?? 0;
      const previousEnd = previousStart + previousSize;
      const delta = safeNextSize - previousSize;
      const currentScrollTop = viewportRef.current.scrollTop;

      measuredSizes.set(index, safeNextSize);

      const currentScrollElement = scrollRef.current;
      if (
        currentScrollElement &&
        previousEnd <= currentScrollTop &&
        delta !== 0
      ) {
        currentScrollElement.scrollTop = Math.max(
          0,
          currentScrollElement.scrollTop + delta,
        );
        setViewport((current) => ({
          ...current,
          scrollTop: safeOffset(currentScrollElement.scrollTop),
        }));
      }

      forceVersion();
    },
    [safeCount, safeEstimateSize, scrollRef],
  );

  const measureRow = React.useCallback(
    (index: number, element: HTMLElement | null) => {
      if (!Number.isSafeInteger(index) || index < 0) return;

      const rowElements = rowElementsRef.current;
      const previousElement = rowElements.get(index);
      if (previousElement && previousElement !== element) {
        rowObserverRef.current?.unobserve(previousElement);
        observedIndexesRef.current.delete(previousElement);
        rowElements.delete(index);
      }

      if (!element) return;

      rowElements.set(index, element);
      observedIndexesRef.current.set(element, index);
      rowObserverRef.current?.observe(element);
      updateMeasuredSize(index, readElementHeight(element));
    },
    [updateMeasuredSize],
  );

  useKeyedLayoutEffect(
    joinEffectKey([scrollRef, scrollRef.current, scrollElement]),
    () => {
      const nextScrollElement = scrollRef.current;
      if (nextScrollElement !== scrollElement) {
        setScrollElement(nextScrollElement);
      }
    },
  );

  useKeyedLayoutEffect(
    joinEffectKey([scrollElement, updateMeasuredSize]),
    () => {
      if (typeof ResizeObserver === "undefined") return;

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const index = observedIndexesRef.current.get(
            entry.target as HTMLElement,
          );
          if (index == null) continue;
          updateMeasuredSize(index, readResizeEntryHeight(entry));
        }
      });

      rowObserverRef.current = observer;
      for (const element of rowElementsRef.current.values()) {
        observer.observe(element);
      }

      return () => {
        observer.disconnect();
        if (rowObserverRef.current === observer) rowObserverRef.current = null;
      };
    },
  );

  useKeyedLayoutEffect(
    joinEffectKey([scrollElement, initialViewportHeight]),
    () => {
      if (!scrollElement) {
        setViewport({ clientHeight: 0, scrollTop: 0 });
        return;
      }

      let frame = 0;
      const readViewport = () => {
        frame = 0;
        const next = {
          clientHeight: safeSize(scrollElement.clientHeight),
          scrollTop: safeOffset(scrollElement.scrollTop),
        };
        setViewport((current) =>
          current.clientHeight === next.clientHeight &&
          current.scrollTop === next.scrollTop
            ? current
            : next,
        );
      };
      const scheduleRead = () => {
        if (frame) return;
        frame = requestFrame(readViewport);
      };

      readViewport();
      scrollElement.addEventListener("scroll", scheduleRead, { passive: true });
      const observer =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(scheduleRead)
          : null;
      observer?.observe(scrollElement);

      return () => {
        if (frame) cancelFrame(frame);
        scrollElement.removeEventListener("scroll", scheduleRead);
        observer?.disconnect();
      };
    },
  );

  const rowSizes = React.useMemo(
    () =>
      Array.from(
        { length: safeCount },
        (_, index) => measuredSizesRef.current.get(index) ?? safeEstimateSize,
      ),
    [safeCount, safeEstimateSize, version],
  );
  const offsets = React.useMemo(
    () =>
      buildMeasuredRowOffsets({
        paddingEnd,
        paddingStart,
        rowSizes,
      }),
    [paddingEnd, paddingStart, rowSizes],
  );
  const viewportHeight =
    viewport.clientHeight ||
    safeSize(initialViewportHeight) ||
    safeEstimateSize;
  const virtualRows = React.useMemo(
    () =>
      getMeasuredRowVirtualItems({
        getItemKey,
        offsets,
        overscan,
        rowSizes,
        scrollTop: viewport.scrollTop,
        viewportHeight,
      }),
    [
      getItemKey,
      offsets,
      overscan,
      rowSizes,
      viewport.scrollTop,
      viewportHeight,
    ],
  );
  const scrollToIndex = React.useCallback(
    (index: number, options?: MeasuredRowScrollTarget) => {
      const currentScrollElement = scrollRef.current;
      if (!currentScrollElement) return;

      const top = measuredRowScrollTopForIndex({
        align: options?.align ?? "center",
        index,
        offsets: offsetsRef.current,
        rowSizes: rowSizesRef.current,
        viewportHeight: currentScrollElement.clientHeight || viewportHeight,
      });
      if (typeof currentScrollElement.scrollTo === "function") {
        currentScrollElement.scrollTo({
          behavior: options?.behavior ?? "smooth",
          top,
        });
      } else {
        currentScrollElement.scrollTop = top;
      }
      setViewport((current) => ({
        ...current,
        scrollTop: safeOffset(currentScrollElement.scrollTop),
      }));
    },
    [scrollRef, viewportHeight],
  );

  offsetsRef.current = offsets;
  rowSizesRef.current = rowSizes;

  return {
    measureRow,
    scrollToIndex,
    totalSize: offsets.totalSize,
    virtualRows,
  };
}

function capMeasuredRowRange({
  count,
  end,
  maxItems,
  start,
  visibleEnd,
  visibleStart,
}: {
  count: number;
  end: number;
  maxItems: number;
  start: number;
  visibleEnd: number;
  visibleStart: number;
}) {
  const safeMaxItems = Math.max(1, safeCount(maxItems));
  if (end - start <= safeMaxItems) return [start, end] as const;

  const visibleCount = Math.min(
    safeMaxItems,
    Math.max(1, visibleEnd - visibleStart),
  );
  const leadingBudget = Math.floor((safeMaxItems - visibleCount) / 2);
  let cappedStart = Math.max(start, visibleStart - leadingBudget);
  let cappedEnd = Math.min(end, cappedStart + safeMaxItems);

  if (cappedEnd - cappedStart < safeMaxItems) {
    cappedStart = Math.max(start, cappedEnd - safeMaxItems);
  }
  if (cappedEnd < visibleEnd) {
    cappedEnd = Math.min(end, visibleEnd);
    cappedStart = Math.max(start, cappedEnd - safeMaxItems);
  }
  cappedEnd = Math.min(count, cappedEnd);

  return [cappedStart, cappedEnd] as const;
}

function findFirstRowEndingAfter({
  offset,
  rowSizes,
  starts,
}: {
  offset: number;
  rowSizes: readonly number[];
  starts: readonly number[];
}) {
  let low = 0;
  let high = rowSizes.length - 1;
  let result = rowSizes.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const end = (starts[middle] ?? 0) + safeSize(rowSizes[middle]);
    if (end > offset) {
      result = middle;
      high = middle - 1;
    } else {
      low = middle + 1;
    }
  }

  return result;
}

function findFirstRowStartingAtOrAfter({
  offset,
  starts,
}: {
  offset: number;
  starts: readonly number[];
}) {
  let low = 0;
  let high = starts.length - 1;
  let result = starts.length;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if ((starts[middle] ?? 0) >= offset) {
      result = middle;
      high = middle - 1;
    } else {
      low = middle + 1;
    }
  }

  return result;
}

function readElementHeight(element: HTMLElement) {
  const rectHeight = element.getBoundingClientRect().height;
  if (Number.isFinite(rectHeight) && rectHeight > 0) return rectHeight;
  return element.offsetHeight;
}

function readResizeEntryHeight(entry: ResizeObserverEntry) {
  const borderBoxSize = entry.borderBoxSize;
  const boxSize = Array.isArray(borderBoxSize)
    ? borderBoxSize[0]
    : borderBoxSize;
  if (boxSize && Number.isFinite(boxSize.blockSize) && boxSize.blockSize > 0) {
    return boxSize.blockSize;
  }
  if (
    Number.isFinite(entry.contentRect.height) &&
    entry.contentRect.height > 0
  ) {
    return entry.contentRect.height;
  }
  return readElementHeight(entry.target as HTMLElement);
}

function requestFrame(callback: FrameRequestCallback) {
  if (typeof window !== "undefined" && window.requestAnimationFrame) {
    return window.requestAnimationFrame(callback);
  }
  return setTimeout(() => callback(performance.now()), 0) as unknown as number;
}

function cancelFrame(frame: number) {
  if (typeof window !== "undefined" && window.cancelAnimationFrame) {
    window.cancelAnimationFrame(frame);
    return;
  }
  clearTimeout(frame);
}

function measuredRowCount(count: number) {
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function safeCount(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function safeOffset(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function safeSize(value: number | undefined) {
  return Number.isFinite(value) && value != null && value > 0 ? value : 0;
}
