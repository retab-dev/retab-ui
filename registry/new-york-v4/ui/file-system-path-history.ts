"use client"

import * as React from "react"

import { normalizeFolderPath } from "./file-system-index"
import type { FileSystemProps } from "./file-system-types"

export type FileSystemPathHistoryController = {
  canGoBack: boolean
  canGoForward: boolean
  currentPath: string
  goBackPath: () => string
  goForwardPath: () => string
  setCurrentPath: (path: string, options?: { replace?: boolean }) => string
}

export function useFileSystemPathHistory({
  defaultPath = "",
  onPathChange,
  path: pathProp,
}: Pick<
  FileSystemProps,
  "defaultPath" | "onPathChange" | "path"
>): FileSystemPathHistoryController {
  const [history, setHistory] = React.useState(() => ({
    index: 0,
    stack: [normalizeFolderPath(defaultPath)],
  }))
  const isPathControlled = pathProp !== undefined
  const currentPath = isPathControlled
    ? normalizeFolderPath(pathProp)
    : (history.stack[history.index] ?? "")

  const setCurrentPath = React.useCallback(
    (path: string, { replace = false }: { replace?: boolean } = {}) => {
      const folderPath = normalizeFolderPath(path)

      setHistory((previous) => {
        const currentHistoryPath = previous.stack[previous.index] ?? ""

        if (currentHistoryPath === folderPath) return previous
        if (replace) {
          const stack = [...previous.stack]

          stack[previous.index] = folderPath
          return { ...previous, stack }
        }

        const stack = [
          ...previous.stack.slice(0, previous.index + 1),
          folderPath,
        ]

        return { index: stack.length - 1, stack }
      })
      onPathChange?.(folderPath)
      return folderPath
    },
    [onPathChange]
  )

  const goBackPath = React.useCallback(() => {
    const nextIndex = Math.max(0, history.index - 1)
    const nextPath = history.stack[nextIndex] ?? ""

    setHistory((previous) => ({ ...previous, index: nextIndex }))
    onPathChange?.(nextPath)
    return nextPath
  }, [history.index, history.stack, onPathChange])

  const goForwardPath = React.useCallback(() => {
    const nextIndex = Math.min(history.stack.length - 1, history.index + 1)
    const nextPath = history.stack[nextIndex] ?? ""

    setHistory((previous) => ({ ...previous, index: nextIndex }))
    onPathChange?.(nextPath)
    return nextPath
  }, [history.index, history.stack, onPathChange])

  return {
    canGoBack: history.index > 0,
    canGoForward: history.index < history.stack.length - 1,
    currentPath,
    goBackPath,
    goForwardPath,
    setCurrentPath,
  }
}
