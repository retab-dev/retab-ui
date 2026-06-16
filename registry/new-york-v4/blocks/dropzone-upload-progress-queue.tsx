"use client"

import * as React from "react"
import { CheckCircle2, FileText, UploadCloud, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useDropzone } from "@/components/ui/dropzone"
import { formatFileSize } from "@/components/ui/file-size-format"

import {
  RejectionRows,
  type DropzoneExampleProps,
} from "./dropzone-example-shared"

type UploadState = {
  progress: number
  status: "uploading" | "done"
}

/**
 * Dropzone owns file intake; the upload transport is the consumer's job. This
 * example simulates a per-file upload and renders its progress. Real code would
 * swap the interval for `fetch`/`XMLHttpRequest` with an `onprogress` handler.
 */
export function UploadProgressQueue({ className }: DropzoneExampleProps) {
  const dropzone = useDropzone({ maxFiles: 5, multiple: true })
  const [uploads, setUploads] = React.useState<Record<string, UploadState>>({})
  const timers = React.useRef<Record<string, ReturnType<typeof setInterval>>>(
    {}
  )

  // Start a simulated upload for every file the dropzone admits that we have
  // not seen yet. The dropzone owns the canonical file id, so we key off it.
  React.useEffect(() => {
    dropzone.files.forEach((item) => {
      if (timers.current[item.id] !== undefined) return

      setUploads((prev) =>
        prev[item.id]
          ? prev
          : { ...prev, [item.id]: { progress: 0, status: "uploading" } }
      )

      timers.current[item.id] = setInterval(() => {
        setUploads((prev) => {
          const current = prev[item.id]
          if (!current || current.status === "done") return prev

          const progress = Math.min(100, current.progress + 9 + Math.random() * 11)
          if (progress >= 100) {
            clearInterval(timers.current[item.id])
            delete timers.current[item.id]
            return { ...prev, [item.id]: { progress: 100, status: "done" } }
          }
          return { ...prev, [item.id]: { progress, status: "uploading" } }
        })
      }, 280)
    })
  }, [dropzone.files])

  React.useEffect(() => {
    const pending = timers.current
    return () => {
      Object.values(pending).forEach((timer) => clearInterval(timer))
    }
  }, [])

  const handleRemove = (id: string) => {
    if (timers.current[id] !== undefined) {
      clearInterval(timers.current[id])
      delete timers.current[id]
    }
    setUploads((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    dropzone.removeFile(id)
  }

  const uploading = dropzone.files.filter(
    (item) => uploads[item.id]?.status !== "done"
  ).length

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
            <UploadCloud className="size-4 text-muted-foreground" aria-hidden />
            Upload queue
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {uploading > 0
              ? `Uploading ${uploading} file${uploading === 1 ? "" : "s"}…`
              : "Intake into React state, then upload."}
          </div>
        </div>
        <button
          {...dropzone.getTriggerProps({
            native: true,
            className:
              "inline-flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          <UploadCloud className="size-3.5" aria-hidden />
          Add files
        </button>
      </div>
      <div className="mt-4 min-h-36 rounded-md border border-dashed bg-muted/20 p-2">
        {dropzone.files.length ? (
          <div className="space-y-2">
            {dropzone.files.map((item) => {
              const upload = uploads[item.id]
              const progress = upload?.progress ?? 0
              const done = upload?.status === "done"
              return (
                <div
                  key={item.id}
                  className="flex min-w-0 items-center gap-3 rounded-md border bg-background p-2 text-xs"
                >
                  <FileText
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {item.file.name}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {done ? "Done" : `${Math.round(progress)}%`}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress)}
                      aria-label={`Uploading ${item.file.name}`}
                      className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-300 ease-out",
                          done ? "bg-emerald-500" : "bg-foreground/70"
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {formatFileSize(item.file.size)}
                    </div>
                  </div>
                  {done ? (
                    <CheckCircle2
                      className="size-4 shrink-0 text-emerald-500"
                      aria-hidden
                    />
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Remove ${item.file.name}`}
                    className="grid size-6 shrink-0 place-items-center rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => handleRemove(item.id)}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid h-32 place-items-center text-center text-xs text-muted-foreground">
            Drop files to start uploading.
          </div>
        )}
      </div>
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  )
}
