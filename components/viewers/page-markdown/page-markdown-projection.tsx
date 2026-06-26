"use client";

import * as React from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { markdownComponents } from "@/components/viewers/page-markdown/page-markdown-components";
import { createPageMarkdownProjectionTree } from "@/components/viewers/page-markdown/page-markdown-projection-parser";
import {
  type PageMarkdownProjectionNode,
  type PageMarkdownProjectionWorkerRequest,
  type PageMarkdownProjectionWorkerResponse,
} from "@/components/viewers/page-markdown/page-markdown-projection-protocol";
import { joinEffectKey } from "@/lib/effect-key";

const PAGE_MARKDOWN_PROJECTION_CACHE_LIMIT = 160;

type PageMarkdownProjectionStatus = "idle" | "pending" | "ready" | "failed";

type PageMarkdownProjectionCacheEntry = {
  listeners: Set<() => void>;
  markdown: string;
  promise: Promise<void> | null;
  projection: React.ReactNode | null;
  status: PageMarkdownProjectionStatus;
};

const pageMarkdownProjectionCache = new Map<
  string,
  PageMarkdownProjectionCacheEntry
>();

let pageMarkdownProjectionWorker: Worker | null = null;
let pageMarkdownProjectionWorkerRequestId = 0;
const pendingPageMarkdownProjectionWorkerRequests = new Map<
  number,
  {
    reject: (error: Error) => void;
    resolve: (projection: PageMarkdownProjectionNode) => void;
  }
>();

export function projectPageMarkdown(markdown: string): React.ReactNode {
  const cached = getPageMarkdownProjectionCacheEntry(markdown);
  if (cached?.entry.status === "ready") {
    touchPageMarkdownProjectionCacheEntry(cached.cacheKey, cached.entry);
    return cached.entry.projection;
  }

  const projection = createPageMarkdownProjection(markdown);
  storePageMarkdownProjection(markdown, projection);
  return projection;
}

export function readCachedPageMarkdownProjection(
  markdown: string,
): React.ReactNode | null {
  const cached = getPageMarkdownProjectionCacheEntry(markdown);
  if (cached?.entry.status === "ready") {
    touchPageMarkdownProjectionCacheEntry(cached.cacheKey, cached.entry);
    return cached.entry.projection;
  }

  if (!isPlainPageMarkdown(markdown)) return null;

  const projection = createPageMarkdownProjection(markdown);
  storePageMarkdownProjection(markdown, projection);
  return projection;
}

export function preloadPageMarkdownProjection(markdown: string): Promise<void> {
  if (isPlainPageMarkdown(markdown)) {
    readCachedPageMarkdownProjection(markdown);
    return Promise.resolve();
  }

  const { cacheKey, entry } =
    getOrCreatePageMarkdownProjectionCacheEntry(markdown);
  if (entry.status === "ready") return Promise.resolve();
  if (entry.status === "pending" && entry.promise) return entry.promise;

  entry.status = "pending";
  const promise = createPageMarkdownProjectionTreeAsync(markdown)
    .then((projectionTree) => {
      if (pageMarkdownProjectionCache.get(cacheKey) !== entry) return;
      entry.status = "ready";
      entry.projection = createPageMarkdownProjectionFromTree(projectionTree);
      entry.promise = null;
      touchPageMarkdownProjectionCacheEntry(cacheKey, entry);
      notifyPageMarkdownProjectionListeners(entry);
    })
    .catch(() => {
      if (pageMarkdownProjectionCache.get(cacheKey) !== entry) return;
      entry.status = "failed";
      entry.promise = null;
      notifyPageMarkdownProjectionListeners(entry);
    });
  entry.promise = promise;
  trimPageMarkdownProjectionCache();
  return promise;
}

export function subscribePageMarkdownProjection(
  markdown: string,
  listener: () => void,
): () => void {
  const { entry } = getOrCreatePageMarkdownProjectionCacheEntry(markdown);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
    trimPageMarkdownProjectionCache();
  };
}

