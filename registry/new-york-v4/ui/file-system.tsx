"use client"

import * as React from "react"
import {
  ArrowLeft,
  ArrowRight,
  Columns3,
  ExternalLink,
  Filter,
  Grid3X3,
  Image,
  List,
  Search,
  X,
} from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { FileSystemColumnsView } from "./file-system-columns-view"
import { useFileSystemController } from "./file-system-controller"
import { FileSystemGalleryView } from "./file-system-gallery-view"
import { FileSystemGridView } from "./file-system-grid-view"
import { pathName } from "./file-system-index"
import { FileSystemListView } from "./file-system-list-view"
import { FileSystemPreview } from "./file-system-preview"
import {
  getFileSystemCategoryLabel,
  normalizeFileSystemSearch,
} from "./file-system-query"
import type {
  FileSystemEntry,
  FileSystemFileEntry,
  FileSystemProps,
  FileSystemView,
} from "./file-system-types"

export type {
  FileSystemFileItem,
  FileSystemFolderItem,
  FileSystemItem,
  FileSystemLoadChildrenArgs,
  FileSystemLoadChildrenResult,
  FileSystemProps,
  FileSystemResolveSourceArgs,
  FileSystemView,
} from "./file-system-types"

const VIEW_OPTIONS: Array<{
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: FileSystemView
}> = [
  { icon: List, label: "List", value: "list" },
  { icon: Grid3X3, label: "Grid", value: "grid" },
  { icon: Columns3, label: "Columns", value: "columns" },
  { icon: Image, label: "Gallery", value: "gallery" },
]

export function FileSystem({
  items,
  className,
  defaultPath,
  defaultSelectedPath,
  defaultView = "list",
  loadChildren,
  onFileOpen,
  onSelectionChange,
  onViewChange,
  renderFileActions,
  renderMetadata,
  resolveSource,
  selectedPath,
  title = "Files",
  view,
}: FileSystemProps) {
  const controller = useFileSystemController({
    defaultPath,
    defaultSelectedPath,
    defaultView,
    items,
    loadChildren,
    onSelectionChange,
    onViewChange,
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

  const selectedFile =
    controller.selectedEntry?.kind === "file" ? controller.selectedEntry : null
  const currentFolderName =
    controller.currentPath === ""
      ? title
      : pathName(controller.currentPath) || title
  const itemCount = controller.currentEntries.length
  const isSearching =
    normalizeFileSystemSearch(controller.query.search).length > 0
  const hasFilters = controller.query.filters.categories.length > 0

  return (
    <section
      data-slot="file-system"
      className={cn(
        "flex h-[640px] min-h-0 overflow-hidden rounded-lg border bg-background text-foreground",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-muted/35 px-2">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <Button
              aria-label="Back"
              disabled={!controller.canGoBack}
              onClick={controller.goBack}
              size="icon-sm"
              variant="ghost"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </Button>
            <Button
              aria-label="Forward"
              disabled={!controller.canGoForward}
              onClick={controller.goForward}
              size="icon-sm"
              variant="ghost"
            >
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            <div className="min-w-0 px-1">
              <div className="truncate text-sm font-semibold">
                {currentFolderName}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {controller.currentPath || "/"}
              </div>
            </div>
          </div>
          <Tabs
            value={controller.view}
            onValueChange={(nextView) =>
              controller.setView(nextView as FileSystemView)
            }
            className="hidden gap-0 md:flex"
          >
            <TabsList className="h-8 p-0.5">
              {VIEW_OPTIONS.map((option) => (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  aria-label={`${option.label} view`}
                  title={`${option.label} view`}
                  className="h-7 px-2"
                >
                  <option.icon className="size-4" aria-hidden />
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative w-52 min-w-0 max-sm:w-36">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              aria-label="Search files"
              className="[&_input]:pl-7"
              nativeInput
              onChange={(event) => controller.setSearch(event.target.value)}
              placeholder="Search"
              size="sm"
              type="search"
              value={controller.query.search}
            />
          </div>
        </div>
        {controller.categories.length ? (
          <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-2 py-1.5">
            <Filter className="size-3.5 shrink-0 text-muted-foreground" />
            {controller.categories.map((category) => {
              const isActive =
                controller.query.filters.categories.includes(category)

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => controller.toggleCategory(category)}
                  className={cn(
                    "h-6 shrink-0 rounded-md border px-2 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-muted-foreground"
                  )}
                >
                  {getFileSystemCategoryLabel(category)}
                </button>
              )
            })}
            {hasFilters ? (
              <Button
                size="xs"
                variant="ghost"
                onClick={controller.clearFilters}
              >
                <X className="size-3" aria-hidden />
                Clear
              </Button>
            ) : null}
          </div>
        ) : null}
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
        <div
          aria-live="polite"
          className="flex h-8 shrink-0 items-center justify-between gap-3 border-t bg-muted/35 px-3 text-xs text-muted-foreground"
        >
          <span>
            {itemCount}{" "}
            {isSearching || hasFilters
              ? itemCount === 1
                ? "result"
                : "results"
              : itemCount === 1
                ? "item"
                : "items"}
          </span>
          {controller.selectedEntry ? (
            <span className="min-w-0 truncate">
              {controller.selectedEntry.name} selected
            </span>
          ) : null}
        </div>
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
