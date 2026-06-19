"use client";

import { cn } from "@/lib/utils";

import { type DropzoneExampleProps } from "./dropzone-example-shared";
import { FileIntakeViewer } from "./dropzone-uploader-viewer";

export function DropzoneFileViewerExample({ className }: DropzoneExampleProps) {
  return <FileIntakeViewer className={cn("h-[34rem]", className)} />;
}
