"use client";

import * as React from "react";

import {
  createMarkdownGreenfieldDocument,
  markdownGreenfieldDocumentTextKey,
  type MarkdownGreenfieldDocument,
} from "./markdown-greenfield-document";

export const MARKDOWN_GREENFIELD_ASYNC_DOCUMENT_MIN_CHARS = 60_000;
const MARKDOWN_GREENFIELD_DOCUMENT_WORKER_ENABLED = false;
const MARKDOWN_GREENFIELD_DOCUMENT_WORKER_READY_TIMEOUT_MS = 800;

type MarkdownIdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: Window["requestIdleCallback"];
  };

type MarkdownDocumentState =
  | { status: "failed"; error: Error }
  | { status: "pending" }
  | { status: "ready"; document: MarkdownGreenfieldDocument };

type MarkdownDocumentEntry = {
  key: string;
  listeners: Set<() => void>;
  started: boolean;
  state: MarkdownDocumentState;
  text: string;
};

type MarkdownDocumentWorkerRequest = {
  id: number;
  text: string;
};

type MarkdownDocumentWorkerResponse =
  | {
      type: "ready";
    }
  | {
      document: MarkdownGreenfieldDocument;
      id: number;
      ok: true;
      type: "result";
    }
  | {
      id: number;
      message: string;
      ok: false;
      type: "result";
    };

const markdownDocumentEntries = new Map<string, MarkdownDocumentEntry>();
let nextMarkdownDocumentWorkerRequestId = 1;

export function useMarkdownGreenfieldDocument(text: string) {
  const shouldLoadAsync =
    text.length >= MARKDOWN_GREENFIELD_ASYNC_DOCUMENT_MIN_CHARS;
  const syncDocument = React.useMemo(
    () => (shouldLoadAsync ? null : createMarkdownGreenfieldDocument(text)),
    [shouldLoadAsync, text],
  );
  const entry = React.useMemo(
    () => (shouldLoadAsync ? getMarkdownDocumentEntry(text) : null),
    [shouldLoadAsync, text],
  );
  const asyncState = React.useSyncExternalStore(
    React.useCallback(
      (onStoreChange) => {
        if (!entry) return () => {};
        entry.listeners.add(onStoreChange);
        startMarkdownDocumentEntry(entry);
        return () => {
          entry.listeners.delete(onStoreChange);
        };
      },
      [entry],
    ),
    React.useCallback(() => entry?.state ?? null, [entry]),
    () => null,
  );

  if (syncDocument) return syncDocument;
  if (!asyncState || asyncState.status === "pending") return null;
  if (asyncState.status === "failed") throw asyncState.error;
  return asyncState.document;
}

function getMarkdownDocumentEntry(text: string) {
  const key = markdownGreenfieldDocumentTextKey(text);
  const existing = markdownDocumentEntries.get(key);
  if (existing?.text === text) return existing;

  const entry: MarkdownDocumentEntry = {
    key,
    listeners: new Set(),
    started: false,
    state: { status: "pending" },
    text,
  };
  markdownDocumentEntries.set(key, entry);
  while (markdownDocumentEntries.size > 16) {
    const oldestKey = markdownDocumentEntries.keys().next().value;
    if (!oldestKey || oldestKey === key) break;
    markdownDocumentEntries.delete(oldestKey);
  }
  return entry;
}

function startMarkdownDocumentEntry(entry: MarkdownDocumentEntry) {
  if (entry.started || entry.state.status !== "pending") return;
  entry.started = true;

  if (
    MARKDOWN_GREENFIELD_DOCUMENT_WORKER_ENABLED &&
    typeof Worker !== "undefined"
  ) {
    try {
      startMarkdownDocumentWorker(entry);
      return;
    } catch {
      startMarkdownDocumentFallback(entry);
      return;
    }
  }

  startMarkdownDocumentFallback(entry);
}

function startMarkdownDocumentWorker(entry: MarkdownDocumentEntry) {
  const worker = new Worker(
    new URL("./markdown-greenfield-document.worker", import.meta.url),
    { type: "module" },
  );
  const id = nextMarkdownDocumentWorkerRequestId++;
  let isSettled = false;
  const readyTimeoutId = window.setTimeout(() => {
    fallBackToMainThread();
  }, MARKDOWN_GREENFIELD_DOCUMENT_WORKER_READY_TIMEOUT_MS);

  const fallBackToMainThread = () => {
    if (isSettled) return;
    isSettled = true;
    window.clearTimeout(readyTimeoutId);
    worker.terminate();
    startMarkdownDocumentFallback(entry);
  };

  worker.onmessage = (event: MessageEvent<MarkdownDocumentWorkerResponse>) => {
    if (event.data.type === "ready") {
      window.clearTimeout(readyTimeoutId);
      worker.postMessage({
        id,
        text: entry.text,
      } satisfies MarkdownDocumentWorkerRequest);
      return;
    }
    if (event.data.id !== id || isSettled) return;
    isSettled = true;
    window.clearTimeout(readyTimeoutId);
    worker.terminate();
    if (event.data.ok) {
      publishMarkdownDocumentState(entry, {
        document: event.data.document,
        status: "ready",
      });
      return;
    }
    publishMarkdownDocumentState(entry, {
      error: new Error(event.data.message),
      status: "failed",
    });
  };
  worker.onerror = fallBackToMainThread;
  worker.onmessageerror = fallBackToMainThread;
}

function startMarkdownDocumentFallback(entry: MarkdownDocumentEntry) {
  scheduleMarkdownDocumentTask(() => {
    try {
      publishMarkdownDocumentState(entry, {
        document: createMarkdownGreenfieldDocument(entry.text),
        status: "ready",
      });
    } catch (error) {
      publishMarkdownDocumentState(entry, {
        error:
          error instanceof Error
            ? error
            : new Error("Could not parse Markdown."),
        status: "failed",
      });
    }
  });
}

function scheduleMarkdownDocumentTask(callback: () => void) {
  if (typeof window === "undefined") return;
  const browserWindow = window as MarkdownIdleWindow;
  if (browserWindow.requestIdleCallback) {
    browserWindow.requestIdleCallback(callback, { timeout: 120 });
    return;
  }
  browserWindow.setTimeout(callback, 0);
}

function publishMarkdownDocumentState(
  entry: MarkdownDocumentEntry,
  state: MarkdownDocumentState,
) {
  entry.state = state;
  for (const listener of entry.listeners) listener();
}
