"use client"

import { Table2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useDropzone } from "@/components/ui/dropzone"
import { formatFileSize } from "@/components/ui/file-size-format"
import { FileThumbnail } from "@/components/ui/file-thumbnail"

import {
  RejectionRows,
  type DropzoneExampleProps,
} from "./dropzone-example-shared"

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
