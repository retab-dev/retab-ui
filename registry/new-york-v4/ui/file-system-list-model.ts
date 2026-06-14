"use client"

import * as React from "react"

import type { FileSystemBrowserState } from "./file-system-browser-state"
import {
  createFileSystemPierreAdapterState,
  type FileSystemPierreAdapterSource,
} from "./file-system-pierre-adapter"
import { useFileSystemPierreDecorationVersion } from "./file-system-pierre-decoration-version"
import {
  buildFileSystemPierreInput,
  pierrePathToFileSystemEntry,
} from "./file-system-pierre-input"
import { useFileSystemPierreModel } from "./file-system-pierre-model"
import type { FileSystemFileEntry } from "./file-system-types"

export function useFileSystemListModel({
  browser,
  openPreview,
}: {
  browser: FileSystemBrowserState
  openPreview: (entry: FileSystemFileEntry) => void
}) {
  const source = createFileSystemPierreAdapterSource(browser)
  const pierre = createFileSystemPierreAdapterState(source)
  const decorationVersion = useFileSystemPierreDecorationVersion({
    folderErrors: pierre.decoration.folderErrors,
    loadingFolders: pierre.decoration.loadingFolders,
  })
  const input = React.useMemo(
    () =>
      buildFileSystemPierreInput({
        currentPath: browser.currentPath,
        index: browser.index,
      }),
    [browser.currentPath, browser.index]
  )
  const { model } = useFileSystemPierreModel({
    decoration: pierre.decoration,
    decorationVersion,
    input,
    loading: pierre.loading,
    navigation: pierre.navigation,
    query: pierre.query,
    selection: pierre.selection,
  })
  const openPierrePath = React.useCallback(
    (path: string | null) => {
      const entry = pierrePathToFileSystemEntry(path, input)

      if (!entry) {
        return
      }

      if (entry.kind === "folder") {
        if (browser.loading.folderErrors.has(entry.path)) {
          void browser.commands.ensureChildren(entry.path, { retry: true })
        }
        browser.commands.navigateTo(entry.path)
        return
      }

      openPreview(entry)
    },
    [browser.commands, browser.loading.folderErrors, input, openPreview]
  )
  const onDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      openPierrePath(pierrePathFromEvent(event))
    },
    [openPierrePath]
  )
  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter") {
        return
      }

      openPierrePath(
        model.getFocusedPath() ?? model.getSelectedPaths().at(-1) ?? null
      )
      event.preventDefault()
    },
    [model, openPierrePath]
  )

  return {
    hasRows: browser.entries.length > 0,
    model,
    onDoubleClick,
    onKeyDown,
  }
}

function createFileSystemPierreAdapterSource(
  browser: FileSystemBrowserState
): FileSystemPierreAdapterSource {
  return {
    currentPath: browser.currentPath,
    ensureChildren: browser.commands.ensureChildren,
    folderErrors: browser.loading.folderErrors,
    index: browser.index,
    loadingFolders: browser.loading.loadingFolders,
    navigateTo: browser.commands.navigateTo,
    search: browser.query.search,
    selectEntry: browser.commands.selectEntry,
    selectedPath: browser.selection.selectedPath,
  }
}

function pierrePathFromEvent(event: React.SyntheticEvent<HTMLElement>) {
  for (const target of event.nativeEvent.composedPath()) {
    if (
      target instanceof HTMLElement &&
      target.dataset.type === "item" &&
      target.dataset.itemPath
    ) {
      return target.dataset.itemPath
    }
  }

  return null
}
