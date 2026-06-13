"use client"

import * as React from "react"
import { Paperclip, Upload } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  useDropzone,
  type DropzoneFileItem,
  type DropzoneFileRejection,
} from "@/components/ui/dropzone"

import {
  InlineFileRows,
  RejectionRows,
  type DropzoneExampleProps,
} from "./dropzone-example-shared"

export function NonButtonTrigger({ className }: DropzoneExampleProps) {
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

export function NativeButtonQueue({ className }: DropzoneExampleProps) {
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

export function ControlledQueue({ className }: DropzoneExampleProps) {
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

export function ValidationOnly({ className }: DropzoneExampleProps) {
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

export function DisabledDropzone({ className }: DropzoneExampleProps) {
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
