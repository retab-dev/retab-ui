"use client"

import { FileTree as PierreFileTree } from "@pierre/trees/react"

import type { FileSystemBrowserController } from "./file-system-browser-controller"
import { useFileSystemListModel } from "./file-system-list-model"

export function FileSystemListView({
  controller,
}: {
  controller: FileSystemBrowserController
}) {
  const list = useFileSystemListModel({
    browser: controller.browser,
    openPreview: controller.fileActions.openPreview,
  })

  if (!list.hasRows) {
    return <FileSystemEmptyRows label="This folder is empty" />
  }

  return (
    <PierreFileTree
      aria-label="Files"
      className="block size-full min-h-0"
      data-slot="file-system-pierre-tree"
      model={list.model}
      onDoubleClick={list.onDoubleClick}
      onKeyDown={list.onKeyDown}
    />
  )
}

export function FileSystemEmptyRows({ label }: { label: string }) {
  return (
    <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}
