"use client"

import * as React from "react"

import { DocxViewer } from "@/components/ui/docx-viewer"

export function DocxViewerDemo() {
  return (
    // A 25-page report (explicit page breaks; the rendered count matches the
    // document's own page count) so off-screen page skipping shows at scale.
    <div className="not-prose my-6 h-[600px]">
      <DocxViewer
        source={{
          kind: "url",
          url: "/samples/quarterly-business-review.docx",
          fileName: "quarterly-business-review.docx",
        }}
        className="h-full"
      />
    </div>
  )
}
