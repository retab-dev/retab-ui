"use client"

import * as React from "react"

import {
  createFileSystemQueryState,
  DEFAULT_FILE_SYSTEM_SORT,
} from "./file-system-query"
import type {
  FileSystemProps,
  FileSystemQueryState,
  FileSystemSortKey,
} from "./file-system-types"

export type FileSystemQueryController = {
  query: FileSystemQueryState
  setQuery: (
    updater:
      | FileSystemQueryState
      | ((previous: FileSystemQueryState) => FileSystemQueryState)
  ) => void
  setSearch: (search: string) => void
  setSortKey: (key: FileSystemSortKey) => void
}

export function useFileSystemQueryController({
  defaultQuery,
  onQueryChange,
  query: queryProp,
}: Pick<
  FileSystemProps,
  "defaultQuery" | "onQueryChange" | "query"
>): FileSystemQueryController {
  const defaultQueryState = React.useMemo(
    () => createFileSystemQueryState(defaultQuery),
    [defaultQuery]
  )
  const [internalQuery, setInternalQuery] =
    React.useState<FileSystemQueryState>(defaultQueryState)
  const query = queryProp ?? internalQuery
  const isQueryControlled = queryProp !== undefined

  const setQuery = React.useCallback<FileSystemQueryController["setQuery"]>(
    (updater) => {
      const nextQuery = typeof updater === "function" ? updater(query) : updater

      if (!isQueryControlled) setInternalQuery(nextQuery)
      onQueryChange?.(nextQuery)
    },
    [isQueryControlled, onQueryChange, query]
  )

  const setSearch = React.useCallback(
    (search: string) => {
      setQuery((previous) => ({ ...previous, search }))
    },
    [setQuery]
  )

  const setSortKey = React.useCallback(
    (key: FileSystemSortKey) => {
      setQuery((previous) => ({
        ...previous,
        sort:
          previous.sort.key === key
            ? {
                direction: previous.sort.direction === "asc" ? "desc" : "asc",
                key,
              }
            : {
                direction:
                  key === DEFAULT_FILE_SYSTEM_SORT.key || key === "kind"
                    ? DEFAULT_FILE_SYSTEM_SORT.direction
                    : "desc",
                key,
              },
      }))
    },
    [setQuery]
  )

  return { query, setQuery, setSearch, setSortKey }
}
