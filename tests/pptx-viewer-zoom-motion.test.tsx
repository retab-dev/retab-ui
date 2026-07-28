import { afterEach, describe, expect, it, vi } from "vitest";

import {
  capturePptxZoomTransaction,
  playPptxZoomMotion,
  resolvePptxZoomScrollTarget,
  type PptxZoomSlideLayout,
} from "@/registry/new-york-v4/ui/pptx-viewer-zoom-motion";

// 5 slides of 800px at scale 1 with a 16px gap and fixed 16px outer padding.
function makeLayout(scale: number): PptxZoomSlideLayout {
  const slideHeight = 800 * scale;
  const slideGap = 16 * scale;
  return {
    slideCount: 5,
    slideTopPadding: 16,
    slideHeight,
    slideStride: slideHeight + slideGap,
    totalHeight: 16 * 2 + slideHeight * 5 + slideGap * 4,
  };
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
  stageRect,
  canvasRect,
  scrollLeft = 0,
  scrollTop = 0,
  clientWidth = 800,
  clientHeight = 600,
}: {
  stageRect?: DOMRect | null;
  canvasRect?: DOMRect | null;
  scrollLeft?: number;
  scrollTop?: number;
  clientWidth?: number;
  clientHeight?: number;
}) {
  const listeners = new Map<string, () => void>();
  const stageElement = stageRect
    ? { getBoundingClientRect: () => stageRect }
    : null;
  const canvasElement = canvasRect
    ? {
        style: {} as Record<string, string>,
        getBoundingClientRect: () => canvasRect,
      }
    : null;
  const viewport = {
    clientWidth,
    clientHeight,
    scrollLeft,
    scrollTop,
    getBoundingClientRect: () =>
      makeRect({ left: 0, top: 0, width: clientWidth, height: clientHeight }),
    querySelector: (selector: string) => {
      if (selector.includes("pptx-viewer-document-surface")) {
        return stageElement;
      }
      if (selector.includes("pptx-slide-virtual-canvas")) return canvasElement;
      return null;
    },
    addEventListener: (event: string, listener: () => void) => {
      listeners.set(event, listener);
    },
    removeEventListener: (event: string) => {
      listeners.delete(event);
    },
  };
  return {
    canvasElement,
    listeners,
    viewport: viewport as unknown as HTMLDivElement,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("pptx zoom motion anchor", () => {
  it("captures the viewport-center content point on both axes", () => {
    const { viewport } = makeViewport({
      stageRect: makeRect({ left: 100, top: -1708, width: 400, height: 4096 }),
      scrollTop: 1708,
    });

    const transaction = capturePptxZoomTransaction({
      layout: makeLayout(1),
      scrollTop: 1708,
      viewportElement: viewport,
    });

    // Center marker at 1708 + 300 lands inside slide 3 (top 1648, height
    // 800) at 45% of the slide.
    expect(transaction).not.toBeNull();
    expect(transaction!.slideNumber).toBe(3);
    expect(transaction!.yPercent).toBeCloseTo(0.45, 5);
    // Viewport center x = 400; stage spans [100, 500] → 75% across.
    expect(transaction!.inlineFraction).toBeCloseTo(0.75, 5);
    // Viewport center y = 300; stage spans [-1708, 2388] → 49.0% down.
    expect(transaction!.blockFraction).toBeCloseTo(2008 / 4096, 5);
  });

  it("restores the captured content point back under the viewport center", () => {
    const capturedAt = makeViewport({
      stageRect: makeRect({ left: 100, top: -1708, width: 400, height: 4096 }),
      scrollTop: 1708,
    });
    const transaction = capturePptxZoomTransaction({
      layout: makeLayout(1),
      scrollTop: 1708,
      viewportElement: capturedAt.viewport,
    })!;

    // After the 1.2x commit (before restore): stage is 480 wide at left 60,
    // still painted from the pre-restore scroll (top = -scrollTop).
    const committedLayout = makeLayout(1.2);
    const committed = makeViewport({
      stageRect: makeRect({
        left: 60,
        top: -1708,
        width: 480,
        height: committedLayout.totalHeight,
      }),
      scrollTop: 1708,
    });
    const target = resolvePptxZoomScrollTarget({
      layout: committedLayout,
      transaction,
      viewportElement: committed.viewport,
    });

    expect(target).not.toBeNull();
    // BOTH axes solve off the painted stage rect: scroll by however far the
    // anchored content point sits from the viewport centre. Rect-derived, so
    // an auto-margin the layout model knows nothing about cannot skew it.
    expect(target!.top).toBeCloseTo(
      1708 + (-1708 + committedLayout.totalHeight * (2008 / 4096)) - 300,
      4,
    );
    // Anchored point x = 60 + 0.75 * 480 = 420; center is 400 → scroll +20.
    expect(target!.left).toBeCloseTo(20, 5);
  });

  it("falls back to the slide model when the stage stops spanning the deck", () => {
    const capturedAt = makeViewport({
      stageRect: makeRect({ left: 100, top: -1708, width: 400, height: 4096 }),
      scrollTop: 1708,
    });
    const transaction = capturePptxZoomTransaction({
      layout: makeLayout(1),
      scrollTop: 1708,
      viewportElement: capturedAt.viewport,
    })!;

    // A rebased (paged) scroll detaches the stage box from the deck.
    const committed = makeViewport({
      stageRect: makeRect({ left: 60, top: -2000, width: 480, height: 12_000 }),
      scrollTop: 1708,
    });
    const target = resolvePptxZoomScrollTarget({
      layout: makeLayout(1.2),
      transaction,
      viewportElement: committed.viewport,
    });

    expect(target).not.toBeNull();
    // Slide 3 at 1.2x: top 16 + 2 * 979.2 = 1974.4, height 960 →
    // 1974.4 + 432 - 300.
    expect(target!.top).toBeCloseTo(2106.4, 4);
  });

  it("clamps the block restore to the scrollable range", () => {
    const { viewport } = makeViewport({
      stageRect: makeRect({ left: 100, top: 16, width: 400, height: 4096 }),
    });
    const transaction = capturePptxZoomTransaction({
      layout: makeLayout(1),
      scrollTop: 0,
      viewportElement: viewport,
    })!;

    // Zooming OUT from the top: the unclamped center target would be
    // negative; the restore pins to the document start instead.
    const target = resolvePptxZoomScrollTarget({
      layout: makeLayout(0.5),
      transaction,
      viewportElement: viewport,
    });

    expect(target).not.toBeNull();
    expect(target!.top).toBe(0);
  });
});

describe("pptx zoom motion player", () => {
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
      height: 4096,
    });
    const currentRect = makeRect({
      left: 76,
      top: -2106,
      width: 480,
      height: 4915.2,
    });
    const { canvasElement, viewport } = makeViewport({
      stageRect: currentRect,
      canvasRect: currentRect,
    });

    const cancel = playPptxZoomMotion({
      transaction: {
        slideNumber: 3,
        yPercent: 0.45,
        inlineFraction: 0.75,
        blockFraction: 0.5,
        previousVisualRect: previousRect,
      },
      viewportElement: viewport,
    });

    expect(cancel).not.toBeNull();
    const style = canvasElement!.style;
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

  it("snaps to the committed endpoint on a user gesture mid-relax", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});

    const previousRect = makeRect({
      left: 116,
      top: -1708,
      width: 400,
      height: 4096,
    });
    const currentRect = makeRect({
      left: 76,
      top: -2106,
      width: 480,
      height: 4915.2,
    });
    const { canvasElement, listeners, viewport } = makeViewport({
      stageRect: currentRect,
      canvasRect: currentRect,
    });

    const cancel = playPptxZoomMotion({
      transaction: {
        slideNumber: 3,
        yPercent: 0.45,
        inlineFraction: 0.75,
        blockFraction: 0.5,
        previousVisualRect: previousRect,
      },
      viewportElement: viewport,
    });

    expect(cancel).not.toBeNull();
    expect(canvasElement!.style.transform).not.toBe("");
    expect(listeners.has("wheel")).toBe(true);

    listeners.get("wheel")!();
    expect(canvasElement!.style.transform).toBe("");
    expect(canvasElement!.style.willChange).toBe("");
    expect(listeners.has("wheel")).toBe(false);
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
    const { canvasElement, viewport } = makeViewport({
      stageRect: currentRect,
      canvasRect: currentRect,
    });

    const cancel = playPptxZoomMotion({
      transaction: {
        slideNumber: 3,
        yPercent: 0.45,
        inlineFraction: 0.75,
        blockFraction: 0.5,
        previousVisualRect: previousRect,
      },
      viewportElement: viewport,
    });

    expect(cancel).toBeNull();
    expect(canvasElement!.style.transform ?? "").toBe("");
  });
});
