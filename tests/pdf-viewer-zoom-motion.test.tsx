import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPdfPageLayout } from "@/registry/new-york-v4/ui/pdf-viewer-layout";
import {
  capturePdfZoomTransaction,
  clearPdfZoomMotionFlightRecords,
  createPdfZoomMotionController,
  getPdfZoomMotionFlightRecords,
  notePdfZoomMotionPageRender,
  playPdfZoomMotion,
  resolvePdfZoomScrollTarget,
} from "@/registry/new-york-v4/ui/pdf-viewer-zoom-motion";

function makeLayout(scale: number) {
  return createPdfPageLayout({
    pageCount: 5,
    defaultPageSize: { width: 400, height: 800 },
    pageSizeByNumber: new Map(),
    scale,
    rotation: 0,
  });
}

function makeRect(rect: Partial<DOMRect>): DOMRect {
  return {
    x: rect.left ?? 0,
    y: rect.top ?? 0,
    left: rect.left ?? 0,
    top: rect.top ?? 0,
    width: rect.width ?? 0,
    height: rect.height ?? 0,
    right: (rect.left ?? 0) + (rect.width ?? 0),
    bottom: (rect.top ?? 0) + (rect.height ?? 0),
    toJSON: () => ({}),
  } as DOMRect;
}

function makeViewport({
  rangeRect,
  clipRect,
  scrollLeft = 0,
  clientWidth = 800,
  clientHeight = 600,
}: {
  rangeRect?: DOMRect | null;
  clipRect?: DOMRect | null;
  scrollLeft?: number;
  clientWidth?: number;
  clientHeight?: number;
}) {
  const clipElement = clipRect
    ? {
        style: {} as Record<string, string>,
        getBoundingClientRect: () => clipRect,
      }
    : null;
  const rangeElement = rangeRect
    ? { getBoundingClientRect: () => rangeRect }
    : null;
  const viewport = {
    clientWidth,
    clientHeight,
    scrollLeft,
    scrollTop: 0,
    getBoundingClientRect: () =>
      makeRect({ left: 0, top: 0, width: clientWidth, height: clientHeight }),
    querySelector: (selector: string) => {
      if (selector.includes("pdf-viewer-scroll-range")) return rangeElement;
      if (selector.includes("pdf-viewer-visual-clip")) return clipElement;
      return null;
    },
  };
  return {
    clipElement,
    viewport: viewport as unknown as HTMLDivElement,
  };
}

