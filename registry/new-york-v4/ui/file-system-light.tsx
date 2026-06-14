"use client"

import * as React from "react"
import { FileTree as PierreFileTree, useFileTree } from "@pierre/trees/react"

import { cn } from "@/lib/utils"
import type { ViewerSource } from "@/lib/viewer-source"
import { FileViewer } from "@/components/ui/file-viewer"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer"

export type FileSystemLightFile = {
  path: string
  source: ViewerSource
}

export type FileSystemLightProps = {
  files: FileSystemLightFile[]
  className?: string
  defaultSelectedPath?: string | null
  onSelectedPathChange?: (path: string | null) => void
  selectedPath?: string | null
  title?: string
}

export function FileSystemLight({
  files,
  className,
  defaultSelectedPath = files[0]?.path ?? null,
  onSelectedPathChange,
  selectedPath: selectedPathProp,
  title = "Files",
}: FileSystemLightProps) {
  const normalizedFiles = React.useMemo(
    () =>
      files.map((file) => ({
        ...file,
        path: normalizeFileSystemLightPath(file.path),
      })),
    [files]
  )
  const paths = React.useMemo(
    () => normalizedFiles.map((file) => file.path),
    [normalizedFiles]
  )
  const filesByPath = React.useMemo(
    () => new Map(normalizedFiles.map((file) => [file.path, file])),
    [normalizedFiles]
  )
  const onSelectedPathChangeRef = React.useRef(onSelectedPathChange)
  const isSelectionControlledRef = React.useRef(selectedPathProp !== undefined)
  const initialSelectedPath =
    normalizeOptionalFileSystemLightPath(defaultSelectedPath)
  const [internalSelectedPath, setInternalSelectedPath] = React.useState<
    string | null
  >(() =>
    initialSelectedPath && filesByPath.has(initialSelectedPath)
      ? initialSelectedPath
      : (paths[0] ?? null)
  )
  const isSelectionControlled = selectedPathProp !== undefined
  const selectedPath = normalizeOptionalFileSystemLightPath(
    selectedPathProp ?? internalSelectedPath
  )
  const selectedFile = selectedPath ? filesByPath.get(selectedPath) : undefined

  React.useEffect(() => {
    onSelectedPathChangeRef.current = onSelectedPathChange
  }, [onSelectedPathChange])

  React.useEffect(() => {
    isSelectionControlledRef.current = isSelectionControlled
  }, [isSelectionControlled])

  const { model } = useFileTree({
    flattenEmptyDirectories: false,
    icons: "complete",
    initialExpansion: "open",
    initialSelectedPaths:
      selectedPath && filesByPath.has(selectedPath) ? [selectedPath] : [],
    itemHeight: 32,
    onSelectionChange: (selectedPaths) => {
      const nextPath = selectedPaths.at(-1) ?? null

      if (!isSelectionControlledRef.current) {
        setInternalSelectedPath(nextPath)
      }
      onSelectedPathChangeRef.current?.(nextPath)
    },
    overscan: 12,
    paths,
    search: false,
    stickyFolders: false,
  })

  React.useEffect(() => {
    model.resetPaths(paths)
  }, [model, paths])

  React.useEffect(() => {
    const selectedPathSet = new Set(
      selectedPath && filesByPath.has(selectedPath) ? [selectedPath] : []
    )

    for (const path of model.getSelectedPaths()) {
      if (!selectedPathSet.has(path)) model.getItem(path)?.deselect()
    }
    for (const path of selectedPathSet) {
      if (!model.getSelectedPaths().includes(path)) {
        model.getItem(path)?.select()
      }
    }
  }, [filesByPath, model, selectedPath])

  return (
    <ViewerRoot
      bare
      data-viewer="file-system-light"
      className={cn(
        "h-[640px] overflow-hidden rounded-lg border bg-background text-foreground",
        className
      )}
    >
      <ViewerHeader>
        <div className="flex h-12 min-w-0 items-center justify-between gap-3 px-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="truncate text-xs text-muted-foreground">
              {selectedPath ?? "/"}
            </div>
          </div>
          <div className="shrink-0 text-xs text-muted-foreground">
            {paths.length} files
          </div>
        </div>
      </ViewerHeader>
      <ViewerBody>
        <ViewerSidebar
          collapsible="none"
          width="20rem"
          className="flex min-h-0 flex-col border-r"
        >
          <PierreFileTree
            aria-label={title}
            className="block min-h-0 flex-1"
            model={model}
            style={
              {
                "--trees-bg-override": "transparent",
                "--trees-border-color-override": "transparent",
                "--trees-fg-override": "var(--foreground)",
                "--trees-fg-muted-override": "var(--muted-foreground)",
                "--trees-focus-ring-color-override": "var(--ring)",
                "--trees-focus-ring-width-override": "2px",
                "--trees-item-padding-x-override": "0.75rem",
                "--trees-selected-bg-override": "var(--primary)",
                "--trees-selected-fg-override": "var(--primary-foreground)",
              } as React.CSSProperties
            }
          />
        </ViewerSidebar>
        <ViewerSurface>
          {selectedFile ? (
            <FileViewer
              source={selectedFile.source}
              bare
              className="size-full min-h-0"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
              Select a file
            </div>
          )}
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  )
}

function normalizeFileSystemLightPath(path: string) {
  return path.replace(/^\/+/, "").replace(/\/+$/, "")
}

function normalizeOptionalFileSystemLightPath(path: string | null | undefined) {
  return path ? normalizeFileSystemLightPath(path) : null
}
