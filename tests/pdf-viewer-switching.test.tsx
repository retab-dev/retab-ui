// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getPdfDocumentResource,
  resetPdfDocumentResourceCacheForTests,
} from "@/lib/pdf-document-resource";
import {
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource";
import { PdfViewer } from "@/registry/new-york-v4/ui/pdf-viewer";

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
      const task = { promise: new Promise<void>(() => {}), cancel: vi.fn() };
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
      return { promise: pending.promise };
    },
  );
  pdfjsMock.GlobalWorkerOptions.workerSrc = undefined;
  resetPdfDocumentResourceCacheForTests();

  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    {} as never,
  );
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
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

function findByTextContent(text: string) {
  return screen.findByText((_, element) => element?.textContent === text);
}

describe("PdfViewer — rapid source switching with concurrent in-flight loads", () => {
  it("settles on the last source when earlier loads are still pending, destroying the abandoned ones", async () => {
    const docA = makeDoc([[100, 200]]); // 1 page
    const docB = makeDoc([
      [100, 200],
      [100, 200],
    ]); // 2 pages
    const docC = makeDoc([
      [100, 200],
      [100, 200],
      [100, 200],
    ]); // 3 pages

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfViewer source={pdfUrlSource("/A.pdf")} defaultScale={1} />,
      );
    });
    // A and B both left pending; we land on C.
    await act(async () => {
      view.rerender(
        <PdfViewer source={pdfUrlSource("/B.pdf")} defaultScale={1} />,
      );
    });
    await act(async () => {
      view.rerender(
        <PdfViewer source={pdfUrlSource("/C.pdf")} defaultScale={1} />,
      );
    });

    // Resolve C first — the viewer should show C's 3 pages.
    await act(async () => {
      pdfjsMock.pending.get("/C.pdf")?.resolve(docC);
      await Promise.resolve();
    });
    expect(await findByTextContent("Page 1 of 3")).toBeTruthy();

    // Now the abandoned A and B resolve late. They must not hijack the view:
    // the viewer never retained them (they never committed), so they settle
    // quietly into the LRU cache instead of replacing C.
    await act(async () => {
      pdfjsMock.pending.get("/A.pdf")?.resolve(docA);
      pdfjsMock.pending.get("/B.pdf")?.resolve(docB);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await findByTextContent("Page 1 of 3")).toBeTruthy();
    // The active document C is retained and never destroyed; the abandoned
    // loads are cached for reuse (cache holds 3 ≤ max 6), not destroyed.
    expect(docC.destroy).not.toHaveBeenCalled();
    expect(docA.destroy).not.toHaveBeenCalled();
    expect(docB.destroy).not.toHaveBeenCalled();
  });

  it("evicts the abandoned (unretained) loads once the cache exceeds its limit", async () => {
    const abandoned = makeDoc([[100, 200]]);
    const active = makeDoc([
      [100, 200],
      [100, 200],
    ]);

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfViewer source={pdfUrlSource("/abandoned.pdf")} defaultScale={1} />,
      );
    });
    await act(async () => {
      view.rerender(
        <PdfViewer source={pdfUrlSource("/active.pdf")} defaultScale={1} />,
      );
    });
    await act(async () => {
      pdfjsMock.pending.get("/active.pdf")?.resolve(active);
      pdfjsMock.pending.get("/abandoned.pdf")?.resolve(abandoned);
      await Promise.resolve();
    });
    expect(await findByTextContent("Page 1 of 2")).toBeTruthy();
    expect(abandoned.destroy).not.toHaveBeenCalled();

    // Load enough additional documents to push the cache past its limit. The
    // retained active document survives; the unretained abandoned one is evicted.
    for (let i = 0; i < 6; i++) {
      pdfjsMock.docs.set(`/filler-${i}.pdf`, makeDoc([[100, 200]]));
      await act(async () => {
        await getPdfDocumentResource(
          createViewerResource(pdfUrlSource(`/filler-${i}.pdf`)).content,
        );
      });
    }

    await waitFor(() => expect(abandoned.destroy).toHaveBeenCalledTimes(1));
    expect(active.destroy).not.toHaveBeenCalled();
  });

  it("shows a cached document immediately when switching back to it mid-pending", async () => {
    const docA = makeDoc([[100, 200]]); // 1 page
    pdfjsMock.docs.set("/cached-A.pdf", docA);

    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <PdfViewer source={pdfUrlSource("/cached-A.pdf")} defaultScale={1} />,
      );
    });
    expect(await findByTextContent("Page 1 of 1")).toBeTruthy();
    const loadCallsAfterA = pdfjsMock.getDocument.mock.calls.length;

    // Switch to a never-resolving B, then back to the cached A.
    await act(async () => {
      view.rerender(
        <PdfViewer source={pdfUrlSource("/pending-B.pdf")} defaultScale={1} />,
      );
    });
    await act(async () => {
      view.rerender(
        <PdfViewer source={pdfUrlSource("/cached-A.pdf")} defaultScale={1} />,
      );
    });

    // A is served from cache — shown immediately, no extra getDocument for A.
    expect(await findByTextContent("Page 1 of 1")).toBeTruthy();
    const aLoads = pdfjsMock.getDocument.mock.calls.filter(
      ([src]) => src === "/cached-A.pdf",
    ).length;
    expect(aLoads).toBe(
      pdfjsMock.getDocument.mock.calls
        .slice(0, loadCallsAfterA)
        .filter(([src]) => src === "/cached-A.pdf").length,
    );
    expect(docA.destroy).not.toHaveBeenCalled();
  });
});
