"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ChevronRight, Folder } from "lucide-react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

import type { FileSystemBrowserController } from "./file-system-browser-controller"
import { folderHasChildren, pathParent } from "./file-system-index"
import { FileSystemThumbnail } from "./file-system-preview"
import type { FileSystemEntry } from "./file-system-types"
import { useFileSystemRovingFocus } from "./use-file-system-roving-focus"

const COLUMN_ROW_HEIGHT = 32

export function FileSystemColumnsView({
  controller,
}: {
  controller: FileSystemBrowserController
}) {
  const { browser, fileActions } = controller
  const columnPaths = React.useMemo(() => {
    const paths = [browser.currentPath]
    const selectedPath = browser.selection.selectedPath

    if (!selectedPath?.startsWith(browser.currentPath)) return paths

    const selectedEntry = browser.selection.selectedEntry
    const targetPath =
      selectedEntry?.kind === "folder"
        ? selectedEntry.path
        : (selectedEntry?.parentPath ?? browser.currentPath)
    const relativePath = targetPath.slice(browser.currentPath.length)
    let walkedPath = browser.currentPath

    for (const segment of relativePath.split("/")) {
      if (!segment) continue
      walkedPath = `${walkedPath}${segment}/`
      paths.push(walkedPath)
    }

    return paths
  }, [
    browser.currentPath,
    browser.selection.selectedEntry,
    browser.selection.selectedPath,
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
  path,
}: {
  controller: FileSystemBrowserController
  isLast: boolean
  path: string
}) {
  const { browser, fileActions } = controller
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const entries = React.useMemo(
    () => browser.index.children.get(path) ?? [],
    [browser.index.children, path]
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
      browser.commands.selectEntry(entry)
      if (entry.kind === "folder") {
        void browser.commands.ensureChildren(entry.path)
      }
    },
    scrollToIndex: (index) => {
      if (index !== -1) virtualizer.scrollToIndex(index)
    },
    selectedPath: browser.selection.selectedPath,
  })
  const openEntry = React.useCallback(
    (entry: FileSystemEntry) => {
      if (entry.kind === "folder") {
        browser.commands.navigateTo(entry.path)
      } else {
        fileActions.openPreview(entry)
      }
    },
    [browser.commands, fileActions]
  )
  const selectParent = React.useCallback(() => {
    const selectedEntry = browser.selection.selectedEntry
    if (!selectedEntry) return

    const parentPath =
      selectedEntry.kind === "folder"
        ? pathParent(selectedEntry.path)
        : selectedEntry.parentPath
    const parent = parentPath
      ? (browser.rawIndex.folders.get(parentPath) ?? null)
      : null

    if (parent) browser.commands.selectEntry(parent)
  }, [
    browser.commands,
    browser.rawIndex.folders,
    browser.selection.selectedEntry,
  ])
  const selectChild = React.useCallback(() => {
    const selectedEntry = browser.selection.selectedEntry
    if (selectedEntry?.kind !== "folder") return

    void browser.commands.selectFirstChildAfterEnsure(selectedEntry.path)
  }, [
    browser.commands,
    browser.rawIndex.folders,
    browser.selection.selectedEntry,
  ])
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
    if (event.key === "Enter" && browser.selection.selectedEntry) {
      openEntry(browser.selection.selectedEntry)
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
    controller: FileSystemBrowserController
    entry: FileSystemEntry
    style: React.CSSProperties
  }
>(function FileSystemColumnRow({ controller, entry, style }, ref) {
  const { browser, fileActions } = controller
  const selectedPath = browser.selection.selectedPath
  const isSelected = entry.path === selectedPath
  const isOnTrail =
    entry.kind === "folder" &&
    selectedPath?.startsWith(entry.path) &&
    pathParent(selectedPath) !== entry.parentPath

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={isSelected}
      tabIndex={isSelected || !selectedPath ? 0 : -1}
      onClick={() => {
        browser.commands.selectEntry(entry)
        if (entry.kind === "folder") {
          void browser.commands.ensureChildren(entry.path)
        }
      }}
      onDoubleClick={() => {
        if (entry.kind === "folder") {
          browser.commands.navigateTo(entry.path)
        } else {
          fileActions.openPreview(entry)
        }
      }}
      className={cn(
        "absolute inset-x-0 flex h-8 shrink-0 items-center gap-2 rounded-sm px-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected
          ? "bg-primary text-primary-foreground"
          : isOnTrail
            ? "bg-accent"
            : "hover:bg-accent/50"
      )}
      style={style}
    >
      {entry.kind === "folder" ? (
        <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <FileSystemThumbnail
          file={entry}
          resolveFileSource={fileActions.resolveFileSource}
          className="w-4 shrink-0"
        />
      )}
      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
      {entry.kind === "folder" && folderHasChildren(browser.rawIndex, entry) ? (
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
      ) : null}
    </button>
  )
})
