"use client";

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
} from "@/components/ui/file-viewer";
import {
  PdfViewerPages,
  PdfViewerProvider,
  PdfViewerThumbnails,
} from "@/components/ui/pdf-viewer";

const PDF_URL = "/samples/nvidia-10k-fy2024.pdf";
const PDF_SOURCE = {
  kind: "url" as const,
  url: PDF_URL,
  fileName: "nvidia-10k-fy2024.pdf",
};

/**
 * PDF viewer with page thumbnails in a navigation rail.
 *
 * ViewerSidebar owns placement. PdfViewerThumbnails owns PDF page
 * thumbnail behavior, active-page highlighting, and click-to-jump navigation.
 */
export function PdfThumbnailsBlock() {
  return (
    <div className="bg-background h-full min-h-[680px]">
      <FileViewer source={PDF_SOURCE} defaultOpen className="h-full">
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
  );
}
