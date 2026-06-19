"use client";

import * as React from "react";

import type { ViewerSource } from "@/lib/viewer-source";

import type { FileSystemFileEntry, FileSystemProps } from "./file-system-types";

export type FileSystemSourceController = {
  resolveFileSource: (
    file: FileSystemFileEntry,
    signal: AbortSignal,
  ) => Promise<ViewerSource | null>;
};

export function useFileSystemSourceController({
  items,
  resolveSource,
}: Pick<
  FileSystemProps,
  "items" | "resolveSource"
>): FileSystemSourceController {
  const sourceCache = React.useRef(new Map<string, ViewerSource | null>());
  const pendingSourceCache = React.useRef(
    new Map<string, Promise<ViewerSource | null>>(),
  );
  const sourceCacheItemsRef = React.useRef(items);

  if (sourceCacheItemsRef.current !== items) {
    sourceCache.current.clear();
    pendingSourceCache.current.clear();
    sourceCacheItemsRef.current = items;
  }

  const resolveFileSource = React.useCallback(
    async (file: FileSystemFileEntry, signal: AbortSignal) => {
      if (file.source) return file.source;

      const cacheKey = sourceCacheKey(file);

      if (sourceCache.current.has(cacheKey)) {
        return sourceCache.current.get(cacheKey) ?? null;
      }
      const pendingSource = pendingSourceCache.current.get(cacheKey);
      if (pendingSource) return pendingSource;
      if (!resolveSource) return null;

      const sourcePromise = resolveSource({ file, signal }).then(
        (source) => {
          pendingSourceCache.current.delete(cacheKey);
          if (!signal.aborted) sourceCache.current.set(cacheKey, source);
          return source;
        },
        (error: unknown) => {
          pendingSourceCache.current.delete(cacheKey);
          throw error;
        },
      );

      pendingSourceCache.current.set(cacheKey, sourcePromise);
      signal.addEventListener(
        "abort",
        () => {
          pendingSourceCache.current.delete(cacheKey);
        },
        { once: true },
      );
      return sourcePromise;
    },
    [resolveSource],
  );

  return { resolveFileSource };
}

function sourceCacheKey(file: FileSystemFileEntry) {
  return [file.path, file.key, file.etag ?? "", file.updatedAt ?? ""].join(
    "\0",
  );
}
