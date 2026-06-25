// @vitest-environment jsdom

import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarkdownViewer } from "@/components/ui/markdown-viewer";
import { createMarkdownGreenfieldDocument } from "@/registry/new-york-v4/ui/markdown-greenfield-document";
import {
  layoutMarkdownGreenfieldDocument,
  type MarkdownGreenfieldChunkFrame,
} from "@/registry/new-york-v4/ui/markdown-greenfield-layout";
import {
  MARKDOWN_GREENFIELD_ASYNC_DOCUMENT_MIN_CHARS,
  MARKDOWN_GREENFIELD_DOCUMENT_WORKER_SEARCH_PARAM,
} from "@/registry/new-york-v4/ui/markdown-greenfield-document-store";
import { getMarkdownGreenfieldVisibleFrames } from "@/registry/new-york-v4/ui/markdown-greenfield-virtualizer";

function markdownSource(text: string, fileName = "performance.md") {
  return {
    kind: "text" as const,
    fileName,
    mimeType: "text/markdown",
    text,
  };
}

function frame(
  id: string,
  index: number,
  top: number,
  height: number,
): MarkdownGreenfieldChunkFrame {
  return {
    bottom: top + height,
    height,
    id,
    index,
    measuredHeight: null,
    sourceEndLine: index + 1,
    sourceStartLine: index + 1,
    top,
  };
}

function sourceLineCount(text: string) {
  return text.split(/\r\n|[\n\r\u2028\u2029]/).length;
}

function maybeSourceLineCount(value: object) {
  return (value as { sourceLineCount?: unknown }).sourceLineCount;
}

type MarkdownWorkerMessage = {
  id?: number;
  text?: string;
  type?: string;
};

class FakeMarkdownDocumentWorker {
  static instances: FakeMarkdownDocumentWorker[] = [];

  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor() {
    FakeMarkdownDocumentWorker.instances.push(this);
  }

  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent<unknown>);
  }
}

function progressiveMarkdown(label = "Async") {
  const paragraph =
    "This paragraph keeps async document creation above the store threshold without making any single Markdown block hostile.";
  return Array.from({ length: 520 }, (_, index) =>
    [
      `## ${label} Section ${index + 1}`,
      "",
      `${paragraph} Segment ${index + 1}.`,
    ].join("\n"),
  ).join("\n\n");
}

function nativeFindBatchMarkdown() {
  return Array.from(
    { length: 640 },
    (_, index) => `Paragraph ${index + 1} for native-find batching.`,
  ).join("\n\n");
}

function installManualIdleCallbacks() {
  let nextId = 1;
  const callbacks = new Map<number, IdleRequestCallback>();
  vi.stubGlobal(
    "requestIdleCallback",
    vi.fn((callback: IdleRequestCallback) => {
      const id = nextId;
      nextId += 1;
      callbacks.set(id, callback);
      return id;
    }),
  );
  vi.stubGlobal(
    "cancelIdleCallback",
    vi.fn((id: number) => {
      callbacks.delete(id);
    }),
  );

  return {
    pendingCount: () => callbacks.size,
    runNext: async (remainingTime = 50) => {
      const next = callbacks.entries().next().value;
      expect(next).toBeDefined();
      const [id, callback] = next as [number, IdleRequestCallback];
      callbacks.delete(id);
      await act(async () => {
        callback({
          didTimeout: false,
          timeRemaining: () => remainingTime,
        });
      });
    },
  };
}

async function flushMarkdownDocumentTasks() {
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();
  });
}

