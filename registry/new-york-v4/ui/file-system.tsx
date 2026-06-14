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
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer"

import { FileSystemColumnsView } from "./file-system-columns-view"
import { useFileSystemController } from "./file-system-controller"
import {
  FileSystemFilterBar,
  FileSystemStatusBar,
  FileSystemToolbar,
} from "./file-system-controls"
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

export type FileSystemProviderProps = Omit<FileSystemProps, "className"> & {
  children: React.ReactNode
}

type FileSystemContextValue = {
  controller: ReturnType<typeof useFileSystemController>
  openedFile: {
    file: FileSystemFileEntry
    source: ViewerSource | null
  } | null
  openFile: (file: FileSystemFileEntry) => void
  renderFileActions?: FileSystemProps["renderFileActions"]
  renderMetadata?: FileSystemProps["renderMetadata"]
  setOpenedFile: React.Dispatch<
    React.SetStateAction<{
      file: FileSystemFileEntry
      source: ViewerSource | null
    } | null>
  >
  title: string
}

export type FileSystemHeaderState = {
  controller: ReturnType<typeof useFileSystemController>
  title: string
}

export type FileSystemExplorerState = {
  controller: ReturnType<typeof useFileSystemController>
  openFile: (file: FileSystemFileEntry) => void
  renderFileActions?: FileSystemProps["renderFileActions"]
  renderMetadata?: FileSystemProps["renderMetadata"]
}

export type FileSystemSelectedFileState = {
  controller: ReturnType<typeof useFileSystemController>
  renderFileActions?: FileSystemProps["renderFileActions"]
  renderMetadata?: FileSystemProps["renderMetadata"]
}

type FileSystemOpenDialogState = {
  openedFile: FileSystemContextValue["openedFile"]
  setOpenedFile: FileSystemContextValue["setOpenedFile"]
}

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

export function useFileSystemHeader(): FileSystemHeaderState {
  const { controller, title } = useFileSystem()
  return { controller, title }
}

export function useFileSystemExplorer(): FileSystemExplorerState {
  const { controller, openFile, renderFileActions, renderMetadata } =
    useFileSystem()

  return { controller, openFile, renderFileActions, renderMetadata }
}

export function useFileSystemSelectedFile(): FileSystemSelectedFileState {
  const { controller, renderFileActions, renderMetadata } = useFileSystem()

  return { controller, renderFileActions, renderMetadata }
}

export function useFileSystemOpenDialog(): FileSystemOpenDialogState {
  const { openedFile, setOpenedFile } = useFileSystem()
  return { openedFile, setOpenedFile }
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

  const value = React.useMemo<FileSystemContextValue>(
    () => ({
      controller,
      openedFile,
      openFile,
      renderFileActions,
      renderMetadata,
      setOpenedFile,
      title,
    }),
    [controller, openedFile, openFile, renderFileActions, renderMetadata, title]
  )

  return (
    <FileSystemContext.Provider value={value}>
      {children}
    </FileSystemContext.Provider>
  )
}

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
  return (
    <FileSystemProvider
      items={items}
      defaultPath={defaultPath}
      defaultQuery={defaultQuery}
      defaultSelectedPath={defaultSelectedPath}
      defaultView={defaultView}
      loadChildren={loadChildren}
      onPathChange={onPathChange}
      onQueryChange={onQueryChange}
      onFileOpen={onFileOpen}
      onSelectionChange={onSelectionChange}
      onViewChange={onViewChange}
      path={path}
      query={query}
      renderFileActions={renderFileActions}
      renderMetadata={renderMetadata}
      resolveSource={resolveSource}
      selectedPath={selectedPath}
      title={title}
      view={view}
    >
      <ViewerRoot
        data-viewer="file-system"
        bare
        defaultSidebarOpen
        className={cn(
          "h-[640px] rounded-lg border bg-background text-foreground",
          className
        )}
      >
        <ViewerHeader className="flex flex-col">
          <FileSystemHeader />
        </ViewerHeader>
        <ViewerBody>
          <ViewerSidebar
            width="58%"
            className="flex min-w-0 flex-1 flex-col border-r md:w-auto"
          >
            <FileSystemExplorer />
          </ViewerSidebar>
          <ViewerSurface className="hidden w-[42%] max-w-xl min-w-[22rem] flex-none lg:flex">
            <FileSystemSelectedFile />
          </ViewerSurface>
        </ViewerBody>
        <FileSystemOpenDialog />
      </ViewerRoot>
    </FileSystemProvider>
  )
}

export function FileSystemHeader() {
  const { controller, title } = useFileSystemHeader()

  return (
    <>
      <FileSystemToolbar controller={controller} title={title} />
      <FileSystemFilterBar controller={controller} />
    </>
  )
}

export function FileSystemExplorer() {
  const { controller, openFile, renderFileActions, renderMetadata } =
    useFileSystemExplorer()

  return (
    <div className="flex size-full min-h-0 flex-col">
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
  )
}

export function FileSystemSelectedFile() {
  const { controller, renderFileActions, renderMetadata } =
    useFileSystemSelectedFile()

  return (
    <FileSystemPreview
      entry={controller.selectedEntry}
      renderFileActions={renderFileActions}
      renderMetadata={renderMetadata}
      resolveFileSource={controller.resolveFileSource}
      className="size-full border-l-0"
    />
  )
}

export function FileSystemOpenDialog() {
  const { openedFile, setOpenedFile } = useFileSystemOpenDialog()

  return (
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
