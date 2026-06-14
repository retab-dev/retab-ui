"use client"

import * as React from "react"

import type { ViewerSource } from "@/lib/viewer-source"

import type { FileSystemFileEntry, FileSystemProps } from "./file-system-types"

export type FileSystemSourceController = {
  resolveFileSource: (
    file: FileSystemFileEntry,
    signal: AbortSignal
  ) => Promise<ViewerSource | null>
}

export function useFileSystemSourceController({
  items,
  resolveSource,
}: Pick<
  FileSystemProps,
  "items" | "resolveSource"
>): FileSystemSourceController {
  const sourceCache = React.useRef(new Map<string, ViewerSource | null>())
  const sourceCacheItemsRef = React.useRef(items)

  if (sourceCacheItemsRef.current !== items) {
    sourceCache.current.clear()
    sourceCacheItemsRef.current = items
  }

  const resolveFileSource = React.useCallback(
    async (file: FileSystemFileEntry, signal: AbortSignal) => {
      if (file.source) return file.source

      const cacheKey = sourceCacheKey(file)

      if (sourceCache.current.has(cacheKey)) {
        return sourceCache.current.get(cacheKey) ?? null
      }
      if (!resolveSource) return null

      const source = await resolveSource({ file, signal })

      if (!signal.aborted) sourceCache.current.set(cacheKey, source)
      return source
    },
    [resolveSource]
  )

  return { resolveFileSource }
}

function sourceCacheKey(file: FileSystemFileEntry) {
  return [file.path, file.key, file.etag ?? "", file.updatedAt ?? ""].join("\0")
}
