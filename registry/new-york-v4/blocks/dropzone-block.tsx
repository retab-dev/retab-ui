"use client"

import * as React from "react"
import {
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Image,
  Paperclip,
  Upload,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  formatDropzoneBytes,
  useDropzone,
  type DropzoneFileItem,
  type DropzoneFileRejection,
} from "@/components/ui/dropzone"
import { FileThumbnail } from "@/components/ui/file-thumbnail"
import { FileUploader } from "@/components/ui/file-uploader"

/**
 * Dropzone lab — the default FileUploader plus several custom upload surfaces
 * that all share the same headless useDropzone behavior primitive.
 */
export function DropzoneBlock() {
  return (
    <div className="h-full min-h-[760px] overflow-auto bg-background p-5">
      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-4">
        <UploaderScenario
          className="col-span-12 xl:col-span-7"
          title="Document intake"
          description="PDF, DOCX, XLSX, CSV, PNG, or JPG"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg,text/csv"
          multiple
        />
        <UploaderScenario
          className="col-span-12 md:col-span-6 xl:col-span-5"
          title="Single PDF"
          description="PDF only"
          accept="application/pdf,.pdf"
          multiple={false}
          maxSize={8 * 1024 * 1024}
          acceptedFileTypes={[{ label: "PDF", icon: FileText }]}
        />
        <UploaderScenario
          className="col-span-12 md:col-span-6 xl:col-span-4"
          title="Images"
          description="PNG, JPG, or WEBP"
          accept="image/*"
          multiple
          acceptedFileTypes={[
            { label: "Image", icon: FileImage },
            { label: "PNG", icon: Image },
            { label: "Archive", icon: FileArchive },
          ]}
        />
        <UploaderScenario
          className="col-span-12 md:col-span-6 xl:col-span-4"
          title="Small files"
          description="Any file up to 100 KB"
          maxSize={100 * 1024}
          multiple
          acceptedFileTypes={[
            { label: "Text", icon: FileText },
            { label: "Sheet", icon: FileSpreadsheet },
          ]}
        />
        <HeadlessToolbarUpload className="col-span-12 md:col-span-6 xl:col-span-4" />
        <AttachmentCellUpload className="col-span-12 md:col-span-6 xl:col-span-4" />
        <ControlledQueueUpload className="col-span-12 md:col-span-6 xl:col-span-4" />
        <ValidationOnlyDropTarget className="col-span-12 md:col-span-6 xl:col-span-4" />
        <CustomThumbnailGrid className="col-span-12 xl:col-span-8" />
        <UploaderScenario
          className="col-span-12 md:col-span-6 xl:col-span-4"
          title="Disabled"
          description="Read-only state"
          disabled
          multiple
        />
      </div>
    </div>
  )
}

function UploaderScenario({
  className,
  title,
  description,
  accept,
  acceptedFileTypes,
  disabled,
  maxSize,
  multiple,
}: {
  className?: string
  title: string
  description: string
  accept?: string
  acceptedFileTypes?: React.ComponentProps<
    typeof FileUploader
  >["acceptedFileTypes"]
  disabled?: boolean
  maxSize?: number
  multiple: boolean
}) {
  return (
    <section className={className}>
      <FileUploader
        accept={accept}
        acceptedFileTypes={acceptedFileTypes}
        disabled={disabled}
        maxSize={maxSize}
        multiple={multiple}
        title={title}
        description={description}
        className={cn(
          "min-h-[19rem] justify-start pt-8",
          disabled && "min-h-[15rem]"
        )}
      />
    </section>
  )
}

