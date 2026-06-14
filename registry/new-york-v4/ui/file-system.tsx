"use client"

import { cn } from "@/lib/utils"

import {
  FileSystemOpenPreview,
  useFileSystemOpenPreview,
} from "./file-system-open-preview-dialog"
import {
  FileSystemBrowser,
  FileSystemHeader,
  FileSystemSelection,
  useFileSystemBrowser,
  useFileSystemHeader,
  useFileSystemSelectedItem,
  useFileSystemSelectedSource,
  useFileSystemSelection,
} from "./file-system-parts"
import { FileSystemSelectionSurface } from "./file-system-preview"
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
  FileSystemSelection,
  useFileSystem,
  useFileSystemBrowser,
  useFileSystemHeader,
  useFileSystemOpenPreview,
  useFileSystemSelectedItem,
  useFileSystemSelectedSource,
  useFileSystemSelection,
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
  FileSystemSelectionRenderState,
  FileSystemSelectionState,
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
              <FileSystemSelection>
                {({
                  entry,
                  renderFileActions,
                  renderMetadata,
                  resolveSource,
                  sourceState,
                }) => (
                  <FileSystemSelectionSurface
                    entry={entry}
                    renderFileActions={renderFileActions}
                    renderMetadata={renderMetadata}
                    resolveFileSource={resolveSource}
                    sourceState={sourceState}
                    className="size-full border-l-0"
                  />
                )}
              </FileSystemSelection>
            </ViewerSurface>
          </ViewerBody>
          <FileSystemOpenPreview />
        </ViewerRoot>
      </div>
    </FileSystemProvider>
  )
}
