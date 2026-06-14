"use client"

import type { FileSystemIndexState } from "./file-system-index-state"
import type { FileSystemLoadingController } from "./file-system-loading-controller"
import type { FileSystemNavigationController } from "./file-system-navigation-controller"
import type { FileSystemQueryController } from "./file-system-query-controller"
import type { FileSystemSelectionController } from "./file-system-selection-controller"
import type { FileSystemSourceController } from "./file-system-source-controller"
import type {
  FileSystemEntry,
  FileSystemIndex,
  FileSystemQueryState,
  FileSystemSortKey,
  FileSystemView,
} from "./file-system-types"
import type { FileSystemViewController } from "./file-system-view-controller"

export type FileSystemBrowserState = {
  canGoBack: boolean
  canGoForward: boolean
  currentPath: string
  entries: FileSystemEntry[]
  ensureChildren: FileSystemLoadingController["ensureChildren"]
  folderErrors: ReadonlyMap<string, string>
  goBack: () => void
  goForward: () => void
  index: FileSystemIndex
  loadingFolders: ReadonlySet<string>
  navigateTo: (path: string) => void
  query: FileSystemQueryState
  rawIndex: FileSystemIndex
  selectEntry: (entry: FileSystemEntry | null) => void
  selectFirstChildAfterEnsure: (
    path: string
  ) => Promise<FileSystemEntry | null>
  selectedEntry: FileSystemEntry | null
  selectedPath: string | null
  setSearch: (search: string) => void
  setSortKey: (key: FileSystemSortKey) => void
  setView: (view: FileSystemView) => void
  view: FileSystemView
}

export type FileSystemPreviewState = {
  resolveFileSource: FileSystemSourceController["resolveFileSource"]
  selectedEntry: FileSystemEntry | null
}

export function createFileSystemBrowserState({
  index,
  loading,
  navigation,
  query,
  selection,
  view,
}: {
  index: FileSystemIndexState
  loading: FileSystemLoadingController
  navigation: FileSystemNavigationController
  query: FileSystemQueryController
  selection: FileSystemSelectionController
  view: FileSystemViewController
}): FileSystemBrowserState {
  return {
    canGoBack: navigation.canGoBack,
    canGoForward: navigation.canGoForward,
    currentPath: navigation.currentPath,
    entries: index.currentEntries,
    ensureChildren: loading.ensureChildren,
    folderErrors: loading.folderErrors,
    goBack: navigation.goBack,
    goForward: navigation.goForward,
    index: index.index,
    loadingFolders: loading.loadingFolders,
    navigateTo: navigation.navigateTo,
    query: query.query,
    rawIndex: index.rawIndex,
    selectEntry: selection.selectEntry,
    selectFirstChildAfterEnsure: selection.selectFirstChildAfterEnsure,
    selectedEntry: selection.selectedEntry,
    selectedPath: selection.selectedPath,
    setSearch: query.setSearch,
    setSortKey: query.setSortKey,
    setView: view.setView,
    view: view.view,
  }
}

export function createFileSystemPreviewState({
  selection,
  source,
}: {
  selection: FileSystemSelectionController
  source: FileSystemSourceController
}): FileSystemPreviewState {
  return {
    resolveFileSource: source.resolveFileSource,
    selectedEntry: selection.selectedEntry,
  }
}
