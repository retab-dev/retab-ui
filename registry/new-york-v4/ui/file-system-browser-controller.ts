"use client"

import type { FileSystemBrowserState } from "./file-system-browser-state"
import type { FileSystemSourceController } from "./file-system-source-controller"
import type { FileSystemFileEntry } from "./file-system-types"

export type FileSystemOpenPreviewCommand = (file: FileSystemFileEntry) => void

export type FileSystemFileActionController = {
  openPreview: FileSystemOpenPreviewCommand
  resolveFileSource: FileSystemSourceController["resolveFileSource"]
}

export type FileSystemBrowserController = {
  browser: FileSystemBrowserState
  fileActions: FileSystemFileActionController
}

export function createFileSystemBrowserController({
  browser,
  openPreview,
  resolveFileSource,
}: {
  browser: FileSystemBrowserState
  openPreview: FileSystemOpenPreviewCommand
  resolveFileSource: FileSystemSourceController["resolveFileSource"]
}): FileSystemBrowserController {
  return {
    browser,
    fileActions: {
      openPreview,
      resolveFileSource,
    },
  }
}
