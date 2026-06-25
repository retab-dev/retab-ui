// @vitest-environment jsdom

// Edge-case probes for DocxViewer that complement docx-viewer.test.tsx. Each
// test targets an untested boundary (zoom clamps, scale coercion, highlight key
// stability, pre-render imperative calls, the visible-page marker boundary) and
// asserts the behavior the component is documented to have — so a regression in
// any of those paths fails here.

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

import { resetDocxDocumentResourceCacheForTests } from "@/lib/docx-document-resource";
import {
  blobSource,
  clearViewerResourceRegistryForTests,
} from "@/registry/new-york-v4/lib/viewer-resource";
import {
  DocxViewer,
  type DocxViewerHandle,
} from "@/registry/new-york-v4/ui/docx-viewer";
import { resetDocxRenderCacheForTests } from "@/registry/new-york-v4/ui/docx-viewer-render-cache";
import {
  DOCX_PAGE_GAP_PX,
  DOCX_READING_MARKER_RATIO,
  DOCX_VIEWER_PADDING_PX,
} from "@/registry/new-york-v4/ui/docx-viewer-layout";

const docxMock = vi.hoisted(() => ({
  renderAsync: vi.fn(),
  renderedBuffers: [] as ArrayBuffer[],
}));

vi.mock("docx-preview", () => ({
  renderAsync: docxMock.renderAsync,
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let observedContainerWidth = 848;

class ResizeObserverMock {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    setClientWidth(target, observedContainerWidth);
    this.callback(
      [{ target } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

class MockHighlight {
  readonly ranges: Range[];
  constructor(...ranges: Range[]) {
    this.ranges = ranges;
  }
}

const originalGetAnimations = HTMLElement.prototype.getAnimations;
const originalCss = globalThis.CSS;
const originalWindowCss = window.CSS;
const originalHighlight = globalThis.Highlight;
const originalWindowHighlight = window.Highlight;
const originalNodeFilter = globalThis.NodeFilter;

function response(bytes: Uint8Array, init: ResponseInit = {}) {
  return new Response(new Uint8Array(bytes), init);
}

function docxUrlSource(url: string, fileName = "document.docx") {
  return { kind: "url" as const, url, fileName };
}

function docxBlobSource(bytes: Uint8Array, identityKey = "blob:docx") {
  return blobSource(bytes, {
    identityKey,
    fileName: "local.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

function setClientWidth(element: Element, width: number) {
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: width,
  });
}

function setScrollMetrics(
  element: Element,
  {
    clientHeight,
    scrollHeight,
    scrollTop,
  }: { clientHeight: number; scrollHeight: number; scrollTop?: number },
) {
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  if (scrollTop != null) {
    Object.defineProperty(element, "scrollTop", {
      configurable: true,
      writable: true,
      value: scrollTop,
    });
  }
}

function rect(top: number, width = 816, height = 1056): DOMRect {
  return {
    bottom: top + height,
    height,
    left: 0,
    right: width,
    top,
    width,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function installRenderedDocument(
  host: HTMLElement,
  {
    pageTops = [0, 1100],
    pageWidth = 816,
    pageHeight = 1056,
    text = "Quarterly   revenue \nincreased",
  }: {
    pageTops?: number[];
    pageWidth?: number;
    pageHeight?: number;
    text?: string;
  } = {},
) {
  const wrapper = document.createElement("div");
  wrapper.className = "docx-wrapper";
  pageTops.forEach((top, index) => {
    const page = document.createElement("section");
    page.className = "docx";
    page.getBoundingClientRect = vi.fn(() => rect(top, pageWidth, pageHeight));
    if (index === 0) {
      const paragraph = document.createElement("p");
      const [first, second = ""] = text.split("\n");
      paragraph.append(first);
      paragraph.append(document.createElement("span"));
      paragraph.append(second);
      page.append(paragraph);
      const table = document.createElement("table");
      const row = table.insertRow();
      row.insertCell().textContent = "A1";
      row.insertCell().textContent = "Target cell";
      page.append(table);
    } else {
      page.textContent = `Page ${index + 1}`;
    }
    wrapper.append(page);
  });
  host.replaceChildren(wrapper);
}

function installHighlightApi(highlights: Map<string, MockHighlight>) {
  const css = { highlights };
  Object.defineProperty(globalThis, "CSS", { configurable: true, value: css });
  Object.defineProperty(window, "CSS", { configurable: true, value: css });
  Object.defineProperty(globalThis, "Highlight", {
    configurable: true,
    value: MockHighlight,
  });
  Object.defineProperty(window, "Highlight", {
    configurable: true,
    value: MockHighlight,
  });
}

function restoreBrowserGlobal<K extends keyof typeof globalThis>(
  key: K,
  value: (typeof globalThis)[K],
) {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, key);
    return;
  }
  Object.defineProperty(globalThis, key, { configurable: true, value });
}

function restoreWindowGlobal(key: string, value: unknown) {
  if (value === undefined) {
    Reflect.deleteProperty(window, key);
    return;
  }
  Object.defineProperty(window, key, { configurable: true, value });
}

async function renderDocx(ui: React.ReactElement) {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(ui);
  });
  return view;
}

async function waitForRenderedDocx() {
  await screen.findByText("Page 1 of 2");
  await waitFor(() => {
    expect(docxMock.renderAsync).toHaveBeenCalled();
  });
}

beforeEach(() => {
  observedContainerWidth = 848;
  docxMock.renderedBuffers.length = 0;
  docxMock.renderAsync.mockReset();
  docxMock.renderAsync.mockImplementation(async (buffer, host) => {
    docxMock.renderedBuffers.push(buffer);
    installRenderedDocument(host);
  });

  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(response(Uint8Array.of(1, 2, 3)))),
  );

  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "getAnimations", {
    configurable: true,
    value: vi.fn(() => []),
  });
  Object.defineProperty(globalThis, "NodeFilter", {
    configurable: true,
    value: window.NodeFilter,
  });
});

afterEach(() => {
  cleanup();
  resetDocxDocumentResourceCacheForTests();
  resetDocxRenderCacheForTests();
  clearViewerResourceRegistryForTests();
  if (originalGetAnimations) {
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: originalGetAnimations,
    });
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "getAnimations");
  }
  restoreBrowserGlobal("CSS", originalCss);
  restoreWindowGlobal("CSS", originalWindowCss);
  restoreBrowserGlobal("Highlight", originalHighlight);
  restoreWindowGlobal("Highlight", originalWindowHighlight);
  restoreBrowserGlobal("NodeFilter", originalNodeFilter);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DocxViewer zoom + scale coercion", () => {
  it("clamps repeated manual zoom-in to the 500% maximum", async () => {
    await renderDocx(<DocxViewer source={docxUrlSource("/zoom-max.docx")} />);
    await waitForRenderedDocx();

    for (let i = 0; i < 20; i += 1) {
      fireEvent.click(screen.getByLabelText("Zoom in"));
    }

    expect(await screen.findByText("500%")).toBeTruthy();
    const host = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"] .docx-wrapper',
    )?.parentElement;
    expect(host?.style.zoom).toBe("5");
  });

  it("treats a NaN controlled scale as 100%", async () => {
    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/nan-scale.docx")}
        scale={Number.NaN}
      />,
    );
    await waitForRenderedDocx();

    expect(screen.getByText("100%")).toBeTruthy();
    const host = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"] .docx-wrapper',
    )?.parentElement;
    expect(host?.style.zoom).toBe("1");
  });

  it("clamps a zero controlled scale to the 25% minimum", async () => {
    await renderDocx(
      <DocxViewer source={docxUrlSource("/zero-scale.docx")} scale={0} />,
    );
    await waitForRenderedDocx();

    expect(screen.getByText("25%")).toBeTruthy();
    const host = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"] .docx-wrapper',
    )?.parentElement;
    expect(host?.style.zoom).toBe("0.25");
  });

  it("keeps the fit-width zoom inert when zoom-out is clicked under a controlled scale", async () => {
    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/controlled-zoom-out.docx")}
        scale={2}
      />,
    );
    await waitForRenderedDocx();

    fireEvent.click(screen.getByLabelText("Zoom out"));
    fireEvent.click(screen.getByLabelText("Fit width"));

    expect(screen.getByText("200%")).toBeTruthy();
    const host = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"] .docx-wrapper',
    )?.parentElement;
    expect(host?.style.zoom).toBe("2");
  });
});

