"use client"

import * as React from "react"

import { blobSource } from "@/lib/viewer-resource"
import type { BlobViewerSource } from "@/lib/viewer-source"
import { useDropzone } from "@/components/ui/dropzone"

import {
  UploaderViewerEmptyState,
  UploaderViewerFrame,
  UploaderViewerHeader,
  UploaderViewerInput,
  UploaderViewerMain,
  UploaderViewerRoot,
  UploaderViewerSidebar,
} from "./dropzone-uploader-viewer-parts"

export type DropzoneUploaderViewerProps = {
  className?: string
  renderViewer: (source: BlobViewerSource) => React.ReactNode
}

export function DropzoneUploaderViewer({
  className,
  renderViewer,
}: DropzoneUploaderViewerProps) {
  const dropzone = useDropzone({
    accept:
      ".pdf,.png,.jpg,.jpeg,.csv,.txt,.md,.json,application/pdf,image/*,text/*,text/csv,application/json",
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

  return (
    <UploaderViewerRoot dropzone={dropzone} className={className}>
      <UploaderViewerInput dropzone={dropzone} />
      <UploaderViewerFrame>
        <UploaderViewerHeader dropzone={dropzone} selectedFile={selectedFile} />
        <div className="grid flex-1 md:grid-cols-[16rem_minmax(0,1fr)]">
          <UploaderViewerSidebar
            dropzone={dropzone}
            selectedFile={selectedFile}
          />
          <UploaderViewerMain>
            {viewerSource ? (
              renderViewer(viewerSource)
            ) : (
              <UploaderViewerEmptyState dropzone={dropzone} />
            )}
          </UploaderViewerMain>
        </div>
      </UploaderViewerFrame>
    </UploaderViewerRoot>
  )
}
