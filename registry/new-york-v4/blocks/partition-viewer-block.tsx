"use client"

import { PdfViewer } from "@/components/ui/pdf-viewer"
import type { PartitionResult } from "@/components/viewers/lib/partition-types"
import { PartitionViewer } from "@/components/viewers/partition/partition-viewer"

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
 * chunks. `PartitionViewer` owns the key and ribbon; the document renderer only
 * receives page and scroll handlers.
 */
export function PartitionViewerBlock() {
  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <PartitionViewer
        result={PARTITION_RESULT}
        renderDocument={(handlers) => (
          <PdfViewer
            source={{
              kind: "url",
              url: PDF_URL,
              fileName: "an-image-is-worth-16x16-words.pdf",
            }}
            bare
            onVisiblePageChange={handlers.onCurrentPageChange}
            onScrollProgressChange={handlers.onScrollProgressChange}
            className="h-full"
          />
        )}
      />
    </div>
  )
}
