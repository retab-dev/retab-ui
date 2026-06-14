"use client"

import * as React from "react"

import type { ViewerSource } from "@/lib/viewer-source"

import {
  useFileSystemStateSlices,
  type FileSystemDomainState,
} from "./file-system-controller"
import type { FileSystemFileEntry, FileSystemProps } from "./file-system-types"

export type FileSystemProviderProps = Omit<FileSystemProps, "className"> & {
  children: React.ReactNode
}

export type FileSystemOpenedPreview = {
  file: FileSystemFileEntry
  source: ViewerSource | null
}

export type FileSystemOpenPreviewController = {
  closePreview: () => void
  openedPreview: FileSystemOpenedPreview | null
  openPreview: (file: FileSystemFileEntry) => void
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

export type FileSystemContextValue = FileSystemDomainState &
  FileSystemCompositionState

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
  const [openedPreview, setOpenedPreview] =
    React.useState<FileSystemOpenedPreview | null>(null)
  const closePreview = React.useCallback(() => {
    setOpenedPreview(null)
  }, [])
  const openPreview = React.useCallback(
    (file: FileSystemFileEntry) => {
      const controller_ = new AbortController()

      void state.source
        .resolveFileSource(file, controller_.signal)
        .then((source) => {
          if (onFileOpen) {
            onFileOpen(file, source)
            return
          }
          setOpenedPreview({ file, source })
        })
        .catch(() => {
          if (onFileOpen) {
            onFileOpen(file, null)
          } else {
            setOpenedPreview({ file, source: null })
          }
        })
    },
    [onFileOpen, state.source]
  )
  const openPreviewController =
    React.useMemo<FileSystemOpenPreviewController>(
      () => ({
        closePreview,
        openedPreview,
        openPreview,
      }),
      [closePreview, openedPreview, openPreview]
    )
  const renderers = React.useMemo<FileSystemRenderers>(
    () => ({ renderFileActions, renderMetadata }),
    [renderFileActions, renderMetadata]
  )
  const value = React.useMemo<FileSystemContextValue>(
    () => ({
      query: state.query,
      view: state.view,
      source: state.source,
      index: state.index,
      loading: state.loading,
      selection: state.selection,
      navigation: state.navigation,
      openPreview: openPreviewController,
      renderers,
      title,
    }),
    [
      openPreviewController,
      renderers,
      state.index,
      state.loading,
      state.navigation,
      state.query,
      state.selection,
      state.source,
      state.view,
      title,
    ]
  )

  return (
    <FileSystemContext.Provider value={value}>
      {children}
    </FileSystemContext.Provider>
  )
}
