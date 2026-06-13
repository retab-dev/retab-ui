import { normalizeFolderPath } from "./file-system-index"
import type { FileSystemEntry, FileSystemIndex } from "./file-system-types"

export type FileSystemPierreListInput = {
  paths: string[]
  pathEntries: Map<string, FileSystemEntry>
}

export function buildFileSystemPierreListInput(
  index: FileSystemIndex,
  currentPath: string
): FileSystemPierreListInput {
  const paths: string[] = []
  const pathEntries = new Map<string, FileSystemEntry>()

  const walk = (parentPath: string) => {
    for (const entry of index.children.get(parentPath) ?? []) {
      const path = fileSystemPathToPierrePath(entry.path, currentPath)

      if (!path) continue
      paths.push(path)
      pathEntries.set(path, entry)

      if (entry.kind === "folder") walk(entry.path)
    }
  }

  walk(normalizeFolderPath(currentPath))

  return { pathEntries, paths }
}

export function fileSystemPathToPierrePath(
  path: string,
  currentPath: string
): string {
  const normalizedCurrentPath = normalizeFolderPath(currentPath)
  const normalizedPath = path.endsWith("/") ? normalizeFolderPath(path) : path

  if (!normalizedCurrentPath) return normalizedPath
  return normalizedPath.startsWith(normalizedCurrentPath)
    ? normalizedPath.slice(normalizedCurrentPath.length)
    : ""
}

export function fileSystemPierrePathToEntry(
  path: string | null,
  pathEntries: ReadonlyMap<string, FileSystemEntry>
): FileSystemEntry | null {
  if (!path) return null
  return pathEntries.get(path) ?? null
}
