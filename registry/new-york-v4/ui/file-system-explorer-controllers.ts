"use client"

import type { FileSystemIndexState } from "./file-system-index-state"
import type { FileSystemLoadingController } from "./file-system-loading-controller"
import type { FileSystemNavigationController } from "./file-system-navigation-controller"
import type { FileSystemQueryController } from "./file-system-query-controller"
import type { FileSystemSelectionController } from "./file-system-selection-controller"
import type { FileSystemSourceController } from "./file-system-source-controller"
import type {
  FileSystemEntry,
  FileSystemFileEntry,
  FileSystemIndex,
  FileSystemQueryState,
  FileSystemView,
} from "./file-system-types"
import type { FileSystemViewController } from "./file-system-view-controller"

export type FileSystemBrowserOpenController = {
  openPreview: (file: FileSystemFileEntry) => void
}

export type FileSystemBrowserSelectionController = {
  selectEntry: (entry: FileSystemEntry | null) => void
  selectedEntry: FileSystemEntry | null
  selectedPath: string | null
}

export type FileSystemListViewController = {
  currentPath: string
  ensureChildren: FileSystemLoadingController["ensureChildren"]
  folderErrors: ReadonlyMap<string, string>
  index: FileSystemIndex
  loadingFolders: ReadonlySet<string>
  navigateTo: FileSystemNavigationController["navigateTo"]
  openPreview: FileSystemBrowserOpenController["openPreview"]
  search: string
  selectEntry: FileSystemSelectionController["selectEntry"]
  selectedPath: string | null
}

export type FileSystemGridViewController = {
  currentEntries: FileSystemEntry[]
  loadingFolders: ReadonlySet<string>
  navigateTo: FileSystemNavigationController["navigateTo"]
  openPreview: FileSystemBrowserOpenController["openPreview"]
  resolveFileSource: FileSystemSourceController["resolveFileSource"]
  selectEntry: FileSystemSelectionController["selectEntry"]
  selectedEntry: FileSystemEntry | null
  selectedPath: string | null
}

export type FileSystemColumnsViewController = {
  currentPath: string
  ensureChildren: FileSystemLoadingController["ensureChildren"]
  index: FileSystemIndex
  navigateTo: FileSystemNavigationController["navigateTo"]
  openPreview: FileSystemBrowserOpenController["openPreview"]
  rawIndex: FileSystemIndex
  resolveFileSource: FileSystemSourceController["resolveFileSource"]
  selectEntry: FileSystemSelectionController["selectEntry"]
  selectFirstChildAfterEnsure: FileSystemSelectionController["selectFirstChildAfterEnsure"]
  selectedEntry: FileSystemEntry | null
  selectedPath: string | null
}

export type FileSystemStatusState = {
  currentEntries: FileSystemEntry[]
  query: FileSystemQueryState
  selectedEntry: FileSystemEntry | null
}

export type FileSystemExplorerPart = {
  columns: FileSystemColumnsViewController
  grid: FileSystemGridViewController
  list: FileSystemListViewController
  status: FileSystemStatusState
  view: FileSystemView
}

export function createFileSystemExplorerPart({
  index,
  loading,
  navigation,
  openPreview,
  query,
  selection,
  source,
  view,
}: {
  index: FileSystemIndexState
  loading: FileSystemLoadingController
  navigation: FileSystemNavigationController
  openPreview: FileSystemBrowserOpenController
  query: FileSystemQueryController
  selection: FileSystemSelectionController
  source: FileSystemSourceController
  view: FileSystemViewController
}): FileSystemExplorerPart {
  return {
    columns: {
      currentPath: navigation.currentPath,
      ensureChildren: loading.ensureChildren,
      index: index.index,
      navigateTo: navigation.navigateTo,
      openPreview: openPreview.openPreview,
      rawIndex: index.rawIndex,
      resolveFileSource: source.resolveFileSource,
      selectEntry: selection.selectEntry,
      selectFirstChildAfterEnsure: selection.selectFirstChildAfterEnsure,
      selectedEntry: selection.selectedEntry,
      selectedPath: selection.selectedPath,
    },
    grid: {
      currentEntries: index.currentEntries,
      loadingFolders: loading.loadingFolders,
      navigateTo: navigation.navigateTo,
      openPreview: openPreview.openPreview,
      resolveFileSource: source.resolveFileSource,
      selectEntry: selection.selectEntry,
      selectedEntry: selection.selectedEntry,
      selectedPath: selection.selectedPath,
    },
    list: {
      currentPath: navigation.currentPath,
      ensureChildren: loading.ensureChildren,
      folderErrors: loading.folderErrors,
      index: index.index,
      loadingFolders: loading.loadingFolders,
      navigateTo: navigation.navigateTo,
      openPreview: openPreview.openPreview,
      search: query.query.search,
      selectEntry: selection.selectEntry,
      selectedPath: selection.selectedPath,
    },
    status: {
      currentEntries: index.currentEntries,
      query: query.query,
      selectedEntry: selection.selectedEntry,
    },
    view: view.view,
  }
}