describe("DocxViewer page count + visible page", () => {
  it('renders a single-page document as "Page 1 of 1"', async () => {
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      installRenderedDocument(host, { pageTops: [0] });
    });

    await renderDocx(
      <DocxViewer source={docxUrlSource("/single-page.docx")} />,
    );

    expect(await screen.findByText("Page 1 of 1")).toBeTruthy();
    const pages = document.querySelectorAll("[data-page-number]");
    expect(pages).toHaveLength(1);
  });

  it("reports the first page as visible once the document becomes ready", async () => {
    const onVisiblePageChange = vi.fn();

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/initial-visible.docx")}
        onVisiblePageChange={onVisiblePageChange}
      />,
    );
    await waitForRenderedDocx();

    await waitFor(() => {
      expect(onVisiblePageChange).toHaveBeenCalledWith(1);
    });
  });

  it("treats a page whose top sits exactly at the marker as the current page", async () => {
    await renderDocx(
      <DocxViewer source={docxUrlSource("/marker-boundary.docx")} />,
    );
    await waitForRenderedDocx();

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    expect(viewport).toBeTruthy();
    const viewportHeight = 500;
    const scrollTop =
      DOCX_VIEWER_PADDING_PX +
      1056 +
      DOCX_PAGE_GAP_PX -
      viewportHeight * DOCX_READING_MARKER_RATIO;
    setScrollMetrics(viewport!, {
      clientHeight: viewportHeight,
      scrollHeight: scrollTop * 2 + viewportHeight,
      scrollTop,
    });

    fireEvent.scroll(viewport!);

    expect(await screen.findByText("Page 2 of 2")).toBeTruthy();
  });
});

