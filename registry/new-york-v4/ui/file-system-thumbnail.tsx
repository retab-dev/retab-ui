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
  resolveFileSource,
}: {
  file: FileSystemFileEntry
  className?: string
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
        previewAspectRatio={1}
        className={className}
      />
    )
  }

  return (
    <FileThumbnail
      file={{ name: file.name, type: file.mimeType ?? "" }}
      previewAspectRatio={1}
      className={className}
      state={sourceState.status === "loading" ? "loading" : undefined}
    />
  )
}
