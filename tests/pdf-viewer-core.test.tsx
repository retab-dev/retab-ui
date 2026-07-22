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
  getPdfDocumentResource,
  getPdfPageResource,
  resetPdfDocumentResourceCacheForTests,
} from "@/lib/pdf-document-resource";
import {
  blobSource,
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource";
import {
  FileViewerContent,
  FileViewerHeader,
  FileViewerSidebar,
  FileViewerSidebarTrigger,
  FileViewerInset,
  FileViewerViewport,
} from "@/registry/new-york-v4/ui/file-viewer";
import {
  FileViewerControls,
  FileViewerHarness as FileViewer,
  FileViewerTitle,
} from "./file-viewer-test-harness";
import {
  buildPdfThumbnailLayout,
  getPdfThumbnailLayoutItem,
  getPdfThumbnailPixelWindow,
  getPdfThumbnailRenderedWindow,
  getVisiblePdfThumbnailItems,
  PDF_THUMBNAIL_LABEL_AND_GAP_HEIGHT,
} from "@/registry/new-york-v4/ui/pdf-thumbnail-layout";
import {
  PdfHighlight,
  PdfResourceContent,
  PdfViewer,
  PdfViewerPages,
  PdfViewerProvider,
  type PdfViewerHandle,
} from "@/registry/new-york-v4/ui/pdf-viewer";
import {
  createPdfPageLayout,
  getPdfPageLayout,
} from "@/registry/new-york-v4/ui/pdf-viewer-layout";
import { PdfPage } from "@/registry/new-york-v4/ui/pdf-viewer-page";
import { PdfViewerFallback } from "@/registry/new-york-v4/ui/pdf-viewer-states";
import {
  PdfThumbnailRail,
  PdfViewerThumbnails,
} from "@/registry/new-york-v4/ui/pdf-viewer-thumbnails";
import {
  PDF_PAGE_METRIC_CONCURRENCY,
  usePdfPageMetrics,
} from "@/registry/new-york-v4/ui/use-pdf-page-metrics";
import {
  PDF_THUMBNAIL_PAGE_METRIC_CONCURRENCY,
  usePdfThumbnailPageMetrics,
} from "@/registry/new-york-v4/ui/use-pdf-thumbnail-page-metrics";
import {
  ViewerBody,
  ViewerRoot,
  ViewerSidebar,
} from "@/registry/new-york-v4/ui/viewer";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

const pdfjsMock = vi.hoisted(() => {
  type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
  };
  const deferred = <T,>(): Deferred<T> => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  return {
    docs: new Map<string, unknown>(),
    pending: new Map<string, Deferred<unknown>>(),
    renderTasks: [] as Array<{ cancel: ReturnType<typeof vi.fn> }>,
    deferred,
    getDocument: vi.fn(),
    GlobalWorkerOptions: {} as { workerSrc?: string },
  };
});

vi.mock("pdfjs-dist", () => pdfjsMock);
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => pdfjsMock);

type MockPage = {
  rotate: number;
  getViewport: (options: { scale: number; rotation?: number }) => {
    width: number;
    height: number;
  };
  render: ReturnType<typeof vi.fn>;
};

function makePage(width: number, height: number, rotate = 0): MockPage {
  return {
    rotate,
    getViewport: ({ scale, rotation = rotate }) => {
      const rotated = rotation % 180 !== 0;
      return {
        width: (rotated ? height : width) * scale,
        height: (rotated ? width : height) * scale,
      };
    },
    render: vi.fn(() => {
      const task = {
        promise: new Promise<void>(() => {}),
        cancel: vi.fn(),
      };
      pdfjsMock.renderTasks.push(task);
      return task;
    }),
  };
}

function makeDoc(pageSizes: Array<[number, number]>) {
  const pages = pageSizes.map(([width, height]) => makePage(width, height));
  return {
    numPages: pages.length,
    pages,
    getPage: vi.fn((pageNumber: number) =>
      Promise.resolve(pages[pageNumber - 1]),
    ),
    destroy: vi.fn(() => Promise.resolve()),
  };
}

function findByTextContent(text: string) {
  return screen.findByText((_, element) => element?.textContent === text);
}

function getExpectedPreservedPdfScrollTop({
  pageCount,
  pageNumber,
  pageSize,
  previousScale,
  nextScale,
  scrollTop,
  viewportHeight,
  // 0.2 mirrors capturePdfReadingAnchor (re-fits, resizes); 0.5 mirrors
  // capturePdfZoomTransaction (toolbar zoom steps anchor the viewport
  // center on both axes).
  markerRatio = 0.2,
}: {
  pageCount: number;
  pageNumber: number;
  pageSize: { width: number; height: number };
  previousScale: number;
  nextScale: number;
  scrollTop: number;
  viewportHeight: number;
  markerRatio?: number;
}) {
  const previousLayout = createPdfPageLayout({
    pageCount,
    defaultPageSize: pageSize,
    pageSizeByNumber: new Map(),
    scale: previousScale,
    rotation: 0,
  });
  const nextLayout = createPdfPageLayout({
    pageCount,
    defaultPageSize: pageSize,
    pageSizeByNumber: new Map(),
    scale: nextScale,
    rotation: 0,
  });
  const previousPage = getPdfPageLayout(previousLayout, pageNumber);
  const nextPage = getPdfPageLayout(nextLayout, pageNumber);
  if (!previousPage || !nextPage) {
    throw new Error("Expected test page layout to exist.");
  }

  const readingMarkerOffset = viewportHeight * markerRatio;

  // The marker's page-relative fraction is the sole anchor identity —
  // scale-invariant, so it survives re-fits and zoom steps alike.
  const pageAnchorRatio =
    (scrollTop + readingMarkerOffset - previousPage.offsetTop) /
    previousPage.height;

  return (
    nextPage.offsetTop + nextPage.height * pageAnchorRatio - readingMarkerOffset
  );
}

