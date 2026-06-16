"use client"

import { FileThumbnail } from "@/components/ui/file-thumbnail"

import {
  useFileSystemSelectionSourceTask,
  type FileSystemSourceResolver,
} from "./file-system-selection-source-task"
import type { FileSystemFileEntry } from "./file-system-types"

export function FileSystemThumbnail({
  file,
  className,
  presentation,
  resolveFileSource,
}: {
  file: FileSystemFileEntry
  className?: string
  presentation?: "document" | "decorative"
  resolveFileSource?: FileSystemSourceResolver
}) {
  const sourceState = useFileSystemSelectionSourceTask(
    file.previewImageUrl ? null : file,
    resolveFileSource
  )
  const source = file.previewSource ?? file.source ?? sourceState.source

  if (file.previewImageUrl) {
    return (
      <FileThumbnail
        file={{ name: file.name, type: file.mimeType ?? "" }}
        presentation={presentation}
        previewAspectRatio={1}
        previewImageUrl={file.previewImageUrl}
        className={className}
      />
    )
  }

  if (source) {
    return (
      <FileThumbnail
        source={source}
        presentation={presentation}
        previewAspectRatio={1}
        className={className}
      />
    )
  }

  return (
    <FileThumbnail
      file={{ name: file.name, type: file.mimeType ?? "" }}
      presentation={presentation}
      previewAspectRatio={1}
      className={className}
      state={sourceState.status === "loading" ? "loading" : undefined}
    />
  )
}
