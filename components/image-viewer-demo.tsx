"use client"

import * as React from "react"

import { ImageViewer } from "@/components/ui/image-viewer"

// A normalized bounding box (0..1) to demonstrate the per-frame overlay slot —
// the same shape Retab's edit fields and extraction sources use. Anchored to the
// header bar drawn on the first page of the sample scan.
const sampleBox = { page: 1, left: 0.06, top: 0.049, width: 0.875, height: 0.045 }

export function ImageViewerDemo() {
  return (
    <div className="not-prose my-6 h-[600px]">
      <ImageViewer
        src="/samples/nvidia-10q-scan.tiff"
        downloadFileName="nvidia-10q-scan.tiff"
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
