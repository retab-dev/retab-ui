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

describe("usePdfPageVirtualization", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("does not expose an invalid initial page for an empty layout", () => {
    const layout = createPdfPageLayout({
      pageCount: 0,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });

    function Harness() {
      const result = usePdfPageVirtualization({
        layout,
        viewportElement: null,
      });

      return (
        <output data-testid="pages">
          {result.visiblePageNumbers.join(",")}
        </output>
      );
    }

    render(<Harness />);

    expect(screen.getByTestId("pages").textContent).toBe("");
  });

  it("coalesces scroll measurements into one animation frame", async () => {
    const layout = createPdfPageLayout({
      pageCount: 20,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const harnessState = {
      viewportElement: null as HTMLDivElement | null,
      measureVisiblePages: null as (() => void) | null,
    };

    function Harness() {
      const [viewport] = React.useState(
        () =>
          ({
            scrollTop: 0,
            clientHeight: 200,
          }) as HTMLDivElement,
      );
      const result = usePdfPageVirtualization({
        layout,
        viewportElement: viewport,
      });

      useKeyedLayoutEffect(
        joinEffectKey([result.measureVisiblePages, viewport]),
        () => {
          harnessState.viewportElement = viewport;
          harnessState.measureVisiblePages = result.measureVisiblePages;
        },
      );

      return (
        <output data-testid="pages">
          {result.visiblePageNumbers.join(",")}
        </output>
      );
    }

    render(<Harness />);

    await waitFor(() =>
      expect(screen.getByTestId("pages").textContent).toBe("1,2,3,4"),
    );

    harnessState.viewportElement!.scrollTop = getPdfPageLayout(
      layout,
      10,
    )!.offsetTop;

    act(() => {
      harnessState.measureVisiblePages!();
      harnessState.measureVisiblePages!();
      harnessState.measureVisiblePages!();
    });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("pages").textContent).toBe("1,2,3,4");

    act(() => {
      frameCallbacks[0]?.(0);
    });

    await waitFor(() =>
      expect(screen.getByTestId("pages").textContent).toBe("7,8,9,10,11,12,13"),
    );
  });

  it("ignores a pending measurement from a previous layout after rerender", async () => {
    const initialLayout = createPdfPageLayout({
      pageCount: 20,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const nextLayout = createPdfPageLayout({
      pageCount: 20,
      defaultPageSize: { width: 100, height: 400 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const frameCallbacks: FrameRequestCallback[] = [];
    const cancelAnimationFrame = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });

    const harnessState = {
      viewportElement: null as HTMLDivElement | null,
      measureVisiblePages: null as (() => void) | null,
    };

    function Harness({ layout }: { layout: typeof initialLayout }) {
      const [viewport] = React.useState(
        () =>
          ({
            scrollTop: getPdfPageLayout(initialLayout, 10)!.offsetTop,
            clientHeight: 200,
          }) as HTMLDivElement,
      );
      const result = usePdfPageVirtualization({
        layout,
        viewportElement: viewport,
      });

      useKeyedLayoutEffect(
        joinEffectKey([result.measureVisiblePages, viewport]),
        () => {
          harnessState.viewportElement = viewport;
          harnessState.measureVisiblePages = result.measureVisiblePages;
        },
      );

      return (
        <output data-testid="pages">
          {result.visiblePageNumbers.join(",")}
        </output>
      );
    }

    const view = render(<Harness layout={initialLayout} />);

    await waitFor(() =>
      expect(screen.getByTestId("pages").textContent).toBe("7,8,9,10,11,12,13"),
    );

    act(() => {
      harnessState.measureVisiblePages!();
    });
    expect(frameCallbacks).toHaveLength(1);

    view.rerender(<Harness layout={nextLayout} />);

    await waitFor(() =>
      expect(screen.getByTestId("pages").textContent).toBe("3,4,5,6,7,8"),
    );
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);

    act(() => {
      frameCallbacks[0]?.(0);
    });

    expect(screen.getByTestId("pages").textContent).toBe("3,4,5,6,7,8");
    expect(harnessState.viewportElement!.scrollTop).toBe(
      getPdfPageLayout(initialLayout, 10)!.offsetTop,
    );
  });

  it("does not expose stale visible pages during the layout-change render", async () => {
    const initialLayout = createPdfPageLayout({
      pageCount: 20,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const nextLayout = createPdfPageLayout({
      pageCount: 1,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const snapshots: string[] = [];

    function Harness({ layout }: { layout: typeof initialLayout }) {
      const [viewport] = React.useState(
        () =>
          ({
            scrollTop: getPdfPageLayout(initialLayout, 10)!.offsetTop,
            clientHeight: 200,
          }) as HTMLDivElement,
      );
      const result = usePdfPageVirtualization({
        layout,
        viewportElement: viewport,
      });
      const pageList = result.visiblePageNumbers.join(",");
      snapshots.push(pageList);

      return <output data-testid="pages">{pageList}</output>;
    }

    const view = render(<Harness layout={initialLayout} />);

    await waitFor(() =>
      expect(screen.getByTestId("pages").textContent).toBe("7,8,9,10,11,12,13"),
    );

    view.rerender(<Harness layout={nextLayout} />);

    expect(screen.getByTestId("pages").textContent).toBe("1");
    expect(snapshots.at(-1)).toBe("1");
  });

  it("does not compute the reset-key render from the previous scroll offset", async () => {
    const layout = createPdfPageLayout({
      pageCount: 20,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const snapshots: string[] = [];

    function Harness({ resetKey }: { resetKey: string }) {
      const [viewport] = React.useState(
        () =>
          ({
            scrollTop: getPdfPageLayout(layout, 10)!.offsetTop,
            clientHeight: 200,
          }) as HTMLDivElement,
      );
      const result = usePdfPageVirtualization({
        layout,
        resetKey,
        viewportElement: viewport,
      });
      const pageList = result.visiblePageNumbers.join(",");
      snapshots.push(pageList);

      return <output data-testid="pages">{pageList}</output>;
    }

    const view = render(<Harness resetKey="doc-a" />);

    await waitFor(() =>
      expect(screen.getByTestId("pages").textContent).toBe("7,8,9,10,11,12,13"),
    );

    view.rerender(<Harness resetKey="doc-b" />);

    expect(screen.getByTestId("pages").textContent).toBe("1,2,3,4");
    expect(snapshots.at(-1)).toBe("1,2,3,4");
  });
});
