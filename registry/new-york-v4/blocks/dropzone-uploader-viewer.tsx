"use client"

import * as React from "react"

import type { BlobViewerSource } from "@/lib/viewer-source"
import { ViewerBody } from "@/components/ui/viewer"

import {
  UploadableFileViewerContent,
  UploadableFileViewerFrame,
  UploadableFileViewerHeader,
  UploadableFileViewerProvider,
  UploadableFileViewerSummary,
} from "./dropzone-uploader-viewer-parts"

export type DropzoneUploaderViewerProps = {
  className?: string
  renderViewer: (source: BlobViewerSource) => React.ReactNode
}

export function DropzoneUploaderViewer({
  className,
  renderViewer,
}: DropzoneUploaderViewerProps) {
  return (
    <UploadableFileViewerProvider>
      <UploadableFileViewerFrame className={className}>
        <UploadableFileViewerHeader />
        <ViewerBody className="flex-col md:flex-row">
          <UploadableFileViewerSummary />
          <UploadableFileViewerContent renderViewer={renderViewer} />
        </ViewerBody>
      </UploadableFileViewerFrame>
    </UploadableFileViewerProvider>
  )
}