describe("DocxViewer imperative handle before render", () => {
  it("does not scroll for a target before the document has rendered", async () => {
    const pending = deferred<void>();
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      // Leave the host empty until the render resolves.
      await pending.promise;
      installRenderedDocument(host);
    });
    const ref = React.createRef<DocxViewerHandle>();

    await renderDocx(
      <DocxViewer
        ref={ref}
        source={docxUrlSource("/pre-render-scroll.docx")}
      />,
    );

    await waitFor(() => {
      expect(docxMock.renderAsync).toHaveBeenCalledTimes(1);
    });

    const scrollIntoView = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    ref.current?.scrollToTarget({ kind: "text", text: "Target cell" });
    ref.current?.scrollToTarget({ kind: "cell", table: 0, row: 0, column: 1 });

    expect(scrollIntoView).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    await waitForRenderedDocx();
  });

  it("exposes the viewport element while the document is still rendering", async () => {
    const pending = deferred<void>();
    docxMock.renderAsync.mockImplementationOnce(async (_buffer, host) => {
      await pending.promise;
      installRenderedDocument(host);
    });
    const ref = React.createRef<DocxViewerHandle>();

    await renderDocx(
      <DocxViewer
        ref={ref}
        source={docxUrlSource("/viewport-during-render.docx")}
      />,
    );

    await waitFor(() => {
      expect(docxMock.renderAsync).toHaveBeenCalledTimes(1);
    });

    const viewport = document.querySelector(
      '[data-slot="scroll-area-viewport"]',
    );
    expect(viewport).toBeTruthy();
    expect(ref.current?.getViewportElement()).toBe(viewport);

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    await waitForRenderedDocx();
  });
});

