import { afterEach, describe, expect, it, vi } from "vitest";

import { createDocxPageLayout } from "@/registry/new-york-v4/ui/docx-viewer-layout";
import {
  captureDocxZoomTransaction,
  playDocxZoomMotion,
  resolveDocxZoomScrollTarget,
} from "@/registry/new-york-v4/ui/docx-viewer-zoom-motion";

const PAGE_SIZES = Array.from({ length: 5 }, () => [400, 800] as const);

function makeLayout() {
  // Intrinsic (unscaled) coordinates: page n top = (n - 1) * 816.
  return createDocxPageLayout(PAGE_SIZES);
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
  scrollLeft = 0,
  scrollHeight = 5000,
  clientWidth = 800,
  clientHeight = 600,
}: {
  stageRect?: DOMRect | null;
  scrollLeft?: number;
  scrollHeight?: number;
  clientWidth?: number;
  clientHeight?: number;
}) {
  const listeners = new Map<string, () => void>();
  const stageElement = stageRect
    ? {
        style: {} as Record<string, string>,
        getBoundingClientRect: () => stageRect,
      }
    : null;
  const viewport = {
    clientWidth,
    clientHeight,
    scrollHeight,
    scrollLeft,
    scrollTop: 0,
    getBoundingClientRect: () =>
      makeRect({ left: 0, top: 0, width: clientWidth, height: clientHeight }),
    querySelector: (selector: string) =>
      selector.includes("docx-viewer-zoom-stage") ? stageElement : null,
    addEventListener: (event: string, listener: () => void) => {
      listeners.set(event, listener);
    },
    removeEventListener: (event: string) => {
      listeners.delete(event);
    },
  };
  return {
    listeners,
    stageElement,
    viewport: viewport as unknown as HTMLDivElement,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("docx zoom motion anchor", () => {
  it("captures the viewport-center content point on both axes", () => {
    const { viewport } = makeViewport({
      stageRect: makeRect({ left: 100, top: -1692, width: 400, height: 4064 }),
    });

    const transaction = captureDocxZoomTransaction({
      layout: makeLayout(),
      scale: 1,
      scrollTop: 1708,
      viewportElement: viewport,
    });

    // Center marker at 1708 + 300; intrinsic y = 2008 - 16 = 1992 lands in
    // page 3 (top 1632, height 800) at 45% of the page.
    expect(transaction).not.toBeNull();
    expect(transaction!.pageNumber).toBe(3);
    expect(transaction!.yPercent).toBeCloseTo(0.45, 5);
    // Viewport center x = 400; stage spans [100, 500] → 75% across.
    expect(transaction!.inlineFraction).toBeCloseTo(0.75, 5);
  });

  it("restores the captured content point back under the viewport center", () => {
    const capturedAt = makeViewport({
      stageRect: makeRect({ left: 100, top: -1692, width: 400, height: 4064 }),
    });
    const transaction = captureDocxZoomTransaction({
      layout: makeLayout(),
      scale: 1,
      scrollTop: 1708,
      viewportElement: capturedAt.viewport,
    })!;

    // After the 1.2x commit (before restore): stage is 480 wide at left 60.
    const committed = makeViewport({
      stageRect: makeRect({ left: 60, top: -2000, width: 480, height: 4876.8 }),
      scrollHeight: 4909,
    });
    const target = resolveDocxZoomScrollTarget({
      layout: makeLayout(),
      scale: 1.2,
      transaction,
      viewportElement: committed.viewport,
    });

    expect(target).not.toBeNull();
    // 16 + (1632 + 0.45 * 800) * 1.2 - 300.
    expect(target!.top).toBeCloseTo(2106.4, 4);
    // Anchored point x = 60 + 0.75 * 480 = 420; center is 400 → scroll +20.
    expect(target!.left).toBeCloseTo(20, 5);
  });

  it("clamps the block restore to the scrollable range", () => {
    const { viewport } = makeViewport({
      stageRect: makeRect({ left: 100, top: 16, width: 400, height: 4064 }),
    });
    const transaction = captureDocxZoomTransaction({
      layout: makeLayout(),
      scale: 1,
      scrollTop: 0,
      viewportElement: viewport,
    })!;

    // Zooming OUT from the top: the unclamped center target would be
    // negative; the restore pins to the document start instead.
    const target = resolveDocxZoomScrollTarget({
      layout: makeLayout(),
      scale: 0.5,
      transaction,
      viewportElement: viewport,
    });

    expect(target).not.toBeNull();
    expect(target!.top).toBe(0);
  });
});

describe("docx zoom motion player", () => {
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
      top: -1692,
      width: 400,
      height: 4064,
    });
    const currentRect = makeRect({
      left: 76,
      top: -2090,
      width: 480,
      height: 4876.8,
    });
    const { stageElement, viewport } = makeViewport({
      stageRect: currentRect,
    });

    const cancel = playDocxZoomMotion({
      transaction: {
        pageNumber: 3,
        yPercent: 0.45,
        inlineFraction: 0.75,
        previousVisualRect: previousRect,
      },
      viewportElement: viewport,
    });

    expect(cancel).not.toBeNull();
    const style = stageElement!.style;
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
      top: -1692,
      width: 400,
      height: 4064,
    });
    const currentRect = makeRect({
      left: 76,
      top: -2090,
      width: 480,
      height: 4876.8,
    });
    const { listeners, stageElement, viewport } = makeViewport({
      stageRect: currentRect,
    });

    const cancel = playDocxZoomMotion({
      transaction: {
        pageNumber: 3,
        yPercent: 0.45,
        inlineFraction: 0.75,
        previousVisualRect: previousRect,
      },
      viewportElement: viewport,
    });

    expect(cancel).not.toBeNull();
    expect(stageElement!.style.transform).not.toBe("");
    expect(listeners.has("wheel")).toBe(true);

    listeners.get("wheel")!();
    expect(stageElement!.style.transform).toBe("");
    expect(stageElement!.style.willChange).toBe("");
    expect(listeners.has("wheel")).toBe(false);
  });

  it("snaps instead of animating when the axes stopped scaling together", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    const previousRect = makeRect({
      left: 116,
      top: -1692,
      width: 400,
      height: 4000,
    });
    const currentRect = makeRect({
      left: 76,
      top: -2090,
      width: 480,
      height: 4000,
    });
    const { stageElement, viewport } = makeViewport({
      stageRect: currentRect,
    });

    const cancel = playDocxZoomMotion({
      transaction: {
        pageNumber: 3,
        yPercent: 0.45,
        inlineFraction: 0.75,
        previousVisualRect: previousRect,
      },
      viewportElement: viewport,
    });

    expect(cancel).toBeNull();
    expect(stageElement!.style.transform ?? "").toBe("");
  });
});
