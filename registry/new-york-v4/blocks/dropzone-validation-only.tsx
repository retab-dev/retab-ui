"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  useDropzone,
  type DropzoneFileRejection,
} from "@/components/ui/dropzone"

import {
  RejectionRows,
  type DropzoneExampleProps,
} from "./dropzone-example-shared"

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
