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
  FileViewerInset,
  FileViewerToolbar,
  FileViewerViewport,
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
      <FileViewerProvider source={PDF_SOURCE} defaultSidebarOpen>
        <FileViewer className="h-full">
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
              <FileViewerInset>
                <FileViewerViewport>
                  <PdfViewerPages bare className="h-full" />
                </FileViewerViewport>
              </FileViewerInset>
            </FileViewerBody>
          </PdfViewerProvider>
        </FileViewer>
      </FileViewerProvider>
    </div>
  );
}
