"use client"

import { Upload, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useDropzone, type DropzoneFileItem } from "@/components/ui/dropzone"
import { formatFileSize } from "@/components/ui/file-size-format"
import { FileThumbnail } from "@/components/ui/file-thumbnail"

import {
  RejectionRows,
  type DropzoneExampleProps,
} from "./dropzone-example-shared"

export function ComparisonPairUpload({ className }: DropzoneExampleProps) {
  return (
    <section className={cn("rounded-lg border bg-background p-4", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Comparison pair</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Two independent dropzones model original versus revision.
          </div>
        </div>
        <div className="rounded-full border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
          2 slots
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ComparisonSlot label="Original" />
        <ComparisonSlot label="Revision" />
      </div>
    </section>
  )
}

function ComparisonSlot({ label }: { label: string }) {
  const dropzone = useDropzone({
    accept: ".pdf,.doc,.docx,application/pdf",
    maxFiles: 1,
  })
  const selectedFile = dropzone.files[0]

  return (
    <div
      {...dropzone.getRootProps({
        className: cn(
          "rounded-md border border-dashed bg-muted/20 p-3 transition-colors",
          dropzone.isDragging && "border-foreground/40 bg-accent/35"
        ),
      })}
    >
      <input {...dropzone.getInputProps({ className: "hidden" })} />
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{label}</div>
        <button
          {...dropzone.getButtonProps({
            className:
              "inline-flex h-7 cursor-pointer items-center rounded-md border bg-background px-2 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          {selectedFile ? "Replace" : "Choose"}
        </button>
      </div>
      {selectedFile ? (
        <div className="flex min-w-0 items-center gap-3 rounded-md border bg-background p-2">
          <FileThumbnail
            file={selectedFile.file}
            previewAspectRatio={1}
            className="size-12 shrink-0"
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
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={dropzone.clearFiles}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <div
          {...dropzone.getTriggerProps({
            className:
              "grid min-h-24 cursor-pointer place-items-center rounded-md bg-background text-center text-xs text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          Drop {label.toLowerCase()} document.
        </div>
      )}
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </div>
  )
}

export function IntakeRouter({ className }: DropzoneExampleProps) {
  const dropzone = useDropzone({
    accept:
      ".pdf,.doc,.docx,.csv,.xls,.xlsx,.png,.jpg,.jpeg,image/*,application/pdf,text/csv",
    maxFiles: 12,
    multiple: true,
  })
  const groups = getRoutedFiles(dropzone.files)

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Intake router</div>
          <div className="mt-1 text-xs text-muted-foreground">
            One target, derived lanes by file type.
          </div>
        </div>
        <button
          {...dropzone.getButtonProps({
            className:
              "inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          <Upload className="size-3.5" aria-hidden />
          Add batch
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <RoutedLane
          label="Documents"
          files={groups.documents}
          onRemove={dropzone.removeFile}
        />
        <RoutedLane
          label="Images"
          files={groups.images}
          onRemove={dropzone.removeFile}
        />
        <RoutedLane
          label="Tables"
          files={groups.tables}
          onRemove={dropzone.removeFile}
        />
      </div>
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  )
}

function getRoutedFiles(files: DropzoneFileItem[]) {
  const groups = {
    documents: [] as DropzoneFileItem[],
    images: [] as DropzoneFileItem[],
    tables: [] as DropzoneFileItem[],
  }

  for (const item of files) {
    const fileName = item.file.name.toLowerCase()
    const fileType = item.file.type

    if (
      fileType.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|heic)$/.test(fileName)
    ) {
      groups.images.push(item)
    } else if (
      fileType.includes("spreadsheet") ||
      fileType === "text/csv" ||
      /\.(csv|xls|xlsx)$/.test(fileName)
    ) {
      groups.tables.push(item)
    } else {
      groups.documents.push(item)
    }
  }

  return groups
}

function RoutedLane({
  files,
  label,
  onRemove,
}: {
  files: DropzoneFileItem[]
  label: string
  onRemove: (fileId: string) => void
}) {
  return (
    <div className="min-h-44 rounded-md border border-dashed bg-muted/20 p-2">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{files.length}</span>
      </div>
      {files.length ? (
        <div className="space-y-2">
          {files.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="flex min-w-0 items-center gap-2 rounded-md border bg-background p-2"
            >
              <FileThumbnail
                file={item.file}
                previewAspectRatio={1}
                className="size-9 shrink-0"
              />
              <div className="min-w-0 flex-1 truncate text-xs font-medium">
                {item.file.name}
              </div>
              <button
                type="button"
                aria-label={`Remove ${item.file.name}`}
                className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onRemove(item.id)}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
          {files.length > 3 ? (
            <div className="text-center text-xs text-muted-foreground">
              +{files.length - 3} more
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid h-32 place-items-center text-center text-xs text-muted-foreground">
          No {label.toLowerCase()} yet.
        </div>
      )}
    </div>
  )
}

export function RequiredPacketSlots({ className }: DropzoneExampleProps) {
  return (
    <section className={cn("rounded-lg border bg-background p-4", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Required packet</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Slot-level dropzones for checklist-driven uploads.
          </div>
        </div>
        <div className="rounded-full border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
          checklist
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {["Identity proof", "Bank statement", "Board approval"].map((label) => (
          <PacketSlot key={label} label={label} />
        ))}
      </div>
    </section>
  )
}

function PacketSlot({ label }: { label: string }) {
  const dropzone = useDropzone({
    accept: ".pdf,.png,.jpg,.jpeg,image/*,application/pdf",
    maxFiles: 1,
  })
  const selectedFile = dropzone.files[0]

  return (
    <div
      {...dropzone.getRootProps({
        className: cn(
          "min-h-44 rounded-md border border-dashed bg-muted/20 p-3 transition-colors",
          dropzone.isDragging && "border-foreground/40 bg-accent/35"
        ),
      })}
    >
      <input {...dropzone.getInputProps({ className: "hidden" })} />
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-xs font-medium">{label}</div>
        <div
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px]",
            selectedFile
              ? "bg-foreground text-background"
              : "bg-background text-muted-foreground"
          )}
        >
          {selectedFile ? "done" : "open"}
        </div>
      </div>
      {selectedFile ? (
        <div className="text-center">
          <FileThumbnail
            file={selectedFile.file}
            previewAspectRatio={1}
            className="mx-auto size-16 bg-background"
          />
          <div className="mt-2 line-clamp-2 text-xs font-medium break-words">
            {selectedFile.file.name}
          </div>
          <button
            type="button"
            className="mt-3 h-7 rounded-md border bg-background px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={dropzone.clearFiles}
          >
            Clear
          </button>
        </div>
      ) : (
        <div
          {...dropzone.getTriggerProps({
            className:
              "grid h-28 cursor-pointer place-items-center rounded-md bg-background text-center text-xs text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          Drop required file.
        </div>
      )}
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </div>
  )
}

export function PinboardDropSurface({ className }: DropzoneExampleProps) {
  const dropzone = useDropzone({
    accept: ".pdf,.png,.jpg,.jpeg,image/*,application/pdf",
    maxFiles: 8,
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Pinboard drop surface</div>
          <div className="mt-1 text-xs text-muted-foreground">
            The whole canvas is the trigger.
          </div>
        </div>
        <button
          {...dropzone.getButtonProps({
            className:
              "inline-flex h-8 cursor-pointer items-center rounded-md border bg-background px-3 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          Pin files
        </button>
      </div>
      <div
        {...dropzone.getTriggerProps({
          className:
            "grid min-h-72 cursor-pointer grid-cols-2 content-start gap-3 rounded-md border border-dashed bg-muted/20 p-3 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-[3px] focus-visible:ring-ring/24 sm:grid-cols-3",
        })}
      >
        {dropzone.files.length ? (
          dropzone.files.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "min-w-0 rounded-md border bg-background p-2 text-center shadow-xs",
                index % 2 === 0 && "translate-y-2",
                index % 3 === 0 && "-rotate-1",
                index % 3 === 1 && "rotate-1"
              )}
            >
              <FileThumbnail
                file={item.file}
                previewAspectRatio={1}
                className="mx-auto size-14"
              />
              <div className="mt-2 line-clamp-2 text-xs leading-tight break-words">
                {item.file.name}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full grid min-h-60 place-items-center text-center text-xs text-muted-foreground">
            Drop files to pin them onto the canvas.
          </div>
        )}
      </div>
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  )
}
