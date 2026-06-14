"use client"

import * as React from "react"

import type { BlobViewerSource } from "@/lib/viewer-source"
import type { DropzoneFileItem, DropzoneIntake } from "@/components/ui/dropzone"
import { ViewerBody } from "@/components/ui/viewer"

import {
  FileIntakeViewerHeader,
  FileIntakeViewerProvider,
  FileIntakeViewerRoot,
  FileIntakeViewerSidebar,
  FileIntakeViewerSurface,
} from "./dropzone-uploader-viewer-parts"

export type FileIntakeViewerProps = {
  accept?: string
  className?: string
  defaultFiles?: DropzoneFileItem[]
  disabled?: boolean
  files?: DropzoneFileItem[]
  maxSize?: number
  onFilesChange?: (files: DropzoneFileItem[]) => void
  onIntake?: (intake: DropzoneIntake) => void
  renderViewer?: (source: BlobViewerSource) => React.ReactNode
}

export function FileIntakeViewer({
  accept,
  className,
  defaultFiles,
  disabled,
  files,
  maxSize,
  onFilesChange,
  onIntake,
  renderViewer,
}: FileIntakeViewerProps) {
  return (
    <FileIntakeViewerProvider
      accept={accept}
      defaultFiles={defaultFiles}
      disabled={disabled}
      files={files}
      maxSize={maxSize}
      onFilesChange={onFilesChange}
      onIntake={onIntake}
    >
      <FileIntakeViewerRoot className={className}>
        <FileIntakeViewerHeader />
        <ViewerBody className="flex-col md:flex-row">
          <FileIntakeViewerSidebar />
          <FileIntakeViewerSurface renderViewer={renderViewer} />
        </ViewerBody>
      </FileIntakeViewerRoot>
    </FileIntakeViewerProvider>
  )
}
