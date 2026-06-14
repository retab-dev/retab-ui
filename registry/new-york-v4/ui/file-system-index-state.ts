"use client"

import * as React from "react"

import { buildFileSystemIndex } from "./file-system-index"
import { deriveVisibleIndex } from "./file-system-query"
import type {
  FileSystemEntry,
  FileSystemFolderEntry,
  FileSystemIndex,
  FileSystemItem,
  FileSystemQueryState,
} from "./file-system-types"

export type FileSystemIndexState = {
  allItems: readonly FileSystemItem[]
  currentEntries: FileSystemEntry[]
  currentFolder: FileSystemFolderEntry | null
  index: FileSystemIndex
  rawIndex: FileSystemIndex
}

export function useFileSystemIndexState({
  currentPath,
  items,
  loadedItems,
  query,
}: {
  currentPath: string
  items: readonly FileSystemItem[]
  loadedItems: readonly FileSystemItem[]
  query: FileSystemQueryState
}): FileSystemIndexState {
  const allItems = React.useMemo(
    () => (loadedItems.length ? [...items, ...loadedItems] : items),
    [items, loadedItems]
  )
  const rawIndex = React.useMemo(
    () => buildFileSystemIndex(allItems),
    [allItems]
  )
  const index = React.useMemo(
    () => deriveVisibleIndex(rawIndex, currentPath, query),
    [currentPath, query, rawIndex]
  )
  const currentEntries = index.children.get(currentPath) ?? []
  const currentFolder =
    currentPath === "" ? null : (rawIndex.folders.get(currentPath) ?? null)

  return { allItems, currentEntries, currentFolder, index, rawIndex }
}
