"use client"

import * as React from "react"
import { FileTree as PierreFileTree } from "@pierre/trees/react"

import type { FileSystemController } from "./file-system-controller"
import {
  buildFileSystemPierreInput,
  fromPierrePath,
} from "./file-system-pierre-input"
import { useFileSystemPierreModel } from "./file-system-pierre-model"
import type { FileSystemFileEntry } from "./file-system-types"

export function FileSystemListView({
  controller,
  onOpenFile,
}: {
  controller: FileSystemController
  onOpenFile: (file: FileSystemFileEntry) => void
}) {
  const decorationRevision = React.useMemo(
    () =>
      [
        [...controller.loadingFolders].sort().join("|"),
        [...controller.folderErrors]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([path, error]) => `${path}:${error}`)
          .join("|"),
      ].join("::"),
    [controller.folderErrors, controller.loadingFolders]
  )
  const input = React.useMemo(
    () =>
      buildFileSystemPierreInput({
        currentPath: controller.currentPath,
        index: controller.index,
        revision: decorationRevision,
      }),
    [controller.currentPath, controller.index, decorationRevision]
  )
  const { model } = useFileSystemPierreModel({ controller, input })

  const openPierrePath = React.useCallback(
    (path: string | null) => {
      const entry = fromPierrePath(path, input)

      if (!entry) {
        return
      }

      if (entry.kind === "folder") {
        if (controller.folderErrors.has(entry.path)) {
          void controller.ensureChildren(entry.path, { retry: true })
        }
        controller.navigateTo(entry.path)
        return
      }

      onOpenFile(entry)
    },
    [controller, input, onOpenFile]
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

  if (!input.paths.length) {
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
