"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { ViewerSource } from "@/lib/viewer-source"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { FileViewer } from "@/components/ui/file-viewer"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer"

import { FileSystemLightTree } from "./file-system-light-tree"

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
  const selectedTreePaths = React.useMemo(
    () => (selectedPath && filesByPath.has(selectedPath) ? [selectedPath] : []),
    [filesByPath, selectedPath]
  )
  const selectedPathSegments = React.useMemo(
    () => getFileSystemLightPathSegments(selectedPath),
    [selectedPath]
  )

  React.useEffect(() => {
    onSelectedPathChangeRef.current = onSelectedPathChange
  }, [onSelectedPathChange])

  React.useEffect(() => {
    isSelectionControlledRef.current = isSelectionControlled
  }, [isSelectionControlled])

  return (
    <ViewerRoot
      data-viewer="file-system-light"
      className={cn(
        "h-[640px] overflow-hidden rounded-md border bg-background text-foreground",
        className
      )}
    >
      <ViewerHeader>
        <div className="flex h-12 min-w-0 items-center justify-between gap-3 px-3">
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="min-w-0 flex-nowrap gap-1 overflow-hidden text-sm sm:gap-1.5">
              {selectedPathSegments.map((segment, index) => {
                const isLast = index === selectedPathSegments.length - 1

                return (
                  <React.Fragment key={`${segment}-${index}`}>
                    <BreadcrumbItem
                      className={cn("min-w-0", !isLast && "shrink-0")}
                    >
                      {isLast ? (
                        <BreadcrumbPage className="truncate">
                          {segment}
                        </BreadcrumbPage>
                      ) : (
                        <span className="text-muted-foreground">{segment}</span>
                      )}
                    </BreadcrumbItem>
                    {!isLast ? <BreadcrumbSeparator /> : null}
                  </React.Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="shrink-0 text-xs text-muted-foreground">
            {paths.length} files
          </div>
        </div>
      </ViewerHeader>
      <ViewerBody>
        <ViewerSidebar
          aria-label={title}
          collapsible="none"
          width="20rem"
          className="flex min-h-0 flex-col border-r"
        >
          <FileSystemLightTree
            aria-label={title}
            className="block min-h-0 flex-1"
            onSelectedPathsChange={(selectedPaths) => {
              const nextPath = selectedPaths.at(-1) ?? null

              if (!isSelectionControlledRef.current) {
                setInternalSelectedPath(nextPath)
              }
              onSelectedPathChangeRef.current?.(nextPath)
            }}
            paths={paths}
            selectedPaths={selectedTreePaths}
            style={
              {
                "--trees-bg-override": "transparent",
                "--trees-border-color-override": "transparent",
                "--trees-fg-override": "var(--foreground)",
                "--trees-fg-muted-override": "var(--muted-foreground)",
                "--trees-focus-ring-color-override": "var(--ring)",
                "--trees-focus-ring-width-override": "2px",
                "--trees-item-padding-x-override": "0.75rem",
                "--trees-border-radius-override": "0.375rem",
                "--trees-file-icon-color": "var(--muted-foreground)",
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

function getFileSystemLightPathSegments(path: string | null) {
  return path ? path.split("/").filter(Boolean) : ["/"]
}
