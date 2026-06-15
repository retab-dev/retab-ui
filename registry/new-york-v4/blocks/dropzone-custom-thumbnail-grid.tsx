"use client"

import { Upload } from "lucide-react"

import { cn } from "@/lib/utils"
import { useDropzone } from "@/components/ui/dropzone"
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
          {...dropzone.getTriggerProps({
            native: true,
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
