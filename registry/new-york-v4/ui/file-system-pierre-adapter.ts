"use client"

import type { FileSystemEntry, FileSystemIndex } from "./file-system-types"

export type FileSystemPierreAdapterSource = {
  currentPath: string
  ensureChildren: (
    path: string,
    options?: { retry?: boolean }
  ) => Promise<FileSystemEntry[]>
  folderErrors: ReadonlyMap<string, string>
  index: FileSystemIndex
  loadingFolders: ReadonlySet<string>
  navigateTo: (path: string) => void
  search: string
  selectEntry: (entry: FileSystemEntry | null) => void
  selectedPath: string | null
}

export type FileSystemPierreLoadingController = {
  ensureChildren: FileSystemPierreAdapterSource["ensureChildren"]
  folderErrors: ReadonlyMap<string, string>
  loadingFolders: ReadonlySet<string>
}

export type FileSystemPierreNavigationController = {
  currentPath: string
  navigateTo: FileSystemPierreAdapterSource["navigateTo"]
}

export type FileSystemPierreSelectionController = {
  selectEntry: FileSystemPierreAdapterSource["selectEntry"]
  selectedPath: string | null
}

export type FileSystemPierreQueryState = {
  search: string
}

export type FileSystemPierreDecorationState = {
  folderErrors: ReadonlyMap<string, string>
  index: FileSystemIndex
  loadingFolders: ReadonlySet<string>
}

export type FileSystemPierreAdapterState = {
  decoration: FileSystemPierreDecorationState
  loading: FileSystemPierreLoadingController
  navigation: FileSystemPierreNavigationController
  query: FileSystemPierreQueryState
  selection: FileSystemPierreSelectionController
}

export function createFileSystemPierreAdapterState(
  source: FileSystemPierreAdapterSource
): FileSystemPierreAdapterState {
  return {
    decoration: {
      folderErrors: source.folderErrors,
      index: source.index,
      loadingFolders: source.loadingFolders,
    },
    loading: {
      ensureChildren: source.ensureChildren,
      folderErrors: source.folderErrors,
      loadingFolders: source.loadingFolders,
    },
    navigation: {
      currentPath: source.currentPath,
      navigateTo: source.navigateTo,
    },
    query: {
      search: source.search,
    },
    selection: {
      selectEntry: source.selectEntry,
      selectedPath: source.selectedPath,
    },
  }
}
