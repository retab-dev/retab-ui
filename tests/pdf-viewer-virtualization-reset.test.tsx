// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPdfPageLayout,
  getPdfPageLayout,
} from "@/registry/new-york-v4/ui/pdf-viewer-layout";
import { usePdfPageVirtualization } from "@/registry/new-york-v4/ui/pdf-viewer-virtualization";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";

/**
 * These tests target the seam between the deferred (requestAnimationFrame)
 * measurement and a reset-key change. The render-time window keys off the
 * committed `state.resetKey`, while the deferred measurement keys off the
 * internal `lastMeasuredResetKeyRef`; this exercises both so they cannot drift
 * apart and strand a stale page window after a document switch.
 */

const layout = createPdfPageLayout({
  pageCount: 20,
  defaultPageSize: { width: 100, height: 200 },
  pageSizeByNumber: new Map(),
  scale: 1,
  rotation: 0,
});

const page10Top = getPdfPageLayout(layout, 10)!.offsetTop;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setupManualFrames() {
  const frameCallbacks: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frameCallbacks.push(callback);
    return frameCallbacks.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  return frameCallbacks;
}

describe("usePdfPageVirtualization — reset-key vs deferred measurement", () => {
  it("keeps the reset window when a pre-reset frame fires after the viewport scrolled home", async () => {
    const frameCallbacks = setupManualFrames();
    // A live, mutable viewport: the real component resets scrollTop to 0 on a
    // document switch, so model that the scroll has gone home by the time the
    // stale frame fires.
    const viewport = {
      scrollTop: page10Top,
      clientHeight: 200,
    } as HTMLDivElement;
    const harness = { measureVisiblePages: null as (() => void) | null };

    function Harness({ resetKey }: { resetKey: string }) {
      const result = usePdfPageVirtualization({
        layout,
        resetKey,
        viewportElement: viewport,
      });
      useKeyedLayoutEffect(joinEffectKey([result.measureVisiblePages]), () => {
        harness.measureVisiblePages = result.measureVisiblePages;
      });
      return (
        <output data-testid="pages">
          {result.visiblePageNumbers.join(",")}
        </output>
      );
    }

    const view = render(<Harness resetKey="doc-a" />);
    await waitFor(() =>
      expect(screen.getByTestId("pages").textContent).toBe("7,8,9,10,11,12,13"),
    );

    // Schedule a measurement under doc-a, then switch documents and scroll home.
    act(() => harness.measureVisiblePages!());
    viewport.scrollTop = 0;
    view.rerender(<Harness resetKey="doc-b" />);

    expect(screen.getByTestId("pages").textContent).toBe("1,2,3,4");

    // The stale pre-reset frame fires late; reading the live (home) scrollTop it
    // must not resurrect the old page window.
    act(() => {
      frameCallbacks.forEach((callback) => callback(0));
    });
    expect(screen.getByTestId("pages").textContent).toBe("1,2,3,4");
  });

  it("recomputes from the new document's live scroll position after a reset settles", async () => {
    const frameCallbacks = setupManualFrames();
    const viewport = { scrollTop: 0, clientHeight: 200 } as HTMLDivElement;
    const harness = { measureVisiblePages: null as (() => void) | null };

    function Harness({ resetKey }: { resetKey: string }) {
      const result = usePdfPageVirtualization({
        layout,
        resetKey,
        viewportElement: viewport,
      });
      useKeyedLayoutEffect(joinEffectKey([result.measureVisiblePages]), () => {
        harness.measureVisiblePages = result.measureVisiblePages;
      });
      return (
        <output data-testid="pages">
          {result.visiblePageNumbers.join(",")}
        </output>
      );
    }

    const view = render(<Harness resetKey="doc-a" />);
    await waitFor(() =>
      expect(screen.getByTestId("pages").textContent).toBe("1,2,3,4"),
    );

    // Switch to doc-b (still at the top).
    view.rerender(<Harness resetKey="doc-b" />);
    expect(screen.getByTestId("pages").textContent).toBe("1,2,3,4");

    // The user now scrolls the new document; the deferred measurement must use
    // doc-b's live scroll offset, not stay pinned to the post-reset top.
    viewport.scrollTop = page10Top;
    act(() => harness.measureVisiblePages!());
    act(() => {
      frameCallbacks.forEach((callback) => callback(0));
    });

    await waitFor(() =>
      expect(screen.getByTestId("pages").textContent).toBe("7,8,9,10,11,12,13"),
    );
  });

  it("survives rapid reset-key churn without leaking a window across documents", async () => {
    const frameCallbacks = setupManualFrames();
    const viewport = {
      scrollTop: page10Top,
      clientHeight: 200,
    } as HTMLDivElement;
    const harness = { measureVisiblePages: null as (() => void) | null };

    function Harness({ resetKey }: { resetKey: string }) {
      const result = usePdfPageVirtualization({
        layout,
        resetKey,
        viewportElement: viewport,
      });
      useKeyedLayoutEffect(joinEffectKey([result.measureVisiblePages]), () => {
        harness.measureVisiblePages = result.measureVisiblePages;
      });
      return (
        <output data-testid="pages">
          {result.visiblePageNumbers.join(",")}
        </output>
      );
    }

    const view = render(<Harness resetKey="doc-a" />);
    await waitFor(() =>
      expect(screen.getByTestId("pages").textContent).toBe("7,8,9,10,11,12,13"),
    );

    // Churn the reset key several times while a measurement is in flight and the
    // viewport keeps being scrolled home on each switch.
    for (const key of ["doc-b", "doc-c", "doc-d"]) {
      act(() => harness.measureVisiblePages!());
      viewport.scrollTop = 0;
      view.rerender(<Harness resetKey={key} />);
      expect(screen.getByTestId("pages").textContent).toBe("1,2,3,4");
    }

    act(() => {
      frameCallbacks.forEach((callback) => callback(0));
    });
    expect(screen.getByTestId("pages").textContent).toBe("1,2,3,4");
  });
});
