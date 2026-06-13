"use client"

import * as React from "react"
import { Eye, Upload, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { blobSource } from "@/lib/viewer-resource"
import type { BlobViewerSource } from "@/lib/viewer-source"
import { useDropzone } from "@/components/ui/dropzone"
import { formatFileSize } from "@/components/ui/file-size-format"
import { FileThumbnail } from "@/components/ui/file-thumbnail"

export type DropzoneUploaderViewerProps = {
  className?: string
  renderViewer: (source: BlobViewerSource) => React.ReactNode
}

export function DropzoneUploaderViewer({
  className,
  renderViewer,
}: DropzoneUploaderViewerProps) {
  const dropzone = useDropzone({
    accept:
      ".pdf,.png,.jpg,.jpeg,.csv,.txt,.md,.json,application/pdf,image/*,text/*,text/csv,application/json",
    maxFiles: 1,
    multiple: false,
  })
  const selectedFile = dropzone.files[0]
  const viewerSource = React.useMemo(() => {
    if (!selectedFile) return null

    return blobSource(selectedFile.file, {
      fileName: selectedFile.file.name,
      identityKey: selectedFile.id,
      mimeType: selectedFile.file.type || undefined,
    })
  }, [selectedFile])

  return (
    <section
      {...dropzone.getRootProps({
        className: cn(
          "overflow-hidden rounded-lg border bg-background transition-colors",
          dropzone.isDragging && "border-foreground/40 bg-accent/35",
          className
        ),
      })}
    >
      <input {...dropzone.getInputProps({ className: "hidden" })} />
      <div className="flex min-h-[30rem] flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Eye className="size-4 text-muted-foreground" aria-hidden />
              Uploader + viewer
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {selectedFile
                ? selectedFile.file.name
                : "One upload surface that becomes the viewer."}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedFile ? (
              <button
                type="button"
                className="grid size-8 place-items-center rounded-md border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${selectedFile.file.name}`}
                onClick={dropzone.clearFiles}
              >
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
            <button
              {...dropzone.getButtonProps({
                className:
                  "inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
              })}
            >
              <Upload className="size-3.5" aria-hidden />
              {selectedFile ? "Replace" : "Upload file"}
            </button>
          </div>
        </div>
        <div className="grid flex-1 md:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="border-b bg-muted/20 p-4 md:border-r md:border-b-0">
            {selectedFile ? (
              <div className="space-y-3">
                <FileThumbnail
                  file={selectedFile.file}
                  previewAspectRatio={1}
                  className="size-20 bg-background shadow-sm"
                />
                <div className="min-w-0">
                  <div className="line-clamp-3 text-sm leading-snug font-medium break-words">
                    {selectedFile.file.name}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.file.size)}
                  </div>
                </div>
                <div className="rounded-md border bg-background p-2 text-xs text-muted-foreground">
                  {selectedFile.file.type || "Unknown type"}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-40 flex-col justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">No file selected</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    PDF, image, CSV, text, Markdown, or JSON.
                  </div>
                </div>
                <button
                  {...dropzone.getButtonProps({
                    className:
                      "inline-flex h-8 w-fit cursor-pointer items-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24",
                  })}
                >
                  <Upload className="size-3.5" aria-hidden />
                  Upload file
                </button>
              </div>
            )}
          </aside>
          <div className="min-h-[24rem] bg-muted/10 p-3">
            {viewerSource ? (
              renderViewer(viewerSource)
            ) : (
              <div
                {...dropzone.getTriggerProps({
                  className:
                    "grid h-full min-h-[26rem] cursor-pointer place-items-center rounded-md border border-dashed bg-background p-6 text-center outline-none transition-colors hover:bg-muted/30 focus-visible:ring-[3px] focus-visible:ring-ring/24",
                })}
              >
                <div>
                  <div className="mx-auto grid size-12 place-items-center rounded-md border bg-muted/30 text-muted-foreground">
                    <Upload className="size-5" aria-hidden />
                  </div>
                  <div className="mt-4 text-sm font-medium">Upload file</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Drop a file here to open it in the viewer.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
