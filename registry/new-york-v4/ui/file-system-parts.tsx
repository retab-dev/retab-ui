"use client"

import * as React from "react"

import type {
  FileSystemHeaderState,
  FileSystemPreviewState as FileSystemPreviewDomainState,
} from "./file-system-browser-state"
import { createFileSystemHeaderState } from "./file-system-browser-state"
import {
  createFileSystemBrowserController,
  type FileSystemBrowserController,
} from "./file-system-browser-controller"
import { FileSystemColumnsView } from "./file-system-columns-view"
import {
  FileSystemCommandBar,
  FileSystemStatusBar,
  FileSystemToolbar,
} from "./file-system-controls"
import { FileSystemGridView } from "./file-system-grid-view"
import { FileSystemListView } from "./file-system-list-view"
import { FileSystemPreviewPanel } from "./file-system-preview"
import { useFileSystem } from "./file-system-provider"
import type { FileSystemProps } from "./file-system-types"

export type FileSystemBrowserPartState = FileSystemBrowserController

export type { FileSystemHeaderState } from "./file-system-browser-state"

export type FileSystemPreviewState = FileSystemPreviewDomainState & {
  renderFileActions?: FileSystemProps["renderFileActions"]
  renderMetadata?: FileSystemProps["renderMetadata"]
}

export function useFileSystemHeader(): FileSystemHeaderState {
  const state = useFileSystem()

  return createFileSystemHeaderState({
    browser: state.browser,
    title: state.title,
  })
}

export function useFileSystemBrowser(): FileSystemBrowserPartState {
  const state = useFileSystem()

  return createFileSystemBrowserController({
    browser: state.browser,
    openPreview: state.openPreview.open,
    resolveFileSource: state.preview.resolveSource,
  })
}

export function useFileSystemPreview(): FileSystemPreviewState {
  const state = useFileSystem()

  return {
    ...state.preview,
    renderFileActions: state.renderers.renderFileActions,
    renderMetadata: state.renderers.renderMetadata,
  }
}

export function FileSystemHeader() {
  const header = useFileSystemHeader()

  return (
    <>
      <FileSystemToolbar {...header} />
      <FileSystemCommandBar controller={header} />
    </>
  )
}

export function FileSystemBrowser() {
  const controller = useFileSystemBrowser()
  const { view } = controller.browser

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        {view === "list" ? (
          <FileSystemListView controller={controller} />
        ) : view === "grid" ? (
          <FileSystemGridView controller={controller} />
        ) : (
          <FileSystemColumnsView controller={controller} />
        )}
      </div>
      <FileSystemStatusBar browser={controller.browser} />
    </div>
  )
}

export function FileSystemPreview() {
  const {
    entry,
    renderFileActions,
    renderMetadata,
    resolveSource,
  } = useFileSystemPreview()

  return (
    <FileSystemPreviewPanel
      entry={entry}
      renderFileActions={renderFileActions}
      renderMetadata={renderMetadata}
      resolveFileSource={resolveSource}
      className="size-full border-l-0"
    />
  )
}
