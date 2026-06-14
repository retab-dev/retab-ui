"use client"

import {
  PdfViewerHeader,
  PdfViewerPages,
  PdfViewerProvider,
} from "@/components/ui/pdf-viewer"
import { ViewerBody, ViewerRoot, ViewerSurface } from "@/components/ui/viewer"
import type { PartitionResult } from "@/components/viewers/lib/partition-types"
import {
  PartitionViewerHeader,
  PartitionViewerProvider,
  usePartitionViewerDocumentControls,
} from "@/components/viewers/partition/partition-viewer"

const PDF_URL = "/samples/an-image-is-worth-16x16-words.pdf"

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
}

/**
 * Partition viewer block — the file + legend + waterfall ribbon over keyed
 * chunks. The provider owns the key and ribbon state; the document surface is
 * visible JSX.
 */
export function PartitionViewerBlock() {
  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <PartitionViewerProvider result={PARTITION_RESULT}>
        <PdfViewerProvider
          source={{
            kind: "url",
            url: PDF_URL,
            fileName: "an-image-is-worth-16x16-words.pdf",
          }}
        >
          <ViewerRoot bare className="h-full flex-1 bg-background">
            <PdfViewerHeader />
            <PartitionViewerHeader />
            <ViewerBody>
              <ViewerSurface>
                <PartitionSourceDocument />
              </ViewerSurface>
            </ViewerBody>
          </ViewerRoot>
        </PdfViewerProvider>
      </PartitionViewerProvider>
    </div>
  )
}

function PartitionSourceDocument() {
  const controls = usePartitionViewerDocumentControls()

  return (
    <PdfViewerPages
      ref={controls.setDocumentHandle}
      bare
      onVisiblePageChange={controls.onCurrentPageChange}
      onScrollProgressChange={controls.onScrollProgressChange}
      className="h-full"
    />
  )
}
