"use client"

import type { PartitionResult } from "@/components/viewers/lib/partition-types"
import { PartitionViewer } from "@/components/viewers/partition/partition-viewer"
import { PdfViewer } from "@/components/ui/pdf-viewer"

const PDF_URL = "/samples/attention.pdf"

// A partition result: keyed chunks, each owning a set of 1-indexed pages.
const PARTITION_RESULT: PartitionResult = {
  output: [
    { key: "abstract", pages: [1] },
    { key: "introduction", pages: [2] },
    { key: "model_architecture", pages: [2, 3, 4, 5, 6] },
    { key: "training", pages: [7, 8] },
    { key: "results", pages: [8, 9, 10] },
    { key: "references", pages: [10, 11, 12] },
  ],
  consensus: { choices: [], likelihoods: null },
  usage: null,
}

/**
 * Partition viewer block — the file + legend + waterfall ribbon over keyed
 * chunks. `PartitionViewer` hands the document surface its chrome as `slots`
 * (the color key in `top`, the consensus waterfall in `bottom`); the surface
 * spreads them onto the `PdfViewer`.
 */
export function PartitionViewerBlock() {
  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <PartitionViewer
        result={PARTITION_RESULT}
        renderDocument={(handlers) => (
          <PdfViewer
            src={PDF_URL}
            bare
            downloadFileName="attention.pdf"
            slots={handlers.slots}
            onVisiblePageChange={handlers.onCurrentPageChange}
            onScrollProgressChange={handlers.onScrollProgressChange}
            className="h-full"
          />
        )}
      />
    </div>
  )
}