export function usePageMarkdownProjection(markdown: string) {
  const subscribe = React.useCallback(
    (listener: () => void) =>
      subscribePageMarkdownProjection(markdown, listener),
    [markdown],
  );
  const getSnapshot = React.useCallback(
    () => readCachedPageMarkdownProjection(markdown),
    [markdown],
  );
  const projection = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );

  useKeyedMountEffect(
    joinEffectKey(["page-markdown-projection", markdown]),
    () => {
      void preloadPageMarkdownProjection(markdown);
    },
  );

  return projection;
}

export function clearPageMarkdownProjectionCacheForTests() {
  pageMarkdownProjectionCache.clear();
  resetPageMarkdownProjectionWorker(
    new Error("Page Markdown projection cache cleared."),
  );
}

export function isPlainPageMarkdown(markdown: string): boolean {
  if (!markdown.trim()) return true;
  if (
    /[`[\]\\~]|!\[|&[#a-zA-Z]|https?:\/\/|www\.|mailto:|\S+@\S+\.\S+/i.test(
      markdown,
    )
  ) {
    return false;
  }
  if (/[*_<>|]/.test(markdown)) return false;
  if (/ {2,}\n/.test(markdown)) return false;

  return markdown.split(/\r\n|[\n\r\u2028\u2029]/).every((line) => {
    if (/^(?: {4}|\t)/.test(line)) return false;
    return !/^\s{0,3}(?:#{1,6}\s|[-+*]\s|\d+[.)]\s|>\s|`{3,}|~{3,}|-{3,}\s*$|={3,}\s*$)/.test(
      line,
    );
  });
}

function createPageMarkdownProjection(markdown: string): React.ReactNode {
  if (isPlainPageMarkdown(markdown)) return projectPlainPageMarkdown(markdown);

  return createPageMarkdownProjectionFromTree(
    createPageMarkdownProjectionTree(markdown),
  );
}

function createPageMarkdownProjectionFromTree(
  tree: PageMarkdownProjectionNode,
): React.ReactNode {
  return toJsxRuntime(tree as never, {
    Fragment,
    components: markdownComponents as never,
    ignoreInvalidStyle: true,
    jsx,
    jsxs,
    passKeys: true,
    passNode: true,
  });
}

function projectPlainPageMarkdown(markdown: string): React.ReactNode {
  const paragraphs = markdown
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (!paragraphs.length) return null;

  return paragraphs.map((paragraph, index) => (
    <p key={index} className="my-2 leading-relaxed">
      {paragraph}
    </p>
  ));
}

function storePageMarkdownProjection(
  markdown: string,
  projection: React.ReactNode,
) {
  const { cacheKey, entry } =
    getOrCreatePageMarkdownProjectionCacheEntry(markdown);
  entry.promise = null;
  entry.projection = projection;
  entry.status = "ready";
  touchPageMarkdownProjectionCacheEntry(cacheKey, entry);
}

function getOrCreatePageMarkdownProjectionCacheEntry(markdown: string) {
  const cacheKey = pageMarkdownProjectionCacheKey(markdown);
  const cached = pageMarkdownProjectionCache.get(cacheKey);
  if (cached?.markdown === markdown) {
    touchPageMarkdownProjectionCacheEntry(cacheKey, cached);
    return { cacheKey, entry: cached };
  }

  const entry: PageMarkdownProjectionCacheEntry = {
    listeners: new Set(),
    markdown,
    promise: null,
    projection: null,
    status: "idle",
  };
  pageMarkdownProjectionCache.set(cacheKey, entry);
  trimPageMarkdownProjectionCache();
  return { cacheKey, entry };
}

function getPageMarkdownProjectionCacheEntry(markdown: string) {
  const cacheKey = pageMarkdownProjectionCacheKey(markdown);
  const entry = pageMarkdownProjectionCache.get(cacheKey);
  if (entry?.markdown !== markdown) return null;
  return { cacheKey, entry };
}

function touchPageMarkdownProjectionCacheEntry(
  cacheKey: string,
  entry: PageMarkdownProjectionCacheEntry,
) {
  pageMarkdownProjectionCache.delete(cacheKey);
  pageMarkdownProjectionCache.set(cacheKey, entry);
  trimPageMarkdownProjectionCache();
}

