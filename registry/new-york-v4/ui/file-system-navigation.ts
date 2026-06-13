import type * as React from "react"

export type FileSystemNavigationEntry = {
  name: string
  path: string
}

export function fileSystemEntryAtOffset<Entry extends FileSystemNavigationEntry>(
  entries: readonly Entry[],
  selectedPath: string | null,
  offset: number
) {
  const currentIndex = entries.findIndex((entry) => entry.path === selectedPath)
  const nextIndex = Math.min(
    entries.length - 1,
    Math.max(0, currentIndex === -1 ? 0 : currentIndex + offset)
  )

  return entries[nextIndex] ?? null
}

export function fileSystemBoundaryEntry<Entry extends FileSystemNavigationEntry>(
  entries: readonly Entry[],
  boundary: "first" | "last"
) {
  return boundary === "first"
    ? (entries[0] ?? null)
    : (entries[entries.length - 1] ?? null)
}

export function fileSystemTypeAheadMatch<
  Entry extends FileSystemNavigationEntry,
>(
  event: React.KeyboardEvent,
  entries: readonly Entry[],
  selectedPath: string | null
) {
  if (
    event.key.length !== 1 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    !/^[\p{L}\p{N}]$/u.test(event.key)
  ) {
    return null
  }

  const search = event.key.toLowerCase()
  const startIndex = Math.max(
    0,
    entries.findIndex((entry) => entry.path === selectedPath) + 1
  )

  for (let step = 0; step < entries.length; step += 1) {
    const entry = entries[(startIndex + step) % entries.length]

    if (entry.name.toLowerCase().startsWith(search)) {
      event.preventDefault()
      return entry
    }
  }

  return null
}
