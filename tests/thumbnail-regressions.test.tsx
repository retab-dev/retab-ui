// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import * as React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ViewerResource } from "@/lib/viewer-resource";
import { FileThumbnail } from "@/components/ui/file-thumbnail";
import { DocxFirstPage } from "@/components/file-thumbnail/renderers/docx-thumbnail";
import {
  GridTable,
  IframeDoc,
} from "@/components/file-thumbnail/renderers/layout";
import { MarkdownFirstPage } from "@/components/file-thumbnail/renderers/markdown-thumbnail";
import {
  decodeMsgHtmlBytes,
  msgFieldsToHtml,
} from "@/components/file-thumbnail/renderers/msg-thumbnail";
import { PdfFirstPage } from "@/components/file-thumbnail/renderers/pdf-thumbnail";
import { PptxFirstSlide } from "@/components/file-thumbnail/renderers/pptx-thumbnail";
import { TextThumbnail } from "@/components/file-thumbnail/renderers/text-thumbnail";
import { TiffFirstPage } from "@/components/file-thumbnail/renderers/tiff-thumbnail";
import { XlsxFirstSheet } from "@/components/file-thumbnail/renderers/xlsx-thumbnail";
import { clearThumbnailCachesForTests } from "@/components/file-thumbnail/thumbnail-test-reset";

const rendererMocks = vi.hoisted(() => ({
  pdf: {
    documentPromise: Promise.resolve({}),
    pagePromise: Promise.resolve({}),
    getPdfDocumentResource: vi.fn(),
    getPdfPageResource: vi.fn(),
  },
  docx: {
    bytesPromise: Promise.resolve(new ArrayBuffer(4)),
    renderAsync: vi.fn(),
  },
  pptx: {
    destroy: vi.fn(),
    getSlideCount: vi.fn(() => 1),
    getSlideDimensions: vi.fn(() => ({ cx: 9144000, cy: 6858000 })),
    loadFile: vi.fn(),
    renderSlide: vi.fn(),
    dispose: vi.fn(),
  },
  markdown: {
    parse: vi.fn(),
    sanitize: vi.fn(),
  },
}));

vi.mock("@/lib/pdf-document-resource", () => ({
  getPdfDocumentResource: rendererMocks.pdf.getPdfDocumentResource,
  getPdfPageResource: rendererMocks.pdf.getPdfPageResource,
}));

vi.mock("@/lib/docx-document-resource", () => ({
  getDocxDocumentResource: vi.fn(() => rendererMocks.docx.bytesPromise),
}));

vi.mock("docx-preview", () => ({
  renderAsync: rendererMocks.docx.renderAsync,
}));

vi.mock("pptxviewjs", () => ({
  PPTXViewer: class {
    destroy = rendererMocks.pptx.destroy;
    getSlideCount = rendererMocks.pptx.getSlideCount;
    getSlideDimensions = rendererMocks.pptx.getSlideDimensions;
    loadFile = rendererMocks.pptx.loadFile;
    renderSlide = rendererMocks.pptx.renderSlide;
    dispose = rendererMocks.pptx.dispose;
  },
}));

vi.mock("marked", () => ({
  marked: {
    parse: rendererMocks.markdown.parse,
  },
}));

vi.mock("dompurify", () => ({
  default: {
    sanitize: rendererMocks.markdown.sanitize,
  },
  sanitize: rendererMocks.markdown.sanitize,
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (error: unknown) => void;
}

function deferred<T = void>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: unknown) => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    if (this.state.failed) return <div data-testid="thumbnail-error" />;
    return this.props.children;
  }
}

function renderWithBoundary(
  children: React.ReactNode,
  onError: (error: unknown) => void = vi.fn(),
) {
  const view = render(boundaryTree(children, onError));
  return { onError, view };
}

function boundaryTree(
  children: React.ReactNode,
  onError: (error: unknown) => void = vi.fn(),
) {
  return (
    <ErrorBoundary onError={onError}>
      <React.Suspense fallback={<div data-testid="thumbnail-loading" />}>
        {children}
      </React.Suspense>
    </ErrorBoundary>
  );
}

function thumbnailResource(overrides: Partial<ViewerResource> = {}) {
  return {
    fileName: "thumbnail.bin",
    mimeType: "application/octet-stream",
    sourceKind: "blob",
    content: {
      key: "thumbnail-content",
      sourceKind: "blob",
      readBytes: vi.fn(async () => new ArrayBuffer(8)),
    },
    originalDownload: { isDisabled: true },
    ...overrides,
  } as unknown as ViewerResource;
}

function textThumbnailResource({
  fileName,
  key,
  readRange,
  mimeType = "text/plain",
}: {
  fileName: string;
  key: string;
  readRange: ViewerResource["content"]["readRange"];
  mimeType?: string;
}) {
  return thumbnailResource({
    fileName,
    mimeType,
    content: {
      key,
      sourceKind: "blob",
      readRange,
      readStream: vi.fn(),
    } as unknown as ViewerResource["content"],
  });
}

function bytesThumbnailResource({
  fileName,
  key,
  readBytes,
}: {
  fileName: string;
  key: string;
  readBytes: ViewerResource["content"]["readBytes"];
}) {
  return thumbnailResource({
    fileName,
    content: {
      key,
      sourceKind: "blob",
      readBytes,
    } as unknown as ViewerResource["content"],
  });
}

function encodedRange(text: string) {
  return {
    buffer: new TextEncoder().encode(text).buffer,
    contentRange: {
      start: 0,
      end: Math.max(text.length - 1, 0),
      total: text.length,
    },
    isComplete: true,
  };
}

