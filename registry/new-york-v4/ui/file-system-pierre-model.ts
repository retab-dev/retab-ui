"use client"

import * as React from "react"
import { useFileTree } from "@pierre/trees/react"

import type {
  FileSystemPierreDecorationState,
  FileSystemPierreLoadingController,
  FileSystemPierreNavigationController,
  FileSystemPierreQueryState,
  FileSystemPierreSelectionController,
} from "./file-system-explorer-controllers"
import {
  FILE_SYSTEM_PIERRE_ROW_CSS,
  fileSystemPierreRowDecoration,
} from "./file-system-pierre-decoration"
import {
  useBindFileSystemPierreExpansionModel,
  useFileSystemPierreExpansion,
} from "./file-system-pierre-expansion"
import type { FileSystemPierreInput } from "./file-system-pierre-input"
import { createFileSystemPierreLazyFolderCommand } from "./file-system-pierre-lazy-retry"
import { useFileSystemPierreOrder } from "./file-system-pierre-order"
import { useResetFileSystemPierreModel } from "./file-system-pierre-reset"
import {
  useFileSystemPierreSelectionHandler,
  useLatestFileSystemPierreSelectionState,
  useSyncFileSystemPierreSelection,
} from "./file-system-pierre-selection"

export const FILE_SYSTEM_PIERRE_ROW_HEIGHT = 36

const INITIAL_VISIBLE_ROW_COUNT = 24
const useIsoLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

export function useFileSystemPierreModel({
  decoration,
  decorationVersion,
  input,
  loading,
  navigation,
  query,
  selection,
}: {
  decoration: FileSystemPierreDecorationState
  decorationVersion: string
  input: FileSystemPierreInput
  loading: FileSystemPierreLoadingController
  navigation: FileSystemPierreNavigationController
  query: FileSystemPierreQueryState
  selection: FileSystemPierreSelectionController
}) {
  const decorationRef = React.useRef(decoration)
  const loadingRef = React.useRef(loading)
  const hasSemanticQuery = query.search.length > 0
  const order = useFileSystemPierreOrder(input.pierrePaths)
  const expansion = useFileSystemPierreExpansion({ loading })
  const getLatestSelectionState = useLatestFileSystemPierreSelectionState({
    input,
    selection,
  })
  const handleSelectionChange = useFileSystemPierreSelectionHandler(
    getLatestSelectionState
  )

  useIsoLayoutEffect(() => {
    decorationRef.current = decoration
    loadingRef.current = loading
  }, [decoration, loading])

  const initialSelectedPaths = React.useMemo(() => {
    const selected = input.pierrePaths.find(
      (pierrePath) =>
        input.entriesByPierrePath.get(pierrePath)?.path ===
        selection.selectedPath
    )

    return selected ? [selected] : []
  }, [input, selection.selectedPath])

  const { model } = useFileTree({
    flattenEmptyDirectories: false,
    icons: { colored: false, set: "complete" },
    initialExpansion: hasSemanticQuery ? "open" : "closed",
    initialSelectedPaths,
    initialVisibleRowCount: INITIAL_VISIBLE_ROW_COUNT,
    itemHeight: FILE_SYSTEM_PIERRE_ROW_HEIGHT,
    onSelectionChange: (selectedPaths) => {
      const selected = handleSelectionChange(selectedPaths)
      const currentLoading = loadingRef.current
      const command = createFileSystemPierreLazyFolderCommand({
        folderErrors: currentLoading.folderErrors,
        selection: selected,
      })

      expansion.runLazyFolderCommand(command)
    },
    overscan: 12,
    preparedInput: input.preparedInput,
    renderRowDecoration: ({ item }) => {
      const { input } = getLatestSelectionState()
      const entry = input.entriesByPierrePath.get(item.path)

      return entry
        ? fileSystemPierreRowDecoration(entry, decorationRef.current)
        : null
    },
    search: false,
    sort: order.compare,
    stickyFolders: false,
    unsafeCSS: FILE_SYSTEM_PIERRE_ROW_CSS,
  })

  useResetFileSystemPierreModel({
    currentPath: navigation.currentPath,
    decorationVersion,
    expansion,
    hasSemanticQuery,
    input,
    model,
    order,
    selectedPath: selection.selectedPath,
  })
  useSyncFileSystemPierreSelection({ input, model, selection })
  useBindFileSystemPierreExpansionModel({ expansion, model })
  useRepaintFileSystemPierreDecoration({ decorationVersion, model })

  return { model }
}

function useRepaintFileSystemPierreDecoration({
  decorationVersion,
  model,
}: {
  decorationVersion: string
  model: ReturnType<typeof useFileTree>["model"]
}) {
  useIsoLayoutEffect(() => {
    if (!model.getFileTreeContainer()) {
      return
    }

    model.render({})
  }, [decorationVersion, model])
}
