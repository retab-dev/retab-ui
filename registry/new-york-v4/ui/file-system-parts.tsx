"use client"

import * as React from "react"

import { FileSystemColumnsView } from "./file-system-columns-view"
import {
  createFileSystemHeaderController,
  createFileSystemPreviewController,
  type FileSystemHeaderController,
  type FileSystemPreviewController,
} from "./file-system-controller"
import {
  FileSystemCommandBar,
  FileSystemStatusBar,
  FileSystemToolbar,
} from "./file-system-controls"
import {
  createFileSystemExplorerPart,
  type FileSystemExplorerPart,
} from "./file-system-explorer-controllers"
import { FileSystemGridView } from "./file-system-grid-view"
import { FileSystemListView } from "./file-system-list-view"
import { FileSystemPreview } from "./file-system-preview"
import { useFileSystem } from "./file-system-provider"
import type { FileSystemProps } from "./file-system-types"

export type FileSystemHeaderState = FileSystemHeaderController & {
  title: string
}

export type FileSystemExplorerState = FileSystemExplorerPart

export type FileSystemSelectedFileState = FileSystemPreviewController & {
  renderFileActions?: FileSystemProps["renderFileActions"]
  renderMetadata?: FileSystemProps["renderMetadata"]
}

export function useFileSystemHeader(): FileSystemHeaderState {
  const state = useFileSystem()
  return {
    ...createFileSystemHeaderController(state),
    title: state.title,
  }
}

export function useFileSystemExplorer(): FileSystemExplorerState {
  const state = useFileSystem()

  return createFileSystemExplorerPart(state)
}

export function useFileSystemSelectedFile(): FileSystemSelectedFileState {
  const state = useFileSystem()

  return {
    ...createFileSystemPreviewController(state),
    renderFileActions: state.renderers.renderFileActions,
    renderMetadata: state.renderers.renderMetadata,
  }
}

export function FileSystemHeader() {
  const header = useFileSystemHeader()
  const { title, ...commandController } = header

  return (
    <>
      <FileSystemToolbar {...header} />
      <FileSystemCommandBar controller={commandController} />
    </>
  )
}

export function FileSystemExplorer() {
  const explorer = useFileSystemExplorer()

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        {explorer.view === "list" ? (
          <FileSystemListView controller={explorer.list} />
        ) : explorer.view === "grid" ? (
          <FileSystemGridView controller={explorer.grid} />
        ) : (
          <FileSystemColumnsView controller={explorer.columns} />
        )}
      </div>
      <FileSystemStatusBar state={explorer.status} />
    </div>
  )
}

export function FileSystemSelectedFile() {
  const {
    renderFileActions,
    renderMetadata,
    resolveFileSource,
    selectedEntry,
  } = useFileSystemSelectedFile()

  return (
    <FileSystemPreview
      entry={selectedEntry}
      renderFileActions={renderFileActions}
      renderMetadata={renderMetadata}
      resolveFileSource={resolveFileSource}
      className="size-full border-l-0"
    />
  )
}
