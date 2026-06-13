"use client"

import * as React from "react"
import {
  FileTree as PierreFileTreeModel,
  type FileTreeDirectoryHandle,
  type FileTreeItemHandle,
  type FileTreeRowDecoration,
} from "@pierre/trees"
import { FileTree as PierreFileTree } from "@pierre/trees/react"

import { cn } from "@/lib/utils"

import type { FileSystemController } from "./file-system-controller"
import {
  buildFileSystemPierreListInput,
  fileSystemPathToPierrePath,
  fileSystemPierrePathToEntry,
} from "./file-system-pierre-list-adapter"
import { entryKindLabel, fileSystemFilterIsEmpty } from "./file-system-query"
import type {
  FileSystemEntry,
  FileSystemFileEntry,
  FileSystemSortKey,
} from "./file-system-types"
import { formatFileSystemSize } from "./file-system-utils"

const ROW_HEIGHT = 36
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

export function FileSystemListView({
  controller,
  onOpenFile,
}: {
  controller: FileSystemController
  onOpenFile: (file: FileSystemFileEntry) => void
}) {
  const { currentPath, index } = controller
  const { paths, pathEntries } = React.useMemo(
    () => buildFileSystemPierreListInput(index, currentPath),
    [currentPath, index]
  )
  const expansionByCurrentPathRef = React.useRef(
    new Map<string, FileSystemPierreExpansionSnapshot>()
  )

  const hasQuery =
    controller.query.search.length > 0 ||
    !fileSystemFilterIsEmpty(controller.query.filters)
  const selectedPath = controller.selectedPath
    ? fileSystemPathToPierrePath(controller.selectedPath, currentPath)
    : null
  const selectedPaths = React.useMemo(
    () => (selectedPath && pathEntries.has(selectedPath) ? [selectedPath] : []),
    [pathEntries, selectedPath]
  )
  const getState = useLatestFileSystemListState(
    React.useMemo(
      () => ({ controller, pathEntries }),
      [controller, pathEntries]
    )
  )
  // Pierre exposes no decoration-only invalidation, so loading/error rows revise the model.
  const modelDecorationRevision = React.useMemo(
    () =>
      [
        [...controller.loadingFolders].sort().join("|"),
        [...controller.folderErrors].sort(([left], [right]) =>
          left.localeCompare(right)
        ),
      ].join("::"),
    [controller.folderErrors, controller.loadingFolders]
  )
  const pierreModelInput = React.useMemo(
    () => ({ hasQuery, modelDecorationRevision, paths }),
    [hasQuery, modelDecorationRevision, paths]
  )

  const model = React.useMemo(
    () =>
      new PierreFileTreeModel({
        flattenEmptyDirectories: false,
        icons: "complete",
        initialExpansion: pierreModelInput.hasQuery ? "open" : "closed",
        itemHeight: ROW_HEIGHT,
        onSelectionChange: (nextSelectedPaths) => {
          const path = nextSelectedPaths.at(-1) ?? null
          const state = getState()
          const entry = fileSystemPierrePathToEntry(path, state.pathEntries)

          state.controller.selectEntry(entry)
          if (entry?.kind === "folder") {
            void state.controller.ensureChildren(entry.path)
          }
        },
        overscan: 12,
        paths: pierreModelInput.paths,
        renderRowDecoration: ({ item }) => {
          const state = getState()
          const entry = fileSystemPierrePathToEntry(
            item.path,
            state.pathEntries
          )

          return entry ? fileSystemRowDecoration(entry, state.controller) : null
        },
        search: false,
        stickyFolders: false,
        unsafeCSS: FILE_TREE_CSS,
      }),
    [getState, pierreModelInput]
  )

  useIsomorphicLayoutEffect(() => {
    if (hasQuery) return

    const snapshot = expansionByCurrentPathRef.current.get(currentPath)

    if (snapshot && !snapshot.wasQueryActive) {
      restoreOpenPierrePaths(model, snapshot.openPaths)
    }
  }, [currentPath, hasQuery, model])
  React.useEffect(
    () => () => {
      const openPaths = collectOpenPierrePaths(model, paths)
      const previousSnapshot =
        expansionByCurrentPathRef.current.get(currentPath)

      if (!hasQuery || !previousSnapshot || previousSnapshot.wasQueryActive) {
        expansionByCurrentPathRef.current.set(currentPath, {
          openPaths,
          wasQueryActive: hasQuery,
        })
      }
      model.cleanUp()
    },
    [currentPath, hasQuery, model, paths]
  )
  React.useEffect(() => {
    const selectedPathSet = new Set(selectedPaths)

    for (const path of model.getSelectedPaths()) {
      if (!selectedPathSet.has(path)) model.getItem(path)?.deselect()
    }
    for (const path of selectedPaths) {
      if (!model.getSelectedPaths().includes(path)) {
        model.getItem(path)?.select()
      }
    }
  }, [model, selectedPaths])

  const openPierrePath = React.useCallback((path: string | null) => {
    if (!path) return
    const entry = fileSystemPierrePathToEntry(path, pathEntries)

    if (!entry) return
    if (entry.kind === "folder") {
      if (controller.folderErrors.has(entry.path)) {
        void controller.ensureChildren(entry.path, { retry: true })
      }
      controller.navigateTo(entry.path)
      return
    }

    onOpenFile(entry)
  }, [controller, onOpenFile, pathEntries])

  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      openPierrePath(pierrePathFromEvent(event))
    },
    [openPierrePath]
  )

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter") return

      openPierrePath(
        model.getFocusedPath() ?? model.getSelectedPaths().at(-1) ?? null
      )
      event.preventDefault()
    },
    [model, openPierrePath]
  )

  if (!paths.length) {
    return <FileSystemEmptyRows label="This folder is empty" />
  }

  return (
    <div className="flex size-full flex-col">
      <div className="grid h-9 shrink-0 grid-cols-[minmax(16rem,1fr)_9rem] items-center border-b bg-muted/30 px-3 text-xs font-medium text-muted-foreground">
        <SortHeader controller={controller} label="Name" sortKey="name" />
        <SortHeader controller={controller} label="Type" sortKey="kind" />
      </div>
      <div className="min-h-0 flex-1">
        <PierreFileTree
          aria-label="Files"
          className="block size-full"
          data-slot="file-system-pierre-tree"
          model={model}
          onDoubleClick={handleDoubleClick}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  )
}

