"use client"

import * as React from "react"
import { AlertCircle, FileQuestion, RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { FileViewer } from "@/components/ui/file-viewer"
import { Spinner } from "@/components/ui/spinner"

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
  type FileSystemSelectionRenderState,
} from "./file-system-parts"
import { FileSystemProvider, useFileSystem } from "./file-system-provider"
import { FileSystemThumbnail } from "./file-system-thumbnail"
import type {
  FileSystemEntry,
  FileSystemFileItem,
  FileSystemProps,
} from "./file-system-types"
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

const FILE_SYSTEM_SIDEBAR_WIDTH = "min(22rem, 85vw)"
const FILE_SYSTEM_COLUMNS_SIDEBAR_WIDTH =
  "min(clamp(32rem, 40vw, 40rem), 85vw)"

export function FileSystem({ className, ...providerProps }: FileSystemProps) {
  return (
    <FileSystemProvider {...providerProps}>
      <FileSystemRoot className={className} />
    </FileSystemProvider>
  )
}

function FileSystemRoot({ className }: { className?: string }) {
  const { browser } = useFileSystem()
  const sidebarWidth =
    browser.view === "columns"
      ? FILE_SYSTEM_COLUMNS_SIDEBAR_WIDTH
      : FILE_SYSTEM_SIDEBAR_WIDTH

  return (
    <div data-slot="file-system">
      <ViewerRoot
        data-viewer="file-system"
        defaultOpen
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
            width={sidebarWidth}
            className="flex min-w-0 flex-col border-r"
          >
            <FileSystemBrowser />
          </ViewerSidebar>
          <ViewerSurface className="bg-background">
            <FileSystemSelection>
              {(selection) => (
                <FileSystemDefaultSelectionContent selection={selection} />
              )}
            </FileSystemSelection>
          </ViewerSurface>
        </ViewerBody>
        <FileSystemOpenPreview />
      </ViewerRoot>
    </div>
  )
}

function FileSystemDefaultSelectionContent({
  selection,
}: {
  selection: FileSystemSelectionRenderState
}) {
  const {
    entry,
    renderFileActions,
    renderMetadata,
    resolveSource,
    retry,
    sourceState,
  } = selection

  return (
    <div
      data-slot="file-system-default-selection"
      className="flex size-full min-h-0 min-w-0 flex-col overflow-hidden bg-muted/20"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-background">
          {!entry ? (
            <FileSystemDefaultSelectionMessage
              title="No file selected"
              description="Select a file to preview it."
            />
          ) : entry.kind === "folder" ? (
            <FileSystemDefaultSelectionMessage
              title={entry.name}
              description="Folders show their contents in the browser."
            />
          ) : sourceState.status === "loading" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading preview
            </div>
          ) : sourceState.status === "error" ? (
            <FileSystemDefaultSelectionMessage
              icon={<AlertCircle className="size-5" aria-hidden />}
              title="Couldn't load preview"
              description={sourceState.error}
              action={
                <Button size="sm" variant="outline" onClick={retry}>
                  <RefreshCw className="size-3.5" aria-hidden />
                  Retry
                </Button>
              }
            />
          ) : sourceState.status === "ready" ? (
            <FileViewer
              source={sourceState.source}
              bare
              className="size-full min-h-0"
            />
          ) : sourceState.status === "unavailable" ? (
            <FileSystemDefaultSelectionMessage
              icon={<FileQuestion className="size-5" aria-hidden />}
              title="Preview unavailable"
              description="This file does not have a resolved source."
            />
          ) : null}
        </div>
        {entry ? (
          <FileSystemDefaultSelectionFooter
            entry={entry}
            renderFileActions={renderFileActions}
            renderMetadata={renderMetadata}
            resolveFileSource={resolveSource}
          />
        ) : null}
      </div>
    </div>
  )
}

function FileSystemDefaultSelectionFooter({
  entry,
  renderFileActions,
  renderMetadata,
  resolveFileSource,
}: {
  entry: FileSystemEntry
  renderFileActions?: (file: FileSystemFileItem) => React.ReactNode
  renderMetadata?: (item: FileSystemEntry) => React.ReactNode
  resolveFileSource: FileSystemSelectionRenderState["resolveSource"]
}) {
  const file = entry.kind === "file" ? entry : null

  return (
    <div className="shrink-0 border-t bg-background p-3">
      <div className="flex items-start gap-3">
        {file ? (
          <FileSystemThumbnail
            file={file}
            resolveFileSource={resolveFileSource}
            className="w-12 shrink-0"
          />
        ) : (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-sm bg-muted text-lg">
            {folderInitial(entry.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium break-words">{entry.name}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {entry.path}
          </div>
        </div>
        {file ? renderFileActions?.(file) : null}
      </div>
      {renderMetadata ? (
        <div className="mt-3">{renderMetadata(entry)}</div>
      ) : null}
    </div>
  )
}

function FileSystemDefaultSelectionMessage({
  action,
  description,
  icon,
  title,
}: {
  action?: React.ReactNode
  description: string
  icon?: React.ReactNode
  title: string
}) {
  return (
    <div className="flex max-w-xs flex-col items-center gap-2 px-6 text-center">
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}

function folderInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "/"
}
