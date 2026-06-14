"use client"

import * as React from "react"

import {
  createFileSystemBrowserState,
  createFileSystemPreviewState,
} from "./file-system-browser-state"
import { useFileSystemStateSlices } from "./file-system-controller"
import {
  useFileSystemOpenPreviewController,
  type FileSystemOpenPreviewController,
} from "./file-system-open-preview-state"
import type { FileSystemProps } from "./file-system-types"

export type FileSystemProviderProps = Omit<FileSystemProps, "className"> & {
  children: React.ReactNode
}

export type FileSystemRenderers = {
  renderFileActions?: FileSystemProps["renderFileActions"]
  renderMetadata?: FileSystemProps["renderMetadata"]
}

export type FileSystemCompositionState = {
  openPreview: FileSystemOpenPreviewController
  renderers: FileSystemRenderers
  title: string
}

export type FileSystemContextValue = {
  browser: ReturnType<typeof createFileSystemBrowserState>
  preview: ReturnType<typeof createFileSystemPreviewState>
} & FileSystemCompositionState

const FileSystemContext = React.createContext<FileSystemContextValue | null>(
  null
)

export function useFileSystem() {
  const context = React.useContext(FileSystemContext)
  if (!context) {
    throw new Error("useFileSystem must be used within FileSystemProvider.")
  }
  return context
}

export function FileSystemProvider({
  items,
  children,
  defaultPath,
  defaultQuery,
  defaultSelectedPath,
  defaultView = "list",
  loadChildren,
  onPathChange,
  onQueryChange,
  onFileOpen,
  onSelectionChange,
  onViewChange,
  path,
  query,
  renderFileActions,
  renderMetadata,
  resolveSource,
  selectedPath,
  title = "Files",
  view,
}: FileSystemProviderProps) {
  const state = useFileSystemStateSlices({
    defaultPath,
    defaultQuery,
    defaultSelectedPath,
    defaultView,
    items,
    loadChildren,
    onPathChange,
    onQueryChange,
    onSelectionChange,
    onViewChange,
    path,
    query,
    resolveSource,
    selectedPath,
    view,
  })
  const browser = React.useMemo(
    () => createFileSystemBrowserState(state),
    [
      state.index,
      state.loading,
      state.navigation,
      state.query,
      state.selection,
      state.view,
    ]
  )
  const preview = React.useMemo(
    () => createFileSystemPreviewState(state),
    [state.selection, state.source]
  )
  const openPreview = useFileSystemOpenPreviewController({
    onFileOpen,
    resolveFileSource: state.source.resolveFileSource,
  })
  const renderers = React.useMemo<FileSystemRenderers>(
    () => ({ renderFileActions, renderMetadata }),
    [renderFileActions, renderMetadata]
  )
  const value = React.useMemo<FileSystemContextValue>(
    () => ({
      browser,
      preview,
      openPreview,
      renderers,
      title,
    }),
    [browser, openPreview, preview, renderers, title]
  )

  return (
    <FileSystemContext.Provider value={value}>
      {children}
    </FileSystemContext.Provider>
  )
}
