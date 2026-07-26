// @vitest-environment jsdom

import { readFileSync } from "node:fs";
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

import { ViewerFormatError } from "@/registry/new-york-v4/lib/viewer-errors";
import type { ResourceError } from "@/registry/new-york-v4/lib/viewer-errors";
import {
  blobSource,
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource";
import {
  CodeViewer,
  type CodeViewerHandle,
} from "@/registry/new-york-v4/ui/code-viewer";
import { scrollTopForLineRangeMetrics } from "@/registry/new-york-v4/ui/code-viewer-layout";
import {
  CODE_VIEWER_LONG_LINE_RENDER_MAX,
  getCodeLineRenderText,
  getCodeLongLineSelectionText,
} from "@/registry/new-york-v4/ui/code-viewer-long-lines";
import {
  createCodeProjectionMetrics,
  createCodeProjector,
} from "@/registry/new-york-v4/ui/code-viewer-projector";
import {
  CODE_VIEWER_BASE_LINE_PX,
  CODE_VIEWER_BLOCK_PADDING,
  CODE_VIEWER_INITIAL_VIEWPORT_HEIGHT,
  CODE_VIEWER_LINE_CHECKPOINT_INTERVAL,
  CODE_VIEWER_OVERSCAN_PX,
  CODE_VIEWER_SCROLL_REBASE_CONTAINER_PX,
  CODE_VIEWER_SCROLL_REBASE_TARGET_PX,
} from "@/registry/new-york-v4/ui/code-viewer-scale";
import {
  clearCodeSyntaxGlobalTokenCacheForTests,
  CODE_GLOBAL_TOKEN_CACHE_LIMIT,
  createCodeSyntax,
  type CodeSyntax,
} from "@/registry/new-york-v4/ui/code-viewer-syntax";
import {
  getCodeLineCheckpoint,
  getCodeLineIndexAfterOffset,
  getCodeLineIndexAtOffset,
  getCodeLogicalScrollTop,
  getCodePhysicalScrollSize,
  getCodeVirtualLines,
  getCodeVirtualTotalSize,
  resolveCodePhysicalScrollPosition,
} from "@/registry/new-york-v4/ui/code-viewer-virtualization";
import {
  isLineInRange,
  normalizeTextLineRange,
} from "@/registry/new-york-v4/ui/text-viewer-ranges";
import {
  assertTextWithinBounds,
  clearTextViewerResourceCacheForTests,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  detachTextLine,
  MAX_TEXT_RESOURCE_CACHE_ENTRIES,
  prepareTextDocument,
  readTextDocument,
  readTextResource,
  resolvedTextViewerBounds,
  shouldDetachTextLine,
  splitTextLines,
  TEXT_LINE_DETACHMENT_MAX_LINE_LENGTH,
  TEXT_LINE_DETACHMENT_SOURCE_MIN_LENGTH,
  TextViewerInvalidBoundsError,
  TextViewerTooLargeError,
  toTextFormatError,
} from "@/registry/new-york-v4/ui/text-viewer-resource";

function response(body: string, init: ResponseInit = {}) {
  return new Response(body, init);
}

function streamResponse(
  chunks: string[],
  {
    onCancel,
    closeAfterChunks = true,
    init,
  }: {
    onCancel?: () => void;
    closeAfterChunks?: boolean;
    init?: ResponseInit;
  } = {},
) {
  const encoder = new TextEncoder();
  let nextChunkIndex = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks[nextChunkIndex];
        nextChunkIndex += 1;

        if (chunk != null) {
          controller.enqueue(encoder.encode(chunk));
        }
        if (closeAfterChunks && nextChunkIndex >= chunks.length) {
          controller.close();
        }
      },
      cancel: onCancel,
    }),
    init,
  );
}

function textSource(text: string, fileName?: string) {
  return { kind: "text" as const, text, fileName };
}

function urlSource(url: string, fileName?: string) {
  return { kind: "url" as const, url, fileName };
}

// The code-viewer projector paints highlighted rows with an opaque inline
// `background-color` (mixed from the theme's --foreground/--background pair),
// not a Tailwind class, so the highlight signal is the row's inline style.
function rowHighlightBackground(
  container: HTMLElement,
  lineNumber: number,
): string {
  const row = container.querySelector<HTMLElement>(
    `[data-line-number="${lineNumber}"]`,
  );
  return row?.style.backgroundColor ?? "";
}

function anyRowHighlighted(container: HTMLElement): boolean {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-line-number]"),
  ).some((row) => row.style.backgroundColor !== "");
}

function downloadableUrlSource({
  url,
  fileName,
  downloadUrl,
}: {
  url: string;
  fileName: string;
  downloadUrl: string;
}) {
  return { kind: "url" as const, url, fileName, downloadUrl };
}

function textBlobSource(text: string, fileName: string, identityKey: string) {
  return blobSource(new Blob([text], { type: "text/plain" }), {
    fileName,
    identityKey,
  });
}

function sharedTextBlobSource({
  blob,
  fileName,
  identityKey,
  downloadUrl,
}: {
  blob: Blob;
  fileName: string;
  identityKey: string;
  downloadUrl?: string;
}) {
  return blobSource(blob, {
    fileName,
    identityKey,
    downloadUrl,
  });
}

function textResource(url: string, fileName?: string) {
  return createViewerResource(urlSource(url, fileName));
}

function rect(top: number, bottom: number): DOMRect {
  return {
    top,
    bottom,
    left: 0,
    right: 100,
    width: 100,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function readRegistryFile(path: string) {
  return readFileSync(path, "utf8");
}

function mockObjectUrls(url = "blob:download") {
  const createObjectURL = vi.fn((_blob: Blob) => url);
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  });
  return { createObjectURL, revokeObjectURL };
}

function captureAnchorClicks() {
  const clicks: Array<{ href: string | null; download: string }> = [];
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({
        href: this.getAttribute("href"),
        download: this.download,
      });
  });
  return { click, clicks };
}

function mockUserAgent(userAgent: string) {
  const originalUserAgent = navigator.userAgent;
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
  return () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: originalUserAgent,
    });
  };
}

function codeVirtualLinesForTest({
  lineCount,
  lineHeight = CODE_VIEWER_BASE_LINE_PX,
  scrollTop = 0,
  viewportHeight = CODE_VIEWER_INITIAL_VIEWPORT_HEIGHT,
}: {
  lineCount: number;
  lineHeight?: number;
  scrollTop?: number;
  viewportHeight?: number;
}) {
  return getCodeVirtualLines({
    lineCount,
    lineHeight,
    overscanPx: CODE_VIEWER_OVERSCAN_PX,
    paddingStart: CODE_VIEWER_BLOCK_PADDING,
    scrollTop,
    viewportHeight,
  });
}

beforeEach(() => {
  mockObjectUrls();
});

