"use client";

import {
  FileViewer,
  FileViewerBody,
  FileViewerHeader,
  FileViewerHeaderEnd,
  FileViewerHeaderStart,
  FileViewerIdentity,
  FileViewerProvider,
  FileViewerSidebar,
  FileViewerSidebarTrigger,
  FileViewerSurface,
  FileViewerToolbar,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import {
  PdfViewerPages,
  PdfViewerProvider,
  PdfViewerThumbnails,
} from "@/components/ui/pdf-viewer";

const PDF_SOURCE = {
  kind: "url" as const,
  url: "/samples/nvidia-10k-fy2024.pdf",
  fileName: "nvidia-10k-fy2024.pdf",
};

export function PdfViewerDemo() {
  return (
    // A 96-page NVIDIA 10-K so the continuous-scroll virtualization shows at scale.
    <div className="h-[600px] min-h-0">
      <FileViewerProvider source={PDF_SOURCE} defaultSidebarOpen>
        <FileViewer sidebarMode="inline" className="h-full">
          <PdfViewerProvider>
            <FileViewerHeader>
              <FileViewerHeaderStart>
                <FileViewerSidebarTrigger className="-ml-1" />
                <FileViewerIdentity />
              </FileViewerHeaderStart>
              <FileViewerHeaderEnd>
                <FileViewerToolbar />
              </FileViewerHeaderEnd>
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
                <FileViewerViewport>
                  <PdfViewerPages bare className="h-full" />
                </FileViewerViewport>
              </FileViewerSurface>
            </FileViewerBody>
          </PdfViewerProvider>
        </FileViewer>
      </FileViewerProvider>
    </div>
  );
}
