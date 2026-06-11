"use client"

import * as React from "react"

import { meanConfidence, toSegments } from "@/lib/segments"
import { SegmentSidebar } from "@/components/ui/segment-sidebar"
import { SegmentedDocumentViewer } from "@/components/ui/segmented-document-viewer"
import { useSegmentInteraction } from "@/components/ui/use-segment-interaction"

// A split-style result (named subdocuments) with per-page likelihoods — the
// same model also covers partition chunks; only the label differs.
const output = [
  { name: "Title & Abstract", pages: [1] },
  { name: "Introduction", pages: [2, 3] },
  { name: "Model Architecture", pages: [4, 5, 6] },
  { name: "Results", pages: [7, 8] },
  { name: "References", pages: [9, 10, 11] },
]
const likelihoods = [
  [0.99],
  [0.95, 0.9],
  [0.9, 0.85, 0.9],
  [0.8, 0.82],
  [0.97, 0.95, 0.96],
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
// left rail beside attention.pdf, sharing hover, focus, and selection with the
// legend and page timeline above the document.
const splitOutput = [
  { name: "Title & Abstract", pages: [1] },
  { name: "Introduction", pages: [2, 3] },
  { name: "Model Architecture", pages: [4, 5, 6] },
  { name: "Results", pages: [7, 8, 9] },
  { name: "References", pages: [10, 11] },
  { name: "Attention Visualizations", pages: [12, 13, 14, 15] },
]

export function SegmentSidebarSplitDemo() {
  const segments = React.useMemo(() => toSegments(splitOutput), [])
  return (
    <div className="not-prose my-6" style={{ height: 640 }}>
      <SegmentedDocumentViewer
        segments={segments}
        src="/samples/attention.pdf"
        unitLabel="subdocument"
        title="attention.pdf · 6 subdocuments"
        className="h-full"
      />
    </div>
  )
}
