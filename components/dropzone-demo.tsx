"use client"

import * as React from "react"

import { Dropzone } from "@/registry/new-york-v4/ui/dropzone"

export function DropzoneDemo() {
  return (
    <div className="not-prose rounded-xl border bg-card p-4 shadow-sm sm:p-6">
      <Dropzone
        accept="application/pdf,image/*,.docx,.xlsx,.csv"
        description="PDF, DOCX, XLSX, CSV, PNG, or JPG"
      />
    </div>
  )
}
