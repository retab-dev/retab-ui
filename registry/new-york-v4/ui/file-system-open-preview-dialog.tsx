"use client"

import * as React from "react"
import { AlertCircle, ExternalLink, FileQuestion } from "lucide-react"

import type { ViewerSource } from "@/lib/viewer-source"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileViewer } from "@/components/ui/file-viewer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"

import { useFileSystem } from "./file-system-provider"
import type { FileSystemOpenPreviewState } from "./file-system-open-preview-state"

export function useFileSystemOpenPreview() {
  return useFileSystem().openPreview
}

export function FileSystemOpenPreview() {
  const { close, state } = useFileSystemOpenPreview()
  const file = state.status === "idle" ? null : state.file
  const source = state.status === "open" ? state.source : null

  return (
    <Dialog
      open={state.status !== "idle"}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      {file ? (
        <DialogContent className="h-[88vh] max-w-[min(96vw,1280px)] overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <div className="flex min-w-0 items-center gap-3 pr-8">
              <DialogTitle className="truncate text-base">
                {file.name}
              </DialogTitle>
              {source?.kind === "url" ? (
                <Button
                  render={
                    <a href={source.url} target="_blank" rel="noreferrer" />
                  }
                  size="xs"
                  variant="outline"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Open
                </Button>
              ) : null}
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            <FileSystemOpenPreviewContent state={state} />
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function FileSystemOpenPreviewContent({
  state,
}: {
  state: FileSystemOpenPreviewState
}) {
  if (state.status === "resolving") {
    return (
      <FileSystemOpenPreviewMessage>
        <Spinner className="size-4" />
        Opening preview
      </FileSystemOpenPreviewMessage>
    )
  }

  if (state.status === "unavailable") {
    return (
      <FileSystemOpenPreviewMessage>
        <FileQuestion className="size-5" aria-hidden />
        Preview unavailable
      </FileSystemOpenPreviewMessage>
    )
  }

  if (state.status === "failed") {
    return (
      <FileSystemOpenPreviewMessage>
        <AlertCircle className="size-5" aria-hidden />
        {state.error}
      </FileSystemOpenPreviewMessage>
    )
  }

  if (state.status !== "open") {
    return null
  }

  return (
    <ScrollArea>
      <div className="h-[calc(88vh-4rem)] min-h-0">
        <FileSystemOpenPreviewViewer source={state.source} />
      </div>
    </ScrollArea>
  )
}

function FileSystemOpenPreviewMessage({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex size-full items-center justify-center gap-2 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function FileSystemOpenPreviewViewer({ source }: { source: ViewerSource }) {
  return <FileViewer source={source} bare className="size-full min-h-0" />
}
