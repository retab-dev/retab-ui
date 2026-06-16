"use client"

import * as React from "react"

import { meanConfidence, toSegments } from "@/lib/segments"
import { PdfViewerPages, PdfViewerProvider } from "@/components/ui/pdf-viewer"
import { SegmentSidebar } from "@/components/ui/segment-sidebar"
import { useSegmentInteraction } from "@/components/ui/use-segment-interaction"
import {
  SplitViewer,
  useSplitViewerDocumentControls,
} from "@/components/viewers/split/split-viewer"

const splitSource = {
  kind: "url" as const,
  url: "/samples/an-image-is-worth-16x16-words.pdf",
  fileName: "an-image-is-worth-16x16-words.pdf",
}

// A split-style result (named subdocuments) with per-page likelihoods — the
// same model also covers partition chunks; only the label differs.
const output = [
  { name: "Title, Abstract & Introduction", pages: [1] },
  { name: "Related Work", pages: [2] },
  { name: "Method", pages: [3] },
  { name: "Experiments", pages: [4, 5, 6, 7, 8] },
  { name: "Conclusion & References", pages: [9, 10, 11, 12] },
  { name: "Appendix", pages: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
]
const likelihoods = [
  [0.99],
  [0.94],
  [0.92],
  [0.88, 0.86, 0.9, 0.87, 0.85],
  [0.96, 0.95, 0.94, 0.93],
  [0.91, 0.9, 0.92, 0.89, 0.9, 0.88, 0.87, 0.9, 0.89, 0.88],
]

export function SegmentSidebarDemo() {
  const segments = React.useMemo(
    () =>
      toSegments(
        output,
        likelihoods.map((l) => meanConfidence(l))
      ),
    []
  )
  const interaction = useSegmentInteraction()
  return (
    <div className="not-prose my-6 max-w-xs">
      <SegmentSidebar
        segments={segments}
        interaction={interaction}
        unitLabel="subdocument"
        className="rounded-lg border"
      />
    </div>
  )
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

export function SegmentSidebarSplitDemo() {
  return (
    <div
      className="not-prose relative my-6 h-[640px] w-full overflow-hidden rounded-lg border bg-background"
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
    <PdfViewerProvider
      source={splitSource}
    >
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
