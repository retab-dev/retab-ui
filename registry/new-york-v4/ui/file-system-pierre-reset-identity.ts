import type { FileSystemPierreInput } from "./file-system-pierre-input"

export type FileSystemPierreResetIdentity = {
  currentPath: string
  decorationVersion: string
  hasSemanticQuery: boolean
  input: FileSystemPierreInput
}

export type FileSystemPierreResetDiff = {
  didChangeCurrentPath: boolean
  didChangeDecoration: boolean
  didChangeInput: boolean
  didChangeSemanticQuery: boolean
}

export type FileSystemPierreResetTransition =
  | {
      identity: FileSystemPierreResetIdentity
      kind: "same"
    }
  | {
      kind:
        | "decoration"
        | "input"
        | "path"
        | "query-enter"
        | "query-exit"
        | "query-update"
      next: FileSystemPierreResetIdentity
      previous: FileSystemPierreResetIdentity
    }

export function createFileSystemPierreResetIdentity({
  currentPath,
  decorationVersion,
  hasSemanticQuery,
  input,
}: {
  currentPath: string
  decorationVersion: string
  hasSemanticQuery: boolean
  input: FileSystemPierreInput
}): FileSystemPierreResetIdentity {
  return {
    currentPath,
    decorationVersion,
    hasSemanticQuery,
    input,
  }
}

export function diffFileSystemPierreResetIdentity(
  previous: FileSystemPierreResetIdentity,
  next: FileSystemPierreResetIdentity
): FileSystemPierreResetDiff {
  return {
    didChangeCurrentPath: previous.currentPath !== next.currentPath,
    didChangeDecoration: previous.decorationVersion !== next.decorationVersion,
    didChangeInput: previous.input !== next.input,
    didChangeSemanticQuery: previous.hasSemanticQuery !== next.hasSemanticQuery,
  }
}

export function classifyFileSystemPierreResetTransition(
  previous: FileSystemPierreResetIdentity,
  next: FileSystemPierreResetIdentity
): FileSystemPierreResetTransition {
  const diff = diffFileSystemPierreResetIdentity(previous, next)

  if (
    !diff.didChangeCurrentPath &&
    !diff.didChangeDecoration &&
    !diff.didChangeInput &&
    !diff.didChangeSemanticQuery
  ) {
    return { identity: next, kind: "same" }
  }

  if (diff.didChangeCurrentPath) {
    return { kind: "path", previous, next }
  }

  if (!previous.hasSemanticQuery && next.hasSemanticQuery) {
    return { kind: "query-enter", previous, next }
  }

  if (previous.hasSemanticQuery && next.hasSemanticQuery) {
    return { kind: "query-update", previous, next }
  }

  if (previous.hasSemanticQuery && !next.hasSemanticQuery) {
    return { kind: "query-exit", previous, next }
  }

  if (diff.didChangeDecoration) {
    return { kind: "decoration", previous, next }
  }

  return { kind: "input", previous, next }
}
