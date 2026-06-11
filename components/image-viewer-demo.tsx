"use client"

import { ImageViewer } from "@/components/ui/image-viewer"

export function ImageViewerDemo() {
  return (
    <div className="not-prose my-6 h-[600px]">
      <ImageViewer
        src="/samples/nvidia-10q-scan.tiff"
        downloadFileName="nvidia-10q-scan.tiff"
        className="h-full"
      />
    </div>
  )
}
