"use client"

import * as React from "react"
import {
  type FileTreeDirectoryHandle,
  type FileTreeItemHandle,
  type FileTreeSortComparator,
  type FileTree as PierreFileTreeModel,
} from "@pierre/trees"
import { useFileTree } from "@pierre/trees/react"

import type { FileSystemController } from "./file-system-controller"
import {
  FILE_SYSTEM_PIERRE_ROW_CSS,
  fileSystemPierreRowDecoration,
} from "./file-system-pierre-decoration"
import {
  fromPierrePath,
  type FileSystemPierreInput,
} from "./file-system-pierre-input"
import { fileSystemFilterIsEmpty } from "./file-system-query"

export const FILE_SYSTEM_PIERRE_ROW_HEIGHT = 36
const INITIAL_VISIBLE_ROW_COUNT = 24
const useIsoLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

type FileSystemPierreState = {
  controller: FileSystemController
  input: FileSystemPierreInput
}

type OpenPathsSnapshot = {
  openPaths: Set<string>
  wasQueryActive: boolean
}

export function useFileSystemPierreModel({
  controller,
  input,
}: FileSystemPierreState) {
  const getState = useLatestFileSystemPierreState({ controller, input })
  const hasQuery =
    controller.query.search.length > 0 ||
    !fileSystemFilterIsEmpty(controller.query.filters)
  const inputOrderRef = React.useRef(createInputOrder(input.paths))
  const sortByCurrentInputOrder = React.useCallback<FileTreeSortComparator>(
    (left, right) =>
      compareInputOrder(inputOrderRef.current, left.path, right.path),
    []
  )
  const modelRef = React.useRef<PierreFileTreeModel | null>(null)
  const initialSelectedPaths = React.useMemo(() => {
    const selectedPierrePath = selectedPathToPierrePath(
      controller.selectedPath,
      input
    )

    return selectedPierrePath ? [selectedPierrePath] : []
  }, [controller.selectedPath, input])

  const { model } = useFileTree({
    flattenEmptyDirectories: false,
    icons: "complete",
    initialExpansion: hasQuery ? "open" : "closed",
    initialSelectedPaths,
    initialVisibleRowCount: INITIAL_VISIBLE_ROW_COUNT,
    itemHeight: FILE_SYSTEM_PIERRE_ROW_HEIGHT,
    onSelectionChange: ([path]) => {
      const { controller, input } = getState()
      const entry = fromPierrePath(path, input)

      if (!entry) {
        return
      }

      controller.selectEntry(entry)

      if (entry.kind === "folder") {
        const shouldRetry = controller.folderErrors.has(entry.path)
        const childrenPromise = controller.ensureChildren(
          entry.path,
          shouldRetry ? { retry: true } : undefined
        )

        if (shouldRetry) {
          void childrenPromise.then((children) => {
            if (children.length === 0) {
              return
            }
            const item = modelRef.current?.getItem(path) ?? null
            if (isDirectoryItem(item)) {
              item.expand()
            }
          })
        }
      }
    },
    overscan: 12,
    preparedInput: input.preparedInput,
    renderRowDecoration: ({ item }) => {
      const { controller, input } = getState()
      const entry = fromPierrePath(item.path, input)

      return entry ? fileSystemPierreRowDecoration(entry, controller) : null
    },
    search: false,
    sort: sortByCurrentInputOrder,
    stickyFolders: false,
    unsafeCSS: FILE_SYSTEM_PIERRE_ROW_CSS,
  })

  useResetFileSystemPierreModel({
    controller,
    hasQuery,
    input,
    inputOrderRef,
    model,
  })
  useSyncFileSystemPierreSelection({ controller, input, model })
  useIsoLayoutEffect(() => {
    modelRef.current = model
    return () => {
      if (modelRef.current === model) {
        modelRef.current = null
      }
    }
  }, [model])

  return { model }
}

