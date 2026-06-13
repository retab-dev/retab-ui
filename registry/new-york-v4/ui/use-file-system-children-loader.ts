"use client"

import * as React from "react"

import { buildFileSystemIndex, normalizeFolderPath } from "./file-system-index"
import { deriveVisibleIndex } from "./file-system-query"
import type {
  FileSystemEntry,
  FileSystemIndex,
  FileSystemItem,
  FileSystemProps,
  FileSystemQueryState,
} from "./file-system-types"

type UseFileSystemChildrenLoaderArgs = {
  allItems: readonly FileSystemItem[]
  currentPath: string
  loadChildren: FileSystemProps["loadChildren"]
  query: FileSystemQueryState
  rawIndex: FileSystemIndex
  setLoadedItems: React.Dispatch<React.SetStateAction<FileSystemItem[]>>
  visibleIndex: FileSystemIndex
}

export function useFileSystemChildrenLoader({
  allItems,
  currentPath,
  loadChildren,
  query,
  rawIndex,
  setLoadedItems,
  visibleIndex,
}: UseFileSystemChildrenLoaderArgs) {
  const [loadingFolders, setLoadingFolders] = React.useState<Set<string>>(
    () => new Set()
  )
  const [folderErrors, setFolderErrors] = React.useState(
    new Map<string, string>()
  )
  const folderRequests = React.useRef(new Map<string, AbortController>())
  const folderPromises = React.useRef(
    new Map<string, Promise<FileSystemEntry[]>>()
  )

  React.useEffect(() => {
    const requests = folderRequests.current

    return () => {
      for (const controller of requests.values()) {
        controller.abort()
      }
    }
  }, [])

  const ensureChildren = React.useCallback(
    async (path: string, { retry = false }: { retry?: boolean } = {}) => {
      const folderPath = normalizeFolderPath(path)
      const folder = rawIndex.folders.get(folderPath)
      const rawChildren = rawIndex.children.get(folderPath) ?? []
      const currentChildren = visibleIndex.children.get(folderPath) ?? []

      if (!loadChildren || !folder?.hasChildren) return currentChildren
      if (!retry && rawChildren.length > 0) return currentChildren
      if (!retry && folderPromises.current.has(folderPath)) {
        return folderPromises.current.get(folderPath)!
      }

      const controller = new AbortController()
      const loadPromise = (async () => {
        folderRequests.current.set(folderPath, controller)
        setLoadingFolders((previous) => new Set(previous).add(folderPath))
        setFolderErrors((previous) => {
          const next = new Map(previous)

          next.delete(folderPath)
          return next
        })

        try {
          let cursor: string | null = null
          const nextItems: FileSystemItem[] = []

          do {
            const result = await loadChildren({
              cursor,
              path: folderPath,
              signal: controller.signal,
            })

            nextItems.push(...result.items)
            cursor = result.nextCursor ?? null
          } while (cursor && !controller.signal.aborted)

          if (controller.signal.aborted) return currentChildren
          if (!nextItems.length) return currentChildren

          const nextRawIndex = buildFileSystemIndex([...allItems, ...nextItems])
          const nextVisibleIndex = deriveVisibleIndex(
            nextRawIndex,
            currentPath,
            query
          )

          setLoadedItems((previous) => [...previous, ...nextItems])
          return nextVisibleIndex.children.get(folderPath) ?? []
        } catch (error) {
          if (!controller.signal.aborted) {
            setFolderErrors((previous) =>
              new Map(previous).set(folderPath, errorMessage(error))
            )
          }
          return currentChildren
        } finally {
          folderRequests.current.delete(folderPath)
          folderPromises.current.delete(folderPath)
          setLoadingFolders((previous) => {
            const next = new Set(previous)

            next.delete(folderPath)
            return next
          })
        }
      })()

      folderPromises.current.set(folderPath, loadPromise)
      return loadPromise
    },
    [
      allItems,
      currentPath,
      loadChildren,
      query,
      rawIndex.children,
      rawIndex.folders,
      setLoadedItems,
      visibleIndex.children,
    ]
  )

  return { ensureChildren, folderErrors, loadingFolders }
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Couldn't load this folder."
}
