"use client"

import * as React from "react"
import { AlertCircle, FileQuestion, RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ViewerSource } from "@/lib/viewer-source"
import { Button } from "@/components/ui/button"
import { FileThumbnail } from "@/components/ui/file-thumbnail"
import { FileViewer } from "@/components/ui/file-viewer"
import { Spinner } from "@/components/ui/spinner"

import type {
  FileSystemEntry,
  FileSystemFileEntry,
  FileSystemFileItem,
} from "./file-system-types"

export type FileSystemSourceResolver = (
  file: FileSystemFileEntry,
  signal: AbortSignal
) => Promise<ViewerSource | null>

export function FileSystemPreview({
  entry,
  className,
  renderFileActions,
  renderMetadata,
  resolveFileSource,
}: {
  entry: FileSystemEntry | null
  className?: string
  renderFileActions?: (file: FileSystemFileItem) => React.ReactNode
  renderMetadata?: (item: FileSystemEntry) => React.ReactNode
  resolveFileSource: FileSystemSourceResolver
}) {
  const file = entry?.kind === "file" ? entry : null
  const sourceState = useResolvedFileSystemSource(file, resolveFileSource)

  return (
    <aside
      className={cn(
        "flex min-h-0 min-w-0 flex-col border-l bg-muted/20",
        className
      )}
      aria-label={entry ? `${entry.name} preview` : "File preview"}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center bg-background">
          {!entry ? (
            <PreviewMessage
              title="No file selected"
              description="Select a file to preview it."
            />
          ) : entry.kind === "folder" ? (
            <PreviewMessage
              title={entry.name}
              description="Folders show their contents in the browser."
            />
          ) : sourceState.status === "loading" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading preview
            </div>
          ) : sourceState.status === "error" ? (
            <PreviewMessage
              icon={<AlertCircle className="size-5" aria-hidden />}
              title="Couldn't load preview"
              description={sourceState.error}
              action={
                <Button size="sm" variant="outline" onClick={sourceState.retry}>
                  <RefreshCw className="size-3.5" aria-hidden />
                  Retry
                </Button>
              }
            />
          ) : sourceState.source ? (
            <FileViewer
              source={sourceState.source}
              bare
              className="size-full min-h-0"
            />
          ) : (
            <PreviewMessage
              icon={<FileQuestion className="size-5" aria-hidden />}
              title="Preview unavailable"
              description="This file does not have a resolved source."
            />
          )}
        </div>
        {entry ? (
          <div className="border-t bg-background p-3">
            <div className="flex items-start gap-3">
              {entry.kind === "file" ? (
                <FileSystemThumbnail
                  file={entry}
                  resolveFileSource={resolveFileSource}
                  className="w-12 shrink-0"
                />
              ) : (
                <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-lg">
                  {folderInitial(entry.name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium break-words">
                  {entry.name}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {entry.path}
                </div>
              </div>
              {file ? renderFileActions?.(file) : null}
            </div>
            {renderMetadata ? (
              <div className="mt-3">{renderMetadata(entry)}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  )
}

export function FileSystemThumbnail({
  file,
  className,
  resolveFileSource,
}: {
  file: FileSystemFileEntry
  className?: string
  resolveFileSource?: FileSystemSourceResolver
}) {
  const sourceState = useResolvedFileSystemSource(
    file.previewImageUrl ? null : file,
    resolveFileSource
  )
  const source = file.previewSource ?? file.source ?? sourceState.source

  if (file.previewImageUrl) {
    return (
      <FileThumbnail
        file={{ name: file.name, type: file.mimeType ?? "" }}
        previewAspectRatio={file.previewAspectRatio}
        previewImageUrl={file.previewImageUrl}
        className={className}
      />
    )
  }

  if (source) {
    return (
      <FileThumbnail
        source={source}
        previewAspectRatio={file.previewAspectRatio}
        className={className}
      />
    )
  }

  return (
    <FileThumbnail
      file={{ name: file.name, type: file.mimeType ?? "" }}
      previewAspectRatio={file.previewAspectRatio}
      className={className}
      state={sourceState.status === "loading" ? "loading" : undefined}
    />
  )
}

function useResolvedFileSystemSource(
  file: FileSystemFileEntry | null,
  resolveFileSource?: FileSystemSourceResolver
):
  | { status: "idle"; source: ViewerSource | null; retry: () => void }
  | { status: "loading"; source: null; retry: () => void }
  | { status: "ready"; source: ViewerSource | null; retry: () => void }
  | { status: "error"; source: null; error: string; retry: () => void } {
  const [retryKey, setRetryKey] = React.useState(0)
  const [state, setState] = React.useState<
    | { status: "idle"; source: ViewerSource | null }
    | { status: "loading"; source: null }
    | { status: "ready"; source: ViewerSource | null }
    | { status: "error"; source: null; error: string }
  >({ status: "idle", source: null })
  const retry = React.useCallback(() => setRetryKey((key) => key + 1), [])

  React.useEffect(() => {
    if (!file) {
      setState({ status: "idle", source: null })
      return
    }
    if (file.source) {
      setState({ status: "ready", source: file.source })
      return
    }
    if (!resolveFileSource) {
      setState({ status: "ready", source: null })
      return
    }

    const controller = new AbortController()

    setState({ status: "loading", source: null })
    void resolveFileSource(file, controller.signal)
      .then((source) => {
        if (!controller.signal.aborted) {
          setState({ status: "ready", source })
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({
            error:
              error instanceof Error && error.message
                ? error.message
                : "Couldn't load this file.",
            source: null,
            status: "error",
          })
        }
      })

    return () => controller.abort()
  }, [file, resolveFileSource, retryKey])

  return { ...state, retry }
}

function PreviewMessage({
  action,
  description,
  icon,
  title,
}: {
  action?: React.ReactNode
  description: string
  icon?: React.ReactNode
  title: string
}) {
  return (
    <div className="flex max-w-xs flex-col items-center gap-2 px-6 text-center">
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}

function folderInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "/"
}
