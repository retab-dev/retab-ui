"use client"

import { ImageViewer } from "@/components/ui/image-viewer"

export function ImageViewerDemo() {
  return (
    <div className="not-prose my-6 h-[600px]">
      <ImageViewer
        source={{
          kind: "url",
          url: "/samples/nvidia-10q-scan.tiff",
          fileName: "nvidia-10q-scan.tiff",
        }}
        fallbackFrameSize={{ width: 1275, height: 1650 }}
        className="h-full"
      />
    </div>
  )
}