function setMarkdownDocumentWorkerFlag(value: string) {
  window.history.pushState(
    {},
    "",
    `/?${MARKDOWN_GREENFIELD_DOCUMENT_WORKER_SEARCH_PARAM}=${value}`,
  );
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(function scrollTo(
      this: HTMLElement,
      options?: ScrollToOptions | number,
    ) {
      if (typeof options === "object" && typeof options.top === "number") {
        this.scrollTop = options.top;
      }
    }),
  });
});

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
  window.localStorage?.clear();
  FakeMarkdownDocumentWorker.instances = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Markdown viewer performance regressions", () => {
  it("keeps visible frame selection half-open while preserving a focused fallback frame", () => {
    const frames = Array.from({ length: 5 }, (_, index) =>
      frame(`chunk-${index}`, index, index * 100, 100),
    );

    expect(
      getMarkdownGreenfieldVisibleFrames({
        frames,
        overscanPx: 0,
        scrollTop: 100,
        viewportHeight: 200,
      }).map((item) => item.index),
    ).toEqual([1, 2]);
    expect(
      getMarkdownGreenfieldVisibleFrames({
        frames,
        overscanPx: 1,
        scrollTop: 100,
        viewportHeight: 200,
      }).map((item) => item.index),
    ).toEqual([0, 1, 2, 3]);
    expect(
      getMarkdownGreenfieldVisibleFrames({
        frames,
        overscanPx: 0,
        scrollTop: 200,
        viewportHeight: 0,
      }).map((item) => item.index),
    ).toEqual([2]);
  });

  it("renders bounded rich code fences and a bounded preview for hostile ones", () => {
    const smallCodeLines = Array.from(
      { length: 398 },
      (_, index) => `small-line-${index + 1}`,
    );
    const small = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          ["```txt", ...smallCodeLines, "```"].join("\n"),
          "small-code.md",
        )}
      />,
    );

    expect(
      small.container.querySelector("[data-markdown-hostile-fallback]"),
    ).toBeNull();
    const virtualizedCode = small.container.querySelector<HTMLElement>(
      "pre[data-pretext-code-virtualized]",
    );
    expect(virtualizedCode).toBeTruthy();
    expect(virtualizedCode?.getAttribute("data-pretext-code-line-count")).toBe(
      String(smallCodeLines.length),
    );
    expect(
      small.container.querySelectorAll("[data-line]").length,
    ).toBeGreaterThan(0);
    expect(small.container.querySelectorAll("[data-line]").length).toBeLessThan(
      smallCodeLines.length,
    );
    expect(small.container.querySelector("[data-line]")?.textContent).toBe(
      "small-line-1",
    );

    fireEvent.scroll(virtualizedCode!, {
      target: { scrollTop: smallCodeLines.length * 24 },
    });
    expect(
      Array.from(small.container.querySelectorAll("[data-line]")).some(
        (line) => line.textContent === "small-line-398",
      ),
    ).toBe(true);
    small.unmount();

    const hostileCodeLines = Array.from(
      { length: 399 },
      (_, index) => `hostile-line-${index + 1}`,
    );
    const large = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          ["```txt", ...hostileCodeLines, "```"].join("\n"),
          "hostile-code.md",
        )}
      />,
    );
    const fallback = large.container.querySelector<HTMLElement>(
      "[data-markdown-hostile-fallback]",
    );

    expect(fallback).toBeTruthy();
    expect(fallback?.getAttribute("data-markdown-hostile-line-count")).toBe(
      "401",
    );
    expect(
      Number(fallback?.getAttribute("data-markdown-hostile-mounted-lines")),
    ).toBeLessThan(120);
    expect(
      Number(fallback?.getAttribute("data-markdown-hostile-omitted-lines")),
    ).toBeGreaterThan(0);
    expect(large.container.querySelectorAll("[data-line]")).toHaveLength(0);
  });

  it("keeps document, chunk, and rendered source-line metrics aligned", () => {
    const markdown = [
      "# Source Metrics",
      "",
      "Intro paragraph.",
      "",
      "```ts",
      "const one = 1",
      "const two = 2",
      "```",
      "",
      ...Array.from(
        { length: 70 },
        (_, index) => `Paragraph ${index + 1} for chunk source accounting.`,
      ).flatMap((line) => [line, ""]),
      "Final paragraph.",
    ].join("\n");
    const document = createMarkdownGreenfieldDocument(markdown);

    for (const block of document.blocks) {
      if (!block.sourceRange) continue;
      const expectedLineCount =
        block.sourceRange.endLine - block.sourceRange.startLine + 1;
      expect(block.sourceText).toBe(
        markdown.slice(
          block.sourceRange.startOffset,
          block.sourceRange.endOffset,
        ),
      );
      expect(sourceLineCount(block.sourceText)).toBe(expectedLineCount);
      if (maybeSourceLineCount(block) !== undefined) {
        expect(maybeSourceLineCount(block)).toBe(expectedLineCount);
      }
    }

    for (const chunk of document.chunks) {
      if (!chunk.sourceRange) continue;
      const expectedLineCount =
        chunk.sourceRange.endLine - chunk.sourceRange.startLine + 1;
      expect(chunk.sourceStartLine).toBe(chunk.sourceRange.startLine);
      expect(chunk.sourceEndLine).toBe(chunk.sourceRange.endLine);
      expect(chunk.sourceText).toBe(
        markdown.slice(
          chunk.sourceRange.startOffset,
          chunk.sourceRange.endOffset,
        ),
      );
      expect(sourceLineCount(chunk.sourceText)).toBe(expectedLineCount);
      if (maybeSourceLineCount(chunk) !== undefined) {
        expect(maybeSourceLineCount(chunk)).toBe(expectedLineCount);
      }
    }

    const layout = layoutMarkdownGreenfieldDocument({
      contentWidth: 820,
      document,
      fontScale: 1,
    });
    expect(
      layout.chunks.map(({ sourceEndLine, sourceStartLine }) => ({
        sourceEndLine,
        sourceStartLine,
      })),
    ).toEqual(
      document.chunks.map(({ sourceEndLine, sourceStartLine }) => ({
        sourceEndLine,
        sourceStartLine,
      })),
    );

    const { container } = render(
      <MarkdownViewer controls={false} source={markdownSource(markdown)} />,
    );
    const renderedChunks = Array.from(
      container.querySelectorAll<HTMLElement>("[data-markdown-chunk]"),
    );

    expect(renderedChunks.length).toBeGreaterThan(0);
    for (const renderedChunk of renderedChunks) {
      const sourceStartLine = Number(
        renderedChunk.getAttribute("data-source-start-line"),
      );
      const sourceEndLine = Number(
        renderedChunk.getAttribute("data-source-end-line"),
      );
      expect(
        layout.chunks.some(
          (chunk) =>
            chunk.sourceStartLine === sourceStartLine &&
            chunk.sourceEndLine === sourceEndLine,
        ),
      ).toBe(true);
    }
  });

  it("keeps async fallback document creation progressive", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);

    const markdown = progressiveMarkdown();
    expect(markdown.length).toBeGreaterThan(
      MARKDOWN_GREENFIELD_ASYNC_DOCUMENT_MIN_CHARS,
    );
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(markdown, "progressive.md")}
      />,
    );

    expect(
      screen.getByRole("status", { name: "Preparing Markdown document" }),
    ).toBeTruthy();
    expect(container.querySelector("[data-markdown-chunk]")).toBeNull();

    await flushMarkdownDocumentTasks();

    expect(
      screen.queryByRole("status", { name: "Preparing Markdown document" }),
    ).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Async Section 1" }),
    ).toBeTruthy();
    expect(container.querySelector("[data-markdown-chunk]")).toBeTruthy();
  });

  it("builds hidden native-find text in idle batches", async () => {
    const idle = installManualIdleCallbacks();
    const markdown = nativeFindBatchMarkdown();
    const document = createMarkdownGreenfieldDocument(markdown);
    expect(document.chunks.length).toBeGreaterThan(16);

    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(markdown, "native-find-batches.md")}
      />,
    );

    expect(
      container.querySelector("[data-slot='markdown-native-find-index']"),
    ).toBeNull();

    await idle.runNext();
    const index = container.querySelector<HTMLElement>(
      "[data-slot='markdown-native-find-index']",
    );
    expect(index).toBeTruthy();
    expect(
      container.querySelectorAll("[data-native-find-chunk-id]"),
    ).toHaveLength(0);

    await idle.runNext(0);
    const indexedAfterFirstBatch = container.querySelectorAll(
      "[data-native-find-chunk-id]",
    ).length;
    expect(indexedAfterFirstBatch).toBeGreaterThan(0);
    expect(indexedAfterFirstBatch).toBeLessThan(document.chunks.length);

    while (idle.pendingCount() > 0) {
      await idle.runNext();
    }

    expect(
      container.querySelectorAll("[data-native-find-chunk-id]"),
    ).toHaveLength(document.chunks.length);
  });

  it("parses large Markdown in the document worker by default", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);
    vi.stubGlobal("Worker", FakeMarkdownDocumentWorker);

    const markdown = progressiveMarkdown("Worker Default");
    render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(markdown, "worker-default.md")}
      />,
    );

    const worker = FakeMarkdownDocumentWorker.instances[0];
    expect(worker).toBeTruthy();
    act(() => {
      worker?.emit({ type: "ready" });
    });
    const request = worker?.postMessage.mock.calls[0]?.[0] as
      | MarkdownWorkerMessage
      | undefined;
    expect(request).toMatchObject({
      text: markdown,
      type: "parse",
    });

    act(() => {
      worker?.emit({
        document: createMarkdownGreenfieldDocument(markdown),
        id: request?.id,
        ok: true,
        type: "result",
      });
    });

    expect(worker?.terminate).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("heading", { name: "Worker Default Section 1" }),
    ).toBeTruthy();
  });

  it("allows the document worker to be explicitly disabled", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);
    vi.stubGlobal("Worker", FakeMarkdownDocumentWorker);
    setMarkdownDocumentWorkerFlag("0");

    const markdown = progressiveMarkdown("Main Thread");
    render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(markdown, "main-thread.md")}
      />,
    );

    expect(FakeMarkdownDocumentWorker.instances).toHaveLength(0);
    await flushMarkdownDocumentTasks();
    expect(
      screen.getByRole("heading", { name: "Main Thread Section 1" }),
    ).toBeTruthy();
  });

  it("falls back on the main thread when the worker cannot clone the document payload", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);
    vi.stubGlobal("Worker", FakeMarkdownDocumentWorker);

    const markdown = progressiveMarkdown("Clone Fallback");
    render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(markdown, "clone-fallback.md")}
      />,
    );

    const worker = FakeMarkdownDocumentWorker.instances[0];
    expect(worker).toBeTruthy();

    act(() => {
      worker?.emit({ type: "ready" });
    });
    const request = worker?.postMessage.mock.calls[0]?.[0] as
      | MarkdownWorkerMessage
      | undefined;
    expect(request).toMatchObject({
      text: markdown,
      type: "parse",
    });

    act(() => {
      worker?.emit({
        failure: "clone_failed",
        id: request?.id,
        message: "payload could not be cloned",
        ok: false,
        type: "result",
      });
    });

    expect(worker?.terminate).toHaveBeenCalledTimes(1);
    await flushMarkdownDocumentTasks();
    expect(
      screen.getByRole("heading", { name: "Clone Fallback Section 1" }),
    ).toBeTruthy();
  });

  it("ignores a late worker result after the Markdown document changes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);
    vi.stubGlobal("Worker", FakeMarkdownDocumentWorker);

    const firstMarkdown = progressiveMarkdown("Stale Worker");
    const secondMarkdown = progressiveMarkdown("Current Worker");
    const { rerender } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(firstMarkdown, "stale-worker.md")}
      />,
    );
    const firstWorker = FakeMarkdownDocumentWorker.instances[0];

    act(() => {
      firstWorker?.emit({ type: "ready" });
    });
    const firstRequest = firstWorker?.postMessage.mock.calls[0]?.[0] as
      | MarkdownWorkerMessage
      | undefined;

    rerender(
      <MarkdownViewer
        controls={false}
        source={markdownSource(secondMarkdown, "current-worker.md")}
      />,
    );
    const secondWorker = FakeMarkdownDocumentWorker.instances[1];
    act(() => {
      secondWorker?.emit({ type: "ready" });
    });
    const secondRequest = secondWorker?.postMessage.mock.calls[0]?.[0] as
      | MarkdownWorkerMessage
      | undefined;

    act(() => {
      secondWorker?.emit({
        document: createMarkdownGreenfieldDocument(secondMarkdown),
        id: secondRequest?.id,
        ok: true,
        type: "result",
      });
    });
    expect(
      screen.getByRole("heading", { name: "Current Worker Section 1" }),
    ).toBeTruthy();

    act(() => {
      firstWorker?.emit({
        document: createMarkdownGreenfieldDocument(firstMarkdown),
        id: firstRequest?.id,
        ok: true,
        type: "result",
      });
    });

    expect(
      screen.getByRole("heading", { name: "Current Worker Section 1" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Stale Worker Section 1" }),
    ).toBeNull();
  });
});
