// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MAX_PDF_SCALE,
  MIN_PDF_SCALE,
  PDF_PAGE_HORIZONTAL_PADDING,
  PDF_ZOOM_STEP,
  usePdfScale,
} from "@/registry/new-york-v4/ui/pdf-viewer-scale";

afterEach(() => {
  cleanup();
});

type ScaleProps = Parameters<typeof usePdfScale>[0];

function renderScale(initialProps: ScaleProps) {
  const api = {
    current: null as ReturnType<typeof usePdfScale> | null,
  };
  function Harness(props: ScaleProps) {
    api.current = usePdfScale(props);
    return null;
  }
  const view = render(<Harness {...initialProps} />);
  return {
    api,
    rerender: (next: ScaleProps) => view.rerender(<Harness {...next} />),
  };
}

describe("usePdfScale — uncontrolled", () => {
  it("falls back to fit-width when no scale has been requested", () => {
    const { api } = renderScale({
      containerWidth: 100 + PDF_PAGE_HORIZONTAL_PADDING,
      pageWidth: 100,
    });
    // (132 - 32) / 100 = 1
    expect(api.current!.resolvedScale).toBe(1);
  });

  it("uses an explicit defaultScale instead of fit-width", () => {
    const { api } = renderScale({
      defaultScale: 2,
      containerWidth: 1000,
      pageWidth: 100,
    });
    expect(api.current!.resolvedScale).toBe(2);
  });

  it("zooms in and out by the zoom step, clamped to the bounds", () => {
    const { api } = renderScale({
      defaultScale: 1,
      containerWidth: 1000,
      pageWidth: 100,
    });

    act(() => api.current!.zoomIn());
    expect(api.current!.resolvedScale).toBeCloseTo(PDF_ZOOM_STEP, 5);

    act(() => api.current!.zoomOut());
    expect(api.current!.resolvedScale).toBeCloseTo(1, 5);
  });

  it("does not zoom past the maximum scale", () => {
    const { api } = renderScale({
      defaultScale: MAX_PDF_SCALE,
      containerWidth: 1000,
      pageWidth: 100,
    });
    act(() => api.current!.zoomIn());
    expect(api.current!.resolvedScale).toBe(MAX_PDF_SCALE);
  });

  it("does not zoom below the minimum scale", () => {
    const { api } = renderScale({
      defaultScale: MIN_PDF_SCALE,
      containerWidth: 1000,
      pageWidth: 100,
    });
    act(() => api.current!.zoomOut());
    expect(api.current!.resolvedScale).toBe(MIN_PDF_SCALE);
  });

  it("fitWidth clears the requested scale, returning to the measured fit", () => {
    const { api } = renderScale({
      defaultScale: 3,
      containerWidth: 100 + PDF_PAGE_HORIZONTAL_PADDING,
      pageWidth: 100,
    });
    expect(api.current!.resolvedScale).toBe(3);
    act(() => api.current!.fitWidth());
    expect(api.current!.resolvedScale).toBe(1);
  });

  it("resets the requested scale when the reset key changes", () => {
    const { api, rerender } = renderScale({
      defaultScale: 1,
      containerWidth: 100 + PDF_PAGE_HORIZONTAL_PADDING,
      pageWidth: 100,
      resetKey: "doc-a",
    });
    act(() => api.current!.zoomIn());
    expect(api.current!.resolvedScale).toBeCloseTo(PDF_ZOOM_STEP, 5);

    rerender({
      defaultScale: 1,
      containerWidth: 100 + PDF_PAGE_HORIZONTAL_PADDING,
      pageWidth: 100,
      resetKey: "doc-b",
    });
    // New document → requested scale falls back to the default again.
    expect(api.current!.resolvedScale).toBe(1);
  });
});

describe("usePdfScale — controlled", () => {
  it("clamps the controlled scale to the viewer bounds", () => {
    const { api } = renderScale({
      controlledScale: 99,
      containerWidth: 1000,
      pageWidth: 100,
    });
    expect(api.current!.resolvedScale).toBe(MAX_PDF_SCALE);
  });

  it("reports zoom requests through onScaleChange without mutating itself", () => {
    const onScaleChange = vi.fn();
    const { api } = renderScale({
      controlledScale: 1,
      onScaleChange,
      containerWidth: 1000,
      pageWidth: 100,
    });

    act(() => api.current!.zoomIn());
    expect(onScaleChange).toHaveBeenCalledWith(PDF_ZOOM_STEP);
    // Controlled: the resolved scale only changes when the parent feeds it back.
    expect(api.current!.resolvedScale).toBe(1);
  });

  it("reports fit-width as a null request", () => {
    const onScaleChange = vi.fn();
    const { api } = renderScale({
      controlledScale: 1,
      onScaleChange,
      containerWidth: 1000,
      pageWidth: 100,
    });
    act(() => api.current!.fitWidth());
    expect(onScaleChange).toHaveBeenCalledWith(null);
  });
});