afterEach(() => {
  cleanup();
  clearCodeSyntaxGlobalTokenCacheForTests();
  clearTextViewerResourceCacheForTests();
  clearViewerResourceRegistryForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function readResourceAfterSuspense(
  args: Parameters<typeof readTextResource>[0],
) {
  try {
    return readTextResource(args);
  } catch (thrown) {
    if (thrown instanceof Promise) {
      await thrown.catch(() => undefined);
      return readTextResource(args);
    }
    throw thrown;
  }
}

describe("code-viewer-virtualization", () => {
  it("uses a centered pixel window with Pierre-sized overscan", () => {
    const initialLines = codeVirtualLinesForTest({
      lineCount: 500,
      scrollTop: 0,
      viewportHeight: 20,
    });
    const scrolledLines = codeVirtualLinesForTest({
      lineCount: 500,
      scrollTop: 1100,
      viewportHeight: 20,
    });

    expect(initialLines[0]?.index).toBe(0);
    expect(initialLines).toHaveLength(101);
    expect(scrolledLines[0]?.index).toBe(4);
    expect(scrolledLines.at(-1)?.index).toBe(105);
  });

  it("uses sparse fixed-line checkpoints for deep position lookups", () => {
    const lineHeight = CODE_VIEWER_BASE_LINE_PX;
    const targetLine = CODE_VIEWER_LINE_CHECKPOINT_INTERVAL * 3 + 17;
    const offset = CODE_VIEWER_BLOCK_PADDING + targetLine * lineHeight + 9;
    const checkpoint = getCodeLineCheckpoint({
      lineCount: 1_000_000,
      lineHeight,
      offset,
    });

    expect(checkpoint).toEqual({
      index: CODE_VIEWER_LINE_CHECKPOINT_INTERVAL * 3,
      start:
        CODE_VIEWER_BLOCK_PADDING +
        CODE_VIEWER_LINE_CHECKPOINT_INTERVAL * 3 * lineHeight,
    });
    expect(
      getCodeLineIndexAtOffset({
        lineCount: 1_000_000,
        lineHeight,
        offset,
      }),
    ).toBe(targetLine);
    expect(
      getCodeLineIndexAfterOffset({
        lineCount: 1_000_000,
        lineHeight,
        offset,
      }),
    ).toBe(targetLine + 1);
  });

  it("caps huge physical scroll containers and preserves logical scroll", () => {
    const totalSize = getCodeVirtualTotalSize({
      lineCount: 2_000_000,
      lineHeight: CODE_VIEWER_BASE_LINE_PX,
    });
    const viewportHeight = CODE_VIEWER_INITIAL_VIEWPORT_HEIGHT;
    const logicalScrollTop = 15_000_000;

    const physicalSize = getCodePhysicalScrollSize({
      totalSize,
      viewportHeight,
    });
    const position = resolveCodePhysicalScrollPosition({
      logicalScrollTop,
      scrollPageOffset: 0,
      totalSize,
      viewportHeight,
    });

    expect(physicalSize).toBe(CODE_VIEWER_SCROLL_REBASE_CONTAINER_PX);
    expect(position.physicalScrollTop).toBe(CODE_VIEWER_SCROLL_REBASE_TARGET_PX);
    expect(position.scrollPageOffset).toBe(
      logicalScrollTop - CODE_VIEWER_SCROLL_REBASE_TARGET_PX,
    );
    expect(
      getCodeLogicalScrollTop({
        physicalScrollTop: position.physicalScrollTop,
        scrollPageOffset: position.scrollPageOffset,
        totalSize,
        viewportHeight,
      }),
    ).toBe(logicalScrollTop);
  });
});

describe("text-viewer-ranges", () => {
  it("clamps valid ranges and swaps reversed ranges", () => {
    expect(normalizeTextLineRange({ start: 12, end: 3 }, 10)).toMatchObject({
      start: 3,
      end: 10,
    });
    expect(normalizeTextLineRange({ start: -4, end: 2 }, 10)).toMatchObject({
      start: 1,
      end: 2,
    });
  });

  it("rejects non-finite and fully out-of-document ranges", () => {
    expect(
      normalizeTextLineRange({ start: Number.NaN, end: 2 }, 10),
    ).toBeNull();
    expect(normalizeTextLineRange({ start: 20, end: 30 }, 10)).toBeNull();
    expect(normalizeTextLineRange({ start: 1, end: 2 }, 0)).toBeNull();
  });

  it("checks line membership only for normalized ranges", () => {
    const range = normalizeTextLineRange({ start: 2, end: 3 }, 5);

    expect(isLineInRange(1, range)).toBe(false);
    expect(isLineInRange(2, range)).toBe(true);
    expect(isLineInRange(3, range)).toBe(true);
    expect(isLineInRange(4, range)).toBe(false);
    expect(isLineInRange(2, null)).toBe(false);
  });

  it("normalizes fractional ranges by truncating before clamping", () => {
    expect(normalizeTextLineRange({ start: 3.9, end: 2.1 }, 5)).toMatchObject({
      start: 2,
      end: 3,
    });
    expect(normalizeTextLineRange({ start: 0.9, end: 1.9 }, 5)).toMatchObject({
      start: 1,
      end: 1,
    });
  });

  it("floors fractional document lengths before clamping", () => {
    expect(normalizeTextLineRange({ start: 1, end: 10 }, 2.9)).toMatchObject({
      start: 1,
      end: 2,
    });
  });

  it("rejects non-finite document lengths", () => {
    expect(normalizeTextLineRange({ start: 1, end: 2 }, Infinity)).toBeNull();
  });
});

describe("code-viewer-layout", () => {
  it("centers a fitting range", () => {
    expect(
      scrollTopForLineRangeMetrics({
        startLine: 11,
        endLine: 12,
        lineHeight: 20,
        viewportHeight: 100,
      }),
    ).toBe(170);
  });

  it("top-aligns an oversized range and clamps to zero", () => {
    expect(
      scrollTopForLineRangeMetrics({
        startLine: 2,
        endLine: 8,
        lineHeight: 30,
        viewportHeight: 100,
      }),
    ).toBe(0);
  });
});

describe("code-viewer-long-lines", () => {
  it("renders extremely long lines as bounded head and tail previews", () => {
    const middle = "MIDDLE_SHOULD_NOT_RENDER";
    const text =
      "a".repeat(CODE_VIEWER_LONG_LINE_RENDER_MAX) +
      middle +
      "z".repeat(1024);

    const renderText = getCodeLineRenderText(text);

    expect(renderText.isTruncated).toBe(true);
    expect(renderText.text.length).toBeLessThan(text.length);
    expect(renderText.text).toContain("chars omitted");
    expect(renderText.text).not.toContain(middle);
    expect(renderText.text.startsWith("a".repeat(64))).toBe(true);
    expect(renderText.text.endsWith("z".repeat(64))).toBe(true);
  });

  it("leaves normal lines unmodified", () => {
    expect(getCodeLineRenderText("short line")).toEqual({
      isTruncated: false,
      omittedCharacterCount: 0,
      text: "short line",
    });
  });
});

describe("code-viewer-syntax", () => {
  it("detects JSON from the file name and returns stable cached tokens", async () => {
    const resource = createViewerResource(
      textSource('{"name":"retab"}', "app.json"),
    );
    const syntax = createCodeSyntax(resource, { syntaxMode: "main-thread" });
    await syntax.preload?.();
    const firstTokens = syntax.getLineTokens('{"name":"retab"}');
    const secondTokens = syntax.getLineTokens('{"name":"retab"}');

    expect(syntax.identity).toBe("json");
    expect(firstTokens).toBe(secondTokens);
    expect(firstTokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "property", text: '"name"' }),
        expect.objectContaining({ kind: "string", text: '"retab"' }),
      ]),
    );
  });

  it("shares the token cache across syntax instances", async () => {
    const resource = createViewerResource(
      textSource('{"name":"retab"}', "app.json"),
    );
    const firstSyntax = createCodeSyntax(resource, {
      syntaxMode: "main-thread",
    });
    const secondSyntax = createCodeSyntax(resource, {
      syntaxMode: "main-thread",
    });
    await Promise.all([firstSyntax.preload?.(), secondSyntax.preload?.()]);

    expect(firstSyntax.getLineTokens('{"name":"retab"}')).toBe(
      secondSyntax.getLineTokens('{"name":"retab"}'),
    );
  });

  it("skips plain, empty, and over-limit lines", () => {
    const plainResource = createViewerResource(
      textSource("plain", "notes.txt"),
    );
    const jsonResource = createViewerResource(textSource("{}", "app.json"));
    const plainSyntax = createCodeSyntax(plainResource);
    const jsonSyntax = createCodeSyntax(jsonResource, {
      syntaxMode: "main-thread",
    });

    expect(plainSyntax.identity).toBe("plain");
    expect(plainSyntax.getLineTokens("plain")).toBeNull();
    expect(jsonSyntax.getLineTokens("")).toBeNull();
    expect(jsonSyntax.getLineTokens("x".repeat(2001))).toBeNull();
    expect(plainSyntax.getLineVersion("plain")).toBe(0);
    expect(jsonSyntax.getLineVersion("")).toBe(0);
  });

  it("returns plain text until a lazy grammar is ready", async () => {
    const resource = createViewerResource(textSource("fn main() {}", "app.rs"));
    const syntax = createCodeSyntax(resource, { syntaxMode: "main-thread" });

    expect(syntax.identity).toBe("rust");
    expect(syntax.getLineTokens("fn main() {}")).toBeNull();

    await syntax.preload?.();

    expect(syntax.getLineTokens("fn main() {}")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "keyword", text: "fn" }),
      ]),
    );
  });

  it("increments deferred line versions only when async tokens change", async () => {
    const resource = createViewerResource(textSource("{}", "app.json"));
    const syntax = createCodeSyntax(resource, {
      deferTokens: true,
      syntaxMode: "main-thread",
    });
    await syntax.preload?.();
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);

    try {
      expect(syntax.getLineVersion('{"row":1}')).toBe(0);
      expect(syntax.getLineTokens('{"row":1}')).toBeNull();
      vi.runAllTimers();

      expect(syntax.getLineVersion('{"row":1}')).toBe(1);
      expect(syntax.getLineTokens('{"row":1}')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "property", text: '"row"' }),
        ]),
      );
      expect(syntax.getLineVersion('{"row":1}')).toBe(1);
      expect(syntax.getLineVersion('{"row":2}')).toBe(0);
    } finally {
      syntax.destroy?.();
      vi.useRealTimers();
    }
  });

  it("batches deferred tokenization before notifying syntax changes", async () => {
    const resource = createViewerResource(textSource("{}", "app.json"));
    const onTokensChanged = vi.fn();
    const syntax = createCodeSyntax(resource, {
      deferTokens: true,
      onTokensChanged,
      syntaxMode: "main-thread",
    });
    await syntax.preload?.();
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);
    const lines = Array.from(
      { length: 25 },
      (_, index) => `{"row":${index + 1}}`,
    );

    try {
      for (const line of lines) {
        expect(syntax.getLineTokens(line)).toBeNull();
      }

      vi.advanceTimersToNextTimer();

      expect(onTokensChanged).not.toHaveBeenCalled();
      expect(syntax.getLineTokens(lines[0]!)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "property", text: '"row"' }),
        ]),
      );

      vi.runAllTimers();

      expect(onTokensChanged).toHaveBeenCalledTimes(1);
      expect(syntax.getLineTokens(lines[24]!)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "property", text: '"row"' }),
        ]),
      );
    } finally {
      syntax.destroy?.();
      vi.useRealTimers();
    }
  });

  it("coalesces worker tokenization and caches worker responses", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);

    const worker = new FakeSyntaxWorker();
    const resource = createViewerResource(textSource("{}", "app.json"));
    const onTokensChanged = vi.fn();
    const syntax = createCodeSyntax(resource, {
      createWorker: () => worker as unknown as Worker,
      onTokensChanged,
      syntaxMode: "worker",
    });

    try {
      expect(syntax.getLineTokens('{"row":1}')).toBeNull();
      expect(syntax.getLineTokens('{"row":1}')).toBeNull();

      vi.runOnlyPendingTimers();

      expect(worker.requests).toHaveLength(1);
      expect(worker.requests[0]?.lines).toEqual(['{"row":1}']);

      worker.emit({
        type: "tokens",
        generation: worker.requests[0]!.generation,
        languageId: "json",
        requestId: worker.requests[0]!.requestId,
        results: [
          {
            line: '{"row":1}',
            tokens: [{ kind: "property", text: '"row"' }],
          },
        ],
      });

      expect(syntax.getLineTokens('{"row":1}')).toEqual([
        { kind: "property", text: '"row"' },
      ]);
      expect(syntax.getLineVersion('{"row":1}')).toBe(1);
      expect(syntax.getLineVersion('{"row":2}')).toBe(0);
      expect(onTokensChanged).not.toHaveBeenCalled();

      vi.runOnlyPendingTimers();

      expect(onTokensChanged).toHaveBeenCalledTimes(1);

      worker.emit({
        type: "tokens",
        generation: worker.requests[0]!.generation,
        languageId: "json",
        requestId: worker.requests[0]!.requestId,
        results: [
          {
            line: '{"row":1}',
            tokens: [{ kind: "property", text: '"row"' }],
          },
        ],
      });
      vi.runOnlyPendingTimers();

      expect(syntax.getLineVersion('{"row":1}')).toBe(1);
      expect(onTokensChanged).toHaveBeenCalledTimes(1);
    } finally {
      syntax.destroy?.();
      vi.useRealTimers();
    }
  });

  it("reuses highlighted line tokens across syntax instances", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);

    const firstWorker = new FakeSyntaxWorker();
    const resource = createViewerResource(textSource("{}", "app.json"));
    const firstSyntax = createCodeSyntax(resource, {
      createWorker: () => firstWorker as unknown as Worker,
      syntaxMode: "worker",
    });

    try {
      expect(firstSyntax.getLineTokens('{"shared":true}')).toBeNull();
      vi.runOnlyPendingTimers();
      firstWorker.emit({
        type: "tokens",
        generation: firstWorker.requests[0]!.generation,
        languageId: "json",
        requestId: firstWorker.requests[0]!.requestId,
        results: [
          {
            line: '{"shared":true}',
            tokens: [{ kind: "property", text: '"shared"' }],
          },
        ],
      });

      const secondWorker = new FakeSyntaxWorker();
      const secondSyntax = createCodeSyntax(resource, {
        createWorker: () => secondWorker as unknown as Worker,
        syntaxMode: "worker",
      });

      expect(secondSyntax.getLineTokens('{"shared":true}')).toEqual([
        { kind: "property", text: '"shared"' },
      ]);
      vi.runOnlyPendingTimers();
      expect(secondWorker.requests).toHaveLength(0);

      secondSyntax.destroy?.();
    } finally {
      firstSyntax.destroy?.();
      vi.useRealTimers();
    }
  });

  it("evicts old highlighted line tokens from the bounded global cache", async () => {
    const resource = createViewerResource(textSource("{}", "app.json"));
    const syntax = createCodeSyntax(resource, { syntaxMode: "main-thread" });
    await syntax.preload?.();
    const evictedLine = '{"line":"evicted"}';

    try {
      expect(syntax.getLineTokens(evictedLine)).toBeTruthy();
      for (let index = 0; index < CODE_GLOBAL_TOKEN_CACHE_LIMIT; index += 1) {
        expect(syntax.getLineTokens(`{"line":${index}}`)).toBeTruthy();
      }

      vi.useFakeTimers();
      vi.stubGlobal("requestAnimationFrame", undefined);
      vi.stubGlobal("requestIdleCallback", undefined);
      vi.stubGlobal("cancelIdleCallback", undefined);
      const worker = new FakeSyntaxWorker();
      const secondSyntax = createCodeSyntax(resource, {
        createWorker: () => worker as unknown as Worker,
        syntaxMode: "worker",
      });

      expect(secondSyntax.getLineTokens(evictedLine)).toBeNull();
      vi.runOnlyPendingTimers();
      expect(worker.requests[0]?.lines).toEqual([evictedLine]);
      expect(secondSyntax.getLineTokens(`{"line":999}`)).toBeTruthy();

      secondSyntax.destroy?.();
    } finally {
      syntax.destroy?.();
      vi.useRealTimers();
    }
  });

  it("ignores stale worker responses after destroy", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);

    const worker = new FakeSyntaxWorker();
    const resource = createViewerResource(textSource("{}", "app.json"));
    const onTokensChanged = vi.fn();
    const syntax = createCodeSyntax(resource, {
      createWorker: () => worker as unknown as Worker,
      onTokensChanged,
      syntaxMode: "worker",
    });

    try {
      expect(syntax.getLineTokens("{}")).toBeNull();
      vi.runOnlyPendingTimers();
      syntax.destroy?.();
      worker.emit({
        type: "tokens",
        generation: worker.requests[0]!.generation,
        languageId: "json",
        requestId: worker.requests[0]!.requestId,
        results: [{ line: "{}", tokens: [{ kind: "punctuation", text: "{" }] }],
      });
      vi.runOnlyPendingTimers();

      expect(worker.terminate).not.toHaveBeenCalled();
      expect(onTokensChanged).not.toHaveBeenCalled();
      expect(syntax.getLineTokens("{}")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to main-thread tokenization when the worker fails", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);

    const worker = new FakeSyntaxWorker();
    const resource = createViewerResource(
      textSource("const value = true;", "app.js"),
    );
    const syntax = createCodeSyntax(resource, {
      createWorker: () => worker as unknown as Worker,
      syntaxMode: "worker",
    });

    try {
      expect(syntax.getLineTokens("const value = true;")).toBeNull();
      vi.runOnlyPendingTimers();

      expect(worker.requests).toHaveLength(1);

      worker.fail();
      vi.runOnlyPendingTimers();

      expect(worker.terminate).toHaveBeenCalledTimes(1);
      expect(syntax.getLineTokens("const value = true;")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "keyword", text: "const" }),
          expect.objectContaining({ kind: "boolean", text: "true" }),
        ]),
      );
    } finally {
      syntax.destroy?.();
      vi.useRealTimers();
    }
  });
});

class FakeSyntaxWorker {
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessage:
    | ((event: MessageEvent<Parameters<FakeSyntaxWorker["emit"]>[0]>) => void)
    | null = null;
  requests: Array<{
    generation: number;
    languageId: string;
    lines: string[];
    requestId: number;
    type: "tokenize";
  }> = [];
  terminate = vi.fn();

  postMessage(
    request: FakeSyntaxWorker["requests"][number],
  ): void {
    this.requests.push(request);
  }

  emit(message: {
    generation: number;
    languageId: string;
    requestId: number;
    results: Array<{
      line: string;
      tokens: Array<{ kind: string; text: string }> | null;
    }>;
    type: "tokens";
  }) {
    this.onmessage?.({ data: message } as MessageEvent<
      Parameters<FakeSyntaxWorker["emit"]>[0]
    >);
  }

  fail() {
    this.onerror?.({} as ErrorEvent);
  }
}

