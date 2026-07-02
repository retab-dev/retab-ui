"use client";

import {
  FileViewerContent,
  FileViewerHeader,
  FileViewerTitle,
  FileViewerLegend,
  FileViewer,
  FileViewerProvider,
  FileViewerInset,
  FileViewerControls,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import { PdfViewerPages, PdfViewerProvider } from "@/components/ui/pdf-viewer";
import type { PartitionResult } from "@/components/viewers/lib/partition-types";
import {
  PartitionViewerHeaderMeta,
  PartitionViewerLegend,
  PartitionViewerProvider,
  PartitionViewerRibbon,
  usePartitionViewerDocumentControls,
} from "@/components/viewers/partition/partition-viewer";

const PDF_URL = "/samples/an-image-is-worth-16x16-words.pdf";

// A partition result: keyed chunks, each owning a set of 1-indexed pages.
const PARTITION_RESULT: PartitionResult = {
  output: [
    { key: "abstract", pages: [1] },
    { key: "introduction", pages: [1, 2] },
    { key: "related_work", pages: [2] },
    { key: "method", pages: [3, 4] },
    { key: "experiments", pages: [4, 5, 6, 7, 8] },
    { key: "conclusion", pages: [9] },
    { key: "references", pages: [9, 10, 11, 12] },
    { key: "appendix", pages: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
  ],
  consensus: { choices: [], likelihoods: null },
  usage: null,
};

/**
 * Partition viewer block — the file + legend + waterfall ribbon over keyed
 * chunks. The provider owns the key and ribbon state; the document surface is
 * visible JSX.
 */
export function PartitionViewerBlock() {
  const source = {
    kind: "url" as const,
    url: PDF_URL,
    fileName: "an-image-is-worth-16x16-words.pdf",
  };

  return (
    <div className="bg-background flex h-full min-h-[680px] flex-col">
      <PartitionViewerProvider result={PARTITION_RESULT}>
        <FileViewerProvider source={source}>
          <FileViewer className="bg-background">
            <PdfViewerProvider>
              <FileViewerHeader>
                  <FileViewerTitle />
                  <PartitionViewerHeaderMeta />
                  <FileViewerControls />
              </FileViewerHeader>
              <FileViewerContent>
                <FileViewerInset>
                  <FileViewerLegend>
                    <PartitionViewerLegend className="px-3 py-2" />
                  </FileViewerLegend>
                  <PartitionViewerRibbon />
                  <FileViewerViewport>
                    <PartitionSourceDocument />
                  </FileViewerViewport>
                </FileViewerInset>
              </FileViewerContent>
            </PdfViewerProvider>
          </FileViewer>
        </FileViewerProvider>
      </PartitionViewerProvider>
    </div>
  );
}

function PartitionSourceDocument() {
  const controls = usePartitionViewerDocumentControls();

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
