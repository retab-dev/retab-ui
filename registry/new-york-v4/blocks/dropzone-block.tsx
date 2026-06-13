"use client"

import * as React from "react"
import {
  Clock3,
  FileAudio,
  FileText,
  ImagePlus,
  Paperclip,
  Table2,
  Upload,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  useDropzone,
  type DropzoneFileItem,
  type DropzoneFileRejection,
} from "@/components/ui/dropzone"
import { formatFileSize } from "@/components/ui/file-size-format"
import { FileThumbnail } from "@/components/ui/file-thumbnail"
import { FileUploader } from "@/components/ui/file-uploader"

export function DropzoneBlock() {
  return (
    <div className="h-full min-h-[760px] overflow-auto bg-background p-5">
      <div className="mx-auto grid max-w-6xl grid-cols-12 gap-4">
        <section className="col-span-12 xl:col-span-7">
          <FileUploader
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg,text/csv"
            className="min-h-[28rem] justify-start pt-8"
            description="PDF, DOCX, XLSX, CSV, PNG, or JPG"
            maxFiles={6}
            multiple
            title="Default file uploader"
          />
        </section>
        <NonButtonTrigger className="col-span-12 md:col-span-6 xl:col-span-5" />
        <NativeButtonQueue className="col-span-12 md:col-span-6 xl:col-span-4" />
        <ControlledQueue className="col-span-12 md:col-span-6 xl:col-span-4" />
        <ValidationOnly className="col-span-12 md:col-span-6 xl:col-span-4" />
        <CustomThumbnailGrid className="col-span-12 xl:col-span-8" />
        <MediaTranscriptQueue className="col-span-12 md:col-span-6 xl:col-span-4" />
        <AvatarImageSlot className="col-span-12 md:col-span-6 xl:col-span-4" />
        <SpreadsheetImportCard className="col-span-12 md:col-span-6 xl:col-span-4" />
        <EvidenceTimeline className="col-span-12 xl:col-span-8" />
        <ComparisonPairUpload className="col-span-12 xl:col-span-6" />
        <IntakeRouter className="col-span-12 xl:col-span-6" />
        <RequiredPacketSlots className="col-span-12 xl:col-span-7" />
        <PinboardDropSurface className="col-span-12 xl:col-span-5" />
        <DisabledDropzone className="col-span-12 xl:col-span-4" />
      </div>
    </div>
  )
}

function NonButtonTrigger({ className }: { className?: string }) {
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
          Non-button trigger
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
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  )
}

function NativeButtonQueue({ className }: { className?: string }) {
  const dropzone = useDropzone({
    accept: "image/*,.pdf",
    maxFiles: 2,
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Native button trigger</div>
          <div className="text-xs text-muted-foreground">
            A real button uses browser button semantics.
          </div>
        </div>
        <button
          {...dropzone.getButtonProps({
            className:
              "inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          <Paperclip className="size-3.5" aria-hidden />
          Add
        </button>
      </div>
      <InlineFileRows files={dropzone.files} onRemove={dropzone.removeFile} />
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  )
}

function ControlledQueue({ className }: { className?: string }) {
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
          "rounded-lg border bg-muted/20 p-4 transition-colors",
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
            Parent-owned file state.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="h-8 rounded-md border px-2 text-xs text-muted-foreground hover:bg-muted"
            onClick={dropzone.clearFiles}
            type="button"
          >
            Clear
          </button>
          <button
            {...dropzone.getButtonProps({
              className:
                "inline-flex h-8 cursor-pointer items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24",
            })}
          >
            Browse
          </button>
        </div>
      </div>
      <InlineFileRows files={files} onRemove={dropzone.removeFile} />
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  )
}

function ValidationOnly({ className }: { className?: string }) {
  const [lastIntake, setLastIntake] = React.useState({
    acceptedFiles: [] as File[],
    fileRejections: [] as DropzoneFileRejection[],
  })
  const dropzone = useDropzone({
    accept: "application/pdf,.pdf",
    files: [],
    maxSize: 100 * 1024,
    multiple: true,
    onFilesChange: () => {},
    onIntake: setLastIntake,
  })

  return (
    <section
      {...dropzone.getRootProps(
        dropzone.getTriggerProps({
          "data-slot": "dropzone",
          className: cn(
            "flex min-h-40 cursor-pointer flex-col justify-center rounded-lg border border-dashed bg-background p-4 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24",
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
        Accepted:{" "}
        {lastIntake.acceptedFiles.map((file) => file.name).join(", ") || "none"}
      </div>
      <RejectionRows rejections={lastIntake.fileRejections} />
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

function MediaTranscriptQueue({ className }: { className?: string }) {
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

function AvatarImageSlot({ className }: { className?: string }) {
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

function SpreadsheetImportCard({ className }: { className?: string }) {
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

function EvidenceTimeline({ className }: { className?: string }) {
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

function ComparisonPairUpload({ className }: { className?: string }) {
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

function IntakeRouter({ className }: { className?: string }) {
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

function RequiredPacketSlots({ className }: { className?: string }) {
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

function PinboardDropSurface({ className }: { className?: string }) {
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

function DisabledDropzone({ className }: { className?: string }) {
  const dropzone = useDropzone({ disabled: true, multiple: true })

  return (
    <section
      {...dropzone.getRootProps(
        dropzone.getTriggerProps({
          "data-slot": "dropzone",
          className: cn(
            "flex min-h-40 flex-col justify-center rounded-lg border border-dashed bg-muted/20 p-4 opacity-60 outline-none",
            className
          ),
        })
      )}
    >
      <input {...dropzone.getInputProps({ className: "hidden" })} />
      <div className="text-sm font-medium">Disabled state</div>
      <div className="mt-1 text-xs text-muted-foreground">
        The primitive disables input, trigger focus, and drag state.
      </div>
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
            {formatFileSize(item.file.size)}
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
          {rejection.file.name}: {getDropzoneRejectionMessage(rejection)}
        </div>
      ))}
    </div>
  )
}

function getDropzoneRejectionMessage(rejection: DropzoneFileRejection): string {
  if (rejection.reason === "file-invalid-type") {
    return "This file type is not supported here."
  }
  if (rejection.reason === "file-too-large") {
    return `File must be ${formatFileSize(rejection.maxSize)} or smaller.`
  }
  return rejection.maxFiles === 1
    ? "Only one file can be selected."
    : `Only ${rejection.maxFiles} files can be selected.`
}
