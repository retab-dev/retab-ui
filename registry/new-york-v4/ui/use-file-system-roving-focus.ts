"use client"

import * as React from "react"

import {
  fileSystemBoundaryEntry,
  fileSystemEntryAtOffset,
  fileSystemTypeAheadMatch,
  type FileSystemNavigationEntry,
} from "./file-system-navigation"

export function useFileSystemRovingFocus<
  Entry extends FileSystemNavigationEntry,
>({
  entries,
  getScrollIndex,
  onSelect,
  scrollToIndex,
  selectedPath,
}: {
  entries: readonly Entry[]
  selectedPath: string | null
  onSelect: (entry: Entry) => void
  getScrollIndex?: (entry: Entry) => number
  scrollToIndex?: (index: number) => void
}) {
  const entryElements = React.useRef(new Map<string, HTMLElement>())

  const registerEntryRef = React.useCallback(
    (path: string, element: HTMLElement | null) => {
      if (element) {
        entryElements.current.set(path, element)
      } else {
        entryElements.current.delete(path)
      }
    },
    []
  )

  const focusEntry = React.useCallback(
    (entry: Entry) => {
      const index = getScrollIndex?.(entry)

      if (index !== undefined) scrollToIndex?.(index)

      requestAnimationFrame(() => {
        entryElements.current.get(entry.path)?.focus()
      })
    },
    [getScrollIndex, scrollToIndex]
  )

  const selectEntry = React.useCallback(
    (entry: Entry | null) => {
      if (!entry) return
      onSelect(entry)
      focusEntry(entry)
    },
    [focusEntry, onSelect]
  )

  const selectByOffset = React.useCallback(
    (offset: number) => {
      selectEntry(fileSystemEntryAtOffset(entries, selectedPath, offset))
    },
    [entries, selectEntry, selectedPath]
  )

  const selectBoundary = React.useCallback(
    (boundary: "first" | "last") => {
      selectEntry(fileSystemBoundaryEntry(entries, boundary))
    },
    [entries, selectEntry]
  )

  const selectTypeAhead = React.useCallback(
    (event: React.KeyboardEvent, path: string | null = selectedPath) => {
      selectEntry(fileSystemTypeAheadMatch(event, entries, path))
    },
    [entries, selectEntry, selectedPath]
  )

  return {
    focusEntry,
    registerEntryRef,
    selectBoundary,
    selectByOffset,
    selectEntry,
    selectTypeAhead,
  }
}
