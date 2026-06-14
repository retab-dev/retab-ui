"use client"

import {
  FileSystemLight,
  type FileSystemLightFile,
} from "@/components/ui/file-system-light"

const FILE_SYSTEM_LIGHT_FILES: FileSystemLightFile[] = [
  {
    path: "reports/nvidia-10k-fy2024.pdf",
    source: {
      kind: "url",
      url: "/samples/nvidia-10k-fy2024.pdf",
      fileName: "nvidia-10k-fy2024.pdf",
      mimeType: "application/pdf",
    },
  },
  {
    path: "reports/loan-application.pdf",
    source: {
      kind: "url",
      url: "/samples/loan-application.pdf",
      fileName: "loan-application.pdf",
      mimeType: "application/pdf",
    },
  },
  {
    path: "images/loan-application-page-1.png",
    source: {
      kind: "url",
      url: "/samples/loan-application-page-1.png",
      fileName: "loan-application-page-1.png",
      mimeType: "image/png",
    },
  },
  {
    path: "images/bank-statement-page-1.png",
    source: {
      kind: "url",
      url: "/samples/bank-statement-page-1.png",
      fileName: "bank-statement-page-1.png",
      mimeType: "image/png",
    },
  },
  {
    path: "data/app-config.json",
    source: {
      kind: "url",
      url: "/samples/app-config.json",
      fileName: "app-config.json",
      mimeType: "application/json",
    },
  },
]

export function FsLightBlock() {
  return (
    <FileSystemLight
      className="h-full min-h-[680px]"
      files={FILE_SYSTEM_LIGHT_FILES}
      title="File System Light"
    />
  )
}
