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


describe("PdfViewer document lifecycle", () => {
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

    expect(await screen.findByText("208%")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(await screen.findByText("250%")).toBeTruthy();

    await act(async () => {
      view.rerender(
        <PdfViewer source={pdfUrlSource("/fit-reset-second.pdf")} />,
      );
    });

    expect(await screen.findByText("416%")).toBeTruthy();
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
            <FileViewerContent>
              <FileViewerSidebar>Composed sidebar</FileViewerSidebar>
              <FileViewerInset>
                <PdfViewerPages bare className="h-full" />
              </FileViewerInset>
            </FileViewerContent>
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
    const pdfDocument = await getPdfDocumentResource(
      pdfUrlContent("/detached-header-performance.pdf"),
    );
    await Promise.all(
      [1, 2].map((pageNumber) => getPdfPageResource(pdfDocument, pageNumber)),
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

    await act(async () => {
      render(
        <FileViewer source={source} defaultOpen>
          <PdfViewerProvider>
            <FileViewerHeader>
              <FileViewerTitle />
              <FileViewerControls />
            </FileViewerHeader>
            <FileViewerContent>
              <FileViewerSidebar aria-label="PDF pages">
                <CountingThumbnails />
              </FileViewerSidebar>
              <FileViewerInset>
                <PdfViewerPages bare className="h-full" defaultScale={1} />
              </FileViewerInset>
            </FileViewerContent>
          </PdfViewerProvider>
        </FileViewer>,
      );
    });

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
    const pdfDocument = await getPdfDocumentResource(
      pdfUrlContent("/scroll-composed-performance.pdf"),
    );
    await Promise.all(
      [1, 2, 3].map((pageNumber) =>
        getPdfPageResource(pdfDocument, pageNumber),
      ),
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

    await act(async () => {
      render(
        <FileViewer source={source} defaultOpen>
          <PdfViewerProvider>
            <FileViewerHeader>
              <FileViewerTitle />
              <FileViewerControls />
            </FileViewerHeader>
            <FileViewerContent>
              <FileViewerSidebar aria-label="PDF pages">
                <CountingThumbnails />
              </FileViewerSidebar>
              <FileViewerInset>
                <PdfViewerPages bare className="h-full" />
              </FileViewerInset>
            </FileViewerContent>
          </PdfViewerProvider>
        </FileViewer>,
      );
    });

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
      value: 1300,
      writable: true,
    });
    viewport!.getBoundingClientRect = () =>
      ({ top: 0, height: 500 }) as DOMRect;

    await act(async () => {
      fireEvent.scroll(viewport!);
    });

    expect(await findByTextContent("Page 2 of 3")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole("button", { current: "page" }).textContent).toBe(
        "2",
      ),
    );
    expect(counts.thumbnailMounts).toBe(initialThumbnailMounts);
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(initialDocumentLoads);
  });

});
