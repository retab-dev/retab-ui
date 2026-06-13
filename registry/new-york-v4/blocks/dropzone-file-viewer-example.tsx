"use client"

import { FileViewer } from "@/components/ui/file-viewer"

import { type DropzoneExampleProps } from "./dropzone-example-shared"
import { DropzoneUploaderViewer } from "./dropzone-uploader-viewer"

export function DropzoneFileViewerExample({ className }: DropzoneExampleProps) {
  return (
    <DropzoneUploaderViewer
      className={className}
      renderViewer={(source) => (
        <FileViewer
          source={source}
          bare
          className="h-[26rem] rounded-md border bg-background"
        />
      )}
    />
  )
}
