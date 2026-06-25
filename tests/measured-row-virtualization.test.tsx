// @vitest-environment jsdom

import * as React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as PublicMeasuredRowVirtualization from "@/components/ui/measured-row-virtualization";
import {
  buildMeasuredRowOffsets,
  getMeasuredRowVirtualItems,
  measuredRowScrollTopForIndex,
  useMeasuredRowVirtualization,
} from "@/registry/new-york-v4/ui/measured-row-virtualization";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  StubResizeObserver.instances = [];
});

describe("measured row virtualization", () => {
  it("keeps component-facing re-exports wired to the registry implementation", () => {
    expect(PublicMeasuredRowVirtualization.buildMeasuredRowOffsets).toBe(
      buildMeasuredRowOffsets,
    );
    expect(PublicMeasuredRowVirtualization.getMeasuredRowVirtualItems).toBe(
      getMeasuredRowVirtualItems,
    );
    expect(PublicMeasuredRowVirtualization.measuredRowScrollTopForIndex).toBe(
      measuredRowScrollTopForIndex,
    );
    expect(PublicMeasuredRowVirtualization.useMeasuredRowVirtualization).toBe(
      useMeasuredRowVirtualization,
    );
  });

  it("builds offsets with top and bottom padding", () => {
    expect(
      buildMeasuredRowOffsets({
        rowSizes: [20, 40, 30],
        paddingStart: 8,
        paddingEnd: 12,
      }),
    ).toEqual({
      starts: [8, 28, 68],
      totalSize: 110,
    });
  });

  it("sanitizes malformed sizes while building offsets", () => {
    expect(
      buildMeasuredRowOffsets({
        rowSizes: [20, -10, Number.NaN, Number.POSITIVE_INFINITY, 30],
        paddingStart: -8,
        paddingEnd: Number.NaN,
      }),
    ).toEqual({
      starts: [0, 20, 20, 20, 20],
      totalSize: 50,
    });
  });

  it("returns a variable-height window with overscan and stable keys", () => {
    const rowSizes = [20, 40, 30, 50];
    const offsets = buildMeasuredRowOffsets({
      rowSizes,
      paddingStart: 8,
    });

    expect(
      getMeasuredRowVirtualItems({
        getItemKey: (index) => `row-${index}`,
        offsets,
        overscan: 1,
        rowSizes,
        scrollTop: 32,
        viewportHeight: 50,
      }).map(({ index, key, start, size, end }) => ({
        index,
        key,
        start,
        size,
        end,
      })),
    ).toEqual([
      { index: 0, key: "row-0", start: 8, size: 20, end: 28 },
      { index: 1, key: "row-1", start: 28, size: 40, end: 68 },
      { index: 2, key: "row-2", start: 68, size: 30, end: 98 },
      { index: 3, key: "row-3", start: 98, size: 50, end: 148 },
    ]);
  });

  it("caps hostile overscan without dropping the visible rows", () => {
    const rowSizes = Array.from({ length: 10_000 }, () => 1);
    const offsets = buildMeasuredRowOffsets({ rowSizes });
    const rows = getMeasuredRowVirtualItems({
      maxItems: 50,
      offsets,
      overscan: 10_000,
      rowSizes,
      scrollTop: 5_000,
      viewportHeight: 10,
    });

    expect(rows).toHaveLength(50);
    expect(rows[0]!.index).toBeLessThanOrEqual(5_000);
    expect(rows.at(-1)!.index).toBeGreaterThanOrEqual(5_009);
  });

  it("returns a bounded tail window when scrollTop is beyond the final row", () => {
    const rowSizes = [10, 10, 10];
    const offsets = buildMeasuredRowOffsets({ rowSizes });

    expect(
      getMeasuredRowVirtualItems({
        offsets,
        overscan: 1,
        rowSizes,
        scrollTop: 10_000,
        viewportHeight: 20,
      }).map((row) => row.index),
    ).toEqual([1, 2]);
  });

  it("computes aligned scroll offsets for measured rows", () => {
    const rowSizes = [20, 40, 30];
    const offsets = buildMeasuredRowOffsets({
      rowSizes,
      paddingStart: 8,
    });

    expect(
      measuredRowScrollTopForIndex({
        align: "start",
        index: 1,
        offsets,
        rowSizes,
        viewportHeight: 100,
      }),
    ).toBe(28);
    expect(
      measuredRowScrollTopForIndex({
        align: "center",
        index: 2,
        offsets,
        rowSizes,
        viewportHeight: 50,
      }),
    ).toBe(58);
    expect(
      measuredRowScrollTopForIndex({
        align: "end",
        index: 2,
        offsets,
        rowSizes,
        viewportHeight: 50,
      }),
    ).toBe(48);
    expect(
      measuredRowScrollTopForIndex({
        align: "start",
        index: 99,
        offsets,
        rowSizes,
        viewportHeight: 50,
      }),
    ).toBe(0);
  });

  it("renders from the initial viewport before the scroll element mounts", () => {
    const scrollRef = {
      current: null,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useMeasuredRowVirtualization({
        count: 10,
        estimateSize: 10,
        initialViewportHeight: 30,
        overscan: 0,
        scrollRef,
      }),
    );

    expect(result.current.totalSize).toBe(100);
    expect(result.current.virtualRows.map((row) => row.index)).toEqual([
      0, 1, 2,
    ]);
  });

  it("updates the window from scroll events", () => {
    installImmediateAnimationFrame();
    vi.stubGlobal("ResizeObserver", StubResizeObserver);

    const scroller = document.createElement("div");
    defineElementMetric(scroller, "clientHeight", 30);
    defineElementMetric(scroller, "scrollTop", 0);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useMeasuredRowVirtualization({
        count: 10,
        estimateSize: 10,
        overscan: 0,
        scrollRef,
      }),
    );

    expect(result.current.virtualRows.map((row) => row.index)).toEqual([
      0, 1, 2,
    ]);

    scroller.scrollTop = 40;
    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.virtualRows.map((row) => row.index)).toEqual([
      4, 5, 6,
    ]);
  });

  it("measures rows, updates total size, and preserves anchored scroll", () => {
    installImmediateAnimationFrame();
    vi.stubGlobal("ResizeObserver", StubResizeObserver);

    const scroller = document.createElement("div");
    defineElementMetric(scroller, "clientHeight", 60);
    defineElementMetric(scroller, "scrollTop", 45);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useMeasuredRowVirtualization({
        count: 3,
        estimateSize: 20,
        initialViewportHeight: 60,
        overscan: 0,
        scrollRef,
      }),
    );

    expect(result.current.totalSize).toBe(60);

    const row = measuredElement(40);
    act(() => {
      result.current.measureRow(0, row);
    });

    expect(result.current.totalSize).toBe(80);
    expect(scroller.scrollTop).toBe(65);
  });

  it("does not move the scroll anchor when the measured row intersects the viewport", () => {
    installImmediateAnimationFrame();
    vi.stubGlobal("ResizeObserver", StubResizeObserver);

    const scroller = document.createElement("div");
    defineElementMetric(scroller, "clientHeight", 60);
    defineElementMetric(scroller, "scrollTop", 10);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useMeasuredRowVirtualization({
        count: 3,
        estimateSize: 20,
        initialViewportHeight: 60,
        overscan: 0,
        scrollRef,
      }),
    );

    act(() => {
      result.current.measureRow(0, measuredElement(40));
    });

    expect(result.current.totalSize).toBe(80);
    expect(scroller.scrollTop).toBe(10);
  });

  it("updates measured sizes from ResizeObserver border boxes", () => {
    installImmediateAnimationFrame();
    vi.stubGlobal("ResizeObserver", StubResizeObserver);

    const scroller = document.createElement("div");
    defineElementMetric(scroller, "clientHeight", 60);
    defineElementMetric(scroller, "scrollTop", 0);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useMeasuredRowVirtualization({
        count: 2,
        estimateSize: 20,
        scrollRef,
      }),
    );
    const row = measuredElement(20);

    act(() => {
      result.current.measureRow(0, row);
    });
    act(() => {
      StubResizeObserver.instances[0]!.emit({
        borderBoxSize: [{ blockSize: 45 }],
        contentRect: { height: 30 },
        target: row,
      });
    });

    expect(result.current.totalSize).toBe(65);
  });

  it("tracks replaced row elements and disconnects observers on unmount", () => {
    installImmediateAnimationFrame();
    vi.stubGlobal("ResizeObserver", StubResizeObserver);

    const scroller = document.createElement("div");
    defineElementMetric(scroller, "clientHeight", 60);
    defineElementMetric(scroller, "scrollTop", 0);
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result, unmount } = renderHook(() =>
      useMeasuredRowVirtualization({
        count: 2,
        estimateSize: 20,
        scrollRef,
      }),
    );
    const observer = StubResizeObserver.instances[0]!;
    const firstRow = measuredElement(20);
    const nextRow = measuredElement(30);

    act(() => {
      result.current.measureRow(0, firstRow);
    });
    act(() => {
      result.current.measureRow(0, nextRow);
    });

    expect(observer.observe).toHaveBeenCalledWith(firstRow);
    expect(observer.unobserve).toHaveBeenCalledWith(firstRow);
    expect(observer.observe).toHaveBeenCalledWith(nextRow);

    unmount();

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  it("removes scroll listeners and cancels queued viewport reads on unmount", () => {
    let nextFrame = 0;
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => {
        nextFrame += 1;
        return nextFrame;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

    const scroller = document.createElement("div");
    defineElementMetric(scroller, "clientHeight", 60);
    defineElementMetric(scroller, "scrollTop", 0);
    const removeEventListener = vi.spyOn(scroller, "removeEventListener");
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { unmount } = renderHook(() =>
      useMeasuredRowVirtualization({
        count: 2,
        estimateSize: 20,
        scrollRef,
      }),
    );

    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(removeEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
  });

  it("uses DOM scrollTo when available", () => {
    installImmediateAnimationFrame();
    vi.stubGlobal("ResizeObserver", StubResizeObserver);

    const scroller = document.createElement("div");
    defineElementMetric(scroller, "clientHeight", 50);
    defineElementMetric(scroller, "scrollTop", 0);
    const scrollTo = vi.fn();
    Object.defineProperty(scroller, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useMeasuredRowVirtualization({
        count: 4,
        estimateSize: 20,
        scrollRef,
      }),
    );

    act(() => {
      result.current.scrollToIndex(2, { align: "end", behavior: "auto" });
    });

    expect(scrollTo).toHaveBeenCalledWith({
      behavior: "auto",
      top: 10,
    });
  });

  it("scrolls to measured row indexes without depending on DOM scrollTo support", () => {
    installImmediateAnimationFrame();
    vi.stubGlobal("ResizeObserver", StubResizeObserver);

    const scroller = document.createElement("div");
    defineElementMetric(scroller, "clientHeight", 50);
    defineElementMetric(scroller, "scrollTop", 0);
    Object.defineProperty(scroller, "scrollTo", {
      configurable: true,
      value: undefined,
    });
    const scrollRef = {
      current: scroller,
    } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() =>
      useMeasuredRowVirtualization({
        count: 4,
        estimateSize: 20,
        scrollRef,
      }),
    );

    act(() => {
      result.current.scrollToIndex(2, { align: "start", behavior: "auto" });
    });

    expect(scroller.scrollTop).toBe(40);
  });
});

function installImmediateAnimationFrame() {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(performance.now());
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
}

function measuredElement(height: number) {
  const element = document.createElement("div");
  element.getBoundingClientRect = () =>
    ({
      bottom: height,
      height,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) satisfies DOMRect;
  return element;
}

function defineElementMetric(
  element: HTMLElement,
  key: "clientHeight" | "scrollTop",
  value: number,
) {
  Object.defineProperty(element, key, {
    configurable: true,
    value,
    writable: true,
  });
}

class StubResizeObserver {
  static instances: StubResizeObserver[] = [];

  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();

  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    StubResizeObserver.instances.push(this);
  }

  emit({
    borderBoxSize,
    contentRect,
    target,
  }: {
    borderBoxSize?: { blockSize: number }[];
    contentRect?: { height: number };
    target: Element;
  }) {
    this.callback(
      [
        {
          borderBoxSize,
          contentRect: contentRect ?? { height: 0 },
          target,
        } as unknown as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }
}
