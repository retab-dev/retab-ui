"use client"

import { type DropzoneExampleProps } from "./dropzone-example-shared"
import { FileIntakeViewer } from "./dropzone-uploader-viewer"

export function DropzoneFileViewerExample({ className }: DropzoneExampleProps) {
  return <FileIntakeViewer className={className} />
}
