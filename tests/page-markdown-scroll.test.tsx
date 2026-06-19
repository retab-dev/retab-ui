// @vitest-environment jsdom

import * as React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMountEffect } from "@/hooks/use-mount-effect";
import {
  createPageMarkdownLayout,
  getPageMarkdownPageLayout,
  type PageMarkdownLayoutModel,
} from "@/components/viewers/page-markdown/page-markdown-layout";
import { usePageMarkdownScroll } from "@/components/viewers/page-markdown/page-markdown-scroll";

function createLayout(pageCount = 20) {
  return createPageMarkdownLayout({
    measuredHeightByPageNumber: new Map(),
    mode: "rendered",
    pages: Array.from({ length: pageCount }, (_, index) => `# Page ${index}`),
    scale: 1,
  });
}

function createViewport(scrollTop = 0): HTMLDivElement {
  return {
    clientHeight: 200,
    getBoundingClientRect: () => ({ height: 200, top: 0 }) as DOMRect,
    scrollHeight: 5000,
    scrollTo(options?: ScrollToOptions | number, y?: number) {
      this.scrollTop =
        typeof options === "number"
          ? (y ?? options)
          : Number(options?.top ?? 0);
    },
    scrollTop,
  } as HTMLDivElement;
}

describe("usePageMarkdownScroll", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reports the page at the 20% viewport marker and clamps progress", async () => {
    const layout = createLayout();
    const onVisiblePageChange = vi.fn();
    const onScrollProgressChange = vi.fn();

    function Harness() {
      const viewport = React.useMemo(
        () => createViewport(getPageMarkdownPageLayout(layout, 10)!.offsetTop),
        [],
      );
      const result = usePageMarkdownScroll({
        layout,
        onScrollProgressChange,
        onVisiblePageChange,
        pageCount: 20,
      });

      useMountEffect(() => {
        result.setViewportElement(viewport);
        result.measureScroll();
        return () => result.setViewportElement(null);
      });

      return <output data-testid="page">{result.currentPage}</output>;
    }

    render(<Harness />);

    await waitFor(() =>
      expect(screen.getByTestId("page").textContent).toBe("10"),
    );
    expect(onVisiblePageChange).toHaveBeenCalledWith(10);
    expect(onScrollProgressChange).toHaveBeenLastCalledWith(expect.any(Number));
    expect(onScrollProgressChange.mock.lastCall![0]).toBeGreaterThan(0);
    expect(onScrollProgressChange.mock.lastCall![0]).toBeLessThan(1);
  });

  it("scrolls to unmounted pages by layout offset", async () => {
    const layout = createLayout();
    const harnessState = {
      scrollToPage: null as ((pageNumber: number) => void) | null,
      viewport: null as HTMLDivElement | null,
    };

    function Harness() {
      const viewport = React.useMemo(() => createViewport(), []);
      const result = usePageMarkdownScroll({
        layout,
        pageCount: 20,
      });
      harnessState.scrollToPage = result.scrollToPage;
      harnessState.viewport = viewport;

      useMountEffect(() => {
        result.setViewportElement(viewport);
        return () => result.setViewportElement(null);
      });

      return <output data-testid="page">{result.currentPage}</output>;
    }

    render(<Harness />);

    await waitFor(() =>
      expect(harnessState.scrollToPage).toEqual(expect.any(Function)),
    );

    act(() => {
      harnessState.scrollToPage!(15);
    });

    expect(harnessState.viewport!.scrollTop).toBe(
      getPageMarkdownPageLayout(layout, 15)!.offsetTop,
    );
  });

  it("does not expose a stale current page during the reset-key render", async () => {
    const layout = createLayout();

    function Harness({ resetKey }: { resetKey: string }) {
      const viewport = React.useMemo(
        () => createViewport(getPageMarkdownPageLayout(layout, 10)!.offsetTop),
        [],
      );
      const result = usePageMarkdownScroll({
        layout,
        pageCount: 20,
        resetKey,
      });

      useMountEffect(() => {
        result.setViewportElement(viewport);
        result.measureScroll();
        return () => result.setViewportElement(null);
      });

      return <output data-testid="page">{result.currentPage}</output>;
    }

    const view = render(<Harness resetKey="doc-a" />);

    await waitFor(() =>
      expect(screen.getByTestId("page").textContent).toBe("10"),
    );

    view.rerender(<Harness resetKey="doc-b" />);

    expect(screen.getByTestId("page").textContent).toBe("1");
  });

  it("measures synchronously when requestAnimationFrame is unavailable", async () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("cancelAnimationFrame", undefined);
    const layout = createLayout();
    const onVisiblePageChange = vi.fn();
    const harnessState = {
      handleScroll: null as (() => void) | null,
      viewport: null as HTMLDivElement | null,
    };

    function Harness() {
      const viewport = React.useMemo(() => createViewport(), []);
      const result = usePageMarkdownScroll({
        layout,
        onVisiblePageChange,
        pageCount: 20,
      });
      harnessState.handleScroll = result.handleScroll;
      harnessState.viewport = viewport;

      useMountEffect(() => {
        result.setViewportElement(viewport);
        return () => result.setViewportElement(null);
      });

      return <output data-testid="page">{result.currentPage}</output>;
    }

    render(<Harness />);
    await waitFor(() =>
      expect(harnessState.handleScroll).toEqual(expect.any(Function)),
    );

    harnessState.viewport!.scrollTop = getPageMarkdownPageLayout(
      layout,
      12,
    )!.offsetTop;
    act(() => {
      harnessState.handleScroll!();
    });

    expect(onVisiblePageChange).toHaveBeenCalledWith(12);
    expect(screen.getByTestId("page").textContent).toBe("12");
  });
});
