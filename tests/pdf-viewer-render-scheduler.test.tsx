// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { usePdfPageRenderScheduler } from "@/registry/new-york-v4/ui/pdf-viewer-render-scheduler";

describe("usePdfPageRenderScheduler", () => {
  afterEach(() => {
    cleanup();
  });

  it("prioritizes visible pages, then warm pages, then preload pages", () => {
    const { result } = renderHook(() =>
      usePdfPageRenderScheduler({
        pageNumbers: [10],
        warmPageNumbers: [9, 11],
        lowPriorityPageNumbers: [8, 12],
        scale: 1,
        rotation: 0,
        devicePixelRatio: 1,
        resetKey: "doc",
        maxRunning: 2,
        maxLowPriorityRunning: 1,
      }),
    );

    expect(result.current.activePageNumbers).toEqual([9, 10]);

    act(() => {
      result.current.onPageRenderTiming({
        pageNumber: 10,
        scale: 1,
        rotation: 0,
        devicePixelRatio: 1,
        status: "rendered",
        durationMs: 0,
      });
    });

    expect(result.current.activePageNumbers).toEqual([9, 10, 11]);

    act(() => {
      result.current.onPageRenderTiming({
        pageNumber: 9,
        scale: 1,
        rotation: 0,
        devicePixelRatio: 1,
        status: "rendered",
        durationMs: 0,
      });
      result.current.onPageRenderTiming({
        pageNumber: 11,
        scale: 1,
        rotation: 0,
        devicePixelRatio: 1,
        status: "rendered",
        durationMs: 0,
      });
    });

    expect(result.current.activePageNumbers).toEqual([8, 9, 10, 11]);
  });

  it("keeps rendered warm pages active while visible pages consume render slots", () => {
    const { result } = renderHook(() =>
      usePdfPageRenderScheduler({
        pageNumbers: [5],
        warmPageNumbers: [4],
        lowPriorityPageNumbers: [3],
        scale: 1,
        rotation: 0,
        devicePixelRatio: 1,
        resetKey: "doc",
        maxRunning: 1,
        maxLowPriorityRunning: 1,
      }),
    );

    act(() => {
      result.current.onPageRenderTiming({
        pageNumber: 4,
        scale: 1,
        rotation: 0,
        devicePixelRatio: 1,
        status: "rendered",
        durationMs: 0,
      });
    });

    expect(result.current.activePageNumbers).toEqual([4, 5]);
  });

  it("keeps stale rendered pages mounted across scale changes", () => {
    const { result, rerender } = renderHook(
      ({
        pageNumbers,
        scale,
      }: {
        pageNumbers: readonly number[];
        scale: number;
      }) =>
        usePdfPageRenderScheduler({
          pageNumbers,
          scale,
          rotation: 0,
          devicePixelRatio: 1,
          resetKey: "doc",
          maxRunning: 4,
          maxLowPriorityRunning: 0,
        }),
      {
        initialProps: {
          pageNumbers: [5],
          scale: 1,
        },
      },
    );

    act(() => {
      result.current.onPageRenderTiming({
        pageNumber: 5,
        scale: 1,
        rotation: 0,
        devicePixelRatio: 1,
        status: "rendered",
        durationMs: 0,
      });
    });

    rerender({
      pageNumbers: [1, 2, 3, 4, 5],
      scale: 2,
    });

    expect(result.current.activePageNumbers).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps rendered pages active but blocks pending pages while paused", () => {
    const { result, rerender } = renderHook(
      ({ isPaused }: { isPaused: boolean }) =>
        usePdfPageRenderScheduler({
          isPaused,
          pageNumbers: [5, 6],
          warmPageNumbers: [4],
          lowPriorityPageNumbers: [3],
          scale: 1,
          rotation: 0,
          devicePixelRatio: 1,
          resetKey: "doc",
          maxRunning: 2,
          maxLowPriorityRunning: 1,
        }),
      {
        initialProps: { isPaused: false },
      },
    );

    act(() => {
      result.current.onPageRenderTiming({
        pageNumber: 5,
        scale: 1,
        rotation: 0,
        devicePixelRatio: 1,
        status: "rendered",
        durationMs: 0,
      });
    });

    rerender({ isPaused: true });

    expect(result.current.activePageNumbers).toEqual([5]);
    expect(result.current.isRenderQueueIdle).toBe(false);

    rerender({ isPaused: false });

    expect(result.current.activePageNumbers).toEqual([4, 5, 6]);
  });
});
