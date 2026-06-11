"use client"

import * as React from "react"

import { XlsxViewer } from "@/components/ui/xlsx-viewer"

export function XlsxViewerDemo() {
  return (
    <div className="not-prose my-6 h-[600px]">
      <XlsxViewer
        src="/samples/nvidia-financials-fy2024.xlsx"
        downloadFileName="nvidia-financials-fy2024.xlsx"
        className="h-full"
        isolateStyles
      />
    </div>
  )
}