function useResetFileSystemPierreModel({
  controller,
  hasQuery,
  input,
  inputOrderRef,
  model,
}: FileSystemPierreState & {
  hasQuery: boolean
  inputOrderRef: React.MutableRefObject<Map<string, number>>
  model: PierreFileTreeModel
}) {
  const appliedStateRef = React.useRef({
    currentPath: controller.currentPath,
    hasQuery,
    input,
    revision: input.revision,
  })
  const openPathsByCurrentPathRef = React.useRef(
    new Map<string, OpenPathsSnapshot>()
  )

  useIsoLayoutEffect(() => {
    const previousState = appliedStateRef.current

    if (
      previousState.input === input &&
      previousState.revision === input.revision
    ) {
      return
    }

    rememberOpenPaths(
      openPathsByCurrentPathRef.current,
      previousState.currentPath,
      collectOpenPierrePaths(model, previousState.input.paths),
      previousState.hasQuery
    )

    const snapshot = openPathsByCurrentPathRef.current.get(
      controller.currentPath
    )
    const openPaths = hasQuery
      ? collectDirectoryPaths(input.paths)
      : [...(snapshot?.openPaths ?? [])].filter((path) =>
          input.pathEntries.has(path)
        )

    appliedStateRef.current = {
      currentPath: controller.currentPath,
      hasQuery,
      input,
      revision: input.revision,
    }
    inputOrderRef.current = createInputOrder(input.paths)
    model.resetPaths(input.paths, {
      initialExpandedPaths: openPaths,
      preparedInput: input.preparedInput,
    })

    const selectedPierrePath = selectedPathToPierrePath(
      controller.selectedPath,
      input
    )

    if (selectedPierrePath) {
      model.getItem(selectedPierrePath)?.select()
    }
  }, [
    controller.currentPath,
    controller.selectedPath,
    hasQuery,
    input,
    inputOrderRef,
    model,
  ])
}

function useSyncFileSystemPierreSelection({
  controller,
  input,
  model,
}: FileSystemPierreState & {
  model: PierreFileTreeModel
}) {
  useIsoLayoutEffect(() => {
    const selectedPierrePath = selectedPathToPierrePath(
      controller.selectedPath,
      input
    )

    if (!selectedPierrePath) {
      return
    }

    const item = model.getItem(selectedPierrePath)

    if (!item || item.isSelected()) {
      return
    }

    item.select()
    model.scrollToPath(selectedPierrePath)
  }, [controller.selectedPath, input, model])
}

function useLatestFileSystemPierreState(state: FileSystemPierreState) {
  const stateRef = React.useRef(state)

  useIsoLayoutEffect(() => {
    stateRef.current = state
  })

  return React.useCallback(() => stateRef.current, [])
}

function selectedPathToPierrePath(
  selectedPath: string | null,
  input: FileSystemPierreInput
): string | null {
  if (!selectedPath) {
    return null
  }

  for (const [pierrePath, entry] of input.pathEntries.entries()) {
    if (entry.path === selectedPath) {
      return pierrePath
    }
  }

  return null
}

function collectOpenPierrePaths(
  model: PierreFileTreeModel,
  paths: readonly string[]
): string[] {
  const openPaths: string[] = []

  for (const path of paths) {
    const item = model.getItem(path)

    if (isDirectoryItem(item) && item.isExpanded()) {
      openPaths.push(path)
    }
  }

  return openPaths
}

function rememberOpenPaths(
  snapshots: Map<string, OpenPathsSnapshot>,
  currentPath: string,
  openPaths: readonly string[],
  wasQueryActive: boolean
) {
  const previous = snapshots.get(currentPath)

  if (wasQueryActive && previous && !previous.wasQueryActive) {
    return
  }

  snapshots.set(currentPath, {
    openPaths: new Set(openPaths),
    wasQueryActive,
  })
}

function collectDirectoryPaths(paths: readonly string[]): string[] {
  return paths.filter((path) => path.endsWith("/"))
}

function isDirectoryItem(
  item: FileTreeItemHandle | null
): item is FileTreeDirectoryHandle {
  return item?.isDirectory() === true
}

function createInputOrder(paths: readonly string[]): Map<string, number> {
  return new Map(paths.map((path, index) => [path, index]))
}

function compareInputOrder(
  order: ReadonlyMap<string, number>,
  leftPath: string,
  rightPath: string
) {
  const leftIndex = order.get(leftPath) ?? Number.MAX_SAFE_INTEGER
  const rightIndex = order.get(rightPath) ?? Number.MAX_SAFE_INTEGER

  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex
  }

  return leftPath.localeCompare(rightPath, undefined, {
    numeric: true,
    sensitivity: "base",
  })
}
