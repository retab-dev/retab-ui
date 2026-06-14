"use client"

import type { FileSystemSourceResolver } from "./file-system-selection-source-task"
import type {
  FileSystemEntry,
  FileSystemIndex,
  FileSystemQueryState,
  FileSystemSortKey,
  FileSystemView,
} from "./file-system-types"

export type FileSystemBrowserState = {
  canGoBack: boolean
  canGoForward: boolean
  currentPath: string
  entries: FileSystemEntry[]
  ensureChildren: (
    path: string,
    options?: { retry?: boolean }
  ) => Promise<FileSystemEntry[]>
  folderErrors: ReadonlyMap<string, string>
  goBack: () => void
  goForward: () => void
  index: FileSystemIndex
  loadingFolders: ReadonlySet<string>
  navigateTo: (path: string) => void
  query: FileSystemQueryState
  rawIndex: FileSystemIndex
  selectEntry: (entry: FileSystemEntry | null) => void
  selectedEntry: FileSystemEntry | null
  selectedPath: string | null
  selectFirstChildAfterEnsure: (path: string) => Promise<FileSystemEntry | null>
  setSearch: (search: string) => void
  setSortKey: (key: FileSystemSortKey) => void
  setView: (view: FileSystemView) => void
  view: FileSystemView
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

export type FileSystemSelectionState = {
  entry: FileSystemEntry | null
  resolveSource: FileSystemSourceResolver
}

export function createFileSystemHeaderState({
  browser,
  title,
}: {
  browser: FileSystemBrowserState
  title: string
}): FileSystemHeaderState {
  return {
    canGoBack: browser.canGoBack,
    canGoForward: browser.canGoForward,
    currentPath: browser.currentPath,
    goBack: browser.goBack,
    goForward: browser.goForward,
    query: browser.query,
    setSearch: browser.setSearch,
    setSortKey: browser.setSortKey,
    setView: browser.setView,
    title,
    view: browser.view,
  }
}
