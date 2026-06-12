"use client"

import { PdfViewer } from "@/components/ui/pdf-viewer"

export function PdfViewerDemo() {
  return (
    // A 96-page NVIDIA 10-K so the continuous-scroll virtualization shows at scale.
    <div className="not-prose my-6 h-[600px]">
      <PdfViewer
        source={{
          kind: "url",
          url: "/samples/nvidia-10k-fy2024.pdf",
          fileName: "nvidia-10k-fy2024.pdf",
        }}
        className="h-full"
      />
    </div>
  )
}