class ResizeObserverMock {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback(
      [{ target, contentRect: { width: 320 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

class ThumbnailWorkerMock {
  static instances: ThumbnailWorkerMock[] = [];

  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: unknown[] = [];
  terminate = vi.fn();

  constructor() {
    ThumbnailWorkerMock.instances.push(this);
  }

  postMessage(message: unknown) {
    this.messages.push(message);
  }

  deliver(data: unknown) {
    this.onmessage?.({ data } as MessageEvent<unknown>);
  }
}

const restoreCallbacks: Array<() => void> = [];

function stubUrlStatic<K extends keyof typeof URL>(
  key: K,
  value: (typeof URL)[K],
) {
  const hadOwnValue = Object.prototype.hasOwnProperty.call(URL, key);
  const originalValue = URL[key];
  Object.defineProperty(URL, key, {
    configurable: true,
    value,
  });
  restoreCallbacks.push(() => {
    if (hadOwnValue) {
      Object.defineProperty(URL, key, {
        configurable: true,
        value: originalValue,
      });
    } else {
      delete (URL as unknown as Record<string, unknown>)[key];
    }
  });
}

beforeEach(() => {
  rendererMocks.pdf.documentPromise = Promise.resolve({});
  rendererMocks.pdf.pagePromise = Promise.resolve({});
  rendererMocks.pdf.getPdfDocumentResource.mockReset();
  rendererMocks.pdf.getPdfDocumentResource.mockImplementation(
    () => rendererMocks.pdf.documentPromise,
  );
  rendererMocks.pdf.getPdfPageResource.mockReset();
  rendererMocks.pdf.getPdfPageResource.mockImplementation(
    () => rendererMocks.pdf.pagePromise,
  );
  rendererMocks.docx.bytesPromise = Promise.resolve(new ArrayBuffer(4));
  rendererMocks.docx.renderAsync.mockReset();
  rendererMocks.pptx.destroy.mockReset();
  rendererMocks.pptx.getSlideCount.mockReset();
  rendererMocks.pptx.getSlideCount.mockReturnValue(1);
  rendererMocks.pptx.getSlideDimensions.mockReset();
  rendererMocks.pptx.getSlideDimensions.mockReturnValue({
    cx: 9144000,
    cy: 6858000,
  });
  rendererMocks.pptx.loadFile.mockReset();
  rendererMocks.pptx.renderSlide.mockReset();
  rendererMocks.pptx.dispose.mockReset();
  rendererMocks.markdown.parse.mockReset();
  rendererMocks.markdown.parse.mockImplementation(
    async (text: string) => `<p>${text}</p>`,
  );
  rendererMocks.markdown.sanitize.mockReset();
  rendererMocks.markdown.sanitize.mockImplementation((html: string) => html);

  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("Worker", ThumbnailWorkerMock);
  ThumbnailWorkerMock.instances = [];
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: vi.fn(() => ({})),
  });
});

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
  clearThumbnailCachesForTests();
  while (restoreCallbacks.length) restoreCallbacks.pop()?.();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("thumbnail table styling", () => {
  it("keeps CSV and XLSX table text readable inside dark UI", () => {
    const { container } = render(
      <div className="dark">
        <GridTable
          headerRow
          rows={[
            ["date", "order_id"],
            ["2024-11-23", "ORD-100"],
          ]}
        />
      </div>,
    );

    const cells = Array.from(container.querySelectorAll("td"));
    expect(cells).toHaveLength(4);
    expect(cells[0].className).toContain("text-slate-900");
    expect(cells[0].className).not.toContain("text-foreground");
    expect(cells[2].className).toContain("text-slate-700");
    expect(cells[2].className).not.toContain("text-foreground");
  });
});

describe("markdown thumbnail styling", () => {
  it("uses the resolved dark palette without reparsing markdown", async () => {
    document.documentElement.classList.add("dark");
    const resource = textThumbnailResource({
      fileName: "release-notes.md",
      key: "markdown-dark-mode",
      mimeType: "text/markdown",
      readRange: vi.fn(async () =>
        encodedRange("Dark app chrome should theme markdown thumbnails."),
      ),
    });

    const { view } = renderWithBoundary(
      <MarkdownFirstPage
        resource={resource}
        thumbnailKey="markdown-dark-mode"
      />,
    );

    await waitFor(() => {
      expect(view.container.querySelector("iframe")?.srcdoc).toContain(
        'data-color-scheme="dark"',
      );
    });

    const iframe = view.container.querySelector("iframe");
    expect(iframe?.srcdoc).toContain("--md-bg:#111113");
    expect(iframe?.srcdoc).toContain("--md-fg:#e4e4e7");
    expect(rendererMocks.markdown.parse).toHaveBeenCalledTimes(1);

    await act(async () => {
      document.documentElement.classList.remove("dark");
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(iframe?.srcdoc).toContain('data-color-scheme="light"');
    });
    expect(iframe?.srcdoc).toContain("--md-bg:#ffffff");
    expect(rendererMocks.markdown.parse).toHaveBeenCalledTimes(1);
  });
});

describe("thumbnail stale async regressions", () => {
  it("ignores a late text range response after the thumbnail resource changes", async () => {
    const onError = vi.fn();
    const firstRead =
      deferred<Awaited<ReturnType<ViewerResource["content"]["readRange"]>>>();
    const secondRead =
      deferred<Awaited<ReturnType<ViewerResource["content"]["readRange"]>>>();
    const firstResource = textThumbnailResource({
      fileName: "first.txt",
      key: "text-first",
      readRange: vi.fn(() => firstRead.promise),
    });
    const secondResource = textThumbnailResource({
      fileName: "second.txt",
      key: "text-second",
      readRange: vi.fn(() => secondRead.promise),
    });

    const { view } = renderWithBoundary(
      <TextThumbnail
        key="text-first"
        resource={firstResource}
        thumbnailKey="text-first"
      />,
      onError,
    );

    view.rerender(
      boundaryTree(
        <TextThumbnail
          key="text-second"
          resource={secondResource}
          thumbnailKey="text-second"
        />,
        onError,
      ),
    );

    await act(async () => {
      secondRead.resolve(encodedRange("current text"));
      await secondRead.promise;
    });

    expect(await screen.findByText("current text")).not.toBeNull();

    await act(async () => {
      firstRead.resolve(encodedRange("stale text"));
      await firstRead.promise;
    });

    expect(screen.getByText("current text")).not.toBeNull();
    expect(screen.queryByText("stale text")).toBeNull();
    expect(screen.queryByTestId("thumbnail-error")).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late text range rejection after the thumbnail resource changes", async () => {
    const onError = vi.fn();
    const firstRead =
      deferred<Awaited<ReturnType<ViewerResource["content"]["readRange"]>>>();
    const secondRead =
      deferred<Awaited<ReturnType<ViewerResource["content"]["readRange"]>>>();
    const firstResource = textThumbnailResource({
      fileName: "first-reject.txt",
      key: "text-first-reject",
      readRange: vi.fn(() => firstRead.promise),
    });
    const secondResource = textThumbnailResource({
      fileName: "second-reject.txt",
      key: "text-second-reject",
      readRange: vi.fn(() => secondRead.promise),
    });

    const { view } = renderWithBoundary(
      <TextThumbnail
        key="text-first-reject"
        resource={firstResource}
        thumbnailKey="text-first-reject"
      />,
      onError,
    );

    view.rerender(
      boundaryTree(
        <TextThumbnail
          key="text-second-reject"
          resource={secondResource}
          thumbnailKey="text-second-reject"
        />,
        onError,
      ),
    );

    await act(async () => {
      secondRead.resolve(encodedRange("current after reject"));
      await secondRead.promise;
    });

    expect(await screen.findByText("current after reject")).not.toBeNull();

    const swallowed = firstRead.promise.catch(() => undefined);
    await act(async () => {
      firstRead.reject(new Error("stale text read failed"));
      await swallowed;
    });

    expect(screen.getByText("current after reject")).not.toBeNull();
    expect(screen.queryByTestId("thumbnail-error")).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late text range response after unmount", async () => {
    const onError = vi.fn();
    const readRange =
      deferred<Awaited<ReturnType<ViewerResource["content"]["readRange"]>>>();
    const resource = textThumbnailResource({
      fileName: "unmounted.txt",
      key: "text-unmounted",
      readRange: vi.fn(() => readRange.promise),
    });

    const { view } = renderWithBoundary(
      <TextThumbnail resource={resource} thumbnailKey="text-unmounted" />,
      onError,
    );

    view.unmount();
    await act(async () => {
      readRange.resolve(encodedRange("late unmounted text"));
      await readRange.promise;
    });

    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late text range rejection after unmount", async () => {
    const onError = vi.fn();
    const readRange =
      deferred<Awaited<ReturnType<ViewerResource["content"]["readRange"]>>>();
    const resource = textThumbnailResource({
      fileName: "unmounted-reject.txt",
      key: "text-unmounted-reject",
      readRange: vi.fn(() => readRange.promise),
    });

    const { view } = renderWithBoundary(
      <TextThumbnail
        resource={resource}
        thumbnailKey="text-unmounted-reject"
      />,
      onError,
    );

    const swallowed = readRange.promise.catch(() => undefined);
    view.unmount();
    await act(async () => {
      readRange.reject(new Error("late unmounted text failure"));
      await swallowed;
    });

    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late markdown render response after the thumbnail resource changes", async () => {
    const onError = vi.fn();
    const firstRead =
      deferred<Awaited<ReturnType<ViewerResource["content"]["readRange"]>>>();
    const secondRead =
      deferred<Awaited<ReturnType<ViewerResource["content"]["readRange"]>>>();
    const firstParse = deferred<string>();
    const firstResource = textThumbnailResource({
      fileName: "first.md",
      key: "markdown-first",
      readRange: vi.fn(() => firstRead.promise),
    });
    const secondResource = textThumbnailResource({
      fileName: "second.md",
      key: "markdown-second",
      readRange: vi.fn(() => secondRead.promise),
    });
    rendererMocks.markdown.parse.mockImplementation((text: string) =>
      text.includes("stale")
        ? firstParse.promise
        : Promise.resolve("<p>current markdown</p>"),
    );

    const { view } = renderWithBoundary(
      <MarkdownFirstPage
        key="markdown-first"
        resource={firstResource}
        thumbnailKey="markdown-first"
      />,
      onError,
    );

    await act(async () => {
      firstRead.resolve(encodedRange("stale markdown"));
      await firstRead.promise;
    });

    await waitFor(() => {
      expect(rendererMocks.markdown.parse).toHaveBeenCalledWith(
        "stale markdown",
      );
    });

    view.rerender(
      boundaryTree(
        <MarkdownFirstPage
          key="markdown-second"
          resource={secondResource}
          thumbnailKey="markdown-second"
        />,
        onError,
      ),
    );

    await act(async () => {
      secondRead.resolve(encodedRange("current markdown"));
      await secondRead.promise;
    });

    await waitFor(() => {
      expect(view.container.querySelector("iframe")?.srcdoc).toContain(
        "current markdown",
      );
    });

    await act(async () => {
      firstParse.resolve("<p>stale markdown</p>");
      await firstParse.promise;
    });

    expect(view.container.querySelector("iframe")?.srcdoc).toContain(
      "current markdown",
    );
    expect(view.container.querySelector("iframe")?.srcdoc).not.toContain(
      "stale markdown",
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late markdown render rejection after unmount", async () => {
    const onError = vi.fn();
    const readRange =
      deferred<Awaited<ReturnType<ViewerResource["content"]["readRange"]>>>();
    const parse = deferred<string>();
    const resource = textThumbnailResource({
      fileName: "unmounted.md",
      key: "markdown-unmounted",
      readRange: vi.fn(() => readRange.promise),
    });
    rendererMocks.markdown.parse.mockReturnValue(parse.promise);

    const { view } = renderWithBoundary(
      <MarkdownFirstPage
        resource={resource}
        thumbnailKey="markdown-unmounted"
      />,
      onError,
    );

    await act(async () => {
      readRange.resolve(encodedRange("late markdown"));
      await readRange.promise;
    });

    await waitFor(() => {
      expect(rendererMocks.markdown.parse).toHaveBeenCalledWith(
        "late markdown",
      );
    });

    const swallowed = parse.promise.catch(() => undefined);
    view.unmount();
    await act(async () => {
      parse.reject(new Error("late markdown render failed"));
      await swallowed;
    });

    expect(onError).not.toHaveBeenCalled();
  });

  it("cancels PDF canvas work and ignores a late render rejection after unmount", async () => {
    const renderTask = deferred<void>();
    const cancel = vi.fn();
    const onError = vi.fn();
    const page = {
      getViewport: vi.fn(({ scale }) => ({
        width: 100 * scale,
        height: 200 * scale,
      })),
      render: vi.fn(() => ({ promise: renderTask.promise, cancel })),
    };
    rendererMocks.pdf.pagePromise = Promise.resolve(page);

    const { view } = renderWithBoundary(
      <PdfFirstPage
        resource={thumbnailResource({ fileName: "late.pdf" })}
        anchor="top-left"
      />,
      onError,
    );

    await waitFor(() => {
      expect(page.render).toHaveBeenCalledTimes(1);
    });

    const swallowed = renderTask.promise.catch(() => undefined);
    view.unmount();
    await act(async () => {
      renderTask.reject(new Error("late pdf render failure"));
      await swallowed;
    });

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late DOCX render rejection after unmount", async () => {
    const renderTask = deferred<void>();
    const onError = vi.fn();
    rendererMocks.docx.renderAsync.mockReturnValue(renderTask.promise);

    const { view } = renderWithBoundary(
      <DocxFirstPage resource={thumbnailResource({ fileName: "late.docx" })} />,
      onError,
    );

    await waitFor(() => {
      expect(rendererMocks.docx.renderAsync).toHaveBeenCalledTimes(1);
    });

    const swallowed = renderTask.promise.catch(() => undefined);
    view.unmount();
    await act(async () => {
      renderTask.reject(new Error("late docx render failure"));
      await swallowed;
    });

    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late PPTX canvas rejection after unmount", async () => {
    const renderTask = deferred<void>();
    const onError = vi.fn();
    rendererMocks.pptx.loadFile.mockResolvedValue(undefined);
    rendererMocks.pptx.renderSlide.mockReturnValue(renderTask.promise);

    const { view } = renderWithBoundary(
      <PptxFirstSlide
        resource={thumbnailResource({
          fileName: "late.pptx",
          content: {
            key: "late-pptx",
            sourceKind: "blob",
            readBytes: vi.fn(async () => new ArrayBuffer(8)),
          } as unknown as ViewerResource["content"],
        } as Partial<ViewerResource>)}
        thumbnailKey="late-pptx"
        anchor="top-left"
      />,
      onError,
    );

    await waitFor(() => {
      expect(rendererMocks.pptx.renderSlide).toHaveBeenCalledTimes(1);
    });

    const swallowed = renderTask.promise.catch(() => undefined);
    view.unmount();
    await act(async () => {
      renderTask.reject(new Error("late pptx render failure"));
      await swallowed;
    });

    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late XLSX worker response after unmount", async () => {
    const onError = vi.fn();
    const resource = bytesThumbnailResource({
      fileName: "unmounted.xlsx",
      key: "xlsx-unmounted",
      readBytes: vi.fn(async () => new ArrayBuffer(8)),
    });

    const { view } = renderWithBoundary(
      <XlsxFirstSheet resource={resource} thumbnailKey="xlsx-unmounted" />,
      onError,
    );

    await waitFor(() => {
      expect(ThumbnailWorkerMock.instances[0]?.messages).toHaveLength(1);
    });

    const request = ThumbnailWorkerMock.instances[0].messages[0] as {
      id: number;
    };

    view.unmount();
    await act(async () => {
      ThumbnailWorkerMock.instances[0].deliver({
        id: request.id,
        ok: true,
        rows: [["late unmounted"]],
      });
    });

    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late XLSX worker error after unmount", async () => {
    const onError = vi.fn();
    const resource = bytesThumbnailResource({
      fileName: "unmounted-error.xlsx",
      key: "xlsx-unmounted-error",
      readBytes: vi.fn(async () => new ArrayBuffer(8)),
    });

    const { view } = renderWithBoundary(
      <XlsxFirstSheet
        resource={resource}
        thumbnailKey="xlsx-unmounted-error"
      />,
      onError,
    );

    await waitFor(() => {
      expect(ThumbnailWorkerMock.instances[0]?.messages).toHaveLength(1);
    });

    const request = ThumbnailWorkerMock.instances[0].messages[0] as {
      id: number;
    };

    view.unmount();
    await act(async () => {
      ThumbnailWorkerMock.instances[0].deliver({
        id: request.id,
        ok: false,
        error: "late unmounted XLSX failure",
      });
    });

    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late XLSX byte read that starts a worker request after unmount", async () => {
    const onError = vi.fn();
    const readBytes = deferred<ArrayBuffer>();
    const resource = bytesThumbnailResource({
      fileName: "unmounted-read.xlsx",
      key: "xlsx-unmounted-read",
      readBytes: vi.fn(() => readBytes.promise),
    });

    const { view } = renderWithBoundary(
      <XlsxFirstSheet resource={resource} thumbnailKey="xlsx-unmounted-read" />,
      onError,
    );

    view.unmount();
    await act(async () => {
      readBytes.resolve(new ArrayBuffer(8));
      await readBytes.promise;
    });

    await waitFor(() => {
      expect(ThumbnailWorkerMock.instances[0]?.messages).toHaveLength(1);
    });

    const request = ThumbnailWorkerMock.instances[0].messages[0] as {
      id: number;
    };

    await act(async () => {
      ThumbnailWorkerMock.instances[0].deliver({
        id: request.id,
        ok: true,
        rows: [["late unmounted read"]],
      });
    });

    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late TIFF worker response after unmount without creating an object URL", async () => {
    const onError = vi.fn();
    const createObjectURL = vi.fn((_blob: Blob) => "blob:unmounted");
    const revokeObjectURL = vi.fn();
    stubUrlStatic("createObjectURL", createObjectURL);
    stubUrlStatic("revokeObjectURL", revokeObjectURL);

    const resource = bytesThumbnailResource({
      fileName: "unmounted.tiff",
      key: "tiff-unmounted",
      readBytes: vi.fn(async () => new ArrayBuffer(8)),
    });

    const { view } = renderWithBoundary(
      <TiffFirstPage
        resource={resource}
        thumbnailKey="tiff-unmounted"
        anchor="top-left"
        onError={onError}
      />,
      onError,
    );

    await waitFor(() => {
      expect(ThumbnailWorkerMock.instances[0]?.messages).toHaveLength(1);
    });

    const request = ThumbnailWorkerMock.instances[0].messages[0] as {
      id: number;
    };

    view.unmount();
    await act(async () => {
      ThumbnailWorkerMock.instances[0].deliver({
        id: request.id,
        ok: true,
        blob: new Blob(["late"], { type: "image/png" }),
      });
    });

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late TIFF worker error after unmount", async () => {
    const onError = vi.fn();
    const createObjectURL = vi.fn((_blob: Blob) => "blob:unmounted-error");
    const revokeObjectURL = vi.fn();
    stubUrlStatic("createObjectURL", createObjectURL);
    stubUrlStatic("revokeObjectURL", revokeObjectURL);

    const resource = bytesThumbnailResource({
      fileName: "unmounted-error.tiff",
      key: "tiff-unmounted-error",
      readBytes: vi.fn(async () => new ArrayBuffer(8)),
    });

    const { view } = renderWithBoundary(
      <TiffFirstPage
        resource={resource}
        thumbnailKey="tiff-unmounted-error"
        anchor="top-left"
        onError={onError}
      />,
      onError,
    );

    await waitFor(() => {
      expect(ThumbnailWorkerMock.instances[0]?.messages).toHaveLength(1);
    });

    const request = ThumbnailWorkerMock.instances[0].messages[0] as {
      id: number;
    };

    view.unmount();
    await act(async () => {
      ThumbnailWorkerMock.instances[0].deliver({
        id: request.id,
        ok: false,
        error: "late unmounted TIFF failure",
      });
    });

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late TIFF byte read that starts a worker request after unmount", async () => {
    const onError = vi.fn();
    const readBytes = deferred<ArrayBuffer>();
    const createObjectURL = vi.fn((_blob: Blob) => "blob:unmounted-read");
    const revokeObjectURL = vi.fn();
    stubUrlStatic("createObjectURL", createObjectURL);
    stubUrlStatic("revokeObjectURL", revokeObjectURL);

    const resource = bytesThumbnailResource({
      fileName: "unmounted-read.tiff",
      key: "tiff-unmounted-read",
      readBytes: vi.fn(() => readBytes.promise),
    });

    const { view } = renderWithBoundary(
      <TiffFirstPage
        resource={resource}
        thumbnailKey="tiff-unmounted-read"
        anchor="top-left"
        onError={onError}
      />,
      onError,
    );

    view.unmount();
    await act(async () => {
      readBytes.resolve(new ArrayBuffer(8));
      await readBytes.promise;
    });

    await waitFor(() => {
      expect(ThumbnailWorkerMock.instances[0]?.messages).toHaveLength(1);
    });

    const request = ThumbnailWorkerMock.instances[0].messages[0] as {
      id: number;
    };

    await act(async () => {
      ThumbnailWorkerMock.instances[0].deliver({
        id: request.id,
        ok: true,
        blob: new Blob(["late"], { type: "image/png" }),
      });
    });

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late XLSX worker response after the thumbnail resource changes", async () => {
    const onError = vi.fn();
    const firstResource = thumbnailResource({
      fileName: "first.xlsx",
      content: {
        key: "xlsx-first",
        sourceKind: "blob",
        readBytes: vi.fn(async () => new ArrayBuffer(8)),
      } as unknown as ViewerResource["content"],
    });
    const secondResource = thumbnailResource({
      fileName: "second.xlsx",
      content: {
        key: "xlsx-second",
        sourceKind: "blob",
        readBytes: vi.fn(async () => new ArrayBuffer(8)),
      } as unknown as ViewerResource["content"],
    });

    const { view } = renderWithBoundary(
      <XlsxFirstSheet
        key="xlsx-first"
        resource={firstResource}
        thumbnailKey="xlsx-first"
      />,
      onError,
    );

    await waitFor(() => {
      expect(ThumbnailWorkerMock.instances[0]?.messages).toHaveLength(1);
    });

    view.rerender(
      boundaryTree(
        <XlsxFirstSheet
          key="xlsx-second"
          resource={secondResource}
          thumbnailKey="xlsx-second"
        />,
        onError,
      ),
    );

    await waitFor(() => {
      expect(ThumbnailWorkerMock.instances[0]?.messages).toHaveLength(2);
    });

    const firstRequest = ThumbnailWorkerMock.instances[0].messages[0] as {
      id: number;
    };
    const secondRequest = ThumbnailWorkerMock.instances[0].messages[1] as {
      id: number;
    };

    await act(async () => {
      ThumbnailWorkerMock.instances[0].deliver({
        id: secondRequest.id,
        ok: true,
        rows: [["second"]],
      });
    });

    expect(await screen.findByText("second")).not.toBeNull();
    expect(screen.queryByText("first")).toBeNull();

    await act(async () => {
      ThumbnailWorkerMock.instances[0].deliver({
        id: firstRequest.id,
        ok: true,
        rows: [["first"]],
      });
    });

    expect(screen.getByText("second")).not.toBeNull();
    expect(screen.queryByText("first")).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late XLSX worker error after the thumbnail resource changes", async () => {
    const onError = vi.fn();
    const firstResource = thumbnailResource({
      fileName: "first-error.xlsx",
      content: {
        key: "xlsx-first-error",
        sourceKind: "blob",
        readBytes: vi.fn(async () => new ArrayBuffer(8)),
      } as unknown as ViewerResource["content"],
    });
    const secondResource = thumbnailResource({
      fileName: "second-error.xlsx",
      content: {
        key: "xlsx-second-error",
        sourceKind: "blob",
        readBytes: vi.fn(async () => new ArrayBuffer(8)),
      } as unknown as ViewerResource["content"],
    });

    const { view } = renderWithBoundary(
      <XlsxFirstSheet
        key="xlsx-first-error"
        resource={firstResource}
        thumbnailKey="xlsx-first-error"
      />,
      onError,
    );

    await waitFor(() => {
      expect(ThumbnailWorkerMock.instances[0]?.messages).toHaveLength(1);
    });

    view.rerender(
      boundaryTree(
        <XlsxFirstSheet
          key="xlsx-second-error"
          resource={secondResource}
          thumbnailKey="xlsx-second-error"
        />,
        onError,
      ),
    );

    await waitFor(() => {
      expect(ThumbnailWorkerMock.instances[0]?.messages).toHaveLength(2);
    });

    const firstRequest = ThumbnailWorkerMock.instances[0].messages[0] as {
      id: number;
    };
    const secondRequest = ThumbnailWorkerMock.instances[0].messages[1] as {
      id: number;
    };

    await act(async () => {
      ThumbnailWorkerMock.instances[0].deliver({
        id: secondRequest.id,
        ok: true,
        rows: [["current"]],
      });
    });

    expect(await screen.findByText("current")).not.toBeNull();

    const swallowed = Promise.resolve().catch(() => undefined);
    await act(async () => {
      ThumbnailWorkerMock.instances[0].deliver({
        id: firstRequest.id,
        ok: false,
        error: "stale XLSX parse failed",
      });
      await swallowed;
    });

    expect(screen.getByText("current")).not.toBeNull();
    expect(screen.queryByTestId("thumbnail-error")).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late XLSX byte read that starts a stale worker request", async () => {
    const onError = vi.fn();
    const firstRead = deferred<ArrayBuffer>();
    const secondRead = deferred<ArrayBuffer>();
    const firstResource = thumbnailResource({
      fileName: "first-read.xlsx",
      content: {
        key: "xlsx-first-read",
        sourceKind: "blob",
        readBytes: vi.fn(() => firstRead.promise),
      } as unknown as ViewerResource["content"],
    });
    const secondResource = thumbnailResource({
      fileName: "second-read.xlsx",
      content: {
        key: "xlsx-second-read",
        sourceKind: "blob",
        readBytes: vi.fn(() => secondRead.promise),
      } as unknown as ViewerResource["content"],
    });

    const { view } = renderWithBoundary(
      <XlsxFirstSheet
        key="xlsx-first-read"
        resource={firstResource}
        thumbnailKey="xlsx-first-read"
      />,
      onError,
    );

    view.rerender(
      boundaryTree(
        <XlsxFirstSheet
          key="xlsx-second-read"
          resource={secondResource}
          thumbnailKey="xlsx-second-read"
        />,
        onError,
      ),
    );

    await act(async () => {
      secondRead.resolve(new ArrayBuffer(8));
      await secondRead.promise;
    });

    await waitFor(() => {
      expect(ThumbnailWorkerMock.instances[0]?.messages).toHaveLength(1);
    });

    const currentRequest = ThumbnailWorkerMock.instances[0].messages[0] as {
      id: number;
    };

    await act(async () => {
      ThumbnailWorkerMock.instances[0].deliver({
        id: currentRequest.id,
        ok: true,
        rows: [["current from bytes"]],
      });
    });

    expect(await screen.findByText("current from bytes")).not.toBeNull();

    await act(async () => {
      firstRead.resolve(new ArrayBuffer(8));
      await firstRead.promise;
    });

    await waitFor(() => {
      expect(ThumbnailWorkerMock.instances[0]?.messages).toHaveLength(2);
    });

    const staleRequest = ThumbnailWorkerMock.instances[0].messages[1] as {
      id: number;
    };

    await act(async () => {
      ThumbnailWorkerMock.instances[0].deliver({
        id: staleRequest.id,
        ok: true,
        rows: [["stale from bytes"]],
      });
    });

    expect(screen.getByText("current from bytes")).not.toBeNull();
    expect(screen.queryByText("stale from bytes")).toBeNull();
    expect(screen.queryByTestId("thumbnail-error")).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late TIFF worker response after the thumbnail resource changes", async () => {
    const onError = vi.fn();
    const firstBlob = new Blob(["first"], { type: "image/png" });
    const secondBlob = new Blob(["second"], { type: "image/png" });
    const createObjectURL = vi.fn((blob: Blob) =>
      blob === secondBlob ? "blob:second" : "blob:first",
    );
    const revokeObjectURL = vi.fn();
    stubUrlStatic("createObjectURL", createObjectURL);
    stubUrlStatic("revokeObjectURL", revokeObjectURL);

    const firstResource = thumbnailResource({
      fileName: "first.tiff",
      content: {
        key: "tiff-first",
        sourceKind: "blob",
        readBytes: vi.fn(async () => new ArrayBuffer(8)),
      } as unknown as ViewerResource["content"],
    });
    const secondResource = thumbnailResource({
      fileName: "second.tiff",
      content: {
        key: "tiff-second",
        sourceKind: "blob",
        readBytes: vi.fn(async () => new ArrayBuffer(8)),
      } as unknown as ViewerResource["content"],
    });

    const { view } = renderWithBoundary(
      <TiffFirstPage
        key="tiff-first"
        resource={firstResource}
        thumbnailKey="tiff-first"
        anchor="top-left"
        onError={onError}
      />,
      onError,
    );

    await waitFor(() => {
      expect(ThumbnailWorkerMock.instances[0]?.messages).toHaveLength(1);
    });

    view.rerender(
      boundaryTree(
        <TiffFirstPage
          key="tiff-second"
          resource={secondResource}
          thumbnailKey="tiff-second"
          anchor="top-left"
          onError={onError}
        />,
        onError,
      ),
    );

    await waitFor(() => {
      expect(ThumbnailWorkerMock.instances[0]?.messages).toHaveLength(2);
    });

    const firstRequest = ThumbnailWorkerMock.instances[0].messages[0] as {
      id: number;
    };
    const secondRequest = ThumbnailWorkerMock.instances[0].messages[1] as {
      id: number;
    };

    await act(async () => {
      ThumbnailWorkerMock.instances[0].deliver({
        id: secondRequest.id,
        ok: true,
        blob: secondBlob,
      });
    });

    await waitFor(() => {
      expect(view.container.querySelector("img")?.getAttribute("src")).toBe(
        "blob:second",
      );
    });

    await act(async () => {
      ThumbnailWorkerMock.instances[0].deliver({
        id: firstRequest.id,
        ok: true,
        blob: firstBlob,
      });
    });

    expect(view.container.querySelector("img")?.getAttribute("src")).toBe(
      "blob:second",
    );
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0]?.[0]).toBe(secondBlob);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores a late TIFF worker error after the thumbnail resource changes", async () => {
    const onError = vi.fn();
    const secondBlob = new Blob(["second"], { type: "image/png" });
    const createObjectURL = vi.fn((_blob: Blob) => "blob:current");
    const revokeObjectURL = vi.fn();
    stubUrlStatic("createObjectURL", createObjectURL);
    stubUrlStatic("revokeObjectURL", revokeObjectURL);

    const firstResource = thumbnailResource({
      fileName: "first-error.tiff",
      content: {
        key: "tiff-first-error",
        sourceKind: "blob",
        readBytes: vi.fn(async () => new ArrayBuffer(8)),
      } as unknown as ViewerResource["content"],
    });
    const secondResource = thumbnailResource({
      fileName: "second-error.tiff",
      content: {
        key: "tiff-second-error",
        sourceKind: "blob",
        readBytes: vi.fn(async () => new ArrayBuffer(8)),
      } as unknown as ViewerResource["content"],
    });

    const { view } = renderWithBoundary(
      <TiffFirstPage
        key="tiff-first-error"
        resource={firstResource}
        thumbnailKey="tiff-first-error"
        anchor="top-left"
        onError={onError}
      />,
      onError,
    );

    await waitFor(() => {
      expect(ThumbnailWorkerMock.instances[0]?.messages).toHaveLength(1);
    });

    view.rerender(
      boundaryTree(
        <TiffFirstPage
          key="tiff-second-error"
          resource={secondResource}
          thumbnailKey="tiff-second-error"
          anchor="top-left"
          onError={onError}
        />,
        onError,
      ),
    );

    await waitFor(() => {
      expect(ThumbnailWorkerMock.instances[0]?.messages).toHaveLength(2);
    });

    const firstRequest = ThumbnailWorkerMock.instances[0].messages[0] as {
      id: number;
    };
    const secondRequest = ThumbnailWorkerMock.instances[0].messages[1] as {
      id: number;
    };

    await act(async () => {
      ThumbnailWorkerMock.instances[0].deliver({
        id: secondRequest.id,
        ok: true,
        blob: secondBlob,
      });
    });

    await waitFor(() => {
      expect(view.container.querySelector("img")?.getAttribute("src")).toBe(
        "blob:current",
      );
    });

    await act(async () => {
      ThumbnailWorkerMock.instances[0].deliver({
        id: firstRequest.id,
        ok: false,
        error: "stale TIFF decode failed",
      });
    });

    expect(view.container.querySelector("img")?.getAttribute("src")).toBe(
      "blob:current",
    );
    expect(screen.queryByTestId("thumbnail-error")).toBeNull();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0]?.[0]).toBe(secondBlob);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("thumbnail accessibility regressions", () => {
  it("keeps the loading shimmer hidden from assistive technology", () => {
    const { container } = render(
      <FileThumbnail
        file={{ name: "loading.pdf", type: "application/pdf" }}
        state="loading"
      />,
    );

    expect(
      container
        .querySelector('[data-slot="file-thumbnail-shimmer"]')
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("uses the file name as direct image alt text", () => {
    const { container } = render(
      <FileThumbnail
        source={{
          kind: "url",
          url: "/scan.png",
          fileName: "scan.png",
          mimeType: "image/png",
        }}
      />,
    );

    expect(container.querySelector("img")?.getAttribute("alt")).toBe(
      "scan.png",
    );
  });

  it("keeps iframe-backed previews inert and unfocusable", () => {
    const { container } = render(
      <IframeDoc html="<!doctype html><p>Preview</p>" />,
    );
    const iframe = container.querySelector("iframe");

    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("title")).toBe("");
    expect(iframe?.getAttribute("sandbox")).toBe("");
    expect(iframe?.getAttribute("aria-hidden")).toBe("true");
    expect(iframe?.tabIndex).toBe(-1);
    expect(iframe?.className).toContain("pointer-events-none");
  });
});

describe("MSG thumbnail regressions", () => {
  it("uses the MSG HTML body when it is available", () => {
    expect(
      msgFieldsToHtml({
        body: "Plain body",
        bodyHtml: "<main><p>HTML body</p></main>",
      }),
    ).toContain("HTML body");
  });

  it("decodes binary MSG HTML bodies before falling back to plain text", () => {
    const bytes = new TextEncoder().encode("<article>Binary HTML</article>");

    expect(msgFieldsToHtml({ body: "Plain body", html: bytes })).toContain(
      "Binary HTML",
    );
  });

  it("detects UTF-16LE MSG HTML payloads", () => {
    const bytes = new Uint8Array([
      0xff, 0xfe, 0x3c, 0x00, 0x70, 0x00, 0x3e, 0x00, 0x48, 0x00, 0x69, 0x00,
      0x3c, 0x00, 0x2f, 0x00, 0x70, 0x00, 0x3e, 0x00,
    ]);

    expect(decodeMsgHtmlBytes(bytes)).toBe("<p>Hi</p>");
  });

  it("escapes plain MSG bodies when no HTML body is present", () => {
    const html = msgFieldsToHtml({ body: "<script>alert(1)</script>" });

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("thumbnail generated registry regressions", () => {
  it("generates install-safe imports for file-thumbnail", () => {
    const fileThumbnail = readFileSync("public/r/file-thumbnail.json", "utf8");

    expect(fileThumbnail).not.toContain("@/registry/new-york-v4");
  });

  it("keeps the frame package free of renderer dependencies", () => {
    const item = JSON.parse(
      readFileSync("public/r/file-thumbnail-frame.json", "utf8"),
    );

    expect(item.registryDependencies).toEqual([
      "@retab/utils",
      "@retab/effect-key",
      "@retab/use-keyed-mount-effect",
    ]);
    expect(item.dependencies ?? []).toEqual([]);
    expect(JSON.stringify(item)).not.toMatch(
      /pdfjs-dist|docx-preview|pptxviewjs|@e965\/xlsx|@kenjiuno\/msgreader|utif|marked|dompurify/,
    );
  });

  it("ships the direct-image module and worker files in file-thumbnail", () => {
    const item = JSON.parse(
      readFileSync("public/r/file-thumbnail.json", "utf8"),
    ) as {
      files: Array<{ target?: string; path: string }>;
      registryDependencies: string[];
      dependencies: string[];
    };
    const files = item.files.map((file) => file.target ?? file.path);

    expect(item.registryDependencies).toEqual([
      "@retab/file-thumbnail-frame",
      "@retab/pdf-document-resource",
      "@retab/docx-document-resource",
      "@retab/csv",
      "@retab/xlsx-worker-protocol",
      "@retab/utils",
      "@retab/pptx-viewer",
    ]);
    expect(item.dependencies).toEqual([
      "@e965/xlsx@0.20.3",
      "dompurify@^3.3.3",
      "marked@^15.0.12",
      "@kenjiuno/msgreader@^1.28.0",
      "pptxviewjs@1.1.9",
      "utif@^3.1.0",
      "docx-preview@^0.3.7",
    ]);
    expect(files).toContain(
      "@components/file-thumbnail/thumbnail-direct-image.tsx",
    );
    expect(files).toContain(
      "@components/file-thumbnail/renderers/msg-thumbnail.tsx",
    );
    expect(files).toContain("@components/file-thumbnail-tiff.worker.ts");
    expect(files).toContain("@components/file-thumbnail-xlsx.worker.ts");
    expect(files).not.toContain("@ui/pdf-viewer.tsx");
    expect(files).not.toContain("@ui/docx-viewer.tsx");
  });
});
