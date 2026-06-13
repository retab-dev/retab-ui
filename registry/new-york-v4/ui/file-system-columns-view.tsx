"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ChevronRight, Folder } from "lucide-react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

import type { FileSystemController } from "./file-system-controller"
import { folderHasChildren, pathParent } from "./file-system-index"
import { FileSystemThumbnail } from "./file-system-preview"
import type { FileSystemEntry, FileSystemFileEntry } from "./file-system-types"
import { useFileSystemRovingFocus } from "./use-file-system-roving-focus"

const COLUMN_ROW_HEIGHT = 32

export function FileSystemColumnsView({
  controller,
  onOpenFile,
}: {
  controller: FileSystemController
  onOpenFile: (file: FileSystemFileEntry) => void
}) {
  const columnPaths = React.useMemo(() => {
    const paths = [controller.currentPath]
    const selectedPath = controller.selectedPath

    if (!selectedPath?.startsWith(controller.currentPath)) return paths

    const selectedEntry = controller.selectedEntry
    const targetPath =
      selectedEntry?.kind === "folder"
        ? selectedEntry.path
        : (selectedEntry?.parentPath ?? controller.currentPath)
    const relativePath = targetPath.slice(controller.currentPath.length)
    let walkedPath = controller.currentPath

    for (const segment of relativePath.split("/")) {
      if (!segment) continue
      walkedPath = `${walkedPath}${segment}/`
      paths.push(walkedPath)
    }

    return paths
  }, [
    controller.currentPath,
    controller.selectedEntry,
    controller.selectedPath,
  ])

  return (
    <ScrollArea
      orientation="horizontal"
      viewportClassName="overscroll-x-contain"
    >
      <div className="flex h-full min-w-full">
        {columnPaths.map((path, index) => (
          <FileSystemColumn
            key={path || "(root)"}
            controller={controller}
            isLast={index === columnPaths.length - 1}
            onOpenFile={onOpenFile}
            path={path}
          />
        ))}
      </div>
    </ScrollArea>
  )
}

function FileSystemColumn({
  controller,
  isLast,
  onOpenFile,
  path,
}: {
  controller: FileSystemController
  isLast: boolean
  onOpenFile: (file: FileSystemFileEntry) => void
  path: string
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const entries = React.useMemo(
    () => controller.index.children.get(path) ?? [],
    [controller.index.children, path]
  )
  const virtualizer = useVirtualizer({
    count: entries.length,
    estimateSize: () => COLUMN_ROW_HEIGHT,
    getScrollElement: () => viewportRef.current,
    overscan: 10,
  })
  const virtualRows = virtualizer.getVirtualItems()
  const renderedRows = virtualRows.length
    ? virtualRows.map((row) => ({
        entry: entries[row.index],
        start: row.start,
      }))
    : entries.map((entry, index) => ({
        entry,
        start: index * COLUMN_ROW_HEIGHT,
      }))
  const totalSize = virtualRows.length
    ? virtualizer.getTotalSize()
    : entries.length * COLUMN_ROW_HEIGHT
  const rovingFocus = useFileSystemRovingFocus({
    entries,
    getScrollIndex: (entry) =>
      entries.findIndex((candidate) => candidate.path === entry.path),
    onSelect: (entry) => {
      controller.selectEntry(entry)
      if (entry.kind === "folder") void controller.ensureChildren(entry.path)
    },
    scrollToIndex: (index) => {
      if (index !== -1) virtualizer.scrollToIndex(index)
    },
    selectedPath: controller.selectedPath,
  })
  const openEntry = React.useCallback(
    (entry: FileSystemEntry) => {
      if (entry.kind === "folder") {
        controller.navigateTo(entry.path)
      } else {
        onOpenFile(entry)
      }
    },
    [controller, onOpenFile]
  )
  const selectParent = React.useCallback(() => {
    const selectedEntry = controller.selectedEntry
    if (!selectedEntry) return

    const parentPath =
      selectedEntry.kind === "folder"
        ? pathParent(selectedEntry.path)
        : selectedEntry.parentPath
    const parent = parentPath
      ? (controller.rawIndex.folders.get(parentPath) ?? null)
      : null

    if (parent) controller.selectEntry(parent)
  }, [controller])
  const selectChild = React.useCallback(() => {
    const selectedEntry = controller.selectedEntry
    if (selectedEntry?.kind !== "folder") return

    void controller.selectFirstChildAfterEnsure(selectedEntry.path)
  }, [controller])
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      rovingFocus.selectByOffset(event.key === "ArrowDown" ? 1 : -1)
      event.preventDefault()
      return
    }
    if (event.key === "Home" || event.key === "End") {
      rovingFocus.selectBoundary(event.key === "Home" ? "first" : "last")
      event.preventDefault()
      return
    }
    if (event.key === "ArrowRight") {
      selectChild()
      event.preventDefault()
      return
    }
    if (event.key === "ArrowLeft") {
      selectParent()
      event.preventDefault()
      return
    }
    if (event.key === "Enter" && controller.selectedEntry) {
      openEntry(controller.selectedEntry)
      event.preventDefault()
      return
    }

    rovingFocus.selectTypeAhead(event)
  }

  return (
    <div
      className={cn("w-64 shrink-0 border-r", isLast && "flex-1")}
      role="listbox"
      aria-label={path || "Files"}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div ref={viewportRef} className="h-full overflow-auto p-1.5">
        {entries.length ? (
          <div className="relative" style={{ height: totalSize }}>
            {renderedRows.map(({ entry, start }) => (
              <FileSystemColumnRow
                key={entry.path}
                controller={controller}
                entry={entry}
                onOpenFile={onOpenFile}
                ref={(element) => {
                  rovingFocus.registerEntryRef(entry.path, element)
                }}
                style={{ transform: `translateY(${start}px)` }}
              />
            ))}
          </div>
        ) : (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            This folder is empty
          </div>
        )}
      </div>
    </div>
  )
}

const FileSystemColumnRow = React.forwardRef<
  HTMLButtonElement,
  {
    controller: FileSystemController
    entry: FileSystemEntry
    onOpenFile: (file: FileSystemFileEntry) => void
    style: React.CSSProperties
  }
>(function FileSystemColumnRow({ controller, entry, onOpenFile, style }, ref) {
  const isSelected = entry.path === controller.selectedPath
  const isOnTrail =
    entry.kind === "folder" &&
    controller.selectedPath?.startsWith(entry.path) &&
    pathParent(controller.selectedPath) !== entry.parentPath

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={isSelected}
      tabIndex={isSelected || !controller.selectedPath ? 0 : -1}
      onClick={() => {
        controller.selectEntry(entry)
        if (entry.kind === "folder") void controller.ensureChildren(entry.path)
      }}
      onDoubleClick={() => {
        if (entry.kind === "folder") {
          controller.navigateTo(entry.path)
        } else {
          onOpenFile(entry)
        }
      }}
      className={cn(
        "absolute inset-x-0 flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected
          ? "bg-primary text-primary-foreground"
          : isOnTrail
            ? "bg-accent"
            : "hover:bg-accent/50"
      )}
      style={style}
    >
      {entry.kind === "folder" ? (
        <Folder className="size-4 shrink-0 text-sky-500" aria-hidden />
      ) : (
        <FileSystemThumbnail
          file={entry}
          resolveFileSource={controller.resolveFileSource}
          className="w-4 shrink-0"
        />
      )}
      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
      {entry.kind === "folder" &&
      folderHasChildren(controller.rawIndex, entry) ? (
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
      ) : null}
    </button>
  )
})
