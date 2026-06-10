"use client"

import * as React from "react"

import { PdfViewer } from "@/components/ui/pdf-viewer"

// A normalized bounding box (0..1) to demonstrate the per-page overlay slot —
// the same shape Retab's edit fields and extraction sources use.
const sampleBox = { page: 1, left: 0.12, top: 0.16, width: 0.4, height: 0.035 }

export function PdfViewerDemo() {
  return (
    <div className="not-prose my-6 h-[600px]">
      <PdfViewer
        src="/samples/loan-application.pdf"
        downloadFileName="loan-application.pdf"
        className="h-full"
        renderPageOverlay={({ pageNumber }) =>
          pageNumber === sampleBox.page ? (
            <div
              className="absolute rounded-[2px] outline outline-2 outline-indigo-500"
              style={{
                left: `${sampleBox.left * 100}%`,
                top: `${sampleBox.top * 100}%`,
                width: `${sampleBox.width * 100}%`,
                height: `${sampleBox.height * 100}%`,
                backgroundColor: "rgba(99,102,241,0.18)",
              }}
            />
          ) : null
        }
      />
    </div>
  )
}
