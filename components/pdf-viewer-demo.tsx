"use client"

import * as React from "react"

import { PdfViewer } from "@/components/ui/pdf-viewer"

// A normalized bounding box (0..1) to demonstrate the per-page overlay slot —
// the same shape Retab's edit fields and extraction sources use.
const sampleBox = { page: 1, left: 0.12, top: 0.2, width: 0.5, height: 0.05 }

export function PdfViewerDemo() {
  return (
    // A 96-page NVIDIA 10-K so the continuous-scroll virtualization shows at scale.
    <div className="not-prose my-6 h-[600px]">
      <PdfViewer
        src="/samples/nvidia-10k-fy2024.pdf"
        downloadFileName="nvidia-10k-fy2024.pdf"
        className="h-full"
        renderPageOverlay={({ pageNumber }) =>
          pageNumber === sampleBox.page ? (
            <div
              className="absolute rounded-[2px] outline outline-2 outline-primary"
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
