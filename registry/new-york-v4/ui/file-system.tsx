"use client"

import { cn } from "@/lib/utils"

import {
  FileSystemOpenPreviewDialog,
  useFileSystemOpenPreviewDialog,
} from "./file-system-open-preview-dialog"
import {
  FileSystemExplorer,
  FileSystemHeader,
  FileSystemSelectedFile,
  useFileSystemExplorer,
  useFileSystemHeader,
  useFileSystemSelectedFile,
} from "./file-system-parts"
import { FileSystemProvider, useFileSystem } from "./file-system-provider"
import type { FileSystemProps } from "./file-system-types"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "./viewer"

export {
  FileSystemOpenPreviewDialog,
  FileSystemProvider,
  FileSystemExplorer,
  FileSystemHeader,
  FileSystemSelectedFile,
  useFileSystem,
  useFileSystemExplorer,
  useFileSystemHeader,
  useFileSystemOpenPreviewDialog,
  useFileSystemSelectedFile,
}

export type {
  FileSystemFileItem,
  FileSystemFolderItem,
  FileSystemItem,
  FileSystemLoadChildrenArgs,
  FileSystemLoadChildrenResult,
  FileSystemProps,
  FileSystemQueryState,
  FileSystemResolveSourceArgs,
  FileSystemView,
} from "./file-system-types"
export type { FileSystemProviderProps } from "./file-system-provider"
export type {
  FileSystemExplorerState,
  FileSystemHeaderState,
  FileSystemSelectedFileState,
} from "./file-system-parts"

export function FileSystem({ className, ...providerProps }: FileSystemProps) {
  return (
    <FileSystemProvider {...providerProps}>
      <div data-slot="file-system">
        <ViewerRoot
          data-viewer="file-system"
          bare
          defaultSidebarOpen
          className={cn(
            "h-[640px] rounded-md border bg-background text-foreground",
            className
          )}
        >
          <ViewerHeader className="flex flex-col">
            <FileSystemHeader />
          </ViewerHeader>
          <ViewerBody>
            <ViewerSidebar
              aria-label="Files"
              width="min(22rem, 85vw)"
              className="flex min-w-0 flex-col border-r"
            >
              <FileSystemExplorer />
            </ViewerSidebar>
            <ViewerSurface className="bg-background">
              <FileSystemSelectedFile />
            </ViewerSurface>
          </ViewerBody>
          <FileSystemOpenPreviewDialog />
        </ViewerRoot>
      </div>
    </FileSystemProvider>
  )
}
