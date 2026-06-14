"use client"

import * as React from "react"

import type { FileSystemDispatch } from "./file-system-kernel-selectors"
import type {
  FileSystemQueryState,
  FileSystemView,
} from "./file-system-types"

export function useFileSystemControlledProps({
  dispatch,
  path,
  query,
  selectedPath,
  view,
}: {
  dispatch: FileSystemDispatch
  path?: string
  query?: FileSystemQueryState
  selectedPath?: string | null
  view?: FileSystemView
}) {
  React.useEffect(() => {
    if (path !== undefined) {
      dispatch({ path, source: "controlled-prop", type: "path.changed" })
    }
  }, [dispatch, path])

  React.useEffect(() => {
    if (query !== undefined) {
      dispatch({ query, source: "controlled-prop", type: "query.changed" })
    }
  }, [dispatch, query])

  React.useEffect(() => {
    if (view !== undefined) {
      dispatch({ source: "controlled-prop", type: "view.changed", view })
    }
  }, [dispatch, view])

  React.useEffect(() => {
    if (selectedPath !== undefined) {
      dispatch({
        path: selectedPath,
        source: "controlled-prop",
        type: "entry.selected",
      })
    }
  }, [dispatch, selectedPath])
}