describe("DocxViewer highlight target keys", () => {
  it("builds the text index on first imperative text target and reuses it", async () => {
    const ref = React.createRef<DocxViewerHandle>();

    await renderDocx(
      <DocxViewer ref={ref} source={docxUrlSource("/indexed-scroll.docx")} />,
    );
    await waitForRenderedDocx();

    const scrollIntoView = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    ref.current?.scrollToTarget(
      { kind: "text", text: "revenue increased" },
      { behavior: "auto" },
    );
    ref.current?.scrollToTarget(
      { kind: "text", text: "revenue increased" },
      { behavior: "auto" },
    );
    ref.current?.scrollToTarget(
      { kind: "cell", table: 0, row: 0, column: 1 },
      { behavior: "auto" },
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(3);
    expect(docxMock.renderAsync).toHaveBeenCalledTimes(1);
  });

  it("builds the text index once and reuses it for highlight changes", async () => {
    const highlights = new Map<string, MockHighlight>();
    installHighlightApi(highlights);

    const view = await renderDocx(
      <DocxViewer source={docxUrlSource("/indexed-highlight.docx")} />,
    );
    await waitForRenderedDocx();

    await act(async () => {
      view.rerender(
        <DocxViewer
          source={docxUrlSource("/indexed-highlight.docx")}
          highlight={{ kind: "text", text: "revenue increased" }}
        />,
      );
    });
    await waitFor(() => {
      expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
        "revenue increased",
      );
    });

    await act(async () => {
      view.rerender(
        <DocxViewer
          source={docxUrlSource("/indexed-highlight.docx")}
          highlight={{ kind: "text", text: "Target cell" }}
        />,
      );
    });
    await waitFor(() => {
      expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
        "Target cell",
      );
    });

    expect(docxMock.renderAsync).toHaveBeenCalledTimes(1);
  });

  it("does not recreate a cell highlight across re-renders with an equal target", async () => {
    const highlights = new Map<string, MockHighlight>();
    const set = vi.spyOn(highlights, "set");
    installHighlightApi(highlights);

    const view = await renderDocx(
      <DocxViewer
        source={docxUrlSource("/stable-cell-highlight.docx")}
        highlight={{ kind: "cell", table: 0, row: 0, column: 1 }}
      />,
    );
    await waitForRenderedDocx();
    await waitFor(() => {
      expect(set).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      view.rerender(
        <DocxViewer
          source={docxUrlSource("/stable-cell-highlight.docx")}
          highlight={{ kind: "cell", table: 0, row: 0, column: 1 }}
        />,
      );
    });

    expect(set).toHaveBeenCalledTimes(1);
    expect(highlights.size).toBe(1);
    expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
      "Target cell",
    );
  });

  it("moves the highlight when the target switches from text to cell", async () => {
    const highlights = new Map<string, MockHighlight>();
    installHighlightApi(highlights);

    const view = await renderDocx(
      <DocxViewer
        source={docxUrlSource("/switch-highlight.docx")}
        highlight={{ kind: "text", text: "revenue increased" }}
      />,
    );
    await waitForRenderedDocx();
    await waitFor(() => {
      expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
        "revenue increased",
      );
    });

    await act(async () => {
      view.rerender(
        <DocxViewer
          source={docxUrlSource("/switch-highlight.docx")}
          highlight={{ kind: "cell", table: 0, row: 0, column: 1 }}
        />,
      );
    });

    await waitFor(() => {
      expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
        "Target cell",
      );
    });
  });

  it("ignores a whitespace-only text highlight target", async () => {
    const highlights = new Map<string, MockHighlight>();
    installHighlightApi(highlights);

    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/blank-highlight.docx")}
        highlight={{ kind: "text", text: "   \n\t  " }}
      />,
    );
    await waitForRenderedDocx();

    // No exception, no highlight registered for an empty needle.
    await waitFor(() => {
      expect(docxMock.renderAsync).toHaveBeenCalled();
    });
    expect(highlights.size).toBe(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("no-ops imperative scrolling for a whitespace-only text target", async () => {
    const ref = React.createRef<DocxViewerHandle>();

    await renderDocx(
      <DocxViewer ref={ref} source={docxUrlSource("/blank-scroll.docx")} />,
    );
    await waitForRenderedDocx();

    const scrollIntoView = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    ref.current?.scrollToTarget({ kind: "text", text: "    " });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("highlights a Blob-sourced document's text target", async () => {
    const highlights = new Map<string, MockHighlight>();
    installHighlightApi(highlights);

    await renderDocx(
      <DocxViewer
        source={docxBlobSource(Uint8Array.of(1, 2, 3), "blob:highlight")}
        highlight={{ kind: "text", text: "revenue increased" }}
      />,
    );
    await waitForRenderedDocx();

    await waitFor(() => {
      expect(highlights.size).toBe(1);
    });
    expect([...highlights.values()][0]?.ranges[0]?.toString()).toBe(
      "revenue increased",
    );
  });
});

describe("DocxViewer layout props on the happy path", () => {
  it("applies bare styling to a successfully rendered viewer", async () => {
    await renderDocx(
      <DocxViewer source={docxUrlSource("/bare-success.docx")} bare />,
    );
    await waitForRenderedDocx();

    const viewer = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"]',
    );
    expect(viewer).toBeTruthy();
    expect(viewer!.className).toContain("bg-muted/20");
    expect(viewer!.className).not.toContain("rounded-xl");
    expect(viewer!.className).not.toContain("border");
  });

  it("forwards className onto the rendered viewer container", async () => {
    await renderDocx(
      <DocxViewer
        source={docxUrlSource("/classname.docx")}
        className="custom-docx-class"
      />,
    );
    await waitForRenderedDocx();

    const viewer = document.querySelector<HTMLElement>(
      '[data-slot="docx-viewer"]',
    );
    expect(viewer?.className).toContain("custom-docx-class");
  });
});
