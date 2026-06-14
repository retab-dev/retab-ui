"use client"

import * as React from "react"

import {
  useFileSystemIndexState,
  type FileSystemIndexState,
} from "./file-system-index-state"
import {
  useFileSystemLoadedItems,
  useFileSystemLoadingController,
  type FileSystemLoadedItemsState,
  type FileSystemLoadingController,
} from "./file-system-loading-controller"
import {
  useFileSystemNavigationController,
  type FileSystemNavigationController,
} from "./file-system-navigation-controller"
import {
  useFileSystemPathHistory,
  type FileSystemPathHistoryController,
} from "./file-system-path-history"
import {
  useFileSystemQueryController,
  type FileSystemQueryController,
} from "./file-system-query-controller"
import {
  useFileSystemSelectionController,
  type FileSystemSelectionController,
} from "./file-system-selection-controller"
import {
  useFileSystemSourceController,
  type FileSystemSourceController,
} from "./file-system-source-controller"
import type { FileSystemProps } from "./file-system-types"
import {
  useFileSystemViewController,
  type FileSystemViewController,
} from "./file-system-view-controller"

export type FileSystemDomainState = {
  query: FileSystemQueryController
  view: FileSystemViewController
  source: FileSystemSourceController
  index: FileSystemIndexState
  loading: FileSystemLoadingController
  selection: FileSystemSelectionController
  navigation: FileSystemNavigationController
}

export type FileSystemStateSlices = FileSystemDomainState & {
  pathHistory: FileSystemPathHistoryController
  loadedItems: FileSystemLoadedItemsState
}

export type FileSystemHeaderController = Pick<
  FileSystemNavigationController,
  "canGoBack" | "canGoForward" | "currentPath" | "goBack" | "goForward"
> &
  Pick<FileSystemQueryController, "query" | "setSearch" | "setSortKey"> &
  Pick<FileSystemViewController, "setView" | "view">

export type FileSystemPreviewController = Pick<
  FileSystemSelectionController,
  "selectedEntry"
> &
  Pick<FileSystemSourceController, "resolveFileSource">

export function createFileSystemHeaderController({
  navigation,
  query,
  view,
}: Pick<
  FileSystemDomainState,
  "navigation" | "query" | "view"
>): FileSystemHeaderController {
  return {
    canGoBack: navigation.canGoBack,
    canGoForward: navigation.canGoForward,
    currentPath: navigation.currentPath,
    goBack: navigation.goBack,
    goForward: navigation.goForward,
    query: query.query,
    setSearch: query.setSearch,
    setSortKey: query.setSortKey,
    setView: view.setView,
    view: view.view,
  }
}

export function createFileSystemPreviewController({
  selection,
  source,
}: Pick<
  FileSystemDomainState,
  "selection" | "source"
>): FileSystemPreviewController {
  return {
    resolveFileSource: source.resolveFileSource,
    selectedEntry: selection.selectedEntry,
  }
}

export function useFileSystemStateSlices({
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
  path,
  query: queryProp,
  resolveSource,
  selectedPath,
  view: viewProp,
}: Pick<
  FileSystemProps,
  | "defaultPath"
  | "defaultQuery"
  | "defaultSelectedPath"
  | "defaultView"
  | "items"
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
>): FileSystemStateSlices {
  // State graph:
  // query, view, source, pathHistory, loadedItems
  // -> index
  // -> loading
  // -> selection
  // -> navigation
  const query = useFileSystemQueryController({
    defaultQuery,
    onQueryChange,
    query: queryProp,
  })
  const view = useFileSystemViewController({
    defaultView,
    onViewChange,
    view: viewProp,
  })
  const source = useFileSystemSourceController({ items, resolveSource })
  const pathHistory = useFileSystemPathHistory({
    defaultPath,
    onPathChange,
    path,
  })
  const loadedItems = useFileSystemLoadedItems()
  const index = useFileSystemIndexState({
    currentPath: pathHistory.currentPath,
    items,
    loadedItems: loadedItems.loadedItems,
    query: query.query,
  })
  const loading = useFileSystemLoadingController({
    currentPath: pathHistory.currentPath,
    index,
    loadChildren,
    loadedItemsState: loadedItems,
    query: query.query,
  })
  const selection = useFileSystemSelectionController({
    currentPath: pathHistory.currentPath,
    defaultSelectedPath,
    ensureChildren: loading.ensureChildren,
    onSelectionChange,
    query: query.query,
    rawIndex: index.rawIndex,
    selectedPath,
    visibleIndex: index.index,
  })
  const navigation = useFileSystemNavigationController({
    loading,
    pathHistory,
    query,
    selection,
  })

  React.useEffect(() => {
    void loading.ensureChildren(pathHistory.currentPath)
  }, [loading.ensureChildren, pathHistory.currentPath])

  return {
    query,
    view,
    source,
    index,
    loading,
    pathHistory,
    loadedItems,
    selection,
    navigation,
  }
}
