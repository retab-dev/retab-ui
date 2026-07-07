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
}: {
  pageCount: number;
  pageNumber: number;
  pageSize: { width: number; height: number };
  previousScale: number;
  nextScale: number;
  scrollTop: number;
  viewportHeight: number;
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

  const readingMarkerOffset = viewportHeight * 0.2;
  const pageTopInViewport = previousPage.offsetTop - scrollTop;

  if (Math.abs(pageTopInViewport) <= readingMarkerOffset) {
    return nextPage.offsetTop - Math.round(pageTopInViewport);
  }

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


describe("PdfViewer rendering", () => {
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

  it("renders newly visible pages at final DPR without sharpening after scroll idle", async () => {
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
        value: 1532,
      });

      fireEvent.scroll(viewport!);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(doc.pages[3].render).toHaveBeenCalledTimes(1);
      const renderCall = doc.pages[3].render.mock.calls[0]?.[0];
      const canvas = renderCall.canvas as HTMLCanvasElement;
      expect(canvas.width).toBe(200);
      expect(canvas.height).toBe(2000);
      expect(renderCall.transform).toEqual([2, 0, 0, 2, 0, 0]);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(120);
      });

      expect(doc.pages[3].render).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not pre-render past the visible render window", async () => {
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
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(doc.pages[3].render).not.toHaveBeenCalled();
  });

  it("draws cached page bitmaps on remount without refreshing pdfjs", async () => {
    const drawImage = vi.fn();
    const setTransform = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
      setTransform,
    } as never);
    const onPageRenderTiming = vi.fn();
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
    await waitFor(() =>
      expect(onPageRenderTiming).toHaveBeenCalledWith(
        expect.objectContaining({
          pageNumber: 1,
          source: "pdfjs",
          status: "rendered",
        }),
      ),
    );
    drawImage.mockClear();
    onPageRenderTiming.mockClear();

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
      expect(document.querySelector("[data-pdf-page-number='1']")).toBeNull(),
    );

    scrollTop = 0;
    fireEvent.scroll(viewport!);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() =>
      expect(document.querySelector("[data-pdf-page-number='1']")).toBeTruthy(),
    );
    await waitFor(() =>
      expect(onPageRenderTiming).toHaveBeenCalledWith(
        expect.objectContaining({
          pageNumber: 1,
          source: "cache",
          status: "rendered",
        }),
      ),
    );
    expect(drawImage).toHaveBeenCalled();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(doc.pages[0].render).toHaveBeenCalledTimes(1);
    expect(onPageRenderTiming).not.toHaveBeenCalledWith(
      expect.objectContaining({
        pageNumber: 1,
        source: "pdfjs",
        status: "rendered",
      }),
    );
  });

  it("reuses a rendered viewer page bitmap for later thumbnails", async () => {
    const drawImage = vi.fn();
    const setTransform = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
      setTransform,
    } as never);
    const resource = pdfUrlResource("/viewer-thumbnail-cache.pdf");
    const doc = makeDoc([[100, 200]]);
    doc.pages[0].render.mockImplementation(() => {
      const task = {
        promise: Promise.resolve(),
        cancel: vi.fn(),
      };
      pdfjsMock.renderTasks.push(task);
      return task;
    });
    pdfjsMock.docs.set("/viewer-thumbnail-cache.pdf", doc);

    function Harness({ showThumbnails }: { showThumbnails: boolean }) {
      return (
        <ViewerRoot className="h-[420px]">
          <ViewerBody>
            <ViewerSidebar width="9rem">
              {showThumbnails ? (
                <PdfThumbnailRail resource={resource} thumbnailWidth={50} />
              ) : null}
            </ViewerSidebar>
            <FileViewerInset>
              <FileViewerViewport>
                <PdfResourceContent resource={resource} defaultScale={1} />
              </FileViewerViewport>
            </FileViewerInset>
          </ViewerBody>
        </ViewerRoot>
      );
    }

    const view = render(<Harness showThumbnails={false} />);
    await waitFor(() => expect(doc.pages[0].render).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        document.querySelector("[data-pdf-render-source='pdfjs']"),
      ).toBeTruthy(),
    );

    drawImage.mockClear();
    view.rerender(<Harness showThumbnails />);

    await waitFor(() =>
      expect(document.querySelector("[aria-label='Page 1']")).toBeTruthy(),
    );
    await waitFor(() =>
      expect(
        document.querySelector("[data-pdf-render-source='cache']"),
      ).toBeTruthy(),
    );
    expect(doc.pages[0].render).toHaveBeenCalledTimes(1);
    expect(drawImage).toHaveBeenCalled();
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
      expect(document.querySelector("[data-pdf-page-number='1']")).toBeNull(),
    );

    scrollTop = 0;
    fireEvent.scroll(viewport!);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() =>
      expect(document.querySelector("[data-pdf-page-number='1']")).toBeTruthy(),
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

  it("does not mount off-window page slots before those pages render", async () => {
    const doc = makeDoc([
      [100, 200],
      [100, 200],
      [100, 200],
      [400, 500],
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

    expect(doc.pages[0].render).toHaveBeenCalledTimes(1);
    expect(doc.pages[1].render).toHaveBeenCalledTimes(1);
    expect(doc.pages[2].render).toHaveBeenCalledTimes(1);
    expect(doc.pages[3].render).not.toHaveBeenCalled();
    expect(
      document.querySelector<HTMLElement>("[data-page-number='4']"),
    ).toBeNull();
  });

  it("caps initial page canvas work through the render scheduler", async () => {
    const doc = makeDoc(
      Array.from({ length: 12 }, () => [100, 200] as [number, number]),
    );
    pdfjsMock.docs.set("/render-budget.pdf", doc);

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/render-budget.pdf")}
          defaultScale={1}
        />,
      );
    });
    await findByTextContent("Page 1 of 12");

    await waitFor(() => expect(pdfjsMock.renderTasks).toHaveLength(4));
    expect(doc.pages[0].render).toHaveBeenCalledTimes(1);
    expect(doc.pages[1].render).toHaveBeenCalledTimes(1);
    expect(doc.pages[2].render).toHaveBeenCalledTimes(1);
    expect(doc.pages[3].render).toHaveBeenCalledTimes(1);
    expect(doc.pages[4].render).not.toHaveBeenCalled();
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
});
