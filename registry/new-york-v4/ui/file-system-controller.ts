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
  const folderPromises = React.useRef(new Map<string, Promise<FileSystemEntry[]>>())
  const sourceCache = React.useRef(new Map<string, ViewerSource | null>())

  React.useEffect(() => {
    const requests = folderRequests.current

    return () => {
      for (const controller of requests.values()) {
        controller.abort()
      }
    }
  }, [])

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
      const rawChildren = rawIndex.children.get(folderPath) ?? []
      const currentChildren = visibleIndex.children.get(folderPath) ?? []

      if (!loadChildren || !folder?.hasChildren) return currentChildren
      if (!retry && rawChildren.length > 0) return currentChildren
      if (!retry && folderPromises.current.has(folderPath)) {
        return folderPromises.current.get(folderPath)!
      }

      const controller = new AbortController()
      const loadPromise = (async () => {
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

          if (controller.signal.aborted) return currentChildren
          if (!nextItems.length) return currentChildren

          const nextRawIndex = buildFileSystemIndex([...allItems, ...nextItems])
          const nextVisibleIndex = deriveVisibleIndex(
            nextRawIndex,
            currentPath,
            query
          )

          setLoadedItems((previous) => [...previous, ...nextItems])
          return nextVisibleIndex.children.get(folderPath) ?? []
        } catch (error) {
          if (!controller.signal.aborted) {
            setFolderErrors((previous) =>
              new Map(previous).set(folderPath, errorMessage(error))
            )
          }
          return currentChildren
        } finally {
          folderRequests.current.delete(folderPath)
          folderPromises.current.delete(folderPath)
          setLoadingFolders((previous) => {
            const next = new Set(previous)

            next.delete(folderPath)
            return next
          })
        }
      })()

      folderPromises.current.set(folderPath, loadPromise)
      return loadPromise
    },
    [
      allItems,
      currentPath,
      loadChildren,
      query,
      rawIndex.children,
      rawIndex.folders,
      visibleIndex.children,
    ]
  )

  const navigateTo = React.useCallback(
    (path: string) => {
      const folderPath = normalizeFolderPath(path)

      setCurrentPath(folderPath)
      setSearch("")
      selectEntry(null)
      void ensureChildren(folderPath)
    },
    [ensureChildren, selectEntry, setCurrentPath, setSearch]
  )

  const goBack = React.useCallback(() => {
    let nextPath = ""

    setHistory((previous) => {
      const index = Math.max(0, previous.index - 1)

      nextPath = previous.stack[index] ?? ""
      return { ...previous, index }
    })
    onPathChange?.(nextPath)
    selectEntry(null)
    setSearch("")
  }, [onPathChange, selectEntry, setSearch])

  const goForward = React.useCallback(() => {
    let nextPath = ""

    setHistory((previous) => {
      const index = Math.min(previous.stack.length - 1, previous.index + 1)

      nextPath = previous.stack[index] ?? ""
      return { ...previous, index }
    })
    onPathChange?.(nextPath)
    selectEntry(null)
    setSearch("")
  }, [onPathChange, selectEntry, setSearch])

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
      const currentChildren = visibleIndex.children.get(folderPath) ?? []
      const children = currentChildren.length
        ? currentChildren
        : await ensureChildren(folderPath)
      const entry = children[0] ?? null

      if (entry) selectEntry(entry)
    },
    [ensureChildren, selectEntry, visibleIndex.children]
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
    selectFirstChildAfterEnsure,
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