function stubElementScrollTo() {
  const scrollTo = vi.fn();
  const original = HTMLElement.prototype.scrollTo;
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollTo,
  });

  return {
    scrollTo,
    restore: () => {
      if (original) {
        Object.defineProperty(HTMLElement.prototype, "scrollTo", {
          configurable: true,
          value: original,
        });
      } else {
        delete (HTMLElement.prototype as unknown as Record<string, unknown>)
          .scrollTo;
      }
    },
  };
}

class ResizeObserverMock {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    this.callback([{ target } as ResizeObserverEntry], this as never);
  }
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverMock {
  private callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    this.callback(
      [{ target, isIntersecting: true } as IntersectionObserverEntry],
      this as never,
    );
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.useRealTimers();
  pdfjsMock.docs.clear();
  pdfjsMock.pending.clear();
  pdfjsMock.renderTasks.length = 0;
  pdfjsMock.getDocument.mockImplementation(
    (src: string | { data: Uint8Array }) => {
      const key =
        typeof src === "string"
          ? src
          : `data:${Array.from(src.data).join(",")}`;
      if (pdfjsMock.docs.has(key)) {
        const value = pdfjsMock.docs.get(key);
        return {
          promise:
            value instanceof Error
              ? Promise.reject(value)
              : Promise.resolve(value),
        };
      }
      let pending = pdfjsMock.pending.get(key);
      if (!pending) {
        pending = pdfjsMock.deferred();
        pdfjsMock.pending.set(key, pending);
      }
      return {
        promise: pending.promise,
      };
    },
  );
  pdfjsMock.GlobalWorkerOptions.workerSrc = undefined;
  resetPdfDocumentResourceCacheForTests();

  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    {} as never,
  );
  const animationFrames = new Map<number, ReturnType<typeof setTimeout>>();
  let animationFrameId = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++animationFrameId;
    const timeout = setTimeout(() => {
      animationFrames.delete(id);
      callback(performance.now());
    }, 0);
    animationFrames.set(id, timeout);
    return id;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    const timeout = animationFrames.get(id);
    if (timeout) {
      clearTimeout(timeout);
      animationFrames.delete(id);
    }
  });
  Element.prototype.getAnimations = vi.fn(() => []);

  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return 832;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      return 600;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      return 1800;
    },
  });
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.dataset.slot === "scroll-area-viewport") {
      return { top: 0, height: 600 } as DOMRect;
    }
    if (this.dataset.pageNumber) {
      return {
        top: (Number(this.dataset.pageNumber) - 1) * 1000,
        height: 1000,
      } as DOMRect;
    }
    return { top: 0, height: 0 } as DOMRect;
  };
});

afterEach(() => {
  cleanup();
  resetPdfDocumentResourceCacheForTests();
  clearViewerResourceRegistryForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  (globalThis as { gc?: () => void }).gc?.();
});

function pdfUrlSource(url: string, fileName?: string) {
  return { kind: "url" as const, url, fileName };
}

function pdfUrlContent(url: string, fileName?: string) {
  return createViewerResource(pdfUrlSource(url, fileName)).content;
}

function pdfUrlResource(url: string, fileName?: string) {
  return createViewerResource(pdfUrlSource(url, fileName));
}

type PdfMetricDocument = Parameters<typeof usePdfThumbnailPageMetrics>[0];
type PdfPageMetricDocument = Parameters<typeof usePdfPageMetrics>[0];

class TestMetricErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: unknown }
> {
  state = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    if (this.state.error) return <div role="alert">metric failed</div>;
    return this.props.children;
  }
}

