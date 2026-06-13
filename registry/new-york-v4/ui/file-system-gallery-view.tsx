"use client"

import * as React from "react"
import { Folder } from "lucide-react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

import type { FileSystemController } from "./file-system-controller"
import {
  fileSystemBoundaryEntry,
  fileSystemEntryAtOffset,
  fileSystemTypeAheadMatch,
} from "./file-system-navigation"
import { FileSystemPreview, FileSystemThumbnail } from "./file-system-preview"
import type {
  FileSystemEntry,
  FileSystemFileEntry,
  FileSystemFileItem,
} from "./file-system-types"

export function FileSystemGalleryView({
  controller,
  onOpenFile,
  renderFileActions,
  renderMetadata,
}: {
  controller: FileSystemController
  onOpenFile: (file: FileSystemFileEntry) => void
  renderFileActions?: (file: FileSystemFileItem) => React.ReactNode
  renderMetadata?: (item: FileSystemEntry) => React.ReactNode
}) {
  const thumbnailRefs = React.useRef(new Map<string, HTMLButtonElement>())
  const activeEntry =
    controller.selectedEntry ?? controller.currentEntries[0] ?? null

  React.useEffect(() => {
    if (!controller.selectedEntry && activeEntry) {
      controller.selectEntry(activeEntry)
    }
  }, [activeEntry, controller])
  const focusEntry = React.useCallback((entry: FileSystemEntry) => {
    requestAnimationFrame(() => thumbnailRefs.current.get(entry.path)?.focus())
  }, [])
  const selectEntry = React.useCallback(
    (entry: FileSystemEntry | null) => {
      if (!entry) return
      controller.selectEntry(entry)
      focusEntry(entry)
    },
    [controller, focusEntry]
  )
  const openEntry = React.useCallback(
    (entry: FileSystemEntry) => {
      if (entry.kind === "folder") {
        controller.navigateTo(entry.path)
      } else {
        onOpenFile(entry)
      }
    },
    [controller, onOpenFile]
  )
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      selectEntry(
        fileSystemEntryAtOffset(
          controller.currentEntries,
          activeEntry?.path ?? controller.selectedPath,
          1
        )
      )
      event.preventDefault()
      return
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      selectEntry(
        fileSystemEntryAtOffset(
          controller.currentEntries,
          activeEntry?.path ?? controller.selectedPath,
          -1
        )
      )
      event.preventDefault()
      return
    }
    if (event.key === "Home" || event.key === "End") {
      selectEntry(
        fileSystemBoundaryEntry(
          controller.currentEntries,
          event.key === "Home" ? "first" : "last"
        )
      )
      event.preventDefault()
      return
    }
    if (event.key === "Enter" && activeEntry) {
      openEntry(activeEntry)
      event.preventDefault()
      return
    }

    selectEntry(
      fileSystemTypeAheadMatch(
        event,
        controller.currentEntries,
        activeEntry?.path ?? controller.selectedPath
      )
    )
  }

  return (
    <div className="flex size-full flex-col">
      <div className="min-h-0 flex-1">
        <FileSystemPreview
          entry={activeEntry}
          renderFileActions={renderFileActions}
          renderMetadata={renderMetadata}
          resolveFileSource={controller.resolveFileSource}
          className="size-full border-l-0"
        />
      </div>
      <ScrollArea
        orientation="horizontal"
        className="h-[74px] shrink-0 border-t"
        viewportClassName="p-2"
      >
        <div
          className="flex h-14 items-center gap-1.5"
          role="listbox"
          aria-label="Files"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          {controller.currentEntries.map((entry) => (
            <button
              ref={(element) => {
                if (element) {
                  thumbnailRefs.current.set(entry.path, element)
                } else {
                  thumbnailRefs.current.delete(entry.path)
                }
              }}
              key={entry.path}
              type="button"
              role="option"
              aria-label={entry.name}
              aria-selected={entry.path === activeEntry?.path}
              tabIndex={entry.path === activeEntry?.path ? 0 : -1}
              onClick={() => controller.selectEntry(entry)}
              onDoubleClick={() => {
                if (entry.kind === "folder") {
                  controller.navigateTo(entry.path)
                } else {
                  onOpenFile(entry)
                }
              }}
              className={cn(
                "flex size-14 shrink-0 items-center justify-center rounded-md border border-transparent p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                entry.path === activeEntry?.path && "border-ring/40 bg-accent"
              )}
            >
              {entry.kind === "folder" ? (
                <Folder className="size-9 text-sky-500" aria-hidden />
              ) : (
                <FileSystemThumbnail
                  file={entry}
                  resolveFileSource={controller.resolveFileSource}
                  className="w-10"
                />
              )}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
