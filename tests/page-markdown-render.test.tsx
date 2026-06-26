// @vitest-environment jsdom

import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMountEffect } from "@/hooks/use-mount-effect";
import {
  createPageMarkdownLayout,
  getPageMarkdownPageLayout,
} from "@/components/viewers/page-markdown/page-markdown-layout";
import {
  PageMarkdownPane,
  type PageMarkdownPaneHandle,
} from "@/components/viewers/page-markdown/page-markdown-pane";
import { PageMarkdownPageFrame } from "@/components/viewers/page-markdown/page-markdown-page-frame";
import {
  PageMarkdownViewer,
  PageMarkdownViewerContent,
  PageMarkdownViewerHeader,
  PageMarkdownViewerProvider,
  usePageMarkdownViewerDocument,
} from "@/components/viewers/page-markdown/page-markdown-viewer";

const PAGES = ["# First page\n\nAlpha", "## Second page\n\nBeta"];
const LARGE_PAGE_COUNT = 1000;
const MAX_VIRTUAL_PAGE_SLOTS = 14;
const PAGE_WIDTH = 768;
const FIT_PADDING = 32;

function rect(top: number, height = 500): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    width: 100,
    height,
    right: 100,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function markdownPageOffset(pages: readonly string[], pageNumber: number) {
  const layout = createPageMarkdownLayout({
    measuredHeightByPageNumber: new Map(),
    mode: "rendered",
    pages,
    scale: 1,
  });
  return getPageMarkdownPageLayout(layout, pageNumber)!.offsetTop;
}

function scrollMarkdownViewportToPage(
  viewport: HTMLElement,
  pages: readonly string[],
  pageNumber: number,
) {
  vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(rect(0, 500));
  viewport.scrollTop = markdownPageOffset(pages, pageNumber);
  fireEvent.scroll(viewport);
}

function pageSlotNumbers(container: ParentNode = document) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      '[data-slot="page-markdown-page-slot"]',
    ),
  ).map((slot) => Number(slot.dataset.pageNumber));
}

function PageMarkdownSyncHarness({
  children,
  onVisiblePageChange,
  pages,
  resetKey,
}: {
  children: React.ReactNode;
  onVisiblePageChange?: (pageNumber: number) => void;
  pages: string[];
  resetKey?: string;
}) {
  return (
    <PageMarkdownViewerProvider
      pages={pages}
      onVisiblePageChange={onVisiblePageChange}
      resetKey={resetKey}
    >
      {children}
      <PageMarkdownViewerHeader />
      <PageMarkdownViewerContent />
    </PageMarkdownViewerProvider>
  );
}

function ReportDocumentPageButton({
  label,
  pageNumber,
}: {
  label: string;
  pageNumber: number;
}) {
  const document = usePageMarkdownViewerDocument();

  return (
    <button
      type="button"
      onClick={() => document.onCurrentPageChange(pageNumber)}
    >
      {label}
    </button>
  );
}

function DocumentScrollSpy({
  onScroll,
}: {
  onScroll: (page: number, options?: ScrollToOptions) => void;
}) {
  const document = usePageMarkdownViewerDocument();

  useMountEffect(() => {
    document.setDocumentHandle({ scrollToPage: onScroll });
    return () => document.setDocumentHandle(null);
  });

  return null;
}

function pageWidth(container: ParentNode = document) {
  const page = container.querySelector<HTMLElement>(
    '[data-slot="page-markdown-page"]',
  );
  return page ? Number.parseFloat(page.style.width) : null;
}

function fitScaleForWidth(width: number) {
  return (width - FIT_PADDING) / PAGE_WIDTH;
}

class TrackingResizeObserver {
  static instances: TrackingResizeObserver[] = [];
  readonly callback: ResizeObserverCallback;
  readonly targets: Element[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    TrackingResizeObserver.instances.push(this);
  }

  observe(target: Element) {
    this.targets.push(target);
  }

  disconnect() {}

