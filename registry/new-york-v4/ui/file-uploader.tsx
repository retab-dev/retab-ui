"use client"

import * as React from "react"
import {
  FileImage,
  FileSpreadsheet,
  FileText,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  useDropzone,
  type DropzoneFileItem,
  type DropzoneFileRejection,
  type UseDropzoneProps,
} from "@/components/ui/dropzone"
import { formatFileSize } from "@/components/ui/file-size-format"
import { FileThumbnail } from "@/components/ui/file-thumbnail"

export type FileUploaderAcceptedFileType = {
  label: string
  icon: LucideIcon
}

export type FileUploaderProps = UseDropzoneProps &
  Omit<React.ComponentPropsWithoutRef<"div">, "children" | "onDrop"> & {
    acceptedFileTypes?: FileUploaderAcceptedFileType[]
    browseLabel?: React.ReactNode
    description?: React.ReactNode
    draggingLabel?: React.ReactNode
    showFileList?: boolean
    title?: React.ReactNode
  }

const ACCEPTED_FILE_TYPES: FileUploaderAcceptedFileType[] = [
  { label: "Image", icon: FileImage },
  { label: "PDF", icon: FileText },
  { label: "Sheet", icon: FileSpreadsheet },
]

const STATIC_ICON_OFFSETS = [
  "translate(-78%, -50%) rotate(-8deg)",
  "translate(-50%, -50%)",
  "translate(-22%, -50%) rotate(8deg)",
]

export function FileUploader({
  accept,
  acceptedFileTypes = ACCEPTED_FILE_TYPES,
  browseLabel = "Browse files",
  className,
  defaultFiles,
  description = "PDF, DOCX, XLSX, CSV, PNG, or JPG",
  disabled = false,
  draggingLabel = "Drop to add",
  files,
  maxFiles,
  maxSize,
  multiple = true,
  showFileList = true,
  title = "Click to upload or drop files",
  onFilesChange,
  onIntake,
  ...props
}: FileUploaderProps) {
  const dropzone = useDropzone({
    accept,
    defaultFiles,
    disabled,
    files,
    maxFiles,
    maxSize,
    multiple,
    onFilesChange,
    onIntake,
  })
  const rejectionMessage = dropzone.lastIntake.fileRejections[0]
    ? getDropzoneRejectionMessage(dropzone.lastIntake.fileRejections[0])
    : null
  const titleText = typeof title === "string" ? title : "Upload files"
  const triggerProps = dropzone.getTriggerProps<HTMLDivElement>({
    ...props,
    className: cn(
      "relative flex min-h-64 cursor-pointer flex-col items-center justify-center gap-5 overflow-hidden rounded-lg border border-dashed bg-background px-6 py-10 text-center outline-none",
      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24",
      dropzone.isDragging
        ? "border-foreground/40 bg-accent/35"
        : "border-foreground/20 hover:border-foreground/35 hover:bg-muted/35 dark:border-foreground/25 dark:hover:border-foreground/40",
      disabled &&
        "pointer-events-none cursor-not-allowed opacity-60 hover:border-foreground/20 hover:bg-background",
      className
    ),
  })

  return (
    <div
      {...dropzone.getRootProps({ ...triggerProps, "data-slot": "dropzone" })}
    >
      <FileUploaderIconCluster
        acceptedFileTypes={acceptedFileTypes}
        isDragging={dropzone.isDragging}
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
        <span>{dropzone.isDragging ? draggingLabel : browseLabel}</span>
      </div>
      {showFileList && dropzone.files.length > 0 ? (
        <FileUploaderFileList
          files={dropzone.files}
          onRemoveFile={dropzone.removeFile}
        />
      ) : null}
      <input
        {...dropzone.getInputProps({
          "aria-label": titleText,
          className: "hidden",
        })}
      />
    </div>
  )
}

function FileUploaderFileList({
  files,
  onRemoveFile,
}: {
  files: DropzoneFileItem[]
  onRemoveFile: (fileId: string) => void
}) {
  return (
    <div
      data-slot="file-uploader-file-list"
      className="w-full max-w-xl rounded-lg border bg-background/80 p-3 text-left shadow-xs"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-medium">
          {files.length} file{files.length === 1 ? "" : "s"} ready
        </div>
        <div className="text-xs text-muted-foreground">
          {formatFileSize(
            files.reduce((totalSize, item) => totalSize + item.file.size, 0)
          )}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-x-2 gap-y-4">
        {files.map((item) => (
          <FileUploaderFileTile
            key={item.id}
            item={item}
            onRemoveFile={onRemoveFile}
          />
        ))}
      </div>
    </div>
  )
}

function FileUploaderFileTile({
  item,
  onRemoveFile,
}: {
  item: DropzoneFileItem
  onRemoveFile: (fileId: string) => void
}) {
  return (
    <div
      data-slot="file-uploader-file-item"
      className="flex min-w-0 flex-col items-center gap-2"
    >
      <div className="relative">
        <FileThumbnail
          file={item.file}
          thumbnailShape="square"
          thumbnailSize="lg"
          className="shrink-0 bg-background shadow-sm ring-1 ring-black/5"
        />
        <button
          type="button"
          aria-label={`Remove ${item.file.name}`}
          className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-[4px] border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/24 focus-visible:outline-none"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onRemoveFile(item.id)
          }}
          onKeyDown={(event) => {
            event.stopPropagation()
          }}
        >
          <X className="size-3" aria-hidden />
        </button>
      </div>
      <div className="max-w-full text-center">
        <div className="line-clamp-2 text-xs leading-tight break-words text-foreground">
          {item.file.name}
        </div>
        <div className="mt-0.5 truncate text-[0.6875rem] leading-none text-muted-foreground">
          {formatFileSize(item.file.size)}
        </div>
      </div>
    </div>
  )
}

function FileUploaderIconCluster({
  acceptedFileTypes,
  isDragging,
}: {
  acceptedFileTypes: FileUploaderAcceptedFileType[]
  isDragging: boolean
}) {
  const visibleTypes = acceptedFileTypes.slice(0, 3)

  return (
    <div className="relative h-14 w-36" aria-hidden>
      {visibleTypes.map((item, index) => {
        const Icon = item.icon

        return (
          <div
            key={item.label}
            className={cn(
              "absolute top-1/2 left-1/2 grid size-12 place-items-center rounded-lg border bg-background text-muted-foreground shadow-xs",
              index === 1 && "z-10",
              isDragging &&
                "bg-popover text-foreground shadow-md shadow-black/10 dark:shadow-black/25"
            )}
            style={{
              transform:
                visibleTypes.length === 1
                  ? "translate(-50%, -50%)"
                  : STATIC_ICON_OFFSETS[index],
            }}
          >
            <Icon className="size-5" />
          </div>
        )
      })}
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
