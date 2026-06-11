"use client"

import * as React from "react"

import { DocxViewer } from "@/components/ui/docx-viewer"

export function DocxViewerDemo() {
  return (
    // A ~50-page multi-section document so off-screen page skipping shows at scale.
    <div className="not-prose my-6 h-[600px]">
      <DocxViewer
        src="/samples/sample-large-50pages.docx"
        downloadFileName="sample-large-50pages.docx"
        className="h-full"
      />
    </div>
  )
}
