"use client"

import * as React from "react"

import { XlsxViewer } from "@/components/ui/xlsx-viewer"

export function XlsxViewerDemo() {
  return (
    <div className="h-[600px]">
      <XlsxViewer
        source={{
          kind: "url",
          url: "/samples/nvidia-financials-fy2024.xlsx",
          fileName: "nvidia-financials-fy2024.xlsx",
        }}
        className="h-full"
        fallbackSheetTabs
        isolateStyles
      />
    </div>
  )
}
