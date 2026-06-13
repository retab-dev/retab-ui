"use client"

import * as React from "react"
import { ExternalLink } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ViewerSource } from "@/lib/viewer-source"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileViewer } from "@/components/ui/file-viewer"
import { ScrollArea } from "@/components/ui/scroll-area"

import {
  FileSystemFilterBar,
  FileSystemStatusBar,
  FileSystemToolbar,
} from "./file-system-chrome"
import { FileSystemColumnsView } from "./file-system-columns-view"
import { useFileSystemController } from "./file-system-controller"
import { FileSystemGalleryView } from "./file-system-gallery-view"
import { FileSystemGridView } from "./file-system-grid-view"
import { FileSystemListView } from "./file-system-list-view"
import { FileSystemPreview } from "./file-system-preview"
import type { FileSystemFileEntry, FileSystemProps } from "./file-system-types"

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

export function FileSystem({
  items,
  className,
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
}: FileSystemProps) {
  const controller = useFileSystemController({
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
  const [openedFile, setOpenedFile] = React.useState<{
    file: FileSystemFileEntry
    source: ViewerSource | null
  } | null>(null)

  const openFile = React.useCallback(
    (file: FileSystemFileEntry) => {
      const controller_ = new AbortController()

      void controller
        .resolveFileSource(file, controller_.signal)
        .then((source) => {
          if (onFileOpen) {
            onFileOpen(file, source)
            return
          }
          setOpenedFile({ file, source })
        })
        .catch(() => {
          if (onFileOpen) {
            onFileOpen(file, null)
          } else {
            setOpenedFile({ file, source: null })
          }
        })
    },
    [controller, onFileOpen]
  )

  return (
    <section
      data-slot="file-system"
      className={cn(
        "flex h-[640px] min-h-0 overflow-hidden rounded-lg border bg-background text-foreground",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <FileSystemToolbar controller={controller} title={title} />
        <FileSystemFilterBar controller={controller} />
        <div className="min-h-0 flex-1">
          {controller.view === "list" ? (
            <FileSystemListView controller={controller} onOpenFile={openFile} />
          ) : controller.view === "grid" ? (
            <FileSystemGridView controller={controller} onOpenFile={openFile} />
          ) : controller.view === "columns" ? (
            <FileSystemColumnsView
              controller={controller}
              onOpenFile={openFile}
            />
          ) : (
            <FileSystemGalleryView
              controller={controller}
              onOpenFile={openFile}
              renderFileActions={renderFileActions}
              renderMetadata={renderMetadata}
            />
          )}
        </div>
        <FileSystemStatusBar controller={controller} />
      </div>
      {controller.view !== "gallery" ? (
        <FileSystemPreview
          entry={controller.selectedEntry}
          renderFileActions={renderFileActions}
          renderMetadata={renderMetadata}
          resolveFileSource={controller.resolveFileSource}
          className="hidden w-[42%] max-w-xl min-w-[22rem] lg:flex"
        />
      ) : null}
      <Dialog
        open={openedFile !== null}
        onOpenChange={(open) => {
          if (!open) setOpenedFile(null)
        }}
      >
        {openedFile ? (
          <DialogContent className="h-[88vh] max-w-[min(96vw,1280px)] overflow-hidden p-0">
            <DialogHeader className="shrink-0 border-b px-4 py-3">
              <div className="flex min-w-0 items-center gap-3 pr-8">
                <DialogTitle className="truncate text-base">
                  {openedFile.file.name}
                </DialogTitle>
                {openedFile.source?.kind === "url" ? (
                  <Button
                    render={
                      <a
                        href={openedFile.source.url}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                    size="xs"
                    variant="outline"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    Open
                  </Button>
                ) : null}
              </div>
            </DialogHeader>
            <div className="min-h-0 flex-1">
              {openedFile.source ? (
                <FileSystemPreviewDialog source={openedFile.source} />
              ) : (
                <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                  Preview unavailable
                </div>
              )}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  )
}

function FileSystemPreviewDialog({ source }: { source: ViewerSource }) {
  return (
    <ScrollArea>
      <div className="h-[calc(88vh-4rem)] min-h-0">
        <FileSystemDialogViewer source={source} />
      </div>
    </ScrollArea>
  )
}

function FileSystemDialogViewer({ source }: { source: ViewerSource }) {
  return <FileViewer source={source} bare className="size-full min-h-0" />
}