function trimPageMarkdownProjectionCache() {
  if (
    pageMarkdownProjectionCache.size <= PAGE_MARKDOWN_PROJECTION_CACHE_LIMIT
  ) {
    return;
  }

  for (const [cacheKey, entry] of pageMarkdownProjectionCache) {
    if (
      pageMarkdownProjectionCache.size <= PAGE_MARKDOWN_PROJECTION_CACHE_LIMIT
    ) {
      return;
    }
    if (entry.listeners.size > 0) continue;
    pageMarkdownProjectionCache.delete(cacheKey);
  }
}

function notifyPageMarkdownProjectionListeners(
  entry: PageMarkdownProjectionCacheEntry,
) {
  for (const listener of Array.from(entry.listeners)) listener();
}

function createPageMarkdownProjectionTreeAsync(
  markdown: string,
): Promise<PageMarkdownProjectionNode> {
  if (canUsePageMarkdownProjectionWorker()) {
    return createPageMarkdownProjectionTreeInWorker(markdown).catch(() =>
      createPageMarkdownProjectionTreeInIdle(markdown),
    );
  }
  return createPageMarkdownProjectionTreeInIdle(markdown);
}

function createPageMarkdownProjectionTreeInWorker(
  markdown: string,
): Promise<PageMarkdownProjectionNode> {
  const id = ++pageMarkdownProjectionWorkerRequestId;

  return new Promise((resolve, reject) => {
    pendingPageMarkdownProjectionWorkerRequests.set(id, { reject, resolve });
    try {
      getPageMarkdownProjectionWorker().postMessage({
        id,
        markdown,
        type: "project",
      } satisfies PageMarkdownProjectionWorkerRequest);
    } catch (error) {
      pendingPageMarkdownProjectionWorkerRequests.delete(id);
      reject(toPageMarkdownProjectionError(error));
    }
  });
}

function createPageMarkdownProjectionTreeInIdle(
  markdown: string,
): Promise<PageMarkdownProjectionNode> {
  return new Promise((resolve, reject) => {
    const project = () => {
      try {
        resolve(createPageMarkdownProjectionTree(markdown));
      } catch (error) {
        reject(toPageMarkdownProjectionError(error));
      }
    };

    if (
      typeof window !== "undefined" &&
      typeof window.requestIdleCallback === "function"
    ) {
      window.requestIdleCallback(project, { timeout: 500 });
      return;
    }

    globalThis.setTimeout(project, 0);
  });
}

function canUsePageMarkdownProjectionWorker() {
  return typeof window !== "undefined" && typeof Worker === "function";
}

function getPageMarkdownProjectionWorker() {
  if (pageMarkdownProjectionWorker) return pageMarkdownProjectionWorker;

  const worker = new Worker(
    new URL("./page-markdown-projection.worker", import.meta.url),
  );
  pageMarkdownProjectionWorker = worker;
  worker.onmessage = (
    event: MessageEvent<PageMarkdownProjectionWorkerResponse>,
  ) => {
    const response = event.data;
    const pending = pendingPageMarkdownProjectionWorkerRequests.get(
      response.id,
    );
    if (!pending) return;
    pendingPageMarkdownProjectionWorkerRequests.delete(response.id);
    if (response.ok) {
      pending.resolve(response.projection);
      return;
    }
    pending.reject(new Error(response.error));
  };
  worker.onerror = (event) => {
    resetPageMarkdownProjectionWorker(
      event.error instanceof Error
        ? event.error
        : new Error(event.message || "Page Markdown projection worker failed."),
    );
  };
  return worker;
}

function resetPageMarkdownProjectionWorker(error: Error) {
  pageMarkdownProjectionWorker?.terminate();
  pageMarkdownProjectionWorker = null;
  pageMarkdownProjectionWorkerRequestId = 0;
  for (const pending of pendingPageMarkdownProjectionWorkerRequests.values()) {
    pending.reject(error);
  }
  pendingPageMarkdownProjectionWorkerRequests.clear();
}

function toPageMarkdownProjectionError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error || "Page Markdown projection failed."));
}

function pageMarkdownProjectionCacheKey(markdown: string): string {
  return `${markdown.length}:${hashPageMarkdown(markdown)}`;
}

function hashPageMarkdown(markdown: string): string {
  let hash = 0;
  for (let index = 0; index < markdown.length; index += 1) {
    hash = Math.imul(hash ^ markdown.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36);
}
