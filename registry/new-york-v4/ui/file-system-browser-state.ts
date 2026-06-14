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
  currentPath: string
  entries: FileSystemEntry[]
  index: FileSystemIndex
  loading: FileSystemBrowserLoadingState
  navigation: FileSystemBrowserNavigationState
  query: FileSystemQueryState
  rawIndex: FileSystemIndex
  selection: FileSystemBrowserSelectionState
  commands: FileSystemBrowserCommands
  view: FileSystemView
}

export type FileSystemBrowserSelectionState = {
  selectedEntry: FileSystemEntry | null
  selectedPath: string | null
}

export type FileSystemBrowserLoadingState = {
  folderErrors: ReadonlyMap<string, string>
  loadingFolders: ReadonlySet<string>
}

export type FileSystemBrowserNavigationState = {
  canGoBack: boolean
  canGoForward: boolean
}

export type FileSystemBrowserCommands = {
  ensureChildren: FileSystemLoadingController["ensureChildren"]
  goBack: () => void
  goForward: () => void
  navigateTo: (path: string) => void
  selectEntry: (entry: FileSystemEntry | null) => void
  selectFirstChildAfterEnsure: (path: string) => Promise<FileSystemEntry | null>
  setSearch: (search: string) => void
  setSortKey: (key: FileSystemSortKey) => void
  setView: (view: FileSystemView) => void
}

export type FileSystemHeaderState = {
  canGoBack: boolean
  canGoForward: boolean
  currentPath: string
  goBack: () => void
  goForward: () => void
  query: FileSystemQueryState
  setSearch: (search: string) => void
  setSortKey: (key: FileSystemSortKey) => void
  setView: (view: FileSystemView) => void
  title: string
  view: FileSystemView
}

export type FileSystemPreviewState = {
  entry: FileSystemEntry | null
  resolveSource: FileSystemSourceController["resolveFileSource"]
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
    currentPath: navigation.currentPath,
    entries: index.currentEntries,
    index: index.index,
    loading: {
      folderErrors: loading.folderErrors,
      loadingFolders: loading.loadingFolders,
    },
    navigation: {
      canGoBack: navigation.canGoBack,
      canGoForward: navigation.canGoForward,
    },
    query: query.query,
    rawIndex: index.rawIndex,
    selection: {
      selectedEntry: selection.selectedEntry,
      selectedPath: selection.selectedPath,
    },
    commands: {
      ensureChildren: loading.ensureChildren,
      goBack: navigation.goBack,
      goForward: navigation.goForward,
      navigateTo: navigation.navigateTo,
      selectEntry: selection.selectEntry,
      selectFirstChildAfterEnsure: selection.selectFirstChildAfterEnsure,
      setSearch: query.setSearch,
      setSortKey: query.setSortKey,
      setView: view.setView,
    },
    view: view.view,
  }
}

export function createFileSystemHeaderState({
  browser,
  title,
}: {
  browser: FileSystemBrowserState
  title: string
}): FileSystemHeaderState {
  return {
    canGoBack: browser.navigation.canGoBack,
    canGoForward: browser.navigation.canGoForward,
    currentPath: browser.currentPath,
    goBack: browser.commands.goBack,
    goForward: browser.commands.goForward,
    query: browser.query,
    setSearch: browser.commands.setSearch,
    setSortKey: browser.commands.setSortKey,
    setView: browser.commands.setView,
    title,
    view: browser.view,
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
    entry: selection.selectedEntry,
    resolveSource: source.resolveFileSource,
  }
}
