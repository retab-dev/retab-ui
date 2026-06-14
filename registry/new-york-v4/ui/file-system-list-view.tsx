"use client"

import * as React from "react"
import { FileTree as PierreFileTree } from "@pierre/trees/react"

import type { FileSystemListViewController } from "./file-system-explorer-controllers"
import { useFileSystemPierreDecorationVersion } from "./file-system-pierre-decoration-version"
import {
  buildFileSystemPierreInput,
  pierrePathToFileSystemEntry,
} from "./file-system-pierre-input"
import { useFileSystemPierreModel } from "./file-system-pierre-model"

export function FileSystemListView({
  controller,
}: {
  controller: FileSystemListViewController
}) {
  const decorationVersion = useFileSystemPierreDecorationVersion({
    folderErrors: controller.decoration.folderErrors,
    loadingFolders: controller.decoration.loadingFolders,
  })
  const input = React.useMemo(
    () =>
      buildFileSystemPierreInput({
        currentPath: controller.navigation.currentPath,
        index: controller.index,
      }),
    [controller.index, controller.navigation.currentPath]
  )
  const { model } = useFileSystemPierreModel({
    decoration: controller.decoration,
    decorationVersion,
    input,
    loading: controller.loading,
    navigation: controller.navigation,
    query: controller.query,
    selection: controller.selection,
  })

  const openPierrePath = React.useCallback(
    (path: string | null) => {
      const entry = pierrePathToFileSystemEntry(path, input)

      if (!entry) {
        return
      }

      if (entry.kind === "folder") {
        if (controller.loading.folderErrors.has(entry.path)) {
          void controller.loading.ensureChildren(entry.path, { retry: true })
        }
        controller.navigation.navigateTo(entry.path)
        return
      }

      controller.openPreview(entry)
    },
    [controller, input]
  )

  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      openPierrePath(pierrePathFromEvent(event))
    },
    [openPierrePath]
  )

  const handleKeyDown = React.useCallback(
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

  if (!input.pierrePaths.length) {
    return <FileSystemEmptyRows label="This folder is empty" />
  }

  return (
    <PierreFileTree
      aria-label="Files"
      className="block size-full min-h-0"
      data-slot="file-system-pierre-tree"
      model={model}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    />
  )
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

export function FileSystemEmptyRows({ label }: { label: string }) {
  return (
    <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}
