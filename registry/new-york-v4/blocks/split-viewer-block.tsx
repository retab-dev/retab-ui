"use client"

import type { SplitView } from "@/components/viewers/lib/split-types"
import { SplitViewer } from "@/components/viewers/split/split-viewer"
import { PdfViewer } from "@/components/ui/pdf-viewer"

const PDF_URL = "/samples/attention.pdf"

// A split result: named subdocuments, each owning a 1-indexed page range.
const SPLIT_RESULT: SplitView = {
  output: [
    { name: "Title & Abstract", pages: [1] },
    { name: "Introduction", pages: [2, 3] },
    { name: "Model Architecture", pages: [4, 5, 6] },
    { name: "Results", pages: [7, 8, 9] },
    { name: "References", pages: [10, 11] },
    { name: "Attention Visualizations", pages: [12, 13, 14, 15] },
  ],
}

/**
 * Split viewer block — the file + sidebar + legend system over a split result.
 * `SplitViewer` hands the document surface its chrome as `slots` (legend in
 * `top`, page ribbon as a `left` rail); the surface spreads them onto the
 * `PdfViewer`.
 */
export function SplitViewerBlock() {
  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <SplitViewer
        result={SPLIT_RESULT}
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