  emit(target: Element) {
    this.callback(
      [{ target } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

function installTrackedResizeObserver() {
  TrackingResizeObserver.instances = [];
  vi.stubGlobal("ResizeObserver", TrackingResizeObserver);
  return TrackingResizeObserver;
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class MockIntersectionObserver {
      private callback: IntersectionObserverCallback;

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element) {
        this.callback(
          [
            {
              target,
              isIntersecting: true,
              intersectionRatio: 1,
              boundingClientRect: target.getBoundingClientRect(),
              intersectionRect: target.getBoundingClientRect(),
              rootBounds: null,
              time: 0,
            } as IntersectionObserverEntry,
          ],
          this as unknown as IntersectionObserver,
        );
      }

      disconnect() {}
      takeRecords() {
        return [];
      }
      unobserve() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 800,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => 0,
  });
  HTMLElement.prototype.getAnimations = vi.fn(() => []);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(function (
      this: HTMLElement,
      options?: ScrollToOptions | number,
      y?: number,
    ) {
      this.scrollTop =
        typeof options === "number"
          ? (y ?? options)
          : Number(options?.top ?? 0);
    }),
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PageMarkdownViewer", () => {
  it("forwards scroll options through the markdown pane handle", () => {
    const ref = React.createRef<PageMarkdownPaneHandle>();
    const onVisiblePageChange = vi.fn();

    render(
      <PageMarkdownPane
        ref={ref}
        pages={PAGES}
        text={PAGES.join("\n\n")}
        mode="rendered"
        scale={1}
        isScaleReady
        onContainerWidthChange={vi.fn()}
        onVisiblePageChange={onVisiblePageChange}
      />,
    );

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    expect(viewport).toBeTruthy();
    const scrollTo = vi.fn();
    Object.defineProperty(viewport!, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });

    act(() => {
      ref.current?.scrollToPage(2, { behavior: "auto" });
    });

    expect(scrollTo).toHaveBeenCalledWith({
      top: markdownPageOffset(PAGES, 2),
      behavior: "auto",
    });
  });

  it("renders the standard page controls and markdown actions", async () => {
    render(<PageMarkdownViewer pages={PAGES} />);

    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Rendered" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Text" })).toBeTruthy();
    expect(screen.getByLabelText("Zoom out")).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByLabelText("Zoom in")).toBeTruthy();
    expect(screen.getByLabelText("Fit width")).toBeTruthy();
    expect(screen.getByLabelText("Copy markdown")).toBeTruthy();
    expect(screen.getByLabelText("Download markdown")).toBeTruthy();
    expect(await screen.findByText("First page")).toBeTruthy();
  });

  it("renders markdown pages when IntersectionObserver is unavailable", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);

    render(<PageMarkdownViewer pages={PAGES} />);

    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    expect(await screen.findByText("First page")).toBeTruthy();
    expect(await screen.findByText("Second page")).toBeTruthy();
  });

  it("renders markdown pages when ResizeObserver is unavailable", async () => {
    vi.stubGlobal("ResizeObserver", undefined);

    render(<PageMarkdownViewer pages={PAGES} />);

    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    expect(await screen.findByText("First page")).toBeTruthy();
    expect(await screen.findByText("Second page")).toBeTruthy();
  });

  it("reports page size after async rendered projection resolves without ResizeObserver", async () => {
    vi.stubGlobal("ResizeObserver", undefined);
    vi.stubGlobal("Worker", undefined);
    const onSize = vi.fn();
    let measuredPageHeight = 600;
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return (this as HTMLElement).dataset.slot === "page-markdown-page"
          ? measuredPageHeight
          : 0;
      },
    });

    render(
      <PageMarkdownPageFrame
        estimatedHeight={600}
        markdown={["# Async measured page", "", "Body"].join("\n")}
        mode="rendered"
        onSize={onSize}
        pageNumber={1}
        scale={1}
      />,
    );

    expect(onSize).toHaveBeenCalledWith(1, 600);
    measuredPageHeight = 1200;
    expect(
      await screen.findByRole("heading", { name: "Async measured page" }),
    ).toBeTruthy();

    await waitFor(() => {
      expect(onSize).toHaveBeenCalledWith(1, 1200);
    });
  });

  it("handles ResizeObserver callbacks when requestAnimationFrame is unavailable", async () => {
    const resizeCallbacks: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          resizeCallbacks.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("cancelAnimationFrame", undefined);

    render(<PageMarkdownViewer pages={PAGES} />);
    await screen.findByText("First page");

    const target = document.createElement("div");
    Object.defineProperty(target, "clientWidth", {
      configurable: true,
      value: 640,
    });

    expect(() => {
      act(() => {
        for (const callback of resizeCallbacks) {
          callback(
            [{ target } as unknown as ResizeObserverEntry],
            {} as ResizeObserver,
          );
        }
      });
    }).not.toThrow();
  });

  it("moves secondary actions into a menu when the controls is narrow", () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 400,
    });

    render(<PageMarkdownViewer pages={PAGES} />);

    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Rendered" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Text" })).toBeTruthy();
    expect(screen.getByLabelText("More markdown actions")).toBeTruthy();
    expect(screen.queryByLabelText("Copy markdown")).toBeNull();
    expect(screen.queryByLabelText("Download markdown")).toBeNull();
  });

  it("copies markdown from the compact actions menu", async () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 400,
    });
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<PageMarkdownViewer pages={PAGES} text="compact markdown" />);

    const copyTrigger = screen.getByLabelText("More markdown actions");
    fireEvent.pointerDown(copyTrigger, { button: 0 });
    fireEvent.pointerUp(copyTrigger, { button: 0 });
    fireEvent.click(await screen.findByText("Copy markdown"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("compact markdown");
    });
  });

  it("downloads markdown from the compact actions menu", async () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 400,
    });
    const createObjectURL = vi.fn(() => "blob:compact-markdown-download");
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });

    render(
      <PageMarkdownViewer
        pages={PAGES}
        text="compact download"
        fileName="compact.md"
      />,
    );

    const downloadTrigger = screen.getByLabelText("More markdown actions");
    fireEvent.pointerDown(downloadTrigger, { button: 0 });
    fireEvent.pointerUp(downloadTrigger, { button: 0 });
    fireEvent.click(await screen.findByText("Download markdown"));

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(click).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith(
        "blob:compact-markdown-download",
      );
    });
  });

  it("switches from rendered markdown to page text", async () => {
    const { container } = render(<PageMarkdownViewer pages={PAGES} />);

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Text" }));

    await waitFor(() => {
      expect(
        Array.from(container.querySelectorAll("pre")).some(
          (pre) => pre.textContent === "# First page\n\nAlpha",
        ),
      ).toBe(true);
    });
  });

  it("renders common GFM document structures", async () => {
    const { container } = render(
      <PageMarkdownViewer
        pages={[
          [
            "# Statement",
            "",
            "> Verified balance",
            "",
            "- [x] Reviewed",
            "- [ ] Needs approval",
            "",
            "| Item | Amount |",
            "| --- | ---: |",
            "| Cash | $10.00 |",
            "",
            "```ts",
            "const total = 10",
            "```",
          ].join("\n"),
        ]}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Statement" }),
    ).toBeTruthy();
    expect(screen.getByText("Verified balance")).toBeTruthy();
    expect(screen.getByText("Reviewed")).toBeTruthy();
    expect(screen.getByText("Needs approval")).toBeTruthy();
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(
      2,
    );
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Amount" })).toBeTruthy();
    expect(screen.getByText("$10.00")).toBeTruthy();
    expect(screen.getByText("const total = 10")).toBeTruthy();
  });

  it("does not leak react-markdown AST node props into the DOM", async () => {
    const { container } = render(
      <PageMarkdownViewer
        pages={[
          [
            "# Heading",
            "",
            "Paragraph with [a link](https://retab.com).",
            "",
            "| A | B |",
            "| --- | --- |",
            "| 1 | 2 |",
          ].join("\n"),
        ]}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Heading" }),
    ).toBeTruthy();
    expect(container.querySelector("[node]")).toBeNull();
  });

  it("does not turn raw HTML in markdown into live DOM", async () => {
    const { container } = render(
      <PageMarkdownViewer
        pages={[
          [
            "# Unsafe",
            "",
            '<script data-testid="script-tag">window.__xss = true</script>',
            '<img src="x" onerror="window.__xss = true" data-testid="raw-image" />',
            '<div data-testid="raw-html">raw html</div>',
          ].join("\n"),
        ]}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Unsafe" })).toBeTruthy();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    expect(screen.queryByTestId("raw-html")).toBeNull();
    expect(container.textContent).toContain('<div data-testid="raw-html">');
  });

  it("hardens markdown links while leaving unsafe URL protocols inert", async () => {
    render(
      <PageMarkdownViewer
        pages={[
          [
            "[Retab](https://retab.com)",
            "[Relative](/docs)",
            "[Unsafe](javascript:alert('xss'))",
            "[Uppercase](JaVaScRiPt:alert('xss'))",
            "[Data](data:text/html,<script>alert('xss')</script>)",
          ].join(" "),
        ]}
      />,
    );

    const link = await screen.findByRole("link", { name: "Retab" });
    expect(link.getAttribute("href")).toBe("https://retab.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");

    const relative = screen.getByRole("link", { name: "Relative" });
    expect(relative.getAttribute("href")).toBe("/docs");
    expect(relative.getAttribute("target")).toBe("_blank");
    expect(relative.getAttribute("rel")).toBe("noopener noreferrer");

    expect(screen.getByText("Unsafe").closest("a")).toBeNull();
    expect(screen.getByText("Uppercase").closest("a")).toBeNull();
    expect(screen.getByText("Data").closest("a")).toBeNull();
  });

  it("renders safe markdown images without activating unsafe image protocols", async () => {
    const { container } = render(
      <PageMarkdownViewer
        pages={[
          [
            "![Safe](https://example.com/logo.png)",
            "![Unsafe](javascript:alert('xss'))",
          ].join("\n\n"),
        ]}
      />,
    );

    const safeImage = (await screen.findByAltText("Safe")) as HTMLImageElement;
    expect(safeImage.getAttribute("src")).toBe("https://example.com/logo.png");

    expect(container.querySelector('img[alt="Unsafe"]')).toBeNull();
    expect(screen.getByText("Unsafe")).toBeTruthy();
  });

  it("uses explicit download text instead of deriving it from visible pages", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <PageMarkdownViewer
        pages={PAGES}
        text="joined markdown from api"
        fileName="parsed.md"
      />,
    );

    fireEvent.click(screen.getByLabelText("Copy markdown"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("joined markdown from api");
    });
  });

  it("shows copy failure when clipboard writing is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {},
    });

    render(<PageMarkdownViewer pages={PAGES} />);

    fireEvent.click(screen.getByLabelText("Copy markdown"));

    await waitFor(() => {
      expect(screen.getByLabelText("Copy failed")).toBeTruthy();
    });
  });

  it("shows copy failure when clipboard writing throws synchronously", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(() => {
          throw new Error("clipboard blocked");
        }),
      },
    });

    render(<PageMarkdownViewer pages={PAGES} />);

    fireEvent.click(screen.getByLabelText("Copy markdown"));

    await waitFor(() => {
      expect(screen.getByLabelText("Copy failed")).toBeTruthy();
    });
  });

  it("shows copy failure when clipboard access throws", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      get() {
        throw new Error("clipboard getter blocked");
      },
    });

    render(<PageMarkdownViewer pages={PAGES} />);

    expect(() =>
      fireEvent.click(screen.getByLabelText("Copy markdown")),
    ).not.toThrow();

    await waitFor(() => {
      expect(screen.getByLabelText("Copy failed")).toBeTruthy();
    });
  });

  it("does not schedule copy status work after unmount", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    let resolveCopy!: () => void;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCopy = resolve;
        }),
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const { unmount } = render(<PageMarkdownViewer pages={PAGES} />);

    fireEvent.click(screen.getByLabelText("Copy markdown"));
    unmount();

    await act(async () => {
      resolveCopy();
    });

    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores stale clipboard results from earlier copy attempts", async () => {
    let rejectFirst!: () => void;
    let resolveSecond!: () => void;
    const writeText = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectFirst = () => reject(new Error("first copy failed late"));
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveSecond = resolve;
          }),
      );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<PageMarkdownViewer pages={PAGES} />);

    fireEvent.click(screen.getByLabelText("Copy markdown"));
    fireEvent.click(screen.getByLabelText("Copy markdown"));

    await act(async () => {
      resolveSecond();
    });
    await act(async () => {
      rejectFirst();
    });

    expect(screen.queryByLabelText("Copy failed")).toBeNull();
  });

  it("downloads markdown with the provided file name and revokes the object URL", async () => {
    const createObjectURL = vi.fn(() => "blob:markdown-download");
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });

    render(
      <PageMarkdownViewer
        pages={PAGES}
        text="download markdown"
        fileName="parsed.md"
      />,
    );

    fireEvent.click(screen.getByLabelText("Download markdown"));

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(click).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:markdown-download");
    });
    expect(document.querySelector('a[download="parsed.md"]')).toBeNull();
  });

  it("normalizes non-markdown file names when downloading from the viewer", async () => {
    let downloadedName: string | undefined;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:renamed-markdown-download"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedName = this.download;
    });

    render(
      <PageMarkdownViewer
        pages={PAGES}
        text="download markdown"
        fileName="report.pdf"
      />,
    );

    fireEvent.click(screen.getByLabelText("Download markdown"));

    await waitFor(() => {
      expect(downloadedName).toBe("report.md");
    });
  });

  it("zooms manually and returns to fit-width scale", () => {
    render(<PageMarkdownViewer pages={PAGES} />);

    expect(screen.getByText("100%")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(screen.getByText("120%")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Zoom out"));
    expect(screen.getByText("100%")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(screen.getByText("120%")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Fit width"));
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("mounts pages at fitted scale without a 100% intermediate canvas", async () => {
    installTrackedResizeObserver();
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 638,
    });

    const { container } = render(<PageMarkdownViewer pages={PAGES} />);

    expect(await screen.findByText("Page 1 of 2")).toBeTruthy();
    expect(screen.getByText("79%")).toBeTruthy();
    expect(screen.queryByText("100%")).toBeNull();
    expect(pageWidth(container)).toBeCloseTo(
      PAGE_WIDTH * fitScaleForWidth(638),
      1,
    );
  });

  it("waits for a stable viewport width before mounting pages", async () => {
    installTrackedResizeObserver();
    const frameCallbacks: FrameRequestCallback[] = [];
    let measuredWidth = 760;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => measuredWidth,
    });

    const { container } = render(<PageMarkdownViewer pages={PAGES} />);

    expect(pageWidth(container)).toBeNull();

    act(() => {
      frameCallbacks.shift()?.(0);
    });
    measuredWidth = 638;
    act(() => {
      frameCallbacks.shift()?.(16);
    });

    expect(screen.queryByText("95%")).toBeNull();
    expect(pageWidth(container)).toBeNull();

    act(() => {
      frameCallbacks.shift()?.(32);
    });

    await waitFor(() => {
      expect(pageWidth(container)).toBeCloseTo(
        PAGE_WIDTH * fitScaleForWidth(638),
        1,
      );
    });
  });

  it("observes a stable viewport-width wrapper instead of the scaled canvas", async () => {
    const ResizeObserverMock = installTrackedResizeObserver();
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 638,
    });

    const { container } = render(<PageMarkdownViewer pages={PAGES} />);

    expect(await screen.findByText("First page")).toBeTruthy();
    const observedTargets = ResizeObserverMock.instances.flatMap(
      (observer) => observer.targets,
    );
    const pageCanvas = container.querySelector<HTMLElement>(
      '[data-slot="page-markdown-page-slot"]',
    )?.parentElement;
    expect(pageCanvas).toBeTruthy();
    expect(observedTargets).not.toContain(pageCanvas);
    expect(
      observedTargets.some((target) => {
        const element = target as HTMLElement;
        return (
          element.getAttribute("class") === "w-full min-w-0" &&
          Boolean(
            element.querySelector('[data-slot="page-markdown-page-slot"]'),
          )
        );
      }),
    ).toBe(true);
  });

  it("keeps fit scale stable when page height measurements arrive", async () => {
    const ResizeObserverMock = installTrackedResizeObserver();
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 638,
    });
    let measuredPageHeight = 900;
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return (this as HTMLElement).dataset.slot === "page-markdown-page"
          ? measuredPageHeight
          : 0;
      },
    });

    const { container } = render(<PageMarkdownViewer pages={PAGES} />);

    expect(await screen.findByText("79%")).toBeTruthy();
    const initialPageWidth = pageWidth(container);
    expect(initialPageWidth).toBeCloseTo(PAGE_WIDTH * fitScaleForWidth(638), 1);

    const pageElement = container.querySelector<HTMLElement>(
      '[data-slot="page-markdown-page"]',
    );
    expect(pageElement).toBeTruthy();
    const pageObserver = ResizeObserverMock.instances.find((observer) =>
      observer.targets.includes(pageElement!),
    );
    expect(pageObserver).toBeTruthy();

    measuredPageHeight = 1800;
    act(() => {
      pageObserver!.emit(pageElement!);
    });

    expect(screen.getByText("79%")).toBeTruthy();
    expect(pageWidth(container)).toBe(initialPageWidth);
  });

  it("updates fit scale from the stable width observer when the viewport resizes", async () => {
    const ResizeObserverMock = installTrackedResizeObserver();
    const measuredWidths = new WeakMap<Element, number>();
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return measuredWidths.get(this) ?? 638;
      },
    });

    const { container } = render(<PageMarkdownViewer pages={PAGES} />);

    expect(await screen.findByText("79%")).toBeTruthy();
    const widthTarget = ResizeObserverMock.instances
      .flatMap((observer) => observer.targets)
      .find((target) => {
        const element = target as HTMLElement;
        return (
          element.getAttribute("class") === "w-full min-w-0" &&
          Boolean(
            element.querySelector('[data-slot="page-markdown-page-slot"]'),
          )
        );
      });
    expect(widthTarget).toBeTruthy();

    measuredWidths.set(widthTarget!, 720);
    const widthObserver = ResizeObserverMock.instances.find((observer) =>
      observer.targets.includes(widthTarget!),
    );
    expect(widthObserver).toBeTruthy();
    act(() => {
      widthObserver!.emit(widthTarget!);
    });

    expect(screen.getByText("90%")).toBeTruthy();
    expect(pageWidth(container)).toBeCloseTo(
      PAGE_WIDTH * fitScaleForWidth(720),
      1,
    );
  });

  it("scrolls the markdown pane when the document pane reports a new page", async () => {
    render(
      <PageMarkdownSyncHarness pages={PAGES}>
        <ReportDocumentPageButton label="Show document page 2" pageNumber={2} />
      </PageMarkdownSyncHarness>,
    );

    await screen.findByText("Second page");
    const markdownViewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    expect(markdownViewport).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Show document page 2" }),
    );

    await waitFor(() => {
      expect(markdownViewport!.scrollTop).toBe(markdownPageOffset(PAGES, 2));
    });
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
  });

  it("does not publish stale markdown page reports while document sync is pending", async () => {
    const onVisiblePageChange = vi.fn();
    const pages = [...PAGES, "## Third page\n\nGamma"];

    render(
      <PageMarkdownSyncHarness
        pages={pages}
        onVisiblePageChange={onVisiblePageChange}
      >
        <ReportDocumentPageButton label="Show document page 2" pageNumber={2} />
      </PageMarkdownSyncHarness>,
    );

    await screen.findByText("Second page");
    fireEvent.click(
      screen.getByRole("button", { name: "Show document page 2" }),
    );

    const markdownViewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    expect(markdownViewport).toBeTruthy();
    scrollMarkdownViewportToPage(markdownViewport!, pages, 2);

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 3")).toBeTruthy();
    });
    expect(onVisiblePageChange).not.toHaveBeenCalled();
  });

  it("scrolls the document pane when the visible markdown page changes", async () => {
    const onDocumentScroll = vi.fn();
    const onVisiblePageChange = vi.fn();

    render(
      <PageMarkdownSyncHarness
        pages={PAGES}
        onVisiblePageChange={onVisiblePageChange}
      >
        <DocumentScrollSpy onScroll={onDocumentScroll} />
      </PageMarkdownSyncHarness>,
    );

    await screen.findByText("Second page");

    const markdownViewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    expect(markdownViewport).toBeTruthy();
    scrollMarkdownViewportToPage(markdownViewport!, PAGES, 2);

    await waitFor(() => {
      expect(onVisiblePageChange).toHaveBeenCalledWith(2);
      expect(onDocumentScroll).toHaveBeenCalledWith(2);
    });
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
  });

  it("reports visible markdown page changes when requestAnimationFrame is unavailable", async () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("cancelAnimationFrame", undefined);
    const onVisiblePageChange = vi.fn();

    render(
      <PageMarkdownViewer
        pages={PAGES}
        onVisiblePageChange={onVisiblePageChange}
      />,
    );

    await screen.findByText("Second page");

    const markdownViewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    expect(markdownViewport).toBeTruthy();
    expect(() =>
      scrollMarkdownViewportToPage(markdownViewport!, PAGES, 2),
    ).not.toThrow();
    expect(onVisiblePageChange).toHaveBeenCalledWith(2);
  });

  it("keeps a 1,000-page document bounded to the virtual page window", async () => {
    const pages = Array.from(
      { length: LARGE_PAGE_COUNT },
      (_, index) => `# Page ${index + 1}\n\n${"content ".repeat(12)}`,
    );
    const { container } = render(<PageMarkdownViewer pages={pages} />);

    await waitFor(() => {
      const pageNumbers = pageSlotNumbers(container);
      expect(pageNumbers.length).toBeGreaterThan(0);
      expect(pageNumbers.length).toBeLessThanOrEqual(MAX_VIRTUAL_PAGE_SLOTS);
      expect(pageNumbers[0]).toBe(1);
    });

    const markdownViewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    expect(markdownViewport).toBeTruthy();

    scrollMarkdownViewportToPage(markdownViewport!, pages, 500);

    await waitFor(() => {
      const pageNumbers = pageSlotNumbers(container);
      expect(pageNumbers).toContain(500);
      expect(pageNumbers.length).toBeLessThanOrEqual(MAX_VIRTUAL_PAGE_SLOTS);
      expect(screen.getByText("Page 500 of 1000")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Text" }));
    await waitFor(() => {
      expect(pageSlotNumbers(container).length).toBeLessThanOrEqual(
        MAX_VIRTUAL_PAGE_SLOTS,
      );
    });

    fireEvent.click(screen.getByLabelText("Zoom in"));
    await waitFor(() => {
      expect(pageSlotNumbers(container).length).toBeLessThanOrEqual(
        MAX_VIRTUAL_PAGE_SLOTS,
      );
      expect(screen.queryByText("Page 500 of 1000")).toBeTruthy();
    });
  });

  it("clamps the current page when the page list shrinks", async () => {
    const pages = [...PAGES, "## Third page\n\nGamma"];
    const { rerender } = render(
      <PageMarkdownSyncHarness pages={pages}>
        <ReportDocumentPageButton label="Show document page 3" pageNumber={3} />
      </PageMarkdownSyncHarness>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Show document page 3" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Page 3 of 3")).toBeTruthy();
    });

    rerender(
      <PageMarkdownSyncHarness pages={PAGES}>
        <ReportDocumentPageButton label="Show document page 2" pageNumber={2} />
      </PageMarkdownSyncHarness>,
    );

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    });
    expect(screen.queryByText("Page 3 of 2")).toBeNull();
  });

  it("resets view mode and manual zoom when the reset key changes", async () => {
    const { rerender } = render(
      <PageMarkdownViewer pages={PAGES} resetKey="document-one" />,
    );

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Text" }));
    fireEvent.click(screen.getByLabelText("Zoom in"));

    await waitFor(() => {
      expect(
        Array.from(document.querySelectorAll("pre")).some((pre) =>
          pre.textContent?.includes("# First page"),
        ),
      ).toBe(true);
      expect(screen.getByText("120%")).toBeTruthy();
    });

    rerender(
      <PageMarkdownViewer
        pages={["# Replacement page\n\nGamma"]}
        resetKey="document-two"
      />,
    );

    await waitFor(() => {
      expect(
        screen
          .getByRole("tab", { name: "Rendered" })
          .getAttribute("aria-selected"),
      ).toBe("true");
      expect(screen.getByText("100%")).toBeTruthy();
    });
    expect(await screen.findByText("Replacement page")).toBeTruthy();
  });

  it("shows a generic page-by-page empty state", () => {
    render(<PageMarkdownViewer pages={[]} />);

    expect(screen.getByText("No markdown pages yet")).toBeTruthy();
    expect(
      screen.getByText(
        "Provide page-by-page markdown to see the rendered document here.",
      ),
    ).toBeTruthy();
  });

  it("uses generic processing copy by default", () => {
    render(<PageMarkdownViewer pages={[]} isProcessing />);

    expect(screen.getByText("Preparing document...")).toBeTruthy();
  });
});
