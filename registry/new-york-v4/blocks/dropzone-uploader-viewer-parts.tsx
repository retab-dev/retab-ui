"use client"

import * as React from "react"
import { Eye, Upload, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { blobSource } from "@/lib/viewer-resource"
import type { BlobViewerSource } from "@/lib/viewer-source"
import {
  useDropzone,
  type DropzoneFileItem,
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

const DEFAULT_UPLOADABLE_VIEWER_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.csv,.txt,.md,.json,application/pdf,image/*,text/*,text/csv,application/json"

export interface UploadableFileViewerProviderProps {
  accept?: string
  children: React.ReactNode
}

type UploadableFileViewerContextValue = {
  dropzone: UseDropzoneReturn
  selectedFile: DropzoneFileItem | undefined
  viewerSource: BlobViewerSource | null
}

export type UploadableFileViewerRootState = {
  dropzone: UseDropzoneReturn
}

export type UploadableFileViewerHeaderState = {
  dropzone: UseDropzoneReturn
  selectedFile: DropzoneFileItem | undefined
}

export type UploadableFileViewerSummaryState = {
  dropzone: UseDropzoneReturn
  selectedFile: DropzoneFileItem | undefined
}

export type UploadableFileViewerContentState = {
  dropzone: UseDropzoneReturn
  viewerSource: BlobViewerSource | null
}

const UploadableFileViewerContext =
  React.createContext<UploadableFileViewerContextValue | null>(null)

export function useUploadableFileViewer() {
  const context = React.useContext(UploadableFileViewerContext)
  if (!context) {
    throw new Error(
      "useUploadableFileViewer must be used within UploadableFileViewerProvider."
    )
  }
  return context
}

export function useUploadableFileViewerRoot(): UploadableFileViewerRootState {
  const { dropzone } = useUploadableFileViewer()
  return { dropzone }
}

export function useUploadableFileViewerHeader(): UploadableFileViewerHeaderState {
  const { dropzone, selectedFile } = useUploadableFileViewer()
  return { dropzone, selectedFile }
}

export function useUploadableFileViewerSummary(): UploadableFileViewerSummaryState {
  const { dropzone, selectedFile } = useUploadableFileViewer()
  return { dropzone, selectedFile }
}

export function useUploadableFileViewerContent(): UploadableFileViewerContentState {
  const { dropzone, viewerSource } = useUploadableFileViewer()
  return { dropzone, viewerSource }
}

export function UploadableFileViewerProvider({
  accept = DEFAULT_UPLOADABLE_VIEWER_ACCEPT,
  children,
}: UploadableFileViewerProviderProps) {
  const dropzone = useDropzone({
    accept,
    maxFiles: 1,
    multiple: false,
  })
  const selectedFile = dropzone.files[0]
  const viewerSource = React.useMemo(() => {
    if (!selectedFile) return null

    return blobSource(selectedFile.file, {
      fileName: selectedFile.file.name,
      identityKey: selectedFile.id,
      mimeType: selectedFile.file.type || undefined,
    })
  }, [selectedFile])
  const value = React.useMemo<UploadableFileViewerContextValue>(
    () => ({
      dropzone,
      selectedFile,
      viewerSource,
    }),
    [dropzone, selectedFile, viewerSource]
  )

  return (
    <UploadableFileViewerContext.Provider value={value}>
      <section {...dropzone.getRootProps({ className: "contents" })}>
        <input {...dropzone.getInputProps({ className: "hidden" })} />
        {children}
      </section>
    </UploadableFileViewerContext.Provider>
  )
}

export function UploadableFileViewerRoot({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { dropzone } = useUploadableFileViewerRoot()

  return (
    <ViewerRoot
      bare
      defaultSidebarOpen
      className={cn(
        "min-h-[30rem] rounded-lg border bg-background text-foreground transition-colors",
        dropzone.isDragging && "border-foreground/40 bg-accent/35",
        className
      )}
    >
      {children}
    </ViewerRoot>
  )
}

export function UploadableFileViewerHeader() {
  const { dropzone, selectedFile } = useUploadableFileViewerHeader()

  return (
    <ViewerHeader className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <ViewerSidebarTrigger />
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Eye className="size-4 text-muted-foreground" aria-hidden />
            Uploader + viewer
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {selectedFile
              ? selectedFile.file.name
              : "One upload surface that becomes the viewer."}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {selectedFile ? (
          <button
            type="button"
            className="grid size-8 place-items-center rounded-md border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Remove ${selectedFile.file.name}`}
            onClick={dropzone.clearFiles}
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
        <button
          {...dropzone.getButtonProps({
            className:
              "inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          <Upload className="size-3.5" aria-hidden />
          {selectedFile ? "Replace" : "Upload file"}
        </button>
      </div>
    </ViewerHeader>
  )
}

export function UploadableFileViewerSummary() {
  const { dropzone, selectedFile } = useUploadableFileViewerSummary()

  return (
    <ViewerSidebar
      width="16rem"
      className="border-b bg-muted/20 p-4 md:border-r md:border-b-0"
    >
      {selectedFile ? (
        <UploadableFileViewerFileCard fileItem={selectedFile} />
      ) : (
        <UploadableFileViewerNoFile />
      )}
      {!selectedFile ? (
        <button
          {...dropzone.getButtonProps({
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

export function UploadableFileViewerContent({
  renderViewer,
}: {
  renderViewer?: (source: BlobViewerSource) => React.ReactNode
}) {
  const { dropzone, viewerSource } = useUploadableFileViewerContent()

  return (
    <ViewerSurface className="min-h-[24rem] bg-muted/10 p-3">
      {viewerSource ? (
        renderViewer ? (
          renderViewer(viewerSource)
        ) : (
          <FileViewer
            source={viewerSource}
            bare
            className="size-full min-h-0"
          />
        )
      ) : (
        <UploadableFileViewerEmptyState dropzone={dropzone} />
      )}
    </ViewerSurface>
  )
}

function UploadableFileViewerFileCard({
  fileItem,
}: {
  fileItem: DropzoneFileItem
}) {
  return (
    <div className="space-y-3">
      <FileThumbnail
        file={fileItem.file}
        previewAspectRatio={1}
        className="size-20 bg-background shadow-sm"
      />
      <div className="min-w-0">
        <div className="line-clamp-3 text-sm leading-snug font-medium break-words">
          {fileItem.file.name}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {formatFileSize(fileItem.file.size)}
        </div>
      </div>
      <div className="rounded-md border bg-background p-2 text-xs text-muted-foreground">
        {fileItem.file.type || "Unknown type"}
      </div>
    </div>
  )
}

function UploadableFileViewerNoFile() {
  return (
    <div>
      <div className="text-sm font-medium">No file selected</div>
      <div className="mt-1 text-xs text-muted-foreground">
        PDF, image, CSV, text, Markdown, or JSON.
      </div>
    </div>
  )
}

function UploadableFileViewerEmptyState({
  dropzone,
}: {
  dropzone: UseDropzoneReturn
}) {
  return (
    <div
      {...dropzone.getTriggerProps({
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
      </div>
    </div>
  )
}
