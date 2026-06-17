"use client"

import { PdfViewerPages, PdfViewerProvider } from "@/components/ui/pdf-viewer"
import {
  SplitViewer,
  useSplitViewerDocumentControls,
} from "@/components/viewers/split/split-viewer"

const splitSource = {
  kind: "url" as const,
  url: "/samples/an-image-is-worth-16x16-words.pdf",
  fileName: "an-image-is-worth-16x16-words.pdf",
}

// The same split result, but mounted in a real split viewer: the sidebar is the
// left rail beside the ViT paper, sharing hover, focus, and selection with the
// legend and page timeline above the document.
const splitOutput = [
  { name: "Title, Abstract & Introduction", pages: [1] },
  { name: "Related Work", pages: [2] },
  { name: "Method", pages: [3] },
  { name: "Experiments", pages: [4, 5, 6, 7, 8] },
  { name: "Conclusion & References", pages: [9, 10, 11, 12] },
  { name: "Appendix", pages: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
]

export function SegmentSidebarSplit() {
  return (
    <div
      className="not-prose relative h-[640px] w-full overflow-hidden rounded-lg border bg-background"
      data-demo="segment-sidebar-split"
    >
      <SplitViewer
        source={splitSource}
        result={{ output: splitOutput }}
        document={<SegmentSidebarSplitDocument />}
      />
    </div>
  )
}

function SegmentSidebarSplitDocument() {
  const controls = useSplitViewerDocumentControls()

  return (
    <PdfViewerProvider source={splitSource}>
      <PdfViewerPages
        ref={controls.setDocumentHandle}
        bare
        className="h-full"
        onScrollProgressChange={controls.onScrollProgressChange}
        onVisiblePageChange={controls.onCurrentPageChange}
      />
    </PdfViewerProvider>
  )
}
