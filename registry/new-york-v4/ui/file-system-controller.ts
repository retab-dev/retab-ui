"use client"

import * as React from "react"

import type { ViewerSource } from "@/lib/viewer-source"

import { buildFileSystemIndex, normalizeFolderPath } from "./file-system-index"
import {
  collectFileSystemCategories,
  createFileSystemQueryState,
  deriveVisibleIndex,
  fileMatchesQuery,
  fileSystemFilterIsEmpty,
} from "./file-system-query"
import type {
  FileSystemEntry,
  FileSystemFileEntry,
  FileSystemItem,
  FileSystemProps,
  FileSystemQueryState,
  FileSystemSortKey,
  FileSystemView,
} from "./file-system-types"
import { useFileSystemChildrenLoader } from "./use-file-system-children-loader"

export type FileSystemController = ReturnType<typeof useFileSystemController>

export function useFileSystemController({
  items,
  defaultPath = "",
  defaultQuery,
  defaultSelectedPath = null,
  defaultView = "list",
  loadChildren,
  onPathChange,
  onQueryChange,
  onSelectionChange,
  onViewChange,
  path: pathProp,
  query: queryProp,
  resolveSource,
  selectedPath: selectedPathProp,
  view: viewProp,
}: Pick<
  FileSystemProps,
  | "defaultQuery"
  | "items"
  | "defaultPath"
  | "defaultSelectedPath"
  | "defaultView"
  | "loadChildren"
  | "onPathChange"
  | "onQueryChange"
  | "onSelectionChange"
  | "onViewChange"
  | "path"
  | "query"
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
  const defaultQueryState = React.useMemo(
    () => createFileSystemQueryState(defaultQuery),
    [defaultQuery]
  )
  const [internalQuery, setInternalQuery] =
    React.useState<FileSystemQueryState>(defaultQueryState)
  const query = queryProp ?? internalQuery
  const isQueryControlled = queryProp !== undefined
  const setQuery = React.useCallback(
    (
      updater:
        | FileSystemQueryState
        | ((previous: FileSystemQueryState) => FileSystemQueryState)
    ) => {
      const nextQuery = typeof updater === "function" ? updater(query) : updater

      if (!isQueryControlled) setInternalQuery(nextQuery)
      onQueryChange?.(nextQuery)
    },
    [isQueryControlled, onQueryChange, query]
  )
  const [history, setHistory] = React.useState(() => ({
    index: 0,
    stack: [normalizeFolderPath(defaultPath)],
  }))
  const isPathControlled = pathProp !== undefined
  const currentPath = isPathControlled
    ? normalizeFolderPath(pathProp)
    : (history.stack[history.index] ?? "")
  const setCurrentPath = React.useCallback(
    (path: string, { replace = false }: { replace?: boolean } = {}) => {
      const folderPath = normalizeFolderPath(path)

      setHistory((previous) => {
        const currentHistoryPath = previous.stack[previous.index] ?? ""

        if (currentHistoryPath === folderPath) return previous
        if (replace) {
          const stack = [...previous.stack]

          stack[previous.index] = folderPath
          return { ...previous, stack }
        }

        const stack = [
          ...previous.stack.slice(0, previous.index + 1),
          folderPath,
        ]

        return { index: stack.length - 1, stack }
      })
      onPathChange?.(folderPath)
    },
    [onPathChange]
  )
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
  const childSelectionRequestRef = React.useRef(0)
  const selectionStateRef = React.useRef({ currentPath, selectedPath })

  React.useLayoutEffect(() => {
    selectionStateRef.current = { currentPath, selectedPath }
  }, [currentPath, selectedPath])

  const invalidateChildSelectionRequest = React.useCallback(() => {
    childSelectionRequestRef.current += 1
  }, [])

  const selectEntry = React.useCallback(
    (entry: FileSystemEntry | null) => {
      const path = entry?.path ?? null

      if (path !== selectionStateRef.current.selectedPath) {
        invalidateChildSelectionRequest()
      }
      if (!isSelectionControlled) setInternalSelectedPath(entry?.path ?? null)
      onSelectionChange?.(entry)
    },
    [invalidateChildSelectionRequest, isSelectionControlled, onSelectionChange]
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

  const sourceCache = React.useRef(new Map<string, ViewerSource | null>())
  const { ensureChildren, folderErrors, loadingFolders } =
    useFileSystemChildrenLoader({
      allItems,
      currentPath,
      loadChildren,
      query,
      rawIndex,
      setLoadedItems,
      visibleIndex,
    })

  const setSearch = React.useCallback(
    (search: string) => {
      setQuery((previous) => ({ ...previous, search }))
    },
    [setQuery]
  )

  const setSortKey = React.useCallback(
    (key: FileSystemSortKey) => {
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
    },
    [setQuery]
  )

  const toggleCategory = React.useCallback(
    (category: string) => {
      setQuery((previous) => {
        const categories = previous.filters.categories.includes(category)
          ? previous.filters.categories.filter((entry) => entry !== category)
          : [...previous.filters.categories, category]

        return {
          ...previous,
          filters: { ...previous.filters, categories },
        }
      })
    },
    [setQuery]
  )

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
    [setQuery]
  )

  const clearFilters = React.useCallback(() => {
    setQuery((previous) => ({
      ...previous,
      filters: { categories: [], updatedAfter: null },
    }))
  }, [setQuery])

  const navigateTo = React.useCallback(
    (path: string) => {
      const folderPath = normalizeFolderPath(path)

      if (folderPath !== selectionStateRef.current.currentPath) {
        invalidateChildSelectionRequest()
      }
      setCurrentPath(folderPath)
      setSearch("")
      selectEntry(null)
      void ensureChildren(folderPath)
    },
    [
      ensureChildren,
      invalidateChildSelectionRequest,
      selectEntry,
      setCurrentPath,
      setSearch,
    ]
  )

  const goBack = React.useCallback(() => {
    let nextPath = ""

    setHistory((previous) => {
      const index = Math.max(0, previous.index - 1)

      nextPath = previous.stack[index] ?? ""
      return { ...previous, index }
    })
    if (nextPath !== selectionStateRef.current.currentPath) {
      invalidateChildSelectionRequest()
    }
    onPathChange?.(nextPath)
    selectEntry(null)
    setSearch("")
  }, [invalidateChildSelectionRequest, onPathChange, selectEntry, setSearch])

  const goForward = React.useCallback(() => {
    let nextPath = ""

    setHistory((previous) => {
      const index = Math.min(previous.stack.length - 1, previous.index + 1)

      nextPath = previous.stack[index] ?? ""
      return { ...previous, index }
    })
    if (nextPath !== selectionStateRef.current.currentPath) {
      invalidateChildSelectionRequest()
    }
    onPathChange?.(nextPath)
    selectEntry(null)
    setSearch("")
  }, [invalidateChildSelectionRequest, onPathChange, selectEntry, setSearch])

  const openEntry = React.useCallback(
    (entry: FileSystemEntry) => {
      if (entry.kind === "folder") {
        navigateTo(entry.path)
      }
    },
    [navigateTo]
  )

  const selectFirstChildAfterEnsure = React.useCallback(
    async (path: string) => {
      const folderPath = normalizeFolderPath(path)
      const requestedCurrentPath = selectionStateRef.current.currentPath
      const requestId = childSelectionRequestRef.current + 1

      childSelectionRequestRef.current = requestId
      const children = await ensureChildren(folderPath)
      const entry = children[0] ?? null
      const state = selectionStateRef.current

      if (childSelectionRequestRef.current !== requestId) return
      if (state.selectedPath !== folderPath) return
      if (state.currentPath !== requestedCurrentPath) return
      if (entry) selectEntry(entry)
    },
    [ensureChildren, selectEntry]
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
    selectFirstChildAfterEnsure,
    selectedEntry,
    selectedPath,
    setModifiedAfter,
    setSearch,
    setSortKey,
    setView,
    toggleCategory,
    view,
  }
}

function sourceCacheKey(file: FileSystemFileEntry) {
  return [file.path, file.key, file.etag ?? "", file.updatedAt ?? ""].join("\0")
}
