"use client"

import { PdfViewer } from "@/components/ui/pdf-viewer"
import type { SplitView } from "@/components/viewers/lib/split-types"
import { SplitViewer } from "@/components/viewers/split/split-viewer"

const PDF_URL = "/samples/an-image-is-worth-16x16-words.pdf"

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
            ref={handlers.setViewerHandle}
            source={{
              kind: "url",
              url: PDF_URL,
              fileName: "an-image-is-worth-16x16-words.pdf",
            }}
            bare
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
