"use client"

import * as React from "react"

import { Dropzone } from "@/registry/new-york-v4/ui/dropzone"

export function DropzoneDemo() {
  const [fileNames, setFileNames] = React.useState<string[]>([])
  const [message, setMessage] = React.useState("No files selected")

  return (
    <div className="not-prose rounded-xl border bg-card p-4 shadow-sm sm:p-6">
      <Dropzone
        accept="application/pdf,image/*,.docx,.xlsx,.csv"
        description="PDF, DOCX, XLSX, CSV, PNG, or JPG"
        onFilesAccepted={(files) => {
          setFileNames(files.map((file) => file.name))
          setMessage(
            `${files.length} file${files.length === 1 ? "" : "s"} ready`
          )
        }}
        onFilesRejected={(rejections) => {
          setFileNames([])
          setMessage(rejections[0]?.message ?? "File rejected")
        }}
      />
      <div className="mt-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{message}</span>
        {fileNames.length > 0 ? (
          <span className="ml-2">{fileNames.join(", ")}</span>
        ) : null}
      </div>
    </div>
  )
}
