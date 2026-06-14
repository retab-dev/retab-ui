"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  File,
  Folder,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

import type { FileSystemBrowserController } from "./file-system-browser-controller"
import { entryKindLabel } from "./file-system-query"
import type { FileSystemEntry } from "./file-system-types"
import { formatFileSystemDate, formatFileSystemSize } from "./file-system-utils"

type FileSystemListRow =
  | {
      depth: number
      entry: FileSystemEntry
      id: string
      isExpanded: boolean
      kind: "entry"
    }
  | {
      depth: number
      folder: FileSystemEntry
      id: string
      kind: "loading"
    }
  | {
      depth: number
      error: string
      folder: FileSystemEntry
      id: string
      kind: "error"
    }

const LIST_ROW_HEIGHT = 34
const LIST_COLUMNS =
  "grid-cols-[minmax(13rem,1fr)_minmax(7rem,9rem)_minmax(5rem,7rem)_minmax(8rem,11rem)]"

export function FileSystemListView({
  controller,
}: {
  controller: FileSystemBrowserController
}) {
  const { browser, fileActions } = controller
  const [expandedPaths, setExpandedPaths] = React.useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [focusedPath, setFocusedPath] = React.useState<string | null>(
    browser.selectedPath
  )
  const parentRef = React.useRef<HTMLDivElement | null>(null)
  const rows = React.useMemo(
    () =>
      createFileSystemListRows({
        currentPath: browser.currentPath,
        expandedPaths,
        folderErrors: browser.folderErrors,
        index: browser.index,
        isSearching: browser.query.search.trim().length > 0,
        loadingFolders: browser.loadingFolders,
      }),
    [
      browser.currentPath,
      browser.folderErrors,
      browser.index,
      browser.loadingFolders,
      browser.query.search,
      expandedPaths,
    ]
  )
  const virtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => LIST_ROW_HEIGHT,
    getScrollElement: () => parentRef.current,
    initialRect: { height: 560, width: 720 },
    overscan: 12,
  })
  const virtualRows = virtualizer.getVirtualItems()
  const renderedRows =
    virtualRows.length > 0
      ? virtualRows
      : rows.slice(0, 32).map((row, index) => ({
          index,
          key: row.id,
          size: LIST_ROW_HEIGHT,
          start: index * LIST_ROW_HEIGHT,
        }))
  const totalSize = Math.max(
    virtualizer.getTotalSize(),
    rows.length * LIST_ROW_HEIGHT
  )
  const entryRows = React.useMemo(
    () =>
      rows.filter(
        (row): row is Extract<FileSystemListRow, { kind: "entry" }> =>
          row.kind === "entry"
      ),
    [rows]
  )
  const focusedIndex = entryRows.findIndex(
    (row) => row.entry.path === (focusedPath ?? browser.selectedPath)
  )

  React.useEffect(() => {
    setFocusedPath(browser.selectedPath)
  }, [browser.selectedPath])

  const toggleFolder = React.useCallback(
    (entry: FileSystemEntry, options?: { retry?: boolean }) => {
      if (entry.kind !== "folder") return

      if (expandedPaths.has(entry.path) && !options?.retry) {
        setExpandedPaths((current) => {
          const next = new Set(current)
          next.delete(entry.path)
          return next
        })
        return
      }

      setExpandedPaths((current) => new Set(current).add(entry.path))
      void browser.ensureChildren(entry.path, options).catch(() => {})
    },
    [browser, expandedPaths]
  )
  const selectEntry = React.useCallback(
    (entry: FileSystemEntry) => {
      setFocusedPath(entry.path)
      browser.selectEntry(entry)
    },
    [browser]
  )
  const openEntry = React.useCallback(
    (entry: FileSystemEntry) => {
      selectEntry(entry)

      if (entry.kind === "folder") {
        browser.navigateTo(entry.path)
        return
      }

      fileActions.openPreview(entry)
    },
    [browser, fileActions, selectEntry]
  )
  const focusEntryAt = React.useCallback(
    (index: number) => {
      const row = entryRows[Math.max(0, Math.min(index, entryRows.length - 1))]
      if (!row) return

      selectEntry(row.entry)
    },
    [entryRows, selectEntry]
  )
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!entryRows.length) return

      const currentIndex = focusedIndex >= 0 ? focusedIndex : 0
      const current = entryRows[currentIndex]?.entry

      if (event.key === "ArrowDown") {
        focusEntryAt(currentIndex + 1)
        event.preventDefault()
        return
      }
      if (event.key === "ArrowUp") {
        focusEntryAt(currentIndex - 1)
        event.preventDefault()
        return
      }
      if (event.key === "Enter" && current) {
        openEntry(current)
        event.preventDefault()
        return
      }
      if (event.key === "ArrowRight" && current?.kind === "folder") {
        if (!expandedPaths.has(current.path)) {
          toggleFolder(current)
        } else {
          browser.navigateTo(current.path)
        }
        event.preventDefault()
        return
      }
      if (event.key === "ArrowLeft" && current?.kind === "folder") {
        if (expandedPaths.has(current.path)) {
          toggleFolder(current)
          event.preventDefault()
        }
      }
    },
    [
      browser,
      entryRows,
      expandedPaths,
      focusEntryAt,
      focusedIndex,
      openEntry,
      toggleFolder,
    ]
  )

  if (!browser.entries.length) {
    return <FileSystemEmptyRows label="This folder is empty" />
  }

  return (
    <div
      className="flex size-full min-h-0 flex-col bg-background"
      data-slot="file-system-list-view"
    >
      <div
        className={cn(
          "grid h-9 shrink-0 items-center border-b bg-muted/35 px-3 text-xs font-medium text-muted-foreground",
          LIST_COLUMNS
        )}
      >
        <div>Name</div>
        <div>Type</div>
        <div className="text-right">Size</div>
        <div>Modified</div>
      </div>
      <div
        ref={parentRef}
        role="tree"
        aria-label="Files"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="min-h-0 flex-1 overflow-auto outline-none"
      >
        <div className="relative min-w-[42rem]" style={{ height: totalSize }}>
          {renderedRows.map((virtualRow) => {
            const row = rows[virtualRow.index]
            if (!row) return null

            return (
              <div
                key={row.id}
                className="absolute inset-x-0 top-0"
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.kind === "entry" ? (
                  <FileSystemListEntryRow
                    depth={row.depth}
                    entry={row.entry}
                    hasError={browser.folderErrors.has(row.entry.path)}
                    isExpanded={row.isExpanded}
                    isFocused={row.entry.path === focusedPath}
                    isSelected={row.entry.path === browser.selectedPath}
                    onOpen={openEntry}
                    onSelect={selectEntry}
                    onToggle={toggleFolder}
                  />
                ) : row.kind === "loading" ? (
                  <FileSystemListMessageRow depth={row.depth} label="Loading" />
                ) : (
                  <FileSystemListErrorRow
                    depth={row.depth}
                    error={row.error}
                    folder={row.folder}
                    onRetry={toggleFolder}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function FileSystemListEntryRow({
  depth,
  entry,
  hasError,
  isExpanded,
  isFocused,
  isSelected,
  onOpen,
  onSelect,
  onToggle,
}: {
  depth: number
  entry: FileSystemEntry
  hasError: boolean
  isExpanded: boolean
  isFocused: boolean
  isSelected: boolean
  onOpen: (entry: FileSystemEntry) => void
  onSelect: (entry: FileSystemEntry) => void
  onToggle: (entry: FileSystemEntry, options?: { retry?: boolean }) => void
}) {
  return (
    <div
      role="treeitem"
      aria-expanded={entry.kind === "folder" ? isExpanded : undefined}
      aria-label={entry.name}
      aria-level={depth + 1}
      aria-selected={isSelected}
      data-path={entry.path}
      onClick={() => {
        onSelect(entry)
        if (entry.kind !== "folder") return
        if (hasError) {
          onToggle(entry, { retry: true })
          return
        }
        if (!isExpanded) onToggle(entry)
      }}
      onDoubleClick={() => onOpen(entry)}
      className={cn(
        "grid h-8 cursor-default items-center gap-3 px-3 text-sm outline-none",
        LIST_COLUMNS,
        isSelected
          ? "bg-primary text-primary-foreground"
          : isFocused
            ? "bg-accent"
            : "hover:bg-accent/50"
      )}
    >
      <div
        className="flex min-w-0 items-center gap-1.5"
        style={{ paddingLeft: `${depth * 1.125}rem` }}
      >
        {entry.kind === "folder" ? (
          <button
            type="button"
            aria-label={
              isExpanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`
            }
            onClick={(event) => {
              event.stopPropagation()
              onToggle(entry)
            }}
            className="flex size-5 shrink-0 items-center justify-center rounded-sm hover:bg-background/70 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isExpanded ? (
              <ChevronDown className="size-3.5" aria-hidden />
            ) : (
              <ChevronRight className="size-3.5" aria-hidden />
            )}
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}
        {entry.kind === "folder" ? (
          <Folder
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        ) : (
          <File className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="min-w-0 truncate">{entry.name}</span>
      </div>
      <div className="truncate text-muted-foreground">
        {entryKindLabel(entry)}
      </div>
      <div className="truncate text-right text-muted-foreground">
        {entry.kind === "file" ? formatFileSystemSize(entry.size) : ""}
      </div>
      <div className="truncate text-muted-foreground">
        {formatFileSystemDate(entry.updatedAt ?? entry.createdAt)}
      </div>
    </div>
  )
}

function FileSystemListMessageRow({
  depth,
  label,
}: {
  depth: number
  label: string
}) {
  return (
    <div
      className={cn(
        "grid h-8 items-center gap-3 px-3 text-sm text-muted-foreground",
        LIST_COLUMNS
      )}
    >
      <div style={{ paddingLeft: `${(depth + 1) * 1.125}rem` }}>{label}</div>
      <div />
      <div />
      <div />
    </div>
  )
}

function FileSystemListErrorRow({
  depth,
  error,
  folder,
  onRetry,
}: {
  depth: number
  error: string
  folder: FileSystemEntry
  onRetry: (entry: FileSystemEntry, options?: { retry?: boolean }) => void
}) {
  return (
    <div
      className={cn(
        "grid h-8 items-center gap-3 px-3 text-sm text-destructive",
        LIST_COLUMNS
      )}
    >
      <div
        className="flex min-w-0 items-center gap-2"
        style={{ paddingLeft: `${(depth + 1) * 1.125}rem` }}
      >
        <AlertCircle className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{error}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-2"
          onClick={() => onRetry(folder, { retry: true })}
        >
          Retry
        </Button>
      </div>
      <div />
      <div />
      <div />
    </div>
  )
}

function createFileSystemListRows({
  currentPath,
  expandedPaths,
  folderErrors,
  index,
  isSearching,
  loadingFolders,
}: {
  currentPath: string
  expandedPaths: ReadonlySet<string>
  folderErrors: ReadonlyMap<string, string>
  index: { children: Map<string, FileSystemEntry[]> }
  isSearching: boolean
  loadingFolders: ReadonlySet<string>
}): FileSystemListRow[] {
  const rows: FileSystemListRow[] = []
  const appendChildren = (path: string, depth: number) => {
    const children = index.children.get(path) ?? []

    for (const entry of children) {
      const hasVisibleFolderState =
        entry.kind === "folder" &&
        (loadingFolders.has(entry.path) || folderErrors.has(entry.path))
      const isExpanded =
        entry.kind === "folder" &&
        (isSearching || expandedPaths.has(entry.path) || hasVisibleFolderState)

      rows.push({
        depth,
        entry,
        id: `entry:${entry.path}`,
        isExpanded,
        kind: "entry",
      })

      if (entry.kind !== "folder" || !isExpanded) continue

      if (loadingFolders.has(entry.path)) {
        rows.push({
          depth,
          folder: entry,
          id: `loading:${entry.path}`,
          kind: "loading",
        })
      }

      const error = folderErrors.get(entry.path)
      if (error) {
        rows.push({
          depth,
          error,
          folder: entry,
          id: `error:${entry.path}`,
          kind: "error",
        })
      }

      appendChildren(entry.path, depth + 1)
    }
  }

  appendChildren(currentPath, 0)
  return rows
}

export function FileSystemEmptyRows({ label }: { label: string }) {
  return (
    <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}
