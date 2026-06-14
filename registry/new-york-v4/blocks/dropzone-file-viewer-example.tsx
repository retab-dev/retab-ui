"use client"

import { type DropzoneExampleProps } from "./dropzone-example-shared"
import { DropzoneUploaderViewer } from "./dropzone-uploader-viewer"

export function DropzoneFileViewerExample({ className }: DropzoneExampleProps) {
  return <DropzoneUploaderViewer className={className} />
}
