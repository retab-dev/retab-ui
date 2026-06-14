"use client"

import * as React from "react"

import type { FileSystemProps, FileSystemView } from "./file-system-types"

export type FileSystemViewController = {
  setView: (view: FileSystemView) => void
  view: FileSystemView
}

export function useFileSystemViewController({
  defaultView = "list",
  onViewChange,
  view: viewProp,
}: Pick<
  FileSystemProps,
  "defaultView" | "onViewChange" | "view"
>): FileSystemViewController {
  const [internalView, setInternalView] =
    React.useState<FileSystemView>(defaultView)
  const view = viewProp ?? internalView

  const setView = React.useCallback(
    (nextView: FileSystemView) => {
      setInternalView(nextView)
      onViewChange?.(nextView)
    },
    [onViewChange]
  )

  return { setView, view }
}
