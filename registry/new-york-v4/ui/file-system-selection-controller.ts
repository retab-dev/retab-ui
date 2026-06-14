"use client"

import * as React from "react"

import { normalizeFolderPath } from "./file-system-index"
import { fileMatchesQuery } from "./file-system-query"
import type {
  FileSystemEntry,
  FileSystemIndex,
  FileSystemProps,
  FileSystemQueryState,
} from "./file-system-types"

export type FileSystemSelectionController = {
  invalidateChildSelectionRequest: () => void
  selectEntry: (entry: FileSystemEntry | null) => void
  selectFirstChildAfterEnsure: (path: string) => Promise<FileSystemEntry | null>
  selectedEntry: FileSystemEntry | null
  selectedPath: string | null
}

export function useFileSystemSelectionController({
  currentPath,
  defaultSelectedPath = null,
  ensureChildren,
  onSelectionChange,
  query,
  rawIndex,
  selectedPath: selectedPathProp,
  visibleIndex,
}: Pick<
  FileSystemProps,
  "defaultSelectedPath" | "onSelectionChange" | "selectedPath"
> & {
  currentPath: string
  ensureChildren: (path: string) => Promise<FileSystemEntry[]>
  query: FileSystemQueryState
  rawIndex: FileSystemIndex
  visibleIndex: FileSystemIndex
}): FileSystemSelectionController {
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

      if (path === selectionStateRef.current.selectedPath) return

      invalidateChildSelectionRequest()
      if (!isSelectionControlled) setInternalSelectedPath(path)
      onSelectionChange?.(entry)
    },
    [invalidateChildSelectionRequest, isSelectionControlled, onSelectionChange]
  )

  React.useEffect(() => {
    if (!selectedEntry || !query.search) {
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

  const selectFirstChildAfterEnsure = React.useCallback(
    async (path: string) => {
      const folderPath = normalizeFolderPath(path)
      const requestedCurrentPath = selectionStateRef.current.currentPath
      const requestId = childSelectionRequestRef.current + 1

      childSelectionRequestRef.current = requestId
      const children = await ensureChildren(folderPath)
      const entry = children[0] ?? null
      const state = selectionStateRef.current

      if (childSelectionRequestRef.current !== requestId) return null
      if (state.selectedPath !== folderPath) return null
      if (state.currentPath !== requestedCurrentPath) return null
      if (entry) selectEntry(entry)
      return entry
    },
    [ensureChildren, selectEntry]
  )

  return {
    invalidateChildSelectionRequest,
    selectEntry,
    selectFirstChildAfterEnsure,
    selectedEntry,
    selectedPath,
  }
}
