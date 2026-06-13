"use client"

import { FileAudio, Upload, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useDropzone } from "@/components/ui/dropzone"
import { formatFileSize } from "@/components/ui/file-size-format"
import { FileThumbnail } from "@/components/ui/file-thumbnail"

import {
  RejectionRows,
  type DropzoneExampleProps,
} from "./dropzone-example-shared"

export function MediaTranscriptQueue({ className }: DropzoneExampleProps) {
  const dropzone = useDropzone({
    accept: "audio/*,video/*,.mp3,.wav,.m4a,.mp4,.mov",
    maxFiles: 5,
    multiple: true,
  })
  const totalSize = dropzone.files.reduce(
    (total, item) => total + item.file.size,
    0
  )

  return (
    <section
      {...dropzone.getRootProps({
        className: cn(
          "rounded-lg border bg-background p-4 transition-colors",
          dropzone.isDragging && "border-foreground/40 bg-accent/35",
          className
        ),
      })}
    >
      <input {...dropzone.getInputProps({ className: "hidden" })} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileAudio className="size-4 text-muted-foreground" aria-hidden />
            Audio transcript queue
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Audio or video files become transcript jobs.
          </div>
        </div>
        <button
          {...dropzone.getButtonProps({
            className:
              "inline-flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          <Upload className="size-3.5" aria-hidden />
          Add media
        </button>
      </div>
      <div className="mt-4 min-h-36 rounded-md border border-dashed bg-muted/20 p-2">
        {dropzone.files.length ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span>{dropzone.files.length} jobs queued</span>
              <span>{formatFileSize(totalSize)}</span>
            </div>
            {dropzone.files.map((item) => (
              <div
                key={item.id}
                className="flex min-w-0 items-center gap-2 rounded-md border bg-background p-2 text-xs"
              >
                <FileThumbnail
                  file={item.file}
                  previewAspectRatio={1}
                  className="size-10 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{item.file.name}</div>
                  <div className="text-muted-foreground">
                    {formatFileSize(item.file.size)} · queued
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${item.file.name}`}
                  className="grid size-6 shrink-0 place-items-center rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => dropzone.removeFile(item.id)}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid h-32 place-items-center text-center text-xs text-muted-foreground">
            Drop interview recordings here.
          </div>
        )}
      </div>
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  )
}
