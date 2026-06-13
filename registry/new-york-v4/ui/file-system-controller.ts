"use client"

import * as React from "react"

import type { ViewerSource } from "@/lib/viewer-source"

import { buildFileSystemIndex, normalizeFolderPath } from "./file-system-index"
import {
  collectFileSystemCategories,
  DEFAULT_FILE_SYSTEM_SORT,
  deriveVisibleIndex,
  fileMatchesQuery,
  fileSystemFilterIsEmpty,
} from "./file-system-query"
import type {
  FileSystemEntry,
  FileSystemFileEntry,
  FileSystemItem,
  FileSystemLoadChildrenResult,
  FileSystemProps,
  FileSystemQueryState,
  FileSystemSortKey,
  FileSystemView,
} from "./file-system-types"

export type FileSystemController = ReturnType<typeof useFileSystemController>

export function useFileSystemController({
  items,
  defaultPath = "",
  defaultSelectedPath = null,
  defaultView = "list",
  loadChildren,
  onSelectionChange,
  onViewChange,
  resolveSource,
  selectedPath: selectedPathProp,
  view: viewProp,
}: Pick<
  FileSystemProps,
  | "items"
  | "defaultPath"
  | "defaultSelectedPath"
  | "defaultView"
  | "loadChildren"
  | "onSelectionChange"
  | "onViewChange"
  | "resolveSource"
  | "selectedPath"
  | "view"
>) {
  const [loadedItems, setLoadedItems] = React.useState<FileSystemItem[]>([])
  const allItems = React.useMemo(
    () => (loadedItems.length ? [...items, ...loadedItems] : items),
    [items, loadedItems]
  )
  const rawIndex = React.useMemo(
    () => buildFileSystemIndex(allItems),
    [allItems]
  )
  const [query, setQuery] = React.useState<FileSystemQueryState>({
    filters: { categories: [], updatedAfter: null },
    search: "",
    sort: DEFAULT_FILE_SYSTEM_SORT,
  })
  const [history, setHistory] = React.useState(() => ({
    index: 0,
    stack: [normalizeFolderPath(defaultPath)],
  }))
  const currentPath = history.stack[history.index] ?? ""
  const visibleIndex = React.useMemo(
    () => deriveVisibleIndex(rawIndex, currentPath, query),
    [currentPath, query, rawIndex]
  )

  const [internalView, setInternalView] =
    React.useState<FileSystemView>(defaultView)
  const view = viewProp ?? internalView
  const setView = React.useCallback(
    (nextView: FileSystemView) => {
      setInternalView(nextView)
      onViewChange?.(nextView)
    },
    [onViewChange]
  )

  const isSelectionControlled = selectedPathProp !== undefined
  const [internalSelectedPath, setInternalSelectedPath] = React.useState<
    string | null
  >(defaultSelectedPath)
  const selectedPath = isSelectionControlled
    ? (selectedPathProp ?? null)
    : internalSelectedPath
  const selectedEntry = React.useMemo(() => {
    if (!selectedPath) return null
    return (
      rawIndex.files.get(selectedPath) ??
      rawIndex.folders.get(normalizeFolderPath(selectedPath)) ??
      null
    )
  }, [rawIndex, selectedPath])

  const selectEntry = React.useCallback(
    (entry: FileSystemEntry | null) => {
      if (!isSelectionControlled) setInternalSelectedPath(entry?.path ?? null)
      onSelectionChange?.(entry)
    },
    [isSelectionControlled, onSelectionChange]
  )

  React.useEffect(() => {
    if (
      !selectedEntry ||
      (!query.search && fileSystemFilterIsEmpty(query.filters))
    ) {
      return
    }
    if (
      selectedEntry.kind === "file" &&
      fileMatchesQuery(selectedEntry, query)
    ) {
      return
    }
    if (selectedEntry.kind === "folder") {
      const visible = visibleIndex.folders.has(selectedEntry.path)
      if (visible) return
    }
    selectEntry(null)
  }, [query, selectEntry, selectedEntry, visibleIndex.folders])

  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(
    () => new Set()
  )
  const [loadingFolders, setLoadingFolders] = React.useState<Set<string>>(
    () => new Set()
  )
  const [folderErrors, setFolderErrors] = React.useState(
    new Map<string, string>()
  )
  const folderRequests = React.useRef(new Map<string, AbortController>())
  const sourceCache = React.useRef(new Map<string, ViewerSource | null>())

  React.useEffect(() => {
    const requests = folderRequests.current

    return () => {
      for (const controller of requests.values()) {
        controller.abort()
      }
    }
  }, [])

  const setSearch = React.useCallback((search: string) => {
    setQuery((previous) => ({ ...previous, search }))
  }, [])

  const setSortKey = React.useCallback((key: FileSystemSortKey) => {
    setQuery((previous) => ({
      ...previous,
      sort:
        previous.sort.key === key
          ? {
              direction: previous.sort.direction === "asc" ? "desc" : "asc",
              key,
            }
          : {
              direction: key === "name" || key === "kind" ? "asc" : "desc",
              key,
            },
    }))
  }, [])

  const toggleCategory = React.useCallback((category: string) => {
    setQuery((previous) => {
      const categories = previous.filters.categories.includes(category)
        ? previous.filters.categories.filter((entry) => entry !== category)
        : [...previous.filters.categories, category]

      return {
        ...previous,
        filters: { ...previous.filters, categories },
      }
    })
  }, [])

  const setModifiedAfter = React.useCallback(
    (updatedAfter: FileSystemQueryState["filters"]["updatedAfter"]) => {
      setQuery((previous) => ({
        ...previous,
        filters: {
          ...previous.filters,
          updatedAfter:
            previous.filters.updatedAfter === updatedAfter
              ? null
              : updatedAfter,
        },
      }))
    },
    []
  )

  const clearFilters = React.useCallback(() => {
    setQuery((previous) => ({
      ...previous,
      filters: { categories: [], updatedAfter: null },
    }))
  }, [])

  const toggleExpanded = React.useCallback((path: string) => {
    setExpandedPaths((previous) => {
      const next = new Set(previous)

      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }

      return next
    })
  }, [])

  const ensureChildren = React.useCallback(
    async (path: string, { retry = false }: { retry?: boolean } = {}) => {
      const folderPath = normalizeFolderPath(path)
      const folder = rawIndex.folders.get(folderPath)

      if (!loadChildren || !folder?.hasChildren) return
      if (!retry && (rawIndex.children.get(folderPath)?.length ?? 0) > 0) return
      if (folderRequests.current.has(folderPath)) return

      const controller = new AbortController()

      folderRequests.current.set(folderPath, controller)
      setLoadingFolders((previous) => new Set(previous).add(folderPath))
      setFolderErrors((previous) => {
        const next = new Map(previous)

        next.delete(folderPath)
        return next
      })

      try {
        let cursor: string | null = null
        const nextItems: FileSystemItem[] = []

        do {
          const result: FileSystemLoadChildrenResult = await loadChildren({
            cursor,
            path: folderPath,
            signal: controller.signal,
          })

          nextItems.push(...result.items)
          cursor = result.nextCursor ?? null
        } while (cursor && !controller.signal.aborted)

        if (!controller.signal.aborted && nextItems.length) {
          setLoadedItems((previous) => [...previous, ...nextItems])
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setFolderErrors((previous) =>
            new Map(previous).set(folderPath, errorMessage(error))
          )
        }
      } finally {
        folderRequests.current.delete(folderPath)
        setLoadingFolders((previous) => {
          const next = new Set(previous)

          next.delete(folderPath)
          return next
        })
      }
    },
    [loadChildren, rawIndex.children, rawIndex.folders]
  )

  const navigateTo = React.useCallback(
    (path: string) => {
      const folderPath = normalizeFolderPath(path)

      setHistory((previous) => {
        if (previous.stack[previous.index] === folderPath) return previous

        const stack = [
          ...previous.stack.slice(0, previous.index + 1),
          folderPath,
        ]

        return { index: stack.length - 1, stack }
      })
      setSearch("")
      selectEntry(null)
      void ensureChildren(folderPath)
    },
    [ensureChildren, selectEntry, setSearch]
  )

  const goBack = React.useCallback(() => {
    setHistory((previous) => ({
      ...previous,
      index: Math.max(0, previous.index - 1),
    }))
    selectEntry(null)
    setSearch("")
  }, [selectEntry, setSearch])

  const goForward = React.useCallback(() => {
    setHistory((previous) => ({
      ...previous,
      index: Math.min(previous.stack.length - 1, previous.index + 1),
    }))
    selectEntry(null)
    setSearch("")
  }, [selectEntry, setSearch])

  const openEntry = React.useCallback(
    (entry: FileSystemEntry) => {
      if (entry.kind === "folder") {
        navigateTo(entry.path)
      }
    },
    [navigateTo]
  )

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

  React.useEffect(() => {
    void ensureChildren(currentPath)
  }, [currentPath, ensureChildren])

  const categories = React.useMemo(
    () => collectFileSystemCategories(rawIndex),
    [rawIndex]
  )
  const currentEntries = visibleIndex.children.get(currentPath) ?? []
  const currentFolder =
    currentPath === "" ? null : (rawIndex.folders.get(currentPath) ?? null)

  return {
    canGoBack: history.index > 0,
    canGoForward: history.index < history.stack.length - 1,
    categories,
    clearFilters,
    currentEntries,
    currentFolder,
    currentPath,
    ensureChildren,
    expandedPaths,
    folderErrors,
    goBack,
    goForward,
    index: visibleIndex,
    loadingFolders,
    navigateTo,
    openEntry,
    query,
    rawIndex,
    resolveFileSource,
    selectEntry,
    selectedEntry,
    selectedPath,
    setModifiedAfter,
    setSearch,
    setSortKey,
    setView,
    toggleCategory,
    toggleExpanded,
    view,
  }
}

function sourceCacheKey(file: FileSystemFileEntry) {
  return [file.path, file.key, file.etag ?? "", file.updatedAt ?? ""].join("\0")
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Couldn't load this folder."
}