describe("code-viewer-projector", () => {
  function codeSyntaxDouble({
    getLineTokens = () => null,
    getLineVersion = () => 0,
    identity = "plain",
  }: {
    getLineTokens?: CodeSyntax["getLineTokens"];
    getLineVersion?: CodeSyntax["getLineVersion"];
    identity?: string;
  } = {}): CodeSyntax {
    return {
      getLineTokens,
      getLineVersion,
      identity,
    };
  }

  function createProjectionElements() {
    const rowHost = document.createElement("pre");
    const renderOffset = document.createElement("div");
    const renderWindow = document.createElement("div");
    const scrollSpacer = document.createElement("div");
    const viewport = document.createElement("div");

    renderOffset.dataset.codeRenderOffset = "";
    renderWindow.dataset.codeRenderWindow = "";
    scrollSpacer.append(renderOffset, renderWindow);
    renderWindow.append(rowHost);

    Object.defineProperty(viewport, "clientHeight", {
      configurable: true,
      value: 20,
    });

    return { renderOffset, renderWindow, rowHost, scrollSpacer, viewport };
  }

  function createProjectionLines(lineCount = 500) {
    return Array.from(
      { length: lineCount },
      (_, index) => `line ${index + 1}`,
    );
  }

  function project({
    contentIdentity = "content",
    gutterWidth = "4ch",
    highlightRange = null,
    lineHeight = 20,
    layoutIdentity = `${lineHeight}\u0000${gutterWidth}`,
    metrics,
    rowHost,
    syntax = codeSyntaxDouble(),
    syntaxIdentity = syntax.identity,
    textLines,
    viewport,
  }: {
    contentIdentity?: string;
    gutterWidth?: string;
    highlightRange?: ReturnType<typeof normalizeTextLineRange>;
    layoutIdentity?: string;
    lineHeight?: number;
    metrics?: ReturnType<typeof createCodeProjectionMetrics>;
    rowHost: HTMLPreElement;
    syntax?: CodeSyntax;
    syntaxIdentity?: string;
    textLines: string[];
    viewport: HTMLDivElement;
  }) {
    const projector = createCodeProjector({ metrics });
    projector.project({
      contentIdentity,
      gutterWidth,
      highlightRange,
      layoutIdentity,
      lineHeight,
      rowHost,
      syntax,
      syntaxIdentity,
      textLines,
      viewport,
    });
    return projector;
  }

  function projectAgain({
    contentIdentity = "content",
    gutterWidth = "4ch",
    highlightRange = null,
    layoutIdentity = "20\u00004ch",
    lineHeight = 20,
    projector,
    rowHost,
    syntax = codeSyntaxDouble(),
    syntaxIdentity = syntax.identity,
    textLines,
    viewport,
  }: {
    contentIdentity?: string;
    gutterWidth?: string;
    highlightRange?: ReturnType<typeof normalizeTextLineRange>;
    layoutIdentity?: string;
    lineHeight?: number;
    projector: ReturnType<typeof createCodeProjector>;
    rowHost: HTMLPreElement;
    syntax?: CodeSyntax;
    syntaxIdentity?: string;
    textLines: string[];
    viewport: HTMLDivElement;
  }) {
    return projector.project({
      contentIdentity,
      gutterWidth,
      highlightRange,
      layoutIdentity,
      lineHeight,
      rowHost,
      syntax,
      syntaxIdentity,
      textLines,
      viewport,
    });
  }

  function getRowsByLineNumber(rowHost: HTMLPreElement) {
    return new Map(
      Array.from(rowHost.children, (row) => [
        Number((row as HTMLElement).dataset.lineNumber),
        row,
      ]),
    );
  }

  it("creates only the visible virtual rows and does not duplicate repeated projection", () => {
    const { rowHost, viewport } = createProjectionElements();
    const textLines = createProjectionLines();
    const projector = project({ rowHost, textLines, viewport });
    const firstRows = Array.from(rowHost.children);

    projectAgain({ projector, rowHost, textLines, viewport });

    expect(firstRows).toHaveLength(
      codeVirtualLinesForTest({
        lineCount: textLines.length,
        viewportHeight: viewport.clientHeight,
      }).length,
    );
    expect(Array.from(rowHost.children)).toEqual(firstRows);
  });

  it("places rows inside an inverse-sticky rendered window", () => {
    const { renderOffset, renderWindow, rowHost, scrollSpacer, viewport } =
      createProjectionElements();
    const textLines = createProjectionLines();
    const projector = project({ rowHost, textLines, viewport });

    expect(scrollSpacer.style.height).toBe("10016px");
    expect(renderOffset.style.height).toBe("8px");
    expect(renderWindow.style.marginTop).toBe("");
    expect(renderWindow.style.height).toBe("2020px");
    expect(renderWindow.style.top).toBe("-2000px");
    expect(renderWindow.style.bottom).toBe("-2000px");
    expect(rowHost.style.height).toBe("2020px");
    expect(
      (
        rowHost.querySelector('[data-line-number="1"]') as HTMLElement | null
      )?.style.transform,
    ).toBe("translateY(0px)");

    viewport.scrollTop = 1100;
    projectAgain({ projector, rowHost, textLines, viewport });

    expect(renderOffset.style.height).toBe("88px");
    expect(renderWindow.style.marginTop).toBe("");
    expect(renderWindow.style.height).toBe("2040px");
    expect(renderWindow.style.top).toBe("-2020px");
    expect(renderWindow.style.bottom).toBe("-2020px");
    expect(rowHost.style.height).toBe("2040px");
    expect(
      (
        rowHost.querySelector('[data-line-number="5"]') as HTMLElement | null
      )?.style.transform,
    ).toBe("translateY(0px)");
  });

  it("removes rows that leave the visible range", () => {
    const { rowHost, viewport } = createProjectionElements();
    const textLines = createProjectionLines();
    const projector = project({ rowHost, textLines, viewport });

    viewport.scrollTop = 80 * 20;
    projectAgain({ projector, rowHost, textLines, viewport });

    expect(rowHost.querySelector('[data-line-number="1"]')).toBeNull();
    expect(rowHost.querySelector('[data-line-number="80"]')).toBeTruthy();
  });

  it("resets rows when content identity changes", () => {
    const { rowHost, viewport } = createProjectionElements();
    const projector = project({
      contentIdentity: "long",
      rowHost,
      textLines: Array.from({ length: 80 }, (_, index) => `old ${index + 1}`),
      viewport,
    });

    projectAgain({
      contentIdentity: "short",
      projector,
      rowHost,
      textLines: ["new"],
      viewport,
    });

    expect(rowHost.querySelectorAll("[data-line-number]")).toHaveLength(1);
    expect(rowHost.textContent).toContain("new");
    expect(rowHost.textContent).not.toContain("old");
  });

  it("patches token spans through the syntax boundary", () => {
    const { rowHost, viewport } = createProjectionElements();

    project({
      rowHost,
      syntax: codeSyntaxDouble({
        identity: "json",
        getLineTokens: () => [{ kind: "string", text: '"value"' }],
      }),
      textLines: ['"value"'],
      viewport,
    });

    expect(rowHost.querySelector(".cv-token-string")?.textContent).toBe(
      '"value"',
    );
  });

  it("renders extremely long rows as plain previews without syntax work", () => {
    const { rowHost, viewport } = createProjectionElements();
    const middle = "MIDDLE_SHOULD_NOT_RENDER";
    const longLine =
      "a".repeat(CODE_VIEWER_LONG_LINE_RENDER_MAX) +
      middle +
      "z".repeat(1024);
    const getLineTokens = vi.fn(() => [{ kind: "string", text: longLine }]);

    project({
      rowHost,
      syntax: codeSyntaxDouble({
        getLineTokens,
        identity: "json",
      }),
      textLines: [longLine],
      viewport,
    });

    const row = rowHost.querySelector<HTMLElement>('[data-line-number="1"]');
    const content = row?.children[1] as HTMLElement | undefined;

    expect(getLineTokens).not.toHaveBeenCalled();
    expect(row?.dataset.codeLineTruncated).toBe("");
    expect(content?.dataset.codeLineTruncated).toBe("");
    expect(content?.textContent?.length).toBeLessThan(longLine.length);
    expect(content?.textContent).toContain("chars omitted");
    expect(content?.textContent).not.toContain(middle);
    expect(content?.textContent?.startsWith("a".repeat(64))).toBe(true);
    expect(content?.textContent?.endsWith("z".repeat(64))).toBe(true);
    expect(rowHost.querySelector(".cv-token-string")).toBeNull();
  });

  it("reconstructs full selected text for truncated long-row copies", () => {
    const { rowHost, scrollSpacer, viewport } = createProjectionElements();
    const longLine =
      "a".repeat(CODE_VIEWER_LONG_LINE_RENDER_MAX) +
      "MIDDLE_SHOULD_COPY" +
      "z".repeat(1024);
    document.body.append(scrollSpacer);
    project({ rowHost, textLines: [longLine], viewport });

    const content = rowHost.querySelector<HTMLElement>(
      "span[data-code-line-truncated]",
    );
    expect(content).toBeTruthy();
    if (!content) return;

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(content);
    selection?.removeAllRanges();
    selection?.addRange(range);

    try {
      expect(
        getCodeLongLineSelectionText({
          rowHost,
          selection,
          textLines: [longLine],
        }),
      ).toBe(longLine);
    } finally {
      selection?.removeAllRanges();
      scrollSpacer.remove();
    }
  });

  it("marks line number gutters as presentational and non-copy content", () => {
    const { rowHost, viewport } = createProjectionElements();

    project({
      rowHost,
      textLines: ["copy me"],
      viewport,
    });

    const gutter = rowHost.querySelector("[data-code-gutter]");
    expect(gutter?.getAttribute("aria-hidden")).toBe("true");
    expect(gutter?.className).toContain("select-none");
  });

  it("does no stable-projection DOM rewrites", () => {
    const { rowHost, viewport } = createProjectionElements();
    const textLines = ["stable"];
    const projector = project({ rowHost, textLines, viewport });
    const replaceChildren = vi.spyOn(Element.prototype, "replaceChildren");
    const insertBefore = vi.spyOn(Node.prototype, "insertBefore");
    const textContent = vi.spyOn(Node.prototype, "textContent", "set");

    projectAgain({ projector, rowHost, textLines, viewport });

    expect(replaceChildren).not.toHaveBeenCalled();
    expect(insertBefore).not.toHaveBeenCalled();
    expect(textContent).not.toHaveBeenCalled();
  });

  it("records projection metrics without changing row behavior", () => {
    const { rowHost, viewport } = createProjectionElements();
    const metrics = createCodeProjectionMetrics();
    const textLines = createProjectionLines();
    const projector = project({ metrics, rowHost, textLines, viewport });

    expect(metrics.projections).toBe(1);
    expect(metrics.noops).toBe(0);
    expect(metrics.rowsCreated).toBe(rowHost.children.length);
    expect(metrics.rowsReused).toBe(0);
    expect(metrics.visibleStart).toBe(0);
    expect(metrics.visibleEnd).toBe(rowHost.children.length);

    projectAgain({ projector, rowHost, textLines, viewport });

    expect(metrics.projections).toBe(2);
    expect(metrics.noops).toBe(1);

    viewport.scrollTop = 80 * 20;
    projectAgain({ projector, rowHost, textLines, viewport });

    expect(metrics.projections).toBe(3);
    expect(metrics.rowsRemoved).toBeGreaterThan(0);
    expect(metrics.rowsReused).toBeGreaterThan(0);
  });

  it("does no row work when scrolling inside the same virtual window", () => {
    const { rowHost, viewport } = createProjectionElements();
    const textLines = createProjectionLines();
    const projector = project({ rowHost, textLines, viewport });
    const insertBefore = vi.spyOn(Node.prototype, "insertBefore");
    const removeChild = vi.spyOn(Node.prototype, "removeChild");
    const textContent = vi.spyOn(Node.prototype, "textContent", "set");

    viewport.scrollTop = 1;
    projectAgain({ projector, rowHost, textLines, viewport });

    expect(insertBefore).not.toHaveBeenCalled();
    expect(removeChild).not.toHaveBeenCalled();
    expect(textContent).not.toHaveBeenCalled();
  });

  it("still patches rows when scrolling to a different virtual window", () => {
    const { rowHost, viewport } = createProjectionElements();
    const textLines = createProjectionLines();
    const projector = project({ rowHost, textLines, viewport });
    const insertBefore = vi.spyOn(Node.prototype, "insertBefore");

    viewport.scrollTop = 80 * 20;
    projectAgain({ projector, rowHost, textLines, viewport });

    expect(insertBefore).toHaveBeenCalled();
    expect(rowHost.querySelector('[data-line-number="80"]')).toBeTruthy();
  });

  it("preserves overlapping row DOM while prepending and appending entering rows", () => {
    const { rowHost, viewport } = createProjectionElements();
    const textLines = createProjectionLines();
    const projector = project({ rowHost, textLines, viewport });
    const preservedRow = rowHost.querySelector('[data-line-number="10"]');

    expect(preservedRow).toBeTruthy();

    viewport.scrollTop = 1100;
    projectAgain({ projector, rowHost, textLines, viewport });

    expect(rowHost.querySelector('[data-line-number="1"]')).toBeNull();
    expect(rowHost.querySelector('[data-line-number="10"]')).toBe(preservedRow);
    expect(rowHost.querySelector('[data-line-number="106"]')).toBeTruthy();
  });

  it("preserves every overlapping row node across a one-line scroll", () => {
    const { rowHost, viewport } = createProjectionElements();
    const textLines = createProjectionLines(1_000);
    viewport.scrollTop = 3_000;
    const projector = project({ rowHost, textLines, viewport });
    const previousRowsByLineNumber = getRowsByLineNumber(rowHost);
    const previousLineNumbers = [...previousRowsByLineNumber.keys()];
    const firstPreviousLine = previousLineNumbers[0]!;
    const lastPreviousLine = previousLineNumbers.at(-1)!;

    viewport.scrollTop += 20;
    projectAgain({ projector, rowHost, textLines, viewport });

    const nextRowsByLineNumber = getRowsByLineNumber(rowHost);
    const nextLineNumbers = [...nextRowsByLineNumber.keys()];
    expect(nextLineNumbers[0]).toBe(firstPreviousLine + 1);
    expect(nextLineNumbers.at(-1)).toBe(lastPreviousLine + 1);
    expect(nextRowsByLineNumber.has(firstPreviousLine)).toBe(false);
    expect(nextRowsByLineNumber.get(lastPreviousLine + 1)).toBeTruthy();
    for (
      let lineNumber = firstPreviousLine + 1;
      lineNumber <= lastPreviousLine;
      lineNumber += 1
    ) {
      expect(nextRowsByLineNumber.get(lineNumber)).toBe(
        previousRowsByLineNumber.get(lineNumber),
      );
    }
  });

  it("falls back to a full visible-window rebuild when mounted DOM is invalid", () => {
    const { rowHost, viewport } = createProjectionElements();
    const textLines = createProjectionLines();
    const metrics = createCodeProjectionMetrics();
    const projector = project({ metrics, rowHost, textLines, viewport });
    const initialRowCount = rowHost.children.length;
    const firstRow = rowHost.firstElementChild as HTMLElement | null;

    expect(firstRow).toBeTruthy();
    firstRow?.setAttribute("data-line-index", "corrupt");

    viewport.scrollTop = 1100;
    projectAgain({ projector, rowHost, textLines, viewport });

    expect(metrics.rowsRemoved).toBe(initialRowCount);
    expect(rowHost.firstElementChild?.getAttribute("data-line-index")).toBe("4");
    expect(rowHost.querySelector('[data-line-number="10"]')).toBeTruthy();
  });

  it("reuses detached row nodes when jumping to a new virtual window", () => {
    const { rowHost, viewport } = createProjectionElements();
    viewport.scrollTop = 1100;
    const textLines = createProjectionLines();
    const projector = project({ rowHost, textLines, viewport });
    const createElement = vi.spyOn(document, "createElement");

    viewport.scrollTop = 3000;
    projectAgain({ projector, rowHost, textLines, viewport });

    expect(createElement).not.toHaveBeenCalled();
    expect(rowHost.querySelector('[data-line-number="5"]')).toBeNull();
    expect(rowHost.querySelector('[data-line-number="150"]')).toBeTruthy();
    expect(rowHost.textContent).toContain("line 150");
  });

  it("renders a minimal window for large jumps and fills overscan on the next projection", () => {
    const { rowHost, viewport } = createProjectionElements();
    const textLines = createProjectionLines(2_000);
    const projector = project({ rowHost, textLines, viewport });
    const fullWindowRowCount = rowHost.children.length;

    viewport.scrollTop = 6_000;
    const needsFill = projectAgain({ projector, rowHost, textLines, viewport });
    const minimalWindowRowCount = rowHost.children.length;

    expect(needsFill).toBe(true);
    expect(minimalWindowRowCount).toBeLessThan(fullWindowRowCount);
    expect(rowHost.querySelector('[data-line-number="300"]')).toBeTruthy();

    const secondNeedsFill = projectAgain({
      projector,
      rowHost,
      textLines,
      viewport,
    });

    expect(secondNeedsFill).toBe(false);
    expect(rowHost.children.length).toBeGreaterThan(minimalWindowRowCount);
    expect(rowHost.querySelector('[data-line-number="300"]')).toBeTruthy();
  });

  it("does not rebuild token content for highlight or layout changes", () => {
    const { rowHost, viewport } = createProjectionElements();
    const textLines = ['"value"'];
    const syntax = codeSyntaxDouble({
      identity: "json",
      getLineTokens: () => [{ kind: "string", text: '"value"' }],
    });
    const projector = project({ rowHost, syntax, textLines, viewport });
    const token = rowHost.querySelector(".cv-token-string");
    const replaceChildren = vi.spyOn(Element.prototype, "replaceChildren");

    projectAgain({
      highlightRange: normalizeTextLineRange({ start: 1, end: 1 }, 1),
      projector,
      rowHost,
      syntax,
      textLines,
      viewport,
    });
    projectAgain({
      gutterWidth: "5ch",
      layoutIdentity: "24\u00005ch",
      lineHeight: 24,
      projector,
      rowHost,
      syntax,
      textLines,
      viewport,
    });

    expect(rowHost.querySelector(".cv-token-string")).toBe(token);
    expect(replaceChildren).not.toHaveBeenCalled();
  });

  it("does not rebuild row content for syntax notifications without line version changes", () => {
    const { rowHost, viewport } = createProjectionElements();
    const textLines = ["one", "two"];
    const syntax = codeSyntaxDouble({
      identity: "json",
      getLineTokens: () => null,
      getLineVersion: () => 0,
    });
    const projector = project({ rowHost, syntax, textLines, viewport });
    const replaceChildren = vi.spyOn(Element.prototype, "replaceChildren");
    const textContent = vi.spyOn(Node.prototype, "textContent", "set");

    projectAgain({
      projector,
      rowHost,
      syntax,
      syntaxIdentity: "json\u0000batch-1",
      textLines,
      viewport,
    });

    expect(replaceChildren).not.toHaveBeenCalled();
    expect(textContent).not.toHaveBeenCalled();
  });

  it("rebuilds only rows whose syntax line version changed", () => {
    const { rowHost, viewport } = createProjectionElements();
    const textLines = ["one", "two"];
    const lineVersions = new Map([
      ["one", 0],
      ["two", 0],
    ]);
    const highlightedLines = new Set<string>();
    const syntax = codeSyntaxDouble({
      identity: "json",
      getLineTokens: (line) =>
        highlightedLines.has(line) ? [{ kind: "string", text: line }] : null,
      getLineVersion: (line) => lineVersions.get(line) ?? 0,
    });
    const projector = project({ rowHost, syntax, textLines, viewport });
    const replaceChildren = vi.spyOn(Element.prototype, "replaceChildren");

    highlightedLines.add("one");
    lineVersions.set("one", 1);
    projectAgain({
      projector,
      rowHost,
      syntax,
      syntaxIdentity: "json\u0000batch-1",
      textLines,
      viewport,
    });

    expect(replaceChildren).toHaveBeenCalledTimes(1);
    expect(
      rowHost.querySelector('[data-line-number="1"] .cv-token-string')
        ?.textContent,
    ).toBe("one");
    expect(
      rowHost.querySelector('[data-line-number="2"] .cv-token-string'),
    ).toBeNull();
  });

  it("rebuilds token content when syntax identity changes", () => {
    const { rowHost, viewport } = createProjectionElements();
    const textLines = ['"value"'];
    const projector = project({
      rowHost,
      syntax: codeSyntaxDouble({
        identity: "plain",
        getLineTokens: () => null,
      }),
      textLines,
      viewport,
    });
    const replaceChildren = vi.spyOn(Element.prototype, "replaceChildren");

    projectAgain({
      projector,
      rowHost,
      syntax: codeSyntaxDouble({
        identity: "json",
        getLineTokens: () => [{ kind: "string", text: '"value"' }],
      }),
      textLines,
      viewport,
    });

    expect(replaceChildren).toHaveBeenCalledTimes(1);
    expect(rowHost.querySelector(".cv-token-string")?.textContent).toBe(
      '"value"',
    );
  });

  it("clears rows once when content identity changes", () => {
    const { rowHost, viewport } = createProjectionElements();
    const projector = project({
      contentIdentity: "first",
      rowHost,
      textLines: ["first"],
      viewport,
    });
    const replaceChildren = vi.spyOn(Element.prototype, "replaceChildren");

    projectAgain({
      contentIdentity: "second",
      projector,
      rowHost,
      textLines: ["second"],
      viewport,
    });

    expect(replaceChildren).toHaveBeenCalledTimes(1);
    expect(rowHost.textContent).toContain("second");
  });
});