describe("PdfViewer core", () => {
  it("uses known page geometry for the loading skeleton", () => {
    render(
      <PdfViewerFallback
        controls={false}
        fallbackPageSize={{ width: 1275, height: 1804 }}
      />,
    );

    expect(
      document.querySelector<HTMLElement>('[data-slot="pdf-page-skeleton"]')
        ?.style.aspectRatio,
    ).toBe("1275 / 1804");
  });

  it("lets FileViewerHeader children replace default file header parts", () => {
    const source = pdfUrlSource("/custom-header.pdf", "default-label.pdf");

    render(
      <FileViewer source={source}>
        <FileViewerHeader>
          <span>Custom PDF header</span>
        </FileViewerHeader>
      </FileViewer>,
    );

    expect(screen.getByText("Custom PDF header")).toBeTruthy();
    expect(screen.queryByText("default-label.pdf")).toBeNull();
  });

  it("releases the PDF paint clip while the sidebar counter-transform is active", async () => {
    pdfjsMock.docs.set("/sidebar-motion-clip.pdf", makeDoc([[100, 200]]));

    render(
      <FileViewer
        source={pdfUrlSource("/sidebar-motion-clip.pdf")}
        defaultOpen={false}
        inlineBreakpoint={640}
      >
        <PdfViewerProvider>
          <FileViewerHeader>
            <FileViewerSidebarTrigger />
          </FileViewerHeader>
          <FileViewerContent>
            <FileViewerSidebar width="128px" />
            <FileViewerInset align="center">
              <FileViewerViewport>
                <PdfViewerPages bare />
              </FileViewerViewport>
            </FileViewerInset>
          </FileViewerContent>
        </PdfViewerProvider>
      </FileViewer>,
    );

    const visualClip = await waitFor(() => {
      const element = document.querySelector<HTMLElement>(
        '[data-slot="pdf-viewer-visual-clip"]',
      );
      expect(element).toBeTruthy();
      return element!;
    });
    expect(visualClip.style.contain).toBe("paint style");
    expect(visualClip.style.overflow).toBe("clip");

    fireEvent.click(screen.getByLabelText("Toggle sidebar"));

    expect(visualClip.getAttribute("data-layout-transitioning")).toBe("");
    expect(visualClip.style.contain).toBe("style");
    expect(visualClip.style.overflow).toBe("visible");
  });

  it("builds page-size-aware thumbnail layout with deterministic fallbacks", () => {
    const layout = buildPdfThumbnailLayout({
      pageCount: 3,
      width: 50,
      metricByPageNumber: new Map([
        [2, { pageNumber: 2, width: 100, height: 300 }],
      ]),
    });

    expect(layout.totalHeight).toBe(
      89 + 150 + PDF_THUMBNAIL_LABEL_AND_GAP_HEIGHT + 89,
    );
    expect(getPdfThumbnailLayoutItem(layout, 1)).toMatchObject({
      pageNumber: 1,
      pageIndex: 0,
      top: 0,
      height: 89,
      imageWidth: 50,
    });
    expect(getPdfThumbnailLayoutItem(layout, 2)).toMatchObject({
      pageNumber: 2,
      pageIndex: 1,
      top: 89,
      height: 150 + PDF_THUMBNAIL_LABEL_AND_GAP_HEIGHT,
      imageHeight: 150,
    });
    expect(getPdfThumbnailLayoutItem(layout, 3)).toMatchObject({
      pageNumber: 3,
      pageIndex: 2,
      top: 89 + 150 + PDF_THUMBNAIL_LABEL_AND_GAP_HEIGHT,
    });
  });

  it("builds square thumbnail layout as an explicit shape", () => {
    const layout = buildPdfThumbnailLayout({
      pageCount: 3,
      width: 50,
      shape: "square",
      metricByPageNumber: new Map([
        [2, { pageNumber: 2, width: 100, height: 300 }],
      ]),
    });

    expect(layout.shape).toBe("square");
    expect(layout.estimatedImageHeight).toBe(50);
    expect(layout.estimatedItemHeight).toBe(
      50 + PDF_THUMBNAIL_LABEL_AND_GAP_HEIGHT,
    );
    expect(layout.totalHeight).toBe(
      3 * (50 + PDF_THUMBNAIL_LABEL_AND_GAP_HEIGHT),
    );
    expect(getPdfThumbnailLayoutItem(layout, 2)).toMatchObject({
      pageNumber: 2,
      imageWidth: 50,
      imageHeight: 50,
      height: 50 + PDF_THUMBNAIL_LABEL_AND_GAP_HEIGHT,
      top: 50 + PDF_THUMBNAIL_LABEL_AND_GAP_HEIGHT,
    });
  });

  it("selects thumbnails from a centered pixel window", () => {
    const layout = buildPdfThumbnailLayout({
      pageCount: 20,
      width: 50,
    });
    const window = {
      layout,
      viewportHeight: 200,
      overscanPx: 100,
    };

    expect(getPdfThumbnailPixelWindow({ ...window, scrollTop: 0 })).toEqual({
      bottom: 400,
      top: 0,
    });
    expect(getPdfThumbnailPixelWindow({ ...window, scrollTop: 445 })).toEqual({
      bottom: 745,
      top: 345,
    });
    expect(getPdfThumbnailPixelWindow({ ...window, scrollTop: 1580 })).toEqual({
      bottom: 1780,
      top: 1380,
    });
    expect(
      getVisiblePdfThumbnailItems({
        ...window,
        scrollTop: 0,
      }).map((item) => item.pageNumber),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(
      getVisiblePdfThumbnailItems({
        ...window,
        scrollTop: 445,
      }).map((item) => item.pageNumber),
    ).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it("builds inverse-sticky rendered thumbnail window geometry", () => {
    const layout = buildPdfThumbnailLayout({
      pageCount: 10,
      width: 50,
    });
    const visibleItems = [
      getPdfThumbnailLayoutItem(layout, 3)!,
      getPdfThumbnailLayoutItem(layout, 4)!,
      getPdfThumbnailLayoutItem(layout, 5)!,
    ];

    const renderedWindow = getPdfThumbnailRenderedWindow({
      layout,
      visibleItems,
      viewportHeight: 100,
    });

    expect(renderedWindow).toMatchObject({
      beforeHeight: 178,
      renderedTop: 178,
      renderedBottom: 445,
      height: 267,
      stickyInset: -167,
      afterHeight: 445,
    });
    expect(renderedWindow?.items.map((item) => item.windowTop)).toEqual([
      0, 89, 178,
    ]);
  });

  it("bounds concurrent thumbnail page metric requests", async () => {
    const pages = Array.from({ length: 12 }, () => makePage(100, 200));
    const pageRequests = pages.map(() => pdfjsMock.deferred<MockPage>());
    const doc = {
      numPages: pages.length,
      getPage: vi.fn(
        (pageNumber: number) => pageRequests[pageNumber - 1].promise,
      ),
      destroy: vi.fn(() => Promise.resolve()),
    };
    const metricDoc = doc as unknown as Parameters<
      typeof usePdfThumbnailPageMetrics
    >[0];
    const pageNumbers = pages.map((_, index) => index + 1);

    function MetricRequestHarness() {
      const { metricByPageNumber, requestPageMetrics, status } =
        usePdfThumbnailPageMetrics(metricDoc, doc);

      useMountEffect(() => {
        requestPageMetrics(pageNumbers);
      });

      return <div data-loaded={metricByPageNumber.size} data-status={status} />;
    }

    render(<MetricRequestHarness />);

    await waitFor(() =>
      expect(doc.getPage).toHaveBeenCalledTimes(
        PDF_THUMBNAIL_PAGE_METRIC_CONCURRENCY,
      ),
    );
    expect(doc.getPage).not.toHaveBeenCalledWith(
      PDF_THUMBNAIL_PAGE_METRIC_CONCURRENCY + 1,
    );

    await act(async () => {
      pageRequests[0].resolve(pages[0]);
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(doc.getPage).toHaveBeenCalledWith(
        PDF_THUMBNAIL_PAGE_METRIC_CONCURRENCY + 1,
      ),
    );
  });

  it("ignores invalid thumbnail page metric requests", async () => {
    const doc = {
      numPages: 3,
      getPage: vi.fn(),
      destroy: vi.fn(() => Promise.resolve()),
    };

    function MetricRequestHarness() {
      const { requestPageMetrics, status } = usePdfThumbnailPageMetrics(
        doc as unknown as PdfMetricDocument,
        doc,
      );

      useMountEffect(() => {
        requestPageMetrics([0, -1, 1.5, 4]);
      });

      return <div data-status={status} />;
    }

    render(<MetricRequestHarness />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(doc.getPage).not.toHaveBeenCalled();
  });

  it("deduplicates queued, loading, and loaded thumbnail page metric requests", async () => {
    const pages = Array.from({ length: 6 }, () => makePage(100, 200));
    const pageRequests = pages.map(() => pdfjsMock.deferred<MockPage>());
    const doc = {
      numPages: pages.length,
      getPage: vi.fn(
        (pageNumber: number) => pageRequests[pageNumber - 1].promise,
      ),
      destroy: vi.fn(() => Promise.resolve()),
    };

    function MetricRequestHarness() {
      const { metricByPageNumber, requestPageMetrics } =
        usePdfThumbnailPageMetrics(doc as unknown as PdfMetricDocument, doc);

      useMountEffect(() => {
        requestPageMetrics([1, 1, 2, 3, 4, 5, 5, 6, 6]);
        requestPageMetrics([1, 2, 5, 6]);
      });

      return <div data-loaded={metricByPageNumber.size} />;
    }

    render(<MetricRequestHarness />);

    await waitFor(() =>
      expect(doc.getPage).toHaveBeenCalledTimes(
        PDF_THUMBNAIL_PAGE_METRIC_CONCURRENCY,
      ),
    );

    await act(async () => {
      pageRequests[0].resolve(pages[0]);
      pageRequests[1].resolve(pages[1]);
      await Promise.resolve();
    });

    await waitFor(() => expect(doc.getPage).toHaveBeenCalledTimes(6));

    await act(async () => {
      for (const [index, request] of pageRequests.entries()) {
        request.resolve(pages[index]);
      }
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(
        document.querySelector("[data-loaded]")?.getAttribute("data-loaded"),
      ).toBe("6"),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(doc.getPage).toHaveBeenCalledTimes(6);
  });

  it("clears thumbnail page metric state and ignores stale resolves on document reset", async () => {
    const firstPageRequest = pdfjsMock.deferred<MockPage>();
    const secondPageRequest = pdfjsMock.deferred<MockPage>();
    const firstDoc = {
      numPages: 1,
      getPage: vi.fn(() => firstPageRequest.promise),
      destroy: vi.fn(() => Promise.resolve()),
    };
    const secondDoc = {
      numPages: 1,
      getPage: vi.fn(() => secondPageRequest.promise),
      destroy: vi.fn(() => Promise.resolve()),
    };

    function MetricRequestHarness({ doc }: { doc: typeof firstDoc }) {
      const { metricByPageNumber, requestPageMetrics } =
        usePdfThumbnailPageMetrics(doc as unknown as PdfMetricDocument, doc);

      useKeyedMountEffect(joinEffectKey([requestPageMetrics]), () => {
        requestPageMetrics([1]);
      });

      return (
        <div
          data-loaded={metricByPageNumber.size}
          data-width={metricByPageNumber.get(1)?.width ?? ""}
        />
      );
    }

    const view = render(<MetricRequestHarness doc={firstDoc} />);
    await waitFor(() => expect(firstDoc.getPage).toHaveBeenCalledWith(1));

    view.rerender(<MetricRequestHarness doc={secondDoc} />);
    await waitFor(() =>
      expect(
        document.querySelector("[data-loaded]")?.getAttribute("data-loaded"),
      ).toBe("0"),
    );
    await waitFor(() => expect(secondDoc.getPage).toHaveBeenCalledWith(1));

    await act(async () => {
      firstPageRequest.resolve(makePage(111, 200));
      secondPageRequest.resolve(makePage(222, 200));
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(
        document.querySelector("[data-width]")?.getAttribute("data-width"),
      ).toBe("222"),
    );
  });

  it("throws rejected thumbnail page metric requests to the nearest boundary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const doc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.reject(new Error("metric failed"))),
      destroy: vi.fn(() => Promise.resolve()),
    };

    function MetricRequestHarness() {
      const { requestPageMetrics } = usePdfThumbnailPageMetrics(
        doc as unknown as PdfMetricDocument,
        doc,
      );

      useMountEffect(() => {
        requestPageMetrics([1]);
      });

      return <div />;
    }

    render(
      <TestMetricErrorBoundary>
        <MetricRequestHarness />
      </TestMetricErrorBoundary>,
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      "metric failed",
    );
  });

  it("exposes immutable thumbnail page metric map snapshots", async () => {
    const firstPageRequest = pdfjsMock.deferred<MockPage>();
    const secondPageRequest = pdfjsMock.deferred<MockPage>();
    const doc = {
      numPages: 2,
      getPage: vi.fn((pageNumber: number) =>
        pageNumber === 1 ? firstPageRequest.promise : secondPageRequest.promise,
      ),
      destroy: vi.fn(() => Promise.resolve()),
    };
    const metricMaps: ReadonlyMap<number, unknown>[] = [];

    function MetricRequestHarness() {
      const { metricByPageNumber, requestPageMetrics } =
        usePdfThumbnailPageMetrics(doc as unknown as PdfMetricDocument, doc);

      useKeyedMountEffect(joinEffectKey([metricByPageNumber]), () => {
        metricMaps.push(metricByPageNumber);
      });
      useMountEffect(() => {
        requestPageMetrics([1, 2]);
      });

      return <div data-loaded={metricByPageNumber.size} />;
    }

    render(<MetricRequestHarness />);
    await waitFor(() => expect(doc.getPage).toHaveBeenCalledTimes(2));

    await act(async () => {
      firstPageRequest.resolve(makePage(100, 200));
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(
        document.querySelector("[data-loaded]")?.getAttribute("data-loaded"),
      ).toBe("1"),
    );
    const firstLoadedMap = metricMaps.at(-1)!;

    await act(async () => {
      secondPageRequest.resolve(makePage(200, 200));
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(
        document.querySelector("[data-loaded]")?.getAttribute("data-loaded"),
      ).toBe("2"),
    );
    const secondLoadedMap = metricMaps.at(-1)!;

    expect(firstLoadedMap).not.toBe(secondLoadedMap);
    expect(firstLoadedMap.size).toBe(1);
    expect(secondLoadedMap.size).toBe(2);
  });

  it("bounds concurrent main page metric requests and records page metrics", async () => {
    const pages = Array.from({ length: 12 }, (_, index) =>
      makePage(100 + index, 200 + index, index === 0 ? 90 : 0),
    );
    const pageRequests = pages.map(() => pdfjsMock.deferred<MockPage>());
    const doc = {
      numPages: pages.length,
      getPage: vi.fn(
        (pageNumber: number) => pageRequests[pageNumber - 1].promise,
      ),
      destroy: vi.fn(() => Promise.resolve()),
    };
    const pageNumbers = pages.map((_, index) => index + 1);

    function MetricRequestHarness() {
      const { metricByPageNumber, requestPageMetrics, status } =
        usePdfPageMetrics(doc as unknown as PdfPageMetricDocument, doc);

      useMountEffect(() => {
        requestPageMetrics(pageNumbers);
      });

      return (
        <div
          data-loaded={metricByPageNumber.size}
          data-rotation={metricByPageNumber.get(1)?.rotation ?? ""}
          data-status={status}
          data-width={metricByPageNumber.get(1)?.width ?? ""}
        />
      );
    }

    render(<MetricRequestHarness />);

    await waitFor(() =>
      expect(doc.getPage).toHaveBeenCalledTimes(PDF_PAGE_METRIC_CONCURRENCY),
    );
    expect(doc.getPage).not.toHaveBeenCalledWith(
      PDF_PAGE_METRIC_CONCURRENCY + 1,
    );

    await act(async () => {
      pageRequests[0].resolve(pages[0]);
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(doc.getPage).toHaveBeenCalledWith(PDF_PAGE_METRIC_CONCURRENCY + 1),
    );
    await waitFor(() =>
      expect(
        document
          .querySelector("[data-rotation]")
          ?.getAttribute("data-rotation"),
      ).toBe("90"),
    );
    expect(
      document.querySelector("[data-width]")?.getAttribute("data-width"),
    ).toBe("200");
  });

  it("does not render controls chrome in the fallback when controls is false", async () => {
    await act(async () => {
      render(
        <PdfViewer source={pdfUrlSource("/pending.pdf")} controls={false} />,
      );
      await Promise.resolve();
    });

    expect(screen.queryByLabelText("Zoom in")).toBeNull();
    expect(screen.queryByLabelText("Download")).toBeNull();
    expect(document.querySelector("[data-slot='pdf-viewer']")).toBeTruthy();

    pdfjsMock.pending.get("/pending.pdf")?.resolve(makeDoc([[100, 200]]));
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("does not render controls chrome after a controls-free document loads", async () => {
    pdfjsMock.docs.set("/loaded-no-controls.pdf", makeDoc([[100, 200]]));

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/loaded-no-controls.pdf")}
          controls={false}
          defaultScale={1}
        />,
      );
    });

    await waitFor(() =>
      expect(document.querySelector("[data-slot='pdf-page']")).toBeTruthy(),
    );
    expect(screen.queryByLabelText("Zoom in")).toBeNull();
    expect(screen.queryByLabelText("Rotate")).toBeNull();
    expect(screen.queryByText("Page 1 of 1")).toBeNull();
  });

  it("resizes the page frame without restarting prepared canvas renders", async () => {
    const page = makePage(100, 200);
    const pdfDocument = {
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve(page)),
      destroy: vi.fn(() => Promise.resolve()),
    };

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <React.Suspense fallback={null}>
          <PdfPage
            document={pdfDocument}
            documentKey="prepared-page"
            pageNumber={1}
            scale={1}
            renderScale={2}
            rotation={0}
            devicePixelRatio={1}
          />
        </React.Suspense>,
      );
    });

    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(1));
    const renderTask = pdfjsMock.renderTasks[0];
    const frame = document.querySelector<HTMLElement>('[data-slot="pdf-page"]');
    expect(frame?.style.width).toBe("100px");
    expect(frame?.style.height).toBe("200px");

    view.rerender(
      <React.Suspense fallback={null}>
        <PdfPage
          document={pdfDocument}
          documentKey="prepared-page"
          pageNumber={1}
          scale={1.5}
          renderScale={2}
          rotation={0}
          devicePixelRatio={1}
        />
      </React.Suspense>,
    );

    await waitFor(() => expect(frame?.style.width).toBe("150px"));
    expect(frame?.style.height).toBe("300px");
    expect(page.render).toHaveBeenCalledTimes(1);
    expect(renderTask.cancel).not.toHaveBeenCalled();
  });

  it("treats scale as controlled and reports controls scale requests", async () => {
    pdfjsMock.docs.set("/controlled.pdf", makeDoc([[100, 200]]));
    const onScaleChange = vi.fn();
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfViewer
          source={pdfUrlSource("/controlled.pdf")}
          scale={2}
          onScaleChange={onScaleChange}
        />,
      );
    });

    await findByTextContent("Page 1 of 1");
    expect(screen.getByText("200%")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(onScaleChange).toHaveBeenCalledWith(2.4);
    expect(screen.getByText("200%")).toBeTruthy();

    view.rerender(
      <PdfViewer
        source={pdfUrlSource("/controlled.pdf")}
        scale={3}
        onScaleChange={onScaleChange}
      />,
    );
    expect(await screen.findByText("300%")).toBeTruthy();
  });

  it("reports a controlled fit-width request as null", async () => {
    pdfjsMock.docs.set("/controlled-fit.pdf", makeDoc([[100, 200]]));
    const onScaleChange = vi.fn();

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/controlled-fit.pdf")}
          scale={2}
          onScaleChange={onScaleChange}
        />,
      );
    });
    await findByTextContent("Page 1 of 1");

    fireEvent.click(screen.getByLabelText("Fit width"));

    expect(onScaleChange).toHaveBeenCalledWith(null);
    expect(screen.getByText("200%")).toBeTruthy();
  });

  it("clamps fit-width scale in the rendered controls", async () => {
    pdfjsMock.docs.set("/fit-clamp.pdf", makeDoc([[100, 200]]));

    await act(async () => {
      render(<PdfViewer source={pdfUrlSource("/fit-clamp.pdf")} />);
    });

    expect(await screen.findByText("500%")).toBeTruthy();
  });

  it("builds the easy PDF viewer from the explicit viewer primitive tree", async () => {
    pdfjsMock.docs.set("/easy-tree.pdf", makeDoc([[100, 200]]));

    await act(async () => {
      render(<PdfViewer source={pdfUrlSource("/easy-tree.pdf")} />);
    });
    await findByTextContent("Page 1 of 1");

    const root = document.querySelector<HTMLElement>(
      '[data-slot="file-viewer-root"]',
    );
    expect(root).toBeTruthy();
    expect(
      document.querySelectorAll('[data-slot="file-viewer-root"]'),
    ).toHaveLength(1);
    expect(root?.children[0]?.getAttribute("data-slot")).toBe(
      "file-viewer-header",
    );
    expect(root?.children[1]?.getAttribute("data-slot")).toBe(
      "file-viewer-content",
    );

    const body = root?.querySelector<HTMLElement>(
      '[data-slot="file-viewer-content"]',
    );
    expect(
      body?.querySelector(':scope > [data-slot="file-viewer-inset"]'),
    ).toBeTruthy();
    expect(
      root?.querySelector(
        '[data-slot="file-viewer-header"] [aria-label="Zoom in"]',
      ),
    ).toBeTruthy();
    expect(
      root?.querySelector<HTMLElement>(
        '[data-slot="pdf-viewer-fit-width-measure"]',
      )?.style.paddingInline,
    ).toBe("16px");
  });

  it("fits width from the document frame instead of the scaled document", async () => {
    pdfjsMock.docs.set("/stable-fit-width.pdf", makeDoc([[400, 800]]));

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        if (this.dataset.slot === "file-viewer-document-frame") {
          return 600;
        }
        if (this.dataset.slot === "pdf-viewer-fit-width-measure") {
          return 332;
        }
        if (this.dataset.slot === "pdf-viewer-document") {
          return 800;
        }
        return 832;
      },
    });

    await act(async () => {
      render(<PdfViewer source={pdfUrlSource("/stable-fit-width.pdf")} />);
    });

    expect(await screen.findByText("142%")).toBeTruthy();
  });

  it("preserves the visible page when fit-width changes after a surface resize", async () => {
    pdfjsMock.docs.set(
      "/fit-width-anchor.pdf",
      makeDoc([
        [400, 800],
        [400, 800],
        [400, 800],
        [400, 800],
        [400, 800],
      ]),
    );
    let frameWidth = 200;
    const resizeCallbacks = new Map<Element, ResizeObserverCallback>();

    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        private callback: ResizeObserverCallback;
        constructor(callback: ResizeObserverCallback) {
          this.callback = callback;
        }
        observe(target: Element) {
          resizeCallbacks.set(target, this.callback);
          this.callback([{ target } as ResizeObserverEntry], this as never);
        }
        unobserve(target: Element) {
          resizeCallbacks.delete(target);
        }
        disconnect() {}
      },
    );

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        if (this.dataset.slot === "file-viewer-document-frame") {
          return frameWidth;
        }
        return 832;
      },
    });

    await act(async () => {
      render(<PdfViewer source={pdfUrlSource("/fit-width-anchor.pdf")} />);
    });

    expect(await screen.findByText("42%")).toBeTruthy();

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    expect(viewport).toBeTruthy();
    Object.defineProperty(viewport, "scrollHeight", {
      configurable: true,
      value: 5000,
    });
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 908,
      writable: true,
    });
    fireEvent.scroll(viewport!);

    await findByTextContent("Page 3 of 5");

    const frameElement = document.querySelector<HTMLElement>(
      "[data-slot='file-viewer-document-frame']",
    );
    expect(frameElement).toBeTruthy();

    frameWidth = 400;
    await act(async () => {
      resizeCallbacks.get(frameElement!)?.(
        [{ target: frameElement! } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(await screen.findByText("92%")).toBeTruthy();
    expect(await findByTextContent("Page 3 of 5")).toBeTruthy();
    expect(viewport!.scrollTop).toBe(
      getExpectedPreservedPdfScrollTop({
        pageNumber: 3,
        pageSize: { width: 400, height: 800 },
        pageCount: 5,
        previousScale: 0.42,
        nextScale: 0.92,
        scrollTop: 908,
        viewportHeight: viewport!.clientHeight,
      }),
    );
  });

  it("returns uncontrolled manual zoom back to fit width", async () => {
    pdfjsMock.docs.set("/uncontrolled-fit.pdf", makeDoc([[400, 800]]));

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/uncontrolled-fit.pdf")}
          defaultScale={1}
        />,
      );
    });
    await screen.findByText("100%");

    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(await screen.findByText("120%")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Fit width"));
    expect(await screen.findByText("200%")).toBeTruthy();
  });

  it("preserves the visible page when manual zoom changes the layout", async () => {
    pdfjsMock.docs.set(
      "/manual-zoom-anchor.pdf",
      makeDoc([
        [400, 800],
        [400, 800],
        [400, 800],
        [400, 800],
        [400, 800],
      ]),
    );

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/manual-zoom-anchor.pdf")}
          defaultScale={1}
        />,
      );
    });

    expect(await screen.findByText("100%")).toBeTruthy();

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    expect(viewport).toBeTruthy();
    Object.defineProperty(viewport, "scrollHeight", {
      configurable: true,
      value: 5000,
    });
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 1708,
      writable: true,
    });
    fireEvent.scroll(viewport!);

    await findByTextContent("Page 3 of 5");

    fireEvent.click(screen.getByLabelText("Zoom in"));

    expect(await screen.findByText("120%")).toBeTruthy();
    expect(await findByTextContent("Page 3 of 5")).toBeTruthy();
    // Toolbar zoom anchors the viewport CENTER (Apple Preview semantics),
    // unlike passive re-fits which preserve the 20% reading marker.
    expect(viewport!.scrollTop).toBeCloseTo(
      getExpectedPreservedPdfScrollTop({
        pageNumber: 3,
        pageSize: { width: 400, height: 800 },
        pageCount: 5,
        previousScale: 1,
        nextScale: 1.2,
        scrollTop: 1708,
        viewportHeight: viewport!.clientHeight,
        markerRatio: 0.5,
      }),
    );
  });

  it("uses the rotated page width for fit-width scale", async () => {
    pdfjsMock.docs.set("/rotated-fit-width.pdf", makeDoc([[400, 800]]));

    await act(async () => {
      render(<PdfViewer source={pdfUrlSource("/rotated-fit-width.pdf")} />);
    });

    expect(await screen.findByText("200%")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Rotate"));

    expect(await screen.findByText("100%")).toBeTruthy();
  });

  it("clamps invalid controlled scale values before rendering and requesting zoom", async () => {
    pdfjsMock.docs.set("/invalid-controlled-scale.pdf", makeDoc([[100, 200]]));
    const onScaleChange = vi.fn();

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/invalid-controlled-scale.pdf")}
          scale={Number.NaN}
          onScaleChange={onScaleChange}
        />,
      );
    });

    await screen.findByText("100%");

    fireEvent.click(screen.getByLabelText("Zoom in"));

    expect(onScaleChange).toHaveBeenCalledWith(1.2);
  });

  it("reports the initial visible page after mounting", async () => {
    pdfjsMock.docs.set(
      "/initial-page.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
      ]),
    );
    const onVisiblePageChange = vi.fn();

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/initial-page.pdf")}
          onVisiblePageChange={onVisiblePageChange}
        />,
      );
    });

    await waitFor(() => expect(onVisiblePageChange).toHaveBeenCalledWith(1));
  });

  it("renders a bounded initial page window without IntersectionObserver", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const doc = makeDoc(
      Array.from({ length: 100 }, () => [100, 200] as [number, number]),
    );
    pdfjsMock.docs.set("/no-intersection-observer.pdf", doc);

    await act(async () => {
      render(
        <PdfViewer source={pdfUrlSource("/no-intersection-observer.pdf")} />,
      );
    });

    await waitFor(() => {
      expect(doc.getPage).toHaveBeenCalledWith(1);
      expect(doc.getPage).toHaveBeenCalledWith(2);
    });
    expect(document.querySelectorAll("[data-page-number]").length).toBeLessThan(
      100,
    );
    expect(document.querySelectorAll("canvas").length).toBeLessThan(100);
    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    const scrollRange = document.querySelector<HTMLElement>(
      '[data-slot="pdf-viewer-scroll-range"]',
    );
    const visualClip = document.querySelector<HTMLElement>(
      '[data-slot="pdf-viewer-visual-clip"]',
    );
    const visualStage = document.querySelector<HTMLElement>(
      '[data-slot="pdf-viewer-visual-stage"]',
    );
    const renderWindow = document.querySelector<HTMLElement>(
      '[data-slot="pdf-page-window"]',
    );

    expect(viewport?.style.overflowAnchor).toBe("none");
    expect(scrollRange?.getAttribute("style")).toContain(
      "contain: layout size style",
    );
    expect(visualClip?.getAttribute("style")).toContain("contain: paint style");
    expect(visualClip?.getAttribute("style")).toContain("overflow: clip");
    expect(visualStage?.style.transformOrigin).toBe("");
    expect(renderWindow?.getAttribute("style")).toContain(
      "contain: layout style",
    );
    expect(renderWindow?.getAttribute("style")).toContain("isolation: isolate");

    fireEvent.scroll(viewport!);
    expect(renderWindow?.style.pointerEvents).toBe("none");
  });

  it("does not keep rejected document loads cached for the same source", async () => {
    pdfjsMock.docs.set("/retry.pdf", new Error("load failed"));

    await expect(
      getPdfDocumentResource(pdfUrlContent("/retry.pdf")),
    ).rejects.toMatchObject({
      format: "pdf",
      kind: "parse_failed",
    });

    const doc = makeDoc([[100, 200]]);
    pdfjsMock.docs.set("/retry.pdf", doc);

    await expect(
      getPdfDocumentResource(pdfUrlContent("/retry.pdf")),
    ).resolves.toBe(doc);
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(2);
  });

  it("retries a failed PDF load from the viewer error state", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      render(<PdfViewer source={pdfUrlSource("/viewer-retry.pdf")} />);
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(pdfjsMock.pending.has("/viewer-retry.pdf")).toBe(true),
    );
    await act(async () => {
      pdfjsMock.pending
        .get("/viewer-retry.pdf")
        ?.reject(new Error("load failed"));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const alert = await screen.findByRole("alert");
    expect(alert.getAttribute("data-error-kind")).toBe("parse_failed");
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();

    const doc = makeDoc([[100, 200]]);
    pdfjsMock.docs.set("/viewer-retry.pdf", doc);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await findByTextContent("Page 1 of 1");
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(2);
  });

  it("retries a failed first page load from the viewer error state", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const firstDoc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.reject(new Error("page failed"))),
      destroy: vi.fn(() => Promise.resolve()),
    };
    pdfjsMock.docs.set("/viewer-page-retry.pdf", firstDoc);

    await act(async () => {
      render(<PdfViewer source={pdfUrlSource("/viewer-page-retry.pdf")} />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const alert = await screen.findByRole("alert");
    expect(alert.getAttribute("data-error-kind")).toBe("unknown");

    const secondDoc = makeDoc([[100, 200]]);
    pdfjsMock.docs.set("/viewer-page-retry.pdf", secondDoc);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await findByTextContent("Page 1 of 1");
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(2);
    expect(firstDoc.destroy).toHaveBeenCalledTimes(1);
  });

  it("retries a failed visible non-first page from the viewer error state", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const firstPage = makePage(100, 200);
    const firstDoc = {
      numPages: 2,
      getPage: vi.fn((pageNumber: number) =>
        pageNumber === 2
          ? Promise.reject(new Error("page 2 failed"))
          : Promise.resolve(firstPage),
      ),
      destroy: vi.fn(() => Promise.resolve()),
    };
    pdfjsMock.docs.set("/viewer-second-page-retry.pdf", firstDoc);

    await act(async () => {
      render(
        <PdfViewer source={pdfUrlSource("/viewer-second-page-retry.pdf")} />,
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const alert = await screen.findByRole("alert");
    expect(alert.getAttribute("data-error-kind")).toBe("unknown");

    const secondDoc = makeDoc([
      [100, 200],
      [100, 200],
    ]);
    pdfjsMock.docs.set("/viewer-second-page-retry.pdf", secondDoc);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await findByTextContent("Page 1 of 2");
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(2);
    expect(firstDoc.destroy).toHaveBeenCalledTimes(1);
  });

  it("loads Blob PDF sources from local bytes while keeping download metadata", async () => {
    const doc = makeDoc([[100, 200]]);
    pdfjsMock.getDocument.mockImplementation(
      (src: string | { data: Uint8Array }) => ({
        promise:
          typeof src === "string"
            ? Promise.reject(new Error(`unexpected URL load: ${src}`))
            : Promise.resolve(doc),
      }),
    );

    await act(async () => {
      render(
        <PdfViewer
          source={blobSource(Uint8Array.of(7, 8, 9), {
            identityKey: "viewer-blob-download-url",
            fileName: "local.pdf",
            mimeType: "application/pdf",
            downloadUrl: "/download/local.pdf",
          })}
        />,
      );
    });

    await findByTextContent("Page 1 of 1");
    const dataLoad = pdfjsMock.getDocument.mock.calls.find(
      ([input]) => typeof input !== "string",
    )?.[0] as { data: Uint8Array } | undefined;
    expect(dataLoad?.data).toEqual(Uint8Array.of(7, 8, 9));
    expect(pdfjsMock.getDocument).not.toHaveBeenCalledWith(
      "/download/local.pdf",
    );
    expect(screen.getByLabelText("Download").getAttribute("href")).toBe(
      "/download/local.pdf",
    );
  });
});
