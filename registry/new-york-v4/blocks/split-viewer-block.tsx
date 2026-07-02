"use client";

import {
  FileViewerContent,
  FileViewerHeader,
  FileViewerTitle,
  FileViewerLegend,
  FileViewer,
  FileViewerProvider,
  FileViewerSidebarTrigger,
  FileViewerInset,
  FileViewerControls,
} from "@/components/ui/file-viewer";
import { PdfViewerPages, PdfViewerProvider } from "@/components/ui/pdf-viewer";
import type { SplitView } from "@/components/viewers/lib/split-types";
import {
  SplitViewerDocument,
  SplitViewerLegend,
  SplitViewerProvider,
  SplitViewerSidebar,
  useSplitViewerDocumentControls,
} from "@/components/viewers/split/split-viewer";

const PDF_URL = "/samples/an-image-is-worth-16x16-words.pdf";

// A split result: named subdocuments, each owning a 1-indexed page range.
const SPLIT_RESULT: SplitView = {
  output: [
    { name: "Title, Abstract & Introduction", pages: [1] },
    { name: "Related Work", pages: [2] },
    { name: "Method", pages: [3] },
    { name: "Experiments", pages: [4, 5, 6, 7, 8] },
    { name: "Conclusion & References", pages: [9, 10, 11, 12] },
    { name: "Appendix", pages: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
  ],
};

/**
 * Split viewer block — the file + sidebar + legend system over a split result.
 * `SplitViewer` owns the legend and page rail; the document prop reads page
 * and scroll controls from the split provider.
 */
export function SplitViewerBlock() {
  const source = {
    kind: "url" as const,
    url: PDF_URL,
    fileName: "an-image-is-worth-16x16-words.pdf",
  };

  return (
    <div className="bg-background flex h-full min-h-[680px] flex-col">
      <SplitViewerProvider result={SPLIT_RESULT}>
        <FileViewerProvider source={source} defaultSidebarOpen>
          <FileViewer className="bg-background">
            <PdfViewerProvider>
              <FileViewerHeader>
                  <FileViewerSidebarTrigger className="-ms-1" />
                  <FileViewerTitle />
                  <FileViewerControls />
              </FileViewerHeader>
              <FileViewerContent>
                <SplitViewerSidebar />
                <FileViewerInset>
                  <FileViewerLegend>
                    <SplitViewerLegend className="px-3 py-2" />
                  </FileViewerLegend>
                  <SplitViewerDocument document={<SplitViewerPdfDocument />} />
                </FileViewerInset>
              </FileViewerContent>
            </PdfViewerProvider>
          </FileViewer>
        </FileViewerProvider>
      </SplitViewerProvider>
    </div>
  );
}

function SplitViewerPdfDocument() {
  const controls = useSplitViewerDocumentControls();

  return (
    <PdfViewerPages
      ref={controls.setDocumentHandle}
      bare
      onVisiblePageChange={controls.onCurrentPageChange}
      onScrollProgressChange={controls.onScrollProgressChange}
      className="h-full"
    />
  );
}
