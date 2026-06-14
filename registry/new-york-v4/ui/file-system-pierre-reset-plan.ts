import type { FileSystemPierreExpansionSnapshot } from "./file-system-pierre-expansion-snapshot"
import {
  collectFileSystemPierreDirectoryPaths,
  filterFileSystemPierreExpandedPaths,
} from "./file-system-pierre-expansion-snapshot"
import type { PierrePath } from "./file-system-pierre-input"
import type { FileSystemPierreResetTransition } from "./file-system-pierre-reset-identity"

export type FileSystemPierreResetPlan =
  | {
      kind: "none"
    }
  | {
      initialExpandedPaths: PierrePath[]
      kind: "reset"
      nextPierrePaths: PierrePath[]
      transition: Exclude<FileSystemPierreResetTransition, { kind: "same" }>
    }

export function createFileSystemPierreResetPlan({
  snapshotsByCurrentPath,
  transition,
}: {
  snapshotsByCurrentPath: ReadonlyMap<string, FileSystemPierreExpansionSnapshot>
  transition: FileSystemPierreResetTransition
}): FileSystemPierreResetPlan {
  if (transition.kind === "same") {
    return { kind: "none" }
  }

  return {
    initialExpandedPaths: resolveFileSystemPierreInitialExpansion({
      snapshotsByCurrentPath,
      transition,
    }),
    kind: "reset",
    nextPierrePaths: transition.next.input.pierrePaths,
    transition,
  }
}

export function resolveFileSystemPierreInitialExpansion({
  snapshotsByCurrentPath,
  transition,
}: {
  snapshotsByCurrentPath: ReadonlyMap<string, FileSystemPierreExpansionSnapshot>
  transition: Exclude<FileSystemPierreResetTransition, { kind: "same" }>
}): PierrePath[] {
  switch (transition.kind) {
    case "query-enter":
    case "query-update":
      return collectFileSystemPierreDirectoryPaths(
        transition.next.input.pierrePaths
      )
    case "decoration":
    case "input":
    case "path":
    case "query-exit":
      return restoreFileSystemPierreNormalExpansion({
        currentPath: transition.next.currentPath,
        nextPierrePaths: transition.next.input.pierrePaths,
        snapshotsByCurrentPath,
      })
  }
}

function restoreFileSystemPierreNormalExpansion({
  currentPath,
  nextPierrePaths,
  snapshotsByCurrentPath,
}: {
  currentPath: string
  nextPierrePaths: readonly PierrePath[]
  snapshotsByCurrentPath: ReadonlyMap<string, FileSystemPierreExpansionSnapshot>
}): PierrePath[] {
  const snapshot = snapshotsByCurrentPath.get(currentPath)

  return filterFileSystemPierreExpandedPaths({
    expandedPierrePaths: snapshot?.expandedPierrePaths ?? new Set(),
    nextPierrePaths,
  })
}
