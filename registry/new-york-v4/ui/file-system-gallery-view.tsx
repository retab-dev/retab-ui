"use client"

import * as React from "react"
import { Folder } from "lucide-react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

import type { FileSystemController } from "./file-system-controller"
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
  const activeEntry =
    controller.selectedEntry ?? controller.currentEntries[0] ?? null

  React.useEffect(() => {
    if (!controller.selectedEntry && activeEntry) {
      controller.selectEntry(activeEntry)
    }
  }, [activeEntry, controller])

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
        >
          {controller.currentEntries.map((entry) => (
            <button
              key={entry.path}
              type="button"
              role="option"
              aria-label={entry.name}
              aria-selected={entry.path === activeEntry?.path}
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
