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
  resetPdfDocumentResourceCacheForTests,
} from "@/lib/pdf-document-resource";
import {
  blobSource,
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource";
import {
  FileViewer,
  FileViewerBody,
  FileViewerControls,
  FileViewerHeader,
  FileViewerSidebar,
  FileViewerSurface,
  FileViewerTitle,
} from "@/registry/new-york-v4/ui/file-viewer";
import {
  buildPdfThumbnailLayout,
  getPdfThumbnailLayoutItem,
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
  ViewerSurface,
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

describe("PdfViewer", () => {
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
      '[data-slot="viewer-root"]',
    );
    expect(root).toBeTruthy();
    expect(document.querySelectorAll('[data-slot="viewer-root"]')).toHaveLength(
      1,
    );
    expect(root?.children[0]?.getAttribute("data-slot")).toBe(
      "file-viewer-header",
    );
    expect(root?.children[1]?.getAttribute("data-slot")).toBe(
      "file-viewer-body",
    );

    const body = root?.querySelector<HTMLElement>(
      '[data-slot="file-viewer-body"]',
    );
    expect(
      body?.querySelector(':scope > [data-slot="file-viewer-surface"]'),
    ).toBeTruthy();
    expect(
      root?.querySelector(
        '[data-slot="file-viewer-header"] [aria-label="Zoom in"]',
      ),
    ).toBeTruthy();
  });

  it("fits width from a stable viewport wrapper instead of the scaled document", async () => {
    pdfjsMock.docs.set("/stable-fit-width.pdf", makeDoc([[400, 800]]));

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
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

    expect(await screen.findByText("75%")).toBeTruthy();
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
    let measuredWidth = 232;
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
        if (this.dataset.slot === "pdf-viewer-fit-width-measure") {
          return measuredWidth;
        }
        return 832;
      },
    });

    await act(async () => {
      render(<PdfViewer source={pdfUrlSource("/fit-width-anchor.pdf")} />);
    });

    expect(await screen.findByText("50%")).toBeTruthy();

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    expect(viewport).toBeTruthy();
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 908,
      writable: true,
    });
    fireEvent.scroll(viewport!);

    await findByTextContent("Page 3 of 5");

    const measureElement = document.querySelector<HTMLElement>(
      "[data-slot='pdf-viewer-fit-width-measure']",
    );
    expect(measureElement).toBeTruthy();

    measuredWidth = 432;
    await act(async () => {
      resizeCallbacks.get(measureElement!)?.(
        [{ target: measureElement! } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(await screen.findByText("100%")).toBeTruthy();
    expect(await findByTextContent("Page 3 of 5")).toBeTruthy();
    expect(viewport!.scrollTop).toBe(1888);
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
    expect(viewport!.scrollTop).toBe(2064);
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

  it("does not reload a URL document when rerendered with an equivalent source object", async () => {
    pdfjsMock.docs.set("/stable-source.pdf", makeDoc([[100, 200]]));

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<PdfViewer source={pdfUrlSource("/stable-source.pdf")} />);
    });
    await findByTextContent("Page 1 of 1");

    view.rerender(<PdfViewer source={pdfUrlSource("/stable-source.pdf")} />);

    expect(await findByTextContent("Page 1 of 1")).toBeTruthy();
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(1);
  });

  it("keeps showing the new source when an abandoned pending source resolves later", async () => {
    const fastDoc = makeDoc([
      [100, 200],
      [100, 200],
    ]);
    const slowDoc = makeDoc([
      [100, 200],
      [100, 200],
      [100, 200],
    ]);
    pdfjsMock.docs.set("/fast-switch.pdf", fastDoc);

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<PdfViewer source={pdfUrlSource("/slow-switch.pdf")} />);
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(pdfjsMock.pending.has("/slow-switch.pdf")).toBe(true),
    );

    await act(async () => {
      view.rerender(<PdfViewer source={pdfUrlSource("/fast-switch.pdf")} />);
    });
    await findByTextContent("Page 1 of 2");

    await act(async () => {
      pdfjsMock.pending.get("/slow-switch.pdf")?.resolve(slowDoc);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await findByTextContent("Page 1 of 2")).toBeTruthy();
    expect(slowDoc.getPage).not.toHaveBeenCalled();
  });

  it("reports the visible page again when switching to a new document on the same page number", async () => {
    pdfjsMock.docs.set("/visible-switch-first.pdf", makeDoc([[100, 200]]));
    pdfjsMock.docs.set("/visible-switch-second.pdf", makeDoc([[100, 200]]));
    const onVisiblePageChange = vi.fn();

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfViewer
          source={pdfUrlSource("/visible-switch-first.pdf")}
          onVisiblePageChange={onVisiblePageChange}
        />,
      );
    });
    await waitFor(() => expect(onVisiblePageChange).toHaveBeenCalledWith(1));
    onVisiblePageChange.mockClear();

    await act(async () => {
      view.rerender(
        <PdfViewer
          source={pdfUrlSource("/visible-switch-second.pdf")}
          onVisiblePageChange={onVisiblePageChange}
        />,
      );
    });

    await waitFor(() => expect(onVisiblePageChange).toHaveBeenCalledWith(1));
  });

  it("resets scroll position when switching documents", async () => {
    pdfjsMock.docs.set(
      "/scroll-reset-first.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
      ]),
    );
    pdfjsMock.docs.set("/scroll-reset-second.pdf", makeDoc([[100, 200]]));

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfViewer source={pdfUrlSource("/scroll-reset-first.pdf")} />,
      );
    });
    await findByTextContent("Page 1 of 2");

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    expect(viewport).toBeTruthy();
    const scrollTo = vi.fn();
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 1200,
      writable: true,
    });
    viewport!.scrollTo = scrollTo;

    await act(async () => {
      view.rerender(
        <PdfViewer source={pdfUrlSource("/scroll-reset-second.pdf")} />,
      );
    });

    await findByTextContent("Page 1 of 1");
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });

  it("resets controls rotation when switching documents", async () => {
    pdfjsMock.docs.set("/rotation-reset-first.pdf", makeDoc([[100, 200]]));
    pdfjsMock.docs.set("/rotation-reset-second.pdf", makeDoc([[100, 200]]));

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfViewer
          source={pdfUrlSource("/rotation-reset-first.pdf")}
          defaultScale={1}
          renderPageOverlay={({ rotation }) => (
            <div data-testid="rotation">{rotation}</div>
          )}
        />,
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId("rotation").textContent).toBe("0"),
    );

    fireEvent.click(screen.getByLabelText("Rotate"));
    await waitFor(() =>
      expect(screen.getByTestId("rotation").textContent).toBe("90"),
    );

    await act(async () => {
      view.rerender(
        <PdfViewer
          source={pdfUrlSource("/rotation-reset-second.pdf")}
          defaultScale={1}
          renderPageOverlay={({ rotation }) => (
            <div data-testid="rotation">{rotation}</div>
          )}
        />,
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId("rotation").textContent).toBe("0"),
    );
  });

  it("resets uncontrolled zoom when switching documents", async () => {
    pdfjsMock.docs.set("/zoom-reset-first.pdf", makeDoc([[400, 800]]));
    pdfjsMock.docs.set("/zoom-reset-second.pdf", makeDoc([[400, 800]]));

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfViewer
          source={pdfUrlSource("/zoom-reset-first.pdf")}
          defaultScale={1}
        />,
      );
    });

    await screen.findByText("100%");

    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(await screen.findByText("120%")).toBeTruthy();

    await act(async () => {
      view.rerender(
        <PdfViewer
          source={pdfUrlSource("/zoom-reset-second.pdf")}
          defaultScale={1}
        />,
      );
    });

    expect(await screen.findByText("100%")).toBeTruthy();
  });

  it("returns to fit-width zoom when switching documents without a default scale", async () => {
    pdfjsMock.docs.set("/fit-reset-first.pdf", makeDoc([[400, 800]]));
    pdfjsMock.docs.set("/fit-reset-second.pdf", makeDoc([[200, 400]]));

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfViewer source={pdfUrlSource("/fit-reset-first.pdf")} />,
      );
    });

    expect(await screen.findByText("200%")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(await screen.findByText("240%")).toBeTruthy();

    await act(async () => {
      view.rerender(
        <PdfViewer source={pdfUrlSource("/fit-reset-second.pdf")} />,
      );
    });

    expect(await screen.findByText("400%")).toBeTruthy();
  });

  it("does not render a new document with the previous document rotation", async () => {
    const firstPage = makePage(100, 200);
    const secondPage = makePage(100, 200);
    const firstDoc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve(firstPage)),
      destroy: vi.fn(() => Promise.resolve()),
    };
    const secondDoc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve(secondPage)),
      destroy: vi.fn(() => Promise.resolve()),
    };
    pdfjsMock.docs.set("/rotation-render-first.pdf", firstDoc);
    pdfjsMock.docs.set("/rotation-render-second.pdf", secondDoc);

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfViewer
          source={pdfUrlSource("/rotation-render-first.pdf")}
          defaultScale={1}
        />,
      );
    });
    await waitFor(() => expect(firstPage.render).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByLabelText("Rotate"));
    await waitFor(() => expect(firstPage.render).toHaveBeenCalledTimes(2));

    await act(async () => {
      view.rerender(
        <PdfViewer
          source={pdfUrlSource("/rotation-render-second.pdf")}
          defaultScale={1}
        />,
      );
    });

    await waitFor(() => expect(secondPage.render).toHaveBeenCalled());
    expect(
      secondPage.render.mock.calls.map((call) => call[0].viewport),
    ).toEqual([expect.objectContaining({ width: 100, height: 200 })]);
  });

  it("releases the previous document when switching sources", async () => {
    const firstDoc = makeDoc([[100, 200]]);
    const secondDoc = makeDoc([[100, 200]]);
    pdfjsMock.docs.set("/switch-first.pdf", firstDoc);
    pdfjsMock.docs.set("/switch-second.pdf", secondDoc);

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<PdfViewer source={pdfUrlSource("/switch-first.pdf")} />);
    });
    await findByTextContent("Page 1 of 1");

    await act(async () => {
      view.rerender(<PdfViewer source={pdfUrlSource("/switch-second.pdf")} />);
    });
    await findByTextContent("Page 1 of 1");

    for (let index = 0; index < 6; index += 1) {
      const otherDoc = makeDoc([[100, 200]]);
      pdfjsMock.docs.set(`/switch-other-${index}.pdf`, otherDoc);
      await getPdfDocumentResource(pdfUrlContent(`/switch-other-${index}.pdf`));
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(firstDoc.destroy).toHaveBeenCalledTimes(1);
    expect(secondDoc.destroy).not.toHaveBeenCalled();
  });

  it("resets measured page sizes when switching documents", async () => {
    const firstDoc = makeDoc([
      [100, 200],
      [400, 500],
    ]);
    const secondDoc = makeDoc([
      [100, 200],
      [100, 200],
    ]);
    pdfjsMock.docs.set("/measured-size-first.pdf", firstDoc);
    pdfjsMock.docs.set("/measured-size-second.pdf", secondDoc);

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfViewer
          source={pdfUrlSource("/measured-size-first.pdf")}
          defaultScale={1}
        />,
      );
    });

    await waitFor(() =>
      expect(
        document.querySelector<HTMLElement>("[data-page-number='2']")?.style
          .width,
      ).toBe("400px"),
    );

    await act(async () => {
      view.rerender(
        <PdfViewer
          source={pdfUrlSource("/measured-size-second.pdf")}
          defaultScale={1}
        />,
      );
    });

    await waitFor(() => expect(secondDoc.getPage).toHaveBeenCalledWith(2));
    expect(
      document.querySelector<HTMLElement>("[data-page-number='2']")?.style
        .width,
    ).toBe("100px");
  });

  it("cancels rendered page tasks when switching documents", async () => {
    pdfjsMock.docs.set("/cancel-source-first.pdf", makeDoc([[100, 200]]));
    pdfjsMock.docs.set("/cancel-source-second.pdf", makeDoc([[100, 200]]));

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfViewer
          source={pdfUrlSource("/cancel-source-first.pdf")}
          defaultScale={1}
        />,
      );
    });
    await waitFor(() => expect(pdfjsMock.renderTasks).toHaveLength(1));
    const firstTask = pdfjsMock.renderTasks[0];

    await act(async () => {
      view.rerender(
        <PdfViewer
          source={pdfUrlSource("/cancel-source-second.pdf")}
          defaultScale={1}
        />,
      );
    });

    await waitFor(() => expect(pdfjsMock.renderTasks).toHaveLength(2));
    expect(firstTask.cancel).toHaveBeenCalledTimes(1);
  });

  it("scrolls a normalized page target through the imperative handle", async () => {
    pdfjsMock.docs.set(
      "/scroll.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
      ]),
    );

    function Harness() {
      const ref = React.useRef<PdfViewerHandle>(null);
      return (
        <>
          <button
            type="button"
            onClick={() =>
              ref.current?.scrollToPageArea(
                { pageNumber: 2, top: 25 },
                { behavior: "auto" },
              )
            }
          >
            Jump
          </button>
          <PdfViewer ref={ref} source={pdfUrlSource("/scroll.pdf")} />
        </>
      );
    }

    await act(async () => {
      render(<Harness />);
    });
    await findByTextContent("Page 1 of 2");

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    const slot = document.querySelector<HTMLElement>("[data-page-number='2']");
    expect(viewport).toBeTruthy();
    expect(slot).toBeTruthy();

    const scrollTo = vi.fn();
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 100,
      writable: true,
    });
    viewport!.scrollTo = scrollTo;
    viewport!.getBoundingClientRect = () =>
      ({ top: 10, height: 500 }) as DOMRect;
    slot!.getBoundingClientRect = () => ({ top: 210, height: 1000 }) as DOMRect;

    fireEvent.click(screen.getByRole("button", { name: "Jump" }));

    expect(scrollTo).toHaveBeenCalledWith({
      top: 1234,
      behavior: "auto",
    });
  });

  it("clamps normalized target top before imperative scrolling", async () => {
    pdfjsMock.docs.set(
      "/scroll-clamp.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
      ]),
    );

    function Harness() {
      const ref = React.useRef<PdfViewerHandle>(null);
      return (
        <>
          <button
            type="button"
            onClick={() =>
              ref.current?.scrollToPageArea(
                { pageNumber: 2, top: 200 },
                { behavior: "auto" },
              )
            }
          >
            Jump past page
          </button>
          <PdfViewer ref={ref} source={pdfUrlSource("/scroll-clamp.pdf")} />
        </>
      );
    }

    await act(async () => {
      render(<Harness />);
    });
    await findByTextContent("Page 1 of 2");

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    const slot = document.querySelector<HTMLElement>("[data-page-number='2']");
    expect(viewport).toBeTruthy();
    expect(slot).toBeTruthy();

    const scrollTo = vi.fn();
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 100,
      writable: true,
    });
    viewport!.scrollTo = scrollTo;
    viewport!.getBoundingClientRect = () =>
      ({ top: 10, height: 500 }) as DOMRect;
    slot!.getBoundingClientRect = () => ({ top: 210, height: 1000 }) as DOMRect;

    fireEvent.click(screen.getByRole("button", { name: "Jump past page" }));

    expect(scrollTo).toHaveBeenCalledWith({
      top: 1984,
      behavior: "auto",
    });
  });

  it("clamps negative normalized target top before imperative scrolling", async () => {
    pdfjsMock.docs.set(
      "/scroll-negative-clamp.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
      ]),
    );

    function Harness() {
      const ref = React.useRef<PdfViewerHandle>(null);
      return (
        <>
          <button
            type="button"
            onClick={() =>
              ref.current?.scrollToPageArea(
                { pageNumber: 2, top: -25 },
                { behavior: "auto" },
              )
            }
          >
            Jump before page
          </button>
          <PdfViewer
            ref={ref}
            source={pdfUrlSource("/scroll-negative-clamp.pdf")}
          />
        </>
      );
    }

    await act(async () => {
      render(<Harness />);
    });
    await findByTextContent("Page 1 of 2");

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    const slot = document.querySelector<HTMLElement>("[data-page-number='2']");
    expect(viewport).toBeTruthy();
    expect(slot).toBeTruthy();

    const scrollTo = vi.fn();
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 100,
      writable: true,
    });
    viewport!.scrollTo = scrollTo;
    viewport!.getBoundingClientRect = () =>
      ({ top: 10, height: 500 }) as DOMRect;
    slot!.getBoundingClientRect = () => ({ top: 210, height: 1000 }) as DOMRect;

    fireEvent.click(screen.getByRole("button", { name: "Jump before page" }));

    expect(scrollTo).toHaveBeenCalledWith({
      top: 984,
      behavior: "auto",
    });
  });

  it("ignores invalid imperative page scroll requests", async () => {
    pdfjsMock.docs.set("/invalid-scroll.pdf", makeDoc([[100, 200]]));

    function Harness() {
      const ref = React.useRef<PdfViewerHandle>(null);
      return (
        <>
          <button
            type="button"
            onClick={() =>
              ref.current?.scrollToPageArea(
                { pageNumber: 2, top: 25 },
                { behavior: "auto" },
              )
            }
          >
            Invalid jump
          </button>
          <PdfViewer ref={ref} source={pdfUrlSource("/invalid-scroll.pdf")} />
        </>
      );
    }

    await act(async () => {
      render(<Harness />);
    });
    await findByTextContent("Page 1 of 1");

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    expect(viewport).toBeTruthy();
    const scrollTo = vi.fn();
    viewport!.scrollTo = scrollTo;

    fireEvent.click(screen.getByRole("button", { name: "Invalid jump" }));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it.each([
    ["NaN", Number.NaN, 984],
    ["Infinity", Number.POSITIVE_INFINITY, 1984],
  ])(
    "normalizes %s imperative target offsets before scrolling",
    async (label, targetTop, expectedTop) => {
      pdfjsMock.docs.set(
        `/scroll-${label}.pdf`,
        makeDoc([
          [100, 200],
          [100, 200],
        ]),
      );

      function Harness() {
        const ref = React.useRef<PdfViewerHandle>(null);
        return (
          <>
            <button
              type="button"
              onClick={() =>
                ref.current?.scrollToPageArea(
                  { pageNumber: 2, top: targetTop },
                  { behavior: "auto" },
                )
              }
            >
              Jump to bad offset
            </button>
            <PdfViewer
              ref={ref}
              source={pdfUrlSource(`/scroll-${label}.pdf`)}
            />
          </>
        );
      }

      await act(async () => {
        render(<Harness />);
      });
      await findByTextContent("Page 1 of 2");

      const viewport = document.querySelector<HTMLElement>(
        "[data-slot='scroll-area-viewport']",
      );
      expect(viewport).toBeTruthy();
      const scrollTo = vi.fn();
      viewport!.scrollTo = scrollTo;

      fireEvent.click(
        screen.getByRole("button", { name: "Jump to bad offset" }),
      );

      expect(scrollTo).toHaveBeenCalledWith({
        top: expectedTop,
        behavior: "auto",
      });
    },
  );

  it("exposes the live viewport element through the imperative handle", async () => {
    pdfjsMock.docs.set("/viewport-handle.pdf", makeDoc([[100, 200]]));

    const handleRef = { current: null as PdfViewerHandle | null };
    function Harness() {
      return (
        <PdfViewer
          ref={(value) => {
            handleRef.current = value;
          }}
          source={pdfUrlSource("/viewport-handle.pdf")}
        />
      );
    }

    const view = render(<Harness />);
    await findByTextContent("Page 1 of 1");

    const viewport = document.querySelector(
      "[data-slot='scroll-area-viewport']",
    );
    expect(handleRef.current?.getViewportElement()).toBe(viewport);

    view.unmount();

    expect(handleRef.current).toBeNull();
  });

  it("reports zero scroll progress when content is not scrollable", async () => {
    pdfjsMock.docs.set("/no-scroll-progress.pdf", makeDoc([[100, 200]]));
    const onScrollProgressChange = vi.fn();

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/no-scroll-progress.pdf")}
          onScrollProgressChange={onScrollProgressChange}
        />,
      );
    });
    await findByTextContent("Page 1 of 1");

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    expect(viewport).toBeTruthy();

    Object.defineProperty(viewport, "clientHeight", {
      configurable: true,
      value: 600,
    });
    Object.defineProperty(viewport, "scrollHeight", {
      configurable: true,
      value: 600,
    });
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 300,
      writable: true,
    });

    fireEvent.scroll(viewport!);

    expect(onScrollProgressChange).toHaveBeenLastCalledWith(0);
  });

  it.each([
    ["negative", -50, 0],
    ["overlarge", 2400, 1],
  ])(
    "clamps %s scroll progress to the valid range",
    async (_label, scrollTop, expectedProgress) => {
      pdfjsMock.docs.set("/progress-clamp.pdf", makeDoc([[100, 200]]));
      const onScrollProgressChange = vi.fn();

      await act(async () => {
        render(
          <PdfViewer
            source={pdfUrlSource("/progress-clamp.pdf")}
            onScrollProgressChange={onScrollProgressChange}
          />,
        );
      });
      await findByTextContent("Page 1 of 1");

      const viewport = document.querySelector<HTMLElement>(
        "[data-slot='scroll-area-viewport']",
      );
      expect(viewport).toBeTruthy();

      Object.defineProperty(viewport, "clientHeight", {
        configurable: true,
        value: 600,
      });
      Object.defineProperty(viewport, "scrollHeight", {
        configurable: true,
        value: 1800,
      });
      Object.defineProperty(viewport, "scrollTop", {
        configurable: true,
        value: scrollTop,
        writable: true,
      });

      onScrollProgressChange.mockClear();
      fireEvent.scroll(viewport!);
      await waitFor(() =>
        expect(onScrollProgressChange).toHaveBeenLastCalledWith(
          expectedProgress,
        ),
      );
    },
  );

  it("selects the current page using the 20 percent viewport marker", async () => {
    pdfjsMock.docs.set(
      "/scroll-marker.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
        [100, 200],
      ]),
    );
    const onVisiblePageChange = vi.fn();

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/scroll-marker.pdf")}
          onVisiblePageChange={onVisiblePageChange}
        />,
      );
    });
    await findByTextContent("Page 1 of 3");

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    expect(viewport).toBeTruthy();

    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 950,
      writable: true,
    });
    viewport!.getBoundingClientRect = () =>
      ({ top: 0, height: 500 }) as DOMRect;

    fireEvent.scroll(viewport!);

    await waitFor(() =>
      expect(onVisiblePageChange).toHaveBeenLastCalledWith(2),
    );
    expect(await findByTextContent("Page 2 of 3")).toBeTruthy();
  });

  it("leaves sidebars to viewer composition instead of PDF slots", async () => {
    const source = pdfUrlSource("/composed-sidebar.pdf");

    pdfjsMock.docs.set("/composed-sidebar.pdf", makeDoc([[100, 200]]));

    await act(async () => {
      render(
        <FileViewer source={source}>
          <PdfViewerProvider>
            <FileViewerHeader>
              <FileViewerTitle />
              <FileViewerControls />
            </FileViewerHeader>
            <FileViewerBody>
              <FileViewerSidebar>Composed sidebar</FileViewerSidebar>
              <FileViewerSurface>
                <PdfViewerPages bare className="h-full" />
              </FileViewerSurface>
            </FileViewerBody>
          </PdfViewerProvider>
        </FileViewer>,
      );
    });
    await findByTextContent("Page 1 of 1");

    expect(screen.getByText("Composed sidebar")).toBeTruthy();
    expect(screen.queryByLabelText("Hide sidebar")).toBeNull();
    expect(screen.queryByLabelText("Show sidebar")).toBeNull();
    expect(document.querySelector("[data-slot='pdf-viewer-rail']")).toBeNull();
  });

  it("updates a detached header on zoom without remounting thumbnails", async () => {
    const source = pdfUrlSource("/detached-header-performance.pdf");

    pdfjsMock.docs.set(
      "/detached-header-performance.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
      ]),
    );
    const counts = {
      thumbnailMounts: 0,
    };

    function CountingThumbnails() {
      useMountEffect(() => {
        counts.thumbnailMounts += 1;
      });
      return <PdfViewerThumbnails thumbnailWidth={64} />;
    }

    render(
      <FileViewer source={source} defaultOpen>
        <PdfViewerProvider>
          <FileViewerHeader>
            <FileViewerTitle />
            <FileViewerControls />
          </FileViewerHeader>
          <FileViewerBody>
            <FileViewerSidebar aria-label="PDF pages">
              <CountingThumbnails />
            </FileViewerSidebar>
            <FileViewerSurface>
              <PdfViewerPages bare className="h-full" defaultScale={1} />
            </FileViewerSurface>
          </FileViewerBody>
        </PdfViewerProvider>
      </FileViewer>,
    );

    await findByTextContent("Page 1 of 2");
    await screen.findByRole("button", { name: "Page 1" });
    const initialThumbnailMounts = counts.thumbnailMounts;
    const initialDocumentLoads = pdfjsMock.getDocument.mock.calls.length;

    fireEvent.click(screen.getByLabelText("Zoom in"));

    expect(await screen.findByText("120%")).toBeTruthy();
    expect(counts.thumbnailMounts).toBe(initialThumbnailMounts);
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(initialDocumentLoads);
  });

  it("updates current page on scroll without remounting thumbnails or reloading the document", async () => {
    const source = pdfUrlSource("/scroll-composed-performance.pdf");

    pdfjsMock.docs.set(
      "/scroll-composed-performance.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
        [100, 200],
      ]),
    );
    const counts = {
      thumbnailMounts: 0,
    };

    function CountingThumbnails() {
      useMountEffect(() => {
        counts.thumbnailMounts += 1;
      });
      return <PdfViewerThumbnails thumbnailWidth={64} />;
    }

    render(
      <FileViewer source={source} defaultOpen>
        <PdfViewerProvider>
          <FileViewerHeader>
            <FileViewerTitle />
            <FileViewerControls />
          </FileViewerHeader>
          <FileViewerBody>
            <FileViewerSidebar aria-label="PDF pages">
              <CountingThumbnails />
            </FileViewerSidebar>
            <FileViewerSurface>
              <PdfViewerPages bare className="h-full" />
            </FileViewerSurface>
          </FileViewerBody>
        </PdfViewerProvider>
      </FileViewer>,
    );

    await findByTextContent("Page 1 of 3");
    await screen.findByRole("button", { name: "Page 1" });
    const initialThumbnailMounts = counts.thumbnailMounts;
    const initialDocumentLoads = pdfjsMock.getDocument.mock.calls.length;

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    expect(viewport).toBeTruthy();
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 950,
      writable: true,
    });
    viewport!.getBoundingClientRect = () =>
      ({ top: 0, height: 500 }) as DOMRect;

    fireEvent.scroll(viewport!);

    expect(await findByTextContent("Page 2 of 3")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole("button", { current: "page" }).textContent).toBe(
        "2",
      ),
    );
    expect(counts.thumbnailMounts).toBe(initialThumbnailMounts);
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(initialDocumentLoads);
  });

  it("renders page overlays with current geometry and rotation", async () => {
    pdfjsMock.docs.set("/overlay.pdf", makeDoc([[100, 200]]));

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/overlay.pdf")}
          defaultScale={1}
          renderPageOverlay={({
            pageNumber,
            width,
            height,
            scale,
            rotation,
          }) => (
            <>
              <div data-testid="overlay-props">
                {pageNumber}:{width}x{height}:{scale}:{rotation}
              </div>
              <PdfHighlight
                data-testid="highlight"
                area={{ left: 10, top: 20, width: 30, height: 40 }}
              />
            </>
          )}
        />,
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId("overlay-props").textContent).toBe(
        "1:100x200:1:0",
      ),
    );
    expect(screen.getByTestId("highlight").getAttribute("style")).toContain(
      "left: 10%;",
    );

    fireEvent.click(screen.getByLabelText("Rotate"));

    await waitFor(() =>
      expect(screen.getByTestId("overlay-props").textContent).toBe(
        "1:200x100:1:90",
      ),
    );
  });

  it("combines intrinsic page rotation with controls rotation while rendering", async () => {
    const page = makePage(100, 200, 90);
    const doc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve(page)),
      destroy: vi.fn(() => Promise.resolve()),
    };
    pdfjsMock.docs.set("/rotated.pdf", doc);

    await act(async () => {
      render(
        <PdfViewer source={pdfUrlSource("/rotated.pdf")} defaultScale={1} />,
      );
    });

    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(1));
    expect(page.render.mock.calls.at(-1)?.[0].viewport).toMatchObject({
      width: 200,
      height: 100,
    });

    fireEvent.click(screen.getByLabelText("Rotate"));

    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(2));
    expect(page.render.mock.calls.at(-1)?.[0].viewport).toMatchObject({
      width: 100,
      height: 200,
    });
  });

  it("renders page canvases at device pixel ratio without changing css size", async () => {
    const page = makePage(100, 200);
    const doc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve(page)),
      destroy: vi.fn(() => Promise.resolve()),
    };
    pdfjsMock.docs.set("/dpr.pdf", doc);

    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 2,
    });

    await act(async () => {
      render(<PdfViewer source={pdfUrlSource("/dpr.pdf")} defaultScale={1} />);
    });

    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(1));
    const renderCall = page.render.mock.calls[0]?.[0];
    const canvas = renderCall.canvas as HTMLCanvasElement;

    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(400);
    expect(canvas.style.width).toBe("100px");
    expect(canvas.style.height).toBe("200px");
    expect(renderCall.transform).toEqual([2, 0, 0, 2, 0, 0]);
  });

  it("caps high-DPI page canvases without changing css size", async () => {
    const page = makePage(100, 200);
    const doc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve(page)),
      destroy: vi.fn(() => Promise.resolve()),
    };
    pdfjsMock.docs.set("/capped-dpr.pdf", doc);

    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 3,
    });

    await act(async () => {
      render(
        <PdfViewer source={pdfUrlSource("/capped-dpr.pdf")} defaultScale={1} />,
      );
    });

    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(1));
    const renderCall = page.render.mock.calls[0]?.[0];
    const canvas = renderCall.canvas as HTMLCanvasElement;

    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(400);
    expect(canvas.style.width).toBe("100px");
    expect(canvas.style.height).toBe("200px");
    expect(renderCall.transform).toEqual([2, 0, 0, 2, 0, 0]);
  });

  it("renders newly visible pages at scrolling DPR before sharpening after scroll idle", async () => {
    const doc = makeDoc([
      [100, 1000],
      [100, 1000],
      [100, 1000],
      [100, 1000],
    ]);
    const makeResolvedRenderTask = () => {
      const task = {
        promise: Promise.resolve(),
        cancel: vi.fn(),
      };
      pdfjsMock.renderTasks.push(task);
      return task;
    };
    doc.pages[0].render.mockImplementationOnce(makeResolvedRenderTask);
    doc.pages[1].render.mockImplementationOnce(makeResolvedRenderTask);
    doc.pages[2].render.mockImplementationOnce(makeResolvedRenderTask);
    pdfjsMock.docs.set("/scroll-dpr.pdf", doc);

    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 2,
    });

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/scroll-dpr.pdf")}
          defaultScale={1}
          performanceOptions={{ directionAwarePreRender: false }}
        />,
      );
    });

    await waitFor(() => expect(doc.pages[0].render).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(doc.pages[1].render).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(doc.pages[2].render).toHaveBeenCalledTimes(1));
    expect(doc.pages[3].render).not.toHaveBeenCalled();

    vi.useFakeTimers();
    try {
      const viewport = document.querySelector<HTMLElement>(
        "[data-slot='scroll-area-viewport']",
      );
      expect(viewport).toBeTruthy();
      Object.defineProperty(viewport, "scrollTop", {
        configurable: true,
        value: 1032,
      });

      fireEvent.scroll(viewport!);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(doc.pages[3].render).toHaveBeenCalledTimes(1);
      const scrollingCall = doc.pages[3].render.mock.calls[0]?.[0];
      const scrollingCanvas = scrollingCall.canvas as HTMLCanvasElement;
      expect(scrollingCanvas.width).toBe(100);
      expect(scrollingCanvas.height).toBe(1000);
      expect(scrollingCall.transform).toBeUndefined();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(120);
      });

      expect(doc.pages[3].render).toHaveBeenCalledTimes(2);
      const settledCall = doc.pages[3].render.mock.calls[1]?.[0];
      const settledCanvas = settledCall.canvas as HTMLCanvasElement;
      expect(settledCanvas.width).toBe(200);
      expect(settledCanvas.height).toBe(2000);
      expect(settledCall.transform).toEqual([2, 0, 0, 2, 0, 0]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("pre-renders past the settled render window after it finishes", async () => {
    const doc = makeDoc([
      [100, 1000],
      [100, 1000],
      [100, 1000],
      [100, 1000],
    ]);
    const makeResolvedRenderTask = () => {
      const task = {
        promise: Promise.resolve(),
        cancel: vi.fn(),
      };
      pdfjsMock.renderTasks.push(task);
      return task;
    };
    doc.pages[0].render.mockImplementationOnce(makeResolvedRenderTask);
    doc.pages[1].render.mockImplementationOnce(makeResolvedRenderTask);
    doc.pages[2].render.mockImplementationOnce(makeResolvedRenderTask);
    pdfjsMock.docs.set("/direction-pre-render.pdf", doc);

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/direction-pre-render.pdf")}
          defaultScale={1}
        />,
      );
    });

    await waitFor(() => expect(doc.pages[0].render).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(doc.pages[1].render).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(doc.pages[2].render).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(doc.pages[3].render).toHaveBeenCalledTimes(1));
  });

  it("can disable direction-aware pre-render for benchmark comparisons", async () => {
    const doc = makeDoc([
      [100, 1000],
      [100, 1000],
      [100, 1000],
      [100, 1000],
    ]);
    const makeResolvedRenderTask = () => {
      const task = {
        promise: Promise.resolve(),
        cancel: vi.fn(),
      };
      pdfjsMock.renderTasks.push(task);
      return task;
    };
    doc.pages[0].render.mockImplementationOnce(makeResolvedRenderTask);
    doc.pages[1].render.mockImplementationOnce(makeResolvedRenderTask);
    doc.pages[2].render.mockImplementationOnce(makeResolvedRenderTask);
    pdfjsMock.docs.set("/direction-pre-render-disabled.pdf", doc);

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/direction-pre-render-disabled.pdf")}
          defaultScale={1}
          performanceOptions={{ directionAwarePreRender: false }}
        />,
      );
    });

    await waitFor(() => expect(doc.pages[0].render).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(doc.pages[1].render).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(doc.pages[2].render).toHaveBeenCalledTimes(1));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(doc.pages[3].render).not.toHaveBeenCalled();
  });

  it("reuses cached rendered canvases when remounting pages", async () => {
    const drawImage = vi.fn();
    const onPageRenderTiming = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as never);
    const doc = makeDoc(
      Array.from({ length: 8 }, () => [100, 1000] as [number, number]),
    );
    doc.pages[0].render.mockImplementationOnce(() => {
      const task = {
        promise: Promise.resolve(),
        cancel: vi.fn(),
      };
      pdfjsMock.renderTasks.push(task);
      return task;
    });
    pdfjsMock.docs.set("/render-cache.pdf", doc);

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/render-cache.pdf")}
          defaultScale={1}
          onPageRenderTiming={onPageRenderTiming}
        />,
      );
    });

    await waitFor(() => expect(doc.pages[0].render).toHaveBeenCalledTimes(1));

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    expect(viewport).toBeTruthy();
    let scrollTop = 0;
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value;
      },
    });

    scrollTop = 5200;
    fireEvent.scroll(viewport!);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() =>
      expect(document.querySelector("[data-page-number='1']")).toBeNull(),
    );

    scrollTop = 0;
    fireEvent.scroll(viewport!);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() =>
      expect(document.querySelector("[data-page-number='1']")).toBeTruthy(),
    );
    expect(doc.pages[0].render).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(onPageRenderTiming).toHaveBeenCalledWith(
        expect.objectContaining({
          pageNumber: 1,
          source: "cache",
          status: "rendered",
        }),
      ),
    );
  });

  it("can disable rendered page cache for benchmark comparisons", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as never);
    const doc = makeDoc(
      Array.from({ length: 8 }, () => [100, 1000] as [number, number]),
    );
    doc.pages[0].render.mockImplementation(() => {
      const task = {
        promise: Promise.resolve(),
        cancel: vi.fn(),
      };
      pdfjsMock.renderTasks.push(task);
      return task;
    });
    pdfjsMock.docs.set("/render-cache-disabled.pdf", doc);

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/render-cache-disabled.pdf")}
          defaultScale={1}
          performanceOptions={{ renderedPageCache: false }}
        />,
      );
    });

    await waitFor(() => expect(doc.pages[0].render).toHaveBeenCalledTimes(1));

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    expect(viewport).toBeTruthy();
    let scrollTop = 0;
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value;
      },
    });

    scrollTop = 5200;
    fireEvent.scroll(viewport!);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() =>
      expect(document.querySelector("[data-page-number='1']")).toBeNull(),
    );

    scrollTop = 0;
    fireEvent.scroll(viewport!);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() =>
      expect(document.querySelector("[data-page-number='1']")).toBeTruthy(),
    );
    await waitFor(() => expect(doc.pages[0].render).toHaveBeenCalledTimes(2));
  });

  it("reports completed page render timings", async () => {
    const onPageRenderTiming = vi.fn();
    const page = makePage(100, 200);
    page.render.mockImplementationOnce(() => {
      const task = {
        promise: Promise.resolve(),
        cancel: vi.fn(),
      };
      pdfjsMock.renderTasks.push(task);
      return task;
    });
    const doc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve(page)),
      destroy: vi.fn(() => Promise.resolve()),
    };
    pdfjsMock.docs.set("/render-timing.pdf", doc);

    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 1,
    });

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/render-timing.pdf")}
          defaultScale={1}
          onPageRenderTiming={onPageRenderTiming}
        />,
      );
    });

    await waitFor(() =>
      expect(onPageRenderTiming).toHaveBeenCalledWith(
        expect.objectContaining({
          pageNumber: 1,
          scale: 1,
          rotation: 0,
          devicePixelRatio: 1,
          status: "rendered",
          durationMs: expect.any(Number),
        }),
      ),
    );
  });

  it("preloads page metrics beyond render lookahead without rendering those canvases", async () => {
    const doc = makeDoc([
      [100, 200],
      [100, 200],
      [400, 500],
      [100, 200],
    ]);
    pdfjsMock.docs.set("/metric-preload.pdf", doc);

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/metric-preload.pdf")}
          defaultScale={5}
        />,
      );
    });
    await findByTextContent("Page 1 of 4");

    await waitFor(() => expect(doc.getPage).toHaveBeenCalledWith(3));
    await waitFor(() =>
      expect(
        document.querySelector<HTMLElement>("[data-page-number='3']")?.style
          .width,
      ).toBe("2000px"),
    );

    expect(doc.pages[0].render).toHaveBeenCalledTimes(1);
    expect(doc.pages[1].render).toHaveBeenCalledTimes(1);
    expect(doc.pages[2].render).not.toHaveBeenCalled();
  });

  it("bounds simultaneous visible page canvas renders", async () => {
    const doc = makeDoc([
      [100, 200],
      [100, 200],
      [100, 200],
      [100, 200],
    ]);
    pdfjsMock.docs.set("/render-budget.pdf", doc);

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/render-budget.pdf")}
          defaultScale={1}
        />,
      );
    });
    await findByTextContent("Page 1 of 4");

    await waitFor(() => expect(pdfjsMock.renderTasks).toHaveLength(2));
    expect(doc.pages[0].render).toHaveBeenCalledTimes(1);
    expect(doc.pages[1].render).toHaveBeenCalledTimes(1);
    expect(doc.pages[2].render).not.toHaveBeenCalled();
  });

  it("keeps tiny rendered page canvases drawable", async () => {
    const doc = makeDoc([[1, 1]]);
    const page = doc.pages[0];
    pdfjsMock.docs.set("/tiny-canvas.pdf", doc);

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/tiny-canvas.pdf")}
          defaultScale={0.25}
        />,
      );
    });

    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(1));
    const renderCall = page.render.mock.calls[0]?.[0];
    const canvas = renderCall.canvas as HTMLCanvasElement;

    expect(canvas.width).toBe(1);
    expect(canvas.height).toBe(1);
    expect(canvas.style.width).toBe("0.25px");
    expect(canvas.style.height).toBe("0.25px");
  });

  it("surfaces page render task failures through the viewer error state", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const renderFailure = pdfjsMock.deferred<void>();
    const onPageRenderTiming = vi.fn();
    const page = makePage(100, 200);
    page.render.mockImplementation(() => {
      const task = {
        promise: renderFailure.promise,
        cancel: vi.fn(),
      };
      pdfjsMock.renderTasks.push(task);
      return task;
    });
    const doc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve(page)),
      destroy: vi.fn(() => Promise.resolve()),
    };
    pdfjsMock.docs.set("/render-failed.pdf", doc);

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/render-failed.pdf")}
          onPageRenderTiming={onPageRenderTiming}
        />,
      );
    });
    await waitFor(() => expect(page.render).toHaveBeenCalled());

    await act(async () => {
      renderFailure.reject(new Error("render failed"));
      await Promise.resolve();
    });

    const alert = await screen.findByRole("alert");
    expect(alert.getAttribute("data-error-kind")).toBe("render_failed");
    expect(onPageRenderTiming).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNumber: 1,
        status: "failed",
        durationMs: expect.any(Number),
      }),
    );
  });

  it("normalizes synchronous page render throws as render failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const page = makePage(100, 200);
    page.render.mockImplementationOnce(() => {
      throw new Error("render threw");
    });
    const doc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve(page)),
      destroy: vi.fn(() => Promise.resolve()),
    };
    pdfjsMock.docs.set("/render-throws.pdf", doc);

    await act(async () => {
      render(<PdfViewer source={pdfUrlSource("/render-throws.pdf")} />);
    });

    const alert = await screen.findByRole("alert");
    expect(alert.getAttribute("data-error-kind")).toBe("render_failed");
  });

  it("surfaces a missing page canvas context as a render failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      null as never,
    );
    pdfjsMock.docs.set("/render-no-context.pdf", makeDoc([[100, 200]]));

    await act(async () => {
      render(<PdfViewer source={pdfUrlSource("/render-no-context.pdf")} />);
    });

    const alert = await screen.findByRole("alert");
    expect(alert.getAttribute("data-error-kind")).toBe("render_failed");
  });

  it("cancels stale page render tasks when scale changes and when unmounted", async () => {
    pdfjsMock.docs.set("/cancel-render.pdf", makeDoc([[100, 200]]));
    const onPageRenderTiming = vi.fn();

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfViewer
          source={pdfUrlSource("/cancel-render.pdf")}
          defaultScale={1}
          onPageRenderTiming={onPageRenderTiming}
        />,
      );
    });

    await waitFor(() => expect(pdfjsMock.renderTasks).toHaveLength(1));
    const firstTask = pdfjsMock.renderTasks[0];

    fireEvent.click(screen.getByLabelText("Zoom in"));

    await waitFor(() => expect(pdfjsMock.renderTasks).toHaveLength(2));
    expect(firstTask.cancel).toHaveBeenCalledTimes(1);
    expect(onPageRenderTiming).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNumber: 1,
        status: "cancelled",
        durationMs: expect.any(Number),
      }),
    );

    const secondTask = pdfjsMock.renderTasks[1];
    view.unmount();

    await act(async () => {
      await Promise.resolve();
    });

    expect(secondTask.cancel).toHaveBeenCalledTimes(1);
  });

  it("wires download metadata through the controls anchor", async () => {
    pdfjsMock.docs.set("/signed-pdf", makeDoc([[100, 200]]));

    await act(async () => {
      render(
        <PdfViewer
          source={{
            kind: "url",
            url: "/signed-pdf",
            fileName: "report.pdf",
            downloadUrl: "/download/report.pdf",
          }}
        />,
      );
    });
    await findByTextContent("Page 1 of 1");

    const download = screen.getByLabelText("Download");
    expect(download.tagName).toBe("A");
    expect(download.getAttribute("href")).toBe("/download/report.pdf");
    expect(download.getAttribute("download")).toBe("report.pdf");
  });

  it("shares one document resource between the viewer and thumbnail sidebar", async () => {
    const resource = pdfUrlResource("/shared-sidebar.pdf", "named-shared.pdf");
    pdfjsMock.docs.set(
      "/shared-sidebar.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
      ]),
    );

    render(
      <ViewerRoot className="h-[420px]">
        <ViewerBody>
          <ViewerSidebar width="9rem">
            <PdfThumbnailRail resource={resource} />
          </ViewerSidebar>
          <ViewerSurface>
            <PdfResourceContent resource={resource} />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>,
    );

    await findByTextContent("Page 1 of 2");
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="pdf-viewer-thumbnails"]'),
      ).toBeTruthy(),
    );
    expect(document.querySelector('[data-slot="viewer-sidebar"]')).toBeTruthy();
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(1);
  });

  it("requires PdfViewerThumbnails to read provider state", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<PdfViewerThumbnails />)).toThrow(
      "usePdfViewerThumbnails must be used within PdfViewerProvider.",
    );
  });

  it("requires PdfViewerProvider to receive a source or enclosing FileViewer", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      render(
        <PdfViewerProvider>
          <PdfViewerPages />
        </PdfViewerProvider>,
      ),
    ).toThrow("PdfViewerProvider requires a source or enclosing FileViewer.");
  });

  it("adapts provider state into the thumbnail rail", async () => {
    pdfjsMock.docs.set(
      "/provider-thumbnails.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
      ]),
    );

    render(
      <PdfViewerProvider source={pdfUrlSource("/provider-thumbnails.pdf")}>
        <PdfViewerThumbnails thumbnailWidth={64} />
      </PdfViewerProvider>,
    );

    const firstPage = await screen.findByRole("button", { name: "Page 1" });
    expect(
      document.querySelector('[data-slot="pdf-viewer-thumbnails"]'),
    ).toBeTruthy();
    expect((firstPage.firstElementChild as HTMLElement).style.width).toBe(
      "64px",
    );
  });

  it("keeps controlled thumbnail rail semantics explicit", async () => {
    const onSelectPage = vi.fn();
    const resource = pdfUrlResource("/controlled-thumbnails.pdf");
    pdfjsMock.docs.set(
      "/controlled-thumbnails.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
      ]),
    );

    render(
      <PdfThumbnailRail
        resource={resource}
        currentPage={99}
        onSelectPage={onSelectPage}
        thumbnailWidth={72}
      />,
    );

    const firstPage = await screen.findByRole("button", { name: "Page 1" });
    expect(document.querySelector("[aria-current='page']")).toBeNull();
    expect((firstPage.firstElementChild as HTMLElement).style.width).toBe(
      "72px",
    );

    fireEvent.click(firstPage);
    expect(onSelectPage).toHaveBeenCalledWith(1);
  });

  it("retries a failed thumbnail sidebar document load from its error state", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    pdfjsMock.docs.set(
      "/thumbnail-sidebar-retry.pdf",
      new Error("load failed"),
    );

    await act(async () => {
      render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-sidebar-retry.pdf")}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const alert = await screen.findByRole("alert");
    expect(alert.getAttribute("data-error-kind")).toBe("parse_failed");

    pdfjsMock.docs.set(
      "/thumbnail-sidebar-retry.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
      ]),
    );

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await screen.findByText("2");
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(2);
  });

  it("retries a failed thumbnail page load by reloading the sidebar document", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const firstDoc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.reject(new Error("thumbnail failed"))),
      destroy: vi.fn(() => Promise.resolve()),
    };
    pdfjsMock.docs.set("/thumbnail-page-retry.pdf", firstDoc);

    await act(async () => {
      render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-page-retry.pdf")}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const alert = await screen.findByRole("alert");
    expect(alert.getAttribute("data-error-kind")).toBe("unknown");

    const secondDoc = makeDoc([[100, 200]]);
    pdfjsMock.docs.set("/thumbnail-page-retry.pdf", secondDoc);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await screen.findByText("1");
    await waitFor(() => expect(secondDoc.getPage).toHaveBeenCalledWith(1));
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(2);
    expect(firstDoc.destroy).toHaveBeenCalledTimes(1);
  });

  it("keeps a document retained while one of multiple matching viewers remains mounted", async () => {
    const sharedDoc = makeDoc([[100, 200]]);
    pdfjsMock.docs.set("/shared-viewers.pdf", sharedDoc);

    function Harness({ showFirst }: { showFirst: boolean }) {
      return (
        <>
          {showFirst ? (
            <PdfViewer source={pdfUrlSource("/shared-viewers.pdf")} />
          ) : null}
          <PdfViewer source={pdfUrlSource("/shared-viewers.pdf")} />
        </>
      );
    }

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<Harness showFirst />);
    });
    await waitFor(() =>
      expect(
        screen.getAllByText(
          (_, element) => element?.textContent === "Page 1 of 1",
        ),
      ).toHaveLength(2),
    );
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(1);

    await act(async () => {
      view.rerender(<Harness showFirst={false} />);
    });

    for (let index = 0; index < 7; index += 1) {
      const otherDoc = makeDoc([[100, 200]]);
      pdfjsMock.docs.set(`/shared-viewers-other-${index}.pdf`, otherDoc);
      await getPdfDocumentResource(
        pdfUrlContent(`/shared-viewers-other-${index}.pdf`),
      );
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(sharedDoc.destroy).not.toHaveBeenCalled();
  });

  it("keeps a mounted thumbnail sidebar document retained during cache pruning", async () => {
    const sidebarDoc = makeDoc([
      [100, 200],
      [100, 200],
    ]);
    pdfjsMock.docs.set("/sidebar-retained.pdf", sidebarDoc);

    await act(async () => {
      render(
        <PdfThumbnailRail resource={pdfUrlResource("/sidebar-retained.pdf")} />,
      );
    });
    await screen.findByText("1");

    const otherDocs: ReturnType<typeof makeDoc>[] = [];
    for (let index = 0; index < 7; index += 1) {
      const otherDoc = makeDoc([[100, 200]]);
      otherDocs.push(otherDoc);
      pdfjsMock.docs.set(`/sidebar-other-${index}.pdf`, otherDoc);
      await getPdfDocumentResource(
        pdfUrlContent(`/sidebar-other-${index}.pdf`),
      );
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(otherDocs.some((doc) => doc.destroy.mock.calls.length > 0)).toBe(
      true,
    );
    expect(sidebarDoc.destroy).not.toHaveBeenCalled();
  });

  it("releases the previous thumbnail sidebar document when switching sources", async () => {
    const firstDoc = makeDoc([[100, 200]]);
    const secondDoc = makeDoc([[100, 200]]);
    pdfjsMock.docs.set("/sidebar-switch-first.pdf", firstDoc);
    pdfjsMock.docs.set("/sidebar-switch-second.pdf", secondDoc);

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/sidebar-switch-first.pdf")}
        />,
      );
    });
    await screen.findByText("1");

    await act(async () => {
      view.rerender(
        <PdfThumbnailRail
          resource={pdfUrlResource("/sidebar-switch-second.pdf")}
        />,
      );
    });
    await screen.findByText("1");

    for (let index = 0; index < 6; index += 1) {
      const otherDoc = makeDoc([[100, 200]]);
      pdfjsMock.docs.set(`/sidebar-switch-other-${index}.pdf`, otherDoc);
      await getPdfDocumentResource(
        pdfUrlContent(`/sidebar-switch-other-${index}.pdf`),
      );
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(firstDoc.destroy).toHaveBeenCalledTimes(1);
    expect(secondDoc.destroy).not.toHaveBeenCalled();
  });

  it("marks the active thumbnail and reports selected page clicks", async () => {
    const onSelectPage = vi.fn();
    const doc = makeDoc([
      [100, 200],
      [100, 200],
      [100, 200],
    ]);
    for (const page of doc.pages) {
      page.render.mockImplementation(() => {
        const task = {
          promise: Promise.resolve(),
          cancel: vi.fn(),
        };
        pdfjsMock.renderTasks.push(task);
        return task;
      });
    }
    pdfjsMock.docs.set("/thumbnail-select.pdf", doc);

    const view = render(
      <PdfThumbnailRail
        resource={pdfUrlResource("/thumbnail-select.pdf")}
        currentPage={2}
        onSelectPage={onSelectPage}
      />,
    );
    await screen.findByText("3");

    expect(screen.getByRole("button", { current: "page" }).textContent).toBe(
      "2",
    );
    expect(screen.queryByRole("option")).toBeNull();
    expect(document.querySelector("[aria-selected]")).toBeNull();

    fireEvent.click(screen.getByText("3").closest("button")!);
    expect(onSelectPage).toHaveBeenCalledWith(3);

    view.rerender(
      <PdfThumbnailRail
        resource={pdfUrlResource("/thumbnail-select.pdf")}
        currentPage={3}
        onSelectPage={onSelectPage}
      />,
    );

    expect(screen.getByRole("button", { current: "page" }).textContent).toBe(
      "3",
    );

    view.unmount();
  });

  it("exposes thumbnail rail navigation keyboard shortcuts", async () => {
    const onSelectPage = vi.fn();
    pdfjsMock.docs.set(
      "/thumbnail-keyboard.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
        [100, 200],
      ]),
    );

    render(
      <PdfThumbnailRail
        resource={pdfUrlResource("/thumbnail-keyboard.pdf")}
        currentPage={2}
        onSelectPage={onSelectPage}
      />,
    );
    const rail = await screen.findByRole("navigation", { name: "PDF pages" });

    fireEvent.keyDown(rail, { key: "ArrowDown" });
    fireEvent.keyDown(rail, { key: "ArrowUp" });
    fireEvent.keyDown(rail, { key: "Home" });
    fireEvent.keyDown(rail, { key: "End" });

    expect(onSelectPage).toHaveBeenNthCalledWith(1, 3);
    expect(onSelectPage).toHaveBeenNthCalledWith(2, 1);
    expect(onSelectPage).toHaveBeenNthCalledWith(3, 1);
    expect(onSelectPage).toHaveBeenNthCalledWith(4, 3);
  });

  it("scrolls the thumbnail sidebar to the active page when it leaves the rail viewport", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { restore, scrollTo } = stubElementScrollTo();
    const doc = makeDoc(
      Array.from({ length: 96 }, () => [100, 200] as [number, number]),
    );
    pdfjsMock.docs.set("/thumbnail-follow.pdf", doc);

    try {
      await act(async () => {
        render(
          <PdfThumbnailRail
            resource={pdfUrlResource("/thumbnail-follow.pdf")}
            currentPage={50}
            thumbnailWidth={50}
          />,
        );
      });

      await waitFor(() => expect(scrollTo).toHaveBeenCalled());
    } finally {
      restore();
    }
  });

  it("does not auto-scroll thumbnails while the pointer is inside the rail", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { restore, scrollTo } = stubElementScrollTo();
    const doc = makeDoc(
      Array.from({ length: 96 }, () => [100, 200] as [number, number]),
    );
    pdfjsMock.docs.set("/thumbnail-pointer-follow.pdf", doc);

    try {
      const view = render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-pointer-follow.pdf")}
          currentPage={1}
          thumbnailWidth={50}
        />,
      );
      await screen.findByText("1");

      fireEvent.pointerEnter(
        document.querySelector('[data-slot="pdf-viewer-thumbnails"]')!,
      );
      scrollTo.mockClear();

      view.rerender(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-pointer-follow.pdf")}
          currentPage={50}
          thumbnailWidth={50}
        />,
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("resumes thumbnail follow when the pointer leaves the rail", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { restore, scrollTo } = stubElementScrollTo();
    const doc = makeDoc(
      Array.from({ length: 96 }, () => [100, 200] as [number, number]),
    );
    pdfjsMock.docs.set("/thumbnail-pointer-resume-follow.pdf", doc);

    try {
      const view = render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-pointer-resume-follow.pdf")}
          currentPage={1}
          thumbnailWidth={50}
        />,
      );
      await screen.findByText("1");
      const rail = document.querySelector(
        '[data-slot="pdf-viewer-thumbnails"]',
      )!;

      fireEvent.pointerEnter(rail);
      scrollTo.mockClear();

      view.rerender(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-pointer-resume-follow.pdf")}
          currentPage={50}
          thumbnailWidth={50}
        />,
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(scrollTo).not.toHaveBeenCalled();

      fireEvent.pointerLeave(rail);

      await waitFor(() => expect(scrollTo).toHaveBeenCalled());
    } finally {
      restore();
    }
  });

  it("resumes thumbnail follow after activating a thumbnail inside the rail", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { restore, scrollTo } = stubElementScrollTo();
    const onSelectPage = vi.fn();
    const doc = makeDoc(
      Array.from({ length: 96 }, () => [100, 200] as [number, number]),
    );
    pdfjsMock.docs.set("/thumbnail-activate-resume-follow.pdf", doc);

    try {
      const view = render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-activate-resume-follow.pdf")}
          currentPage={1}
          thumbnailWidth={50}
          onSelectPage={onSelectPage}
        />,
      );
      await screen.findByText("2");
      const rail = document.querySelector(
        '[data-slot="pdf-viewer-thumbnails"]',
      )!;

      fireEvent.pointerEnter(rail);
      fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
      expect(onSelectPage).toHaveBeenCalledWith(2);
      scrollTo.mockClear();

      view.rerender(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-activate-resume-follow.pdf")}
          currentPage={50}
          thumbnailWidth={50}
          onSelectPage={onSelectPage}
        />,
      );

      await waitFor(() => expect(scrollTo).toHaveBeenCalled());
    } finally {
      restore();
    }
  });

  it("does not auto-scroll thumbnails while the user is scrolling the rail", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const { restore, scrollTo } = stubElementScrollTo();
    const doc = makeDoc(
      Array.from({ length: 96 }, () => [100, 200] as [number, number]),
    );
    pdfjsMock.docs.set("/thumbnail-user-scroll-follow.pdf", doc);

    try {
      const view = render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-user-scroll-follow.pdf")}
          currentPage={1}
          thumbnailWidth={50}
        />,
      );
      await screen.findByText("1");
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      now.mockReturnValue(1300);
      fireEvent.scroll(
        document.querySelector('[data-slot="pdf-viewer-thumbnails"]')!,
      );
      scrollTo.mockClear();

      view.rerender(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-user-scroll-follow.pdf")}
          currentPage={50}
          thumbnailWidth={50}
        />,
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
      restore();
    }
  });

  it("virtualizes thumbnail rows for large documents", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const doc = makeDoc(
      Array.from({ length: 96 }, () => [100, 200] as [number, number]),
    );
    pdfjsMock.docs.set("/thumbnail-virtualized.pdf", doc);

    await act(async () => {
      render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-virtualized.pdf")}
          thumbnailWidth={50}
        />,
      );
    });

    await screen.findByText("1");
    await waitFor(() => expect(doc.getPage).toHaveBeenCalledWith(1));

    expect(doc.getPage).not.toHaveBeenCalledWith(96);
    expect(document.querySelectorAll("[data-index]").length).toBeLessThan(96);
    expect(document.querySelectorAll("canvas").length).toBeLessThan(96);
    expect(pdfjsMock.renderTasks.length).toBeLessThan(96);
  });

  it("cancels thumbnail render tasks when thumbnails unmount", async () => {
    pdfjsMock.docs.set("/thumbnail-cancel.pdf", makeDoc([[100, 200]]));

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfThumbnailRail resource={pdfUrlResource("/thumbnail-cancel.pdf")} />,
      );
    });

    await waitFor(() => expect(pdfjsMock.renderTasks).toHaveLength(1));
    const task = pdfjsMock.renderTasks[0];

    view.unmount();

    expect(task.cancel).toHaveBeenCalledTimes(1);
  });

  it("cancels stale thumbnail render tasks when thumbnail width changes", async () => {
    pdfjsMock.docs.set("/thumbnail-width-cancel.pdf", makeDoc([[100, 200]]));

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-width-cancel.pdf")}
          thumbnailWidth={50}
        />,
      );
    });

    await waitFor(() => expect(pdfjsMock.renderTasks).toHaveLength(1));
    const firstTask = pdfjsMock.renderTasks[0];

    view.rerender(
      <PdfThumbnailRail
        resource={pdfUrlResource("/thumbnail-width-cancel.pdf")}
        thumbnailWidth={80}
      />,
    );

    await waitFor(() => expect(pdfjsMock.renderTasks).toHaveLength(2));
    expect(firstTask.cancel).toHaveBeenCalledTimes(1);
  });

  it("renders mounted thumbnails immediately when IntersectionObserver is unavailable", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const doc = makeDoc([[100, 200]]);
    pdfjsMock.docs.set("/thumbnail-no-observer.pdf", doc);

    await act(async () => {
      render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-no-observer.pdf")}
          thumbnailWidth={50}
        />,
      );
    });

    await waitFor(() => expect(doc.getPage).toHaveBeenCalledWith(1));
    const canvas = document.querySelector<HTMLCanvasElement>("canvas");
    expect(canvas).toBeTruthy();
    expect(canvas?.style.width).toBe("50px");
    expect(canvas?.style.height).toBe("100px");
  });

  it("loads only the mounted virtual thumbnail window without IntersectionObserver", async () => {
    const doc = makeDoc(
      Array.from({ length: 96 }, () => [100, 200] as [number, number]),
    );
    pdfjsMock.docs.set("/thumbnail-no-observer-window.pdf", doc);

    vi.stubGlobal(
      "IntersectionObserver",
      class IntersectionObserver {
        constructor() {
          throw new Error("IntersectionObserver should not be used");
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );

    await act(async () => {
      render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-no-observer-window.pdf")}
        />,
      );
    });
    await screen.findByText("1");
    await waitFor(() => expect(doc.getPage).toHaveBeenCalledWith(1));

    expect(doc.getPage).not.toHaveBeenCalledWith(96);
    expect(document.querySelectorAll("[data-index]").length).toBeLessThan(96);
    expect(document.querySelectorAll("canvas").length).toBeLessThan(96);
    expect(pdfjsMock.renderTasks.length).toBeLessThan(96);
  });

  it("cancels thumbnail render tasks when virtual rows unmount", async () => {
    const doc = makeDoc(
      Array.from({ length: 96 }, () => [100, 200] as [number, number]),
    );
    pdfjsMock.docs.set("/thumbnail-virtual-unmount.pdf", doc);

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-virtual-unmount.pdf")}
          thumbnailWidth={50}
        />,
      );
    });
    await waitFor(() =>
      expect(pdfjsMock.renderTasks.length).toBeGreaterThan(0),
    );
    const tasks = [...pdfjsMock.renderTasks];

    view.unmount();

    expect(tasks.some((task) => task.cancel.mock.calls.length > 0)).toBe(true);
  });

  it("sizes thumbnails from intrinsically rotated page viewports", async () => {
    const page = makePage(100, 200, 90);
    const doc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve(page)),
      destroy: vi.fn(() => Promise.resolve()),
    };
    pdfjsMock.docs.set("/thumbnail-rotated.pdf", doc);

    await act(async () => {
      render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-rotated.pdf")}
          thumbnailWidth={50}
        />,
      );
    });

    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(1));
    const canvas = document.querySelector<HTMLCanvasElement>("canvas");
    expect(canvas?.style.width).toBe("50px");
    expect(canvas?.style.height).toBe("25px");
  });

  it("keeps tiny thumbnail canvases drawable", async () => {
    const doc = makeDoc([[1, 1]]);
    const page = doc.pages[0];
    pdfjsMock.docs.set("/thumbnail-tiny-canvas.pdf", doc);

    await act(async () => {
      render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-tiny-canvas.pdf")}
          thumbnailWidth={0.25}
        />,
      );
    });

    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(1));
    const renderCall = page.render.mock.calls[0]?.[0];
    const canvas = renderCall.canvas as HTMLCanvasElement;

    expect(canvas.width).toBe(1);
    expect(canvas.height).toBe(1);
    expect(canvas.style.width).toBe("0.25px");
    expect(canvas.style.height).toBe("0.25px");
  });

  it("surfaces thumbnail render task failures through the sidebar error state", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const page = makePage(100, 200);
    page.render.mockImplementationOnce(() => {
      const task = {
        promise: Promise.reject(new Error("thumbnail render failed")),
        cancel: vi.fn(),
      };
      pdfjsMock.renderTasks.push(task);
      return task;
    });
    const doc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve(page)),
      destroy: vi.fn(() => Promise.resolve()),
    };
    pdfjsMock.docs.set("/thumbnail-render-failed.pdf", doc);

    await act(async () => {
      render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-render-failed.pdf")}
        />,
      );
    });

    const alert = await screen.findByRole("alert");
    expect(alert.getAttribute("data-error-kind")).toBe("render_failed");
  });

  it("normalizes synchronous thumbnail render throws as render failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const page = makePage(100, 200);
    page.render.mockImplementationOnce(() => {
      throw new Error("thumbnail render threw");
    });
    const doc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve(page)),
      destroy: vi.fn(() => Promise.resolve()),
    };
    pdfjsMock.docs.set("/thumbnail-render-throws.pdf", doc);

    await act(async () => {
      render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-render-throws.pdf")}
        />,
      );
    });

    const alert = await screen.findByRole("alert");
    expect(alert.getAttribute("data-error-kind")).toBe("render_failed");
  });

  it("surfaces a missing thumbnail canvas context as a render failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      null as never,
    );
    pdfjsMock.docs.set("/thumbnail-no-context.pdf", makeDoc([[100, 200]]));

    await act(async () => {
      render(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-no-context.pdf")}
        />,
      );
    });

    const alert = await screen.findByRole("alert");
    expect(alert.getAttribute("data-error-kind")).toBe("render_failed");
  });
});
