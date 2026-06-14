import {
  preparePresortedFileTreeInput,
  type FileTreePreparedInput,
} from "@pierre/trees"

import { normalizeFolderPath } from "./file-system-index"
import type { FileSystemEntry, FileSystemIndex } from "./file-system-types"

export type FileSystemPierreInput = {
  pathEntries: Map<string, FileSystemEntry>
  paths: string[]
  preparedInput: FileTreePreparedInput
  revision: string
}

export function buildFileSystemPierreInput({
  currentPath,
  index,
  revision = "",
}: {
  currentPath: string
  index: FileSystemIndex
  revision?: string
}): FileSystemPierreInput {
  const pathEntries = new Map<string, FileSystemEntry>()
  const paths: string[] = []

  walk(currentPath)

  return {
    pathEntries,
    paths,
    preparedInput: preparePresortedFileTreeInput(paths),
    revision,
  }

  function walk(directoryPath: string) {
    const entries = index.children.get(directoryPath) ?? []
    for (const entry of entries) {
      const pierrePath = toPierrePath(entry.path, currentPath)

      if (!pierrePath) {
        continue
      }

      pathEntries.set(pierrePath, entry)
      paths.push(pierrePath)

      if (entry.kind === "folder") {
        walk(entry.path)
      }
    }
  }
}

export function toPierrePath(path: string, currentPath: string): string | null {
  const normalizedCurrentPath = normalizeFolderPath(currentPath)
  const normalizedPath = path.endsWith("/") ? normalizeFolderPath(path) : path

  if (normalizedPath === normalizedCurrentPath) {
    return null
  }

  if (normalizedCurrentPath === "/") {
    return normalizedPath.startsWith("/")
      ? normalizedPath.slice(1)
      : normalizedPath
  }

  if (!normalizedPath.startsWith(normalizedCurrentPath)) {
    return null
  }

  return normalizedPath.slice(normalizedCurrentPath.length)
}

export function fromPierrePath(
  path: string | null | undefined,
  input: FileSystemPierreInput
): FileSystemEntry | null {
  if (!path) {
    return null
  }

  return (
    input.pathEntries.get(path) ??
    input.pathEntries.get(`${path}/`) ??
    (path.endsWith("/") ? input.pathEntries.get(path.slice(0, -1)) : null) ??
    null
  )
}