describe("text-viewer-resource", () => {
  it("splits every supported line ending and preserves blank terminal lines", () => {
    expect(splitTextLines("one\ntwo\rthree\r\nfour\n")).toEqual([
      "one",
      "two",
      "three",
      "four",
      "",
    ]);
  });

  it("matches the canonical line-break pattern while preparing detached line documents", () => {
    const text = [
      "one",
      "two\rthree",
      "four\r\nfive",
      "six\u2028seven",
      "eight\u2029",
    ].join("\n");
    const expected = text.split(/\r\n|[\n\r\u2028\u2029]/g);
    const document = prepareTextDocument(text, {
      maxBytes: new TextEncoder().encode(text).byteLength,
      maxLines: expected.length,
    });

    expect(splitTextLines(text)).toEqual(expected);
    expect(document.lines).toEqual(expected);
    expect(document.text).toBe(text);
    expect(document.lineCount).toBe(expected.length);
  });

  it("copies only bounded line slices away from very large source strings", () => {
    const sourceLength = TEXT_LINE_DETACHMENT_SOURCE_MIN_LENGTH;

    expect(
      shouldDetachTextLine({
        lineLength: 8,
        sourceLength: sourceLength - 1,
      }),
    ).toBe(false);
    expect(
      shouldDetachTextLine({
        lineLength: 8,
        sourceLength,
      }),
    ).toBe(true);
    expect(
      shouldDetachTextLine({
        lineLength: TEXT_LINE_DETACHMENT_MAX_LINE_LENGTH + 1,
        sourceLength,
      }),
    ).toBe(false);
    expect(detachTextLine("abc")).toBe("abc");
    expect(detachTextLine("")).toBe("");
  });

  it("caches prepared inline text documents by content identity and bounds", () => {
    const content = createViewerResource(textSource("one\ntwo")).content;
    const bounds = resolvedTextViewerBounds();
    const first = readTextDocument({ content, retryVersion: 0, bounds });
    const second = readTextDocument({ content, retryVersion: 0, bounds });

    expect(second).toBe(first);
    expect(first.text).toBe("one\ntwo");
    expect(first.lines).toEqual(["one", "two"]);
    expect(first.lineCount).toBe(2);
  });

  it("keeps large inline text resource keys bounded", () => {
    const text = "x".repeat(50_000);
    const resource = createViewerResource(textSource(text, "large.txt"));

    expect(resource.content.key.length).toBeLessThan(128);
    expect(resource.content.key).not.toContain(text);
    expect(resource.keys.resource).not.toContain(text);
  });

  it("models text bounds failures as format errors", () => {
    expect(() =>
      readTextResource({
        content: createViewerResource(textSource("too large")).content,
        retryVersion: 0,
        bounds: { maxBytes: 1, maxLines: 10 },
      }),
    ).toThrow(TextViewerTooLargeError);
    expect(() =>
      readTextResource({
        content: createViewerResource(textSource("too large")).content,
        retryVersion: 0,
        bounds: { maxBytes: 1, maxLines: 10 },
      }),
    ).toThrow(ViewerFormatError);
  });

  it("preserves structurally equivalent resource too-large errors at the load boundary", async () => {
    const resource = createViewerResource(
      urlSource("/structural-too-large.txt"),
    );
    const content = {
      ...resource.content,
      readText: vi.fn(() =>
        Promise.reject({
          name: "ResourceError",
          domain: "resource",
          kind: "too_large",
          tooLargeReason: "lines",
          message: "Resource exceeds lines limit.",
        }),
      ),
    };

    await expect(
      readResourceAfterSuspense({
        content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds(),
      }),
    ).rejects.toMatchObject({
      name: "ResourceError",
      domain: "resource",
      kind: "too_large",
      tooLargeReason: "lines",
    });
  });

  it("maps text boundary failures through the canonical text mapper", () => {
    const loadError = toTextFormatError(new Error("decode failed"), {
      kind: "load_failed",
      message: "Failed to load text.",
    });

    expect(loadError).toBeInstanceOf(ViewerFormatError);
    expect(loadError).toMatchObject({
      format: "text",
      kind: "load_failed",
    });
    expect(loadError.cause).toBeInstanceOf(Error);

    const existing = new TextViewerInvalidBoundsError("maxBytes");
    expect(
      toTextFormatError(existing, {
        kind: "load_failed",
        message: "ignored",
      }),
    ).toBe(existing);
  });

  it("loads and caches successful text by source and retry version", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response("cached text")));
    vi.stubGlobal("fetch", fetchMock);
    const bounds = resolvedTextViewerBounds();

    await expect(
      readResourceAfterSuspense({
        content: textResource("/cached.txt").content,
        retryVersion: 0,
        bounds,
      }),
    ).resolves.toBe("cached text");
    expect(
      readTextResource({
        content: textResource("/cached.txt").content,
        retryVersion: 0,
        bounds,
      }),
    ).toBe("cached text");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps URL cache entries separate when bounds differ", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response("same url")));
    vi.stubGlobal("fetch", fetchMock);
    const content = textResource("/same-bounds.txt").content;

    await expect(
      readResourceAfterSuspense({
        content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 8 }),
      }),
    ).resolves.toBe("same url");
    await expect(
      readResourceAfterSuspense({
        content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 9 }),
      }),
    ).resolves.toBe("same url");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses retry versions for same-source retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("", { status: 500 }))
      .mockResolvedValueOnce(response("retried"));
    vi.stubGlobal("fetch", fetchMock);
    const bounds = resolvedTextViewerBounds();

    await expect(
      readResourceAfterSuspense({
        content: textResource("/retry.txt").content,
        retryVersion: 0,
        bounds,
      }),
    ).rejects.toThrow("Failed to load");
    await expect(
      readResourceAfterSuspense({
        content: textResource("/retry.txt").content,
        retryVersion: 1,
        bounds,
      }),
    ).resolves.toBe("retried");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects by content length and line limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          response("", {
            headers: { "content-length": "5" },
          }),
        )
        .mockResolvedValueOnce(response("one\ntwo\nthree")),
    );
    const byteBounds = resolvedTextViewerBounds({ maxBytes: 4 });
    await expect(
      readResourceAfterSuspense({
        content: textResource("/too-large-bytes.txt").content,
        retryVersion: 0,
        bounds: byteBounds,
      }),
    ).rejects.toThrow("bytes limit");

    const lineBounds = resolvedTextViewerBounds({ maxLines: 2 });
    await expect(
      readResourceAfterSuspense({
        content: textResource("/too-large-lines.txt").content,
        retryVersion: 0,
        bounds: lineBounds,
      }),
    ).rejects.toThrow("lines limit");
  });

  it("allows content-length exactly at the byte limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("éx", {
            headers: { "content-length": "3" },
          }),
        ),
      ),
    );

    await expect(
      readResourceAfterSuspense({
        content: textResource("/exact-bytes.txt").content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 3 }),
      }),
    ).resolves.toBe("éx");
  });

  it("still enforces byte limits when content-length is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("abcd", {
            headers: { "content-length": "not-a-number" },
          }),
        ),
      ),
    );

    await expect(
      readResourceAfterSuspense({
        content: textResource("/malformed-content-length.txt").content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 3 }),
      }),
    ).rejects.toThrow("bytes limit");
  });

  it("rejects invalid bounds", () => {
    expect(() => resolvedTextViewerBounds({ maxBytes: 0 })).toThrow("maxBytes");
    expect(() => resolvedTextViewerBounds({ maxLines: Infinity })).toThrow(
      "maxLines",
    );
    expect(() => resolvedTextViewerBounds({ maxBytes: 1.5 })).toThrow(
      TextViewerInvalidBoundsError,
    );
    expect(() =>
      resolvedTextViewerBounds({ maxLines: Number.MAX_SAFE_INTEGER + 1 }),
    ).toThrow(TextViewerInvalidBoundsError);
  });

  it("accepts text exactly at byte and line limits", () => {
    expect(() =>
      assertTextWithinBounds("é\nx", { maxBytes: 4, maxLines: 2 }),
    ).not.toThrow();
  });

  it("counts a trailing newline as an additional blank line for bounds", () => {
    expect(() =>
      assertTextWithinBounds("one\n", { maxBytes: 10, maxLines: 1 }),
    ).toThrow("lines limit");
  });

  it("counts bytes rather than UTF-16 code units for inline text", () => {
    const resource = createViewerResource(textSource("é"));

    expect(() =>
      readTextResource({
        content: resource.content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 1 }),
      }),
    ).toThrow("bytes limit");
    expect(
      readTextResource({
        content: resource.content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 2 }),
      }),
    ).toBe("é");
  });

  it("counts CR-only newlines toward the line limit", () => {
    expect(() =>
      readTextResource({
        content: createViewerResource(textSource("one\rtwo")).content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxLines: 1 }),
      }),
    ).toThrow("lines limit");
  });

  it("counts CR-only newlines loaded from URLs toward the line limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("one\rtwo"))),
    );

    await expect(
      readResourceAfterSuspense({
        content: textResource("/classic-newlines.txt").content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxLines: 1 }),
      }),
    ).rejects.toThrow("lines limit");
  });

  it("cancels streamed URL reads when the byte limit is crossed mid-stream", async () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          streamResponse(["ab", "cd"], {
            closeAfterChunks: false,
            onCancel: cancel,
          }),
        ),
      ),
    );

    await expect(
      readResourceAfterSuspense({
        content: textResource("/stream-too-large.txt").content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 3 }),
      }),
    ).rejects.toThrow("bytes limit");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("preserves byte-limit errors when stream cancellation fails", async () => {
    const cancel = vi.fn(() => {
      throw new Error("cancel transport failed");
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          streamResponse(["ab", "cd"], {
            closeAfterChunks: false,
            onCancel: cancel,
          }),
        ),
      ),
    );

    await expect(
      readResourceAfterSuspense({
        content: textResource("/stream-cancel-fails-bytes.txt").content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 3 }),
      }),
    ).rejects.toThrow("bytes limit");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("cancels streamed URL reads when the line limit is crossed mid-stream", async () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          streamResponse(["one\n", "two"], {
            closeAfterChunks: false,
            onCancel: cancel,
          }),
        ),
      ),
    );

    await expect(
      readResourceAfterSuspense({
        content: textResource("/stream-too-many-lines.txt").content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxLines: 1 }),
      }),
    ).rejects.toThrow("lines limit");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("preserves line-limit errors when stream cancellation fails", async () => {
    const cancel = vi.fn(() => {
      throw new Error("cancel transport failed");
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          streamResponse(["one\n", "two"], {
            closeAfterChunks: false,
            onCancel: cancel,
          }),
        ),
      ),
    );

    await expect(
      readResourceAfterSuspense({
        content: textResource("/stream-cancel-fails-lines.txt").content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxLines: 1 }),
      }),
    ).rejects.toThrow("lines limit");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("does not double-count CRLF line breaks split across streamed chunks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(streamResponse(["one\r", "\ntwo"]))),
    );

    await expect(
      readResourceAfterSuspense({
        content: textResource("/split-crlf.txt").content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxLines: 2 }),
      }),
    ).resolves.toBe("one\r\ntwo");
  });

  it("decodes UTF-8 characters split across streamed response chunks", async () => {
    const encoded = new TextEncoder().encode("a🙂b");
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(encoded.slice(0, 3));
                controller.enqueue(encoded.slice(3));
                controller.close();
              },
            }),
          ),
        ),
      ),
    );

    await expect(
      readResourceAfterSuspense({
        content: textResource("/split-utf8.txt").content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds(),
      }),
    ).resolves.toBe("a🙂b");
  });

  it("normalizes abort errors thrown while reading a streamed URL response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              pull() {
                throw new DOMException("Aborted", "AbortError");
              },
            }),
          ),
        ),
      ),
    );

    await expect(
      readResourceAfterSuspense({
        content: textResource("/stream-aborted.txt").content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds(),
      }),
    ).rejects.toMatchObject({
      kind: "aborted",
    } satisfies Partial<ResourceError>);
  });

  it("rejects partial-content URL responses for full text reads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("part", {
            status: 206,
            headers: { "content-range": "bytes 0-3/100" },
          }),
        ),
      ),
    );

    await expect(
      readResourceAfterSuspense({
        content: textResource("/partial.txt").content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds(),
      }),
    ).rejects.toMatchObject({
      kind: "partial_content",
      status: 206,
    } satisfies Partial<ResourceError>);
  });

  it("accepts complete partial-content URL responses for full text reads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("full", {
            status: 206,
            headers: { "content-range": "bytes 0-3/4" },
          }),
        ),
      ),
    );

    await expect(
      readResourceAfterSuspense({
        content: textResource("/complete-partial.txt").content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds(),
      }),
    ).resolves.toBe("full");
  });

  it("rejects partial-content URL responses for full byte reads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("part", {
            status: 206,
            headers: { "content-range": "bytes 0-3/100" },
          }),
        ),
      ),
    );

    await expect(
      textResource("/partial-bytes.txt").content.readBytes(),
    ).rejects.toMatchObject({
      kind: "partial_content",
      status: 206,
    } satisfies Partial<ResourceError>);
  });

  it("rejects partial-content URL responses for full stream reads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("part", {
            status: 206,
            headers: { "content-range": "bytes 0-3/100" },
          }),
        ),
      ),
    );

    await expect(
      textResource("/partial-stream.txt").content.readStream(),
    ).rejects.toMatchObject({
      kind: "partial_content",
      status: 206,
    } satisfies Partial<ResourceError>);
  });

  it("does not refetch a rejected URL resource until retry version changes", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(response("", { status: 500 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const content = textResource("/cached-error.txt").content;
    const bounds = resolvedTextViewerBounds();

    await expect(
      readResourceAfterSuspense({ content, retryVersion: 0, bounds }),
    ).rejects.toThrow("Failed to load");
    await expect(
      readResourceAfterSuspense({ content, retryVersion: 0, bounds }),
    ).rejects.toThrow("Failed to load");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caps the resource cache", async () => {
    const fetchMock = vi.fn((src: string) => Promise.resolve(response(src)));
    vi.stubGlobal("fetch", fetchMock);
    const bounds = resolvedTextViewerBounds();

    for (let index = 0; index < MAX_TEXT_RESOURCE_CACHE_ENTRIES + 2; index++) {
      const src = `/cached-${index}.txt`;
      await expect(
        readResourceAfterSuspense({
          content: textResource(src).content,
          retryVersion: 0,
          bounds,
        }),
      ).resolves.toBe(src);
    }

    const firstSrc = "/cached-0.txt";
    await expect(
      readResourceAfterSuspense({
        content: textResource(firstSrc).content,
        retryVersion: 0,
        bounds,
      }),
    ).resolves.toBe(firstSrc);
    expect(fetchMock).toHaveBeenCalledTimes(
      MAX_TEXT_RESOURCE_CACHE_ENTRIES + 3,
    );
  });

  it("loads blob text through the same resource cache", async () => {
    const bounds = resolvedTextViewerBounds();

    await expect(
      readResourceAfterSuspense({
        content: createViewerResource(
          textBlobSource("blob text", "blob.txt", "blob:one"),
        ).content,
        retryVersion: 0,
        bounds,
      }),
    ).resolves.toBe("blob text");
  });

  it("keys blob text by identity instead of size and MIME only", async () => {
    const bounds = resolvedTextViewerBounds();

    await expect(
      readResourceAfterSuspense({
        content: createViewerResource(
          textBlobSource("same-size-a", "same.txt", "blob:a"),
        ).content,
        retryVersion: 0,
        bounds,
      }),
    ).resolves.toBe("same-size-a");
    await expect(
      readResourceAfterSuspense({
        content: createViewerResource(
          textBlobSource("same-size-b", "same.txt", "blob:b"),
        ).content,
        retryVersion: 0,
        bounds,
      }),
    ).resolves.toBe("same-size-b");
  });

  it("normalizes abort errors thrown while reading a URL byte range body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 206,
          headers: new Headers({ "content-range": "bytes 0-1/10" }),
          arrayBuffer: () =>
            Promise.reject(new DOMException("Aborted", "AbortError")),
        } as Response),
      ),
    );

    await expect(
      textResource("/range-body-aborted.txt").content.readRange({
        start: 0,
        end: 1,
      }),
    ).rejects.toMatchObject({
      kind: "aborted",
    } satisfies Partial<ResourceError>);
  });

  it("normalizes abort errors thrown while reading a URL blob body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          blob: () => Promise.reject(new DOMException("Aborted", "AbortError")),
        } as Response),
      ),
    );

    await expect(
      textResource("/blob-body-aborted.txt").content.readBlob(),
    ).rejects.toMatchObject({
      kind: "aborted",
    } satisfies Partial<ResourceError>);
  });

  it("marks URL byte ranges complete when a 206 response reaches EOF", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        response("cde", {
          status: 206,
          headers: { "content-range": "bytes 2-4/5" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await textResource("/range.txt").content.readRange({
      start: 2,
      end: 4,
    });

    expect(fetchMock).toHaveBeenCalledWith("/range.txt", {
      headers: { Range: "bytes=2-4" },
      signal: undefined,
    });
    expect(new TextDecoder().decode(result.buffer)).toBe("cde");
    expect(result.contentRange).toEqual({ start: 2, end: 4, total: 5 });
    expect(result.isComplete).toBe(true);
  });

  it("keeps non-final URL byte ranges incomplete when the server returns the full requested span", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("abc", {
            status: 206,
            headers: { "content-range": "bytes 0-2/5" },
          }),
        ),
      ),
    );

    await expect(
      textResource("/range.txt").content.readRange({ start: 0, end: 2 }),
    ).resolves.toMatchObject({
      contentRange: { start: 0, end: 2, total: 5 },
      isComplete: false,
    });
  });

  it("keeps short URL byte ranges incomplete when the total size is unknown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("ab", {
            status: 206,
            headers: { "content-range": "bytes 0-1/*" },
          }),
        ),
      ),
    );

    await expect(
      textResource("/range-unknown-total.txt").content.readRange({
        start: 0,
        end: 9,
      }),
    ).resolves.toMatchObject({
      contentRange: { start: 0, end: 1, total: null },
      isComplete: false,
    });
  });

  it("rejects URL byte ranges when Content-Range starts before the requested range", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("abc", {
            status: 206,
            headers: { "content-range": "bytes 0-2/5" },
          }),
        ),
      ),
    );

    await expect(
      textResource("/range-mismatch.txt").content.readRange({
        start: 2,
        end: 4,
      }),
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>);
  });

  it("rejects URL byte ranges when Content-Range length disagrees with the body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("ab", {
            status: 206,
            headers: { "content-range": "bytes 0-2/5" },
          }),
        ),
      ),
    );

    await expect(
      textResource("/range-length-mismatch.txt").content.readRange({
        start: 0,
        end: 2,
      }),
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>);
  });

  it("rejects partial URL byte ranges without Content-Range metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("abc", { status: 206 }))),
    );

    await expect(
      textResource("/range-missing-content-range.txt").content.readRange({
        start: 0,
        end: 2,
      }),
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>);
  });

  it("rejects partial URL byte ranges with malformed Content-Range metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("abc", {
            status: 206,
            headers: { "content-range": "bytes abc" },
          }),
        ),
      ),
    );

    await expect(
      textResource("/range-malformed-content-range.txt").content.readRange({
        start: 0,
        end: 2,
      }),
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>);
  });

  it("rejects partial URL byte ranges with trailing junk in Content-Range metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("abc", {
            status: 206,
            headers: { "content-range": "bytes 0-2/5 trailing" },
          }),
        ),
      ),
    );

    await expect(
      textResource("/range-junk-content-range.txt").content.readRange({
        start: 0,
        end: 2,
      }),
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>);
  });

  it("rejects partial URL byte ranges with unsafe Content-Range numbers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response("ab", {
            status: 206,
            headers: { "content-range": "bytes 0-1/9007199254740993" },
          }),
        ),
      ),
    );

    await expect(
      textResource("/range-unsafe-content-range.txt").content.readRange({
        start: 0,
        end: 1,
      }),
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>);
  });

  it("treats full URL range responses as complete even without Content-Range", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("whole", { status: 200 }))),
    );

    await expect(
      textResource("/range.txt").content.readRange({ start: 0, end: 99 }),
    ).resolves.toMatchObject({ contentRange: undefined, isComplete: true });
  });

  it("rejects full URL range responses for non-zero requested starts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("abcdef", { status: 200 }))),
    );

    await expect(
      textResource("/ignored-nonzero-range.txt").content.readRange({
        start: 2,
        end: 4,
      }),
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>);
  });

  it("rejects full URL range responses longer than a zero-start requested range", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("abcdef", { status: 200 }))),
    );

    await expect(
      textResource("/ignored-short-range.txt").content.readRange({
        start: 0,
        end: 2,
      }),
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>);
  });

  it("rejects successful URL byte range responses with unsupported statuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    );

    await expect(
      textResource("/range-empty-success.txt").content.readRange({
        start: 0,
        end: 2,
      }),
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>);
  });

  it("rejects invalid URL byte ranges before sending a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      textResource("/range.txt").content.readRange({ start: -1, end: 2 }),
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>);
    await expect(
      textResource("/range.txt").content.readRange({ start: 4, end: 3 }),
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid local byte ranges", async () => {
    await expect(
      createViewerResource(textSource("abc")).content.readRange({
        start: 2.5,
        end: 3,
      }),
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>);

    await expect(
      createViewerResource(
        textBlobSource("abc", "abc.txt", "blob:abc"),
      ).content.readRange({ start: 3, end: 2 }),
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>);
  });

  it("rejects local byte ranges that start past the available payload", async () => {
    await expect(
      createViewerResource(textSource("abc")).content.readRange({
        start: 3,
        end: 4,
      }),
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>);

    await expect(
      createViewerResource(
        textBlobSource("abc", "abc.txt", "blob:range"),
      ).content.readRange({ start: 4, end: 5 }),
    ).rejects.toMatchObject({
      kind: "invalid_range",
    } satisfies Partial<ResourceError>);
  });

  it("returns a complete truncated range when a local byte range overreaches", async () => {
    const result = await createViewerResource(
      textSource("abc"),
    ).content.readRange({
      start: 1,
      end: 99,
    });

    expect(new TextDecoder().decode(result.buffer)).toBe("bc");
    expect(result.contentRange).toEqual({ start: 1, end: 2, total: 3 });
    expect(result.isComplete).toBe(true);
  });

  it("returns a coherent empty range for empty local payloads", async () => {
    await expect(
      createViewerResource(textSource("")).content.readRange({
        start: 0,
        end: 0,
      }),
    ).resolves.toMatchObject({
      contentRange: { start: 0, end: -1, total: 0 },
      isComplete: true,
    });

    await expect(
      createViewerResource(
        textBlobSource("", "empty.txt", "blob:empty"),
      ).content.readRange({ start: 0, end: 0 }),
    ).resolves.toMatchObject({
      contentRange: { start: 0, end: -1, total: 0 },
      isComplete: true,
    });
  });

  it("reads text byte ranges over encoded UTF-8 bytes", async () => {
    const result = await createViewerResource(
      textSource("éx"),
    ).content.readRange({
      start: 0,
      end: 1,
    });

    expect(new TextDecoder().decode(result.buffer)).toBe("é");
    expect(result.contentRange).toEqual({ start: 0, end: 1, total: 3 });
    expect(result.isComplete).toBe(false);
  });

  it("reports blob range completion against the full blob size", async () => {
    const resource = createViewerResource(
      textBlobSource("abcdef", "letters.txt", "blob:letters"),
    );

    await expect(
      resource.content.readRange({ start: 0, end: 2 }),
    ).resolves.toMatchObject({
      contentRange: { start: 0, end: 2, total: 6 },
      isComplete: false,
    });
    await expect(
      resource.content.readRange({ start: 3, end: 5 }),
    ).resolves.toMatchObject({
      contentRange: { start: 3, end: 5, total: 6 },
      isComplete: true,
    });
  });

  it("shares URL text payload cache across metadata-only resource changes", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response("same payload")));
    vi.stubGlobal("fetch", fetchMock);
    const bounds = resolvedTextViewerBounds();

    await expect(
      readResourceAfterSuspense({
        content: textResource("/same.txt", "first.txt").content,
        retryVersion: 0,
        bounds,
      }),
    ).resolves.toBe("same payload");
    await expect(
      readResourceAfterSuspense({
        content: textResource("/same.txt", "second.txt").content,
        retryVersion: 0,
        bounds,
      }),
    ).resolves.toBe("same payload");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(textResource("/same.txt", "second.txt").fileName).toBe("second.txt");
  });

  it("does not reuse cached blob text when a new Blob reuses the same identity", async () => {
    const bounds = resolvedTextViewerBounds();

    await expect(
      readResourceAfterSuspense({
        content: createViewerResource(
          textBlobSource("first blob", "same.txt", "blob:reused"),
        ).content,
        retryVersion: 0,
        bounds,
      }),
    ).resolves.toBe("first blob");
    await expect(
      readResourceAfterSuspense({
        content: createViewerResource(
          textBlobSource("second blob", "same.txt", "blob:reused"),
        ).content,
        retryVersion: 0,
        bounds,
      }),
    ).resolves.toBe("second blob");
  });
});