function HeadlessToolbarUpload({ className }: { className?: string }) {
  const dropzone = useDropzone({
    accept: ".pdf,.csv,.txt,text/plain,text/csv,application/pdf",
    maxFiles: 3,
    multiple: true,
  })

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
      <div className="flex items-center gap-3">
        <div
          {...dropzone.getTriggerProps({
            className:
              "inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-xs outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          <Upload className="size-4" aria-hidden />
          Add files
        </div>
        <div className="min-w-0 text-sm">
          <div className="font-medium">Toolbar upload</div>
          <div className="truncate text-xs text-muted-foreground">
            {dropzone.files.length
              ? `${dropzone.files.length} attached`
              : "No files attached"}
          </div>
        </div>
      </div>
      <InlineFileRows files={dropzone.files} onRemove={dropzone.removeFile} />
      <RejectionRows rejections={dropzone.rejectedFiles} />
    </section>
  )
}

function AttachmentCellUpload({ className }: { className?: string }) {
  const dropzone = useDropzone({ accept: "image/*,.pdf", maxFiles: 2 })

  return (
    <section
      {...dropzone.getRootProps({
        className: cn(
          "rounded-lg border bg-background p-4",
          dropzone.isDragging && "border-foreground/40 bg-accent/35",
          className
        ),
      })}
    >
      <input {...dropzone.getInputProps({ className: "hidden" })} />
      <div className="mb-3 grid grid-cols-[7rem_1fr] gap-3 text-sm">
        <div className="text-muted-foreground">Invoice</div>
        <div
          {...dropzone.getTriggerProps({
            className:
              "min-h-16 cursor-pointer rounded-md border border-dashed bg-muted/20 px-3 py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          <div className="flex items-center gap-2 font-medium">
            <Paperclip className="size-4" aria-hidden />
            Attachment cell
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Drop an image or PDF into this table-like field.
          </div>
        </div>
      </div>
      <InlineFileRows files={dropzone.files} onRemove={dropzone.removeFile} />
      <RejectionRows rejections={dropzone.rejectedFiles} />
    </section>
  )
}

function ControlledQueueUpload({ className }: { className?: string }) {
  const [files, setFiles] = React.useState<DropzoneFileItem[]>([])
  const dropzone = useDropzone({
    files,
    maxFiles: 4,
    multiple: true,
    onFilesChange: setFiles,
  })

  return (
    <section
      {...dropzone.getRootProps({
        className: cn(
          "rounded-lg border bg-muted/20 p-4",
          dropzone.isDragging && "border-foreground/40 bg-accent/35",
          className
        ),
      })}
    >
      <input {...dropzone.getInputProps({ className: "hidden" })} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Controlled queue</div>
          <div className="text-xs text-muted-foreground">
            Parent-owned file state, clearable as a queue.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-8 rounded-md border px-2 text-xs text-muted-foreground hover:bg-muted"
            onClick={dropzone.clearFiles}
          >
            Clear
          </button>
          <div
            {...dropzone.getTriggerProps({
              className:
                "inline-flex h-8 cursor-pointer items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24",
            })}
          >
            Browse
          </div>
        </div>
      </div>
      <InlineFileRows files={files} onRemove={dropzone.removeFile} />
      <RejectionRows rejections={dropzone.rejectedFiles} />
    </section>
  )
}

function ValidationOnlyDropTarget({ className }: { className?: string }) {
  const [accepted, setAccepted] = React.useState<File[]>([])
  const [rejections, setRejections] = React.useState<DropzoneFileRejection[]>(
    []
  )
  const dropzone = useDropzone({
    accept: "application/pdf,.pdf",
    files: [],
    maxSize: 100 * 1024,
    multiple: true,
    onFilesAccepted: setAccepted,
    onFilesRejected: setRejections,
    onFilesChange: () => {},
  })

  return (
    <section
      {...dropzone.getRootProps(
        dropzone.getTriggerProps({
          "data-slot": "dropzone",
          className: cn(
            "flex min-h-40 cursor-pointer flex-col justify-center rounded-lg border border-dashed bg-background p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24",
            dropzone.isDragging && "border-foreground/40 bg-accent/35",
            className
          ),
        })
      )}
    >
      <input {...dropzone.getInputProps({ className: "hidden" })} />
      <div className="text-sm font-medium">Validation only</div>
      <div className="mt-1 text-xs text-muted-foreground">
        PDF under 100 KB. Accepted files are reported, not stored.
      </div>
      <div className="mt-3 text-xs">
        Accepted: {accepted.map((file) => file.name).join(", ") || "none"}
      </div>
      <RejectionRows rejections={rejections} />
    </section>
  )
}

function CustomThumbnailGrid({ className }: { className?: string }) {
  const dropzone = useDropzone({
    accept: ".pdf,.png,.jpg,.jpeg,image/*,application/pdf",
    multiple: true,
  })

  return (
    <section
      {...dropzone.getRootProps({
        className: cn(
          "rounded-lg border bg-background p-4",
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
        <div
          {...dropzone.getTriggerProps({
            className:
              "inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          <Upload className="size-3.5" aria-hidden />
          Select files
        </div>
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
      <RejectionRows rejections={dropzone.rejectedFiles} />
    </section>
  )
}

function InlineFileRows({
  files,
  onRemove,
}: {
  files: DropzoneFileItem[]
  onRemove: (fileId: string) => void
}) {
  if (files.length === 0) return null

  return (
    <div className="mt-3 space-y-1">
      {files.map((item) => (
        <div
          key={item.id}
          className="flex min-w-0 items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs"
        >
          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 truncate">{item.file.name}</div>
          <div className="shrink-0 text-muted-foreground">
            {formatDropzoneBytes(item.file.size)}
          </div>
          <button
            type="button"
            aria-label={`Remove ${item.file.name}`}
            className="grid size-5 shrink-0 place-items-center rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => onRemove(item.id)}
          >
            <X className="size-3" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  )
}

function RejectionRows({
  rejections,
}: {
  rejections: DropzoneFileRejection[]
}) {
  if (rejections.length === 0) return null

  return (
    <div className="mt-3 space-y-1 text-xs text-destructive">
      {rejections.map((rejection) => (
        <div key={`${rejection.file.name}-${rejection.reason}`}>
          {rejection.file.name}: {rejection.message}
        </div>
      ))}
    </div>
  )
}
