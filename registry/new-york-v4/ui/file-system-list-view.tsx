"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ChevronDown, ChevronRight, File, Folder } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

import type { FileSystemController } from "./file-system-controller"
import { folderHasChildren } from "./file-system-index"
import { FileSystemThumbnail } from "./file-system-preview"
import {
  entryKindLabel,
  flattenFileSystemRows,
  getFileSystemCategoryLabel,
} from "./file-system-query"
import type {
  FileSystemEntry,
  FileSystemSortKey,
  FileSystemTreeRow,
} from "./file-system-types"
import { formatFileSystemDate, formatFileSystemSize } from "./file-system-utils"

const ROW_HEIGHT = 36

export function FileSystemListView({
  controller,
  onOpenFile,
}: {
  controller: FileSystemController
  onOpenFile: (file: Extract<FileSystemEntry, { kind: "file" }>) => void
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const rowRefs = React.useRef(new Map<string, HTMLButtonElement>())
  const rows = React.useMemo(
    () =>
      flattenFileSystemRows({
        currentPath: controller.currentPath,
        expandedPaths: controller.expandedPaths,
        index: controller.index,
      }),
    [controller.currentPath, controller.expandedPaths, controller.index]
  )
  const virtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_HEIGHT,
    getScrollElement: () => viewportRef.current,
    overscan: 12,
  })
  const virtualRows = virtualizer.getVirtualItems()
  const renderedRows = virtualRows.length
    ? virtualRows.map((virtualRow) => ({
        row: rows[virtualRow.index],
        start: virtualRow.start,
      }))
    : rows.map((row, index) => ({ row, start: index * ROW_HEIGHT }))
  const totalSize = virtualRows.length
    ? virtualizer.getTotalSize()
    : rows.length * ROW_HEIGHT

  const focusRow = React.useCallback((entry: FileSystemEntry) => {
    requestAnimationFrame(() => rowRefs.current.get(entry.path)?.focus())
  }, [])

  const selectByOffset = (offset: number) => {
    const currentIndex = rows.findIndex(
      (row) => row.entry.path === controller.selectedPath
    )
    const nextIndex = Math.min(
      rows.length - 1,
      Math.max(0, currentIndex === -1 ? 0 : currentIndex + offset)
    )
    const nextEntry = rows[nextIndex]?.entry

    if (!nextEntry) return
    controller.selectEntry(nextEntry)
    focusRow(nextEntry)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      selectByOffset(event.key === "ArrowDown" ? 1 : -1)
      event.preventDefault()
      return
    }
    if (event.key === "Home") {
      const entry = rows[0]?.entry
      if (entry) {
        controller.selectEntry(entry)
        focusRow(entry)
        event.preventDefault()
      }
      return
    }
    if (event.key === "End") {
      const entry = rows[rows.length - 1]?.entry
      if (entry) {
        controller.selectEntry(entry)
        focusRow(entry)
        event.preventDefault()
      }
      return
    }
    if (event.key === "Enter" && controller.selectedEntry) {
      openEntry(controller.selectedEntry)
      event.preventDefault()
      return
    }
    if (
      event.key === "ArrowRight" &&
      controller.selectedEntry?.kind === "folder"
    ) {
      const folder = controller.selectedEntry
      if (!controller.expandedPaths.has(folder.path)) {
        controller.toggleExpanded(folder.path)
        void controller.ensureChildren(folder.path)
        event.preventDefault()
      }
      return
    }
    if (
      event.key === "ArrowLeft" &&
      controller.selectedEntry?.kind === "folder"
    ) {
      const folder = controller.selectedEntry
      if (controller.expandedPaths.has(folder.path)) {
        controller.toggleExpanded(folder.path)
        event.preventDefault()
      }
      return
    }

    const match = typeAheadMatch(event, rows, controller.selectedPath)
    if (match) {
      controller.selectEntry(match)
      focusRow(match)
    }
  }

  const openEntry = (entry: FileSystemEntry) => {
    if (entry.kind === "folder") {
      controller.navigateTo(entry.path)
    } else {
      onOpenFile(entry)
    }
  }

  if (!rows.length) {
    return <FileSystemEmptyRows label="This folder is empty" />
  }

  return (
    <div className="flex size-full flex-col">
      <div className="grid h-9 shrink-0 grid-cols-[minmax(16rem,1fr)_9rem_7rem_9rem] items-center border-b bg-muted/30 px-3 text-xs font-medium text-muted-foreground">
        <SortHeader controller={controller} label="Name" sortKey="name" />
        <SortHeader controller={controller} label="Type" sortKey="kind" />
        <SortHeader controller={controller} label="Size" sortKey="size" />
        <SortHeader
          controller={controller}
          label="Modified"
          sortKey="updatedAt"
        />
      </div>
      <ScrollArea
        orientation="vertical"
        viewportRef={viewportRef}
        viewportProps={{
          onKeyDown: handleKeyDown,
          role: "tree",
          "aria-label": "Files",
        }}
      >
        <div className="relative min-w-[41rem]" style={{ height: totalSize }}>
          {renderedRows.map(({ row, start }) => (
            <FileSystemListRow
              key={row.entry.path}
              controller={controller}
              onOpen={openEntry}
              ref={(element) => {
                if (element) {
                  rowRefs.current.set(row.entry.path, element)
                } else {
                  rowRefs.current.delete(row.entry.path)
                }
              }}
              row={row}
              style={{ transform: `translateY(${start}px)` }}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

const FileSystemListRow = React.forwardRef<
  HTMLButtonElement,
  {
    controller: FileSystemController
    onOpen: (entry: FileSystemEntry) => void
    row: FileSystemTreeRow
    style: React.CSSProperties
  }
>(function FileSystemListRow({ controller, onOpen, row, style }, ref) {
  const { entry } = row
  const isSelected = entry.path === controller.selectedPath
  const canExpand =
    entry.kind === "folder" && folderHasChildren(controller.rawIndex, entry)
  const isExpanded =
    entry.kind === "folder" && controller.expandedPaths.has(entry.path)
  const folderError =
    entry.kind === "folder" ? controller.folderErrors.get(entry.path) : null
  const isLoading =
    entry.kind === "folder" && controller.loadingFolders.has(entry.path)

  return (
    <button
      ref={ref}
      type="button"
      role="treeitem"
      aria-selected={isSelected}
      aria-level={row.depth + 1}
      aria-expanded={canExpand ? isExpanded : undefined}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => {
        controller.selectEntry(entry)
        if (entry.kind === "folder") void controller.ensureChildren(entry.path)
      }}
      onDoubleClick={() => onOpen(entry)}
      className={cn(
        "absolute inset-x-0 grid h-9 grid-cols-[minmax(16rem,1fr)_9rem_7rem_9rem] items-center px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent/60"
      )}
      style={style}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span style={{ width: row.depth * 18 }} />
        {canExpand ? (
          <span
            className="flex size-5 shrink-0 items-center justify-center"
            onClick={(event) => {
              event.stopPropagation()
              controller.toggleExpanded(entry.path)
              void controller.ensureChildren(entry.path)
            }}
          >
            {isExpanded ? (
              <ChevronDown className="size-3.5" aria-hidden />
            ) : (
              <ChevronRight className="size-3.5" aria-hidden />
            )}
          </span>
        ) : (
          <span className="size-5 shrink-0" />
        )}
        {entry.kind === "folder" ? (
          <Folder className="size-4 shrink-0 text-sky-500" aria-hidden />
        ) : (
          <FileSystemThumbnail
            file={entry}
            resolveFileSource={controller.resolveFileSource}
            className="w-5 shrink-0"
          />
        )}
        <span className="min-w-0 truncate">{entry.name}</span>
        {isLoading ? (
          <span className="text-xs text-muted-foreground">Loading</span>
        ) : null}
        {folderError ? (
          <span
            className="text-xs text-destructive underline-offset-2 hover:underline"
            onClick={(event) => {
              event.stopPropagation()
              void controller.ensureChildren(entry.path, { retry: true })
            }}
          >
            {folderError}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "truncate text-xs",
          isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
        )}
      >
        {entryKindLabel(entry)}
      </span>
      <span
        className={cn(
          "truncate text-xs",
          isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
        )}
      >
        {entry.kind === "file" ? formatFileSystemSize(entry.size) : ""}
      </span>
      <span
        className={cn(
          "truncate text-xs",
          isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
        )}
      >
        {formatFileSystemDate(entry.updatedAt ?? entry.createdAt)}
      </span>
    </button>
  )
})

function SortHeader({
  controller,
  label,
  sortKey,
}: {
  controller: FileSystemController
  label: string
  sortKey: FileSystemSortKey
}) {
  const isActive = controller.query.sort.key === sortKey

  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1 text-left outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        isActive && "text-foreground"
      )}
      onClick={() => controller.setSortKey(sortKey)}
    >
      {label}
      {isActive ? (
        <span aria-hidden>
          {controller.query.sort.direction === "asc" ? "↑" : "↓"}
        </span>
      ) : null}
    </button>
  )
}

export function FileSystemEmptyRows({ label }: { label: string }) {
  return (
    <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function typeAheadMatch(
  event: React.KeyboardEvent,
  rows: FileSystemTreeRow[],
  selectedPath: string | null
) {
  if (
    event.key.length !== 1 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    !/^[\p{L}\p{N}]$/u.test(event.key)
  ) {
    return null
  }

  const search = event.key.toLowerCase()
  const startIndex = Math.max(
    0,
    rows.findIndex((row) => row.entry.path === selectedPath) + 1
  )

  for (let step = 0; step < rows.length; step += 1) {
    const entry = rows[(startIndex + step) % rows.length].entry

    if (entry.name.toLowerCase().startsWith(search)) {
      event.preventDefault()
      return entry
    }
  }

  return null
}