type FileSystemListState = {
  controller: FileSystemController
  pathEntries: Map<string, FileSystemEntry>
}

type FileSystemPierreExpansionSnapshot = {
  openPaths: string[]
  wasQueryActive: boolean
}

function useLatestFileSystemListState(state: FileSystemListState) {
  const stateRef = React.useRef(state)

  useIsomorphicLayoutEffect(() => {
    stateRef.current = state
  }, [state])

  return React.useCallback(() => stateRef.current, [])
}

function pierrePathFromEvent(event: React.SyntheticEvent<HTMLElement>) {
  for (const target of event.nativeEvent.composedPath()) {
    if (
      target instanceof HTMLElement &&
      target.dataset.type === "item" &&
      target.dataset.itemPath
    ) {
      return target.dataset.itemPath
    }
  }

  return null
}

function collectOpenPierrePaths(
  model: PierreFileTreeModel,
  paths: readonly string[]
) {
  return paths.filter((path) => {
    const item = model.getItem(path)

    return isPierreDirectoryItem(item) && item.isExpanded()
  })
}

function restoreOpenPierrePaths(
  model: PierreFileTreeModel,
  openPaths: readonly string[]
) {
  for (const path of openPaths) {
    const item = model.getItem(path)

    if (isPierreDirectoryItem(item) && !item.isExpanded()) item.expand()
  }
}

function isPierreDirectoryItem(
  item: FileTreeItemHandle | null
): item is FileTreeDirectoryHandle {
  return item?.isDirectory() === true
}

function fileSystemRowDecoration(
  entry: FileSystemEntry,
  controller: FileSystemController
): FileTreeRowDecoration {
  if (entry.kind === "folder") {
    const loading = controller.loadingFolders.has(entry.path)
    const error = controller.folderErrors.get(entry.path)

    if (loading) return { text: "Loading" }
    if (error) return { text: error, title: error }
    return { text: "Folder" }
  }

  const size = formatFileSystemSize(entry.size)
  const type = entryKindLabel(entry)

  return { text: size ? `${type} · ${size}` : type }
}

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

const FILE_TREE_CSS = `
  :host {
    --trees-bg-override: transparent;
    --trees-fg-override: var(--foreground);
    --trees-fg-muted-override: var(--muted-foreground);
    --trees-bg-muted-override: var(--accent);
    --trees-border-color-override: transparent;
    --trees-focus-ring-color-override: var(--ring);
    --trees-selected-bg-override: var(--primary);
    --trees-selected-fg-override: var(--primary-foreground);
    --trees-font-family-override: inherit;
    --trees-font-size-override: 0.875rem;
    --trees-item-height: ${ROW_HEIGHT}px;
    --trees-item-padding-x-override: 0.75rem;
    --trees-item-margin-x-override: 0;
    --trees-padding-inline-override: 0;
    --trees-border-radius-override: 0;
  }
`
