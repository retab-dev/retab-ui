// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPdfPageLayout,
  getPdfPageLayout,
  getPdfRenderPageNumbers,
  getPdfVisiblePageNumbers,
  PDF_RENDER_WINDOW_OVERSCAN_PX,
} from "@/registry/new-york-v4/ui/pdf-viewer-layout";
import {
  PDF_PAGE_WINDOW_RETENTION_MS,
  usePdfPageVirtualization,
} from "@/registry/new-york-v4/ui/pdf-viewer-virtualization";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";
import type { ViewerDocumentTransition } from "@/registry/new-york-v4/ui/viewer-types";

describe("usePdfPageVirtualization", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
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

  it("renders a fit-perfectly window for a large jump and fills overscan on the next frame", async () => {
    const layout = createPdfPageLayout({
      pageCount: 100,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const page40Top = getPdfPageLayout(layout, 40)!.offsetTop;
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
        <output data-testid="render">
          {result.renderPageNumbers.join(",")}
        </output>
      );
    }

    render(<Harness />);

    await waitFor(() =>
      expect(screen.getByTestId("render").textContent).toBe(
        getPdfRenderPageNumbers({
          layout,
          scrollTop: 0,
          viewportHeight: 200,
        }).join(","),
      ),
    );

    harnessState.viewportElement!.scrollTop = page40Top;
    act(() => {
      harnessState.measureVisiblePages!();
    });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    act(() => {
      frameCallbacks[0]?.(0);
    });

    expect(screen.getByTestId("render").textContent).toBe(
      getPdfRenderPageNumbers({
        fitPerfectly: true,
        layout,
        scrollTop: page40Top,
        viewportHeight: 200,
      }).join(","),
    );
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);

    act(() => {
      frameCallbacks[1]?.(16);
    });

    expect(screen.getByTestId("render").textContent).toBe(
      getPdfRenderPageNumbers({
        layout,
        scrollTop: page40Top,
        viewportHeight: 200,
      }).join(","),
    );
  });

  it("does not fit perfectly for a large scroll delta caused by a layout change", async () => {
    const initialLayout = createPdfPageLayout({
      pageCount: 100,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const nextLayout = createPdfPageLayout({
      pageCount: 100,
      defaultPageSize: { width: 100, height: 320 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const initialPage40Top = getPdfPageLayout(initialLayout, 40)!.offsetTop;
    const nextPage40Top = getPdfPageLayout(nextLayout, 40)!.offsetTop;
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    function Harness({
      layout,
      scrollTop,
    }: {
      layout: typeof initialLayout;
      scrollTop: number;
    }) {
      const [viewport] = React.useState(
        () =>
          ({
            scrollTop: 0,
            clientHeight: 200,
          }) as HTMLDivElement,
      );
      const result = usePdfPageVirtualization({
        getScrollMetrics: () => ({
          scrollPageOffset: 0,
          scrollTop,
          viewportHeight: viewport.clientHeight,
        }),
        layout,
        viewportElement: viewport,
      });

      return (
        <output data-testid="render">
          {result.renderPageNumbers.join(",")}
        </output>
      );
    }

    const view = render(
      <Harness layout={initialLayout} scrollTop={initialPage40Top} />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("render").textContent).toBe(
        getPdfRenderPageNumbers({
          layout: initialLayout,
          scrollTop: initialPage40Top,
          viewportHeight: 200,
        }).join(","),
      ),
    );

    view.rerender(<Harness layout={nextLayout} scrollTop={nextPage40Top} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(0);
    expect(screen.getByTestId("render").textContent).toBe(
      getPdfRenderPageNumbers({
        layout: nextLayout,
        scrollTop: nextPage40Top,
        viewportHeight: 200,
      }).join(","),
    );
    expect(screen.getByTestId("render").textContent).not.toBe(
      getPdfRenderPageNumbers({
        fitPerfectly: true,
        layout: nextLayout,
        scrollTop: nextPage40Top,
        viewportHeight: 200,
      }).join(","),
    );
  });

  it("retains the previous and current page windows during a layout transition", async () => {
    const initialLayout = createPdfPageLayout({
      pageCount: 20,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const nextLayout = createPdfPageLayout({
      pageCount: 20,
      defaultPageSize: { width: 100, height: 420 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const viewportHeight = 200;
    const initialScrollTop = getPdfPageLayout(initialLayout, 10)!.offsetTop;
    const nextScrollTop = getPdfPageLayout(nextLayout, 10)!.offsetTop;

    function Harness({
      isLayoutTransitioning = false,
      layout,
      scrollTop,
    }: {
      isLayoutTransitioning?: boolean;
      layout: typeof initialLayout;
      scrollTop: number;
    }) {
      const [viewport] = React.useState(
        () =>
          ({
            scrollTop: 0,
            clientHeight: viewportHeight,
          }) as HTMLDivElement,
      );
      const result = usePdfPageVirtualization({
        getScrollMetrics: () => ({
          scrollPageOffset: 0,
          scrollTop,
          viewportHeight: viewport.clientHeight,
        }),
        isLayoutTransitioning,
        layout,
        viewportElement: viewport,
      });

      return (
        <>
          <output data-testid="visible">
            {result.visiblePageNumbers.join(",")}
          </output>
          <output data-testid="render">
            {result.renderPageNumbers.join(",")}
          </output>
        </>
      );
    }

    const view = render(
      <Harness layout={initialLayout} scrollTop={initialScrollTop} />,
    );

    const initialVisible = getPdfVisiblePageNumbers({
      layout: initialLayout,
      scrollTop: initialScrollTop,
      viewportHeight,
    });
    const initialRender = getPdfRenderPageNumbers({
      layout: initialLayout,
      scrollTop: initialScrollTop,
      viewportHeight,
    });
    await waitFor(() =>
      expect(screen.getByTestId("visible").textContent).toBe(
        initialVisible.join(","),
      ),
    );
    expect(screen.getByTestId("render").textContent).toBe(
      initialRender.join(","),
    );

    const nextVisible = getPdfVisiblePageNumbers({
      layout: nextLayout,
      scrollTop: nextScrollTop,
      viewportHeight,
    });
    const nextRender = getPdfRenderPageNumbers({
      layout: nextLayout,
      scrollTop: nextScrollTop,
      viewportHeight,
    });

    view.rerender(
      <Harness
        isLayoutTransitioning
        layout={nextLayout}
        scrollTop={nextScrollTop}
      />,
    );

    expect(screen.getByTestId("visible").textContent).toBe(
      mergeExpectedPageNumbers(initialVisible, nextVisible).join(","),
    );
    expect(screen.getByTestId("render").textContent).toBe(
      mergeExpectedPageNumbers(initialRender, nextRender).join(","),
    );

    view.rerender(<Harness layout={nextLayout} scrollTop={nextScrollTop} />);

    expect(screen.getByTestId("visible").textContent).toBe(
      nextVisible.join(","),
    );
    expect(screen.getByTestId("render").textContent).toBe(nextRender.join(","));
  });

  it("uses a wider render window during chrome-resize transitions", async () => {
    const layout = createPdfPageLayout({
      pageCount: 30,
      defaultPageSize: { width: 100, height: 800 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const viewportHeight = 400;
    const scrollTop = getPdfPageLayout(layout, 10)!.offsetTop;
    const transition: ViewerDocumentTransition = {
      layoutPolicy: "frozen",
      scrollPolicy: "defer",
      source: "viewer-shell",
      transitionId: "test-chrome-resize",
      visualPolicy: "shell-transform",
    };

    function Harness() {
      const [viewport] = React.useState(
        () =>
          ({
            scrollTop,
            clientHeight: viewportHeight,
          }) as HTMLDivElement,
      );
      const result = usePdfPageVirtualization({
        getScrollMetrics: () => ({
          scrollPageOffset: 0,
          scrollTop,
          viewportHeight: viewport.clientHeight,
        }),
        layout,
        transition,
        viewportElement: viewport,
      });

      return (
        <>
          <output data-testid="render">
            {result.renderPageNumbers.join(",")}
          </output>
          <output data-testid="warm">{result.warmPageNumbers.join(",")}</output>
        </>
      );
    }

    render(<Harness />);

    const normalRender = getPdfRenderPageNumbers({
      layout,
      overscanPx: PDF_RENDER_WINDOW_OVERSCAN_PX,
      scrollTop,
      viewportHeight,
    });
    const shellTransactionRender = getPdfRenderPageNumbers({
      layout,
      overscanPx: Math.max(
        PDF_RENDER_WINDOW_OVERSCAN_PX,
        viewportHeight * 2,
        layout.estimatedHeight * 3,
      ),
      scrollTop,
      viewportHeight,
    });

    await waitFor(() =>
      expect(screen.getByTestId("render").textContent).toBe(
        shellTransactionRender.join(","),
      ),
    );
    expect(screen.getByTestId("render").textContent).not.toBe(
      normalRender.join(","),
    );
    expect(screen.getByTestId("warm").textContent).toBe(
      shellTransactionRender.join(","),
    );
  });

  it("keeps the chrome-resize page window mounted briefly after settle", async () => {
    const initialLayout = createPdfPageLayout({
      pageCount: 30,
      defaultPageSize: { width: 100, height: 800 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const nextLayout = createPdfPageLayout({
      pageCount: 30,
      defaultPageSize: { width: 100, height: 1000 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const viewportHeight = 400;
    const initialScrollTop = getPdfPageLayout(initialLayout, 10)!.offsetTop;
    const nextScrollTop = getPdfPageLayout(nextLayout, 10)!.offsetTop;
    const freezeTransition: ViewerDocumentTransition = {
      layoutPolicy: "frozen",
      scrollPolicy: "defer",
      source: "viewer-shell",
      transitionId: "test-chrome-resize",
      visualPolicy: "shell-transform",
    };
    const settleTransition: ViewerDocumentTransition = {
      ...freezeTransition,
      layoutPolicy: "target",
    };

    function Harness({
      isLayoutTransitioning = false,
      layout,
      scrollTop,
      transition,
    }: {
      isLayoutTransitioning?: boolean;
      layout: typeof initialLayout;
      scrollTop: number;
      transition?: ViewerDocumentTransition;
    }) {
      const [viewport] = React.useState(
        () =>
          ({
            scrollTop: 0,
            clientHeight: viewportHeight,
          }) as HTMLDivElement,
      );
      const result = usePdfPageVirtualization({
        getScrollMetrics: () => ({
          scrollPageOffset: 0,
          scrollTop,
          viewportHeight: viewport.clientHeight,
        }),
        isLayoutTransitioning,
        layout,
        transition,
        viewportElement: viewport,
      });

      return (
        <output data-testid="render">
          {result.renderPageNumbers.join(",")}
        </output>
      );
    }

    const view = render(
      <Harness layout={initialLayout} scrollTop={initialScrollTop} />,
    );
    const initialRender = getPdfRenderPageNumbers({
      layout: initialLayout,
      scrollTop: initialScrollTop,
      viewportHeight,
    });
    const nextShellTransactionRender = getPdfRenderPageNumbers({
      layout: nextLayout,
      overscanPx: Math.max(
        PDF_RENDER_WINDOW_OVERSCAN_PX,
        viewportHeight * 2,
        nextLayout.estimatedHeight * 3,
      ),
      scrollTop: nextScrollTop,
      viewportHeight,
    });
    const nextSettledRender = getPdfRenderPageNumbers({
      layout: nextLayout,
      scrollTop: nextScrollTop,
      viewportHeight,
    });
    const retainedRender = mergeExpectedPageNumbers(
      initialRender,
      nextShellTransactionRender,
    );

    await waitFor(() =>
      expect(screen.getByTestId("render").textContent).toBe(
        initialRender.join(","),
      ),
    );

    view.rerender(
      <Harness
        isLayoutTransitioning
        layout={nextLayout}
        scrollTop={nextScrollTop}
        transition={freezeTransition}
      />,
    );
    expect(screen.getByTestId("render").textContent).toBe(
      retainedRender.join(","),
    );

    view.rerender(
      <Harness
        layout={nextLayout}
        scrollTop={nextScrollTop}
        transition={settleTransition}
      />,
    );
    expect(screen.getByTestId("render").textContent).toBe(
      retainedRender.join(","),
    );

    await act(async () => {
      await new Promise((resolve) =>
        setTimeout(resolve, PDF_PAGE_WINDOW_RETENTION_MS + 20),
      );
    });

    expect(screen.getByTestId("render").textContent).toBe(
      nextSettledRender.join(","),
    );
  });

  it("uses logical scroll metrics for the centered render window", async () => {
    const layout = createPdfPageLayout({
      pageCount: 585,
      defaultPageSize: { width: 100, height: 200 },
      pageSizeByNumber: new Map(),
      scale: 1,
      rotation: 0,
    });
    const page400Top = getPdfPageLayout(layout, 400)!.offsetTop;

    function Harness() {
      const [viewport] = React.useState(
        () =>
          ({
            scrollTop: 2_000,
            clientHeight: 200,
          }) as HTMLDivElement,
      );
      const result = usePdfPageVirtualization({
        getScrollMetrics: () => ({
          scrollPageOffset: page400Top - viewport.scrollTop,
          scrollTop: page400Top,
          viewportHeight: viewport.clientHeight,
        }),
        layout,
        viewportElement: viewport,
      });

      return (
        <>
          <output data-testid="offset">{result.scrollPageOffset}</output>
          <output data-testid="render">
            {result.renderPageNumbers.join(",")}
          </output>
        </>
      );
    }

    render(<Harness />);

    await waitFor(() =>
      expect(screen.getByTestId("render").textContent).toBe(
        "395,396,397,398,399,400,401,402,403,404,405",
      ),
    );
    expect(screen.getByTestId("offset").textContent).toBe(
      String(page400Top - 2_000),
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

function mergeExpectedPageNumbers(
  previousPageNumbers: readonly number[],
  currentPageNumbers: readonly number[],
) {
  return Array.from(new Set([...previousPageNumbers, ...currentPageNumbers]))
    .filter((pageNumber) => pageNumber >= 1)
    .sort((a, b) => a - b);
}
