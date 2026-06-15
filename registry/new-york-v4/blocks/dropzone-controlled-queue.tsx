"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useDropzone, type DropzoneFileItem } from "@/components/ui/dropzone"

import {
  InlineFileRows,
  RejectionRows,
  type DropzoneExampleProps,
} from "./dropzone-example-shared"

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
            {...dropzone.getTriggerProps({
              native: true,
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