describe("CodeViewer", () => {
  it("renders inline value with line numbers", () => {
    render(<CodeViewer source={textSource("alpha\nbeta")} />);

    expect(screen.getByText("2 lines")).toBeTruthy();
    expect(screen.getByText("alpha")).toBeTruthy();
    expect(screen.getByText("beta")).toBeTruthy();
  });

  it("highlights JSON tokens without changing line text", async () => {
    const { container } = render(
      <CodeViewer
        source={textSource(
          '{"enabled":true,"rollout":25,"owner":"viewer"}',
          "config.json",
        )}
      />,
    );

    const line = container.querySelector('[data-line-number="1"]');
    expect(line?.textContent).toContain(
      '{"enabled":true,"rollout":25,"owner":"viewer"}',
    );
    await waitFor(() => {
      expect(line?.querySelector(".cv-token-property")?.textContent).toBe(
        '"enabled"',
      );
      expect(line?.querySelector(".cv-token-boolean")?.textContent).toBe(
        "true",
      );
      expect(line?.querySelector(".cv-token-number")?.textContent).toBe("25");
      expect(line?.querySelector(".cv-token-string")?.textContent).toBe(
        '"viewer"',
      );
    });
  });

  it("defers syntax tokenization for large highlighted files", async () => {
    const text = Array.from(
      { length: 600 },
      (_, index) => `{"row":${index + 1},"enabled":true}`,
    ).join("\n");
    const { container } = render(
      <CodeViewer source={textSource(text, "large.json")} controls={false} />,
    );

    expect(screen.getByText('{"row":1,"enabled":true}')).toBeTruthy();
    expect(container.querySelector(".cv-token-property")).toBeNull();

    await waitFor(() => {
      expect(container.querySelector(".cv-token-property")?.textContent).toBe(
        '"row"',
      );
    });
  });

  it("installs syntax styles once for every code viewer instance", () => {
    render(
      <>
        <CodeViewer source={textSource('{"one":1}', "one.json")} />
        <CodeViewer source={textSource('{"two":2}', "two.json")} />
      </>,
    );

    expect(
      document.head.querySelectorAll("#retab-code-viewer-syntax-style"),
    ).toHaveLength(1);
  });

  it("renders unmapped file types as plain fixed-line code without syntax tokens", () => {
    const { container } = render(
      <CodeViewer source={textSource("const value = true", "notes.txt")} />,
    );

    expect(screen.getByText("const value = true")).toBeTruthy();
    expect(
      container.querySelector(
        ".cv-token-string,.cv-token-property,.cv-token-keyword,.cv-token-number,.cv-token-punctuation",
      ),
    ).toBeNull();
  });

  it("copies the complete source line from a bounded long-line preview", () => {
    const longLine =
      "a".repeat(CODE_VIEWER_LONG_LINE_RENDER_MAX) +
      "MIDDLE_SHOULD_COPY" +
      "z".repeat(1024);
    const { container } = render(
      <CodeViewer source={textSource(longLine, "long-line.txt")} />,
    );
    const content = container.querySelector<HTMLElement>(
      "span[data-code-line-truncated]",
    );
    expect(content).toBeTruthy();
    if (!content) return;

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(content);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const clipboardData = { setData: vi.fn() };
    try {
      fireEvent.copy(content, { clipboardData });
    } finally {
      selection?.removeAllRanges();
    }

    expect(clipboardData.setData).toHaveBeenCalledWith(
      "text/plain",
      longLine,
    );
  });

  it("keeps controls accessible by name", () => {
    render(<CodeViewer source={textSource("alpha")} />);

    expect(screen.getByLabelText("Zoom out")).toBeTruthy();
    expect(screen.getByLabelText("Zoom in")).toBeTruthy();
    expect(screen.getByLabelText("Reset zoom")).toBeTruthy();
    expect(screen.getByLabelText("Download")).toBeTruthy();
  });

  it("renders empty text as a single blank line", () => {
    const { container } = render(<CodeViewer source={textSource("")} />);

    expect(screen.getByText("1 line")).toBeTruthy();
    expect(container.querySelector('[data-line-number="1"]')).toBeTruthy();
    expect(container.querySelector('[data-line-number="2"]')).toBeNull();
  });

  it("renders trailing newlines as blank final lines", () => {
    const { container } = render(<CodeViewer source={textSource("alpha\n")} />);

    expect(screen.getByText("2 lines")).toBeTruthy();
    expect(container.querySelector('[data-line-number="1"]')).toBeTruthy();
    expect(container.querySelector('[data-line-number="2"]')).toBeTruthy();
  });

  it("renders CRLF and CR newline variants without leaking carriage returns", () => {
    const { container } = render(
      <CodeViewer source={textSource("alpha\r\nbeta\rgamma")} />,
    );

    expect(screen.getByText("3 lines")).toBeTruthy();
    expect(
      container.querySelector('[data-line-number="1"] span:last-child')
        ?.textContent,
    ).toBe("alpha");
    expect(
      container.querySelector('[data-line-number="2"] span:last-child')
        ?.textContent,
    ).toBe("beta");
    expect(
      container.querySelector('[data-line-number="3"] span:last-child')
        ?.textContent,
    ).toBe("gamma");
  });

  it("updates rendered line count and rows when the inline source changes", () => {
    const { container, rerender } = render(
      <CodeViewer source={textSource("one\ntwo")} />,
    );
    const rowHost = container.querySelector("pre");
    const renderWindow = container.querySelector("[data-code-render-window]");

    expect(screen.getByText("2 lines")).toBeTruthy();
    expect(container.querySelector('[data-line-number="2"]')).toBeTruthy();

    rerender(<CodeViewer source={textSource("solo")} />);

    expect(container.querySelector("pre")).toBe(rowHost);
    expect(container.querySelector("[data-code-render-window]")).toBe(
      renderWindow,
    );
    expect(screen.getByText("1 line")).toBeTruthy();
    expect(screen.getByText("solo")).toBeTruthy();
    expect(screen.queryByText("two")).toBeNull();
    expect(container.querySelector('[data-line-number="2"]')).toBeNull();
  });

  it("drops stale virtual rows when a large source shrinks", () => {
    const { container, rerender } = render(
      <CodeViewer
        source={textSource(
          Array.from(
            { length: 10_000 },
            (_, index) => `line ${index + 1}`,
          ).join("\n"),
        )}
        controls={false}
      />,
    );

    expect(
      container.querySelectorAll("[data-line-number]").length,
    ).toBeGreaterThan(1);

    rerender(<CodeViewer source={textSource("single")} controls={false} />);

    expect(screen.getByText("single")).toBeTruthy();
    expect(container.querySelectorAll("[data-line-number]")).toHaveLength(1);
    expect(container.querySelector('[data-line-number="2"]')).toBeNull();
  });

  it("does not keep previous text visible while a new URL source is pending", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const { rerender } = render(<CodeViewer source={textSource("old text")} />);

    expect(screen.getByText("old text")).toBeTruthy();

    rerender(<CodeViewer source={urlSource("/pending-new-source.txt")} />);

    expect(screen.queryByText("old text")).toBeNull();
  });

  it("hides controls chrome when controls is false", () => {
    render(<CodeViewer source={textSource("alpha")} controls={false} />);

    expect(screen.queryByText("1 line")).toBeNull();
    expect(screen.queryByLabelText("Zoom in")).toBeNull();
    expect(screen.queryByLabelText("Download")).toBeNull();
  });

  it("hides fallback controls chrome when controls is false", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );

    render(<CodeViewer source={urlSource("/pending.txt")} controls={false} />);

    expect(screen.queryByLabelText("Zoom in")).toBeNull();
    expect(screen.queryByLabelText("Download")).toBeNull();
  });

  it("hides error-state download chrome when controls is false", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <CodeViewer
        source={textSource("one\ntwo")}
        maxLines={1}
        controls={false}
      />,
    );

    expect(
      await screen.findByText("This text file has too many lines to preview."),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Download")).toBeNull();
  });

  it("highlights every line in a normalized multi-line range", () => {
    const { container } = render(
      <CodeViewer
        source={textSource("one\ntwo\nthree\nfour")}
        highlight={{ start: 3, end: 2 }}
      />,
    );

    expect(rowHighlightBackground(container, 1)).toBe("");
    expect(rowHighlightBackground(container, 2)).not.toBe("");
    expect(rowHighlightBackground(container, 3)).not.toBe("");
    expect(rowHighlightBackground(container, 4)).toBe("");
  });

  it("clamps highlight ranges that partly overlap the document", () => {
    const { container } = render(
      <CodeViewer
        source={textSource("one\ntwo\nthree")}
        highlight={{ start: -20, end: 2 }}
      />,
    );

    expect(rowHighlightBackground(container, 1)).not.toBe("");
    expect(rowHighlightBackground(container, 2)).not.toBe("");
    expect(rowHighlightBackground(container, 3)).toBe("");
  });

  it("does not highlight invalid ranges", () => {
    const { container } = render(
      <CodeViewer
        source={textSource("one\ntwo")}
        highlight={{ start: 10, end: 20 }}
      />,
    );

    expect(anyRowHighlighted(container)).toBe(false);
  });

  it("updates highlighted rows when the highlight prop changes", () => {
    const { container, rerender } = render(
      <CodeViewer source={textSource("one\ntwo\nthree")} highlight={null} />,
    );

    expect(anyRowHighlighted(container)).toBe(false);

    rerender(
      <CodeViewer
        source={textSource("one\ntwo\nthree")}
        highlight={{ start: 2, end: 2 }}
      />,
    );

    expect(rowHighlightBackground(container, 1)).toBe("");
    expect(rowHighlightBackground(container, 2)).not.toBe("");
    expect(rowHighlightBackground(container, 3)).toBe("");
  });

  it("scrolls to reveal the full requested range", () => {
    const viewerRef = React.createRef<CodeViewerHandle>();
    render(
      <CodeViewer
        ref={viewerRef}
        source={textSource(
          Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join(
            "\n",
          ),
        )}
      />,
    );

    const viewportElement = viewerRef.current?.getViewportElement();
    expect(viewportElement).not.toBeNull();
    if (!viewportElement) return;

    Object.defineProperty(viewportElement, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(viewportElement, "scrollTop", {
      configurable: true,
      value: 0,
      writable: true,
    });
    viewportElement.getBoundingClientRect = () => rect(0, 100);
    const scrollTo = vi.fn();
    viewportElement.scrollTo = scrollTo;

    act(() => {
      viewerRef.current?.scrollToLineRange(
        { start: 10, end: 11 },
        { behavior: "auto" },
      );
    });

    expect(scrollTo).toHaveBeenCalledWith({ top: 158, behavior: "auto" });
  });

  it("ignores imperative scroll requests for invalid ranges", () => {
    const viewerRef = React.createRef<CodeViewerHandle>();
    render(<CodeViewer ref={viewerRef} source={textSource("one\ntwo")} />);

    const viewportElement = viewerRef.current?.getViewportElement();
    expect(viewportElement).not.toBeNull();
    if (!viewportElement) return;

    const scrollTo = vi.fn();
    viewportElement.scrollTo = scrollTo;

    act(() => {
      viewerRef.current?.scrollToLineRange(
        { start: 10, end: 12 },
        { behavior: "auto" },
      );
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("uses the current zoom level for imperative scroll offsets", () => {
    const viewerRef = React.createRef<CodeViewerHandle>();
    render(
      <CodeViewer
        ref={viewerRef}
        source={textSource(
          Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join(
            "\n",
          ),
        )}
      />,
    );

    const viewportElement = viewerRef.current?.getViewportElement();
    expect(viewportElement).not.toBeNull();
    if (!viewportElement) return;

    Object.defineProperty(viewportElement, "clientHeight", {
      configurable: true,
      value: 100,
    });
    const scrollTo = vi.fn();
    viewportElement.scrollTo = scrollTo;

    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(screen.getByText("120%")).toBeTruthy();

    act(() => {
      viewerRef.current?.scrollToLineRange(
        { start: 10, end: 10 },
        { behavior: "auto" },
      );
    });

    expect(scrollTo).toHaveBeenCalledWith({ top: 186, behavior: "auto" });
  });

  it("preserves the visible line when manual zoom changes the layout", () => {
    const viewerRef = React.createRef<CodeViewerHandle>();
    render(
      <CodeViewer
        ref={viewerRef}
        source={textSource(
          Array.from({ length: 200 }, (_, index) => `line ${index + 1}`).join(
            "\n",
          ),
        )}
      />,
    );

    const viewportElement = viewerRef.current?.getViewportElement();
    expect(viewportElement).not.toBeNull();
    if (!viewportElement) return;

    Object.defineProperty(viewportElement, "scrollTop", {
      configurable: true,
      value: 1608,
      writable: true,
    });

    fireEvent.click(screen.getByLabelText("Zoom in"));

    expect(screen.getByText("120%")).toBeTruthy();
    expect(viewportElement.scrollTop).toBe(1928);
  });

  it("applies zoom changes to the rendered text metrics", () => {
    const { container } = render(<CodeViewer source={textSource("alpha")} />);
    const pre = container.querySelector("pre");

    expect(pre?.style.fontSize).toBe("12px");
    expect(pre?.style.lineHeight).toBe("20px");

    fireEvent.click(screen.getByLabelText("Zoom in"));

    expect(pre?.style.fontSize).toBe("14.399999999999999px");
    expect(pre?.style.lineHeight).toBe("24px");

    fireEvent.click(screen.getByLabelText("Reset zoom"));

    expect(pre?.style.fontSize).toBe("12px");
    expect(pre?.style.lineHeight).toBe("20px");
  });

  it("clamps zoom controls to the supported scale range", () => {
    render(<CodeViewer source={textSource("alpha")} />);

    for (let index = 0; index < 20; index++) {
      fireEvent.click(screen.getByLabelText("Zoom in"));
    }
    expect(screen.getByText("500%")).toBeTruthy();

    for (let index = 0; index < 40; index++) {
      fireEvent.click(screen.getByLabelText("Zoom out"));
    }
    expect(screen.getByText("10%")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Reset zoom"));
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("does not mount every line in a large text file", () => {
    const { container } = render(
      <CodeViewer
        source={textSource(
          Array.from(
            { length: 10_000 },
            (_, index) => `line ${index + 1}`,
          ).join("\n"),
        )}
        controls={false}
      />,
    );

    const expectedInitialWindow = codeVirtualLinesForTest({
      lineCount: 10_000,
    }).length;

    expect(container.querySelectorAll("[data-line-number]")).toHaveLength(
      expectedInitialWindow,
    );
  });

  it("uses an inverse-sticky rendered window inside the full scroll spacer", () => {
    const { container } = render(
      <CodeViewer
        source={textSource(
          Array.from(
            { length: 10_000 },
            (_, index) => `line ${index + 1}`,
          ).join("\n"),
        )}
        controls={false}
      />,
    );
    const scrollSpacer = container.querySelector<HTMLElement>(
      "[data-code-scroll-spacer]",
    );
    const renderOffset = container.querySelector<HTMLElement>(
      "[data-code-render-offset]",
    );
    const renderWindow = container.querySelector<HTMLElement>(
      "[data-code-render-window]",
    );
    const rowHost = container.querySelector("pre");

    expect(scrollSpacer?.style.height).toBe("200016px");
    expect(scrollSpacer?.style.contain).toBe("layout style");
    expect(renderOffset?.style.height).toBe("8px");
    expect(renderWindow?.style.position).toBe("sticky");
    expect(renderWindow?.style.contain).toBe("layout style inline-size");
    expect(renderWindow?.style.display).toBe("flex");
    expect(renderWindow?.style.flexDirection).toBe("column");
    expect(renderWindow?.style.isolation).toBe("isolate");
    expect(renderWindow?.style.marginTop).toBe("");
    expect(renderWindow?.style.height).toBe("2600px");
    expect(renderWindow?.style.top).toBe("-2000px");
    expect(renderWindow?.style.bottom).toBe("-2000px");
    expect(rowHost?.style.height).toBe("2600px");
  });

  it("disables row pointer events while scroll projection catches up", () => {
    vi.useFakeTimers();
    const restoreUserAgent = mockUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) =>
        window.setTimeout(() => callback(0), 0),
      ),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((handle: number) => window.clearTimeout(handle)),
    );
    const viewerRef = React.createRef<CodeViewerHandle>();

    try {
      const { container } = render(
        <CodeViewer
          ref={viewerRef}
          source={textSource(
            Array.from(
              { length: 10_000 },
              (_, index) => `line ${index + 1}`,
            ).join("\n"),
          )}
          controls={false}
        />,
      );
      const viewportElement = viewerRef.current?.getViewportElement();
      const rowHost = container.querySelector("pre");

      expect(viewportElement).not.toBeNull();
      expect(rowHost).not.toBeNull();
      if (!viewportElement || !rowHost) return;

      expect(viewportElement.style.overflowAnchor).toBe("none");
      expect(rowHost.parentElement).toBeInstanceOf(HTMLElement);
      const renderWindow = rowHost.parentElement as HTMLElement;
      rowHost.style.pointerEvents = "auto";
      renderWindow.style.overflowX = "scroll";

      fireEvent.scroll(viewportElement);

      expect(rowHost.style.pointerEvents).toBe("none");
      expect(renderWindow.style.overflowX).toBe("hidden");

      act(() => {
        vi.advanceTimersByTime(120);
      });

      expect(rowHost.style.pointerEvents).toBe("auto");
      expect(renderWindow.style.overflowX).toBe("scroll");
    } finally {
      restoreUserAgent();
      vi.useRealTimers();
    }
  });

  it("indexes offscreen code for native browser find", async () => {
    const viewerRef = React.createRef<CodeViewerHandle>();
    const lines = Array.from({ length: 200 }, (_, index) =>
      index === 149 ? "needle line 150" : `line ${index + 1}`,
    );
    const { container } = render(
      <CodeViewer
        ref={viewerRef}
        source={textSource(lines.join("\n"))}
        controls={false}
      />,
    );

    const index = await waitFor(() => {
      const node = container.querySelector<HTMLElement>(
        '[data-slot="code-native-find-index"]',
      );
      expect(node).toBeTruthy();
      return node as HTMLElement;
    });
    const entry = index.querySelector<HTMLElement>(
      '[data-native-find-start-line="129"]',
    );
    const viewportElement = viewerRef.current?.getViewportElement();

    expect(index.getAttribute("data-native-find-indexed-lines")).toBe("200");
    expect(index.getAttribute("data-native-find-indexed-chunks")).toBe("2");
    expect(entry?.getAttribute("data-native-find-end-line")).toBe("200");
    expect(entry?.textContent).toContain("needle line 150");
    expect(entry?.getAttribute("hidden")).toBe("until-found");
    expect(viewportElement).not.toBeNull();
    if (!entry || !viewportElement) return;

    Object.defineProperty(viewportElement, "clientHeight", {
      configurable: true,
      value: 100,
    });
    const scrollTo = vi.fn();
    viewportElement.scrollTo = scrollTo;

    fireEvent(entry, new Event("beforematch"));

    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "auto" }),
    );
    expect((scrollTo.mock.calls[0]?.[0] as ScrollToOptions).top).toBeGreaterThan(
      0,
    );
  });

  it("scrolls to a virtualized line that is not currently mounted", () => {
    const viewerRef = React.createRef<CodeViewerHandle>();
    const { container } = render(
      <CodeViewer
        ref={viewerRef}
        source={textSource(
          Array.from(
            { length: 10_000 },
            (_, index) => `line ${index + 1}`,
          ).join("\n"),
        )}
        controls={false}
      />,
    );

    expect(container.querySelector('[data-line-number="5000"]')).toBeNull();

    const viewportElement = viewerRef.current?.getViewportElement();
    expect(viewportElement).not.toBeNull();
    if (!viewportElement) return;

    Object.defineProperty(viewportElement, "clientHeight", {
      configurable: true,
      value: 100,
    });
    const scrollTo = vi.fn();
    viewportElement.scrollTo = scrollTo;

    act(() => {
      viewerRef.current?.scrollToLineRange(
        { start: 5000, end: 5000 },
        { behavior: "auto" },
      );
    });

    expect(scrollTo).toHaveBeenCalledWith({ top: 99948, behavior: "auto" });
  });

  it("renders a local error and retries the same URL source", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("", { status: 500 }))
      .mockResolvedValueOnce(response("loaded text", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<CodeViewer source={urlSource("/same.txt")} />);
    expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.getByText("loaded text")).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recovers from a fetch error when the URL source changes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("", { status: 500 }))
      .mockResolvedValueOnce(response("next file", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <CodeViewer source={urlSource("/broken.txt")} />,
    );
    expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy();

    rerender(<CodeViewer source={urlSource("/next.txt")} />);

    await waitFor(() => {
      expect(screen.getByText("next file")).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("resets retry versions when switching between payload identities", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/cached-before-retry.txt") {
        return Promise.resolve(response("cached before retry"));
      }
      if (url === "/retry-reset.txt") {
        return Promise.resolve(response("", { status: 500 }));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <CodeViewer source={urlSource("/cached-before-retry.txt")} />,
    );

    await waitFor(() => {
      expect(screen.getByText("cached before retry")).toBeTruthy();
    });

    rerender(<CodeViewer source={urlSource("/retry-reset.txt")} />);
    expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy();

    rerender(<CodeViewer source={urlSource("/cached-before-retry.txt")} />);

    await waitFor(() => {
      expect(screen.getByText("cached before retry")).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("ignores a stale pending URL load after the source changes", async () => {
    let resolveSlow: ((response: Response) => void) | null = null;
    const fetchMock = vi.fn((url: string) => {
      if (url === "/slow.txt") {
        return new Promise<Response>((resolve) => {
          resolveSlow = resolve;
        });
      }
      return Promise.resolve(response("fast file"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<CodeViewer source={urlSource("/slow.txt")} />);
    rerender(<CodeViewer source={urlSource("/fast.txt")} />);

    await waitFor(() => {
      expect(screen.getByText("fast file")).toBeTruthy();
    });

    await act(async () => {
      resolveSlow?.(response("slow file"));
      await Promise.resolve();
    });

    expect(screen.getByText("fast file")).toBeTruthy();
    expect(screen.queryByText("slow file")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps a shared pending URL load to one fetch across rerenders", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response("shared text")));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <CodeViewer source={urlSource("/shared.txt")} />,
    );
    rerender(<CodeViewer source={urlSource("/shared.txt")} />);

    await waitFor(() => {
      expect(screen.getByText("shared text")).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders a too-large state locally", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<CodeViewer source={textSource("one\ntwo\nthree")} maxLines={2} />);

    expect(
      await screen.findByText("This text file has too many lines to preview."),
    ).toBeTruthy();
  });

  it("recovers when an inline value becomes valid after a local error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { rerender } = render(
      <CodeViewer source={textSource("one\ntwo\nthree")} maxLines={2} />,
    );

    expect(
      await screen.findByText("This text file has too many lines to preview."),
    ).toBeTruthy();

    rerender(<CodeViewer source={textSource("one\ntwo")} maxLines={2} />);

    await waitFor(() => {
      expect(screen.getByText("2 lines")).toBeTruthy();
      expect(screen.getByText("one")).toBeTruthy();
      expect(screen.getByText("two")).toBeTruthy();
    });
    expect(
      screen.queryByText("This text file has too many lines to preview."),
    ).toBeNull();
  });

  it("recovers when bounds become valid after a local error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { rerender } = render(
      <CodeViewer source={textSource("one")} maxLines={0} />,
    );

    expect(
      await screen.findByText("Text viewer bounds are invalid."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();

    rerender(<CodeViewer source={textSource("one")} maxLines={1} />);

    await waitFor(() => {
      expect(screen.getByText("1 line")).toBeTruthy();
      expect(screen.getByText("one")).toBeTruthy();
    });
    expect(screen.queryByText("Text viewer bounds are invalid.")).toBeNull();
  });

  it("recovers when nullable runtime bounds are removed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { rerender } = render(
      <CodeViewer
        source={textSource("one")}
        maxLines={null as unknown as number}
      />,
    );

    expect(
      await screen.findByText("Text viewer bounds are invalid."),
    ).toBeTruthy();

    rerender(<CodeViewer source={textSource("one")} />);

    await waitFor(() => {
      expect(screen.getByText("1 line")).toBeTruthy();
      expect(screen.getByText("one")).toBeTruthy();
    });
    expect(screen.queryByText("Text viewer bounds are invalid.")).toBeNull();
  });

  it("recovers from a URL line-limit error when the limit is raised", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(() => Promise.resolve(response("one\ntwo\nthree")));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <CodeViewer source={urlSource("/bounded.txt")} maxLines={2} />,
    );

    expect(
      await screen.findByText("This file has too many lines to preview."),
    ).toBeTruthy();

    rerender(<CodeViewer source={urlSource("/bounded.txt")} maxLines={3} />);

    await waitFor(() => {
      expect(screen.getByText("3 lines")).toBeTruthy();
      expect(screen.getByText("three")).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("downloads URL, Blob, and inline text sources", async () => {
    const { createObjectURL, revokeObjectURL } = mockObjectUrls();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("alpha"))),
    );

    const { rerender } = render(
      <CodeViewer source={textSource("inline text", "inline.txt")} />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));

    rerender(
      <CodeViewer
        source={textBlobSource("blob text", "blob.txt", "blob:download")}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(2));

    rerender(<CodeViewer source={urlSource("/alpha.txt", "alpha.txt")} />);

    await waitFor(() => {
      expect(screen.getByText("alpha")).toBeTruthy();
      const link = screen.getByRole("link", { name: "Download" });
      expect(link.getAttribute("href")).toBe("/alpha.txt");
      expect(link.getAttribute("download")).toBe("alpha.txt");
    });
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:download");
  });

  it("uses the latest inline text and file name when downloading after a source change", async () => {
    const { createObjectURL } = mockObjectUrls("blob:inline-latest");
    const { click, clicks } = captureAnchorClicks();
    const { rerender } = render(
      <CodeViewer source={textSource("first text", "first.txt")} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));

    rerender(<CodeViewer source={textSource("second text", "second.txt")} />);

    await waitFor(() => {
      expect(screen.getByText("second text")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(2));

    const firstBlob = createObjectURL.mock.calls[0]?.[0] as Blob;
    const secondBlob = createObjectURL.mock.calls[1]?.[0] as Blob;
    await expect(firstBlob.text()).resolves.toBe("first text");
    await expect(secondBlob.text()).resolves.toBe("second text");
    expect(clicks).toEqual([
      { href: "blob:inline-latest", download: "first.txt" },
      { href: "blob:inline-latest", download: "second.txt" },
    ]);
  });

  it("uses a Blob source downloadUrl as a direct href without object URLs", async () => {
    const { createObjectURL } = mockObjectUrls("blob:should-not-be-created");

    render(
      <CodeViewer
        source={sharedTextBlobSource({
          blob: new Blob(["blob href text"], { type: "text/plain" }),
          fileName: "href.txt",
          identityKey: "blob:href",
          downloadUrl: "/download/blob-href.txt",
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("blob href text")).toBeTruthy();
      const link = screen.getByRole("link", { name: "Download" });
      expect(link.getAttribute("href")).toBe("/download/blob-href.txt");
      expect(link.getAttribute("download")).toBe("href.txt");
    });
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("keeps URL download metadata available from a load error state", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("", { status: 500 }))),
    );

    render(
      <CodeViewer
        source={downloadableUrlSource({
          url: "/preview-fails.txt",
          fileName: "original.txt",
          downloadUrl: "/download/original.txt",
        })}
      />,
    );

    expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();

    const link = screen.getByRole("link", { name: "Download" });
    expect(link.getAttribute("href")).toBe("/download/original.txt");
    expect(link.getAttribute("download")).toBe("original.txt");
  });

  it("updates URL download metadata without refetching the same text payload", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response("cached url text")));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <CodeViewer source={urlSource("/metadata.txt", "first.txt")} />,
    );

    await waitFor(() => {
      expect(screen.getByText("cached url text")).toBeTruthy();
      expect(
        screen.getByRole("link", { name: "Download" }).getAttribute("download"),
      ).toBe("first.txt");
    });

    rerender(<CodeViewer source={urlSource("/metadata.txt", "second.txt")} />);

    await waitFor(() => {
      expect(screen.getByText("cached url text")).toBeTruthy();
      expect(
        screen.getByRole("link", { name: "Download" }).getAttribute("download"),
      ).toBe("second.txt");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves zoom across URL metadata-only source changes", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response("zoomed url text")));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <CodeViewer source={urlSource("/zoom-metadata.txt", "first.txt")} />,
    );

    await waitFor(() => {
      expect(screen.getByText("zoomed url text")).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(screen.getByText("120%")).toBeTruthy();

    rerender(
      <CodeViewer source={urlSource("/zoom-metadata.txt", "second.txt")} />,
    );

    await waitFor(() => {
      expect(screen.getByText("zoomed url text")).toBeTruthy();
      expect(screen.getByText("120%")).toBeTruthy();
      expect(
        screen.getByRole("link", { name: "Download" }).getAttribute("download"),
      ).toBe("second.txt");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves zoom and cache when omitted bounds become explicit defaults", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(response("default bounds text")),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <CodeViewer source={urlSource("/default-bounds.txt")} />,
    );

    await waitFor(() => {
      expect(screen.getByText("default bounds text")).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(screen.getByText("120%")).toBeTruthy();

    rerender(
      <CodeViewer
        source={urlSource("/default-bounds.txt")}
        maxBytes={DEFAULT_MAX_BYTES}
        maxLines={DEFAULT_MAX_LINES}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("default bounds text")).toBeTruthy();
      expect(screen.getByText("120%")).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("updates URL download hrefs without refetching the same text payload", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response("download source")));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <CodeViewer
        source={downloadableUrlSource({
          url: "/preview.txt",
          fileName: "first.txt",
          downloadUrl: "/download/first.txt",
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("download source")).toBeTruthy();
      const link = screen.getByRole("link", { name: "Download" });
      expect(link.getAttribute("href")).toBe("/download/first.txt");
      expect(link.getAttribute("download")).toBe("first.txt");
    });

    rerender(
      <CodeViewer
        source={downloadableUrlSource({
          url: "/preview.txt",
          fileName: "second.txt",
          downloadUrl: "/download/second.txt",
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("download source")).toBeTruthy();
      const link = screen.getByRole("link", { name: "Download" });
      expect(link.getAttribute("href")).toBe("/download/second.txt");
      expect(link.getAttribute("download")).toBe("second.txt");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves zoom across URL download href changes", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(response("download zoom text")),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <CodeViewer
        source={downloadableUrlSource({
          url: "/download-zoom.txt",
          fileName: "download-zoom.txt",
          downloadUrl: "/download/zoom-a.txt",
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("download zoom text")).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(screen.getByText("120%")).toBeTruthy();

    rerender(
      <CodeViewer
        source={downloadableUrlSource({
          url: "/download-zoom.txt",
          fileName: "download-zoom.txt",
          downloadUrl: "/download/zoom-b.txt",
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("120%")).toBeTruthy();
      expect(
        screen.getByRole("link", { name: "Download" }).getAttribute("href"),
      ).toBe("/download/zoom-b.txt");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("updates Blob download metadata while reusing the same Blob payload", async () => {
    const { createObjectURL } = mockObjectUrls("blob:shared-text");
    const { click, clicks } = captureAnchorClicks();
    const sharedBlob = new Blob(["shared blob text"], { type: "text/plain" });

    const { rerender } = render(
      <CodeViewer
        source={sharedTextBlobSource({
          blob: sharedBlob,
          fileName: "first.txt",
          identityKey: "blob:shared",
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("shared blob text")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() => {
      expect(click).toHaveBeenCalledTimes(1);
    });

    rerender(
      <CodeViewer
        source={sharedTextBlobSource({
          blob: sharedBlob,
          fileName: "second.txt",
          identityKey: "blob:shared",
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("shared blob text")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(2));
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(clicks).toEqual([
      { href: "blob:shared-text", download: "first.txt" },
      { href: "blob:shared-text", download: "second.txt" },
    ]);
  });

  it("lets a retry after a metadata-only URL change refetch the same payload identity", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response("", { status: 500 }))
      .mockResolvedValueOnce(response("retried after metadata change"));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <CodeViewer source={urlSource("/retry-metadata.txt", "first.txt")} />,
    );

    expect(await screen.findByText("Failed to load file: 500.")).toBeTruthy();

    rerender(
      <CodeViewer source={urlSource("/retry-metadata.txt", "second.txt")} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.getByText("retried after metadata change")).toBeTruthy();
      expect(
        screen.getByRole("link", { name: "Download" }).getAttribute("download"),
      ).toBe("second.txt");
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("renders Blob sources and treats bounds errors as local non-retryable states", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <CodeViewer
        source={textBlobSource("one\ntwo\nthree", "blob.txt", "blob:bounds")}
        maxLines={2}
      />,
    );

    expect(
      await screen.findByText("This file has too many lines to preview."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("supports explicit text and URL source descriptors", async () => {
    mockObjectUrls("blob:descriptor");
    const { rerender } = render(
      <CodeViewer
        source={{
          kind: "text",
          text: "descriptor text",
          fileName: "descriptor.txt",
        }}
      />,
    );
    expect(screen.getByText("descriptor text")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("descriptor url"))),
    );
    rerender(
      <CodeViewer
        source={{
          kind: "url",
          url: "/descriptor.txt",
          fileName: "descriptor.txt",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("descriptor url")).toBeTruthy();
    });
    expect(
      screen.getByRole("link", { name: "Download" }).getAttribute("download"),
    ).toBe("descriptor.txt");
  });
});

describe("code-viewer implementation boundaries", () => {
  it("keeps terminal code viewer responsibilities in exact modules", () => {
    const contentSource = readRegistryFile(
      "registry/new-york-v4/ui/code-viewer-content.tsx",
    );
    const syntaxSource = readRegistryFile(
      "registry/new-york-v4/ui/code-viewer-syntax.ts",
    );
    const syntaxPrismSource = readRegistryFile(
      "registry/new-york-v4/ui/code-viewer-syntax-prism.ts",
    );
    const syntaxWorkerSource = readRegistryFile(
      "registry/new-york-v4/ui/code-viewer-syntax.worker.ts",
    );
    const projectorSource = readRegistryFile(
      "registry/new-york-v4/ui/code-viewer-projector.ts",
    );
    const viewportSource = readRegistryFile(
      "registry/new-york-v4/ui/code-viewer-viewport.tsx",
    );
    const syntaxStyleSource = readRegistryFile(
      "registry/new-york-v4/ui/code-viewer-syntax-style.tsx",
    );
    const schedulerSource = readRegistryFile(
      "registry/new-york-v4/ui/code-viewer-projection-scheduler.ts",
    );

    expect(contentSource).not.toContain("Prism");
    expect(contentSource).not.toContain("document.createElement");
    expect(contentSource).not.toContain("replaceChildren");
    expect(contentSource).not.toContain("ResizeObserver");
    expect(contentSource).not.toContain("<style");
    expect(contentSource).not.toContain("CODE_VIEWER_SYNTAX_STYLE");
    expect(contentSource).toContain("createCodeSyntax");
    expect(contentSource).toContain("createCodeProjector");
    expect(contentSource).toContain("CodeViewerViewport");
    expect(contentSource).toContain("useCodeProjectionScheduler");
    expect(contentSource).toContain("useCodeViewerSyntaxStyle");

    expect(syntaxSource).toContain("createCodeSyntax");
    expect(syntaxSource).toContain("createCodeSyntaxWorker");
    expect(syntaxSource).toContain("ensureCodePrismLanguage");
    expect(syntaxSource).toContain("kind:");
    expect(syntaxPrismSource).toContain("Prism");
    expect(syntaxPrismSource).toContain("prism-json");
    expect(syntaxPrismSource).not.toContain('import "prismjs/components');
    expect(syntaxWorkerSource).toContain("tokenizeInWorker");
    expect(syntaxWorkerSource).not.toContain("document");

    expect(projectorSource).toContain("createCodeProjector");
    expect(projectorSource).toContain("createCodeProjectionMetrics");
    expect(projectorSource).toContain("document.createElement");
    expect(projectorSource).toContain("contentIdentity");
    expect(projectorSource).toContain("layoutIdentity");
    expect(projectorSource).toContain("getCodePagedLayoutTop");
    expect(projectorSource).toContain("applyPartialRender");
    expect(projectorSource).toContain("dataset.lineIndex");
    expect(projectorSource).toContain("syncCodeScrollLayers");
    expect(projectorSource).toContain("getCodeRenderedWindowElement");
    expect(projectorSource).toContain("syncVisibleRowOrder");
    expect(projectorSource).not.toContain("visibleRows");
    expect(projectorSource).not.toContain("reset(");
    expect(projectorSource).not.toContain("React");

    expect(viewportSource).toContain("<pre");
    expect(viewportSource).toContain("data-code-render-offset");
    expect(viewportSource).toContain("data-code-render-window");
    expect(viewportSource).toContain('position: "sticky"');
    expect(viewportSource).toContain("overflowAnchor");
    expect(viewportSource).toContain("ref={rowHostRef}");
    expect(viewportSource).not.toContain("createCodeSyntax");
    expect(viewportSource).not.toContain("createCodeProjector");

    expect(syntaxStyleSource).toContain("retab-code-viewer-syntax-style");
    expect(syntaxStyleSource).toContain("document.head.append");

    expect(schedulerSource).toContain("requestAnimationFrame");
    expect(schedulerSource).toContain("ResizeObserver");
    expect(schedulerSource).toContain("suspendTextViewerScrollInteractions");
    expect(schedulerSource).toContain("restoreTextViewerScrollInteractions");
  });

  it("keeps resource cache keys private to the resource module", () => {
    const viewerModuleSource = readRegistryFile(
      "registry/new-york-v4/ui/code-viewer.tsx",
    );
    const testSource = readRegistryFile("tests/code-viewer.test.tsx");
    const resourceKeyName = ["textViewer", "Resource", "Key"].join("");

    expect(viewerModuleSource).not.toContain(resourceKeyName);
    expect(testSource).not.toContain(resourceKeyName);
  });

  it("does not expose cache size just for tests", () => {
    const resourceSource = readRegistryFile(
      "registry/new-york-v4/ui/text-viewer-resource.ts",
    );
    const testSource = readRegistryFile("tests/code-viewer.test.tsx");
    const cacheSizeName = ["Resource", "Cache", "Size"].join("");

    expect(resourceSource).not.toContain(cacheSizeName);
    expect(testSource).not.toContain(cacheSizeName);
  });

  it("uses exact reset keys instead of fingerprints", () => {
    const shellModuleSource = readRegistryFile(
      "registry/new-york-v4/ui/plain-text-viewer-frame.tsx",
    );

    expect(shellModuleSource).toContain("plainTextViewerResetKey");
    expect(shellModuleSource).not.toContain("fingerprint");
    expect(shellModuleSource).not.toContain("resourceVersion");
  });

  it("keeps source IO out of the component module", () => {
    const viewerModuleSource = readRegistryFile(
      "registry/new-york-v4/ui/code-viewer.tsx",
    );

    expect(viewerModuleSource).not.toContain("fetch(");
    expect(viewerModuleSource).not.toContain("createObjectURL");
  });

  it("keeps the shared resource layer independent from viewer components", () => {
    const resourceModuleSource = readRegistryFile(
      "registry/new-york-v4/lib/viewer-resource.ts",
    );

    expect(resourceModuleSource).not.toContain("React");
    expect(resourceModuleSource).not.toContain("useDownloadHref");
    expect(resourceModuleSource).not.toContain("createObjectURL");
    expect(resourceModuleSource).not.toContain("@/components/ui/code-viewer");
    expect(resourceModuleSource).not.toContain("@/components/ui/pdf-viewer");
    expect(resourceModuleSource).not.toContain("@/components/ui/image-viewer");
  });

  it("uses structured resource errors instead of parsing messages", () => {
    const resourceModuleSource = readRegistryFile(
      "registry/new-york-v4/lib/viewer-resource.ts",
    );
    const textResourceSource = readRegistryFile(
      "registry/new-york-v4/ui/text-viewer-resource.ts",
    );

    expect(resourceModuleSource).toContain("tooLargeReason");
    expect(textResourceSource).toContain("isResourceError");
    expect(textResourceSource).not.toContain('includes("lines")');
  });

  it("keeps Blob source identity explicit", () => {
    const sourceModuleSource = readRegistryFile(
      "registry/new-york-v4/lib/viewer-source.ts",
    );
    const resourceModuleSource = readRegistryFile(
      "registry/new-york-v4/lib/viewer-resource.ts",
    );

    expect(sourceModuleSource).toContain("identityKey: string");
    expect(sourceModuleSource).not.toContain("blob:${");
    expect(resourceModuleSource).toContain("identityKey: string");
  });
});
