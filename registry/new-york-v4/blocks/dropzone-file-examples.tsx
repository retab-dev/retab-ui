"use client"

import {
  Clock3,
  FileAudio,
  ImagePlus,
  Paperclip,
  Table2,
  Upload,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useDropzone } from "@/components/ui/dropzone"
import { formatFileSize } from "@/components/ui/file-size-format"
import { FileThumbnail } from "@/components/ui/file-thumbnail"

import {
  RejectionRows,
  type DropzoneExampleProps,
} from "./dropzone-example-shared"

export function CustomThumbnailGrid({ className }: DropzoneExampleProps) {
  const dropzone = useDropzone({
    accept: ".pdf,.png,.jpg,.jpeg,image/*,application/pdf",
    multiple: true,
  })

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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Custom thumbnail grid</div>
          <div className="text-xs text-muted-foreground">
            Direct useDropzone composition with FileThumbnail.
          </div>
        </div>
        <button
          {...dropzone.getButtonProps({
            className:
              "inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          <Upload className="size-3.5" aria-hidden />
          Select files
        </button>
      </div>
      <input {...dropzone.getInputProps({ className: "hidden" })} />
      <div className="grid min-h-36 grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3 rounded-md border border-dashed bg-muted/20 p-3">
        {dropzone.files.length ? (
          dropzone.files.map((item) => (
            <div key={item.id} className="min-w-0 text-center">
              <FileThumbnail
                file={item.file}
                previewAspectRatio={1}
                className="mx-auto size-16 bg-background shadow-sm"
              />
              <div className="mt-2 line-clamp-2 text-xs leading-tight break-words">
                {item.file.name}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full grid place-items-center text-xs text-muted-foreground">
            Drop PDFs or images here.
          </div>
        )}
      </div>
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  )
}

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

export function AvatarImageSlot({ className }: DropzoneExampleProps) {
  const dropzone = useDropzone({
    accept: "image/*,.png,.jpg,.jpeg,.webp",
    maxFiles: 1,
  })
  const selectedFile = dropzone.files[0]

  return (
    <section
      {...dropzone.getRootProps({
        className: cn(
          "rounded-lg border bg-muted/20 p-4 transition-colors",
          dropzone.isDragging && "border-foreground/40 bg-accent/35",
          className
        ),
      })}
    >
      <input {...dropzone.getInputProps({ className: "hidden" })} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <ImagePlus className="size-4 text-muted-foreground" aria-hidden />
            Avatar image slot
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            One image, replaceable by design.
          </div>
        </div>
        {selectedFile ? (
          <button
            className="h-8 rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted"
            onClick={dropzone.clearFiles}
            type="button"
          >
            Remove
          </button>
        ) : null}
      </div>
      <div
        {...dropzone.getTriggerProps({
          className:
            "mt-4 grid min-h-44 cursor-pointer place-items-center rounded-md border border-dashed bg-background p-4 text-center outline-none transition-colors hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/24",
        })}
      >
        {selectedFile ? (
          <div className="min-w-0">
            <FileThumbnail
              file={selectedFile.file}
              previewAspectRatio={1}
              className="mx-auto size-24 rounded-full"
            />
            <div className="mt-3 line-clamp-1 max-w-48 text-sm font-medium">
              {selectedFile.file.name}
            </div>
            <div className="text-xs text-muted-foreground">
              Click or drop to replace.
            </div>
          </div>
        ) : (
          <div>
            <ImagePlus className="mx-auto size-8 text-muted-foreground" />
            <div className="mt-3 text-sm font-medium">Drop profile image</div>
            <div className="mt-1 text-xs text-muted-foreground">
              PNG, JPG, or WebP.
            </div>
          </div>
        )}
      </div>
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  )
}

export function SpreadsheetImportCard({ className }: DropzoneExampleProps) {
  const dropzone = useDropzone({
    accept:
      ".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    maxFiles: 1,
  })
  const selectedFile = dropzone.files[0]

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
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Table2 className="size-4 text-muted-foreground" aria-hidden />
            Spreadsheet mapper
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            A single sheet feeds a mapping workflow.
          </div>
        </div>
        <button
          {...dropzone.getButtonProps({
            className:
              "inline-flex h-8 shrink-0 cursor-pointer items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          Choose
        </button>
      </div>
      <div className="mt-4 rounded-md border border-dashed bg-muted/20 p-3">
        {selectedFile ? (
          <div className="space-y-3">
            <div className="flex min-w-0 items-center gap-3">
              <FileThumbnail
                file={selectedFile.file}
                previewAspectRatio={1}
                className="size-12 shrink-0 bg-background"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {selectedFile.file.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.file.size)}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Remove ${selectedFile.file.name}`}
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={dropzone.clearFiles}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {["Name", "Email", "Amount"].map((column) => (
                <div
                  key={column}
                  className="rounded-md border bg-background px-2 py-1.5 text-center font-medium"
                >
                  {column}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            {...dropzone.getTriggerProps({
              className:
                "grid min-h-32 cursor-pointer place-items-center rounded-md bg-background text-center text-xs text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24",
            })}
          >
            Drop CSV or XLSX to preview columns.
          </div>
        )}
      </div>
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  )
}

export function EvidenceTimeline({ className }: DropzoneExampleProps) {
  const dropzone = useDropzone({
    accept: ".pdf,.png,.jpg,.jpeg,image/*,application/pdf",
    maxFiles: 6,
    multiple: true,
  })

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock3 className="size-4 text-muted-foreground" aria-hidden />
            Evidence timeline
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Files become ordered events inside a custom surface.
          </div>
        </div>
        <button
          {...dropzone.getButtonProps({
            className:
              "inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          <Paperclip className="size-3.5" aria-hidden />
          Add evidence
        </button>
      </div>
      <div className="mt-4 grid min-h-44 gap-3 rounded-md border border-dashed bg-muted/20 p-3 md:grid-cols-2">
        {dropzone.files.length ? (
          dropzone.files.map((item, index) => (
            <div
              key={item.id}
              className="flex min-w-0 items-center gap-3 rounded-md border bg-background p-2"
            >
              <div className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">
                {index + 1}
              </div>
              <FileThumbnail
                file={item.file}
                previewAspectRatio={1}
                className="size-12 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {item.file.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatFileSize(item.file.size)}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Remove ${item.file.name}`}
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => dropzone.removeFile(item.id)}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ))
        ) : (
          <div
            {...dropzone.getTriggerProps({
              className:
                "col-span-full grid min-h-36 cursor-pointer place-items-center rounded-md bg-background text-center text-xs text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24",
            })}
          >
            Drop PDFs or images to build a case timeline.
          </div>
        )}
      </div>
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  )
}
