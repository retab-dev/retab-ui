"use client"

import {
  FileViewer,
  FileViewerBody,
  FileViewerControls,
  FileViewerHeader,
  FileViewerMeta,
  FileViewerSidebar,
  FileViewerSidebarTrigger,
  FileViewerSurface,
  FileViewerTitle,
} from "@/components/ui/file-viewer"
import {
  PdfViewerPages,
  PdfViewerProvider,
  PdfViewerThumbnails,
} from "@/components/ui/pdf-viewer"

const PDF_SOURCE = {
  kind: "url" as const,
  url: "/samples/nvidia-10k-fy2024.pdf",
  fileName: "nvidia-10k-fy2024.pdf",
}

export function PdfViewerDemo() {
  return (
    // A 96-page NVIDIA 10-K so the continuous-scroll virtualization shows at scale.
    <div className="h-[600px] min-h-0">
      <FileViewer
        source={PDF_SOURCE}
        defaultOpen
        mode="inline"
        className="h-full"
      >
        <PdfViewerProvider>
          <FileViewerHeader>
            <FileViewerSidebarTrigger className="-ml-1" />
            <FileViewerTitle />
            <FileViewerMeta />
            <FileViewerControls />
          </FileViewerHeader>
          <FileViewerBody>
            <FileViewerSidebar
              aria-label="PDF pages"
              width="4.5rem"
              className="border-r"
            >
              <PdfViewerThumbnails thumbnailWidth={60} />
            </FileViewerSidebar>
            <FileViewerSurface>
              <PdfViewerPages bare className="h-full" />
            </FileViewerSurface>
          </FileViewerBody>
        </PdfViewerProvider>
      </FileViewer>
    </div>
  )
}
