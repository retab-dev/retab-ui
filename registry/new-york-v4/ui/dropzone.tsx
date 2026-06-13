"use client"

import * as React from "react"
import {
  FileImage,
  FileSpreadsheet,
  FileText,
  Upload,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

export type DropzoneAcceptedFileType = {
  label: string
  icon: LucideIcon
}

export type DropzoneFileRejection = {
  file: File
  reason: "file-invalid-type" | "file-too-large"
  message: string
}

export type DropzoneProps = Omit<
  React.ComponentPropsWithoutRef<"div">,
  "children" | "onDrop"
> & {
  accept?: string
  acceptedFileTypes?: DropzoneAcceptedFileType[]
  browseLabel?: string
  description?: string
  disabled?: boolean
  draggingLabel?: string
  maxSize?: number
  multiple?: boolean
  title?: string
  onFilesAccepted?: (files: File[]) => void
  onFilesRejected?: (rejections: DropzoneFileRejection[]) => void
}

const ACCEPTED_FILE_TYPES: DropzoneAcceptedFileType[] = [
  { label: "Image", icon: FileImage },
  { label: "PDF", icon: FileText },
  { label: "Sheet", icon: FileSpreadsheet },
]

const ICON_TRANSFORMS = [
  {
    idle: "translate(-78%, -50%) rotate(-8deg)",
    active: "translate(-114%, -50%) rotate(-12deg) scale(1.08)",
  },
  {
    idle: "translate(-50%, -50%) rotate(0deg)",
    active: "translate(-50%, -50%) rotate(0deg) scale(1.18)",
  },
  {
    idle: "translate(-22%, -50%) rotate(8deg)",
    active: "translate(14%, -50%) rotate(12deg) scale(1.08)",
  },
]

export function Dropzone({
  accept,
  acceptedFileTypes = ACCEPTED_FILE_TYPES,
  browseLabel = "Browse files",
  className,
  description = "PDF, DOCX, XLSX, CSV, PNG, or JPG",
  disabled = false,
  draggingLabel = "Drop to add",
  maxSize,
  multiple = true,
  title = "Click to upload or drop files",
  onFilesAccepted,
  onFilesRejected,
  ...props
}: DropzoneProps) {
  const dragDepthRef = React.useRef(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [rejectionMessage, setRejectionMessage] = React.useState<string | null>(
    null
  )

  const commitFiles = React.useCallback(
    (nextFiles: FileList | File[]) => {
      const files = Array.from(nextFiles).slice(0, multiple ? undefined : 1)
      const acceptedFiles: File[] = []
      const rejections: DropzoneFileRejection[] = []

      for (const file of files) {
        const rejection = validateDropzoneFile(file, { accept, maxSize })
        if (rejection) rejections.push(rejection)
        else acceptedFiles.push(file)
      }

      if (rejections.length > 0) {
        setRejectionMessage(rejections[0]?.message ?? null)
        onFilesRejected?.(rejections)
      } else {
        setRejectionMessage(null)
      }

      if (acceptedFiles.length > 0) {
        onFilesAccepted?.(acceptedFiles)
      }
    },
    [accept, maxSize, multiple, onFilesAccepted, onFilesRejected]
  )

  const openFileDialog = React.useCallback(() => {
    if (!disabled) inputRef.current?.click()
  }, [disabled])

  const resetDragState = React.useCallback(() => {
    dragDepthRef.current = 0
    setIsDragging(false)
  }, [])

  return (
    <div
      {...props}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      data-dragging={isDragging ? "" : undefined}
      data-slot="dropzone"
      className={cn(
        "relative flex min-h-64 cursor-pointer flex-col items-center justify-center gap-5 overflow-hidden rounded-lg border border-dashed bg-background px-6 py-10 text-center outline-none transition-[border-color,background-color,box-shadow] duration-200 ease-out",
        "motion-reduce:transition-none",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24",
        isDragging
          ? "border-foreground/40 bg-accent/35"
          : "border-foreground/20 hover:border-foreground/35 hover:bg-muted/35 dark:border-foreground/25 dark:hover:border-foreground/40",
        disabled &&
          "pointer-events-none cursor-not-allowed opacity-60 hover:border-foreground/20 hover:bg-background",
        className
      )}
      onClick={(event) => {
        props.onClick?.(event)
        if (!event.defaultPrevented) openFileDialog()
      }}
      onDragEnter={(event) => {
        props.onDragEnter?.(event)
        if (event.defaultPrevented || disabled) return
        event.preventDefault()
        if (!hasDraggedFiles(event.dataTransfer)) return
        dragDepthRef.current += 1
        setIsDragging(true)
      }}
      onDragLeave={(event) => {
        props.onDragLeave?.(event)
        if (event.defaultPrevented || disabled) return
        event.preventDefault()
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
        if (dragDepthRef.current === 0) setIsDragging(false)
      }}
      onDragOver={(event) => {
        props.onDragOver?.(event)
        if (event.defaultPrevented || disabled) return
        if (!hasDraggedFiles(event.dataTransfer)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
      }}
      onDrop={(event) => {
        if (disabled) return
        event.preventDefault()
        resetDragState()
        if (event.dataTransfer.files.length > 0) {
          commitFiles(event.dataTransfer.files)
        }
      }}
      onKeyDown={(event) => {
        props.onKeyDown?.(event)
        if (event.defaultPrevented || disabled) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          openFileDialog()
        }
      }}
    >
      <DropzoneIconCluster
        acceptedFileTypes={acceptedFileTypes}
        isDragging={isDragging}
      />
      <div className="space-y-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
        {rejectionMessage ? (
          <div className="text-xs text-destructive">{rejectionMessage}</div>
        ) : null}
      </div>
      <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
        <Upload className="size-3.5" aria-hidden />
        <span>{isDragging ? draggingLabel : browseLabel}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        aria-label={title}
        onChange={(event) => {
          if (event.target.files) {
            commitFiles(event.target.files)
            event.currentTarget.value = ""
          }
        }}
      />
    </div>
  )
}

function DropzoneIconCluster({
  acceptedFileTypes,
  isDragging,
}: {
  acceptedFileTypes: DropzoneAcceptedFileType[]
  isDragging: boolean
}) {
  const visibleTypes = acceptedFileTypes.slice(0, 3)
  const singleIcon = visibleTypes.length === 1

  return (
    <div className="relative h-14 w-36" aria-hidden>
      {visibleTypes.map((item, index) => {
        const Icon = item.icon

        return (
          <div
            key={item.label}
            className={cn(
              "absolute top-1/2 left-1/2 grid size-12 place-items-center rounded-lg border bg-background text-muted-foreground shadow-xs transition-[transform,color,background-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              "motion-reduce:transition-none",
              index === 1 && "z-10",
              isDragging &&
                "bg-popover text-foreground shadow-md shadow-black/10 dark:shadow-black/25"
            )}
            style={{
              transform: singleIcon
                ? `translate(-50%, -50%) scale(${isDragging ? 1.14 : 1})`
                : isDragging
                  ? ICON_TRANSFORMS[index]?.active
                  : ICON_TRANSFORMS[index]?.idle,
            }}
          >
            <Icon className="size-5" />
          </div>
        )
      })}
    </div>
  )
}

export function validateDropzoneFile(
  file: File,
  {
    accept,
    maxSize,
  }: {
    accept?: string
    maxSize?: number
  }
): DropzoneFileRejection | null {
  if (!matchesDropzoneAccept(file, accept)) {
    return {
      file,
      reason: "file-invalid-type",
      message: "This file type is not supported here.",
    }
  }

  if (maxSize !== undefined && file.size > maxSize) {
    return {
      file,
      reason: "file-too-large",
      message: `File must be ${formatDropzoneBytes(maxSize)} or smaller.`,
    }
  }

  return null
}

export function matchesDropzoneAccept(file: File, accept?: string): boolean {
  if (!accept) return true

  return accept.split(",").some((rawToken) => {
    const token = rawToken.trim().toLowerCase()

    if (!token) return false
    if (token.startsWith(".")) return file.name.toLowerCase().endsWith(token)
    if (token.endsWith("/*")) {
      return file.type.toLowerCase().startsWith(token.slice(0, -1))
    }

    return file.type.toLowerCase() === token
  })
}

export function formatDropzoneBytes(bytes: number): string {
  if (bytes === 0) return "0 B"

  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )

  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${
    units[index]
  }`
}

function hasDraggedFiles(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false
  if (dataTransfer.items?.length) {
    return Array.from(dataTransfer.items).some((item) => item.kind === "file")
  }

  return Array.from(dataTransfer.types).includes("Files")
}
