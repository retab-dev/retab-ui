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


describe("PdfViewer thumbnails", () => {
  it("shares one document resource between the viewer load and thumbnail sidebar", async () => {
    const resource = pdfUrlResource("/shared-sidebar.pdf", "named-shared.pdf");
    pdfjsMock.docs.set(
      "/shared-sidebar.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
      ]),
    );

    const viewerDocument = await getPdfDocumentResource(resource.content);

    render(
      <ViewerRoot className="h-[420px]">
        <ViewerBody>
          <ViewerSidebar width="9rem">
            <PdfThumbnailRail resource={resource} />
          </ViewerSidebar>
        </ViewerBody>
      </ViewerRoot>,
    );

    expect(viewerDocument.numPages).toBe(2);
    await screen.findByText("1");
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

      await waitFor(() =>
        expect(scrollTo).toHaveBeenCalledWith(
          expect.objectContaining({ behavior: "auto" }),
        ),
      );
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
      await screen.findByText("12");
      const rail = document.querySelector(
        '[data-slot="pdf-viewer-thumbnails"]',
      )!;

      fireEvent.pointerEnter(rail);
      fireEvent.click(screen.getByRole("button", { name: "Page 12" }));
      expect(onSelectPage).toHaveBeenCalledWith(12);
      expect(scrollTo).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: "smooth" }),
      );
      scrollTo.mockClear();

      view.rerender(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-activate-resume-follow.pdf")}
          currentPage={50}
          thumbnailWidth={50}
          onSelectPage={onSelectPage}
        />,
      );

      await waitFor(() =>
        expect(scrollTo).toHaveBeenCalledWith(
          expect.objectContaining({ behavior: "auto" }),
        ),
      );
    } finally {
      restore();
    }
  });

  it("keeps user-scrolled thumbnails free until the current page changes", async () => {
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
      const rail = document.querySelector(
        '[data-slot="pdf-viewer-thumbnails"]',
      )!;

      fireEvent.pointerLeave(rail);
      fireEvent.pointerEnter(rail);
      fireEvent.pointerLeave(rail);
      expect(scrollTo).not.toHaveBeenCalled();

      view.rerender(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-user-scroll-follow.pdf")}
          currentPage={1}
          thumbnailWidth={50}
        />,
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(scrollTo).not.toHaveBeenCalled();

      view.rerender(
        <PdfThumbnailRail
          resource={pdfUrlResource("/thumbnail-user-scroll-follow.pdf")}
          currentPage={50}
          thumbnailWidth={50}
        />,
      );

      await waitFor(() => expect(scrollTo).toHaveBeenCalled());
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
    expect(
      document.querySelector('[data-slot="pdf-thumbnail-sticky-window"]'),
    ).toBeTruthy();

    const rail = document.querySelector<HTMLElement>(
      '[data-slot="pdf-viewer-thumbnails"]',
    );
    const documentSlot = document.querySelector<HTMLElement>(
      '[data-slot="pdf-thumbnail-document"]',
    );
    const beforeSpacer = document.querySelector<HTMLElement>(
      '[data-slot="pdf-thumbnail-window-before"]',
    );
    const stickyWindow = document.querySelector<HTMLElement>(
      '[data-slot="pdf-thumbnail-sticky-window"]',
    );
    const renderWindow = document.querySelector<HTMLElement>(
      '[data-slot="pdf-thumbnail-window"]',
    );
    const afterSpacer = document.querySelector<HTMLElement>(
      '[data-slot="pdf-thumbnail-window-after"]',
    );

    expect(rail?.style.overflowAnchor).toBe("none");
    expect(documentSlot?.getAttribute("style")).toContain(
      "contain: layout style",
    );
    expect(beforeSpacer?.getAttribute("style")).toContain(
      "contain: layout size",
    );
    expect(stickyWindow?.getAttribute("style")).toContain(
      "contain: layout style inline-size",
    );
    expect(stickyWindow?.getAttribute("style")).toContain("isolation: isolate");
    expect(renderWindow?.getAttribute("style")).toContain(
      "contain: layout style",
    );
    expect(afterSpacer?.getAttribute("style")).toContain(
      "contain: layout size",
    );
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
