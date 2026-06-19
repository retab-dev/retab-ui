import { describe, expect, it } from "vitest";

import { getPdfCanvasPixelSize } from "@/registry/new-york-v4/ui/pdf-viewer-canvas";

describe("getPdfCanvasPixelSize", () => {
  it("scales CSS pixels by the device pixel ratio", () => {
    expect(getPdfCanvasPixelSize(100, 1)).toBe(100);
    expect(getPdfCanvasPixelSize(100, 2)).toBe(200);
    expect(getPdfCanvasPixelSize(100, 3)).toBe(300);
  });

  it("floors fractional pixel sizes so the canvas never exceeds the CSS box", () => {
    expect(getPdfCanvasPixelSize(100, 1.5)).toBe(150);
    // 100 * 2.4 = 240, but a real-world dpr like 1.325 should floor down.
    expect(getPdfCanvasPixelSize(100, 1.325)).toBe(132);
    expect(getPdfCanvasPixelSize(33, 3)).toBe(99);
  });

  it("never returns less than one device pixel for a positive box", () => {
    expect(getPdfCanvasPixelSize(0.5, 1)).toBe(1);
    expect(getPdfCanvasPixelSize(1, 0.5)).toBe(1);
    expect(getPdfCanvasPixelSize(0.1, 0.1)).toBe(1);
  });

  it("falls back to one pixel for non-positive sizes", () => {
    expect(getPdfCanvasPixelSize(0, 2)).toBe(1);
    expect(getPdfCanvasPixelSize(-100, 2)).toBe(1);
    expect(getPdfCanvasPixelSize(100, 0)).toBe(1);
    expect(getPdfCanvasPixelSize(100, -2)).toBe(1);
  });

  it("falls back to one pixel for non-finite inputs", () => {
    expect(getPdfCanvasPixelSize(Number.NaN, 2)).toBe(1);
    expect(getPdfCanvasPixelSize(100, Number.NaN)).toBe(1);
    expect(getPdfCanvasPixelSize(Number.POSITIVE_INFINITY, 2)).toBe(1);
    expect(getPdfCanvasPixelSize(100, Number.POSITIVE_INFINITY)).toBe(1);
    expect(getPdfCanvasPixelSize(Number.NEGATIVE_INFINITY, 2)).toBe(1);
  });
});
