import { afterEach, describe, expect, it, vi } from "vitest";

import { createImageFrameLayout } from "@/registry/new-york-v4/ui/image-viewer-virtualization";
import {
  captureImageZoomTransaction,
  playImageZoomMotion,
  resolveImageZoomScrollTarget,
} from "@/registry/new-york-v4/ui/image-viewer-zoom-motion";

function makeLayout(scale: number) {
  return createImageFrameLayout({
    frames: Array.from({ length: 5 }, () => ({
      intrinsicSize: { width: 400, height: 800 },
    })),
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
    getBoundingClientRect: () =>
      makeRect({ left: 0, top: 0, width: clientWidth, height: clientHeight }),
    querySelector: (selector: string) => {
      if (selector.includes("image-viewer-scroll-range")) return rangeElement;
      if (selector.includes("image-viewer-visual-clip")) return clipElement;
      return null;
    },
  };
  return {
    clipElement,
    viewport: viewport as unknown as HTMLDivElement,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("image zoom motion anchor", () => {
  it("captures the viewport-center content point on both axes", () => {
    const { viewport } = makeViewport({
      rangeRect: makeRect({ left: 100, top: -1708, width: 432, height: 4096 }),
    });

    const transaction = captureImageZoomTransaction({
      layout: makeLayout(1),
      scrollTop: 1708,
      viewportElement: viewport,
    });

    // Center marker at 1708 + 300 lands inside frame 3 (offset 1648, height
    // 800) at 45% of the frame.
    expect(transaction).not.toBeNull();
    expect(transaction!.frameNumber).toBe(3);
    expect(transaction!.yPercent).toBeCloseTo(0.45, 5);
    // Viewport center x = 400; stage spans [100, 532] → 69.4% across.
    expect(transaction!.inlineFraction).toBeCloseTo(300 / 432, 5);
  });

  it("restores the captured content point back under the viewport center", () => {
    const capturedAt = makeViewport({
      rangeRect: makeRect({ left: 100, top: -1708, width: 432, height: 4096 }),
    });
    const transaction = captureImageZoomTransaction({
      layout: makeLayout(1),
      scrollTop: 1708,
      viewportElement: capturedAt.viewport,
    })!;

    // After the 1.2x commit (before restore): stage is 512 wide at left 60.
    const committed = makeViewport({
      rangeRect: makeRect({ left: 60, top: -2000, width: 512, height: 4908.8 }),
      scrollLeft: 0,
    });
    const target = resolveImageZoomScrollTarget({
      layout: makeLayout(1.2),
      transaction,
      viewportElement: committed.viewport,
    });

    expect(target).not.toBeNull();
    // Frame 3 at 1.2x: offset 1974.4, height 960 → 1974.4 + 432 - 300.
    expect(target!.top).toBeCloseTo(2106.4, 5);
    // Anchored point x = 60 + (300 / 432) * 512 = 415.6; center is 400 →
    // scroll +15.6.
    expect(target!.left).toBeCloseTo(60 + (300 / 432) * 512 - 400, 5);
  });

  it("omits the inline axis when the stage cannot be measured", () => {
    const { viewport } = makeViewport({ rangeRect: null });

    const transaction = captureImageZoomTransaction({
      layout: makeLayout(1),
      scrollTop: 1708,
      viewportElement: viewport,
    });

    expect(transaction).not.toBeNull();
    expect(transaction!.inlineFraction).toBeNull();

    const target = resolveImageZoomScrollTarget({
      layout: makeLayout(1.2),
      transaction: transaction!,
      viewportElement: viewport,
    });
    expect(target).not.toBeNull();
    expect(target!.left).toBeUndefined();
  });

  it("clamps the block restore to the scrollable range", () => {
    const { viewport } = makeViewport({
      rangeRect: makeRect({ left: 100, top: 0, width: 432, height: 4096 }),
    });
    const transaction = captureImageZoomTransaction({
      layout: makeLayout(1),
      scrollTop: 0,
      viewportElement: viewport,
    })!;

    const target = resolveImageZoomScrollTarget({
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

describe("image zoom motion player", () => {
  it("relaxes a FLIP from the painted rect and cleans up inline styles", () => {
    vi.useFakeTimers();
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});

    const previousRect = makeRect({
      left: 116,
      top: -1708,
      width: 400,
      height: 4128,
    });
    const currentRect = makeRect({
      left: 76,
      top: -2106,
      width: 480,
      height: 4953.6,
    });
    const { clipElement, viewport } = makeViewport({
      rangeRect: currentRect,
      clipRect: currentRect,
    });

    const cancel = playImageZoomMotion({
      transaction: {
        frameNumber: 3,
        yPercent: 0.45,
        inlineFraction: 0.75,
        previousVisualRect: previousRect,
      },
      viewportElement: viewport,
    });

    expect(cancel).not.toBeNull();
    const style = clipElement!.style;
    expect(style.transform).toContain("scale(0.833333");
    expect(style.willChange).toBe("transform");
    expect(style.transformOrigin).not.toBe("");

    // The kick-off frame swaps in the eased transition to identity.
    for (const callback of frameCallbacks.splice(0)) callback(0);
    expect(style.transition).toContain("transform");
    expect(style.transform).toBe("translate3d(0px, 0px, 0px) scale(1, 1)");

    vi.runAllTimers();
    expect(style.transform).toBe("");
    expect(style.transition).toBe("");
    expect(style.willChange).toBe("");
  });

  it("snaps instead of animating when the axes stopped scaling together", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
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

    const cancel = playImageZoomMotion({
      transaction: {
        frameNumber: 3,
        yPercent: 0.45,
        inlineFraction: 0.75,
        previousVisualRect: previousRect,
      },
      viewportElement: viewport,
    });

    expect(cancel).toBeNull();
    expect(clipElement!.style.transform ?? "").toBe("");
  });

  it("cancel snaps straight to the committed endpoint", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});

    const previousRect = makeRect({
      left: 116,
      top: -1708,
      width: 400,
      height: 4128,
    });
    const currentRect = makeRect({
      left: 76,
      top: -2106,
      width: 480,
      height: 4953.6,
    });
    const { clipElement, viewport } = makeViewport({
      rangeRect: currentRect,
      clipRect: currentRect,
    });

    const cancel = playImageZoomMotion({
      transaction: {
        frameNumber: 3,
        yPercent: 0.45,
        inlineFraction: 0.75,
        previousVisualRect: previousRect,
      },
      viewportElement: viewport,
    });

    expect(clipElement!.style.transform).not.toBe("");
    cancel!();
    expect(clipElement!.style.transform).toBe("");
    expect(clipElement!.style.willChange).toBe("");
  });
});