beforeEach(() => {
  clearPdfZoomMotionFlightRecords();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("pdf zoom motion anchor", () => {
  it("captures the viewport-center content point on both axes", () => {
    const { viewport } = makeViewport({
      rangeRect: makeRect({ left: 100, top: -1708, width: 400, height: 4128 }),
    });

    const transaction = capturePdfZoomTransaction({
      layout: makeLayout(1),
      scrollTop: 1708,
      viewportElement: viewport,
    });

    // Center marker at 1708 + 300 lands inside page 3 (offset 1648, height
    // 800) at 45% of the page.
    expect(transaction).not.toBeNull();
    expect(transaction!.pageNumber).toBe(3);
    expect(transaction!.yPercent).toBeCloseTo(0.45, 5);
    // Viewport center x = 400; stage spans [100, 500] → 75% across.
    expect(transaction!.inlineFraction).toBeCloseTo(0.75, 5);
  });

  it("restores the captured content point back under the viewport center", () => {
    const capturedAt = makeViewport({
      rangeRect: makeRect({ left: 100, top: -1708, width: 400, height: 4128 }),
    });
    const transaction = capturePdfZoomTransaction({
      layout: makeLayout(1),
      scrollTop: 1708,
      viewportElement: capturedAt.viewport,
    })!;

    // After the 1.2x commit (before restore): stage is 480 wide at left 60.
    const committed = makeViewport({
      rangeRect: makeRect({ left: 60, top: -2000, width: 480, height: 4950 }),
      scrollLeft: 0,
    });
    const target = resolvePdfZoomScrollTarget({
      layout: makeLayout(1.2),
      transaction,
      viewportElement: committed.viewport,
    });

    expect(target).not.toBeNull();
    // Page 3 at 1.2x: offset 1974, height 960 → 1974 + 432 - 300.
    expect(target!.top).toBeCloseTo(2106, 5);
    // Anchored point x = 60 + 0.75 * 480 = 420; center is 400 → scroll +20.
    expect(target!.left).toBeCloseTo(20, 5);
  });

  it("omits the inline axis when the stage cannot be measured", () => {
    const { viewport } = makeViewport({ rangeRect: null });

    const transaction = capturePdfZoomTransaction({
      layout: makeLayout(1),
      scrollTop: 1708,
      viewportElement: viewport,
    });

    expect(transaction).not.toBeNull();
    expect(transaction!.inlineFraction).toBeNull();

    const target = resolvePdfZoomScrollTarget({
      layout: makeLayout(1.2),
      transaction: transaction!,
      viewportElement: viewport,
    });
    expect(target).not.toBeNull();
    expect(target!.left).toBeUndefined();
  });

  it("clamps the block restore to the scrollable range", () => {
    const { viewport } = makeViewport({
      rangeRect: makeRect({ left: 100, top: 0, width: 400, height: 4128 }),
    });
    const transaction = capturePdfZoomTransaction({
      layout: makeLayout(1),
      scrollTop: 0,
      viewportElement: viewport,
    })!;

    const target = resolvePdfZoomScrollTarget({
      // Zooming OUT from the top: the unclamped center target would be
      // negative; the restore pins to the document start instead.
      layout: makeLayout(0.5),
      transaction,
      viewportElement: viewport,
    });

    expect(target).not.toBeNull();
    expect(target!.top).toBe(0);
  });
});

const PLAYER_PREVIOUS_RECT = () =>
  makeRect({ left: 116, top: -1708, width: 400, height: 4128 });
const PLAYER_CURRENT_RECT = () =>
  makeRect({ left: 76, top: -2106, width: 480, height: 4953.6 });

function makePlayerTransaction() {
  return {
    capturedAt: 990,
    pageNumber: 3,
    yPercent: 0.45,
    inlineFraction: 0.75,
    previousVisualRect: PLAYER_PREVIOUS_RECT(),
  };
}

function stubFrameClock() {
  const frameCallbacks: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frameCallbacks.push(callback);
    return frameCallbacks.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  return {
    tick: (frameTime: number) => {
      for (const callback of frameCallbacks.splice(0)) callback(frameTime);
    },
  };
}

describe("pdf zoom motion player", () => {
  it("relaxes on a frame-anchored clock and cleans up at settle", () => {
    vi.useFakeTimers();
    const clock = stubFrameClock();
    const currentRect = PLAYER_CURRENT_RECT();
    const { clipElement, viewport } = makeViewport({
      rangeRect: currentRect,
      clipRect: currentRect,
    });

    const cancel = playPdfZoomMotion({
      transaction: makePlayerTransaction(),
      viewportElement: viewport,
    });

    expect(cancel).not.toBeNull();
    const style = clipElement!.style;
    // First frame is written synchronously inside the commit: full counter
    // transform, anchor point fixed.
    expect(style.transform).toContain("scale(0.833333");
    expect(style.willChange).toBe("transform");
    expect(style.transformOrigin).not.toBe("");

    // The clock anchors at the first tick's frame time — progress stays 0.
    clock.tick(1000);
    expect(style.transform).toContain("scale(0.833333");

    // Mid-flight: eased progress moves the scale strictly toward identity.
    clock.tick(1100);
    const midScale = Number(style.transform.match(/scale\(([\d.]+)/)?.[1]);
    expect(midScale).toBeGreaterThan(0.834);
    expect(midScale).toBeLessThan(1);

    // At the duration boundary: settle clears every inline style.
    clock.tick(1200);
    expect(style.transform).toBe("");
    expect(style.transformOrigin).toBe("");
    expect(style.willChange).toBe("");

    const record = getPdfZoomMotionFlightRecords().at(-1)!;
    expect(record.status).toBe("played");
    expect(record.interruption).toBe("none");
    expect(record.settledClean).toBe(true);
    expect(record.tickCount).toBe(3);
    expect(record.startLatencyMs).toBe(10);
    expect(record.maxTickGapMs).toBe(100);
    expect(record.scrollDriftMaxPx).toBe(0);
    expect(record.ticks.map((tick) => tick.progress)).toEqual(
      record.ticks.map((tick) => tick.progress).slice().sort((a, b) => a - b),
    );
    vi.runAllTimers();
  });

  it("skips and records the reason when the axes stopped scaling together", () => {
    stubFrameClock();
    // A rebased physical scroll: height ratio (1.0) diverges from the width
    // ratio (0.833) — the whole-surface FLIP would warp, so no motion plays.
    const previousRect = makeRect({
      left: 116,
      top: -1708,
      width: 400,
      height: 4000,
    });
    const currentRect = makeRect({
      left: 76,
      top: -2106,
      width: 480,
      height: 4000,
    });
    const { clipElement, viewport } = makeViewport({
      rangeRect: currentRect,
      clipRect: currentRect,
    });

    const cancel = playPdfZoomMotion({
      transaction: { ...makePlayerTransaction(), previousVisualRect: previousRect },
      viewportElement: viewport,
    });

    expect(cancel).toBeNull();
    expect(clipElement!.style.transform ?? "").toBe("");
    const record = getPdfZoomMotionFlightRecords().at(-1)!;
    expect(record.status).toBe("skipped");
    expect(record.skipReason).toBe("axis-scale-mismatch");
  });

  it("cancel snaps straight to the committed endpoint and marks the flight", () => {
    vi.useFakeTimers();
    stubFrameClock();
    const currentRect = PLAYER_CURRENT_RECT();
    const { clipElement, viewport } = makeViewport({
      rangeRect: currentRect,
      clipRect: currentRect,
    });

    const cancel = playPdfZoomMotion({
      transaction: makePlayerTransaction(),
      viewportElement: viewport,
    });

    expect(clipElement!.style.transform).not.toBe("");
    cancel!();
    expect(clipElement!.style.transform).toBe("");
    expect(clipElement!.style.willChange).toBe("");
    const record = getPdfZoomMotionFlightRecords().at(-1)!;
    expect(record.interruption).toBe("cancelled");
    vi.runAllTimers();
  });

  it("records scroll drift and attributes page raster work to the live flight", () => {
    vi.useFakeTimers();
    const clock = stubFrameClock();
    const currentRect = PLAYER_CURRENT_RECT();
    const { viewport } = makeViewport({
      rangeRect: currentRect,
      clipRect: currentRect,
    });

    playPdfZoomMotion({
      transaction: makePlayerTransaction(),
      viewportElement: viewport,
    });
    clock.tick(1000);

    notePdfZoomMotionPageRender({
      pageNumber: 3,
      scale: 1.2,
      rotation: 0,
      devicePixelRatio: 2,
      status: "rendered",
      durationMs: 24,
    });
    (viewport as unknown as { scrollTop: number }).scrollTop = 7;
    clock.tick(1100);

    const record = getPdfZoomMotionFlightRecords().at(-1)!;
    expect(record.pageRenderCount).toBe(1);
    expect(record.pageRenderMainThreadMs).toBe(24);
    expect(record.scrollDriftMaxPx).toBe(7);

    // After settle the flight is no longer live — later raster work is not
    // attributed to it.
    clock.tick(1300);
    notePdfZoomMotionPageRender({
      pageNumber: 3,
      scale: 1.2,
      rotation: 0,
      devicePixelRatio: 2,
      status: "rendered",
      durationMs: 40,
    });
    expect(getPdfZoomMotionFlightRecords().at(-1)!.pageRenderCount).toBe(1);
    vi.runAllTimers();
  });

  it("records a zoom-lane bypass so a silent fallback stays visible", () => {
    const controller = createPdfZoomMotionController(makeLayout(1));
    controller.noteBypass?.("stale-intent");

    const record = getPdfZoomMotionFlightRecords().at(-1)!;
    expect(record.status).toBe("skipped");
    expect(record.skipReason).toBe("bypass:stale-intent");
  });

  it("force-finishes a stalled clock so the transform never outlives its flight", () => {
    vi.useFakeTimers();
    stubFrameClock();
    const currentRect = PLAYER_CURRENT_RECT();
    const { clipElement, viewport } = makeViewport({
      rangeRect: currentRect,
      clipRect: currentRect,
    });

    playPdfZoomMotion({
      transaction: makePlayerTransaction(),
      viewportElement: viewport,
    });
    expect(clipElement!.style.transform).not.toBe("");

    // No rAF ever fires (hidden tab); the stall net clears the transform.
    vi.runAllTimers();
    expect(clipElement!.style.transform).toBe("");
    expect(getPdfZoomMotionFlightRecords().at(-1)!.interruption).toBe(
      "stalled",
    );
  });
});
