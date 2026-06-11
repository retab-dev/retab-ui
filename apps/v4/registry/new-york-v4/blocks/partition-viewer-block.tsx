"use client"

import type { PartitionResult } from "@/components/viewers/lib/partition-types"
import { PartitionViewer } from "@/components/viewers/partition/partition-viewer"
import { PdfViewer } from "@/components/ui/pdf-viewer"

const PDF_URL = "/samples/tapstone.pdf"

// A partition result: keyed chunks, each owning a set of 1-indexed pages.
const PARTITION_RESULT: PartitionResult = {
  output: [
    { key: "header", pages: [1] },
    { key: "owner_operator", pages: [1] },
    { key: "production_table", pages: [1, 2, 3] },
    { key: "totals", pages: [3, 4] },
    { key: "footer", pages: [4] },
  ],
  consensus: { choices: [], likelihoods: null },
  usage: null,
}

/**
 * Partition viewer block — the file + legend + waterfall ribbon over keyed
 * chunks. `PartitionViewer` owns the chrome (legend + horizontal page ribbon)
 * and renders it below the `PdfViewer` toolbar.
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
            downloadFileName="tapstone.pdf"
            header={handlers.header}
            onVisiblePageChange={handlers.onCurrentPageChange}
            onScrollProgressChange={handlers.onScrollProgressChange}
            className="h-full"
          />
        )}
      />
    </div>
  )
}
