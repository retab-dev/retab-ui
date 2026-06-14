import {
  preparePresortedFileTreeInput,
  type FileTreePreparedInput,
} from "@pierre/trees"

import { normalizeFolderPath } from "./file-system-index"
import type { FileSystemEntry, FileSystemIndex } from "./file-system-types"

export type FileSystemPath = string
export type PierrePath = string

export type FileSystemPierreInput = {
  entriesByPierrePath: Map<PierrePath, FileSystemEntry>
  pierrePaths: PierrePath[]
  preparedInput: FileTreePreparedInput
}

export function buildFileSystemPierreInput({
  currentPath,
  index,
}: {
  currentPath: FileSystemPath
  index: FileSystemIndex
}): FileSystemPierreInput {
  const entriesByPierrePath = new Map<PierrePath, FileSystemEntry>()
  const pierrePaths: PierrePath[] = []

  walk(currentPath)

  return {
    entriesByPierrePath,
    pierrePaths,
    preparedInput: preparePresortedFileTreeInput(pierrePaths),
  }

  function walk(directoryPath: FileSystemPath) {
    const entries = index.children.get(directoryPath) ?? []
    for (const entry of entries) {
      const pierrePath = fileSystemPathToPierrePath(entry.path, currentPath)

      if (!pierrePath) {
        continue
      }

      entriesByPierrePath.set(pierrePath, entry)
      pierrePaths.push(pierrePath)

      if (entry.kind === "folder") {
        walk(entry.path)
      }
    }
  }
}

export function fileSystemPathToPierrePath(
  path: FileSystemPath,
  currentPath: FileSystemPath
): PierrePath | null {
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

export function pierrePathToFileSystemEntry(
  path: PierrePath | null | undefined,
  input: FileSystemPierreInput
): FileSystemEntry | null {
  if (!path) {
    return null
  }

  return (
    input.entriesByPierrePath.get(path) ??
    input.entriesByPierrePath.get(`${path}/`) ??
    (path.endsWith("/")
      ? input.entriesByPierrePath.get(path.slice(0, -1))
      : null) ??
    null
  )
}
