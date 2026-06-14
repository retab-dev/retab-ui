import {
  type FileTreeDirectoryHandle,
  type FileTreeItemHandle,
  type FileTree as PierreFileTreeModel,
} from "@pierre/trees"

import type { PierrePath } from "./file-system-pierre-input"
import type { FileSystemPierreResetIdentity } from "./file-system-pierre-reset-identity"

export type FileSystemPierreExpansionSnapshot = {
  expandedPierrePaths: Set<PierrePath>
  mode: "normal" | "query"
}

export function rememberFileSystemPierreExpansionSnapshot({
  identity,
  model,
  snapshotsByCurrentPath,
}: {
  identity: FileSystemPierreResetIdentity
  model: PierreFileTreeModel
  snapshotsByCurrentPath: Map<string, FileSystemPierreExpansionSnapshot>
}) {
  const previous = snapshotsByCurrentPath.get(identity.currentPath)
  const mode = identity.hasSemanticQuery ? "query" : "normal"

  if (mode === "query" && previous?.mode === "normal") {
    return
  }

  snapshotsByCurrentPath.set(identity.currentPath, {
    expandedPierrePaths: new Set(
      collectOpenPierrePaths(model, identity.input.pierrePaths)
    ),
    mode,
  })
}

export function resolveFileSystemPierreExpansionAfterReset({
  identity,
  snapshotsByCurrentPath,
}: {
  identity: FileSystemPierreResetIdentity
  snapshotsByCurrentPath: ReadonlyMap<string, FileSystemPierreExpansionSnapshot>
}): PierrePath[] {
  if (identity.hasSemanticQuery) {
    return collectFileSystemPierreDirectoryPaths(identity.input.pierrePaths)
  }

  const snapshot = snapshotsByCurrentPath.get(identity.currentPath)

  return filterFileSystemPierreExpandedPaths({
    expandedPierrePaths: snapshot?.expandedPierrePaths ?? new Set(),
    nextPierrePaths: identity.input.pierrePaths,
  })
}

function collectOpenPierrePaths(
  model: PierreFileTreeModel,
  pierrePaths: readonly PierrePath[]
): PierrePath[] {
  const openPaths: PierrePath[] = []

  for (const path of pierrePaths) {
    const item = model.getItem(path)

    if (isDirectoryItem(item) && item.isExpanded()) {
      openPaths.push(path)
    }
  }

  return openPaths
}

export function collectFileSystemPierreDirectoryPaths(
  pierrePaths: readonly PierrePath[]
): PierrePath[] {
  return pierrePaths.filter((path) => path.endsWith("/"))
}

export function filterFileSystemPierreExpandedPaths({
  expandedPierrePaths,
  nextPierrePaths,
}: {
  expandedPierrePaths: ReadonlySet<PierrePath>
  nextPierrePaths: readonly PierrePath[]
}): PierrePath[] {
  const nextPierrePathSet = new Set(nextPierrePaths)

  return [...expandedPierrePaths].filter((path) => nextPierrePathSet.has(path))
}

function isDirectoryItem(
  item: FileTreeItemHandle | null
): item is FileTreeDirectoryHandle {
  return item?.isDirectory() === true
}
