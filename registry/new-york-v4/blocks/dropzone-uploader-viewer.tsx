"use client"

import * as React from "react"

import type { DropzoneFileItem, DropzoneIntake } from "@/components/ui/dropzone"
import { ViewerBody } from "@/components/ui/viewer"

import {
  FileIntakeViewerDropTarget,
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
      <FileIntakeViewerDropTarget>
        <FileIntakeViewerRoot className={className}>
          <FileIntakeViewerHeader />
          <ViewerBody className="flex-col md:flex-row">
            <FileIntakeViewerSidebar />
            <FileIntakeViewerSurface />
          </ViewerBody>
        </FileIntakeViewerRoot>
      </FileIntakeViewerDropTarget>
    </FileIntakeViewerProvider>
  )
}
