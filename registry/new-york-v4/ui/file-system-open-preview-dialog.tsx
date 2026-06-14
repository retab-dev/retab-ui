"use client"

import { ExternalLink } from "lucide-react"

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

import { useFileSystem } from "./file-system-provider"

export function useFileSystemOpenPreviewDialog() {
  return useFileSystem().openPreview
}

export function FileSystemOpenPreviewDialog() {
  const { closePreview, openedPreview } = useFileSystemOpenPreviewDialog()

  return (
    <Dialog
      open={openedPreview !== null}
      onOpenChange={(open) => {
        if (!open) closePreview()
      }}
    >
      {openedPreview ? (
        <DialogContent className="h-[88vh] max-w-[min(96vw,1280px)] overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <div className="flex min-w-0 items-center gap-3 pr-8">
              <DialogTitle className="truncate text-base">
                {openedPreview.file.name}
              </DialogTitle>
              {openedPreview.source?.kind === "url" ? (
                <Button
                  render={
                    <a
                      href={openedPreview.source.url}
                      target="_blank"
                      rel="noreferrer"
                    />
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
            {openedPreview.source ? (
              <FileSystemOpenPreviewContent source={openedPreview.source} />
            ) : (
              <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                Preview unavailable
              </div>
            )}
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function FileSystemOpenPreviewContent({ source }: { source: ViewerSource }) {
  return (
    <ScrollArea>
      <div className="h-[calc(88vh-4rem)] min-h-0">
        <FileSystemOpenPreviewViewer source={source} />
      </div>
    </ScrollArea>
  )
}

function FileSystemOpenPreviewViewer({ source }: { source: ViewerSource }) {
  return <FileViewer source={source} bare className="size-full min-h-0" />
}
