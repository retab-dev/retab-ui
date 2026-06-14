"use client"

import { cn } from "@/lib/utils"

import {
  FileSystemOpenPreview,
  useFileSystemOpenPreview,
} from "./file-system-open-preview-dialog"
import {
  FileSystemBrowser,
  FileSystemHeader,
  FileSystemPreview,
  useFileSystemBrowser,
  useFileSystemHeader,
  useFileSystemPreview,
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
  FileSystemOpenPreview,
  FileSystemProvider,
  FileSystemBrowser,
  FileSystemHeader,
  FileSystemPreview,
  useFileSystem,
  useFileSystemBrowser,
  useFileSystemHeader,
  useFileSystemOpenPreview,
  useFileSystemPreview,
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
  FileSystemBrowserPartState,
  FileSystemHeaderState,
  FileSystemPreviewState,
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
              <FileSystemBrowser />
            </ViewerSidebar>
            <ViewerSurface className="bg-background">
              <FileSystemPreview />
            </ViewerSurface>
          </ViewerBody>
          <FileSystemOpenPreview />
        </ViewerRoot>
      </div>
    </FileSystemProvider>
  )
}
