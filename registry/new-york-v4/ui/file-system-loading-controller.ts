"use client"

import * as React from "react"

import type { FileSystemIndexState } from "./file-system-index-state"
import type {
  FileSystemEntry,
  FileSystemItem,
  FileSystemProps,
  FileSystemQueryState,
} from "./file-system-types"
import { useFileSystemChildrenLoader } from "./use-file-system-children-loader"

export type FileSystemLoadedItemsState = {
  loadedItems: FileSystemItem[]
  setLoadedItems: React.Dispatch<React.SetStateAction<FileSystemItem[]>>
}

export type FileSystemLoadingController = {
  ensureChildren: (
    path: string,
    options?: { retry?: boolean }
  ) => Promise<FileSystemEntry[]>
  folderErrors: Map<string, string>
  loadedItems: FileSystemItem[]
  loadingFolders: Set<string>
}

export function useFileSystemLoadedItems(): FileSystemLoadedItemsState {
  const [loadedItems, setLoadedItems] = React.useState<FileSystemItem[]>([])

  return { loadedItems, setLoadedItems }
}

export function useFileSystemLoadingController({
  currentPath,
  index,
  loadChildren,
  loadedItemsState,
  query,
}: {
  currentPath: string
  index: FileSystemIndexState
  loadChildren: FileSystemProps["loadChildren"]
  loadedItemsState: FileSystemLoadedItemsState
  query: FileSystemQueryState
}): FileSystemLoadingController {
  const { ensureChildren, folderErrors, loadingFolders } =
    useFileSystemChildrenLoader({
      allItems: index.allItems,
      currentPath,
      loadChildren,
      query,
      rawIndex: index.rawIndex,
      setLoadedItems: loadedItemsState.setLoadedItems,
      visibleIndex: index.index,
    })

  return {
    ensureChildren,
    folderErrors,
    loadedItems: loadedItemsState.loadedItems,
    loadingFolders,
  }
}
