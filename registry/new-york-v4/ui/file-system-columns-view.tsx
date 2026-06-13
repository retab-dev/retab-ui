"use client"

import * as React from "react"
import { ChevronRight, File, Folder } from "lucide-react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

import type { FileSystemController } from "./file-system-controller"
import { folderHasChildren, pathParent } from "./file-system-index"
import { FileSystemThumbnail } from "./file-system-preview"
import type { FileSystemEntry, FileSystemFileEntry } from "./file-system-types"

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
  const entries = controller.index.children.get(path) ?? []

  return (
    <div
      className={cn("w-64 shrink-0 border-r", isLast && "flex-1")}
      role="listbox"
      aria-label={path || "Files"}
    >
      <div className="flex h-full flex-col gap-px overflow-auto p-1.5">
        {entries.length ? (
          entries.map((entry) => (
            <FileSystemColumnRow
              key={entry.path}
              controller={controller}
              entry={entry}
              onOpenFile={onOpenFile}
            />
          ))
        ) : (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            This folder is empty
          </div>
        )}
      </div>
    </div>
  )
}

function FileSystemColumnRow({
  controller,
  entry,
  onOpenFile,
}: {
  controller: FileSystemController
  entry: FileSystemEntry
  onOpenFile: (file: FileSystemFileEntry) => void
}) {
  const isSelected = entry.path === controller.selectedPath
  const isOnTrail =
    entry.kind === "folder" &&
    controller.selectedPath?.startsWith(entry.path) &&
    pathParent(controller.selectedPath) !== entry.parentPath

  return (
    <button
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
        "flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected
          ? "bg-primary text-primary-foreground"
          : isOnTrail
            ? "bg-accent"
            : "hover:bg-accent/50"
      )}
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
}
