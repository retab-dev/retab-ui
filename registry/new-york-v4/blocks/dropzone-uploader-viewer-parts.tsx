"use client"

import * as React from "react"
import { Upload, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { blobSource } from "@/lib/viewer-resource"
import type { BlobViewerSource } from "@/lib/viewer-source"
import {
  useDropzone,
  type DropzoneFileItem,
  type DropzoneFileRejection,
  type DropzoneIntake,
  type UseDropzoneReturn,
} from "@/components/ui/dropzone"
import { formatFileSize } from "@/components/ui/file-size-format"
import { FileThumbnail } from "@/components/ui/file-thumbnail"
import { FileViewer } from "@/components/ui/file-viewer"
import {
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSidebarTrigger,
  ViewerSurface,
} from "@/components/ui/viewer"

const DEFAULT_FILE_INTAKE_VIEWER_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.csv,.txt,.md,.json,application/pdf,image/*,text/*,text/csv,application/json"

export interface FileIntakeViewerProviderProps {
  accept?: string
  defaultFiles?: DropzoneFileItem[]
  disabled?: boolean
  files?: DropzoneFileItem[]
  maxSize?: number
  onFilesChange?: (files: DropzoneFileItem[]) => void
  onIntake?: (intake: DropzoneIntake) => void
  children: React.ReactNode
}

type FileIntakeViewerModel = {
  canClear: boolean
  hasFile: boolean
  isDragging: boolean
  rejection: FileIntakeViewerRejection | null
  selectedFile: DropzoneFileItem | null
  selectedFileSummary: FileIntakeSummary | null
  viewerSource: BlobViewerSource | null
}

type FileIntakeSummary = {
  file: File
  fileName: string
  fileSizeLabel: string
  fileTypeLabel: string
}

export type FileIntakeViewerRejection = {
  title: string
  description: string
}

type FileIntakeViewerActions = {
  clearFile: () => void
  getRootDropProps: UseDropzoneReturn["getRootProps"]
  getFileInputProps: UseDropzoneReturn["getInputProps"]
  getUploadButtonProps: UseDropzoneReturn["getTriggerProps"]
  getEmptySurfaceProps: UseDropzoneReturn["getTriggerProps"]
}

type FileIntakeViewerContextValue = {
  actions: FileIntakeViewerActions
  model: FileIntakeViewerModel
}

type FileIntakeViewerDropTargetState = {
  getFileInputProps: FileIntakeViewerActions["getFileInputProps"]
  getRootDropProps: FileIntakeViewerActions["getRootDropProps"]
  isDragging: boolean
}

type FileIntakeViewerHeaderState = {
  canClear: boolean
  clearFile: FileIntakeViewerActions["clearFile"]
  getUploadButtonProps: FileIntakeViewerActions["getUploadButtonProps"]
  selectedFileSummary: FileIntakeSummary | null
}

type FileIntakeViewerSidebarState = {
  getUploadButtonProps: FileIntakeViewerActions["getUploadButtonProps"]
  selectedFileSummary: FileIntakeSummary | null
}

export type FileIntakeViewerSurfaceState = {
  getEmptySurfaceProps: UseDropzoneReturn["getTriggerProps"]
  rejection: FileIntakeViewerRejection | null
  viewerSource: BlobViewerSource | null
}

const FileIntakeViewerContext =
  React.createContext<FileIntakeViewerContextValue | null>(null)

function useFileIntakeViewerContext(): FileIntakeViewerContextValue {
  const context = React.useContext(FileIntakeViewerContext)
  if (!context) {
    throw new Error(
      "useFileIntakeViewer must be used within FileIntakeViewerProvider."
    )
  }
  return context
}

function useFileIntakeViewerDropTarget(): FileIntakeViewerDropTargetState {
  const { actions, model } = useFileIntakeViewerContext()
  return {
    getFileInputProps: actions.getFileInputProps,
    getRootDropProps: actions.getRootDropProps,
    isDragging: model.isDragging,
  }
}

function useFileIntakeViewerHeader(): FileIntakeViewerHeaderState {
  const { actions, model } = useFileIntakeViewerContext()
  return {
    canClear: model.canClear,
    clearFile: actions.clearFile,
    getUploadButtonProps: actions.getUploadButtonProps,
    selectedFileSummary: model.selectedFileSummary,
  }
}

function useFileIntakeViewerSidebar(): FileIntakeViewerSidebarState {
  const { actions, model } = useFileIntakeViewerContext()
  return {
    getUploadButtonProps: actions.getUploadButtonProps,
    selectedFileSummary: model.selectedFileSummary,
  }
}

export function useFileIntakeViewerSurface(): FileIntakeViewerSurfaceState {
  const { actions, model } = useFileIntakeViewerContext()
  return {
    getEmptySurfaceProps: actions.getEmptySurfaceProps,
    rejection: model.rejection,
    viewerSource: model.viewerSource,
  }
}

export function FileIntakeViewerProvider({
  accept = DEFAULT_FILE_INTAKE_VIEWER_ACCEPT,
  defaultFiles,
  disabled,
  files,
  maxSize,
  onFilesChange,
  onIntake,
  children,
}: FileIntakeViewerProviderProps) {
  const dropzone = useDropzone({
    accept,
    defaultFiles,
    disabled,
    files,
    maxFiles: 1,
    maxSize,
    multiple: false,
    onFilesChange,
    onIntake,
  })
  const { clearFiles, getInputProps, getRootProps, getTriggerProps } = dropzone
  const model = React.useMemo<FileIntakeViewerModel>(
    () =>
      createFileIntakeViewerModel({
        files: dropzone.files,
        isDisabled: dropzone.isDisabled,
        isDragging: dropzone.isDragging,
        lastIntake: dropzone.lastIntake,
      }),
    [
      dropzone.files,
      dropzone.isDisabled,
      dropzone.isDragging,
      dropzone.lastIntake,
    ]
  )
  const actions = React.useMemo<FileIntakeViewerActions>(
    () => ({
      clearFile: clearFiles,
      getRootDropProps: getRootProps,
      getFileInputProps: getInputProps,
      getUploadButtonProps: (props) =>
        getTriggerProps({ ...props, native: true }),
      getEmptySurfaceProps: getTriggerProps,
    }),
    [clearFiles, getInputProps, getRootProps, getTriggerProps]
  )
  const value = React.useMemo<FileIntakeViewerContextValue>(
    () => ({
      actions,
      model,
    }),
    [actions, model]
  )

  return (
    <FileIntakeViewerContext.Provider value={value}>
      {children}
    </FileIntakeViewerContext.Provider>
  )
}

export function FileIntakeViewerDropTarget({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { getFileInputProps, getRootDropProps } =
    useFileIntakeViewerDropTarget()

  return (
    <section
      {...getRootDropProps({
        className: cn("group/file-intake-drop contents", className),
      })}
    >
      <input {...getFileInputProps({ className: "hidden" })} />
      {children}
    </section>
  )
}

export function FileIntakeViewerRoot({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <ViewerRoot
      bare
      defaultOpen
      mode="inline"
      className={cn(
        "min-h-[30rem] rounded-lg border bg-background text-foreground transition-colors",
        "group-data-[dragging]/file-intake-drop:border-foreground/40 group-data-[dragging]/file-intake-drop:bg-accent/35",
        className
      )}
    >
      {children}
    </ViewerRoot>
  )
}

export function FileIntakeViewerHeader() {
  const { canClear, clearFile, getUploadButtonProps, selectedFileSummary } =
    useFileIntakeViewerHeader()

  return (
    <ViewerHeader className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <ViewerSidebarTrigger />
        <div className="min-w-0">
          <div className="text-sm font-medium">File preview</div>
          {selectedFileSummary ? (
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {selectedFileSummary.fileName}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {selectedFileSummary && canClear ? (
          <button
            type="button"
            className="grid size-8 place-items-center rounded-md border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Remove ${selectedFileSummary.fileName}`}
            onClick={clearFile}
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
        <button
          {...getUploadButtonProps({
            "aria-label": selectedFileSummary
              ? `Replace ${selectedFileSummary.fileName}`
              : "Upload file",
            className:
              "inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          <Upload className="size-3.5" aria-hidden />
          {selectedFileSummary ? "Replace" : "Upload file"}
        </button>
      </div>
    </ViewerHeader>
  )
}

export function FileIntakeViewerSidebar() {
  const { getUploadButtonProps, selectedFileSummary } =
    useFileIntakeViewerSidebar()

  return (
    <ViewerSidebar
      aria-label="Selected file"
      width="12rem"
      className="border-b bg-background p-3 md:border-r md:border-b-0"
    >
      {selectedFileSummary ? (
        <FileIntakeViewerFileCard fileSummary={selectedFileSummary} />
      ) : (
        <FileIntakeViewerNoFile />
      )}
      {!selectedFileSummary ? (
        <button
          {...getUploadButtonProps({
            "aria-label": "Upload file",
            className:
              "mt-4 inline-flex h-8 w-fit cursor-pointer items-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          <Upload className="size-3.5" aria-hidden />
          Upload file
        </button>
      ) : null}
    </ViewerSidebar>
  )
}

export function FileIntakeViewerSurface() {
  const { getEmptySurfaceProps, rejection, viewerSource } =
    useFileIntakeViewerSurface()

  return (
    <ViewerSurface className="min-h-[24rem]">
      {viewerSource ? (
        <FileViewer source={viewerSource} bare className="size-full min-h-0" />
      ) : (
        <FileIntakeViewerEmptyState
          getEmptySurfaceProps={getEmptySurfaceProps}
          rejection={rejection}
        />
      )}
    </ViewerSurface>
  )
}

function FileIntakeViewerFileCard({
  fileSummary,
}: {
  fileSummary: FileIntakeSummary
}) {
  return (
    <div className="space-y-3">
      <FileThumbnail
        file={fileSummary.file}
        thumbnailShape="square"
        thumbnailSize="xl"
        className="bg-background shadow-sm"
      />
      <div className="min-w-0">
        <div className="line-clamp-3 text-sm leading-snug font-medium break-words">
          {fileSummary.fileName}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {fileSummary.fileSizeLabel}
        </div>
      </div>
      <div className="rounded-md border bg-background p-2 text-xs text-muted-foreground">
        {fileSummary.fileTypeLabel}
      </div>
    </div>
  )
}

function FileIntakeViewerNoFile() {
  return (
    <div>
      <div className="text-sm font-medium">No file selected</div>
      <div className="mt-1 text-xs text-muted-foreground">
        PDF, image, CSV, text, Markdown, or JSON.
      </div>
    </div>
  )
}

function FileIntakeViewerEmptyState({
  getEmptySurfaceProps,
  rejection,
}: {
  getEmptySurfaceProps: FileIntakeViewerActions["getEmptySurfaceProps"]
  rejection: FileIntakeViewerRejection | null
}) {
  return (
    <div
      {...getEmptySurfaceProps({
        "aria-label": "Upload file",
        className:
          "grid h-full min-h-[26rem] cursor-pointer place-items-center rounded-md border border-dashed bg-background p-6 text-center outline-none transition-colors hover:bg-muted/30 focus-visible:ring-[3px] focus-visible:ring-ring/24",
      })}
    >
      <div>
        <div className="mx-auto grid size-12 place-items-center rounded-md border bg-muted/30 text-muted-foreground">
          <Upload className="size-5" aria-hidden />
        </div>
        <div className="mt-4 text-sm font-medium">Upload file</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Drop a file here to open it in the viewer.
        </div>
        {rejection ? (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <div className="font-medium">{rejection.title}</div>
            <div className="mt-1 text-destructive/80">
              {rejection.description}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function getSelectedFileIntakeFile(files: DropzoneFileItem[]) {
  return files[0] ?? null
}

function createFileIntakeSummary(
  fileItem: DropzoneFileItem | null
): FileIntakeSummary | null {
  if (!fileItem) return null

  return {
    file: fileItem.file,
    fileName: fileItem.file.name,
    fileSizeLabel: formatFileSize(fileItem.file.size),
    fileTypeLabel: fileItem.file.type || "Unknown type",
  }
}

function createFileIntakeViewerSource(
  fileItem: DropzoneFileItem
): BlobViewerSource {
  return blobSource(fileItem.file, {
    fileName: fileItem.file.name,
    identityKey: fileItem.id,
    mimeType: fileItem.file.type || undefined,
  })
}

function createFileIntakeViewerModel(
  dropzone: Pick<
    UseDropzoneReturn,
    "files" | "isDragging" | "isDisabled" | "lastIntake"
  >
): FileIntakeViewerModel {
  const selectedFile = getSelectedFileIntakeFile(dropzone.files)
  const selectedFileSummary = createFileIntakeSummary(selectedFile)
  const viewerSource = selectedFile
    ? createFileIntakeViewerSource(selectedFile)
    : null

  return {
    canClear: selectedFile !== null && !dropzone.isDisabled,
    hasFile: selectedFile !== null,
    isDragging: dropzone.isDragging,
    rejection: createFileIntakeViewerRejection(dropzone.lastIntake),
    selectedFile,
    selectedFileSummary,
    viewerSource,
  }
}

function createFileIntakeViewerRejection(
  intake: DropzoneIntake
): FileIntakeViewerRejection | null {
  if (intake.acceptedFiles.length > 0 || intake.fileRejections.length === 0) {
    return null
  }

  return describeFileIntakeRejection(intake.fileRejections[0])
}

function describeFileIntakeRejection(
  rejection: DropzoneFileRejection
): FileIntakeViewerRejection {
  if (rejection.reason === "file-invalid-type") {
    return {
      title: "Unsupported file type",
      description: `${rejection.file.name} cannot be opened here.`,
    }
  }

  if (rejection.reason === "file-too-large") {
    return {
      title: "File is too large",
      description: `${rejection.file.name} must be ${formatFileSize(
        rejection.maxSize
      )} or smaller.`,
    }
  }

  return {
    title: "Only one file can be previewed",
    description: `${rejection.file.name} was not added.`,
  }
}
