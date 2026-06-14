"use client"

import * as React from "react"

import { normalizeFolderPath } from "./file-system-index"
import type { FileSystemLoadingController } from "./file-system-loading-controller"
import type { FileSystemPathHistoryController } from "./file-system-path-history"
import type { FileSystemQueryController } from "./file-system-query-controller"
import type { FileSystemSelectionController } from "./file-system-selection-controller"
import type { FileSystemEntry } from "./file-system-types"

export type FileSystemNavigationController = {
  canGoBack: boolean
  canGoForward: boolean
  currentPath: string
  goBack: () => void
  goForward: () => void
  navigateTo: (path: string) => void
  openEntry: (entry: FileSystemEntry) => void
}

export function useFileSystemNavigationController({
  loading,
  pathHistory,
  query,
  selection,
}: {
  loading: Pick<FileSystemLoadingController, "ensureChildren">
  pathHistory: FileSystemPathHistoryController
  query: Pick<FileSystemQueryController, "setSearch">
  selection: Pick<
    FileSystemSelectionController,
    "invalidateChildSelectionRequest" | "selectEntry"
  >
}): FileSystemNavigationController {
  const navigateTo = React.useCallback(
    (path: string) => {
      const folderPath = normalizeFolderPath(path)

      if (folderPath !== pathHistory.currentPath) {
        selection.invalidateChildSelectionRequest()
      }
      pathHistory.setCurrentPath(folderPath)
      query.setSearch("")
      selection.selectEntry(null)
      void loading.ensureChildren(folderPath)
    },
    [loading, pathHistory, query, selection]
  )

  const goBack = React.useCallback(() => {
    const nextPath = pathHistory.goBackPath()

    if (nextPath !== pathHistory.currentPath) {
      selection.invalidateChildSelectionRequest()
    }
    selection.selectEntry(null)
    query.setSearch("")
  }, [pathHistory, query, selection])

  const goForward = React.useCallback(() => {
    const nextPath = pathHistory.goForwardPath()

    if (nextPath !== pathHistory.currentPath) {
      selection.invalidateChildSelectionRequest()
    }
    selection.selectEntry(null)
    query.setSearch("")
  }, [pathHistory, query, selection])

  const openEntry = React.useCallback(
    (entry: FileSystemEntry) => {
      if (entry.kind === "folder") {
        navigateTo(entry.path)
      }
    },
    [navigateTo]
  )

  return {
    canGoBack: pathHistory.canGoBack,
    canGoForward: pathHistory.canGoForward,
    currentPath: pathHistory.currentPath,
    goBack,
    goForward,
    navigateTo,
    openEntry,
  }
}
